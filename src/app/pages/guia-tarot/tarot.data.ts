export type Elemento = 'fuego' | 'agua' | 'aire' | 'tierra';

export interface ElementoInfo {
  id: Elemento;
  nombre: string;
  /** De qué parte de la vida hablan las cartas de este elemento. */
  ambito: string;
  claves: string[];
  descripcion: string;
}

/** Un elemento de la ilustración y el símbolo del tarot original que reinterpreta. */
export interface Simbolo {
  nombre: string;
  /** El símbolo equivalente en el tarot Rider-Waite. */
  original: string;
  significado: string;
}

export interface Arcano {
  numero: number;
  romano: string;
  nombre: string;
  slug: string;
  claves: string[];
  /** Elemento que rige la carta según su correspondencia astrológica. */
  elemento: Elemento;
  astro: string;
  general: string;
  /** Cómo se expresa la carta a través de su elemento regente. */
  lectura: string;
  simbologia: Simbolo[];
  /** Dos colores sacados de la ilustración para teñir sus degradados. */
  tono: [string, string];
}

export const ELEMENTOS: ElementoInfo[] = [
  {
    id: 'fuego',
    nombre: 'Fuego',
    ambito: 'Acción y deseo',
    claves: ['Pasión', 'Voluntad', 'Creatividad', 'Impulso'],
    descripcion:
      'Las cartas de fuego hablan de lo que te mueve: proyectos que arrancan, ganas, energía y valentía para dar el primer paso.',
  },
  {
    id: 'agua',
    nombre: 'Agua',
    ambito: 'Emociones y vínculos',
    claves: ['Amor', 'Intuición', 'Sensibilidad', 'Relaciones'],
    descripcion:
      'Las cartas de agua hablan de lo que sientes: pareja, familia, amistades y todo lo que se mueve por dentro sin hacer ruido.',
  },
  {
    id: 'aire',
    nombre: 'Aire',
    ambito: 'Mente y palabra',
    claves: ['Ideas', 'Decisiones', 'Comunicación', 'Estudio'],
    descripcion:
      'Las cartas de aire hablan de lo que piensas: conversaciones pendientes, dudas, estudios y las decisiones que tienes sobre la mesa.',
  },
  {
    id: 'tierra',
    nombre: 'Tierra',
    ambito: 'Cuerpo y materia',
    claves: ['Trabajo', 'Dinero', 'Salud', 'Hogar'],
    descripcion:
      'Las cartas de tierra hablan de lo concreto: el trabajo, el dinero, el cuerpo, la casa y lo que se construye con constancia.',
  },
];

