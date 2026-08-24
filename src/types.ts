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
  summary: string;
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
  tipo?: 'acontecimiento' | 'noticia' | 'rumor' | 'inconsciencia' | 'salto_temporal';
  /** Si representa o abarca un salto temporal de múltiples días */
  timeSkipDays?: number;
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

export interface PlayerCharacter {
  id?: string;
  name: string;
  characterType?: 'pc' | 'companion' | 'familiar' | 'mount' | 'sidekick' | 'npc';
  companionType?: string; // 'Familiar' | 'Montura' | 'Compañero Animal' | 'Invocación' | 'Aliado'
  ownerName?: string;
  race?: string;
  class?: string;
  gender?: string;
  subclass?: string;
  level?: string;
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

export interface Memory {
  story: string;
  quests: Quest[];
  npcs: NPC[];
  companions?: PlayerCharacter[];
  locations: Location[];
  current_status: string;
  manual_notes: string;
  player_character?: PlayerCharacter;
  visual_memory?: VisualMemoryItem[];
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
