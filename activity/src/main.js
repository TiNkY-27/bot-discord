import { DiscordSDK } from '@discord/embedded-app-sdk';

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const app = document.getElementById('app');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setStatus(text) {
  app.innerHTML = `<p id="status">${text}</p>`;
}

let ws;
function send(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function render(state) {
  if (!state || !state.song) {
    app.innerHTML = `
      <div class="panel idle">
        <h1>Walter Red</h1>
        <p>No hay nada sonando ahora. Pedí algo con /play en el chat.</p>
      </div>
    `;
    return;
  }

  const { song, paused, volume, loop, upcomingCount } = state;

  app.innerHTML = `
    <div class="panel">
      ${song.thumbnail ? `<img class="thumb" src="${song.thumbnail}" alt="" />` : ''}
      <h1>${escapeHtml(song.title)}</h1>
      ${song.duration ? `<p class="duration">⏱️ ${song.duration}</p>` : ''}
      <div class="controls">
        <button id="btn-pauseresume">${paused ? '▶️' : '⏸️'}</button>
        <button id="btn-skip">⏭️</button>
        <button id="btn-stop">⏹️</button>
        <button id="btn-shuffle">🔀</button>
        <button id="btn-loop" class="${loop ? 'active' : ''}">🔁</button>
      </div>
      <div class="volume">
        <label for="volume-slider">🔊 ${volume}%</label>
        <input id="volume-slider" type="range" min="0" max="200" value="${volume}" />
      </div>
      <p class="footer">${loop ? '🔁 Repitiendo · ' : ''}${upcomingCount} canción(es) en cola</p>
    </div>
  `;

  document.getElementById('btn-pauseresume').onclick = () => send({ action: 'pauseresume' });
  document.getElementById('btn-skip').onclick = () => send({ action: 'skip' });
  document.getElementById('btn-stop').onclick = () => send({ action: 'stop' });
  document.getElementById('btn-shuffle').onclick = () => send({ action: 'shuffle' });
  document.getElementById('btn-loop').onclick = () => send({ action: 'loop' });
  document.getElementById('volume-slider').onchange = (e) =>
    send({ action: 'volume', value: Number(e.target.value) });
}

function connectWebSocket(guildId) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/.proxy/ws?guildId=${guildId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'state') render(data);
  };

  ws.onclose = () => {
    setStatus('Se cortó la conexión, reintentando...');
    setTimeout(() => connectWebSocket(guildId), 2000);
  };

  ws.onerror = () => ws.close();
}

async function main() {
  try {
    setStatus('Conectando con Discord...');
    const discordSdk = new DiscordSDK(CLIENT_ID);
    await discordSdk.ready();

    const { code } = await discordSdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify'],
    });

    const tokenResponse = await fetch('/.proxy/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!tokenResponse.ok) throw new Error('No se pudo obtener el token');
    const { access_token } = await tokenResponse.json();

    await discordSdk.commands.authenticate({ access_token });

    connectWebSocket(discordSdk.guildId);
  } catch (error) {
    console.error('[activity] Error inicializando:', error);
    setStatus('No se pudo conectar con Discord. Esta pantalla solo funciona abierta desde dentro de Discord.');
  }
}

main();
