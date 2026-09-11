export interface Project {
  id: string;
  name: string;
  instructions: string;
  system: string;
  style: string;
  memory: Memory;
  files: ProjectFile[];
  chats: Chat[];
  lastMemoryUpdate?: number;
  combatStatus?: CombatStatus;
  /** Definición del calendario de la campaña. Sin ella, el tiempo no se lleva. */
  calendar?: CalendarConfig;
  /** Momento en el que está la campaña ahora mismo. */
  currentDate?: CampaignDate;
  /** Qué pasó cada día, ordenado por fecha en lugar de por capítulo. */
  timeline?: TimelineEntry[];
  /** Consecuencias con fecha de vencimiento: el mundo actuando por su cuenta. */
  threads?: ScheduledThread[];
  /** Configuración de gestión de enfermedades, agotamiento y penalizadores de salud. */
  diseaseConfig?: DiseaseConfig;
  /** Configuración de control de extensión y ritmo de respuestas del DM (mínimo y máximo de párrafos). */
  narrativeLength?: NarrativeLengthConfig;
  /** Si es true, la IA no resuelve tiradas de PNJs/DM automáticamente, sino que pide al usuario que las tire. */
  manualDmRolls?: boolean;
}

export type NarrativeLengthMode = 'adaptativo' | 'agil' | 'equilibrado' | 'detallado' | 'personalizado';
export type DialoguePacing = 'auto' | 'conciso' | 'natural' | 'extendido';

export interface NarrativeLengthConfig {
  mode: NarrativeLengthMode;
  minParagraphs?: number;
  maxParagraphs?: number;
  dialoguePacing?: DialoguePacing;
  customGuideline?: string;
}

export type DiseaseRuleSystem = 'dnd5e' | 'dnd5e_2024' | 'custom' | 'narrative_only';

export interface DiseaseConfig {
  system: DiseaseRuleSystem;
  autoPenalties: boolean;
  exhaustionRules?: string;
  customRules?: string;
}

export interface CalendarConfig {
  name: string;
  months: { name: string; days: number }[];
  /** Días intercalares que no pertenecen a ningún mes; van tras el mes indicado. */
  festivals?: { name: string; afterMonth: number }[];
  weekdays?: string[];
  /** Cómo se nombra el año: «DR», «ABY», «d. C.»… */
  yearSuffix?: string;
  /**
   * En qué estación cae el primer día del año.
   *
   * No todos los calendarios arrancan en primavera. Harptos empieza en Martillo
   * —«Deepwinter», y su primer festival es Pleno Invierno—, y el gregoriano en
   * enero. Dar por hecho que el año abre en primavera desplazaba la estación un
   * cuarto de año entero: la aplicación decía «primavera» mientras enseñaba
   * «Pleno Invierno» ocho líneas más abajo.
   */
  estacionInicial?: 'primavera' | 'verano' | 'otoño' | 'invierno';
}

export interface CampaignDate {
  year: number;
  /** Día del año, 1-based, contando los festivales intercalares. */
  dayOfYear: number;
  /** Minutos desde medianoche. */
  minute: number;
}

