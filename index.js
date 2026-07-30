require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, AudioPlayerStatus } = require('@discordjs/voice');
const { getSongInfo, getPlaylistInfo, isPlaylistUrl } = require('./ytdlp');
const { getQueue, createQueue, buildControlsRow } = require('./queue');
const msg = require('./messages');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

if (process.env.ACTIVITY_ENABLED === 'true') {
  try {
    require('./server').startActivityServer();
  } catch (error) {
    console.error('[activity] No se pudo iniciar (el bot sigue funcionando normal):', error);
  }
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

client.once('clientReady', async () => {
  console.log(`Conectado como ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.members.me.setNickname('Walter Red');
    } catch {
      // sin permiso para cambiar el apodo, no pasa nada
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const queue = getQueue(interaction.guildId);
    if (!queue) {
      await interaction.reply({ content: msg.notInChannel(), ephemeral: true });
      return;
    }

    if (interaction.customId === 'music_pauseresume') {
      const result = queue.togglePause();
      if (result === 'paused') await interaction.reply(msg.paused());
      else if (result === 'resumed') await interaction.reply(msg.resumed());
      else await interaction.reply({ content: msg.nothingPlaying(), ephemeral: true });
      return;
    }

    if (interaction.customId === 'music_skip') {
      if (queue.songs.length === 0) {
        await interaction.reply({ content: msg.nothingPlaying(), ephemeral: true });
        return;
      }
      queue.skip();
      await interaction.reply(msg.skipped());
      return;
    }

    if (interaction.customId === 'music_stop') {
      queue.destroy();
      await interaction.reply(msg.leftChannel());
      return;
    }

    if (interaction.customId === 'music_shuffle') {
      if (queue.songs.length < 3) {
        await interaction.reply({ content: msg.notEnoughToShuffle(), ephemeral: true });
        return;
      }
      queue.shuffle();
      await interaction.reply(msg.shuffled());
      return;
    }

    if (interaction.customId === 'music_loop') {
      const active = queue.toggleLoop();
      await interaction.reply(active ? msg.loopOn() : msg.loopOff());
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guildId } = interaction;

  if (commandName === 'test') {
    const channel = member.voice.channel;
    if (!channel) {
      await interaction.reply({ content: msg.needVoiceChannel(), ephemeral: true });
      return;
    }
    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });
    await interaction.reply(msg.joinedChannel(channel.name));
    return;
  }

  if (commandName === 'play') {
    const channel = member.voice.channel;
    if (!channel) {
      await interaction.reply({ content: msg.needVoiceChannel(), ephemeral: true });
      return;
    }

    await interaction.deferReply();
    const query = interaction.options.getString('busqueda');

    let queue = getQueue(guildId);
    if (!queue) queue = createQueue(channel, interaction.channel);

    if (isPlaylistUrl(query)) {
      let songs;
      try {
        songs = await getPlaylistInfo(query);
      } catch (error) {
        console.error('Error buscando la playlist:', error);
        await interaction.editReply(msg.playlistError());
        return;
      }
      songs.forEach((song) => queue.add(song));
      await interaction.editReply(msg.playlistAdded(songs.length));
      return;
    }

    let song;
    try {
      song = await getSongInfo(query);
    } catch (error) {
      console.error('Error buscando la canción:', error);
      await interaction.editReply(msg.songError());
      return;
    }

    queue.add(song);
    await interaction.editReply(msg.songAdded(song.title));
    return;
  }

  if (commandName === 'skip') {
    const queue = getQueue(guildId);
    if (!queue || queue.songs.length === 0) {
      await interaction.reply({ content: msg.nothingPlaying(), ephemeral: true });
      return;
    }
    queue.skip();
    await interaction.reply(msg.skipped());
    return;
  }

  if (commandName === 'pause') {
    const queue = getQueue(guildId);
    if (!queue || queue.player.state.status !== AudioPlayerStatus.Playing) {
      await interaction.reply({ content: msg.nothingPlaying(), ephemeral: true });
      return;
    }
    queue.player.pause();
    await interaction.reply(msg.paused());
    return;
  }

  if (commandName === 'resume') {
    const queue = getQueue(guildId);
    if (!queue || queue.player.state.status !== AudioPlayerStatus.Paused) {
      await interaction.reply({ content: msg.nothingPaused(), ephemeral: true });
      return;
    }
    queue.player.unpause();
    await interaction.reply(msg.resumed());
    return;
  }

  if (commandName === 'queue') {
    const queue = getQueue(guildId);
    if (!queue || queue.songs.length === 0) {
      await interaction.reply({ content: msg.emptyQueue(), ephemeral: true });
      return;
    }
    const list = queue.songs
      .map((s, i) => (i === 0 ? `▶️ **${s.title}**` : `${i}. ${s.title}`))
      .join('\n');
    await interaction.reply(list);
    return;
  }

  if (commandName === 'leave') {
    const queue = getQueue(guildId);
    if (!queue) {
      await interaction.reply({ content: msg.notInChannel(), ephemeral: true });
      return;
    }
    queue.destroy();
    await interaction.reply(msg.leftChannel());
    return;
  }

  if (commandName === 'nowplaying') {
    const queue = getQueue(guildId);
    if (!queue || queue.songs.length === 0) {
      await interaction.reply({ content: msg.nothingPlaying(), ephemeral: true });
      return;
    }
    await interaction.reply({
      content: msg.nowPlaying(queue.songs[0].title),
      components: [buildControlsRow()],
    });
    return;
  }

  if (commandName === 'volume') {
    const queue = getQueue(guildId);
    if (!queue) {
      await interaction.reply({ content: msg.notInChannel(), ephemeral: true });
      return;
    }
    const nivel = interaction.options.getInteger('nivel');
    queue.setVolume(nivel / 100);
    await interaction.reply(msg.volumeSet(nivel));
    return;
  }

  if (commandName === 'shuffle') {
    const queue = getQueue(guildId);
    if (!queue || queue.songs.length < 3) {
      await interaction.reply({ content: msg.notEnoughToShuffle(), ephemeral: true });
      return;
    }
    queue.shuffle();
    await interaction.reply(msg.shuffled());
    return;
  }

  if (commandName === 'remove') {
    const queue = getQueue(guildId);
    const posicion = interaction.options.getInteger('posicion');
    const removed = queue ? queue.removeAt(posicion) : null;
    if (!removed) {
      await interaction.reply({ content: msg.invalidPosition(), ephemeral: true });
      return;
    }
    await interaction.reply(msg.removed(removed.title));
    return;
  }

  if (commandName === 'loop') {
    const queue = getQueue(guildId);
    if (!queue) {
      await interaction.reply({ content: msg.notInChannel(), ephemeral: true });
      return;
    }
    const active = queue.toggleLoop();
    await interaction.reply(active ? msg.loopOn() : msg.loopOff());
    return;
  }

  if (commandName === 'clear') {
    const queue = getQueue(guildId);
    if (!queue) {
      await interaction.reply({ content: msg.notInChannel(), ephemeral: true });
      return;
    }
    queue.clear();
    await interaction.reply(msg.cleared());
    return;
  }
});

client.login(process.env.DISCORD_TOKEN);