export const ARCANOS: Arcano[] = [
  {
    numero: 0,
    romano: '0',
    nombre: 'El Loco',
    slug: 'el-loco',
    claves: ['Comienzos', 'Espontaneidad', 'Fe', 'Libertad'],
    elemento: 'aire',
    astro: 'Urano',
    general:
      'El Loco es el primer paso de todo viaje. Habla de empezar sin tenerlo todo resuelto, de confiar en el camino y de mirar el mundo con ojos nuevos. Invita a soltar el miedo al ridículo y a moverte con ligereza: llevas solo lo que cabe en el corazón. Si sale invertida o rodeada de cartas difíciles, recuerda que la libertad también necesita un poco de atención al borde del camino.',
    lectura: 'El aire es el elemento del Loco: la mente libre, sin planes rígidos, que se deja llevar por la curiosidad. Pide abrirte a posibilidades nuevas y no dejar que el exceso de análisis te frene antes del primer paso.',
    simbologia: [
      {
        nombre: 'El sol enorme',
        original: 'El sol amarillo a su espalda',
        significado: 'La conciencia despierta y la energía vital. El viaje empieza con buena luz: hay entusiasmo y protección para arrancar.',
      },
      {
        nombre: 'La cala blanca',
        original: 'La rosa blanca en su mano',
        significado: 'Pureza e inocencia. Representa deseos limpios, sin miedo ni cálculo; el Loco camina sin malicia.',
      },
      {
        nombre: 'El bolso con corazón',
        original: 'El hatillo al hombro',
        significado: 'El equipaje mínimo: lo que traes del pasado. Aquí lo que se lleva es el corazón, las experiencias y el cariño, no las posesiones.',
      },
      {
        nombre: 'El barranquero',
        original: 'El perro que lo acompaña',
        significado: 'El instinto leal que acompaña y advierte. El ave colombiana hace de guardián: escucha a tu intuición cuando te avise del borde.',
      },
      {
        nombre: 'El borde de la colina',
        original: 'El precipicio',
        significado: 'El salto de fe hacia lo desconocido. No se sabe qué hay más allá, y aun así se avanza.',
      },
    ],
    tono: ['#7FB6E6', '#F7A74A'],
  },
  {
    numero: 1,
    romano: 'I',
    nombre: 'El Mago',
    slug: 'el-mago',
    claves: ['Poder personal', 'Habilidad', 'Manifestación', 'Enfoque'],
    elemento: 'aire',
    astro: 'Mercurio',
    general:
      'El Mago te recuerda que ya tienes las herramientas. Es la carta de la intención convertida en acción: cuando cuerpo, mente y deseo apuntan al mismo lugar, las cosas suceden. Habla de talento, iniciativa y de saber usar lo que está a tu alcance. Su sombra es el truco: prometer más de lo que se hace o usar el encanto para manipular.',
    lectura: 'Mercurio, el mensajero de los dioses, le da al Mago el aire: la palabra, la inteligencia y la habilidad para comunicar. Su poder está en nombrar lo que quiere; lo que dices ahora tiene fuerza para hacerse real.',
    simbologia: [
      {
        nombre: 'El infinito en la copa',
        original: 'La lemniscata sobre su cabeza',
        significado: 'Potencial ilimitado y energía que no se agota. Aquí el infinito arde dentro de la copa: el poder está en lo que sostienes.',
      },
      {
        nombre: 'La copa con fuego',
        original: 'Las cuatro herramientas sobre la mesa',
        significado: 'En el original el Mago tiene copa, basto, espada y oro: los cuatro elementos. Aquí se funden en una copa que contiene una llama, agua y fuego juntos: dominio de todos los recursos.',
      },
      {
        nombre: 'El rostro en las nubes y las manos',
        original: 'Una mano hacia el cielo y otra hacia la tierra',
        significado: '«Como es arriba, es abajo». El Mago es un canal entre la idea (el cielo) y la materia (las manos que actúan).',
      },
      {
        nombre: 'Las enredaderas con espinas y flores',
        original: 'La guirnalda de rosas y lirios',
        significado: 'El deseo y la pureza entrelazados. La pasión florece, pero tiene espinas: manifestar exige cuidado.',
      },
      {
        nombre: 'El campo de flores fucsia',
        original: 'El jardín de rosas rojas',
        significado: 'El fruto del deseo cultivado. Lo que el Mago imagina termina floreciendo en el mundo.',
      },
    ],
    tono: ['#E0457B', '#1A1740'],
  },
  {
    numero: 2,
    romano: 'II',
    nombre: 'La Sacerdotisa',
    slug: 'la-sacerdotisa',
    claves: ['Intuición', 'Misterio', 'Silencio', 'Sabiduría interior'],
    elemento: 'agua',
    astro: 'Luna',
    general:
      'La Sacerdotisa guarda lo que todavía no se dice. Es la voz de la intuición, el conocimiento que llega en silencio y la paciencia de quien sabe esperar. No es momento de forzar respuestas, sino de escuchar sueños, señales y corazonadas. Cuando aparece, algo está oculto o aún madurando: confía en lo que sabes aunque no puedas explicarlo.',
    lectura: 'Regida por la Luna, la Sacerdotisa es agua quieta y profunda: emociones que no se muestran, intuición y memoria. Pide leer lo que sientes antes que lo que piensas; la respuesta está bajo la superficie.',
    simbologia: [
      {
        nombre: 'La triple luna en la frente',
        original: 'La corona de la triple luna',
        significado: 'Luna creciente, llena y menguante: los ciclos, lo femenino y la intuición que se renueva.',
      },
      {
        nombre: 'Las granadas abiertas',
        original: 'El velo bordado con granadas',
        significado: 'Fertilidad y misterio, como el mito de Perséfone. La granada guarda muchas semillas: un conocimiento que no se ve a simple vista.',
      },
      {
        nombre: 'El pergamino guardado',
        original: 'La Torá medio oculta en su regazo',
        significado: 'Una sabiduría que no se revela completa. Hay cosas que solo se entienden a su tiempo.',
      },
      {
        nombre: 'El cabello de agua',
        original: 'El manto azul que fluye como agua',
        significado: 'El subconsciente y las emociones profundas. En el original el manto se vuelve río; aquí es su propio cabello: la intuición nace de ella.',
      },
      {
        nombre: 'Las heliconias a cada lado',
        original: 'Las columnas Boaz y Jaquín',
        significado: 'La dualidad (luz y sombra, sabido y oculto). Ella se sienta en medio, en el umbral entre los dos mundos.',
      },
    ],
    tono: ['#3A5BC7', '#14122A'],
  },
  {
    numero: 3,
    romano: 'III',
    nombre: 'La Emperatriz',
    slug: 'la-emperatriz',
    claves: ['Abundancia', 'Fertilidad', 'Creatividad', 'Cuidado'],
    elemento: 'tierra',
    astro: 'Venus',
    general:
      'La Emperatriz es la tierra que florece. Representa la abundancia, el placer de los sentidos, la creatividad que da frutos y el cuidado que nutre. Habla de embarazos reales o simbólicos: proyectos, relaciones o ideas que crecen si se les da tiempo y cariño. Te invita a disfrutar, a cuidarte y a recibir sin culpa.',
    lectura: 'Venus en la tierra: placer, cuerpo, belleza y abundancia material. La Emperatriz es tierra fértil; pide cuidar lo que crece, disfrutar con los sentidos y confiar en que lo sembrado dará fruto a su tiempo.',
    simbologia: [
      {
        nombre: 'La cabellera de selva',
        original: 'El bosque y la cascada',
        significado: 'La naturaleza viva y el fluir de la vida. Su cuerpo y el paisaje son lo mismo: ella es la tierra que nutre.',
      },
      {
        nombre: 'Las orquídeas',
        original: 'El vestido estampado con granadas',
        significado: 'Belleza, sensualidad y fertilidad. La flor nacional de Colombia ocupa el lugar de la granada como símbolo de lo que florece.',
      },
      {
        nombre: 'Las palmas de cera',
        original: 'El campo de trigo maduro',
        significado: 'La abundancia y la cosecha. El árbol nacional crece alto y lento: prosperidad que se construye con tiempo.',
      },
      {
        nombre: 'El objeto dorado en sus manos',
        original: 'El cetro con el orbe',
        significado: 'Su poder sobre el mundo material: gobierna la vida cuidándola, no dominándola.',
      },
    ],
    tono: ['#2E9E7A', '#E86A8C'],
  },
  {
    numero: 4,
    romano: 'IV',
    nombre: 'El Emperador',
    slug: 'el-emperador',
    claves: ['Estructura', 'Autoridad', 'Estabilidad', 'Liderazgo'],
    elemento: 'fuego',
    astro: 'Aries',
    general:
      'El Emperador pone orden. Es la carta de la estructura, los límites claros y la responsabilidad de sostener lo que se ha construido. Habla de liderazgo, de reglas que protegen y de tomar el mando de tu propia vida. Su lado difícil es la rigidez: control excesivo, terquedad o figuras de autoridad que no escuchan.',
    lectura: 'Aries, el primer signo de fuego, le da al Emperador iniciativa, voluntad y mando. Es un fuego que construye: la energía de quien toma decisiones y las sostiene. Cuida que no se vuelva imposición.',
    simbologia: [
      {
        nombre: 'El anj encendido',
        original: 'El cetro en forma de anj',
        significado: 'El símbolo egipcio de la vida. Su autoridad existe para proteger la vida, y aquí además brilla: liderazgo que irradia.',
      },
      {
        nombre: 'La corona',
        original: 'La corona y el orbe',
        significado: 'Poder, gobierno y responsabilidad sobre lo que se ha construido.',
      },
      {
        nombre: 'Las manos que la alzan',
        original: 'El trono de piedra con cabezas de carnero',
        significado: 'La estructura que sostiene el poder. En el original el trono es de piedra y lleva el carnero de Aries; aquí son manos: el poder se asume y se carga.',
      },
      {
        nombre: 'Las montañas',
        original: 'Las montañas áridas del fondo',
        significado: 'Firmeza, estabilidad y determinación que no se mueve con el viento.',
      },
      {
        nombre: 'El río en el valle',
        original: 'El pequeño río tras el trono',
        significado: 'La emoción que sigue fluyendo bajo la estructura. Hasta el líder más firme necesita sentir.',
      },
    ],
    tono: ['#E0457B', '#2F6B4F'],
  },
  {
    numero: 5,
    romano: 'V',
    nombre: 'El Sumo Sacerdote',
    slug: 'el-sumo-sacerdote',
    claves: ['Tradición', 'Enseñanza', 'Guía', 'Creencias'],
    elemento: 'tierra',
    astro: 'Tauro',
    general:
      'El Sumo Sacerdote es el maestro y la tradición. Como el frailejón que guarda el agua del páramo, representa el saber que se transmite con paciencia: escuelas, mentores, rituales y valores compartidos. Te invita a buscar guía o a ser guía para otros. Su sombra aparece cuando las normas se siguen sin cuestionarlas.',
    lectura: 'Tauro, signo de tierra, hace del Sumo Sacerdote un maestro paciente y práctico: el saber se aprende repitiendo, con constancia y en comunidad. Pide apoyarte en lo probado y en quienes ya recorrieron el camino.',
    simbologia: [
      {
        nombre: 'El frailejón',
        original: 'El Hierofante en su trono con la triple corona',
        significado: 'El guardián del saber. El frailejón crece apenas un centímetro al año y guarda el agua del páramo: sabiduría antigua, lenta y generosa.',
      },
      {
        nombre: 'Las dos siluetas',
        original: 'Los dos acólitos arrodillados',
        significado: 'Los discípulos que reciben la enseñanza. El conocimiento se transmite de persona a persona.',
      },
      {
        nombre: 'Las luciérnagas',
        original: 'Las llaves cruzadas',
        significado: 'Las llaves abren el conocimiento de lo visible y lo invisible. Las luciérnagas son esas pequeñas luces que se reparten en la oscuridad.',
      },
      {
        nombre: 'La noche del páramo',
        original: 'El templo y sus columnas',
        significado: 'El espacio sagrado donde ocurre el ritual. Aquí el templo es la naturaleza misma.',
      },
    ],
    tono: ['#2A2470', '#F2A25C'],
  },
  {
    numero: 6,
    romano: 'VI',
    nombre: 'Los Enamorados',
    slug: 'los-enamorados',
    claves: ['Amor', 'Elección', 'Unión', 'Valores'],
    elemento: 'aire',
    astro: 'Géminis',
    general:
      'Los Enamorados hablan del amor, pero sobre todo de elegir. Es la carta de la unión entre dos partes que se reconocen, y también de las decisiones que definen quién eres. Pide coherencia entre lo que sientes y lo que haces. Si aparece con dudas, pregúntate qué opción está alineada con tus valores, no solo con tu deseo del momento.',
    lectura: 'Géminis, los gemelos, les da a los Enamorados el aire: dos partes que dialogan. Más que un impulso, esta carta es una elección consciente; pide conversar, comparar y decidir lo que de verdad valoras.',
    simbologia: [
      {
        nombre: 'Las dos guacamayas',
        original: 'Adán y Eva',
        significado: 'La unión de dos seres que se reconocen. Las guacamayas forman pareja para toda la vida: lealtad y compromiso.',
      },
      {
        nombre: 'El rojo y el azul',
        original: 'El hombre (consciencia) y la mujer (subconsciente)',
        significado: 'Cada ave lleva un color opuesto y complementario. El amor une polos distintos sin borrarlos.',
      },
      {
        nombre: 'La rama florecida',
        original: 'El árbol de la vida y el árbol del conocimiento',
        significado: 'La elección entre el deseo y la conciencia. Aquí ambos comparten una sola rama: amar también es elegir.',
      },
      {
        nombre: 'Las nubes del cielo',
        original: 'El ángel Rafael sobre las nubes',
        significado: 'La bendición y la guía superior. Rafael es el ángel sanador: el amor verdadero sana.',
      },
    ],
    tono: ['#D93B3B', '#7FC4F0'],
  },
  {
    numero: 7,
    romano: 'VII',
    nombre: 'El Carro',
    slug: 'el-carro',
    claves: ['Avance', 'Determinación', 'Victoria', 'Dirección'],
    elemento: 'agua',
    astro: 'Cáncer',
    general:
      'El Carro es movimiento con rumbo. Habla de avanzar a pesar de las corrientes, de dominar fuerzas opuestas y de llegar a la meta gracias a la voluntad. En esta baraja la travesía es por el río: el triunfo no viene de pelear con el agua sino de saber conducirla. Anuncia viajes, logros y la confianza de quien sabe hacia dónde va.',
    lectura: 'Cáncer, signo de agua con caparazón, explica por qué el Carro protege y avanza a la vez. Su victoria es emocional: conducir lo que sientes sin dejar que te hunda, como la barca que navega el río en lugar de pelear con él.',
    simbologia: [
      {
        nombre: 'La barca dorada',
        original: 'El carro',
        significado: 'El vehículo de la voluntad. Aquí el triunfo no va por tierra sino por agua: avanzar a través de las emociones.',
      },
      {
        nombre: 'El delfín rosado',
        original: 'Las esfinges blanca y negra',
        significado: 'Las fuerzas opuestas que el auriga guía sin riendas. El bufeo del Amazonas es el instinto convertido en aliado que marca el rumbo.',
      },
      {
        nombre: 'El cielo estrellado',
        original: 'El dosel de estrellas del carro',
        significado: 'La protección celestial y el destino que acompaña a quien avanza con propósito.',
      },
      {
        nombre: 'La mano extendida',
        original: 'El auriga sin riendas',
        significado: 'Dirigir con la voluntad y la mente, no con la fuerza. Un gesto basta cuando sabes a dónde vas.',
      },
      {
        nombre: 'El río',
        original: 'El río detrás del carro',
        significado: 'El flujo de la vida y de las emociones que hay que atravesar para llegar a la meta.',
      },
    ],
    tono: ['#2F55B5', '#2D8A5A'],
  },
  {
    numero: 8,
    romano: 'VIII',
    nombre: 'La Fuerza',
    slug: 'la-fuerza',
    claves: ['Coraje', 'Compasión', 'Dominio propio', 'Paciencia'],
    elemento: 'fuego',
    astro: 'Leo',
    general:
      'La Fuerza no se impone: abraza. Como la mujer que calma al jaguar, habla de domar los instintos con ternura, de la valentía que nace de la calma y de la paciencia como forma de poder. Te recuerda que eres más fuerte de lo que crees, sobre todo cuando no necesitas demostrarlo. Invita a tratarte con compasión en medio de los retos.',
    lectura: 'Leo, fuego del corazón, le da a la Fuerza su coraje. Pero es un fuego que abraza en lugar de quemar: pasión canalizada, orgullo sano y valentía serena.',
    simbologia: [
      {
        nombre: 'El jaguar',
        original: 'El león',
        significado: 'El instinto, la pasión y la fuerza salvaje. El felino de nuestras selvas ocupa el lugar del león de Leo.',
      },
      {
        nombre: 'El abrazo',
        original: 'La mujer que cierra con suavidad las fauces del león',
        significado: 'Dominar el instinto con ternura y no con violencia. La verdadera fuerza es la compasión.',
      },
      {
        nombre: 'El infinito en el pecho',
        original: 'La lemniscata sobre su cabeza',
        significado: 'Energía y paciencia inagotables. Aquí el infinito vive en el corazón: la fuerza nace del amor.',
      },
      {
        nombre: 'La corona de flores',
        original: 'El cinturón y la corona de flores',
        significado: 'La gentileza y la naturaleza domada con amor, no con cadenas.',
      },
      {
        nombre: 'La selva',
        original: 'El paisaje verde y fértil',
        significado: 'La vitalidad y la vida salvaje que no se reprime, sino que se integra.',
      },
    ],
    tono: ['#F2A03A', '#1F6B45'],
  },
  {
    numero: 9,
    romano: 'IX',
    nombre: 'El Ermitaño',
    slug: 'el-ermitano',
    claves: ['Introspección', 'Búsqueda', 'Soledad', 'Guía interior'],
    elemento: 'tierra',
    astro: 'Virgo',
    general:
      'El Ermitaño se aparta para ver con claridad. Es la carta de la pausa, la reflexión y la búsqueda de sentido. Su farol no ilumina todo el camino, solo el siguiente paso, y eso es suficiente. Habla de tomarte un tiempo para ti, de escuchar tu voz interior y, a veces, de convertirte en la luz que guía a otros.',
    lectura: 'Virgo, tierra meticulosa, hace del Ermitaño alguien que busca la verdad en los detalles y en la práctica diaria. Su sabiduría no es abstracta: se trabaja en silencio, con orden, cuidando el cuerpo y el tiempo.',
    simbologia: [
      {
        nombre: 'El farol',
        original: 'La linterna con la estrella de seis puntas',
        significado: 'La sabiduría interior que ilumina solo el siguiente paso. Dentro del farol brilla una estrella: la guía está dentro de ti.',
      },
      {
        nombre: 'El copetón',
        original: 'El anciano ermitaño',
        significado: 'Un ave pequeña y común que observa en silencio. La sabiduría no es grandiosa: es humilde y atenta.',
      },
      {
        nombre: 'La rama',
        original: 'El bastón',
        significado: 'El apoyo en el camino: paciencia, experiencia y un punto firme donde detenerse a pensar.',
      },
      {
        nombre: 'Las nubes y la altura',
        original: 'La cima nevada',
        significado: 'La soledad elegida y la perspectiva que da apartarse del ruido.',
      },
    ],
    tono: ['#E98A6A', '#6FB7E0'],
  },
  {
    numero: 10,
    romano: 'X',
    nombre: 'La Rueda de la Fortuna',
    slug: 'la-rueda-de-la-fortuna',
    claves: ['Ciclos', 'Cambio', 'Destino', 'Oportunidad'],
    elemento: 'fuego',
    astro: 'Júpiter',
    general:
      'La Rueda gira y nada se queda igual. Es la carta de los ciclos: lo que sube baja, lo que termina vuelve a empezar. Anuncia cambios inesperados, golpes de suerte y giros del destino que no dependen solo de ti. Te invita a fluir con el movimiento, a aprovechar las oportunidades cuando aparecen y a no aferrarte a lo que ya cumplió su vuelta.',
    lectura: 'Júpiter, planeta de la expansión y la suerte, le da a la Rueda su fuego: el movimiento que no se detiene. Pide actuar cuando la oportunidad aparece, porque el fuego no espera a que todo esté quieto.',
    simbologia: [
      {
        nombre: 'La serpiente que se muerde la cola',
        original: 'La rueda y la serpiente Tifón',
        significado: 'El uróboros es el ciclo eterno: todo lo que termina vuelve a empezar. En el original la serpiente desciende por la rueda; aquí es la rueda misma.',
      },
      {
        nombre: 'La rosa de los vientos',
        original: 'El centro de la rueda con letras y símbolos alquímicos',
        significado: 'El centro inmóvil y todas las direcciones posibles. Mientras todo gira, el centro permanece.',
      },
      {
        nombre: 'Las nubes con lluvia',
        original: 'Las nubes de las esquinas',
        significado: 'Lo que llega desde arriba y no controlamos: el destino, la suerte, los cambios de clima de la vida.',
      },
      {
        nombre: 'Las velas y las hortensias',
        original: 'Los cuatro seres alados que leen',
        significado: 'Lo que permanece estable mientras la rueda gira. Las hortensias cambian de color según su tierra: nos adaptamos sin dejar de ser.',
      },
    ],
    tono: ['#2A2470', '#F2A03A'],
  },
  {
    numero: 11,
    romano: 'XI',
    nombre: 'La Justicia',
    slug: 'la-justicia',
    claves: ['Equilibrio', 'Verdad', 'Causa y efecto', 'Responsabilidad'],
    elemento: 'aire',
    astro: 'Libra',
    general:
      'La Justicia pesa y decide. Habla de verdad, de equilibrio y de las consecuencias de nuestros actos: cosechas lo que sembraste. Pide honestidad contigo y con otros, y tomar decisiones con la cabeza fría. Puede anunciar asuntos legales, acuerdos o la resolución justa de algo que estaba pendiente.',
    lectura: 'Libra, aire que equilibra, le da a la Justicia su mente objetiva: pesar argumentos, escuchar las dos partes y decidir con la razón por encima de la emoción.',
    simbologia: [
      {
        nombre: 'La espada',
        original: 'La espada de doble filo',
        significado: 'La verdad y la decisión que corta con claridad. Toda acción tiene consecuencias en ambos sentidos.',
      },
      {
        nombre: 'La balanza',
        original: 'La balanza',
        significado: 'El equilibrio, sopesar cada lado antes de juzgar.',
      },
      {
        nombre: 'La venda en los ojos',
        original: 'La Iustitia romana (la del Rider-Waite mira de frente)',
        significado: 'La imparcialidad: juzgar sin dejarse llevar por apariencias ni favoritismos.',
      },
      {
        nombre: 'La corona con estrella',
        original: 'La corona con el cuadrado',
        significado: 'El orden y la claridad mental. Aquí una estrella guía el pensamiento justo.',
      },
      {
        nombre: 'La cabellera roja y el manto verde',
        original: 'El manto rojo sobre la túnica verde',
        significado: 'La acción (rojo) unida a la compasión (verde): la justicia firme pero humana.',
      },
    ],
    tono: ['#E8573A', '#2F7D55'],
  },
  {
    numero: 12,
    romano: 'XII',
    nombre: 'El Colgado',
    slug: 'el-colgado',
    claves: ['Pausa', 'Rendición', 'Nueva perspectiva', 'Transformación'],
    elemento: 'agua',
    astro: 'Neptuno',
    general:
      'El Colgado es la espera que transforma. Como la crisálida, parece que nada pasa, pero por dentro todo está cambiando. Habla de pausas necesarias, de soltar el control y de mirar la situación desde otro ángulo. Lo que hoy se siente como estancamiento es, en realidad, preparación para una versión nueva de ti.',
    lectura: 'Neptuno, planeta de los mares y la entrega, hace del Colgado una carta de agua: rendirse a la corriente, confiar y dejar que la transformación ocurra por dentro, como en la crisálida.',
    simbologia: [
      {
        nombre: 'La crisálida',
        original: 'El hombre colgado de cabeza',
        significado: 'La suspensión voluntaria. Desde afuera parece quietud; por dentro todo se está transformando.',
      },
      {
        nombre: 'La rama viva',
        original: 'El árbol en forma de T, de madera viva',
        significado: 'El sostén que da vida aunque parezca un castigo. La pausa también alimenta.',
      },
      {
        nombre: 'La mariposa que nace',
        original: 'El halo alrededor de su cabeza',
        significado: 'La iluminación que llega después de la espera: una nueva versión de ti.',
      },
      {
        nombre: 'Los rayos de luz',
        original: 'La expresión serena del colgado',
        significado: 'La paz de quien aceptó la pausa. No hay sufrimiento, hay comprensión.',
      },
    ],
    tono: ['#F07A8A', '#5BB8D8'],
  },
  {
    numero: 13,
    romano: 'XIII',
    nombre: 'La Muerte',
    slug: 'la-muerte',
    claves: ['Final', 'Transformación', 'Renovación', 'Desapego'],
    elemento: 'agua',
    astro: 'Escorpio',
    general:
      'La Muerte casi nunca habla de morir: habla de cerrar. Es el final de una etapa para que otra pueda nacer. Como el gallinazo que limpia la tierra, esta carta recicla lo que ya no sirve y deja espacio para lo nuevo; mira el sol que sale detrás. Pide soltar sin resistirte, porque aferrarse a lo que terminó duele más que dejarlo ir.',
    lectura: 'Escorpio, agua profunda, rige a la Muerte: emociones intensas, duelo y regeneración. Es el agua que disuelve lo viejo para que algo nuevo pueda nacer; pide sentir el final sin huir de él.',
    simbologia: [
      {
        nombre: 'El gallinazo',
        original: 'El esqueleto con armadura sobre el caballo blanco',
        significado: 'La muerte como limpieza. El gallinazo recicla lo muerto para que la tierra siga viva: nada se pierde, todo se transforma.',
      },
      {
        nombre: 'La calavera',
        original: 'El rey caído a sus pies',
        significado: 'Nadie escapa a los finales, ni el más poderoso. El ego y las formas viejas caen.',
      },
      {
        nombre: 'El sol naciente',
        original: 'El sol que sale entre dos torres',
        significado: 'El renacer. Detrás de todo final hay un amanecer.',
      },
      {
        nombre: 'Los brotes verdes',
        original: 'La rosa blanca en su estandarte',
        significado: 'La vida que vuelve y la pureza de lo nuevo. Incluso en la tierra seca algo empieza a crecer.',
      },
      {
        nombre: 'La tierra agrietada',
        original: 'El campo con los caídos',
        significado: 'Lo que se secó y ya cumplió su ciclo. Hay que dejarlo ir.',
      },
    ],
    tono: ['#5B3A55', '#F2A25C'],
  },
  {
    numero: 14,
    romano: 'XIV',
    nombre: 'La Templanza',
    slug: 'la-templanza',
    claves: ['Equilibrio', 'Moderación', 'Sanación', 'Armonía'],
    elemento: 'fuego',
    astro: 'Sagitario',
    general:
      'La Templanza mezcla con paciencia. Como el agua que pasa de una vasija a otra sin derramarse, habla de encontrar el punto medio, de sanar y de integrar opuestos. Es la carta de la calma después de la tormenta, del ritmo propio y de la alquimia lenta que convierte la experiencia en sabiduría.',
    lectura: 'Sagitario, fuego que busca sentido, le da a la Templanza su propósito: no es una calma pasiva, sino fuego bien dosificado, la llama constante que cocina lento y transforma.',
    simbologia: [
      {
        nombre: 'El agua que pasa entre vasijas',
        original: 'El ángel que vierte agua entre dos copas',
        significado: 'La mezcla y la alquimia: unir opuestos con paciencia hasta lograr el punto justo.',
      },
      {
        nombre: 'Las vasijas de barro',
        original: 'Las copas doradas',
        significado: 'Lo humano y lo artesanal. Aquí la sanación es hecha a mano, como la cerámica de nuestros pueblos.',
      },
      {
        nombre: 'Las dos manos (una del cielo, otra de la tierra)',
        original: 'Un pie en el agua y otro en la tierra',
        significado: 'El equilibrio entre dos mundos: lo espiritual y lo material, lo que sientes y lo que haces.',
      },
      {
        nombre: 'El sol entre montañas',
        original: 'El camino hacia la corona entre las montañas',
        significado: 'La meta que se alcanza con paciencia y moderación, no con prisa.',
      },
      {
        nombre: 'Los pensamientos (flores)',
        original: 'Los lirios',
        significado: 'Iris era la mensajera de los dioses. Aquí los pensamientos invitan a reflexionar antes de actuar.',
      },
    ],
    tono: ['#F2B24A', '#6FC0E8'],
  },
  {
    numero: 15,
    romano: 'XV',
    nombre: 'El Diablo',
    slug: 'el-diablo',
    claves: ['Apegos', 'Tentación', 'Sombra', 'Deseo'],
    elemento: 'tierra',
    astro: 'Capricornio',
    general:
      'El Diablo muestra lo que nos ata. Habla de apegos, excesos, hábitos que nos dominan y deseos que se vuelven cadenas. Como el hipopótamo fuera de su lugar, retrata aquello que creció sin control y ahora cuesta sacar. No es una condena: al verlo con claridad empiezas a liberarte. También habla del placer y de la sombra que conviene conocer en lugar de negar.',
    lectura: 'Capricornio, tierra ambiciosa, muestra el lado material del Diablo: dinero, cuerpo, poder y placer. La tierra da estabilidad, pero en exceso se vuelve peso. Pregúntate qué posesión o hábito te está poseyendo a ti.',
    simbologia: [
      {
        nombre: 'El hipopótamo',
        original: 'Baphomet, la figura con cuernos',
        significado: 'Una fuerza que creció fuera de su lugar y ahora domina el paisaje. Así son los apegos: llegan de a poco y se multiplican sin control.',
      },
      {
        nombre: 'Las aguas grises',
        original: 'El fondo negro',
        significado: 'El estancamiento y la sombra: el lugar donde nos quedamos por costumbre.',
      },
      {
        nombre: 'Las calaveras',
        original: 'La pareja encadenada',
        significado: 'Las consecuencias de los excesos. En el original las cadenas están flojas: siempre es posible soltarse.',
      },
      {
        nombre: 'Las flores naranjas',
        original: 'La antorcha invertida y las colas de fuego y uva',
        significado: 'La tentación y el placer que atrapan. Son bellas, pero crecen en aguas estancadas.',
      },
    ],
    tono: ['#6E6A66', '#F0602E'],
  },
  {
    numero: 16,
    romano: 'XVI',
    nombre: 'La Torre',
    slug: 'la-torre',
    claves: ['Ruptura', 'Revelación', 'Caos', 'Liberación'],
    elemento: 'fuego',
    astro: 'Marte',
    general:
      'La Torre derriba lo que estaba mal construido. Es un cambio repentino, una verdad que sale a la luz o un sacudón que no pediste. Duele, pero despeja: lo que cae no era tan firme como parecía. Tras el rayo el guayacán sigue en pie y las golondrinas vuelan. Esta carta te pide no reconstruir lo mismo, sino levantar algo más auténtico.',
    lectura: 'Marte, planeta de la guerra, le da a la Torre su fuego: un rayo que destruye rápido. Es la energía que rompe lo estancado; dolorosa, pero necesaria para liberar lo que estaba encerrado.',
    simbologia: [
      {
        nombre: 'El guayacán amarillo',
        original: 'La torre sobre la roca',
        significado: 'La estructura que creíamos segura. El guayacán florece después de la sequía: incluso tras la crisis hay belleza.',
      },
      {
        nombre: 'El rayo',
        original: 'El rayo que golpea la torre',
        significado: 'La revelación súbita, la verdad que llega sin avisar y lo cambia todo.',
      },
      {
        nombre: 'El ojo',
        original: 'La corona que cae',
        significado: 'La conciencia que lo ve todo. El ego pierde su corona cuando la verdad sale a la luz.',
      },
      {
        nombre: 'Los nidos y huevos que caen',
        original: 'Las personas que caen de la torre',
        significado: 'Lo que dábamos por seguro se viene abajo: planes, hogares, creencias.',
      },
      {
        nombre: 'Las golondrinas',
        original: 'Las llamas en forma de yod',
        significado: 'La liberación: lo que estaba encerrado escapa y vuela libre.',
      },
    ],
    tono: ['#F2B23A', '#6A4A2E'],
  },
  {
    numero: 17,
    romano: 'XVII',
    nombre: 'La Estrella',
    slug: 'la-estrella',
    claves: ['Esperanza', 'Inspiración', 'Sanación', 'Fe'],
    elemento: 'aire',
    astro: 'Acuario',
    general:
      'La Estrella llega después de la tormenta. Es la carta de la esperanza, la sanación y la fe renovada en el futuro. Habla de inspiración, de reconectar con tu propósito y de dejar que tu luz guíe a otros. El colibrí que vuela sobre ella recuerda que lo pequeño y ligero también llega lejos. Anuncia calma, claridad y deseos que empiezan a cumplirse.',
    lectura: 'Acuario, aire visionario, hace de la Estrella una carta de ideales, futuro y comunidad. Aunque vierte agua, su elemento es el aire: la inspiración que se comparte y la esperanza que se piensa en grande.',
    simbologia: [
      {
        nombre: 'La gran estrella',
        original: 'La estrella de ocho puntas',
        significado: 'La esperanza y la guía. Después de la Torre, una luz que marca el rumbo.',
      },
      {
        nombre: 'Las manos que la liberan',
        original: 'La mujer que vierte agua en la tierra y en el estanque',
        significado: 'Dar sin miedo. La sanación se comparte: lo que recibes lo devuelves al mundo.',
      },
      {
        nombre: 'La galaxia en el agua',
        original: 'El estanque',
        significado: 'El subconsciente que se nutre de lo cósmico. Lo que está arriba se refleja abajo.',
      },
      {
        nombre: 'El colibrí',
        original: 'El ibis sobre el árbol',
        significado: 'El ibis es Thot, dios del pensamiento. El colibrí es mensajero en las tradiciones de América: las buenas noticias llegan volando.',
      },
      {
        nombre: 'Las estrellas pequeñas',
        original: 'Las siete estrellas blancas',
        significado: 'Pequeñas guías que acompañan la grande: cada paso cuenta.',
      },
    ],
    tono: ['#F7B53A', '#1D2A6B'],
  },
  {
    numero: 18,
    romano: 'XVIII',
    nombre: 'La Luna',
    slug: 'la-luna',
    claves: ['Ilusión', 'Sueños', 'Miedo', 'Subconsciente'],
    elemento: 'agua',
    astro: 'Piscis',
    general:
      'La Luna ilumina a medias. Es la carta de los sueños, la imaginación y también de las confusiones y los miedos que crecen en la oscuridad. No todo es lo que parece: pide caminar despacio, escuchar la intuición y no tomar decisiones en medio de la niebla. Como el oso de anteojos, observa en silencio antes de moverte.',
    lectura: 'Piscis, el agua más profunda, rige a la Luna: sueños, intuición, imaginación y también confusión. Pide nadar despacio en tus emociones y distinguir lo que intuyes de lo que temes.',
    simbologia: [
      {
        nombre: 'La luna que llora',
        original: 'La luna con rostro y las gotas que caen',
        significado: 'Las emociones que descienden y lo que se siente sin entender del todo.',
      },
      {
        nombre: 'El oso de anteojos',
        original: 'El perro y el lobo que aúllan',
        significado: 'Lo domesticado y lo salvaje en un mismo animal. El oso observa en silencio: el instinto que mira antes de actuar.',
      },
      {
        nombre: 'El lago en espiral',
        original: 'El estanque del que sale un cangrejo',
        significado: 'El subconsciente profundo, de donde emergen miedos y sueños antiguos.',
      },
      {
        nombre: 'Las montañas',
        original: 'Las dos torres',
        significado: 'El umbral hacia lo desconocido. El camino entre ellas no se ve claro.',
      },
      {
        nombre: 'El humo en el cielo',
        original: 'El camino sinuoso',
        significado: 'La incertidumbre: el recorrido no es recto, y lo que ves puede ser ilusión.',
      },
    ],
    tono: ['#1E3470', '#F2D38A'],
  },
  {
    numero: 19,
    romano: 'XIX',
    nombre: 'El Sol',
    slug: 'el-sol',
    claves: ['Alegría', 'Éxito', 'Vitalidad', 'Claridad'],
    elemento: 'fuego',
    astro: 'Sol',
    general:
      'El Sol es la carta más luminosa del tarot. Habla de alegría, éxito, salud y de ver las cosas con total claridad. Todo lo que estaba oculto sale a la luz y lo hace para bien. Invita a celebrar, a mostrarte tal cual eres y a disfrutar de lo simple. Como la rana dorada, algo precioso y único brilla en ti.',
    lectura: 'El Sol es fuego en estado puro: vitalidad, alegría y claridad. Da energía para brillar, mostrarte y celebrar; el único riesgo es quemarse por exceso de confianza.',
    simbologia: [
      {
        nombre: 'El sol con rostro',
        original: 'El sol con rostro',
        significado: 'La vitalidad, la claridad y la conciencia plena. Todo se ve con nitidez.',
      },
      {
        nombre: 'La rana dorada',
        original: 'El niño sobre el caballo blanco',
        significado: 'La inocencia y la alegría pura. La rana dorada, única de Colombia, es preciosa: celebra lo que te hace singular.',
      },
      {
        nombre: 'Los girasoles',
        original: 'Los girasoles detrás del muro',
        significado: 'Seguir la luz. Los girasoles giran hacia el sol, y así la vida se orienta a lo que la nutre.',
      },
      {
        nombre: 'Las nubes y el campo verde',
        original: 'El muro de piedra',
        significado: 'La seguridad y el espacio protegido donde se puede jugar sin miedo.',
      },
    ],
    tono: ['#F7A93A', '#6FC0E8'],
  },
  {
    numero: 20,
    romano: 'XX',
    nombre: 'El Juicio',
    slug: 'el-juicio',
    claves: ['Despertar', 'Llamado', 'Renacer', 'Perdón'],
    elemento: 'fuego',
    astro: 'Plutón',
    general:
      'El Juicio es un despertar. Habla de escuchar un llamado interior, de hacer balance de lo vivido y de renacer con una conciencia nueva. Es momento de perdonar, de perdonarte y de dar por cerrado el pasado para responder a lo que la vida te está pidiendo ahora. Como el ave que se eleva, invita a tomar altura y ver el recorrido completo.',
    lectura: 'El Juicio corresponde al fuego del espíritu, y Plutón le suma la transformación profunda. Es el fuego que purifica y despierta: una llamada interior que no se puede ignorar.',
    simbologia: [
      {
        nombre: 'El ave que se eleva',
        original: 'El arcángel Gabriel con la trompeta',
        significado: 'El llamado. El ave anuncia que es hora de despertar y responder.',
      },
      {
        nombre: 'El sol en el horizonte',
        original: 'La luz que baña la escena',
        significado: 'El balance del día: mirar lo vivido con claridad antes de empezar de nuevo.',
      },
      {
        nombre: 'El mar',
        original: 'Los ataúdes que flotan sobre el agua',
        significado: 'Las emociones y el pasado de donde se renace.',
      },
      {
        nombre: 'La cabellera que se vuelve ola',
        original: 'Las personas que se levantan con los brazos abiertos',
        significado: 'La respuesta al llamado: levantarse, soltar el pasado y renacer.',
      },
    ],
    tono: ['#F2803A', '#2A2470'],
  },
  {
    numero: 21,
    romano: 'XXI',
    nombre: 'El Mundo',
    slug: 'el-mundo',
    claves: ['Plenitud', 'Logro', 'Integración', 'Cierre de ciclo'],
    elemento: 'tierra',
    astro: 'Saturno',
    general:
      'El Mundo es la meta alcanzada. Cierra el viaje que empezó con El Loco: todo encaja, lo aprendido se integra y un ciclo se completa con éxito. Habla de plenitud, reconocimiento y de sentirte en tu lugar. También anuncia viajes, expansión y el comienzo natural de una etapa nueva, ahora desde la madurez.',
    lectura: 'Saturno, maestro del tiempo, y la tierra le dan al Mundo su sentido de logro concreto: lo que se construyó con paciencia por fin toma una forma completa y duradera.',
    simbologia: [
      {
        nombre: 'El cuerpo que abraza la Tierra',
        original: 'La bailarina dentro de la corona de laurel',
        significado: 'La integración y la plenitud. Ya no se busca el mundo: se abraza.',
      },
      {
        nombre: 'La cinta fucsia',
        original: 'El velo morado que la envuelve',
        significado: 'Lo espiritual que envuelve lo terrenal; la cinta que une el principio y el final del viaje.',
      },
      {
        nombre: 'El planeta',
        original: 'La corona de laurel ovalada',
        significado: 'La victoria y el ciclo cerrado. Todo el recorrido cabe en un círculo.',
      },
      {
        nombre: 'Nubes, lluvia, velas y hortensias',
        original: 'Los cuatro seres de las esquinas',
        significado: 'Los cuatro elementos en armonía: aire (nubes), agua (lluvia), fuego (velas) y tierra (flores). Al final del viaje, todo está integrado.',
      },
    ],
    tono: ['#E0457B', '#7FA6E8'],
  },
];

export interface Tirada {
  nombre: string;
  cartas: number;
  descripcion: string;
  posiciones: string[];
}

export const TIRADAS: Tirada[] = [
  {
    nombre: 'Una carta',
    cartas: 1,
    descripcion: 'Para el consejo del día o una pregunta sencilla. Saca una carta, lee su significado y mira en qué área de tu vida resuena según su elemento.',
    posiciones: ['El mensaje'],
  },
  {
    nombre: 'Pasado, presente y futuro',
    cartas: 3,
    descripcion: 'La tirada clásica para entender cómo llegaste aquí y hacia dónde vas si todo sigue su curso.',
    posiciones: ['Pasado', 'Presente', 'Futuro'],
  },
  {
    nombre: 'Cruz de los elementos',
    cartas: 4,
    descripcion: 'Una carta por posición: cómo estás en la acción, en las emociones, en la mente y en lo material.',
    posiciones: ['Fuego · acción', 'Agua · emoción', 'Aire · mente', 'Tierra · materia'],
  },
];
