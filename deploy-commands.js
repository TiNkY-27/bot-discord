require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('El bot se une a tu canal de voz actual'),
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción (nombre o link de YouTube)')
    .addStringOption((opt) =>
      opt.setName('busqueda').setDescription('Nombre o URL de la canción').setRequired(true),
    ),
  new SlashCommandBuilder().setName('skip').setDescription('Salta a la siguiente canción'),
  new SlashCommandBuilder().setName('pause').setDescription('Pausa la reproducción'),
  new SlashCommandBuilder().setName('resume').setDescription('Reanuda la reproducción'),
  new SlashCommandBuilder().setName('queue').setDescription('Muestra la cola de canciones'),
  new SlashCommandBuilder().setName('leave').setDescription('El bot se va del canal de voz'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Muestra qué se está reproduciendo ahora'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta el volumen (0-200)')
    .addIntegerOption((opt) =>
      opt.setName('nivel').setDescription('Porcentaje de volumen').setRequired(true).setMinValue(0).setMaxValue(200),
    ),
  new SlashCommandBuilder().setName('shuffle').setDescription('Mezcla el orden de la cola'),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Saca una canción de la cola')
    .addIntegerOption((opt) =>
      opt.setName('posicion').setDescription('Posición en la cola (ver /queue)').setRequired(true).setMinValue(1),
    ),
  new SlashCommandBuilder().setName('loop').setDescription('Activa/desactiva repetir la canción actual'),
  new SlashCommandBuilder().setName('clear').setDescription('Vacía la cola (sin salir del canal)'),
].map((c) => c.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  // El "Entry Point command" (type 4) lo crea Discord solo al activar Activities en el portal.
  // Un PUT masivo que no lo incluya lo borraría, y Discord no lo permite: hay que reincluirlo.
  const existing = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));
  const entryPointCommands = existing.filter((c) => c.type === 4);

  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [...commands, ...entryPointCommands] });
  console.log('Comandos globales registrados (pueden tardar hasta 1 hora en aparecer en servers nuevos).');

  // Además, los empuja como comandos de guild en cada server donde el bot ya está:
  // el registro por guild es instantáneo, así no hay que esperar la propagación global.
  const guilds = await rest.get(Routes.userGuilds());
  for (const guild of guilds) {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id), { body: commands });
    console.log(`Comandos instantáneos en "${guild.name}".`);
  }
})();
