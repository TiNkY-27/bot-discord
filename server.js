const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { getQueue, queueEvents } = require('./queue');

const IDLE_STATE = { song: null, playing: false, paused: false, volume: 100, loop: false, upcomingCount: 0 };

function startActivityServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'activity', 'dist')));

  app.post('/api/token', async (req, res) => {
    try {
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: req.body.code,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`Discord respondió ${response.status}: ${JSON.stringify(data)}`);
      res.json({ access_token: data.access_token });
    } catch (error) {
      console.error('[activity] Error intercambiando el token:', error.message);
      res.status(500).json({ error: 'token_exchange_failed' });
    }
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const guildId = new URL(req.url, 'http://localhost').searchParams.get('guildId');
    if (!guildId) {
      ws.close();
      return;
    }

    const send = (state) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'state', ...state }));
    };

    let queue = getQueue(guildId);
    send(queue ? queue.getState() : IDLE_STATE);

    const onState = (state) => send(state);
    if (queue) queue.on('state', onState);

    const onCreated = (gid, q) => {
      if (gid !== guildId) return;
      queue = q;
      queue.on('state', onState);
      send(q.getState());
    };
    const onDestroyed = (gid) => {
      if (gid !== guildId) return;
      queue = null;
      send(IDLE_STATE);
    };
    queueEvents.on('queueCreated', onCreated);
    queueEvents.on('queueDestroyed', onDestroyed);

    ws.on('message', (raw) => {
      const q = getQueue(guildId);
      if (!q) return;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      const { action, value } = payload;
      if (action === 'pauseresume') q.togglePause();
      else if (action === 'skip') q.skip();
      else if (action === 'stop') q.destroy();
      else if (action === 'shuffle' && q.songs.length >= 3) q.shuffle();
      else if (action === 'loop') q.toggleLoop();
      else if (action === 'volume' && Number.isInteger(value)) {
        q.setVolume(Math.max(0, Math.min(200, value)) / 100);
      }
    });

    ws.on('close', () => {
      if (queue) queue.off('state', onState);
      queueEvents.off('queueCreated', onCreated);
      queueEvents.off('queueDestroyed', onDestroyed);
    });
  });

  httpServer.on('error', (error) => {
    console.error('[activity] Error del servidor HTTP:', error.message);
  });

  // Railway (y la mayoría de las plataformas cloud) inyectan PORT y esperan que el proceso escuche ahí.
  const port = process.env.PORT || process.env.ACTIVITY_PORT || 3000;
  httpServer.listen(port, () => {
    console.log(`[activity] Panel disponible en el puerto ${port}`);
  });

  return httpServer;
}

module.exports = { startActivityServer };