export interface TimelineEntry {
  id: string;
  /** Día absoluto, para ordenar sin recalcular meses. */
  absDay: number;
  /** La fecha ya escrita, para no depender de la configuración al mostrarla. */
  date: string;
  /** Título o encabezado temático de la entrada (ej. "Mi fiesta de cumpleaños", "Llegada a Luskan") */
  title?: string;
  summary: string;
  /** Emoticono o ánimo/mood temático asociado al acontecimiento (ej. 🌸, 😊, ⚔️, 🍷, 👑) */
  mood?: string;
  /** URLs o imágenes asociadas a este acontecimiento/escena */
  images?: string[];
  /** Duración o etiqueta de nota de voz/audio (ej. "00:49") */
  audioDuration?: string;
  /** Si es un borrador o apunte provisional */
  isDraft?: boolean;
  /** Etiquetas adicionales o de contexto */
  tags?: string[];
  chatId?: string;
  /** ID del mensaje de chat que originó esta entrada (para sincronización precisa al borrar). */
  msgId?: string;
  /** Índice del mensaje en la lista de mensajes del chat. */
  msgIndex?: number;
  /** Dónde transcurrió el día, tal como lo escribió el Narrador. */
  lugar?: string;
  /** El tiempo que hacía: «lluvia fina», «sol de justicia», «niebla». */
  clima?: string;
  /**
   * Algo digno de recordarse de ese día, con su tipo delante para poder
   * ilustrarlo: «relación — Kieron te confía su secreto».
   */
  hito?: string;
  /** Minutos desde medianoche, para saber a qué hora ocurrió. */
  minute?: number;
  /** Categoría especial de la entrada (noticia del mundo, rumor, inconsciencia, etc.) */
  tipo?: 'acontecimiento' | 'hito' | 'descubrimiento' | 'secreto' | 'descanso' | 'noticia' | 'rumor' | 'inconsciencia' | 'salto_temporal' | 'diario' | 'personal' | 'escena';
  /** Si representa o abarca un salto temporal de múltiples días */
  timeSkipDays?: number;
  /**
   * Quién escribió la entrada.
   *
   * No es lo mismo lo que narró la partida que lo que apuntó la jugadora por su
   * cuenta, y el diario debería distinguirlo de un vistazo: lo suyo son notas.
   * Las entradas anteriores a este campo se reconocen por el prefijo `manual_`
   * del identificador, que es como se venían creando a mano.
   */
  autoria?: 'narrador' | 'jugadora';
}

export interface ScheduledThread {
  id: string;
  title: string;
  /** Qué ocurre cuando vence. Es lo que se le inyecta al Narrador. */
  effect: string;
  dueAbsDay: number;
  /** La fecha de vencimiento ya escrita, para mostrarla sin recalcular. */
  dueDate: string;
  /** Si es secreto, la jugadora ve que hay algo en marcha pero no el qué. */
  hidden: boolean;
  status: 'pending' | 'fired' | 'cancelled';
  /** De dónde salió: el Narrador o la jugadora. */
  origin?: 'narrador' | 'jugadora';
}

export interface CombatStatus {
  isActive: boolean;
  round: number;
  turnIndex: number;
  combatants: Combatant[];
}

export interface Combatant {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  initiative: number;
  status: string;
  isPlayer: boolean;
}

export interface VisualMemoryItem {
  id: string;
  fileId: string;
  fileName: string;
  thumbnail?: string;
  analysis: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category?: 'weapon' | 'armor' | 'potion' | 'scroll' | 'magic' | 'equipment' | 'treasure' | 'other';
  quantity: number;
  weight?: number; // lbs
  equipped?: boolean;
  attuned?: boolean;
  description?: string;
  damageOrAc?: string; // e.g. "1d8+3 cortante" or "+2 CA"
  rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact' | string;
  cost?: string;
  expiresInMinutes?: number;
  durationNote?: string;
}

