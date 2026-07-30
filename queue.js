const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  entersState,
} = require('@discordjs/voice');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { EventEmitter } = require('events');
const { createAudioStream } = require('./ytdlp');
const msg = require('./messages');

const queues = new Map();
// Emite 'queueCreated'/'queueDestroyed' con (guildId, queue) para quien quiera
// enterarse de queues sin tener que hacer polling (p. ej. el puente de la Activity).
const queueEvents = new EventEmitter();

function buildControlsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_pauseresume').setEmoji('⏯️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
  );
}

function volumeBar(percent) {
  const segments = 10;
  const filled = Math.min(segments, Math.round((percent / 200) * segments));
  return '▰'.repeat(filled) + '▱'.repeat(segments - filled) + ` ${percent}%`;
}

function buildNowPlayingEmbed(song, queue) {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(song.title)
    .setURL(song.url)
    .setDescription(msg.nowPlayingPanel())
    .addFields({ name: 'Volumen 🔊', value: volumeBar(Math.round(queue.volume * 100)) })
    .setFooter({
      text: queue.loop
        ? `🔁 Repitiendo · ${queue.songs.length - 1} en cola`
        : `${queue.songs.length - 1} canción(es) en cola`,
    });

  if (song.duration) embed.addFields({ name: 'Duración ⏱️', value: song.duration, inline: true });
  if (song.thumbnail) embed.setThumbnail(song.thumbnail);

  return embed;
}

// Actualiza el "Voice Channel Status" (el texto que aparece bajo el nombre de la sala).
// No hay método nativo en discord.js para esto todavía, así que se llama a la API directamente.
async function setVoiceChannelStatus(channel, status) {
  try {
    await channel.client.rest.put(`/channels/${channel.id}/voice-status`, { body: { status } });
  } catch (error) {
    console.error('No se pudo actualizar el estado del canal de voz:', error.message);
  }
}

class GuildQueue extends EventEmitter {
  constructor(voiceChannel, textChannel) {
    super();
    this.songs = [];
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.player = createAudioPlayer();
    this.volume = 1;
    this.loop = false;
    this.controlsMessage = null;

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    this.connection.subscribe(this.player);
    this.textChannel.send(msg.joinedChannel(voiceChannel.name)).catch(() => {});

    this.connection.on('error', (error) => {
      console.error('Error de conexión de voz:', error);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.killCurrentProcess();
      if (!this.loop) this.songs.shift();
      this.playNext();
    });

    this.player.on('error', (error) => {
      console.error('Error de reproducción:', error);
      this.songs.shift();
      this.playNext();
    });

    // Cualquier cambio de estado del player (play/pause/resume/idle, sin importar
    // si lo disparó un slash command, un botón o la Activity) actualiza a quien esté escuchando.
    this.player.on('stateChange', () => this.emitState());
  }

  buildSnapshot() {
    const song = this.songs[0];
    return {
      song: song
        ? { title: song.title, url: song.url, thumbnail: song.thumbnail || null, duration: song.duration || null }
        : null,
      playing: this.player.state.status === AudioPlayerStatus.Playing,
      paused: this.player.state.status === AudioPlayerStatus.Paused,
      volume: Math.round(this.volume * 100),
      loop: this.loop,
      upcomingCount: Math.max(0, this.songs.length - 1),
    };
  }

  getState() {
    return this.buildSnapshot();
  }

  emitState() {
    this.emit('state', this.buildSnapshot());
  }

  togglePause() {
    const status = this.player.state.status;
    if (status === AudioPlayerStatus.Playing) {
      this.player.pause();
      return 'paused';
    }
    if (status === AudioPlayerStatus.Paused) {
      this.player.unpause();
      return 'resumed';
    }
    return null;
  }

  playNext() {
    if (this.songs.length === 0) {
      this.emitState();
      return;
    }
    const song = this.songs[0];
    try {
      const proc = createAudioStream(song.url);
      this.currentProcess = proc;

      proc.on('error', (error) => {
        console.error('Error de yt-dlp:', error);
      });

      const resource = createAudioResource(proc.stdout, { inputType: StreamType.Arbitrary, inlineVolume: true });
      resource.volume.setVolume(this.volume);
      this.player.play(resource);
      this.updateNowPlayingPanel(song);
      setVoiceChannelStatus(this.voiceChannel, `🎵 ${song.title}`);
    } catch (error) {
      console.error('No se pudo reproducir la canción:', error);
      this.songs.shift();
      this.playNext();
    }
  }

  async updateNowPlayingPanel(song) {
    const embeds = [buildNowPlayingEmbed(song, this)];
    const components = [buildControlsRow()];

    if (this.controlsMessage) {
      try {
        await this.controlsMessage.edit({ content: null, embeds, components });
        return;
      } catch {
        this.controlsMessage = null;
      }
    }

    try {
      this.controlsMessage = await this.textChannel.send({ embeds, components });
      if (this.controlsMessage.pinnable) {
        await this.controlsMessage.pin().catch(() => {});
      }
    } catch (error) {
      console.error('No se pudo enviar el panel de control:', error.message);
    }
  }

  refreshPanel() {
    if (this.songs.length > 0) this.updateNowPlayingPanel(this.songs[0]).catch(() => {});
  }

  killCurrentProcess() {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill('SIGKILL');
    }
    this.currentProcess = null;
  }

  add(song) {
    const wasEmpty = this.songs.length === 0;
    this.songs.push(song);
    if (wasEmpty) this.playNext();
    this.emitState();
  }

  skip() {
    this.player.stop();
    this.killCurrentProcess();
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.player.state.resource) {
      this.player.state.resource.volume.setVolume(volume);
    }
    this.refreshPanel();
    this.emitState();
  }

  toggleLoop() {
    this.loop = !this.loop;
    this.refreshPanel();
    this.emitState();
    return this.loop;
  }

  shuffle() {
    const upcoming = this.songs.slice(1);
    for (let i = upcoming.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
    }
    this.songs = this.songs.length > 0 ? [this.songs[0], ...upcoming] : upcoming;
    this.emitState();
  }

  removeAt(position) {
    if (position < 1 || position >= this.songs.length) return null;
    const removed = this.songs.splice(position, 1)[0];
    this.emitState();
    return removed;
  }

  clear() {
    this.songs = this.songs.slice(0, 1);
    this.emitState();
  }

  destroy() {
    this.songs = [];
    this.emitState();
    this.killCurrentProcess();
    if (this.controlsMessage) {
      this.controlsMessage.delete().catch(() => {});
      this.controlsMessage = null;
    }
    setVoiceChannelStatus(this.voiceChannel, null);
    this.connection.destroy();
    queues.delete(this.guildId);
    queueEvents.emit('queueDestroyed', this.guildId);
  }
}

function getQueue(guildId) {
  return queues.get(guildId);
}

function createQueue(voiceChannel, textChannel) {
  const queue = new GuildQueue(voiceChannel, textChannel);
  queue.guildId = voiceChannel.guild.id;
  queues.set(voiceChannel.guild.id, queue);
  queueEvents.emit('queueCreated', queue.guildId, queue);
  return queue;
}

module.exports = { getQueue, createQueue, buildControlsRow, queueEvents };
