function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
}

module.exports = {
  joinedChannel: (channelName) =>
    pick([
      `¡EPA! Llegó Walter Red, el enano pelirrojo más crack, a **${channelName}**! Buenas a todos 🎉🔥`,
      `¡AHÍ ESTÁ Walter Red! Me sumo a **${channelName}** y les mando un saludo grande a todos 🙌`,
      `¡Se picó la joda! Hola a todo **${channelName}**, llegó Walter Red para quedarse 🎶🔥`,
      `¡BUENAAAS a todos! Walter Red acaba de entrar a **${channelName}** y ya tiene ganas de prender esto 🎉`,
      `¡Wooo, qué onda **${channelName}**! Llegó el pelirrojo más crack, ¡vamos arriba! 🙌🎶`,
    ]),

  needVoiceChannel: () =>
    pick([
      'Che, primero metete en un canal de voz.',
      'Tenés que estar en un canal de voz para que te acompañe.',
      'Pará, andá a un canal de voz primero y volvé.',
      'No te encuentro en ningún canal de voz, entrá a uno primero.',
    ]),

  playlistError: () =>
    pick([
      'Uy, no pude leer esa playlist. ¿Probamos con otro link?',
      'Esa playlist me hizo drop, no pude abrirla.',
      'Algo salió mal con la playlist, fijate el link.',
    ]),

  playlistAdded: (count) =>
    pick([
      `Sumé **${count}** canciones de la playlist a la cola. ¡Vamos arriba! 🔥`,
      `Cargué **${count}** temas de esa playlist. Preparate.`,
      `Listo, **${count}** canciones más en la cola. Esto no para.`,
      `Metí **${count}** temazos a la cola de una.`,
    ]),

  songError: () =>
    pick([
      'No pude encontrar esa canción, che.',
      'Uy, no hubo caso con esa búsqueda.',
      'Esa no la encontré, probá con otro nombre o link.',
    ]),

  songAdded: (title) =>
    pick([
      `Sumé a la cola: **${title}**. ¡Gran elección!`,
      `Anotado: **${title}**. Ya casi le toca sonar.`,
      `**${title}** entra a la cola, buena esa.`,
      `Directo a la cola: **${title}**. Vamo' arriba.`,
    ]),

  nothingPlaying: () =>
    pick([
      'No hay nada sonando por acá.',
      'Silencio total, no estoy tocando nada.',
      'Nada en el aire ahora mismo.',
    ]),

  skipped: () =>
    pick(['⏭️ Dale, saltamos esa.', '⏭️ A otra cosa, mariposa.', '⏭️ Listo, siguiente tema.']),

  nothingPaused: () =>
    pick(['No hay nada pausado para reanudar.', 'Todo tranqui, no tengo nada pausado.']),

  paused: () =>
    pick(['⏸️ Pausado, avisame cuando seguimos.', '⏸️ Quedó pausado, tomate tu tiempo.', '⏸️ Freno acá, decime cuándo retomamos.']),

  resumed: () =>
    pick(['▶️ Dale, seguimos.', '▶️ De nuevo en marcha.', '▶️ Retomamos la joda.']),

  emptyQueue: () =>
    pick(['La cola está vacía, tirame algo para poner.', 'No hay nada en cola todavía.', 'Cola vacía, ¡pidamos algo!']),

  notInChannel: () =>
    pick(['No estoy en ningún canal ahora mismo.', 'Todavía no me uní a ningún canal.']),

  leftChannel: () =>
    pick([
      '👋 Uh, veo que no se bancan la joda de Walter Red. Nos vemos cuando aguanten más.',
      '👋 ¿Ya se cansaron? Flojos. Walter Red se abre, chau.',
      '👋 Está bien, no todos nacieron para la fiesta de este pelirrojo. Nos vemos.',
      '👋 Se ve que la joda les quedó grande. Walter Red se retira, campeones.',
      '👋 Ta bueno, ta bueno, ya entendí la indirecta. Chau, se las dejo picando.',
    ]),

  nowPlaying: (title) =>
    pick([
      `Sonando ahora: **${title}**. ¡Buen tema!`,
      `Esto es lo que suena: **${title}**.`,
      `En el aire: **${title}**. Disfrutalo.`,
    ]),

  volumeSet: (level) =>
    pick([
      `Volumen a **${level}%**, así como te gusta.`,
      `Ajustado a **${level}%**. ¿Se escucha bien?`,
      `Volumen en **${level}%**, dale para adelante.`,
    ]),

  notEnoughToShuffle: () =>
    pick(['Necesito al menos un par de canciones más para mezclar.', 'Con tan pocas canciones no hay mucho que mezclar.']),

  shuffled: () =>
    pick(['🔀 Listo, mezclé todo.', '🔀 Cola remezclada, a ver qué sale.', '🔀 Ahí va el orden nuevo.']),

  invalidPosition: () =>
    pick(['No hay ninguna canción en esa posición.', 'Ese número no existe en la cola, fijate con /queue.']),

  removed: (title) =>
    pick([
      `Saqué de la cola: **${title}**.`,
      `Listo, **${title}** ya no está en la cola.`,
      `Chau **${title}**, te bajé de la cola.`,
    ]),

  loopOn: () =>
    pick(['🔁 Repetir activado, esta se queda un rato.', '🔁 Dale que se repite esta canción.']),

  loopOff: () =>
    pick(['Repetir desactivado, seguimos con la cola normal.', 'Listo, ya no repito más esta.']),

  cleared: () =>
    pick(['Vacié la cola, pero la canción actual sigue sonando.', 'Cola limpia. Lo que suena ahora se queda.']),

  nowPlayingPanel: () =>
    pick(['🎶 Esto es lo que está sonando ahora.', '🎶 Dale que suena esto.', '🎶 En el aire ahora mismo.']),
};
