const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const YTDLP_PATH = process.env.YTDLP_PATH || path.join(os.homedir(), '.local/bin/yt-dlp');
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

// En la nube no hay forma de subir cookies.txt directo (está gitignoreado): se puede
// pegar su contenido en la variable de entorno YTDLP_COOKIES y acá se escribe a disco.
if (process.env.YTDLP_COOKIES) {
  fs.writeFileSync(COOKIES_PATH, process.env.YTDLP_COOKIES);
}

function cookiesArgs() {
  return fs.existsSync(COOKIES_PATH) ? ['--cookies', COOKIES_PATH] : [];
}

function getSongInfo(query) {
  return new Promise((resolve, reject) => {
    const isUrl = /^https?:\/\//i.test(query);
    const target = isUrl ? query : `ytsearch5:${query}`;
    const args = ['--flat-playlist', '--no-warnings', ...cookiesArgs(), '--dump-json', target];
    const proc = spawn(YTDLP_PATH, args);

    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('close', () => {
      const lines = out.trim().split('\n').filter(Boolean);
      let chosen = null;
      for (const line of lines) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (entry._type === 'video' || entry.ie_key === 'Youtube') {
          chosen = entry;
          break;
        }
      }
      if (!chosen) {
        reject(new Error(err.trim() || 'No se encontró ningún video.'));
        return;
      }
      resolve({
        title: chosen.title,
        url: `https://www.youtube.com/watch?v=${chosen.id}`,
        thumbnail: `https://i.ytimg.com/vi/${chosen.id}/hqdefault.jpg`,
        duration: chosen.duration_string || null,
      });
    });
  });
}

const PLAYLIST_LIMIT = 100;

function isPlaylistUrl(query) {
  return /^https?:\/\//i.test(query) && /[?&]list=/.test(query);
}

function getPlaylistInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--flat-playlist',
      '--no-warnings',
      ...cookiesArgs(),
      '--dump-json',
      '--playlist-end',
      String(PLAYLIST_LIMIT),
      url,
    ];
    const proc = spawn(YTDLP_PATH, args);

    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('close', () => {
      const lines = out.trim().split('\n').filter(Boolean);
      const songs = [];
      for (const line of lines) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (entry._type === 'video' || entry.ie_key === 'Youtube') {
          songs.push({
            title: entry.title,
            url: `https://www.youtube.com/watch?v=${entry.id}`,
            thumbnail: `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
            duration: entry.duration_string || null,
          });
        }
      }
      if (songs.length === 0) {
        reject(new Error(err.trim() || 'No se encontraron videos en la playlist.'));
        return;
      }
      resolve(songs);
    });
  });
}

function createAudioStream(url) {
  const proc = spawn(YTDLP_PATH, [
    '--no-playlist',
    '--no-warnings',
    ...cookiesArgs(),
    '-f',
    'bestaudio',
    '-o',
    '-',
    url,
  ]);
  let err = '';
  proc.stderr.on('data', (d) => (err += d));
  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`yt-dlp terminó con código ${code} para ${url}:\n${err.trim()}`);
    }
  });
  return proc;
}

module.exports = { getSongInfo, getPlaylistInfo, isPlaylistUrl, createAudioStream };