export interface PlayerAttributes {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface PlayerCurrencies {
  cp: number; // Cobre
  sp: number; // Plata
  ep: number; // Electro
  gp: number; // Oro
  pp: number; // Platino
}

export interface PlayerDeathSaves {
  successes: number; // 0-3
  failures: number;  // 0-3
}

export interface CharacterSpell {
  name: string;
  level: number; // 0 = truco/cantrip, 1, 2, 3...
  school?: string; // Evocación, Adivinación, etc.
  castingTime?: string; // 1 acción, 1 acción adicional, etc.
  range?: string; // Toque, 30 pies, 60 pies, etc.
  components?: string; // V, S, M
  duration?: string; // Instantáneo, 1 minuto (Concentración), etc.
  description?: string;
  damageOrEffect?: string;
  isRitual?: boolean;
  isPrepared?: boolean;
}

export interface CharacterAction {
  name: string;
  type?: 'attack' | 'action' | 'bonus' | 'reaction' | 'legendary' | 'special';
  damageOrEffect?: string;
  description: string;
}

export interface CharacterTrait {
  name: string;
  type?: 'feature' | 'feat' | 'race' | 'class' | 'background' | 'other';
  source?: string; // ej: "Dote: Afortunado", "Druida: Forma Salvaje"
  description: string;
  uses?: {
    max: number;
    current: number;
    recovery?: 'short_rest' | 'long_rest' | 'dawn';
  };
}

export interface PlayerEvent {
  id: string;
  title: string;
  description: string;
  dateOrTime?: string;
  createdAt?: number;
}

export interface PlayerCharacter {
  id?: string;
  name: string;
  title?: string; // e.g. "Maga Elfa de la Luna"
  summary?: string; // Resumen narrativo de lo que le va sucediendo al OC
  events?: PlayerEvent[]; // Acontecimientos importantes del OC (añadibles a mano o por IA)
  characterType?: 'pc' | 'companion' | 'familiar' | 'mount' | 'sidekick' | 'npc';
  companionType?: string; // 'Familiar' | 'Montura' | 'Compañero Animal' | 'Invocación' | 'Aliado'
  ownerName?: string;
  race?: string;
  class?: string;
  gender?: string;
  subclass?: string;
  level?: string;
  levelProgress?: number; // 0-100 percentage towards next level
  /**
   * Hitos anotados hacia el siguiente nivel, tal como los lleva el Narrador.
   *
   * El avance por hitos se llevaba solo en la cabeza del modelo: las
   * instrucciones exigían una línea `[Avance: 2/3]` que nadie leía, así que la
   * cuenta se perdía al cambiar de capítulo y el HUD se inventaba un
   * porcentaje a partir de eventos y misiones. Guardarlo aquí es lo que
   * convierte esa cuenta en algo que sobrevive a la sesión.
   */
  hitosActuales?: number;
  hitosParaSubir?: number;
  background?: string;
  alignment?: string;
  experience?: string;
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  hitDice?: string;
  deathSaves?: PlayerDeathSaves;
  ac?: number;
  speed?: string;
  initiative?: string;
  proficiencyBonus?: number;
  attributes?: PlayerAttributes;
  savingThrowProficiencies?: string[];
  skillProficiencies?: string[];
  conditions?: string[];
  inventory?: InventoryItem[];
  currencies?: PlayerCurrencies;
  maxCarryWeight?: number;
  appearance?: string;
  backstory?: string;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  featuresAndTraits?: string;
  traits?: CharacterTrait[];
  actions?: CharacterAction[];
  spells?: CharacterSpell[];
  languages?: string[];
  proficienciesAndLanguages?: string;
  spellcasting?: {
    ability?: string;
    saveDc?: number;
    attackBonus?: number;
    slots?: Record<number, { total: number; used: number }>;
  };
  notes?: string;
  sheetText?: string;
  portrait?: string;
}

export interface ProjectMemoryEdit {
  id: string;
  text: string;
  createdAt: number;
  source?: 'user' | 'ai';
}

/**
 * Un secreto de la campaña que no cuelga de nadie.
 *
 * Los secretos vivían en dos sitios y ninguno servía para esto: `NPC.oculta`
 * exige una persona, y `ScheduledThread` exige una fecha de vencimiento. Una
 * idea como «los dueños del barco son agentes Zhentarim disfrazados» no es de
 * nadie en concreto y no vence ningún día: es una verdad del mundo esperando a
 * que alguien la descubra. Sin sitio donde vivir, se quedaba en la cabeza de la
 * jugadora, se contaba de pasada en la prosa, o se perdía.
 */
export interface SecretoDeCampana {
  id: string;
  /** De qué va, en pocas palabras. Es lo único que se ve sin destapar. */
  titulo: string;
  /** La verdad. Va tapado en la interfaz y con candado para el Narrador. */
  secreto: string;
  /** Por dónde puede salir: registrar el camarote, emborrachar al contramaestre… */
  comoSeDescubre?: string;
  /**
   * A qué capa de la cebolla pertenece.
   *
   * 1 = lo que PARECE que pasa · 2 = lo que pasa de verdad · 3 = quién está
   * detrás y por qué · 4 = el fondo del asunto. Es lo que separa una trama de
   * una lista de sorpresas: sin capas no hay orden de revelación, y el Narrador
   * o lo suelta todo de golpe o no lo saca nunca.
   */
  capa?: number;
  /**
   * Títulos de otros secretos con los que engancha.
   *
   * Una capa que no engancha con otra no es una capa: es un giro suelto. Aquí
   * se guarda de qué tira cada hilo cuando alguien lo estira.
   */
  conecta?: string[];
  /**
   * Qué se puede ir sembrando AHORA, mucho antes de que se descubra.
   *
   * Es la mitad del oficio: un giro sin siembra previa se lee como un truco;
   * con ella, como algo que estaba delante todo el rato.
   */
  sembrar?: string;
  /**
   * Qué SABE ELLA que abre esta capa.
   *
   * Una revelación no se destapa tirando Investigación: se destapa porque
   * alguien reconoce algo que solo él sabe reconocer. En una partida que
   * funcionó, una jugadora que sabía de plantas vio una flor en la mano de una
   * dama de la corte, supo que era abortiva, y con eso se cayó el último velo
   * de una campaña entera. Ese es el momento por el que se juega un personaje
   * con oficio: aquí se declara cuál es el suyo para cada capa.
   */
  abreCon?: string;
  /**
   * Qué hace quien está detrás si le frustran ESTO.
   *
   * Una trama no es una verdad quieta esperando a que la descubran: es alguien
   * con un plan. Si el plan se va al traste, esa persona no se queda parada,
   * improvisa algo peor —y eso suele ser mejor escena que el plan original—.
   * Sin esto, impedir un giro lo mata; con esto, lo convierte en el siguiente.
   */
  siLoImpiden?: string;
  /**
   * Cuándo se puede DISPARAR, con condiciones que la aplicación sabe comprobar.
   *
   * «Puede salir al alcanzar un hito de nivel» estaba escrito en prosa, así que
   * nadie lo verificaba: el Narrador podía sacar hoy un giro que solo tiene
   * sentido dentro de tres niveles, o no sacarlo nunca por no acordarse. Con
   * esto, la aplicación mira el estado real de la campaña en cada turno y le
   * dice si ese giro está abierto o todavía cerrado.
   *
   * ⚠️ Cerrado NO significa invisible: la siembra sigue haciéndose desde el
   * primer día. Lo que no se puede es destapar la revelación antes de tiempo.
   */
  condicion?: {
    /** Nivel del protagonista a partir del cual se puede destapar. */
    nivelMinimo?: number;
    /** Título de otro secreto que tiene que haberse revelado antes. */
    trasSecreto?: string;
    /** Día absoluto de campaña antes del cual no toca. */
    diaAbsMinimo?: number;
    /** Título de una trama que tiene que estar COMPLETADA. */
    misionCompletada?: string;
    /** Nombre de un PNJ al que hay que haber conocido en escena. */
    conPnj?: string;
    /**
     * Un umbral de relación con alguien.
     *
     * Es lo que permite atar un hilo al ritmo de OTRO: que la carta de casa no
     * llegue hasta que la relación con cierta persona haya avanzado de verdad.
     * No mide el hecho concreto —eso va en `nota`—, mide que la relación esté
     * donde tiene que estar para que ese hecho haya podido pasar.
     */
    afinidadMinima?: {
      pnj: string;
      /** atr = atracción · vin = vínculo · con = confianza. */
      eje: 'atr' | 'vin' | 'con';
      valor: number;
    };
    /** Lo que no se puede comprobar con un número, dicho en una frase. */
    nota?: string;
  };
  /**
   * Quién puede traer esto a la mesa, y qué lo pondría en marcha.
   *
   * Es la pieza que faltaba entre la trama y el reparto. Una capa sabía qué
   * era y qué sembrar, pero no QUIÉN la mueve, así que el Narrador tenía por
   * un lado una historia y por otro una lista de personajes, sin nada que los
   * uniera. Y sin eso, un personaje solo puede volver «porque toca» —que es un
   * cameo— en vez de volver porque algo ha pasado y él es quien lo sabe:
   * Entreri no aparece por variedad, aparece porque algo se ha movido en el
   * sur y viene a decírselo a Jarlaxle en persona.
   *
   * Ejemplo: «Entreri, si se mueve algo en Calimport. Viene en persona porque
   * no se fía de un mensajero, y le molesta tener que venir.»
   */
  quienLoTrae?: string;
  /** Quién lo plantó: la jugadora al preparar, el Narrador, o el trazado inicial. */
  origen?: 'jugadora' | 'narrador' | 'trama';
  /** Cuándo y cómo salió a la luz EN JUEGO, si ya ha salido. */
  revelado?: {
    diaAbs?: number;
    fecha?: string;
    como?: string;
  };
}

export interface Memory {
  story: string;
  quests: Quest[];
  npcs: NPC[];
  companions?: PlayerCharacter[];
  locations: Location[];
  current_status: string;
  purpose_and_context?: string;
  tools_and_resources?: string;
  raw_project_memory?: string;
  memory_edits?: ProjectMemoryEdit[];
  player_character?: PlayerCharacter;
  visual_memory?: VisualMemoryItem[];
  /**
   * Los giros que aún no han pasado.
   *
   * Viajan al Narrador con candado y no aparecen en la crónica, el HUD ni los
   * resúmenes. Es lo que separa «una campaña con sorpresas» de «una campaña
   * cuyas sorpresas se cuentan solas».
   */
  /**
   * Nombres que NUNCA vuelven a la lista de PNJs.
   *
   * El protagonista sale nombrado en todos los documentos de la campaña, así
   * que los extractores automáticos le hacen ficha como a uno más y el filtro
   * por nombre no siempre acierta (una ficha sin nombre no se puede comparar
   * con nada). Cuando la jugadora dice «esto no es un PNJ», se apunta aquí y
   * ninguna vía automática lo vuelve a crear.
   */
  /**
   * El trayecto largo que está en marcha, si lo hay.
   *
   * Sin esto, «de las Moonshae a Luskan hay 8-12 días» era una frase en las
   * directivas que nadie comprobaba: la travesía entera cabía en una noche.
   */
  viaje?: {
    destino: string;
    /** Jornadas que cuesta el trayecto entero. */
    jornadas: number;
    /** Día absoluto de la campaña en que se zarpó. */
    iniciadoAbs: number;
  };
  no_son_pnj?: string[];
  gm_secrets?: SecretoDeCampana[];
  /**
   * La forma de la historia, decidida de antemano.
   *
   * No es un secreto más: es el mapa de cómo encajan todos. La premisa, hacia
   * dónde va, y qué hay que ir sembrando. El Narrador lo lleva encima para
   * dirigir hacia allí en vez de improvisar cada escena y descubrir tarde que
   * lo de hace tres capítulos no lleva a ninguna parte.
   */
  plan_de_campana?: {
    /** De qué va la historia, en dos o tres frases. Con candado. */
    premisa: string;
    /** Dónde acaba esto si nadie lo tuerce. */
    destino?: string;
    /** Cuándo se trazó, para saber si se ha quedado viejo. */
    trazadoEl?: string;
  };
}

export interface Quest {
  id: string;
  title: string;
  origin: string;
  objective: string;
  progress: string;
  status: string;
  type: string;
  portrait?: string;
}

export interface NPC {
  id: string;
  name: string;
  relation: string;
  status: string;
  portrait?: string;
  notes: string;
  description?: string;
  appearance?: string; // Descripción física detallada (rostro, ojos, vestimenta, estatura, rasgos distintivos)
  alias?: string; // Alias, apodo o disfraz bajo el que se dio a conocer (ej: "Oficial Corsario...", "J.B.")
  trueIdentity?: string; // Verdadera identidad descubierta (ej: "Jarlaxle Baenre")
  disguise?: string; // Notas del disfraz o apariencia falsa si aún no ha sido desenmascarado
  characterSheet?: PlayerCharacter;

  /**
   * En qué días de campaña ha estado en escena, sin repetir.
   *
   * Es lo que separa al tabernero de turno de alguien con quien te tomas una copa
   * cada tarde: no cuántas frases ha dicho, sino cuántas veces ha vuelto.
   */
  diasVistos?: number[];
  /** Deja de ser figurante y se le abre ficha de vínculo. */
  recurrente?: boolean;
  /** Lo que deja ver: cómo trata al protagonista. Se muestra siempre. */
  aparenta?: string;
  /** Lo que calla. Va tapado: leerlo es destriparse la traición. */
  oculta?: string;
  /**
   * Cuándo y cómo se supo lo que callaba, si ya se ha sabido EN JUEGO.
   *
   * Es la diferencia entre un secreto y un dato. Mientras esto no exista, el
   * Narrador tiene prohibido narrarlo, insinuarlo o dejar que otro PNJ lo
   * suelte; en cuanto existe, es algo que el protagonista sabe y con lo que se
   * puede contar. Destapar la ficha para leerla no lo rellena: eso es la
   * jugadora mirando el guion, no el personaje averiguando nada.
   */
  secretoRevelado?: {
    /** Día absoluto de campaña en que salió. */
    diaAbs?: number;
    /** La fecha escrita, para enseñarla sin recalcular. */
    fecha?: string;
    /** Cómo se supo: «lo contó Dab'nay», «lo dedujo por el anillo». */
    como?: string;
  };
  /** En qué punto está la relación, en dos o tres palabras. */
  vinculo?: string;
  /** Eje de Atracción / Química romántica y tensión (escala 0 - 20) */
  atr?: number;
  /** Eje de Vínculo afectivo / Camaradería y lealtad (escala 0 - 20) */
  vin?: number;
  /** Eje de Confianza táctica / Secretos compartidos (escala 0 - 20) */
  con?: number;
  /** Registro del último día de campaña/marca en que subió cada eje para aplicar el límite diario */
  ultimoDiaSubida?: {
    atr?: number;
    vin?: number;
    con?: number;
  };
}

export interface Location {
  id: string;
  name: string;
  desc: string;
  notes: string;
  portrait?: string;
  markers?: MapMarker[];
}

export interface MapMarker {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  label: string;
  description: string;
  linkToId?: string; // ID of NPC or Location
}

export type FileCategory =
  | 'map'
  | 'portrait_pj'
  | 'sheet_pj'
  | 'sheet_companion'
  | 'sheet_npc'
  | 'portrait_companion'
  | 'portrait_npc'
  | 'scene'
  | 'document'
  /**
   * Material de fondo, separado por PARA QUÉ SIRVE.
   *
   * «Documento» lo englobaba todo y no decía nada, así que un compendio de
   * novelas acababa etiquetado como ficha de PNJ por no tener sitio mejor. La
   * categoría no es decoración: pesa en la búsqueda local, y saber que un
   * archivo es una cantera de lugares ayuda a que suba cuando la escena
   * necesita un lugar.
   */
  | 'compendio'
  | 'cantera'
  | 'lore'
  /**
   * Subsistemas de juego: persecuciones, frío extremo, intriga urbana, asedios.
   *
   * Van aparte del lore porque son PORTÁTILES: las reglas de persecución por
   * los tejados de un módulo urbano sirven igual en otra ciudad, y las de frío
   * de una campaña ártica sirven en cualquier invierno. Atarlas a su módulo de
   * origen es perderlas para el resto de la campaña.
   */
  | 'mecanica'
  | 'style_sample'
  | 'oracle'
  | 'roster'
  | 'index'
  | 'audio'
  | 'other';

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  content: string; // base64 for images, text for others
  mime: string;
  category?: FileCategory;
  isImage?: boolean;
  isAudio?: boolean;
  length: number;
  markers?: MapMarker[];
  analysis?: string;
  /**
   * Si es `true`, el texto del archivo NO viaja en cada turno: solo se le anuncia
   * al Narrador que existe y de qué trata. Sirve para manuales y libros de lore
   * de los que hacen falta dos párrafos por escena, no las trescientas páginas.
   * Por defecto (undefined) el archivo va entero, como hasta ahora.
   */
  onDemand?: boolean;
}

export interface Chat {
  id: string;
  name: string;
  messages: Message[];
  autoTitled?: boolean;
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
  /** Versión novelada y literaria de la respuesta del jugador para lectura y maquetación de novela */
  novelContent?: string;
}

export interface GlobalGrimorio {
  name: string;
  behavior: string;
  system: string;
  style: string;
}

export interface GlobalStyle {
  name: string;
  inst: string;
}

export interface AppState {
  projects: Project[];
  globalGrimorios: GlobalGrimorio[];
  globalStyles: GlobalStyle[];
}
