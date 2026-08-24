import { GoogleGenAI } from '@google/genai';
import {
  Project,
  Chat,
  ProjectFile,
  Memory,
  FileCategory,
  PlayerCharacter,
  NPC,
  CalendarConfig,
  PlayerAttributes,
  InventoryItem,
  PlayerCurrencies,
  CampaignDate,
  TimelineEntry,
  ScheduledThread
} from '../types';
import { CORE_INTERFACE_PROTOCOLS, DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE } from './defaultDirectives';
import { registrarUso } from './usageStats';
import { parseInventoryTags, InventoryChangeReport } from './inventoryParser';
import { parseDndSheetText, refineAndDeduplicateInventory, validateCharacterEquipment } from './characterSheetParser';
import {
  aDiaAbsoluto,
  desdeDiaAbsoluto,
  fechaLegible,
  fechaInicial,
  calendarioValido,
  diasPorAno,
  distanciaEnDias,
  fechaCompleta,
  hilosPendientes,
  hilosQueVencen,
  leerAgenda,
  leerAvanceDeTiempo,
  EntradaDeAgenda,
  leerHilos,
  limpiarEtiquetasDeTiempo,
  limpiarEtiquetasDePnj,
  leerPresentes,
  leerVinculos,
  VinculoLeido,
  HiloLeido
} from './campaignCalendar';
import { coincidenNombresNpc, fusionarDosNpcs, deduplicarListaNpcs } from './npcMatcher';

// In-app API key & model management (stored locally in the user's browser)
export interface AIModelOption {
  id: string;
  name: string;
  badge: string;
  desc: string;
}

export const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Recomendado · Rápido y fluido',
    desc: 'El modelo insignia de Google AI Studio: máxima velocidad, capacidad multimodal y cuota amplia.'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: 'Máxima Inteligencia · Prosa rica',
    desc: 'El modelo superior para razonamiento profundo, prosa literaria exquisita y coherencia impecable en tramas complejas.'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    badge: 'Ultra Ligero · Ahorro de cuota',
    desc: 'Optimizado para máxima velocidad y consumo mínimo de tokens, ideal para sesiones largas.'
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Híbrido · Razonamiento',
    desc: 'Modelo con capacidad de pensamiento y razonamiento dinámico para situaciones tácticas complejas.'
  }
];

export function esModeloAbierto(modelId: string): boolean {
  return /^gemma/i.test(modelId.trim());
}

export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';
export const DEFAULT_BACKGROUND_MODEL_ID = 'gemini-2.5-flash';
export const BACKGROUND_LIGHTWEIGHT_MODEL_ID = 'gemini-2.5-flash-lite';

export function getStoredAutoFailover(): boolean {
  return localStorage.getItem('gmstudio_auto_failover') !== 'off';
}

export function setStoredAutoFailover(enabled: boolean): void {
  localStorage.setItem('gmstudio_auto_failover', enabled ? 'on' : 'off');
}

/**
 * Cadena de modelos de respaldo en cascada ante saturación o fallos de servidores de Google.
 * Si el modelo principal está ocupado (503/429), la app salta automáticamente al siguiente
 * de forma transparente para que la partida nunca se detenga.
 */
export function getModelFailoverChain(initialModel: string): string[] {
  if (!getStoredAutoFailover()) {
    return [initialModel];
  }
  const standardFallbacks = [
    'gemini-2.5-flash',
    'gemini-3.7-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite'
  ];
  const chain: string[] = [initialModel];
  for (const m of standardFallbacks) {
    if (!chain.includes(m)) {
      chain.push(m);
    }
  }
  return chain;
}

/**
 * Devuelve el modelo secundario configurado por el usuario para tareas de fondo y agente
 * (sincronización de memoria, extracción de PNJs, destilado de fichas, deducción de fechas).
 */
export function getStoredBackgroundModel(): string {
  const local = localStorage.getItem('gemini_background_model');
  if (local && local.trim()) {
    const trimmed = local.trim();
    const validIds = AVAILABLE_MODELS.map(m => m.id);
    if (validIds.includes(trimmed)) return trimmed;
    if (/^(gemini|gemma)[\w.-]*$/i.test(trimmed)) return trimmed;
  }
  return DEFAULT_BACKGROUND_MODEL_ID;
}

export function setStoredBackgroundModel(modelId: string): void {
  if (modelId && modelId.trim()) {
    localStorage.setItem('gemini_background_model', modelId.trim());
  }
}

/**
 * Devuelve el modelo para tareas de agente y segundo plano.
 */
export function getBackgroundTaskModel(): string {
  return getStoredBackgroundModel();
}

export function getStoredModel(): string {
  const local = localStorage.getItem('gemini_model');
  if (local && local.trim()) {
    const trimmed = local.trim();
    const validIds = AVAILABLE_MODELS.map(m => m.id);
    if (validIds.includes(trimmed)) return trimmed;
    // Un identificador escrito a mano en el panel del Motor también vale; solo se
    // descartan restos de versiones anteriores que ya no son nombres de modelo.
    if (/^(gemini|gemma)[\w.-]*$/i.test(trimmed)) return trimmed;
  }
  return DEFAULT_MODEL_ID;
}

export function setStoredModel(modelId: string): void {
  if (modelId && modelId.trim()) {
    localStorage.setItem('gemini_model', modelId.trim());
  }
}

export type SafetyThreshold =
  'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
export type ThinkingLevelSetting = 'AUTO' | 'HIGH' | 'LOW' | 'MINIMAL';

export function getStoredSafetyLevel(): SafetyThreshold {
  const local = localStorage.getItem('gemini_safety_level');
  if (
    local &&
    ['BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE'].includes(local)
  ) {
    return local as SafetyThreshold;
  }
  return 'BLOCK_NONE'; // Por defecto: Sin censura para rol adulto/18+ y dark fantasy
}

export function setStoredSafetyLevel(level: SafetyThreshold): void {
  localStorage.setItem('gemini_safety_level', level);
}

export function getStoredThinkingLevel(): ThinkingLevelSetting {
  const local = localStorage.getItem('gemini_thinking_level');
  if (local && ['AUTO', 'HIGH', 'LOW', 'MINIMAL'].includes(local)) {
    return local as ThinkingLevelSetting;
  }
  // Por defecto en LOW (1024 tokens) para evitar que la cuota gratuita de AI Studio
  // se consuma con miles de tokens de pensamiento invisibles por turno.
  return 'LOW';
}

export function setStoredThinkingLevel(level: ThinkingLevelSetting): void {
  localStorage.setItem('gemini_thinking_level', level);
}

export function getThinkingBudgetConfig(thinkingSetting: ThinkingLevelSetting) {
  if (thinkingSetting === 'HIGH') return { thinkingBudget: 4096 };
  if (thinkingSetting === 'LOW') return { thinkingBudget: 1024 };
  if (thinkingSetting === 'MINIMAL') return { thinkingBudget: 0 };
  return { thinkingBudget: 1024 };
}

/**
 * Si la búsqueda en los documentos de consulta está encendida.
 *
 * Apagarla no ahorra peticiones —la búsqueda corre en el navegador y no llama a
 * nadie— pero sí tokens: los fragmentos rescatados ocupan hasta seis mil
 * caracteres por turno. A cambio, el Narrador se queda sin poder mirar en ese
 * material y solo sabe que existe.
 */
export function getStoredBusquedaLocal(): boolean {
  return localStorage.getItem('gmstudio_busqueda_local') !== 'off';
}

export function setStoredBusquedaLocal(activa: boolean): void {
  localStorage.setItem('gmstudio_busqueda_local', activa ? 'on' : 'off');
}

export function getStoredTemperature(): number {
  const local = localStorage.getItem('gemini_temperature');
  if (local) {
    const val = parseFloat(local);
    if (!isNaN(val) && val >= 0.1 && val <= 2.0) return val;
  }
  return 0.80; // Recomendado para rol (0.70 – 0.85): variedad descriptiva y riqueza narrativa sin perder coherencia
}

export function setStoredTemperature(temp: number): void {
  localStorage.setItem('gemini_temperature', temp.toString());
}

export function getStoredTopP(): number {
  const local = localStorage.getItem('gemini_top_p');
  if (local) {
    const val = parseFloat(local);
    if (!isNaN(val) && val >= 0.1 && val <= 1.0) return val;
  }
  return 0.95; // Top-P recomendado: amplitud de vocabulario y riqueza metafórica
}

export function setStoredTopP(topP: number): void {
  localStorage.setItem('gemini_top_p', topP.toString());
}

export function buildSafetySettings(threshold: SafetyThreshold = getStoredSafetyLevel()) {
  const categories = [
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_DANGEROUS_CONTENT',
    'HARM_CATEGORY_CIVIC_INTEGRITY'
  ];
  return categories.map(category => ({
    category,
    threshold
  }));
}

export function getStoredAutoSyncMemory(): boolean {
  const v = localStorage.getItem('gmstudio_auto_sync_memory');
  if (v === 'off') return false;
  return true; // por defecto activo
}

export function setStoredAutoSyncMemory(enabled: boolean): void {
  localStorage.setItem('gmstudio_auto_sync_memory', enabled ? 'on' : 'off');
}

export type MemorySyncGranularity = 'smart_lite' | 'full' | 'batch' | 'off';

export function getStoredMemorySyncGranularity(): MemorySyncGranularity {
  const local = localStorage.getItem('gmstudio_memory_sync_granularity');
  if (local && ['smart_lite', 'full', 'batch', 'off'].includes(local)) {
    return local as MemorySyncGranularity;
  }
  // Si auto_sync_memory estaba apagado antes, mantenemos 'off'
  if (localStorage.getItem('gmstudio_auto_sync_memory') === 'off') {
    return 'off';
  }
  return 'smart_lite'; // Por defecto: Optimizado / Esencial (Ahorro de Cuota del 70%)
}

export function setStoredMemorySyncGranularity(granularity: MemorySyncGranularity): void {
  localStorage.setItem('gmstudio_memory_sync_granularity', granularity);
  if (granularity === 'off') {
    localStorage.setItem('gmstudio_auto_sync_memory', 'off');
  } else {
    localStorage.setItem('gmstudio_auto_sync_memory', 'on');
  }
}

export function getStoredApiKeys(): string[] {
  const localList = localStorage.getItem('gemini_api_keys');
  if (localList) {
    try {
      const parsed = JSON.parse(localList);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map((k: any) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);
        if (cleaned.length > 0) return cleaned;
      }
    } catch {}
  }
  const single = localStorage.getItem('gemini_api_key');
  if (single && single.trim()) return [single.trim()];
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey !== 'MY_GEMINI_API_KEY') return [envKey.trim()];
  return [];
}

export function setStoredApiKeys(keys: string[]): void {
  const cleaned = keys.map(k => k.trim()).filter(Boolean);
  if (cleaned.length > 0) {
    localStorage.setItem('gemini_api_keys', JSON.stringify(cleaned));
    localStorage.setItem('gemini_api_key', cleaned[0]);
  } else {
    localStorage.removeItem('gemini_api_keys');
    localStorage.removeItem('gemini_api_key');
  }
}

export type KeyRotationMode = 'round_robin' | 'failover_only';

export function getStoredKeyRotationMode(): KeyRotationMode {
  const local = localStorage.getItem('gemini_key_rotation_mode');
  if (local && (local === 'round_robin' || local === 'failover_only')) {
    return local as KeyRotationMode;
  }
  return 'round_robin'; // Rotación activa round-robin por defecto para maximizar cuota de peticiones por minuto
}

export function setStoredKeyRotationMode(mode: KeyRotationMode): void {
  localStorage.setItem('gemini_key_rotation_mode', mode);
}

// Mapa en memoria para enfriamiento temporal de claves cuando devuelven 429 (Resource Exhausted)
const keyCooldownMap = new Map<string, number>();

export function markKeyCooldown(key: string, durationMs: number = 60000) {
  if (key && key.trim()) {
    keyCooldownMap.set(key.trim(), Date.now() + durationMs);
  }
}

export function isKeyInCooldown(key: string): boolean {
  if (!key || !key.trim()) return false;
  const expiry = keyCooldownMap.get(key.trim());
  if (!expiry) return false;
  if (Date.now() > expiry) {
    keyCooldownMap.delete(key.trim());
    return false;
  }
  return true;
}

// Índice circular persistente para la rotación proactiva Round-Robin
let globalRoundRobinIndex = (() => {
  try {
    return parseInt(localStorage.getItem('gemini_rr_index') || '0', 10) || 0;
  } catch {
    return 0;
  }
})();

/**
 * Devuelve la lista ordenada de claves para la siguiente petición:
 * - En 'round_robin': rota de forma circular turno a turno y tarea a tarea,
 *   colocando primero las claves sanas y dejando al final las que están en enfriamiento por 429.
 * - En 'failover_only': devuelve las claves en su orden fijo original.
 */
export function getRotatedApiKeys(): {
  keys: string[];
  activeOriginalIndex: number;
  totalKeys: number;
} {
  const allKeys = getStoredApiKeys();
  if (allKeys.length === 0) {
    return { keys: [], activeOriginalIndex: 0, totalKeys: 0 };
  }

  const mode = getStoredKeyRotationMode();

  if (mode === 'failover_only' || allKeys.length === 1) {
    return {
      keys: allKeys,
      activeOriginalIndex: 0,
      totalKeys: allKeys.length
    };
  }

  // Round-robin activo: avanzar índice circular
  const startIdx = globalRoundRobinIndex % allKeys.length;
  globalRoundRobinIndex = (globalRoundRobinIndex + 1) % allKeys.length;
  try {
    localStorage.setItem('gemini_rr_index', globalRoundRobinIndex.toString());
  } catch {}

  // Construir lista circular empezando por startIdx
  const rotated: { key: string; origIdx: number }[] = [];
  for (let i = 0; i < allKeys.length; i++) {
    const idx = (startIdx + i) % allKeys.length;
    rotated.push({ key: allKeys[idx], origIdx: idx });
  }

  // Priorizar claves sanas y dejar en cola las que estén en cooldown temporal por 429
  rotated.sort((a, b) => {
    const aCool = isKeyInCooldown(a.key) ? 1 : 0;
    const bCool = isKeyInCooldown(b.key) ? 1 : 0;
    return aCool - bCool;
  });

  return {
    keys: rotated.map(r => r.key),
    activeOriginalIndex: rotated[0].origIdx,
    totalKeys: allKeys.length
  };
}

export function getStoredApiKey(): string {
  const keys = getStoredApiKeys();
  return keys[0] || '';
}

export function setStoredApiKey(key: string): void {
  if (key && key.trim()) {
    const current = getStoredApiKeys();
    const rest = current.filter(k => k !== key.trim());
    setStoredApiKeys([key.trim(), ...rest]);
  } else {
    setStoredApiKeys([]);
  }
}

export function hasConfiguredApiKey(): boolean {
  return getStoredApiKeys().length > 0;
}

export function getAIClient(apiKey?: string): GoogleGenAI {
  const key = apiKey || getStoredApiKey();
  if (!key) {
    throw new Error(
      'La clave de API de Gemini no está configurada.\n\nPulsa el botón "Motor" de la barra superior e introduce tu clave de Google AI Studio.'
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

export interface TurnPayload {
  /** Instrucción de sistema completa: directivas, sistema, estilo, ficha, documentos, memoria y dados. */
  sys: string;
  /** Los turnos de la conversación que viajan literales. */
  contents: any[];
}

/**
 * Monta EXACTAMENTE lo que se le manda al modelo en un turno.
 *
 * Vive aparte de `generateStoryTurnStream` para que el contador de contexto pueda
 * medir lo mismo que se envía en vez de estimarlo por su cuenta: si el contador y
 * el envío se calculan en dos sitios distintos, acaban discrepando.
 */
export function buildTurnPayload({
  project,
  currentChatId,
  chats,
  files,
  userText,
  dicePool
}: {
  project: Project;
  currentChatId: string;
  chats: Chat[];
  files: ProjectFile[];
  userText: string;
  dicePool: { d20: number[]; d100: number[]; d6: number[] };
}): TurnPayload {
  const currentChat = chats.find(c => c.id === currentChatId);
  if (!currentChat) throw new Error('Sesión no encontrada.');

  // Cola de los capítulos anteriores. Se recorre hacia atrás y se para al
  // llenar el cupo: antes se concatenaban enteros (megas en una campaña larga)
  // para luego tirar todo menos el final. El resto ya lo cuenta el resumen de
  // la Memoria Viva, que viaja aparte en este mismo prompt. Se mantiene como
  // red de seguridad, no como fuente principal: por eso el cupo es pequeño.
  const PREVIO_MAX = 4000;
  const sortedChats = [...chats].sort((a, b) => a.id.localeCompare(b.id));
  const indiceActual = sortedChats.findIndex(c => c.id === currentChatId);
  const anteriores = sortedChats.slice(0, indiceActual < 0 ? sortedChats.length : indiceActual);

  const trozos: string[] = [];
  let acumulado = 0;
  for (let i = anteriores.length - 1; i >= 0 && acumulado < PREVIO_MAX; i--) {
    const c = anteriores[i];
    const texto =
      `\n--- Sesión: ${c.name} ---\n` +
      (c.messages || []).map(m => `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`).join('\n');
    const hueco = PREVIO_MAX - acumulado;
    const recorte = texto.length > hueco ? texto.slice(-hueco) : texto;
    trozos.unshift(recorte);
    acumulado += recorte.length;
  }
  const allPreviousHistory = trozos.join('');

  const visualFilesText = files
    .filter(f => f.isImage && f.analysis)
    .map(f => `=== IMAGEN / MAPA CANÓNICO: ${f.name} ===\nAnálisis Visual:\n${f.analysis}`)
    .join('\n\n');

  const visualMemoryText = (project.memory?.visual_memory || [])
    .map(v => `- [${v.fileName}]: ${v.analysis}`)
    .join('\n');

  const memoryContext = project.memory
    ? `
HISTORIA HASTA AHORA:
${project.memory.story || 'Inicio de la crónica.'}

ESTADO ACTUAL:
${project.memory.current_status || 'Todo en orden.'}

OBJETIVOS Y TRAMAS ACTIVAS:
${(project.memory.quests || []).map(q => `- [${q.type}] ${q.title}: ${q.objective} (Progreso: ${q.progress})`).join('\n') || 'Sin tramas activas.'}

PERSONAJES IMPORTANTES (NPCS):
${(project.memory.npcs || []).map(n => `- ${n.name} (${n.relation}): ${n.notes}`).join('\n') || 'Sin PNJs registrados.'}

VÍNCULOS CON EL PROTAGONISTA (solo los personajes que ya son habituales):
${
  (project.memory.npcs || []).filter(n => n.recurrente).length
    ? (project.memory.npcs || [])
        .filter(n => n.recurrente)
        .map(
          n =>
            `- ${n.name}${n.vinculo ? ` [${n.vinculo}]` : ''}\n    Deja ver: ${n.aparenta || 'sin registrar'}\n    Se guarda: ${n.oculta || 'sin registrar'}`
        )
        .join('\n')
    : 'Todavía ninguno. Ningún personaje ha vuelto suficientes veces.'
}

LUGARES CLAVE:
${(project.memory.locations || []).map(l => `- ${l.name}: ${l.desc}`).join('\n') || 'Sin lugares clave.'}

REGISTRO VISUAL Y MAPAS EN MEMORIA:
${visualMemoryText || (visualFilesText ? 'Registrados en la base de archivos visuales.' : 'Sin registros visuales.')}

NOTAS DIRECTAS DEL MAESTRO:
${project.memory.manual_notes || 'Sin notas adicionales.'}

RESUMEN DE SESIONES ANTERIORES:
${allPreviousHistory.length > 0 ? allPreviousHistory : 'No hay sesiones previas.'}
  `.trim()
    : 'No hay memoria acumulada aún.';

  // TODOS los documentos de texto subidos a la campaña se envían íntegros y completos.
  // Sin filtros, sin RAG, sin recortes artificiales: Gemini tiene ventana de contexto masiva.
  const todosLosDocumentos = files.filter(f => !f.isImage && !f.isAudio);

  const filesText = todosLosDocumentos.length > 0
    ? todosLosDocumentos
        .map(f => {
          let texto = `=== DOCUMENTO: ${f.name} ===\n${f.content || ''}`;
          if (f.analysis && f.analysis.trim().length > 0) {
            texto += `\n[Notas / Análisis adjunto de ${f.name}]:\n${f.analysis.trim()}`;
          }
          return texto;
        })
        .join('\n\n')
    : 'No hay documentos de texto adicionales adjuntos.';

  // Protagonist / Character Sheet Section
  const pc = project.memory?.player_character;
  const pjSheetFiles = files.filter(
    f =>
      !f.isImage &&
      !f.isAudio &&
      (f.category === 'sheet_pj' ||
        f.name.toLowerCase().includes('ficha') ||
        f.name.toLowerCase().includes('personaje') ||
        f.name.toLowerCase().includes('character') ||
        f.name.toLowerCase().includes('sheet') ||
        f.name.toLowerCase().includes('protagonista') ||
        f.name.toLowerCase().includes('pj') ||
        f.name.toLowerCase().includes('oc'))
  );

  const pjSection = `
### 🌟 PROTAGONISTA / PERSONAJE JUGADOR (OC - PROTAGONISTA PRINCIPAL)
[JERARQUÍA CANÓNICA SUPREMA]:
La ficha del protagonista y la memoria están vivas y vinculadas directamente al roleplay del chat.
**EL ROLEPLAY DEL CHAT MANDA SOBRE LAS FICHAS SUBIDAS AL INICIO A LOS ARCHIVOS.**
Las fichas y documentos iniciales representan el punto de partida o trasfondo, pero cualquier cambio acontecido en la partida (PG actuales, curación, daño, fatiga, condiciones, equipo gastado o adquirido, oro, deudas, juramentos y vínculos) es la verdad canónica viva y prevalece sobre cualquier texto estático previo.

${
  pc
    ? `
- NOMBRE DEL PROTAGONISTA: ${pc.name}
${pc.race ? `- RAZA / ESPECIE: ${pc.race}` : ''}
${pc.class ? `- CLASE Y NIVEL: ${pc.class} ${pc.level || ''}` : ''}
${pc.appearance ? `- APARIENCIA FÍSICA: ${pc.appearance}` : ''}
${pc.personality ? `- PERSONALIDAD Y COMPORTAMIENTO: ${pc.personality}` : ''}
${pc.backstory ? `- TRASFONDO E HISTORIA: ${pc.backstory}` : ''}
${pc.notes ? `- HABILIDADES / NOTAS: ${pc.notes}` : ''}
${pc.inventory && pc.inventory.length > 0 ? `- INVENTARIO ACTUAL:\n${pc.inventory.map(i => `  * ${i.name} (x${i.quantity || 1})${i.equipped ? ' [Equipado]' : ''}${i.attuned ? ' [Sintonizado]' : ''}${i.damageOrAc ? ` [${i.damageOrAc}]` : ''}${i.durationNote ? ` [⏳ ${i.durationNote}]` : ''}${i.description ? `: ${i.description}` : ''}`).join('\n')}` : '- INVENTARIO ACTUAL: Mochila vacía.'}
${pc.currencies ? `- MONEDAS ACTUALES: ${pc.currencies.gp || 0} PO (oro), ${pc.currencies.sp || 0} PP (plata), ${pc.currencies.cp || 0} PC (cobre), ${pc.currencies.ep || 0} PE (electro), ${pc.currencies.pp || 0} PT (platino)` : ''}
${pc.sheetText ? `\n--- RESUMEN DE HOJA DE PERSONAJE ---\n${pc.sheetText}` : ''}
`
    : 'El protagonista (OC) del jugador está detallado en los documentos y fichas adjuntas.'
}

${
  pjSheetFiles.length > 0
    ? `DOCUMENTOS Y FICHAS ESPECÍFICAS DEL PROTAGONISTA (TEXTO ÍNTEGRO):\n` +
      pjSheetFiles.map(f => `=== FICHA / TRASFONDO: ${f.name} ===\n${f.content || ''}`).join('\n\n')
    : ''
}
`.trim();

  const activeInstructions =
    project.instructions && project.instructions.trim().length > 10
      ? project.instructions
      : DEFAULT_DM_INSTRUCTIONS;
  const activeSystem = project.system && project.system.trim().length > 5 ? project.system : DEFAULT_SYSTEM;
  const activeStyle = project.style && project.style.trim().length > 5 ? project.style : DEFAULT_STYLE;

  // El tiempo de la campaña. Si no hay calendario configurado, todo este bloque
  // desaparece del prompt: quien no lleve la cuenta de los días no debería pagar
  // tokens por un apartado vacío ni recibir instrucciones que no puede cumplir.
  const cal = project.calendar;
  const fecha = project.currentDate;
  const llevaTiempo = calendarioValido(cal) && Boolean(fecha);

  let calendarioSection = '';
  let tiempoDirectiva = '';

  if (llevaTiempo && cal && fecha) {
    const hoyAbs = aDiaAbsoluto(cal, fecha);
    const vencen = hilosQueVencen(project.threads || [], hoyAbs);
    const enMarcha = hilosPendientes(project.threads || []).filter(h => h.dueAbsDay > hoyAbs);
    const diario = (project.timeline || []).slice(-8);

    calendarioSection = `
### CALENDARIO Y PASO DEL TIEMPO
Calendario en uso: ${cal.name} (${diasPorAno(cal)} días por año).
AHORA MISMO SON: ${fechaCompleta(cal, fecha)}.
Ten presente la hora al describir la luz, quién está despierto, qué está abierto y qué no.

${
  vencen.length
    ? `SUCESOS PROGRAMADOS QUE VENCEN AHORA — OBLIGATORIO integrarlos en esta escena. Hazlos ocurrir de forma natural dentro del relato, sin anunciarlos como mecánica y sin explicar que estaban programados:
${vencen.map(h => `- ${h.title}: ${h.effect}`).join('\n')}`
    : 'No hay sucesos programados que venzan ahora.'
}

${
  enMarcha.length
    ? `Hilos en marcha, aún sin vencer (los conoces tú, no necesariamente el jugador). No los adelantes, pero deja caer indicios coherentes si la escena lo permite:
${enMarcha
  .map(
    h =>
      `- ${h.title} → ${h.dueDate} (${distanciaEnDias(h.dueAbsDay - hoyAbs)})${h.hidden ? ' [oculto al jugador]' : ''}`
  )
  .join('\n')}`
    : ''
}

${diario.length ? `ÚLTIMOS DÍAS REGISTRADOS EN LA AGENDA:\n${diario.map(d => `- ${d.date}${d.lugar ? ` · ${d.lugar}` : ''}${d.clima ? ` · ${d.clima}` : ''}: ${d.summary}${d.hito ? ` [${d.hito}]` : ''}`).join('\n')}` : ''}
`.trim();

    tiempoDirectiva = `   [TIEMPO: +Xh] — cuánto tiempo de campaña ha consumido esta escena. Usa d para días, h para horas y m para minutos; puedes combinarlos: [TIEMPO: +1d 6h], [TIEMPO: +2d], [TIEMPO: +1 semana].
    Referencia: una conversación, de 5 a 20 minutos. Un asalto de combate, 6 segundos (un combate entero rara vez pasa de 5 minutos). Cruzar una ciudad a pie, una hora. Una jornada de viaje por camino, un día. Un descanso corto, una hora [TIEMPO: +1h]. Un descanso largo o dormir hasta el alba, ocho horas [TIEMPO: +8h]. Registrar, negociar o investigar a fondo, de una a tres horas.
    Si el jugador declara que descansa, viaja o espera, calcula el tiempo que eso costaría de verdad.
    [REGLA DE ORO DEL DIARIO / AGENDA — PROHIBIDO EN RESPUESTAS ORDINARIAS]:
    - EL DIARIO NO SE ACTUALIZA EN CADA RESPUESTA NI EN CADA TURNO DE COMBATE O CONVERSACIÓN.
    - Durante acciones normales (asaltos de combate, diálogos, exploración, tiradas de dados), JAMÁS incluyas la etiqueta [AGENDA: ...]. El reloj [TIEMPO: +Xm] sí avanza normalmente, pero el diario NO se escribe en cada turno.
    - ÚNICOS MOMENTOS PERMITIDOS PARA EMITIR [AGENDA: ...]:
      1. DESCANSO CORTO (máximo 2 al día, ~1 hora de pausa): Cuando los aventureros declaren formalmente una pausa o descanso corto (recuperar aliento, curar heridas con dados de golpe, afilar armas). En ese único turno emites UNA sola entrada [AGENDA: ...] resumiendo lo vivido en ese tramo de la jornada:
         Ejemplo: [AGENDA: Tras el combate en las ruinas, nos resguardamos bajo el arco para vendar heridas y recuperar el aliento | lugar: Ruinas del Torreón | hito: descanso — Descanso corto]
      2. DESCANSO LARGO (fin del día, 8 horas / acampar o dormir hasta el alba): Cuando acampen, duerman o concluyan la jornada completa. En ese único turno emites UNA sola entrada [AGENDA: ...] consolidando los hechos más memorables de todo el día y el descanso:
         Ejemplo: [AGENDA: Montamos el campamento junto al arroyo; repasé el mapa a la luz de las brasas antes de caer rendido | lugar: Campamento del Arroyo | hito: descanso — Descanso largo]
      3. SALTO TEMPORAL NARRATIVO O INCONSCIENCIA: Si por trama transcurren días enteros de convalecencia médica, coma o viaje largo.

    [SALTOS TEMPORALES Y PREGONEROS — GENERACIÓN AUTÓNOMA Y DISPARO EXCLUSIVO POR NARRATIVA]:
    - Los saltos temporales y las noticias de pregoneros/rumores los generas tú como Narrador de forma totalmente autónoma. JAMÁS preguntes al jugador fuera de personaje si desea hacer un salto temporal ni pidas permiso para narrar o generar noticias de pregoneros. El jugador no tiene que 'generar' nada manualmente.
    - REGLA DE ORO DE DISPARO: SOLO aplica el salto temporal y las noticias de pregoneros si en la narrativa misma ha salido de forma justificada (por ejemplo: «has estado inconsciente 3 días en la enfermería y el OC ha investigado o descubierto qué ha pasado esos días», o durante una convalecencia médica o viaje largo). Si en la escena no ha habido tal periodo en la ficción, el tiempo avanza normalmente minuto a minuto o escena a escena.
    - Si el protagonista cae inconsciente, en coma o pasa días de convalecencia/recuperación médica/prisión (p. ej., 2 días, 3 días, 1 semana), usa [TIEMPO: +3d], [TIEMPO: +1 semana] o el tiempo exacto.
    Si no estás seguro de cuánto ha pasado, escribe [TIEMPO: +0m]: es preferible un reloj parado, que se corrige en dos clics, a uno que corre solo y descuadra la campaña.
    [AGENDA: qué ha pasado hoy, EN PRIMERA PERSONA, con la voz del protagonista | lugar: dónde transcurre | clima: qué tiempo hace | hito: tipo — qué ha ocurrido | dia: +X] — SOLO emitida al tomar un descanso corto o descanso largo/dormir.
      Esto es el cuaderno del protagonista, no un parte de incidencias: escribe como escribiría quien lo vivió, en primera persona y en pasado, en una o dos frases y con sitio para una impresión suya. No «Compartió el turno de guardia con el capitán», sino «Compartí guardia con Kieron. No dijo gran cosa, pero me tendió el odre sin que se lo pidiera». El campo «hito» va también en su voz.
      El resumen es obligatorio; los demás campos son opcionales y van por nombre, así que puedes saltarte los que no vengan a cuento.
      «lugar» es el sitio concreto: «la bodega del Marea de Alba», «el mercado bajo de Aguasprofundas».
      «clima» en dos o tres palabras: «niebla densa», «sol de justicia», «llovizna fría». Sé coherente de un día para otro y con la estación.
      «hito» solo cuando el día haya dejado huella, y empezando por su tipo seguido de un guion:
        - Relaciones entre personajes: «hito: rivalidad — ...» (⚔️), «hito: amistad — ...» (❇️), «hito: romance — ...» (💘 interés romántico, insinuación o declaración sexual/emocional), «hito: enemistad — ...» (💀), «hito: alianza — ...» (🤝), «hito: mentor — ...» (🛡️).
        - Descansos y recuperación: «hito: descanso — Descanso corto / largo y recuperación...» (⛺).
        - Relojes y consecuencias del mundo: «hito: reloj activo — ...» (⏳), «hito: semilla — ...» (🌱), «hito: consecuencia gremio — ...» (💥), «hito: consecuencia familia — ...» (💥), «hito: consecuencia zona — ...» (💥).
        - Sucesos clave: «hito: combate — ...», «hito: hallazgo — ...», «hito: revelación — ...», «hito: viaje — ...», «hito: herida — ...», «hito: muerte — ...», «hito: inconsciencia — ...», «hito: noticia — ...», «hito: rumor — ...».
      [RELOJES ACTIVOS, SEMILLAS Y EVENTOS DEL MUNDO (HACE 1 SEMANA, 15 DÍAS O 1 MES)]:
      - Utiliza el diario y los hilos como un tapiz vivo de causa y efecto. Cuando un evento mundial ocurrió hace una semana, 15 días o un mes (o cuando una semilla del pasado comience a dar frutos), muestra sus consecuencias activas o pasivas:
        1. Sobre el OC / Protagonista (reputación, deudas, oportunidades, amenazas).
        2. Sobre su gremio, hermandad, orden, banda o facción (presiones, encargos, bajas, alianzas).
        3. Sobre su familia, linaje, hogar o seres queridos (cartas, tensiones, cambios de estatus).
        4. Sobre la zona o región donde se encuentra ahora (escasez de suministros, patrullas alertas, toque de queda, precios inflados, rumores tensos en tabernas, facciones hostiles).
      [SALTOS TEMPORALES, INCONSCIENCIA Y NOTICIAS DEL MUNDO]:
      - Si hay un salto temporal en la narrativa (por inconsciencia de 3 días, coma o recuperación), registra de forma autónoma:
        1. Convalecencia: [AGENDA: Desperté dolorido tras tres días en cama | lugar: Enfermería | hito: inconsciencia — Recuperación tras el combate].
        2. Noticias del mundo ocurridas durante ese tiempo: [AGENDA: Se rumorea en las plazas que el gremio rival tomó el muelle oeste | dia: +1 | hito: consecuencia zona — Tensión comercial en los muelles | lugar: Taberna del Ancla].
      [REGLA DE FECHA — IMPORTANTE]: la aplicación fecha esta entrada con el día EN CURSO al empezar la escena, antes de aplicar el [TIEMPO] de este mismo turno.
    [HILO: título | vence en 15d | qué ocurrirá cuando llegue ese día | oculto] — cuando en la ficción quede un reloj activo en marcha con fecha (vence en 7d, 15d, 30d). Regístralos con generosidad para reflejar:
      a) Relojes del mundo y consecuencias que maduran (una investigación enemiga que cerca al gremio, una cosecha que fracasa en la comarca, refuerzos que llegan a la fortaleza, una represalia familiar).
      b) Promesas y planes del protagonista (plazos dados por prestamistas, juramentos, citas fijadas con PNJs).
`;
  }

  // La tanda de dados llega desde fuera: una nueva por turno al narrar, y una
  // cualquiera al medir tokens, donde los números concretos dan igual. Va al
  // final, con lo volátil, para no romper el caché del prefijo estable.

  // El orden importa por dinero y por atención. Gemini cachea automáticamente
  // el prefijo común entre peticiones, y ese prefijo se rompe en el primer
  // carácter que cambia: por eso va primero todo lo estable (directivas,
  // sistema, estilo, ficha y documentos) y al final lo que cambia cada turno
  // (memoria viva), pegado a la escena. Además los modelos atienden mejor al
  // principio y al final que al medio.
  const sys = `${CORE_INTERFACE_PROTOCOLS}

### INSTRUCCIONES DE CAMPAÑA (IDENTIDAD Y DIRECTIVAS MAESTRAS DEL NARRADOR)
${activeInstructions}

### SISTEMA DE JUEGO Y MECÁNICAS
${activeSystem}

### ESTILO NARRATIVO (VOZ Y RITMO NOVELESCO)
${activeStyle}

${pjSection}

### BASE DE CONOCIMIENTO (DOCUMENTOS, FICHAS Y MATERIAL ADJUNTO)
Los siguientes archivos forman parte del canon íntegro del mundo y debes utilizarlos como fuente de verdad sobre PNJs, lugares, eventos pasados, reglas, oráculos y ambientación:
${filesText || 'No hay documentos de texto adicionales adjuntos.'}

${visualFilesText ? `### CONOCIMIENTO VISUAL Y MAPAS DE LA CAMPAÑA (INSPECCIÓN VISUAL)\n${visualFilesText}\n` : ''}

### CONOCIMIENTO DE LA CAMPAÑA (MEMORIA VIVA)
${memoryContext}

${calendarioSection}

### DADOS YA TIRADOS PARA ESTE TURNO (USO EXCLUSIVO DEL DIRECTOR DE JUEGO)
Estos números están tirados de verdad, no los inventes tú. Son ÚNICAMENTE para tus
propias tiradas ocultas: sigilo de un enemigo, iniciativa de los PNJs, daño, tablas
aleatorias, intenciones que el jugador no debe conocer.
PROHIBIDO usarlos para resolver una acción del protagonista: esas tiradas las tira
el jugador y solo él. Úsalos EN ORDEN y descarta los que no gastes.
- d20: ${dicePool.d20.join(', ')}
- d100: ${dicePool.d100.join(', ')}
- d6: ${dicePool.d6.join(', ')}

[DIRECTIVAS DE RESPUESTA CRÍTICAS]:
0. [BLINDAJE DE TONO, CERO MORALISMOS Y FIDELIDAD AL LORE CANÓNICO (MARCO ADULTO / GRIMDARK)]:
   - **Fidelidad al Lore y Ambientación Oscura**: Este es un entorno de rol de fantasía oscura y cruda. Las culturas ficticias y facciones canónicas (como los drow de Menzoberranzan, sectas, tiranos, corsarios de Luskan, asesinos y monstruos de la Infraoscuridad) DEBEN representarse con toda su crueldad, jerarquía despiadada, astucia y malicia canónicas, sin censura, sin suavizaciones y sin reinterpretaciones contemporáneas.
   - **Cero Sermones y Cero Advertencias Éticas**: Trata al usuario como a un jugador adulto en una mesa de rol tradicional. Queda TERMINANTEMENTE PROHIBIDO emitir sermones morales, advertencias éticas fuera de personaje (OOC), disculpas condescendientes ("recuerda que...", "es importante destacar...") o coletillas moralizantes. La ficción es ficción.
   - **Tono Narrativo Visceral y Directo**: Describe el combate táctico, los impactos, las heridas, la magia y las amenazas físicas y psicológicas de forma visceral, directa y evocadora, con peso y consecuencias reales.
1. [PROTAGONISMO DEL JUGADOR]: La aventura gira estrictamente en torno a este protagonista (${pc?.name || 'el personaje del jugador'}). Al iniciar la escena, sitúa directamente al protagonista en primer plano, describiendo su presencia física, entorno inmediato, sensaciones sensoriales y el contexto según su trasfondo y ficha. Nunca comiences de forma genérica o neutral ignorando su identidad y habilidades.
2. [FORMATO EDITORIAL, SALTOS DE PÁRRAFO Y RESPIRACIÓN DE LA PROSA - OBLIGATORIO]:
   Escribe con una maquetación limpia y agradable de leer:
   - Prosa Narrativa 100% Inmersiva: Queda TERMINANTEMENTE PROHIBIDO imprimir cabeceras o bloques de estadísticas en texto plano dentro del relato (como 📅 Fecha, 👤 Nivel, 🌟 Hito, ⚜️ Renombre o 🖤 PNJ ATR). Todos los datos del personaje y del mundo se consultan en el HUD y se actualizan silenciosamente mediante las etiquetas entre corchetes al final del mensaje.
   - Separa SIEMPRE cada párrafo con un salto doble de línea (\n\n) para evitar bloques densos o apelmazados de texto.
   - Limita los párrafos narrativos a 3-5 oraciones como máximo.
   - Cada intervención de diálogo o cambio de interlocutor DEBE ir en su propio párrafo independiente con sangría o guion de diálogo (— Diálogo...).
   - Deja que la prosa respire con cadencia novelesca. Queda TERMINANTEMENTE PROHIBIDO volcar parrafadas kilométricas continuas sin espacios.
3. Consulta la MEMORIA VIVA y la BASE DE CONOCIMIENTO antes de escribir para no contradecir hechos pasados ni inventar datos si ya existen.
   [QUÉ HACER CUANDO NO SABES ALGO]: sabes mucho de ambientaciones publicadas, pero ESTA campaña no es ninguna de ellas: es la que está en estos documentos y en esta memoria. Ante un dato que no tengas, distingue tres casos.
   - Si lo que ibas a decir podría contradecir el material de la jugadora, no lo digas. Rodéalo: describe lo que el protagonista percibe sin afirmar el dato, o deja que el personaje que lo sabría no lo suelte todavía.
   - Si es un hueco sin dueño —el nombre del tabernero, el olor de una calle, la manía de un guardia—, invéntalo sin pedir permiso, pequeño y coherente con lo ya establecido. Eso es tu oficio, y una vez dicho pasa a ser canon: respétalo a partir de entonces.
   - Si el dato es estructural y no lo tienes —quién gobierna, qué ocurrió en una fecha, cómo funciona una institución de la que depende la trama—, NO lo rellenes con lo que recuerdes de libros publicados ni con una invención cómoda. Pregúntaselo a la jugadora en una línea, fuera de la escena, o haz que el protagonista sencillamente no lo sepa todavía. Un hueco reconocido se arregla en un mensaje; un dato inventado que se da por bueno contamina la campaña entera y no hay forma de saber cuándo empezó.
   Nunca presentes como cierto algo de una ambientación publicada si no está en el material de la campaña: puede que en este mundo no sea así.
3. Si la Memoria indica que un personaje está herido, cansado o en una situación específica, refléjalo en la narrativa.
4. Si el jugador menciona o enlaza una canción o video (YouTube / Spotify), utiliza el contenido de la letra/música para enriquecer la escena.
5. [TIRADAS Y SALVACIONES DEL PROTAGONISTA EN EL ROLEO - OBLIGATORIO]:
   Las tiradas de habilidad y las **Tiradas de Salvación corren dentro del roleo**. Cuando una acción tenga resultado incierto (atacar, trepar, mentir/engañar/ocultar información a un PNJ perspicaz, forzar, registrar) o cuando el personaje enfrente un peligro súbito, trampa, veneno, derrumbe o hechizo que exija resistencia, NO decidas tú el resultado ni lo narres de antemano. Describe el momento hasta el instante justo anterior al impacto o desenlace, detente ahí y pide la tirada o salvación en una línea propia con este formato exacto:
   [Petición de Tirada: Habilidad o Salvación de Característica | CD número]
   (Ejemplos: [Petición de Tirada: Engaño | CD 15], [Petición de Tirada: Perspicacia | CD 14], [Petición de Tirada: Salvación de Destreza | CD 14], [Petición de Tirada: Salvación de Constitución | CD 15], [Petición de Tirada: Atletismo | CD 12]).
   - **Tiradas Sociales Obligatorias (Engaño vs Perspicacia):** Si el jugador miente, disimula, inventa una excusa, cuenta una verdad a medias o intenta ocultar algo a un PNJ perspicaz o astuto (como Jarlaxle o espías), DEBES solicitar la tirada de Engaño al jugador ([Petición de Tirada: Engaño | CD XX]) o realizar la tirada de Perspicacia del PNJ de forma visible usando tus dados. Queda PROHIBIDO que el PNJ se crea la mentira de forma automática sin tirada.
   Puedes pedir varias en el mismo turno si la situación lo requiere. Después de pedirla, **no sigas narrando**: espera a que el jugador te dé el resultado en su siguiente mensaje y resuélvelo entonces. No inventes su resultado, no supongas que ha tenido éxito ni que ha fallado, y no uses los dados de la sección anterior para él.
   Caso obligatorio: cuando estalle un combate o una emboscada, describe el detonante y pide la iniciativa antes de narrar el primer intercambio de golpes → [Petición de Tirada: Iniciativa]. No resuelvas tú el primer asalto.
   El jugador te responderá con el dado en bruto, así: [Tirada de Percepción: d20 natural = 12 | CD 15] o [Tirada de Salvación de Constitución: d20 natural = 14 | CD 15]. Ese número es el dado SIN modificar: aplícale tú el modificador y competencia que corresponda según la ficha viva del protagonista, di en voz alta la suma resultante y compárala con la CD antes de narrar el desenlace. Un 1 natural y un 20 natural son pifia y crítico.
6. Si has pedido una tirada, la narración acaba en la petición: no añadas < ¿Qué haces? > ni sigas la escena (los registros internos del punto 7 sí van siempre, al final del todo). Si NO has pedido ninguna tirada, termina con < ¿Qué haces? > sin proponer opciones, para dar libertad total al jugador.
7. [REGISTROS INTERNOS - OBLIGATORIOS]: después de la narración, y en este orden, añade las siguientes líneas. Son registros de la aplicación: no los comentes, no los expliques y no los menciones dentro del relato. El jugador no los ve.
   [PRESENTES: nombres separados por comas] — quién ha estado en escena de forma reconocible, con nombre propio. No incluyas figurantes sin nombre («un marinero», «la multitud»). Sirve para saber quién vuelve: alguien que reaparece deja de ser un extra y se le abre una ficha de vínculo con el protagonista.
   [VÍNCULO: nombre | aparenta: cómo trata al protagonista y qué deja ver | oculta: lo que de verdad piensa y no dice | grado: tipo — descripción] — SOLO para los personajes que la aplicación ya te ha listado arriba como habituales, y solo cuando la escena haya movido algo entre ellos o se inicie un nuevo vínculo. No lo repitas cada turno si nada ha cambiado.
     «aparenta» es lo que el protagonista podría percibir observándolo. «oculta» es lo que hay debajo: sus reservas, sus intenciones, lo que calla.
     «grado» debe comenzar indicando el tipo para que la interfaz muestre el icono adecuado:
       - ⚔️ Rivalidad: «grado: rivalidad — ...»
       - ❇️ Amistad: «grado: amistad — ...»
       - 💘 Interés Romántico / Romance: «grado: romance — ...» (atracción, flirteo, insinuación o declaración sentimental/sexual)
       - 💀 Enemistad: «grado: enemistad — ...»
       - 🤝 Alianza: «grado: alianza — ...»
       - 🛡️ Mentor: «grado: mentor — ...»
   [INVENTARIO: +X Nombre (detalles opcionales), -Y Nombre, +Z PO, -W PO, +A PP, -B PC] — OBLIGATORIO siempre que el protagonista gane, compre, reciba de un PNJ, encuentre, invoque, gaste, pierda o consuma objetos o dinero durante la escena (ejemplos: si invoca 10 Buenas Bayas: [INVENTARIO: +10 Buenas Bayas (duran 24h)], si come 3 de 10: [INVENTARIO: -3 Buenas Bayas], si gasta 15 de oro en una tienda: [INVENTARIO: +Disfraz noble, -15 PO], si Jarlaxle le entrega una Máscara de Disfraz: [INVENTARIO: +1 Máscara de Disfraz (mágica, equipada)], si pierde la máscara: [INVENTARIO: -1 Máscara de Disfraz]). Si no ha habido alteración de inventario ni monedas, omite esta línea.
${tiempoDirectiva}   [ESTADO: PG actuales/máximos | CA valor | condiciones: lista separada por comas, o "ninguna"]
   Refleja en él el daño recibido, la curación, el agotamiento, el veneno, las heridas y cualquier efecto persistente que hayas narrado. Si nada ha cambiado, repite los valores anteriores. Va SIEMPRE en último lugar.
   Estado actual conocido: PG ${pc?.hp ?? '?'}/${pc?.maxHp ?? '?'}, CA ${pc?.ac ?? '?'}${pc?.conditions?.length ? `, condiciones: ${pc.conditions.join(', ')}` : ''}.`;

  // Filter out initial placeholders
  const historyCompleto = currentChat.messages.filter(
    m => m.content !== 'Tirando dados...' && m.content !== 'Pensando...'
  );

  // Solo la parte reciente del capítulo viaja literal. Lo anterior ya está
  // recogido en la Memoria Viva y en la crónica, así que mandarlo otra vez era
  // pagar dos veces por lo mismo y alargar cada petición sin ganar nada.
  const ESCENA_MAX = 20000;
  const MENSAJES_MINIMOS = 8;
  let usados = 0;
  let desde = historyCompleto.length;
  while (desde > 0) {
    const coste = (historyCompleto[desde - 1].content || '').length;
    const yaIncluidos = historyCompleto.length - desde;
    if (usados + coste > ESCENA_MAX && yaIncluidos >= MENSAJES_MINIMOS) break;
    usados += coste;
    desde--;
  }
  const history = historyCompleto.slice(desde);

  const contents: any[] = [];
  let lastRole = '';
  if (desde > 0) {
    contents.push({
      role: 'user',
      parts: [
        {
          text: `[Nota del sistema: los ${desde} mensajes anteriores de este capítulo no se incluyen literalmente. Lo ocurrido está recogido en la MEMORIA VIVA y en la CRÓNICA de más arriba. Continúa desde ahí con naturalidad, sin pedir que se repitan.]`
        }
      ]
    });
    lastRole = 'user';
  }
  for (const m of history) {
    const r = m.role;
    if (r === lastRole) {
      contents[contents.length - 1].parts.push({ text: '\n\n' + m.content });
    } else {
      contents.push({ role: r, parts: [{ text: m.content }] });
      lastRole = r;
    }
  }

  if (lastRole === 'user') {
    contents[contents.length - 1].parts.push({ text: '\n\n' + userText });
  } else {
    contents.push({ role: 'user', parts: [{ text: userText }] });
  }

  return { sys, contents };
}

export async function generateStoryTurnStream({
  project,
  currentChatId,
  chats,
  files,
  userText,
  onChunk,
  signal,
  onStateReported,
  onTimeReported,
  onInventoryReported,
  setLoadingText,
  onSaveMessage
}: {
  project: Project;
  currentChatId: string;
  chats: Chat[];
  files: ProjectFile[];
  userText: string;
  onChunk: (fullText: string) => void;
  /** Permite cortar la generación desde la interfaz sin perder lo ya escrito. */
  signal?: AbortSignal;
  /** El Narrador informa del estado del protagonista al cerrar su turno. */
  onStateReported?: (state: { hp?: number; maxHp?: number; ac?: number; conditions?: string[] }) => void;
  /** El Narrador informa de cuánto tiempo ha pasado y de qué queda en marcha. */
  onTimeReported?: (t: TiempoReportado) => void;
  /** El Narrador informa de cambios en el inventario o monedas del protagonista. */
  onInventoryReported?: (invReport: InventoryChangeReport) => void;
  setLoadingText: (text: string) => void;
  onSaveMessage?: (updatedChat: Chat) => Promise<void> | void;
}) {
  const currentChat = chats.find(c => c.id === currentChatId);
  if (!currentChat) throw new Error('Sesión no encontrada.');

  const { keys: apiKeys, totalKeys } = getRotatedApiKeys();
  if (apiKeys.length === 0) {
    throw new Error(
      'La clave de API de Gemini no está configurada.\n\nPulsa el botón "Motor" de la barra superior e introduce tu clave de Google AI Studio.'
    );
  }

  const baseModel = getStoredModel();
  const failoverChain = getModelFailoverChain(baseModel);

  let success = false;
  let fullText = '';
  let lastError: any = null;

  for (let keyIndex = 0; keyIndex < apiKeys.length && !success; keyIndex++) {
    const currentApiKey = apiKeys[keyIndex];
    const ai = getAIClient(currentApiKey);
    const storedKeys = getStoredApiKeys();
    const origKeyIdx = storedKeys.indexOf(currentApiKey);
    const keyNumDisplay = origKeyIdx >= 0 ? origKeyIdx + 1 : keyIndex + 1;
    const keyLabel = totalKeys > 1 ? ` (Clave ${keyNumDisplay}/${totalKeys})` : '';

    for (let modelIndex = 0; modelIndex < failoverChain.length && !success; modelIndex++) {
      const currentModel = failoverChain[modelIndex];
      const isFallback = modelIndex > 0;
      const modelDisplayName = AVAILABLE_MODELS.find(m => m.id === currentModel)?.name || currentModel;

      // Retry once for the base model or fallbacks if transient
      const maxRetriesForModel = isFallback ? 1 : 2;

      for (let retry = 0; retry < maxRetriesForModel && !success; retry++) {
        fullText = '';
        try {
          if (isFallback) {
            setLoadingText(
              `Google saturado en el modelo anterior. Continuando narración con ${modelDisplayName}${keyLabel}...`
            );
          } else if (retry > 0) {
            setLoadingText(`Reintentando conexión con ${modelDisplayName} (${retry + 1}/${maxRetriesForModel})${keyLabel}...`);
          } else {
            setLoadingText(`El Narrador está hilvanando los hilos del destino${keyLabel}...`);
          }

          const { sys, contents } = buildTurnPayload({
            project,
            currentChatId,
            chats,
            files,
            userText,
            dicePool: rollDicePool()
          });

          const thinkingSetting = getStoredThinkingLevel();
          const safetySetting = getStoredSafetyLevel();
          const tempSetting = getStoredTemperature();
          const topPSetting = getStoredTopP();

          const abierto = esModeloAbierto(currentModel);
          const config: any = {
            systemInstruction: sys,
            temperature: tempSetting,
            topP: topPSetting,
            ...(abierto ? {} : { safetySettings: buildSafetySettings(safetySetting) })
          };

          const thinkingBudget = getThinkingBudgetConfig(thinkingSetting);
          if (thinkingBudget && !abierto) {
            config.thinkingConfig = thinkingBudget;
          }

          const responseStream = await ai.models.generateContentStream({
            model: currentModel,
            contents,
            config: { ...config, abortSignal: signal }
          });

          let lastSaveTime = Date.now();
          let uso: any = null;

          for await (const chunk of responseStream) {
            if (signal?.aborted) break;
            fullText += chunk.text ?? '';
            if ((chunk as any).usageMetadata) uso = (chunk as any).usageMetadata;
            onChunk(fullText);

            // Throttle writes during streaming to 1.5s to prevent quota burnout
            const now = Date.now();
            if (now - lastSaveTime > 1500) {
              lastSaveTime = now;
              await saveStreamedMessage(currentChat, fullText, onSaveMessage, onStateReported, undefined, onInventoryReported);
            }
          }

          if (uso) {
            const huboBusqueda =
              getStoredBusquedaLocal() &&
              files.some(f => !f.isImage && !f.isAudio && f.onDemand && f.category !== 'oracle');
            registrarUso(
              currentModel,
              {
                entrada: uso.promptTokenCount,
                cacheados: uso.cachedContentTokenCount,
                salida: uso.candidatesTokenCount ?? uso.responseTokenCount,
                total: uso.totalTokenCount
              },
              huboBusqueda ? `con búsqueda${isFallback ? ' (respaldo)' : ''}` : isFallback ? 'respaldo' : undefined
            );
          }

          // Final complete save
          await saveStreamedMessage(currentChat, fullText, onSaveMessage, onStateReported, onTimeReported, onInventoryReported, true);
          success = true;
          break; // Exit retry loop on success
        } catch (e: any) {
          if (signal?.aborted || e?.name === 'AbortError') {
            success = true;
            return;
          }
          lastError = e;
          console.warn(`Error en modelo ${currentModel} (clave ${keyNumDisplay}, intento ${retry + 1}):`, e);

          const msg = String(e?.message || '');
          const streamCortado =
            /incomplete json|unexpected end|network|failed to fetch|load failed|terminated|aborted/i.test(msg);

          if (streamCortado && fullText.trim().length > 40) {
            await saveStreamedMessage(
              currentChat,
              `${fullText.trim()}\n\n*(La conexión se cortó aquí. Pulsa «Continuar Narración» para retomar la escena.)*`,
              onSaveMessage,
              onStateReported,
              onTimeReported,
              onInventoryReported,
              true
            );
            success = true;
            return;
          }

          const isRateLimit = /429|RESOURCE_EXHAUSTED/i.test(msg);
          const isOverloaded = /503|UNAVAILABLE|overloaded|alta demanda|try again later/i.test(msg);
          const isTransient = isRateLimit || isOverloaded || streamCortado;

          if (isRateLimit) {
            markKeyCooldown(currentApiKey, 60000);
            if (keyIndex < apiKeys.length - 1) {
              setLoadingText(`Límite de cuota en Clave ${keyNumDisplay}. Rotando a la siguiente clave del pool...`);
            }
          }

          if (isTransient) {
            if (retry < maxRetriesForModel - 1) {
              await new Promise(resolve => setTimeout(resolve, 800 * (retry + 1)));
              continue;
            }
            // If we have more fallback models in the chain, advance to next model!
            if (modelIndex < failoverChain.length - 1) {
              const nextModel = failoverChain[modelIndex + 1];
              const nextDisplayName = AVAILABLE_MODELS.find(m => m.id === nextModel)?.name || nextModel;
              setLoadingText(`Servidores de Google saturados en ${modelDisplayName}. Saltando a ${nextDisplayName}...`);
              await new Promise(resolve => setTimeout(resolve, 500));
              break; // Break inner loop to try next model in failoverChain
            }
          } else {
            // Non-transient error or unsupported parameter: try next model if available
            if (modelIndex < failoverChain.length - 1) {
              break;
            }
          }
        }
      }
    }
  } // key loop

  if (!success && lastError) {
    const errorMsg = describeApiError(lastError);
    await saveStreamedMessage(currentChat, errorMsg, onSaveMessage);
    throw lastError;
  }
}

export interface TiempoReportado {
  /** Minutos de campaña consumidos por la escena. */
  minutos: number;
  /** Entradas para la agenda del día. */
  agenda: EntradaDeAgenda[];
  /** Hilos nuevos que el Narrador deja programados. */
  hilos: HiloLeido[];
  /** Quién ha estado en escena, con nombre propio. */
  presentes: string[];
  /** Cómo han cambiado los vínculos de los personajes habituales. */
  vinculos: VinculoLeido[];
}

async function saveStreamedMessage(
  chat: Chat,
  fullText: string,
  onSaveMessage?: (updatedChat: Chat) => Promise<void> | void,
  onStateReported?: (state: { hp?: number; maxHp?: number; ac?: number; conditions?: string[] }) => void,
  onTimeReported?: (t: TiempoReportado) => void,
  onInventoryReported?: (invReport: InventoryChangeReport) => void,
  /**
   * Los guardados intermedios del flujo van con `false`. El estado es idempotente
   * y puede reaplicarse, pero el tiempo se acumula: si se reportara en cada
   * guardado parcial, una sola escena adelantaría el reloj media docena de veces.
   */
  definitivo = false
) {
  let cleanedText = fullText;
  let chatName = chat.name;
  let autoTitled = chat.autoTitled;

  const chapterMatch = fullText.match(/\[CHAPTER:\s*(.*?)\]/);
  if (chapterMatch) {
    chatName = chapterMatch[1];
    autoTitled = true;
    cleanedText = cleanedText.replace(/\[CHAPTER:.*?\]/g, '').trim();
  }

  // Los registros internos son para la app: se extraen y se quitan del texto
  // que lee la jugadora.
  const avance = leerAvanceDeTiempo(cleanedText);
  const agenda = leerAgenda(cleanedText);
  const hilos = leerHilos(cleanedText);
  const presentes = leerPresentes(cleanedText);
  const vinculos = leerVinculos(cleanedText);
  cleanedText = limpiarEtiquetasDePnj(limpiarEtiquetasDeTiempo(cleanedText));
  if (
    definitivo &&
    onTimeReported &&
    (avance.encontrado || agenda.length || hilos.length || presentes.length || vinculos.length)
  ) {
    onTimeReported({ minutos: avance.minutos, agenda, hilos, presentes, vinculos });
  }

  // Parsear y limpiar etiquetas de inventario y monedas
  const { cleaned: cleanedInv, report: invReport } = parseInventoryTags(cleanedText);
  cleanedText = cleanedInv;
  if (definitivo && invReport && onInventoryReported) {
    onInventoryReported(invReport);
  }

  const { cleaned, state } = parseStateTag(cleanedText);
  cleanedText = cleaned;
  if (state && onStateReported) onStateReported(state);

  const newMessages = [...chat.messages];
  if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
    newMessages[newMessages.length - 1].content = cleanedText;
  } else {
    newMessages.push({ role: 'model', content: cleanedText });
  }

  const updatedChat: Chat = {
    ...chat,
    name: chatName,
    autoTitled,
    messages: newMessages
  };

  if (onSaveMessage) {
    try {
      await onSaveMessage(updatedChat);
    } catch (e) {
      console.warn('onSaveMessage callback error:', e);
    }
  }
}

export async function generateContentWithFailover({
  contents,
  config = {},
  primaryModel,
  preferredChain
}: {
  contents: any;
  config?: any;
  primaryModel?: string;
  preferredChain?: string[];
}): Promise<any> {
  const { keys: apiKeys } = getRotatedApiKeys();
  const keysToTry = apiKeys.length > 0 ? apiKeys : [''];
  const base = primaryModel || getBackgroundTaskModel();
  const chain = preferredChain || getModelFailoverChain(base);

  let lastError: any = null;

  for (let k = 0; k < keysToTry.length; k++) {
    const currentKey = keysToTry[k];
    const ai = getAIClient(currentKey || undefined);

    for (let i = 0; i < chain.length; i++) {
      const model = chain[i];
      try {
        const abierto = esModeloAbierto(model);
        const cleanedConfig = {
          ...config,
          ...(abierto
            ? {
                safetySettings: undefined,
                tools: undefined,
                thinkingConfig: undefined,
                responseMimeType: undefined
              }
            : {})
        };

        // Timeout de 35s por modelo para evitar bloqueos infinitos
        const res = await Promise.race([
          ai.models.generateContent({
            model,
            contents,
            config: cleanedConfig
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Tiempo de espera agotado (35s) en modelo ${model}`)),
              35000
            )
          )
        ]);
        return res;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        if (/429|RESOURCE_EXHAUSTED/i.test(msg)) {
          if (currentKey) markKeyCooldown(currentKey, 60000);
        }
        console.warn(`generateContentWithFailover fallo en ${model} (clave ${k + 1}/${keysToTry.length}):`, err);
        if (i < chain.length - 1) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }
  }
  throw lastError || new Error('No se pudo obtener respuesta de ningún modelo.');
}

export async function syncMemoryFromChats(project: Project, chats: Chat[]): Promise<Partial<Memory>> {
  const sortedChats = [...chats].sort((a, b) => a.id.localeCompare(b.id));
  let messageCount = 0;
  let allHistory = '';

  for (const c of sortedChats) {
    const validMessages = (c.messages || []).filter(
      m =>
        m.content &&
        m.content.trim().length > 0 &&
        m.content !== 'Pensando...' &&
        m.content !== 'Tirando dados...'
    );
    if (validMessages.length > 0) {
      allHistory += `\n--- Sesión / Capítulo: ${c.name} ---\n`;
      allHistory += validMessages
        .map(m => `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`)
        .join('\n');
      messageCount += validMessages.length;
    }
  }

  if (messageCount === 0 || !allHistory.trim()) {
    throw new Error(
      'No hay mensajes en la crónica de las sesiones todavía. Juega al menos un turno para que el Narrador pueda analizar y actualizar la memoria.'
    );
  }

  const historyToAnalyze =
    allHistory.length > 400000 ? allHistory.substring(allHistory.length - 400000) : allHistory;

  const pcName = project.memory?.player_character?.name || '';
  const pcNotes = project.memory?.player_character
    ? `Protagonista / Personaje Jugador (OC): "${project.memory.player_character.name}" (${project.memory.player_character.race || ''} ${project.memory.player_character.class || ''})`
    : '';

  // Lo que ya está registrado, con sus identificadores. Sin esto el modelo
  // reinventa cada entrada con otro título en cada sincronización y acabamos
  // con la misma misión duplicada dos y tres veces.
  const listExisting = <T extends { id: string }>(items: T[], describe: (i: T) => string) =>
    items.length ? items.map(i => `- [id: ${i.id}] ${describe(i)}`).join('\n') : '(ninguna todavía)';

  const existingState = `
ESTADO ACTUAL DE LA MEMORIA (lo que YA está registrado):

TRAMAS EXISTENTES:
${listExisting(project.memory?.quests || [], q => `"${q.title}" — objetivo: ${q.objective || 'sin objetivo'} — estado: ${q.status || 'activa'}`)}

PNJS EXISTENTES:
${listExisting(project.memory?.npcs || [], n => `"${n.name}" — ${n.relation || 'sin relación'}`)}

LUGARES EXISTENTES:
${listExisting(project.memory?.locations || [], l => `"${l.name}"`)}
`.trim();

  const prompt = `Analiza el siguiente historial de sesiones de rol y actualiza la memoria viva del proyecto.

${existingState}

REGLA ANTI-DUPLICADOS (LA MÁS IMPORTANTE):
Antes de crear una entrada nueva, comprueba si ya existe arriba. Dos entradas son
LA MISMA aunque las hayas titulado distinto: "Travesía hacia el puerto" y "Viaje al
puerto" son la misma trama, igual que "Defender el barco" y "Repeler el abordaje"
si describen el mismo suceso.
- Si la entrada YA EXISTE: devuélvela con SU MISMO "id", conservando el título
  original y actualizando solo lo que haya cambiado (progreso, estado, notas).
- Crea una entrada SIN "id" únicamente si es algo genuinamente nuevo que no aparece
  en la lista de arriba.
- No dividas una misma trama en varias entradas por sus distintas fases.

REGLAS OBLIGATORIAS DE EXTRACCIÓN:
1. "story": Resumen narrativo consolidado de los acontecimientos transcurridos.
2. "current_status": Estado actual de los aventureros, su ubicación inmediata, peligros y recursos.
3. "quests": Lista de tramas y misiones activas o completadas.
4. "npcs": EXCLUSIVAMENTE Personajes No Jugadores (PNJs / NPCs) secundarios, aliados, antagonistas, mentores, comerciantes o criaturas.
   ⚠️ REGLA CRÍTICA: NO incluyas bajo ningún concepto al Personaje Jugador (PC / Protagonista / OC ${pcName ? `"${pcName}"` : ''}) en la lista de "npcs". El protagonista/jugador NO es un PNJ.
5. "locations": Lugares, ciudades, tabernas, templos, regiones y mazmorras relevantes.

${pcNotes ? `INFORMACIÓN DEL PROTAGONISTA (NO EXTRAER COMO PNJ):\n${pcNotes}\n` : ''}

Devuelve la respuesta ESTRICTAMENTE en formato JSON con la siguiente estructura:
{
  "story": "Resumen narrativo de la historia hasta ahora (máximo 3 párrafos).",
  "current_status": "El estado actual de los personajes y la situación inmediata.",
  "quests": [
    { "id": "id existente o omitir si es nueva", "title": "Nombre", "type": "Principal o Secundaria", "objective": "Objetivo", "progress": "Progreso actual", "status": "Activa" }
  ],
  "npcs": [
    { 
      "id": "id existente o omitir si es nuevo", 
      "name": "Nombre del PNJ (NUNCA el protagonista)", 
      "relation": "Aliado, Enemigo, Neutral, etc.", 
      "notes": "Detalles clave y estado",
      "vinculo": "Tipo de vínculo (solo para PNJs con Nombre Propio o habituales, omitir en figurantes)",
      "atr": "Número del 0 al 20 (SOLO si el PNJ tiene Nombre Propio real o es recurrente; omitir en extras genéricos como 'Corsario', 'Guardia', 'Tabernero')",
      "vin": "Número del 0 al 20 (SOLO para PNJs con Nombre Propio o recurrentes)",
      "con": "Número del 0 al 20 (SOLO para PNJs con Nombre Propio o recurrentes)"
    }
  ],
  "locations": [
    { "id": "id existente o omitir si es nuevo", "name": "Nombre", "desc": "Descripción breve y estado" }
  ]
}

HISTORIAL DE PARTIDA:
${historyToAnalyze}`;

  const activeModel = getBackgroundTaskModel();
  const safetySetting = getStoredSafetyLevel();

  const memConfig: any = {
    responseMimeType: 'application/json',
    temperature: 0.2,
    ...(esModeloAbierto(activeModel) ? {} : { safetySettings: buildSafetySettings(safetySetting) })
  };

  const response = await generateContentWithFailover({
    primaryModel: activeModel,
    contents: prompt,
    config: memConfig
  });

  const resultText = response.text;
  if (!resultText) throw new Error('No se recibió respuesta del modelo al sincronizar la memoria.');

  let cleanText = resultText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
  }
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleanText);
  } catch (err) {
    console.error('Failed to parse memory JSON from AI:', cleanText, err);
    throw new Error(
      'La respuesta de la IA no tenía un formato estructurado reconocible. Inténtalo de nuevo.'
    );
  }

  // Assign IDs to all items and strictly filter out any protagonist entry from npcs
  const quests = (parsed.quests || []).map((q: any) => ({
    ...q,
    id: q.id || Date.now().toString() + Math.random().toString(36).substring(7)
  }));

  const pcNameClean = (project.memory?.player_character?.name || '').trim().toLowerCase();
  const genericPlayerNames = new Set([
    'protagonista',
    'jugador',
    'el jugador',
    'personaje jugador',
    'oc',
    'pj',
    'hero',
    'héroe'
  ]);

  const rawNpcs = parsed.npcs || [];
  const npcs = rawNpcs
    .filter((n: any) => {
      const nameLower = (n.name || '').trim().toLowerCase();
      if (!nameLower) return false;
      if (genericPlayerNames.has(nameLower)) return false;
      if (pcNameClean && pcNameClean.length > 2) {
        // Only treat it as the protagonist on an exact match or a substantial
        // overlap; a 2-letter NPC name must not be swallowed by a long PC name.
        if (nameLower === pcNameClean) return false;
        if (nameLower.length > 3 && (nameLower.includes(pcNameClean) || pcNameClean.includes(nameLower))) {
          return false;
        }
      }
      return true;
    })
    .map((n: any) => ({
      ...n,
      id: n.id || Date.now().toString() + Math.random().toString(36).substring(7)
    }));

  const locations = (parsed.locations || []).map((l: any) => ({
    ...l,
    id: l.id || Date.now().toString() + Math.random().toString(36).substring(7)
  }));

  return {
    story: parsed.story || project.memory?.story || '',
    current_status: parsed.current_status || project.memory?.current_status || '',
    quests: mergeEntities(project.memory?.quests || [], quests, 'title', 'objective'),
    npcs: mergeEntities(project.memory?.npcs || [], npcs, 'name', 'notes'),
    locations: mergeEntities(project.memory?.locations || [], locations, 'name', 'desc')
  };
}

/**
 * Actualización incremental en segundo plano (Delta Sync).
 *
 * En lugar de reprocesar todos los capítulos y consumir miles de tokens,
 * analiza únicamente el último turno transcurrido (acción del jugador y respuesta del narrador)
 * comparándolo con el estado actual de la memoria. Si no hay cambios sustanciales, devuelve null.
 */
export async function syncMemoryDeltaIncremental({
  project,
  lastUserAction,
  lastModelResponse,
  granularity = getStoredMemorySyncGranularity()
}: {
  project: Project;
  lastUserAction: string;
  lastModelResponse: string;
  granularity?: MemorySyncGranularity;
}): Promise<Partial<Memory> | null> {
  if (granularity === 'off') return null;
  if (!lastUserAction && !lastModelResponse) return null;

  const currentMem = project.memory || {
    story: '',
    quests: [],
    npcs: [],
    locations: [],
    current_status: '',
    manual_notes: ''
  };

  const pcName = currentMem.player_character?.name || '';
  const pcNotes = currentMem.player_character
    ? `Protagonista (OC): "${currentMem.player_character.name}" (${currentMem.player_character.race || ''} ${currentMem.player_character.class || ''})`
    : '';

  const listExisting = <T extends { id: string }>(items: T[], describe: (i: T) => string, maxItems = 10) =>
    items.length ? items.slice(0, maxItems).map(i => `- [id: ${i.id}] ${describe(i)}`).join('\n') : '(ninguna)';

  let prompt = '';

  if (granularity === 'smart_lite') {
    // Modo Optimizado / Esencial: Ahorro masivo de tokens (~70% menos de cuota)
    prompt = `Extrae cambios vitales de este último turno para la memoria del juego de rol (modo esencial optimizado).

MEMORIA ACTUAL:
- Situación: ${currentMem.current_status || 'Sin especificar'}
- PNJs clave: ${listExisting(currentMem.npcs || [], n => `"${n.name}" (${n.relation || 'neutral'})`, 6)}
- Tramas: ${listExisting(currentMem.quests || [], q => `"${q.title}"`, 4)}

${pcNotes ? `IMPORTANTE: ${pcNotes} - No añadir al protagonista a PNJs.\n` : ''}
ÚLTIMO TURNO:
Jugador: ${lastUserAction.slice(0, 500)}
Narrador: ${lastModelResponse.slice(0, 1200)}

INSTRUCCIONES:
Si NO hay cambios clave (peligro inmediato, nuevo PNJ o avance de trama), responde: {"has_changes": false}
Si hubo cambios importantes, responde en JSON estricto:
{
  "has_changes": true,
  "current_status": "Situación y peligro inmediato resumido",
  "new_or_updated_npcs": [{ "name": "Nombre", "relation": "Aliado/Enemigo/Neutral", "notes": "Rasgo o estado" }],
  "new_or_updated_quests": [{ "title": "Nombre de misión", "status": "Activa/Completada", "progress": "Avance breve" }]
}`;
  } else {
    // Modo Completo / Exhaustivo: Detallado en todas las entidades
    prompt = `Analiza este ÚLTIMO TURNO de la partida y actualiza la memoria viva de forma incremental.

MEMORIA ACTUAL:
- TRAMAS ACTIVAS:
${listExisting(currentMem.quests || [], q => `"${q.title}" (${q.status || 'activa'}): ${q.objective || ''}`)}
- PNJS CONOCIDOS:
${listExisting(currentMem.npcs || [], n => `"${n.name}" (${n.relation || 'neutral'}): ${n.notes || ''}`)}
- LUGARES:
${listExisting(currentMem.locations || [], l => `"${l.name}": ${l.desc || ''}`)}
- SITUACIÓN INMEDIATA:
${currentMem.current_status || 'Sin especificar'}

${pcNotes ? `IMPORTANTE: ${pcNotes} - ¡NUNCA incluyas al protagonista en la lista de "new_or_updated_npcs"!\n` : ''}

ÚLTIMO TURNO:
Jugador: ${lastUserAction.slice(0, 1500)}
Narrador: ${lastModelResponse.slice(0, 3000)}

INSTRUCCIONES:
1. Si este turno NO introduce nuevos PNJs, ni nuevos lugares, ni cambia el estado de misiones, ni altera significativamente la situación inmediata, responde: {"has_changes": false}
2. Si hubo cambios relevantes (apareció un PNJ nuevo o conocido con nueva información, cambió de sitio, avanzó una misión o cambió el peligro inmediato), responde con los campos actualizados.

Formato JSON estricto:
{
  "has_changes": true o false,
  "current_status": "Nueva situación inmediata si ha cambiado (o dejar igual si no)",
  "new_or_updated_quests": [
    { "id": "id existente si es actualización o omitir si es nueva", "title": "Nombre", "objective": "Objetivo", "progress": "Progreso", "status": "Activa/Completada", "type": "Principal/Secundaria" }
  ],
  "new_or_updated_npcs": [
    { "id": "id existente o omitir", "name": "Nombre", "relation": "Aliado/Enemigo/Neutral", "notes": "Notas y estado" }
  ],
  "new_or_updated_locations": [
    { "id": "id existente o omitir", "name": "Nombre", "desc": "Descripción breve" }
  ]
}`;
  }

  try {
    const bgModel = getBackgroundTaskModel();
    const safetySetting = getStoredSafetyLevel();

    const memConfig: any = {
      responseMimeType: 'application/json',
      temperature: 0.1,
      ...(esModeloAbierto(bgModel) ? {} : { safetySettings: buildSafetySettings(safetySetting) })
    };

    const response = await generateContentWithFailover({
      primaryModel: bgModel,
      contents: prompt,
      config: memConfig
    });

    const text = response.text?.trim() || '';
    if (!text) return null;

    let clean = text;
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(clean);
    if (!parsed.has_changes) return null;

    const pcClean = pcName.trim().toLowerCase();
    const generic = new Set(['protagonista', 'jugador', 'el jugador', 'personaje jugador', 'oc', 'pj', 'hero', 'héroe']);

    const incomingNpcs = (parsed.new_or_updated_npcs || [])
      .filter((n: any) => {
        const nl = (n.name || '').trim().toLowerCase();
        if (!nl || generic.has(nl)) return false;
        if (pcClean && (nl === pcClean || (nl.length > 3 && (nl.includes(pcClean) || pcClean.includes(nl))))) return false;
        return true;
      })
      .map((n: any) => ({
        ...n,
        id: n.id || Date.now().toString() + Math.random().toString(36).substring(7)
      }));

    const incomingQuests = (parsed.new_or_updated_quests || []).map((q: any) => ({
      ...q,
      id: q.id || Date.now().toString() + Math.random().toString(36).substring(7)
    }));

    const incomingLocs = (parsed.new_or_updated_locations || []).map((l: any) => ({
      ...l,
      id: l.id || Date.now().toString() + Math.random().toString(36).substring(7)
    }));

    return {
      current_status: parsed.current_status || currentMem.current_status,
      quests: incomingQuests.length ? mergeEntities(currentMem.quests || [], incomingQuests, 'title', 'objective') : currentMem.quests,
      npcs: incomingNpcs.length ? mergeEntities(currentMem.npcs || [], incomingNpcs, 'name', 'notes') : currentMem.npcs,
      locations: incomingLocs.length ? mergeEntities(currentMem.locations || [], incomingLocs, 'name', 'desc') : currentMem.locations
    };
  } catch (e) {
    // Es una tarea en segundo plano: no debe interrumpir el flujo del juego si falla
    console.warn('Background memory delta sync skipped/failed:', e);
    return null;
  }
}

/**
 * Normalises a Spanish label for comparison: no accents, no punctuation and no
 * filler words, so "Travesía hacia Aguasprofundas" and "Viaje a Aguasprofundas"
 * end up comparable.
 */
const STOPWORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'a',
  'al',
  'en',
  'por',
  'para',
  'con',
  'sin',
  'hacia',
  'hasta',
  'desde',
  'su',
  'sus',
  'lo',
  'se',
  'que',
  'the',
  'of',
  'to'
]);

function tokenise(value: string | undefined): Set<string> {
  return new Set(
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  );
}

/** Dice coefficient: 0 = nothing in common, 1 = identical. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach(t => {
    if (b.has(t)) shared++;
  });
  return (2 * shared) / (a.size + b.size);
}

/**
 * Merges AI-regenerated entities into the ones already stored.
 *
 * Two problems to avoid at once. Replacing the arrays outright destroys
 * locally-held data — portraits assigned by hand, map markers, and any entity the
 * model did not mention this pass. But matching only on an exact name lets the
 * model's rephrasings ("Defender el barco" / "Repeler el abordaje") pile up as
 * duplicates. So we match by id first, then by exact label, then by how much the
 * label and the descriptive field actually overlap.
 */
function mergeEntities<T extends { id: string; portrait?: string; markers?: unknown }>(
  existing: T[],
  incoming: T[],
  labelKey: keyof T,
  detailKey?: keyof T
): T[] {
  const labelOf = (e: T) => e[labelKey] as unknown as string | undefined;
  const detailOf = detailKey ? (e: T) => e[detailKey] as unknown as string | undefined : undefined;
  const norm = (v: string | undefined) => (v || '').trim().toLowerCase();

  const byId = new Map(existing.map(e => [e.id, e]));
  const byLabel = new Map(existing.filter(e => norm(labelOf(e))).map(e => [norm(labelOf(e)), e]));

  // Clave: id del existente -> versión actualizada. Así el orden de la lista de
  // la usuaria no se baraja en cada sincronización.
  const updates = new Map<string, T>();
  const additions: T[] = [];
  const consumed = new Set<string>();

  const findFuzzy = (item: T): T | undefined => {
    // Si estamos comparando nombres de PNJs, usar coincidenNombresNpc
    if (labelKey === 'name') {
      const npcMatch = existing.find(
        prev =>
          !consumed.has(prev.id) &&
          coincidenNombresNpc(
            labelOf(prev),
            labelOf(item),
            { alias: (prev as any).alias, trueIdentity: (prev as any).trueIdentity },
            { alias: (item as any).alias, trueIdentity: (item as any).trueIdentity }
          )
      );
      if (npcMatch) return npcMatch;
    }

    const labelTokens = tokenise(labelOf(item));
    const detailTokens = detailOf ? tokenise(detailOf(item)) : new Set<string>();
    let best: T | undefined;
    let bestScore = 0;

    for (const prev of existing) {
      if (consumed.has(prev.id)) continue;
      const labelScore = similarity(labelTokens, tokenise(labelOf(prev)));
      const detailScore = detailOf ? similarity(detailTokens, tokenise(detailOf(prev))) : 0;
      // Either a clearly similar title, or a description that is almost the same.
      const score = Math.max(labelScore, detailScore >= 0.7 ? detailScore : 0);
      if (score > bestScore) {
        bestScore = score;
        best = prev;
      }
    }
    return bestScore >= 0.6 ? best : undefined;
  };

  for (const item of incoming) {
    const prev = byId.get(item.id) ?? byLabel.get(norm(labelOf(item))) ?? findFuzzy(item);
    if (prev && !consumed.has(prev.id)) {
      consumed.add(prev.id);
      if (labelKey === 'name' && ('relation' in (prev as any) || 'relation' in (item as any))) {
        // Es un PNJ: usar fusión inteligente de campos de PNJ
        const mergedNpc = fusionarDosNpcs(prev as unknown as NPC, item as unknown as Partial<NPC>);
        updates.set(prev.id, mergedNpc as unknown as T);
      } else {
        updates.set(prev.id, {
          ...prev,
          ...item,
          id: prev.id,
          [labelKey]: labelOf(prev) || labelOf(item),
          portrait: item.portrait || prev.portrait,
          ...(prev.markers !== undefined && (item as T).markers === undefined ? { markers: prev.markers } : {})
        } as T);
      }
    } else if (!prev) {
      additions.push(item);
    }
  }

  // Se respeta el orden previo; lo que el modelo no mencionó se conserva.
  const combined = [...existing.map(prev => updates.get(prev.id) ?? prev), ...additions];
  if (labelKey === 'name' && combined.length > 0 && 'relation' in (combined[0] as any)) {
    return deduplicarListaNpcs(combined as unknown as NPC[]) as unknown as T[];
  }
  return combined;
}

/**
 * Tiradas de azar auténtico para que el Narrador las consuma.
 *
 * Los modelos son malos generando números aleatorios: tienden a valores
 * intermedios y a lo dramáticamente conveniente, así que un "20 natural" o una
 * pifia casi nunca salen por sorpresa. Se le entrega una tanda de resultados ya
 * tirados con el generador criptográfico del navegador y se le ordena usarlos en
 * orden en lugar de inventárselos.
 */
/**
 * Lee la línea de estado que el Narrador emite al final de su turno.
 *
 * Formato: [ESTADO: PG 18/25 | CA 15 | condiciones: sangrando, agotado]
 * Cualquier campo puede faltar. Se devuelve también el texto ya limpio, porque
 * la etiqueta es para la app, no para leerla en la crónica.
 */
/**
 * Traduce un fallo de la API a algo que la usuaria pueda accionar. Sin esto los
 * errores llegaban a pantalla como "no se pudo", que no dice qué hacer.
 */
export function describeApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return 'Has alcanzado temporalmente el límite de peticiones de la capa gratuita. La app intentó rotar a modelos alternativos pero la cuota de tu clave se encuentra en pausa. Espera unos segundos y pulsa «Continuar Narración».';
  }
  if (
    lower.includes('api key') ||
    lower.includes('api_key') ||
    lower.includes('401') ||
    lower.includes('403')
  ) {
    return 'La clave de API no es válida o no tiene permiso. Revísala en el botón Motor.';
  }
  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('prohibited')) {
    return 'El modelo ha bloqueado la respuesta por sus filtros de seguridad. Prueba a bajar los filtros en Motor → Filtros & NSFW.';
  }
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('alta demanda')
  ) {
    return 'Los servidores de Google estuvieron saturados en múltiples modelos de la cadena de respaldo. Espera unos instantes y pulsa «Continuar Narración» para reanudar la escena exactamente donde quedó.';
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return 'El modelo seleccionado no existe o no está disponible con tu clave. Abre el botón Motor y pulsa «Ver los de mi clave» para ver cuáles admite.';
  }
  // «No compatible» casi nunca significa que el modelo no valga: significa que la
  // petición llevaba un campo que ese endpoint no acepta. Confundir las dos cosas
  // manda a la usuaria a cambiar de clave por un fallo que está en el código.
  if (lower.includes('is not supported') || lower.includes('not supported')) {
    return `Google ha rechazado un campo de la petición, no tu clave: «${String((err as any)?.message || '').slice(0, 200)}». Si acabas de cambiar de modelo, prueba con otro; si no, es un fallo de la aplicación.`;
  }
  if (lower.includes('incomplete json') || lower.includes('unexpected end') || lower.includes('terminated')) {
    return 'La respuesta se cortó a mitad de camino, casi siempre por un bache de conexión. Vuelve a intentarlo; si estás con datos móviles, espera a tener mejor cobertura.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'No se ha podido contactar con Google. Comprueba tu conexión a internet.';
  }
  return raw || 'Error desconocido.';
}

export function parseStateTag(text: string): {
  cleaned: string;
  state: { hp?: number; maxHp?: number; ac?: number; conditions?: string[] } | null;
} {
  const match = text.match(/\[ESTADO:([^\]]*)\]/i);
  if (!match) return { cleaned: text, state: null };

  const body = match[1];
  const state: { hp?: number; maxHp?: number; ac?: number; conditions?: string[] } = {};

  const hp = body.match(/(?:PG|HP|vida)\s*:?\s*(\d+)\s*\/\s*(\d+)/i);
  if (hp) {
    state.hp = parseInt(hp[1], 10);
    state.maxHp = parseInt(hp[2], 10);
  } else {
    const soloHp = body.match(/(?:PG|HP|vida)\s*:?\s*(\d+)/i);
    if (soloHp) state.hp = parseInt(soloHp[1], 10);
  }

  const ac = body.match(/(?:CA|AC|defensa)\s*:?\s*(\d+)/i);
  if (ac) state.ac = parseInt(ac[1], 10);

  const cond = body.match(/condiciones?\s*:?\s*([^|\]]*)/i);
  if (cond) {
    const list = cond[1]
      .split(/[,;]/)
      .map(c => c.trim())
      .filter(c => c && !/^(ninguna|ninguno|sin novedad|nada)$/i.test(c));
    state.conditions = list;
  }

  const cleaned = text.replace(/\[ESTADO:[^\]]*\]/gi, '').trim();
  const hasAny = state.hp !== undefined || state.ac !== undefined || state.conditions !== undefined;
  return { cleaned, state: hasAny ? state : null };
}

export function rollDicePool(): { d20: number[]; d100: number[]; d6: number[] } {
  const roll = (sides: number, count: number) => {
    const out: number[] = [];
    const buf = new Uint32Array(count);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      for (let i = 0; i < count; i++) out.push((buf[i] % sides) + 1);
    } else {
      for (let i = 0; i < count; i++) out.push(Math.floor(Math.random() * sides) + 1);
    }
    return out;
  };
  return { d20: roll(20, 8), d100: roll(100, 4), d6: roll(6, 6) };
}

export function classifyFileAuto(file: ProjectFile, memory?: Memory): FileCategory {
  if (file.isAudio) return 'audio';

  const lowerName = file.name.toLowerCase();
  const lowerAnalysis = (file.analysis || '').toLowerCase();
  const lowerDocContent = (file.content || '').substring(0, 4000).toLowerCase();

  const palabraEnTexto = (claves: string[], texto: string) =>
    claves.some(k => new RegExp(`(^|[^\\p{L}])${k}([^\\p{L}]|$)`, 'u').test(texto));

  const palabraEnNombre = (claves: string[]) => palabraEnTexto(claves, lowerName);

  // Palabras clave específicas de familiar / compañero / montura / invocación
  const companionKeywords = [
    'familiar',
    'compañero',
    'companero',
    'companion',
    'mascota',
    'pet',
    'montura',
    'mount',
    'steed',
    'invocacion',
    'invocación',
    'summon',
    'pseudodragon',
    'pseudodragón',
    'homunculo',
    'homúnculo',
    'cuervo familiar',
    'lechuza familiar',
    'gato familiar',
    'diablillo familiar',
    'quasit',
    'sprite',
    'sabueso',
    'sidekick'
  ];

  // Palabras clave específicas de PNJ / monstruo / bestiario / enemigo
  const npcKeywords = [
    'pnj',
    'npc',
    'boss',
    'jefe',
    'villano',
    'villain',
    'enemigo',
    'enemy',
    'monstruo',
    'monster',
    'bestiario',
    'bestiary',
    'statblock',
    'guardia',
    'guard',
    'criatura',
    'creature',
    'posadero',
    'tabernero',
    'mercader',
    'merchant',
    'rey',
    'king',
    'reina',
    'queen',
    'capitan',
    'capitán',
    'lich',
    'vampiro',
    'bruja'
  ];

  // Palabras clave de protagonista / personaje jugador (OC)
  const pjKeywords = [
    'pj',
    'oc',
    'protagonista',
    'heroe',
    'héroe',
    'player',
    'jugador',
    'personaje jugador',
    'hoja_personaje'
  ];

  // Comprobar coincidencia con personajes existentes en memoria
  const pcName = (memory?.player_character?.name || '').toLowerCase().trim();
  const matchesPcName = pcName.length > 2 && (lowerName.includes(pcName) || lowerAnalysis.includes(pcName));

  const matchesCompanionMemory = memory?.companions?.some(c => {
    const clean = (c.name || '').toLowerCase().trim();
    return clean.length > 2 && (lowerName.includes(clean) || lowerAnalysis.includes(clean));
  });

  const matchesNpcMemory = memory?.npcs?.some(n => {
    const clean = (n.name || '').toLowerCase().trim();
    return clean.length > 2 && (lowerName.includes(clean) || lowerAnalysis.includes(clean));
  });

  // 1. CLASIFICACIÓN DE DOCUMENTOS (PDF, TXT, MD, ETC.)
  if (!file.isImage) {
    const isCompanionDoc =
      matchesCompanionMemory ||
      palabraEnNombre(companionKeywords) ||
      (palabraEnTexto(companionKeywords, lowerDocContent) &&
        (lowerDocContent.includes('puntos de golpe') ||
          lowerDocContent.includes('ficha') ||
          lowerDocContent.includes('stats') ||
          lowerDocContent.includes('atributos')));

    if (isCompanionDoc) return 'sheet_companion';

    const isNpcDoc =
      matchesNpcMemory ||
      palabraEnNombre(npcKeywords) ||
      (palabraEnTexto(npcKeywords, lowerDocContent) &&
        (lowerDocContent.includes('puntos de golpe') ||
          lowerDocContent.includes('statblock') ||
          lowerDocContent.includes('desafío') ||
          lowerDocContent.includes('vd')));

    if (isNpcDoc) return 'sheet_npc';

    const isGenericSheet =
      palabraEnNombre([
        'ficha',
        'personaje',
        'character',
        'sheet',
        'pj',
        'oc',
        'protagonista',
        'trasfondo',
        'stats',
        'estadisticas',
        'hoja_personaje'
      ]) ||
      lowerDocContent.includes('clase y nivel') ||
      lowerDocContent.includes('puntos de golpe') ||
      lowerDocContent.includes('alineamiento') ||
      lowerDocContent.includes('trasfondo:') ||
      (lowerDocContent.includes('fuerza') &&
        lowerDocContent.includes('destreza') &&
        lowerDocContent.includes('constitución'));

    if (isGenericSheet) {
      if (matchesPcName || palabraEnNombre(pjKeywords)) return 'sheet_pj';
      return 'sheet_pj';
    }

    // Elenco
    const nombreDeElenco = palabraEnNombre([
      'elenco',
      'dramatis',
      'personae',
      'reparto',
      'quien es quien',
      'quién es quién',
      'roster',
      'cast'
    ]);
    if (nombreDeElenco) return 'roster';

    const nombreDeIndice = palabraEnNombre(['indice', 'índice', 'ganchos', 'index']);
    if (nombreDeIndice) return 'index';

    const nombreDeOraculo = ['oraculo', 'oráculo', 'oracle', 'mythic', 'gme', 'tabla', 'tablas'].some(k =>
      lowerName.includes(k)
    );
    const cuerpo = (file.content || '').slice(0, 6000).toLowerCase();
    const senasDeOraculo = [
      'fate chart',
      'exceptional yes',
      'exceptional no',
      'random event',
      'game master emulator',
      'sí excepcional',
      'no excepcional',
      'suceso aleatorio',
      'd100'
    ].filter(k => cuerpo.includes(k)).length;
    if (nombreDeOraculo || senasDeOraculo >= 2) return 'oracle';

    const nombreDeEstilo = palabraEnNombre(['estilo', 'prosa', 'muestra', 'voz']);
    const nombreNarrativo = palabraEnNombre(['novela', 'novelas', 'relato', 'relatos', 'capitulo', 'capítulo', 'fragmento']);
    const nombreDeLore = palabraEnNombre([
      'compendio',
      'cantera',
      'canon',
      'lore',
      'resumen',
      'resumido',
      'resumidas',
      'resumidos',
      'guia',
      'guía',
      'manual',
      'modulo',
      'módulo',
      'aventura'
    ]);
    const esCorto = (file.content || '').length < 30000;
    if (nombreDeEstilo || (nombreNarrativo && esCorto && !nombreDeLore)) return 'style_sample';

    return 'document';
  }

  // 2. CLASIFICACIÓN DE IMÁGENES
  if (file.markers && file.markers.length > 0) return 'map';

  // Coincidencias con memoria
  if (matchesCompanionMemory) return 'portrait_companion';
  if (matchesPcName) return 'portrait_pj';
  if (matchesNpcMemory) return 'portrait_npc';

  // Map keywords
  const mapKeywords = [
    'map',
    'mapa',
    'grid',
    'dungeon',
    'plano',
    'world',
    'region',
    'mazmorra',
    'castillo',
    'castle',
    'cueva',
    'cave',
    'templo',
    'temple',
    'battlemap',
    'battle_map',
    'topograph',
    'costa',
    'coast',
    'isla',
    'island',
    'valle',
    'ciudad',
    'city',
    'pueblo',
    'town',
    'taberna',
    'tavern',
    'alcantarilla',
    'ruinas',
    'bosque',
    'montaña',
    'reino',
    'cartograf',
    'terreno',
    'pantano',
    'fortaleza',
    'torre',
    'drakensberg'
  ];
  if (mapKeywords.some(k => lowerName.includes(k))) return 'map';
  if (
    lowerAnalysis.includes('mapa geográfico') ||
    lowerAnalysis.includes('mapa de batalla') ||
    lowerAnalysis.includes('plano táctico') ||
    lowerAnalysis.includes('cuadrícula') ||
    lowerAnalysis.includes('cartografía') ||
    lowerAnalysis.includes('distribución de salas')
  ) {
    return 'map';
  }

  // Familiar / Companion image keywords
  if (
    palabraEnNombre(companionKeywords) ||
    lowerAnalysis.includes('familiar') ||
    lowerAnalysis.includes('mascota') ||
    lowerAnalysis.includes('montura') ||
    lowerAnalysis.includes('compañero animal')
  ) {
    return 'portrait_companion';
  }

  // PJ / Protagonist image keywords
  if (palabraEnNombre(pjKeywords)) return 'portrait_pj';
  if (
    lowerAnalysis.includes('personaje jugador') ||
    lowerAnalysis.includes('héroe principal') ||
    lowerAnalysis.includes('protagonista')
  ) {
    return 'portrait_pj';
  }

  // NPC keywords
  if (palabraEnNombre(npcKeywords)) return 'portrait_npc';
  if (
    lowerAnalysis.includes('retrato') ||
    lowerAnalysis.includes('rostro') ||
    lowerAnalysis.includes('personaje no jugador') ||
    lowerAnalysis.includes('antagonista') ||
    lowerAnalysis.includes('busto') ||
    lowerAnalysis.includes('atuendo de') ||
    lowerAnalysis.includes('vestimenta de')
  ) {
    return 'portrait_npc';
  }

  return 'scene';
}

/**
 * Decides whether a freshly uploaded file looks like the player character's own
 * sheet (OC), excluding companions and NPCs.
 */
export function looksLikePlayerSheet(file: ProjectFile): boolean {
  if (file.isAudio) return false;
  if (file.category === 'sheet_pj') return true;
  if (file.category === 'sheet_companion' || file.category === 'sheet_npc') return false;

  const name = file.name.toLowerCase();
  const analysis = (file.analysis || '').toLowerCase();

  // Si tiene pistas explícitas de familiar o pnj, NO es la ficha del jugador
  const companionCues = ['familiar', 'compañero', 'companero', 'pet', 'mascota', 'montura', 'invocacion', 'invocación'];
  if (companionCues.some(c => name.includes(c) || analysis.includes(c))) return false;

  const npcCues = ['pnj', 'npc', 'monstruo', 'monster', 'villano', 'bestiario', 'enemigo'];
  if (npcCues.some(c => name.includes(c) || analysis.includes(c))) return false;

  const hints = ['ficha pj', 'ficha oc', 'personaje jugador', 'protagonista', 'hoja_personaje', 'ficha de personaje', 'character sheet'];
  if (hints.some(h => name.includes(h) || analysis.includes(h))) return true;

  if (file.isImage) {
    return (
      (analysis.includes('ficha de personaje') || analysis.includes('hoja de personaje')) &&
      !analysis.includes('familiar') &&
      !analysis.includes('pnj')
    );
  }

  const body = (file.content || '').substring(0, 4000).toLowerCase();
  const hasAttributes = body.includes('fuerza') && body.includes('destreza') && body.includes('constitución');
  const hasSheetKeywords = body.includes('clase y nivel') || body.includes('puntos de golpe') || body.includes('trasfondo');

  return (hasAttributes || hasSheetKeywords) && !companionCues.some(c => body.includes(c)) && !npcCues.some(c => body.includes(c));
}

/**
 * Checks whether a file looks like a companion / familiar sheet.
 */
export function looksLikeCompanionSheet(file: ProjectFile): boolean {
  if (file.isAudio) return false;
  if (file.category === 'sheet_companion') return true;

  const name = file.name.toLowerCase();
  const analysis = (file.analysis || '').toLowerCase();
  const companionCues = ['familiar', 'compañero', 'companero', 'pet', 'mascota', 'montura', 'mount', 'pseudodragon', 'pseudodragón', 'homunculo', 'homúnculo', 'cuervo familiar', 'lechuza familiar', 'gato familiar'];
  
  if (companionCues.some(c => name.includes(c) || analysis.includes(c))) {
    const sheetHints = ['ficha', 'sheet', 'stats', 'atributos', 'puntos de golpe', 'ataque', 'ca'];
    return sheetHints.some(h => name.includes(h) || (file.content || '').toLowerCase().includes(h));
  }
  return false;
}

/**
 * Checks whether a file looks like an NPC / Monster sheet or statblock.
 */
export function looksLikeNpcSheet(file: ProjectFile): boolean {
  if (file.isAudio) return false;
  if (file.category === 'sheet_npc') return true;

  const name = file.name.toLowerCase();
  const analysis = (file.analysis || '').toLowerCase();
  const npcCues = ['pnj', 'npc', 'monstruo', 'monster', 'villano', 'bestiario', 'statblock', 'boss', 'jefe', 'criatura'];

  if (npcCues.some(c => name.includes(c) || analysis.includes(c))) {
    const sheetHints = ['ficha', 'sheet', 'stats', 'statblock', 'atributos', 'puntos de golpe', 'desafío', 'vd'];
    return sheetHints.some(h => name.includes(h) || (file.content || '').toLowerCase().includes(h));
  }
  return false;
}

/**
 * Extrae de forma estructurada un familiar o compañero desde un documento.
 */
export async function extractCompanionFromDocument(file: ProjectFile): Promise<PlayerCharacter> {
  if (!file.isImage && !(file.content || '').trim()) {
    throw new Error(`"${file.name}" no contiene texto legible.`);
  }

  const instructions = `Analiza este documento y extrae la ficha del Familiar, Compañero Animal, Montura o Invocación de forma exhaustiva y fiel.
Determina:
- "name": Nombre del familiar o criatura (ej: "Cuervo Familiar", "Corvus", "Kaelen el Sabueso")
- "companionType": "Familiar" | "Montura" | "Compañero Animal" | "Invocación" | "Aliado"
- "race": Especie o tipo de criatura (ej: "Espíritu Familiar (Cuervo)", "Pseudodragón", "Caballo de Guerra")
- "hp": Puntos de golpe numéricos
- "maxHp": Puntos de golpe máximos
- "ac": Clase de armadura numérico
- "speed": Velocidad (ej: "10 pies, volar 50 pies")
- "hitDice": Dados de golpe si los tiene
- "attributes": { "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number }
- "traits": Lista de rasgos especiales (ej: "Vuelo sigiloso", "Conexión telepática", "Mimetismo", "Sentidos agudos")
- "actions": Lista de ataques o acciones en rasgos/notas
- "notes": Descripción, apariencia o vínculo con el amo

Responde ÚNICAMENTE con un objeto JSON válido con la estructura de PlayerCharacter:
{
  "name": "...",
  "characterType": "companion",
  "companionType": "Familiar",
  "race": "...",
  "hp": 2,
  "maxHp": 2,
  "ac": 12,
  "speed": "10 pies, volar 50 pies",
  "attributes": { "str": 2, "dex": 14, "con": 8, "int": 2, "wis": 12, "cha": 6 },
  "traits": [
    { "name": "Vuelo Sigiloso", "description": "No provoca ataques de oportunidad al volar..." }
  ],
  "notes": "..."
}`;

  let contents: any;
  if (file.isImage && file.content) {
    const base64 = file.content.includes(',') ? file.content.split(',')[1] : file.content;
    contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.mime || 'image/jpeg', data: base64 } },
          { text: `${instructions}\n\nLee la imagen adjunta y extrae la ficha del familiar/compañero.` }
        ]
      }
    ];
  } else {
    contents = `${instructions}\n\nDocumento:\n${(file.content || '').slice(0, 40000)}`;
  }

  const response = await generateContentWithFailover({
    primaryModel: getBackgroundTaskModel(),
    contents,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  });

  const cleanJson = (response.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed: any = {};
  try {
    parsed = JSON.parse(cleanJson);
  } catch (e) {
    console.error('Error parsing companion JSON:', e);
  }

  return {
    id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substring(7),
    characterType: 'companion',
    companionType: parsed.companionType || 'Familiar',
    name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
    race: parsed.race || 'Criatura',
    hp: typeof parsed.hp === 'number' ? parsed.hp : 2,
    maxHp: typeof parsed.maxHp === 'number' ? parsed.maxHp : (parsed.hp || 2),
    ac: typeof parsed.ac === 'number' ? parsed.ac : 10,
    speed: parsed.speed || '30 pies',
    attributes: parsed.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    traits: parsed.traits || [],
    spells: parsed.spells || [],
    inventory: parsed.inventory || [],
    notes: parsed.notes || '',
    sheetText: !file.isImage ? file.content : undefined
  };
}

/**
 * Extrae de forma estructurada un PNJ o monstruo desde un documento.
 */
export async function extractNpcFromDocument(file: ProjectFile): Promise<NPC> {
  if (!file.isImage && !(file.content || '').trim()) {
    throw new Error(`"${file.name}" no contiene texto legible.`);
  }

  const instructions = `Analiza este documento y extrae los datos del Personaje No Jugador (PNJ), Villano, Monstruo o Criatura de forma fiel.
Extrae:
- "name": Nombre del PNJ o monstruo
- "relation": Relación estimada ("Aliado", "Enemigo", "Neutral", "Contacto", "Peligro")
- "status": "Vivo", "Activo" o estado
- "description": Lo que aparenta físicamente o su rol público
- "notes": Trasfondo, motivos o notas
- "aparenta": Lo que aparenta
- "oculta": Secretos, debilidades o intenciones ocultas si se mencionan
- "sheet": Ficha opcional con hp, maxHp, ac, speed, attributes, traits

Responde ÚNICAMENTE con un JSON:
{
  "name": "...",
  "relation": "Neutral",
  "status": "Vivo",
  "description": "...",
  "notes": "...",
  "aparenta": "...",
  "oculta": "...",
  "sheet": {
    "hp": 15,
    "maxHp": 15,
    "ac": 13,
    "speed": "30 pies",
    "attributes": { "str": 12, "dex": 14, "con": 12, "int": 10, "wis": 11, "cha": 10 },
    "traits": []
  }
}`;

  let contents: any;
  if (file.isImage && file.content) {
    const base64 = file.content.includes(',') ? file.content.split(',')[1] : file.content;
    contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.mime || 'image/jpeg', data: base64 } },
          { text: `${instructions}\n\nLee la imagen adjunta y extrae el PNJ/Monstruo.` }
        ]
      }
    ];
  } else {
    contents = `${instructions}\n\nDocumento:\n${(file.content || '').slice(0, 40000)}`;
  }

  const response = await generateContentWithFailover({
    primaryModel: getBackgroundTaskModel(),
    contents,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  });

  const cleanJson = (response.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed: any = {};
  try {
    parsed = JSON.parse(cleanJson);
  } catch (e) {
    console.error('Error parsing NPC JSON:', e);
  }

  const npcId = 'npc_' + Date.now() + '_' + Math.random().toString(36).substring(7);

  return {
    id: npcId,
    name: parsed.name || file.name.replace(/\.[^/.]+$/, ''),
    relation: parsed.relation || 'Neutral',
    status: parsed.status || 'Vivo',
    description: parsed.description || '',
    notes: parsed.notes || '',
    aparenta: parsed.aparenta,
    oculta: parsed.oculta,
    characterSheet: parsed.sheet ? {
      name: parsed.name || file.name,
      characterType: 'npc',
      hp: parsed.sheet.hp,
      maxHp: parsed.sheet.maxHp,
      ac: parsed.sheet.ac,
      speed: parsed.sheet.speed,
      attributes: parsed.sheet.attributes,
      traits: parsed.sheet.traits || []
    } : undefined
  };
}

export async function extractPlayerCharacterFromDocument(file: ProjectFile): Promise<PlayerCharacter> {
  // Un PDF escaneado o hecho de imágenes no deja texto al extraerlo, y entonces no
  // hay nada que analizar. Conviene decirlo con claridad en vez de fallar luego.
  if (!file.isImage && !(file.content || '').trim()) {
    throw new Error(
      `"${file.name}" no contiene texto legible. Si es un PDF escaneado o hecho de imágenes, hazle una captura de pantalla y súbela como imagen: así puedo leerla mirándola.`
    );
  }

  const rawContent = file.content || '';

  // Parser determinista para extraer bloques estándar de D&D y rol (por si el modelo omite campos)
  const regexExtractions: Partial<PlayerCharacter> = {};

  if (!file.isImage && rawContent) {
    // 1. PG / HP y Dados de Golpe
    const pgMatch = rawContent.match(/(?:\*\*PG\*\*|\bPG\b|\bHP\b|\bPuntos de Golpe\b)\s*[:·]*\s*(\d+)(?:\s*\(([^)]+)\))?/i);
    if (pgMatch) {
      regexExtractions.hp = parseInt(pgMatch[1], 10);
      regexExtractions.maxHp = parseInt(pgMatch[1], 10);
      if (pgMatch[2]) regexExtractions.hitDice = pgMatch[2].trim();
    }

    // 2. CA / AC
    const caMatch = rawContent.match(/(?:\*\*CA\*\*|\bCA\b|\bAC\b|\bClase de Armadura\b)\s*[:·]*\s*(\d+)/i);
    if (caMatch) {
      regexExtractions.ac = parseInt(caMatch[1], 10);
    }

    // 3. Velocidad
    const velMatch = rawContent.match(/(?:\*\*Vel\.\*\*|\bVel\.\b|\bVelocidad\b|\bSpeed\b)\s*[:·]*\s*([^·\n,]+)/i);
    if (velMatch) {
      regexExtractions.speed = velMatch[1].trim();
    }

    // 4. Iniciativa
    const inicMatch = rawContent.match(/(?:\*\*Inic\.\*\*|\bInic\.\b|\bIniciativa\b|\bInitiative\b)\s*[:·]*\s*([+\-]?\d+)/i);
    if (inicMatch) {
      regexExtractions.initiative = inicMatch[1].trim();
    }

    // 5. Bono de competencia
    const compMatch = rawContent.match(/(?:\*\*Comp\.\*\*|\bComp\.\b|\bCompetencia\b|\bBono de Comp\b|\bProficiency\b)\s*[:·]*\s*([+\-]?\d+)/i);
    if (compMatch) {
      regexExtractions.proficiencyBonus = parseInt(compMatch[1].replace('+', ''), 10);
    }

    // 6. Tabla de Atributos D&D (ej: | SAB | INT | CAR | CON | DES | FUE | o | FUE | DES | CON | INT | SAB | CAR |)
    const lines = rawContent.split('\n');
    for (let i = 0; i < lines.length - 2; i++) {
      const headerLine = lines[i];
      const sepLine = lines[i + 1];
      const valLine = lines[i + 2];
      if (headerLine.includes('|') && sepLine.includes('|') && sepLine.includes('-') && valLine.includes('|')) {
        const headers = headerLine.split('|').map(s => s.trim().toUpperCase()).filter(Boolean);
        const vals = valLine.split('|').map(s => s.trim()).filter(Boolean);
        if (headers.length >= 6 && vals.length >= 6) {
          const isAttrTable = headers.some(h => ['FUE', 'STR', 'DES', 'DEX', 'CON', 'INT', 'SAB', 'WIS', 'CAR', 'CHA'].includes(h));
          if (isAttrTable) {
            const attrObj: PlayerAttributes = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            headers.forEach((h, idx) => {
              const vStr = vals[idx] || '10';
              const numMatch = vStr.match(/\d+/);
              const num = numMatch ? parseInt(numMatch[0], 10) : 10;
              if (h === 'FUE' || h === 'STR') attrObj.str = num;
              else if (h === 'DES' || h === 'DEX') attrObj.dex = num;
              else if (h === 'CON') attrObj.con = num;
              else if (h === 'INT') attrObj.int = num;
              else if (h === 'SAB' || h === 'WIS') attrObj.wis = num;
              else if (h === 'CAR' || h === 'CHA') attrObj.cha = num;
            });
            regexExtractions.attributes = attrObj;
            break;
          }
        }
      }
    }

    // 7. Salvaciones con competencia
    const salvMatch = rawContent.match(/(?:Salvaciones(?:\s+con\s+competencia)?|Tiradas\s+de\s+salvaci[oó]n)\s*[:*]*\s*([^\n]+)/i);
    if (salvMatch) {
      const rawS = salvMatch[1];
      const found: string[] = [];
      ['SAB', 'INT', 'CAR', 'CON', 'DES', 'FUE', 'WIS', 'CHA', 'STR', 'DEX'].forEach(stat => {
        if (new RegExp(`\\b${stat}\\b`, 'i').test(rawS)) {
          let normalized = stat.toUpperCase();
          if (normalized === 'WIS') normalized = 'SAB';
          if (normalized === 'CHA') normalized = 'CAR';
          if (normalized === 'STR') normalized = 'FUE';
          if (normalized === 'DEX') normalized = 'DES';
          if (!found.includes(normalized)) found.push(normalized);
        }
      });
      if (found.length) regexExtractions.savingThrowProficiencies = found;
    }
  }

  const instructions = `Analiza esta ficha, trasfondo o documento de personaje de rol (D&D 5e u otro sistema) y extrae de forma EXHAUSTIVA, ESTRUCTURADA y RIGUROSAMENTE FIEL todos los datos del protagonista / Personaje Jugador (OC).

REGLAS CRÍTICAS DE EXTRACCIÓN Y COHERENCIA:
1. NO INVENTAR OBJETOS NI ESCUDOS: NO agregues equipo inicial por defecto ni escudos de madera genéricos. Si el documento no lista explícitamente un escudo en las posesiones del personaje, NO incluyas ningún escudo en el inventario.
2. DEDUPLICACIÓN DE EQUIPO: Si el trasfondo menciona un objeto genérico (ej: "bastón de viajero", "bastón común", "ropa de viaje") y el personaje tiene un arma/objeto personalizado con nombre propio (ej: "Bastón de Cedro Lunar"), son el MISMO objeto. NO dupliques objetos. Mantén el nombre personalizado y no agregues versiones genéricas duplicadas.
3. ORÁCULOS Y RELIQUIAS vs ESCUDOS DE COMBATE: Objetos rituales o adivinatorios como "Escudo de Fionn", "Ramas de Ogham", "Tablillas oraculares", amuletos o focos druídicos NO son armaduras de combate (+2 CA). Categorízalos como "magic" o "equipment", nunca como "armor", déjalos sin equipar como armadura defensiva y NO alteres la CA base del personaje.
4. REGLAS DE EMPUÑAR / DOS MANOS vs ESCUDO: Si el personaje empuña un arma a dos manos o un bastón a dos manos (o si no tiene escudo de combate), ningún escudo debe estar equipado ni activo.
5. EXACTITUD NUMÉRICA: Los valores numéricos (PG, CA, Velocidad, Bono de Competencia, Atributos FUE/DES/CON/INT/SAB/CAR, Tiradas de Salvación y CD de conjuros) deben coincidir exactamente con los que figuren en el documento. Si no se especifican monedas, pon 0 en todas.

Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "name": "Nombre del personaje",
  "race": "Raza / Linaje",
  "class": "Clase principal",
  "subclass": "Subclase si la tiene",
  "level": "Nivel numérico (ej: 1, 3)",
  "background": "Trasfondo",
  "alignment": "Alineamiento",
  "hp": 10,
  "maxHp": 10,
  "hitDice": "Dados de golpe (ej: 1d8)",
  "ac": 10,
  "speed": "30 pies",
  "initiative": "+0",
  "proficiencyBonus": 2,
  "attributes": {
    "str": 10,
    "dex": 10,
    "con": 10,
    "int": 10,
    "wis": 10,
    "cha": 10
  },
  "savingThrowProficiencies": ["SAB", "CAR"],
  "skillProficiencies": ["Percepción", "Naturaleza", "Medicina"],
  "languages": ["Común", "Drúidico", "Silvano"],
  "proficienciesAndLanguages": "Armaduras ligeras, bastones, herramientas de herboristería...",
  "conditions": [],
  "traits": [
    {
      "name": "Nombre del Rasgo o Dote",
      "type": "class",
      "source": "Druida Nvl 1",
      "description": "Descripción completa de lo que hace...",
      "uses": { "max": 2, "current": 2, "recovery": "short_rest" }
    }
  ],
  "spells": [
    {
      "name": "Nombre del Conjuro o Truco",
      "level": 0,
      "school": "Transmutación",
      "castingTime": "1 acción",
      "range": "Toque",
      "duration": "1 minuto",
      "description": "Efecto detallado...",
      "isRitual": false,
      "damageOrEffect": "1d8 mágico"
    }
  ],
  "inventory": [
    {
      "name": "Nombre del objeto / arma",
      "category": "weapon",
      "quantity": 1,
      "damageOrAc": "1d8 contundente (versátil 1d8 a dos manos)",
      "equipped": true,
      "description": "Descripción detallada",
      "rarity": "common"
    }
  ],
  "currencies": {
    "cp": 0,
    "sp": 0,
    "ep": 0,
    "gp": 0,
    "pp": 0
  },
  "spellcasting": {
    "ability": "Sabiduría",
    "saveDc": 13,
    "attackBonus": 5
  },
  "appearance": "Descripción física, vestimenta, ojos, cabello...",
  "personality": "Rasgos de personalidad y actitud",
  "ideals": "Ideales y principios éticos",
  "bonds": "Vínculos con personas, lugares o naturaleza",
  "flaws": "Defectos o vulnerabilidades emocionales",
  "backstory": "Historia de origen y motivación",
  "notes": "Secretos o notas adicionales",
  "sheetText": "Texto íntegro formateado"
}`;

  let contents: any;
  if (file.isImage && file.content) {
    const base64 = file.content.includes(',') ? file.content.split(',')[1] : file.content;
    contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.mime || 'image/jpeg', data: base64 } },
          {
            text: `${instructions}\n\nLa ficha está en la imagen adjunta ("${file.name}"). Lee todo el texto y extrae absolutamente todos los atributos, estadísticas y objetos reales sin inventar equipo adicional.`
          }
        ]
      }
    ];
  } else {
    contents = `${instructions}\n\nDocumento "${file.name}":\n${(file.content || '').substring(0, 90000)}`;
  }

  let parsedJson: any = {};
  try {
    const response = await generateContentWithFailover({
      primaryModel: getBackgroundTaskModel(),
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const rawText = response.text || '{}';
    let cleanText = rawText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '')
        .trim();
    }
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    parsedJson = JSON.parse(cleanText);
  } catch (e) {
    console.warn('LLM Character extraction warning/fallback:', e);
  }

  // Extracción determinista complementaria desde el texto
  const deterministicParsed = !file.isImage && rawContent ? parseDndSheetText(rawContent) : {};

  // Fusión inteligente de LLM, regex determinista y parseo directo sin inventar datos
  const finalAttributes: PlayerAttributes = {
    str: parsedJson.attributes?.str ?? deterministicParsed.attributes?.str ?? regexExtractions.attributes?.str ?? 10,
    dex: parsedJson.attributes?.dex ?? deterministicParsed.attributes?.dex ?? regexExtractions.attributes?.dex ?? 10,
    con: parsedJson.attributes?.con ?? deterministicParsed.attributes?.con ?? regexExtractions.attributes?.con ?? 10,
    int: parsedJson.attributes?.int ?? deterministicParsed.attributes?.int ?? regexExtractions.attributes?.int ?? 10,
    wis: parsedJson.attributes?.wis ?? deterministicParsed.attributes?.wis ?? regexExtractions.attributes?.wis ?? 10,
    cha: parsedJson.attributes?.cha ?? deterministicParsed.attributes?.cha ?? regexExtractions.attributes?.cha ?? 10
  };

  const rawInventory: InventoryItem[] = Array.isArray(parsedJson.inventory) && parsedJson.inventory.length > 0
    ? parsedJson.inventory.map((item: any, idx: number) => ({
        id: item.id || `inv_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}`,
        name: String(item.name || 'Objeto').trim(),
        category: ['weapon', 'armor', 'potion', 'scroll', 'magic', 'equipment', 'treasure', 'other'].includes(item.category) ? item.category : 'equipment',
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        weight: typeof item.weight === 'number' ? item.weight : undefined,
        equipped: Boolean(item.equipped),
        attuned: Boolean(item.attuned),
        description: item.description ? String(item.description).trim() : undefined,
        damageOrAc: item.damageOrAc ? String(item.damageOrAc).trim() : undefined,
        rarity: item.rarity || 'common',
        cost: item.cost ? String(item.cost).trim() : undefined,
        durationNote: item.durationNote ? String(item.durationNote).trim() : undefined
      }))
    : (deterministicParsed.inventory && deterministicParsed.inventory.length > 0 ? deterministicParsed.inventory : []);

  // Deduplicación y refinamiento con reglas oficiales (dos manos, oráculos, descarte de genéricos duplicados)
  const refinedInventory = refineAndDeduplicateInventory(rawInventory, rawContent);

  const finalCurrencies: PlayerCurrencies = {
    cp: Math.max(0, parseInt(parsedJson.currencies?.cp, 10) || deterministicParsed.currencies?.cp || 0),
    sp: Math.max(0, parseInt(parsedJson.currencies?.sp, 10) || deterministicParsed.currencies?.sp || 0),
    ep: Math.max(0, parseInt(parsedJson.currencies?.ep, 10) || deterministicParsed.currencies?.ep || 0),
    gp: Math.max(0, parseInt(parsedJson.currencies?.gp, 10) || deterministicParsed.currencies?.gp || 0),
    pp: Math.max(0, parseInt(parsedJson.currencies?.pp, 10) || deterministicParsed.currencies?.pp || 0)
  };

  const hpVal = typeof parsedJson.hp === 'number' ? parsedJson.hp : deterministicParsed.hp ?? regexExtractions.hp ?? 10;
  const maxHpVal = typeof parsedJson.maxHp === 'number' ? parsedJson.maxHp : deterministicParsed.maxHp ?? regexExtractions.maxHp ?? hpVal;

  const rawPc: PlayerCharacter = {
    name: parsedJson.name || deterministicParsed.name || file.name.replace(/\.[^/.]+$/, ''),
    race: parsedJson.race || deterministicParsed.race || '',
    class: parsedJson.class || deterministicParsed.class || '',
    subclass: parsedJson.subclass || deterministicParsed.subclass || '',
    level: parsedJson.level ? String(parsedJson.level) : deterministicParsed.level ? String(deterministicParsed.level) : '1',
    background: parsedJson.background || deterministicParsed.background || '',
    alignment: parsedJson.alignment || deterministicParsed.alignment || '',
    hp: hpVal,
    maxHp: maxHpVal,
    hitDice: parsedJson.hitDice || deterministicParsed.hitDice || regexExtractions.hitDice || '1d8',
    ac: typeof parsedJson.ac === 'number' ? parsedJson.ac : deterministicParsed.ac ?? regexExtractions.ac ?? 10,
    speed: parsedJson.speed || deterministicParsed.speed || regexExtractions.speed || '30 pies',
    initiative: parsedJson.initiative || deterministicParsed.initiative || regexExtractions.initiative || '+0',
    proficiencyBonus: typeof parsedJson.proficiencyBonus === 'number' ? parsedJson.proficiencyBonus : deterministicParsed.proficiencyBonus ?? regexExtractions.proficiencyBonus ?? 2,
    attributes: finalAttributes,
    savingThrowProficiencies: parsedJson.savingThrowProficiencies || deterministicParsed.savingThrowProficiencies || regexExtractions.savingThrowProficiencies || [],
    skillProficiencies: parsedJson.skillProficiencies || deterministicParsed.skillProficiencies || [],
    conditions: parsedJson.conditions || [],
    inventory: refinedInventory,
    currencies: finalCurrencies,
    spellcasting: parsedJson.spellcasting || deterministicParsed.spellcasting,
    traits: Array.isArray(parsedJson.traits) && parsedJson.traits.length > 0 ? parsedJson.traits : undefined,
    spells: Array.isArray(parsedJson.spells) && parsedJson.spells.length > 0 ? parsedJson.spells : undefined,
    languages: Array.isArray(parsedJson.languages) && parsedJson.languages.length > 0 ? parsedJson.languages : undefined,
    proficienciesAndLanguages: parsedJson.proficienciesAndLanguages || deterministicParsed.proficienciesAndLanguages || '',
    featuresAndTraits: parsedJson.featuresAndTraits || deterministicParsed.featuresAndTraits || '',
    appearance: parsedJson.appearance || '',
    personality: parsedJson.personality || '',
    ideals: parsedJson.ideals || '',
    bonds: parsedJson.bonds || '',
    flaws: parsedJson.flaws || '',
    backstory: parsedJson.backstory || '',
    notes: parsedJson.notes || '',
    sheetText: rawContent || parsedJson.sheetText || deterministicParsed.sheetText || ''
  };

  return validateCharacterEquipment(rawPc);
}

export async function analyzeUploadedImage(file: ProjectFile, base64: string): Promise<string> {
  const prompt = `Analiza esta imagen para la Memoria y Base de Conocimiento de una campaña de rol/fantasía.
1. Identifica claramente qué representa:
   - [MAPA]: Mapa geográfico, mapa de batalla o plano táctico con salas/rutas.
   - [RETRATO DE PERSONAJE / PNJ]: Rostro o cuerpo entero de un héroe, villano, aliada o criatura (especifica si se menciona su nombre).
   - [ESCENA / LUGAR]: Ilustración paisajística, edificio o atmósfera.
2. Describe detalladamente sus elementos visuales clave (geografía, salas, rutas, vestimenta, colores, armas o rasgos distintivos).
3. Señala cualquier detalle táctico o narrativo relevante para que el Game Master y la IA mantengan coherencia visual absoluta.
Sé estructurado y comienza indicando el tipo.`;
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const mimeType = file.mime || 'image/jpeg';

  const response = await generateContentWithFailover({
    primaryModel: getBackgroundTaskModel(),
    contents: {
      parts: [{ text: prompt }, { inlineData: { data: cleanBase64, mimeType } }]
    }
  });

  return response.text || '';
}

export async function analyzeNarrativeStyleFromDocument(
  text: string,
  fileName?: string
): Promise<string> {
  const prompt = `Analiza detalladamente cómo está escrito el siguiente fragmento o documento literario${
    fileName ? ` ("${fileName}")` : ''
  } y extrae una directiva de estilo narrativo precisa y evocadora para el Narrador/Game Master.

Aspectos a analizar:
1. Voz, persona y tiempo: ¿Narra en 1ª, 2ª o 3ª persona? ¿Pasado o presente? ¿Voz omnisciente, cercana o introspectiva?
2. Atmósfera y tono: ¿Grimdark, épico, solemne, gótico, realista, intimista, lírico o mordaz?
3. Cadencia y sintaxis: ¿Frases cortas y secas o subordinadas ricas y fluidas? Ritmo en acción y en calma.
4. Riqueza sensorial y léxico: Nivel de vocabulario, metáforas, descripciones táctiles, olfativas, visuales y sonoras.
5. Manejo del diálogo y el silencio: Cómo hablan los personajes y cómo se integran las réplicas en la prosa.

Devuelve de 2 a 3 párrafos redactados como DIRECTIVAS DIRECTAS E IMPERATIVAS para el Narrador (ejemplo: "Narra en tercera persona del pasado con una prosa envolvente y sensorial...", "Emplea un vocabulario rico pero sin barroquismo innecesario...").
NO resumas la trama ni menciones a los personajes de este documento concreto. Queremos la "pluma" y las reglas estilísticas, no la historia.

DOCUMENTO DE REFERENCIA:
${text.substring(0, 65000)}`;

  const response = await generateContentWithFailover({
    primaryModel: getBackgroundTaskModel(),
    contents: prompt
  });

  return (response.text || '').trim();
}

export async function extractStyleOrSystemFromFile(
  type: 'style' | 'system',
  file: ProjectFile
): Promise<string> {
  if (type === 'style') {
    return analyzeNarrativeStyleFromDocument(file.content || '', file.name);
  }
  const prompt = `Analiza el siguiente texto y extrae las reglas, mecánicas, sistema de juego o lore principal. Devuelve un resumen conciso (máximo 3 párrafos) que sirva como instrucción de sistema/reglas para un Game Master.\n\nTEXTO:\n${(file.content || '').substring(0, 50000)}`;

  const response = await generateContentWithFailover({
    primaryModel: getBackgroundTaskModel(),
    contents: prompt
  });

  return response.text || '';
}

/**
 * Cuenta los tokens REALES del turno, preguntándoselo a Google.
 *
 * El contador de la barra lateral es una estimación por caracteres, y una
 * estimación por caracteres siempre miente un poco: el tokenizador parte por
 * subpalabras, y el español con tildes, nombres propios inventados y palabras
 * largas no se comporta como el inglés. Esto llama a `countTokens` con el mismo
 * payload que se enviaría al narrar, así que el número coincide con el que se ve
 * en Google AI Studio.
 *
 * `countTokens` no consume cuota de generación.
 */
export async function countTurnTokens({
  project,
  currentChatId,
  chats,
  files
}: {
  project: Project;
  currentChatId: string;
  chats: Chat[];
  files: ProjectFile[];
}): Promise<{ total: number; sistema: number; conversacion: number; modelo: string }> {
  const ai = getAIClient();
  const modelo = getStoredModel();
  const dicePool = rollDicePool();

  const { sys, contents } = buildTurnPayload({
    project,
    currentChatId,
    chats,
    files,
    // Un turno en blanco: se mide el contexto que se arrastra, no lo que se escriba.
    userText: '',
    dicePool
  });

  const cuenta = async (payload: any) => {
    const res = await ai.models.countTokens(payload);
    return res.totalTokens ?? 0;
  };

  // Se cuentan por separado la instrucción de sistema y la conversación, y se
  // suman. Podría parecer más natural pasar `systemInstruction` en la propia
  // llamada, pero la API de desarrollador de Gemini no admite ese campo en
  // countTokens y responde «is not supported», que no se parece en nada al
  // problema real. Contar su texto como un turno más da el mismo número salvo
  // por el puñado de tokens de envoltorio del rol.
  const [sistema, conversacion] = await Promise.all([
    cuenta({ model: modelo, contents: [{ role: 'user', parts: [{ text: sys }] }] }),
    cuenta({ model: modelo, contents })
  ]);

  return {
    total: sistema + conversacion,
    sistema,
    conversacion,
    modelo
  };
}

// ---------------------------------------------------------------- deducir el calendario

export interface CalendarioDeducido {
  encontrado: boolean;
  confianza: 'alta' | 'media' | 'baja';
  /** De dónde lo ha sacado, para que la jugadora pueda darle o quitarle la razón. */
  evidencia: string;
  calendario: CalendarConfig | null;
  /** La fecha en el vocabulario del propio calendario, no en día del año. */
  fecha: { year: number; mes: string; dia: number; hora: number } | null;
}

/**
 * Lee los documentos y las primeras escenas para proponer en qué fecha empieza
 * la campaña, y con qué calendario.
 *
 * Es lo primero que debería existir: si subes un libro de tu ambientación, el año
 * y el mes en curso suelen estar escritos en la primera página, y teclearlos a
 * mano es trabajo que la máquina ya podía haberse ahorrado. Ahora bien, se
 * PROPONE, no se aplica: deducir una fecha es interpretar, y una fecha mal puesta
 * contamina toda la cronología de la partida.
 */
export async function deducirCalendario({
  project,
  files,
  chats
}: {
  project: Project;
  files: ProjectFile[];
  chats: Chat[];
}): Promise<CalendarioDeducido> {
  const fuentes = files
    .filter(f => !f.isImage && !f.isAudio && f.category !== 'style_sample')
    .map(f => `=== ${f.name} ===\n${(f.content || '').slice(0, 25000)}`)
    .join('\n\n')
    .slice(0, 90000);

  const primerRoleo = chats
    .flatMap(c => c.messages || [])
    .slice(0, 8)
    .map(m => `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`)
    .join('\n')
    .slice(0, 12000);

  const prompt = `Eres un archivero. Tu tarea es averiguar EN QUÉ FECHA Y CON QUÉ CALENDARIO transcurre esta campaña, leyendo el material que te doy.

Devuelve SOLO un objeto JSON con esta forma exacta:
{
  "encontrado": true o false,
  "confianza": "alta" | "media" | "baja",
  "evidencia": "la frase o dato concreto del material del que lo has deducido, citado brevemente. Si no has encontrado nada, explica en una línea qué has mirado.",
  "calendario": {
    "name": "nombre del calendario de esa ambientación, o 'Calendario de la campaña' si no tiene nombre propio",
    "months": [{ "name": "nombre del mes", "days": número de días }],
    "festivals": [{ "name": "nombre del día festivo intercalar", "afterMonth": índice del mes tras el que cae, empezando en 0 }],
    "weekdays": ["nombres de los días de la semana, o lista vacía si esa ambientación no los usa"],
    "yearSuffix": "cómo se nombra el año en esa ambientación (por ejemplo CV, ABY, d. C.), o cadena vacía"
  },
  "fecha": { "year": número, "mes": "nombre exacto de uno de los meses de arriba", "dia": número dentro de ese mes, "hora": hora del día de 0 a 23 }
}

REGLAS:
- Si el material define un calendario propio (meses con nombre, festivales, cómputo de años), reconstrúyelo con fidelidad. Si solo dice el año, usa doce meses de treinta días con nombres estacionales neutros y deja claro en la evidencia que el calendario es inventado por ti.
- Si el material no dice NADA sobre fechas, devuelve {"encontrado": false, "confianza": "baja", "evidencia": "...", "calendario": null, "fecha": null}. No te inventes una fecha para rellenar: es peor que no tener ninguna.
- La confianza es "alta" solo si la fecha está escrita explícitamente. "media" si la has deducido de un acontecimiento datable. "baja" si es una conjetura.
- Los días de todos los meses deben sumar un año coherente con lo que diga el material.

DOCUMENTOS DE LA CAMPAÑA:
${fuentes || 'No hay documentos de texto.'}

INSTRUCCIONES DE LA CAMPAÑA:
${(project.instructions || '').slice(0, 6000) || 'Sin instrucciones.'}

PRIMERAS ESCENAS JUGADAS:
${primerRoleo || 'Todavía no se ha jugado nada.'}`;

  const modelo = getBackgroundTaskModel();
  const response = await generateContentWithFailover({
    primaryModel: modelo,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      ...(esModeloAbierto(modelo)
        ? {}
        : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
    } as any
  });

  const raw = (response.text || '').trim();
  if (!raw) throw new Error('El Narrador no ha devuelto nada al buscar la fecha.');

  let limpio = raw
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  const a = limpio.indexOf('{');
  const b = limpio.lastIndexOf('}');
  if (a !== -1 && b > a) limpio = limpio.slice(a, b + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(limpio);
  } catch {
    throw new Error('La respuesta sobre la fecha no era un JSON válido. Prueba otra vez.');
  }

  // Saneado: un calendario con meses de cero días rompería toda la aritmética.
  const cal = parsed.calendario;
  if (parsed.encontrado && cal && Array.isArray(cal.months)) {
    cal.months = cal.months
      .filter((m: any) => m && typeof m.name === 'string' && m.name.trim())
      .map((m: any) => ({
        name: String(m.name).trim(),
        days: Math.max(1, Math.round(Number(m.days) || 30))
      }));
    cal.festivals = Array.isArray(cal.festivals)
      ? cal.festivals
          .filter((f: any) => f && typeof f.name === 'string' && f.name.trim())
          .map((f: any) => ({
            name: String(f.name).trim(),
            afterMonth: Math.min(Math.max(0, Math.round(Number(f.afterMonth) || 0)), cal.months.length - 1)
          }))
      : [];
    cal.weekdays = Array.isArray(cal.weekdays) ? cal.weekdays.map((d: any) => String(d)) : [];
    cal.yearSuffix = typeof cal.yearSuffix === 'string' ? cal.yearSuffix : '';
    cal.name = typeof cal.name === 'string' && cal.name.trim() ? cal.name.trim() : 'Calendario de la campaña';
    if (!cal.months.length) parsed.encontrado = false;
  }

  return {
    encontrado: Boolean(parsed.encontrado),
    confianza: ['alta', 'media', 'baja'].includes(parsed.confianza) ? parsed.confianza : 'baja',
    evidencia: String(parsed.evidencia || '').slice(0, 600),
    calendario: parsed.encontrado ? (cal as CalendarConfig) : null,
    fecha:
      parsed.encontrado && parsed.fecha
        ? {
            year: Math.max(1, Math.round(Number(parsed.fecha.year) || 1)),
            mes: String(parsed.fecha.mes || ''),
            dia: Math.max(1, Math.round(Number(parsed.fecha.dia) || 1)),
            hora: Math.min(23, Math.max(0, Math.round(Number(parsed.fecha.hora) ?? 8)))
          }
        : null
  };
}

/**
 * Pregunta a Google qué modelos admite realmente esta clave.
 *
 * La lista de arriba está escrita a mano y envejece: Google retira modelos y saca
 * otros sin avisar, y el día que uno desaparece el error que devuelve no dice
 * «este modelo ya no existe», dice cosas mucho menos claras. Esto evita adivinar.
 */
export async function listarModelosDeLaClave(): Promise<
  { id: string; nombre: string; entrada: number; salida: number }[]
> {
  const ai = getAIClient();
  const salida: { id: string; nombre: string; entrada: number; salida: number }[] = [];

  const paginas = await ai.models.list();
  for await (const m of paginas) {
    const nombreCompleto = String((m as any).name || '');
    const id = nombreCompleto.replace(/^models\//, '');
    if (!id) continue;
    // Solo los que sirven para narrar: fuera los de embeddings, imagen y voz.
    const acciones: string[] = (m as any).supportedActions || (m as any).supportedGenerationMethods || [];
    if (acciones.length && !acciones.some(a => /generateContent/i.test(a))) continue;
    if (/embedding|aqa|imagen|veo|tts|image-generation/i.test(id)) continue;
    salida.push({
      id,
      nombre: String((m as any).displayName || id),
      entrada: Number((m as any).inputTokenLimit || 0),
      salida: Number((m as any).outputTokenLimit || 0)
    });
  }

  return salida.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Deja de una hoja de oráculo solo lo que hace falta para usarla.
 *
 * Estos documentos suelen ser una página de tablas envuelta en diez de ejemplos
 * de partida, comentario de diseño y créditos. Todo eso viaja al modelo en cada
 * turno sin aportar nada: para resolver una consulta necesita los números y las
 * reglas, no la anécdota de cómo le fue a otra jugadora.
 *
 * El resultado se guarda como análisis del archivo, así que puede leerse y
 * corregirse a mano antes de fiarse de él.
 */
export async function destilarTablaOraculo(file: ProjectFile): Promise<string> {
  const texto = (file.content || '').trim();
  if (!texto) throw new Error('Ese archivo no tiene texto que destilar.');

  const prompt = `Te doy el texto extraído de un documento de oráculo para juego de rol en solitario. Devuélveme SOLO lo imprescindible para poder usarlo durante una partida.

QUÉ CONSERVAR, literalmente y sin resumir:
- Todas las tablas, con TODAS sus filas, columnas y rangos numéricos exactos. Un número mal copiado inutiliza la tabla entera.
- Las reglas de uso: cómo se formula una consulta, cómo se elige la probabilidad, qué se tira, cómo se lee el resultado, qué significa cada respuesta posible y qué dispara un suceso inesperado.

QUÉ ELIMINAR:
- Ejemplos de partida, transcripciones y anécdotas de juego.
- Introducciones, comentario del autor sobre el diseño, agradecimientos, créditos, direcciones, avisos de copyright, números de página y encabezados repetidos.
- Cualquier sección repetida: si el documento trae la misma hoja dos veces (por ejemplo, una versión para imprimir), deja una sola.

FORMATO:
- Markdown, con las tablas como tablas y las reglas como listas cortas.
- Conserva el idioma original del documento.
- No añadas nada de tu cosecha, ni comentarios, ni explicaciones sobre lo que has hecho. Solo el contenido destilado.

TEXTO DEL DOCUMENTO:
${texto.slice(0, 200000)}`;

  const modelo = getBackgroundTaskModel();
  const response = await generateContentWithFailover({
    primaryModel: modelo,
    contents: prompt,
    config: {
      temperature: 0,
      ...(esModeloAbierto(modelo)
        ? {}
        : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
    } as any
  });

  const salida = (response.text || '').trim();
  if (!salida) throw new Error('El modelo no ha devuelto nada al destilar la tabla.');

  // Si el destilado sale casi tan largo como el original no ha destilado nada, y
  // es mejor decirlo que guardar una copia disfrazada de mejora.
  if (salida.length > texto.length * 0.9) {
    throw new Error(
      'El destilado ha salido casi tan largo como el original, así que no ahorraría nada. Probablemente el documento ya sea casi todo tablas.'
    );
  }

  return salida;
}

/**
 * Saca de un documento de lore la lista de quién es quién.
 *
 * El problema que resuelve no es que el modelo no sepa: es que no busca. Al
 * escribir «el lugarteniente de la banda» no va a repasar trescientas páginas
 * para ver si ese puesto ya tiene dueño; genera un nombre plausible y sigue. Y
 * la búsqueda por palabras tampoco lo salva, porque nadie busca «Kimmuriel» sin
 * saber que Kimmuriel existe.
 *
 * Así que el manual entero se queda de consulta y de él se extrae esto: una
 * línea por nombre propio, lo bastante corta para viajar en todos los turnos.
 * Se procesa por tramos porque los documentos de ambientación son largos, y se
 * funde al final para que un nombre que sale en tres capítulos no salga tres
 * veces en la lista.
 */
export async function extraerElenco(file: ProjectFile): Promise<string> {
  return destilarPorTramos(
    file,
    'del que extraer el elenco',
    'Te doy un fragmento de un documento de ambientación para juego de rol. Extrae de él la lista de quién es quién.',
    `QUÉ BUSCAR: todo lo que tenga NOMBRE PROPIO y pueda aparecer en una escena.
- Personas: nombre completo, qué son, de quién dependen y un rasgo que las distinga de cualquier otro de su gremio.
- Lugares con nombre: locales, fortalezas, barrios, ciudades. Di QUÉ CLASE de sitio es de verdad, aunque contradiga lo que su categoría sugiere: si es un casino de lujo con clientela distinguida, eso es lo que hay que poner, y no «taberna». Añade entre paréntesis la ciudad o región donde está.
- Organizaciones: bandas, casas, gremios, órdenes, con quién las manda y a qué se dedican.

QUÉ NO INCLUIR: figurantes sin nombre, objetos corrientes, conceptos, reglas de juego, títulos de capítulo.

FORMATO, exactamente este y nada más:
## Personas
- **Nombre Completo** — cargo o papel, de quién depende; el rasgo que lo hace reconocible.
## Lugares
- **Nombre del sitio** (ciudad) — qué clase de sitio es, de quién es, quién lo frecuenta.
## Organizaciones
- **Nombre** — a qué se dedica, quién manda, dónde opera.

Una línea por entrada, máximo unas veinticinco palabras. Sin introducción, sin comentarios, sin explicar lo que has hecho. Conserva el idioma del documento. Si una sección se queda vacía, omite su encabezado.`
  );
}

/**
 * Saca de una aventura publicada el índice de lo que trae dentro.
 *
 * Un módulo de trescientas páginas queda de consulta, y de consulta solo se
 * rescata lo que se pregunta. El problema es que nadie pregunta por lo que no
 * sabe que está ahí: si la campaña navega hacia el sur y en el manual duerme un
 * bergantín de contrabandistas, no aparece, porque en la escena no se ha
 * nombrado y la búsqueda solo encuentra lo que se le nombra.
 *
 * El índice rompe ese círculo. Va siempre presente, ocupa poco, y hace dos
 * cosas a la vez: le dice al Narrador qué material tiene disponible, y le da las
 * palabras exactas —el nombre del barco, el del pueblo, el del culto— con las
 * que la búsqueda sí traerá el capítulo entero en el turno siguiente.
 */
export async function extraerIndice(file: ProjectFile): Promise<string> {
  return destilarPorTramos(
    file,
    'del que extraer el índice',
    'Te doy un fragmento de una aventura o módulo publicado para juego de rol. Haz el índice de lo que se puede JUGAR en él.',
    `QUÉ BUSCAR: las situaciones, no la información. Cada entrada es algo que podría pasarle a un grupo de aventureros.
- Capítulos y escenas con nombre: qué situación plantea cada uno, quién está detrás y cómo se entra en ella.
- Lugares donde ocurre algo: el sitio, qué se cuece dentro, quién manda allí.
- Ganchos sueltos: rumores, encargos, amenazas en marcha, encuentros preparados.

Nombra siempre con nombre propio: el bergantín, la posada, el culto, el villano. Esos nombres son lo más importante de la entrada, porque son la palabra por la que luego se buscará el capítulo entero.

QUÉ NO INCLUIR: reglas, estadísticas de monstruos, tablas de botín, consejos al director, apéndices, créditos.

FORMATO, exactamente este y nada más:
## Capítulos
- **Nombre del capítulo** — qué pasa, quién está detrás, cómo se llega.
## Lugares
- **Nombre del sitio** — qué se cuece dentro y de quién es.
## Ganchos
- **Nombre corto** — la situación en marcha y qué la dispara.

Una línea por entrada, máximo unas veinticinco palabras. Sin introducción, sin comentarios, sin explicar lo que has hecho. Conserva el idioma del documento. Si una sección se queda vacía, omite su encabezado.`
  );
}

/**
 * El motor común de los dos extractores: trocear, destilar tramo a tramo y
 * fundir. Va por tramos porque los manuales son largos y un modelo pequeño, al
 * pasarle doscientas páginas de golpe, empieza a saltarse lo del final.
 */
async function destilarPorTramos(
  file: ProjectFile,
  queja: string,
  encabezado: string,
  REGLAS: string
): Promise<string> {
  const texto = (file.content || '').trim();
  if (!texto) throw new Error(`Ese archivo no tiene texto ${queja}.`);

  const modelo = getBackgroundTaskModel();
  const config = {
    temperature: 0,
    ...(esModeloAbierto(modelo) ? {} : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
  } as any;

  const TRAMO = 60000;
  const tramos: string[] = [];
  for (let i = 0; i < texto.length && tramos.length < 12; i += TRAMO) {
    tramos.push(texto.slice(i, i + TRAMO));
  }

  const parciales: string[] = [];
  for (const tramo of tramos) {
    const response = await generateContentWithFailover({
      primaryModel: modelo,
      contents: `${encabezado}

${REGLAS}

FRAGMENTO:
${tramo}`,
      config
    });
    const parcial = (response.text || '').trim();
    if (parcial) parciales.push(parcial);
  }

  if (!parciales.length) throw new Error('El modelo no ha devuelto nada.');
  if (parciales.length === 1) return parciales[0];

  const fusion = await generateContentWithFailover({
    primaryModel: modelo,
    contents: `Te doy varias listas sacadas de tramos distintos del mismo documento. Fúndelas en una sola.

- Un nombre que aparezca en varias listas va UNA sola vez, quedándote con la descripción más informativa o combinándolas si se complementan.
- No inventes entradas nuevas ni añadas datos que no estén en las listas.
- Ordena cada sección alfabéticamente.
- Devuelve solo la lista fundida, con el mismo formato de encabezados y viñetas.

${parciales.map((p, i) => `=== LISTA ${i + 1} ===\n${p}`).join('\n\n')}`,
    config
  });

  const salida = (fusion.text || '').trim();
  if (!salida) throw new Error('El modelo no ha devuelto nada al fundir las listas.');
  return salida;
}

export interface NoticiaSaltoTemporalGenerada {
  diaOffset: number; // día 1, día 2... dentro del salto
  tipo: 'noticia' | 'rumor' | 'inconsciencia' | 'acontecimiento';
  titulo: string;
  resumen: string;
  fuenteOClima?: string;
  lugar?: string;
  hito?: string;
  hiloConsecuencia?: {
    titulo: string;
    efecto: string;
    venceEnDias: number;
    oculto: boolean;
  };
}

/**
 * Genera noticias del mundo, rumores de taberna y bandos de pregoneros
 * ocurridos durante un salto temporal o período de convalecencia/inconsciencia.
 */
export async function generarNoticiasSaltoTemporal({
  project,
  dias,
  motivo,
  lugar
}: {
  project: Project;
  dias: number;
  motivo?: string;
  lugar?: string;
}): Promise<NoticiaSaltoTemporalGenerada[]> {
  const modelo = getBackgroundTaskModel();
  const pc = project.memory?.player_character;
  const config = {
    temperature: 0.7,
    responseMimeType: 'application/json',
    ...(esModeloAbierto(modelo) ? {} : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
  } as any;

  const prompt = `Eres el Director de Juego de una campaña de rol en solitario.
El protagonista (${pc?.name || 'el protagonista'}) ha estado ${motivo || 'inconsciente / ausente'} durante ${dias} días en ${lugar || 'la región'}.

El mundo no se ha detenido. Genera entre 1 y ${Math.min(dias, 4)} acontecimientos o noticias de fondo que ocurrieron en el mundo durante esos ${dias} días de salto temporal, de los cuales el protagonista se enterará al despertar (por pregoneros, tablones de anuncios, gacetas, curanderos o rumores de taberna).
Por ejemplo: guerras o ataques militares (como "Thay atacó Neverwinter"), intrigas políticas, bandos municipales, robos del gremio de ladrones, movimientos de facciones, o sucesos locales.

Devuelve un array JSON con objetos de la estructura:
[
  {
    "diaOffset": 1, // en qué día del salto ocurrió (1 a ${dias})
    "tipo": "noticia" | "rumor" | "inconsciencia" | "acontecimiento",
    "titulo": "Título corto y evocador",
    "resumen": "Descripción en 1-2 frases vívidas en tono de crónica o rumor",
    "fuenteOClima": "Pregoneros / Tablón de anuncios / Curanderos / Taberna",
    "lugar": "Ciudad o región",
    "hito": "noticia — Breve mención",
    "hiloConsecuencia": { // opcional, si deja una consecuencia en marcha
      "titulo": "Título de hilo futuro",
      "efecto": "Qué ocurrirá",
      "venceEnDias": 10,
      "oculto": false
    }
  }
]`;

  const response = await generateContentWithFailover({
    primaryModel: modelo,
    contents: prompt,
    config
  });

  const raw = (response.text || '').trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item, idx) => ({
        diaOffset: typeof item.diaOffset === 'number' ? Math.max(0, Math.min(dias, item.diaOffset)) : idx + 1,
        tipo: item.tipo || 'noticia',
        titulo: String(item.titulo || 'Noticia del mundo'),
        resumen: String(item.resumen || ''),
        fuenteOClima: item.fuenteOClima ? String(item.fuenteOClima) : undefined,
        lugar: item.lugar ? String(item.lugar) : lugar,
        hito: item.hito ? String(item.hito) : `noticia — ${item.titulo || 'Evento mundial'}`,
        hiloConsecuencia: item.hiloConsecuencia
      }));
    }
  } catch (e) {
    console.warn('Error parsing noticias json:', e);
  }
  return [];
}

export interface ResincronizacionCronologia {
  timeline: TimelineEntry[];
  currentDate: CampaignDate;
  threads: ScheduledThread[];
  resumen: string;
  diasDetectados: number;
}

/**
 * Lee todo el historial de la partida (capítulos, escenas, descansos y viajes)
 * y reconstruye la cronología completa de días, acontecimientos, clima, lugares
 * e hilos de consecuencias.
 */
export async function resincronizarCronologiaDesdeChat({
  project,
  chats
}: {
  project: Project;
  chats: Chat[];
}): Promise<ResincronizacionCronologia> {
  const cal = project.calendar;
  if (!calendarioValido(cal)) {
    throw new Error('Debes activar un calendario en la campaña antes de sincronizar la cronología.');
  }

  // Recopilar mensajes ordenados cronológicamente
  const chatMessages = chats
    .flatMap(c => (c.messages || []).map(m => ({
      chatId: c.id,
      chatName: c.name,
      role: m.role,
      content: m.content
    })))
    .filter(m => m.content && m.content.trim().length > 0);

  if (chatMessages.length === 0) {
    throw new Error('No hay mensajes de rol en la campaña para reconstruir la cronología.');
  }

  const roleoTexto = chatMessages
    .map(m => `[Capítulo: ${m.chatName}] ${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`)
    .join('\n\n')
    .slice(0, 95000);

  const initDate = project.currentDate || fechaInicial(1);
  const startAbs = aDiaAbsoluto(cal, initDate);

  const prompt = `Eres el Archivero y Cronista Maestro de esta campaña de rol.
Tu misión es LEER TODO EL HISTORIAL DE PARTIDA (capítulos, escenas, descansos, viajes y combates) y RECONSTRUIR LA CRONOLOGÍA DÍA A DÍA con total coherencia temporal.

CALENDARIO DE LA CAMPAÑA:
- Nombre: ${cal.name}
- Días por año: ${diasPorAno(cal)}
- Meses: ${cal.months.map(m => `${m.name} (${m.days}d)`).join(', ')}
- Fecha de inicio estimada: Día ${initDate.dayOfYear}, Año ${initDate.year}, Hora ${Math.floor(initDate.minute / 60)}:00

HISTORIAL DE LA PARTIDA:
${roleoTexto}

INSTRUCCIONES:
1. Analiza cada salto temporal, descanso largo (pasa al día siguiente o +8h), descanso corto (1-2 horas), viaje (días transcurridos) o evento transcurrido en el relato.
2. Construye un listado cronológico de entradas de diario (timeline) para cada día en que ocurrieron hechos relevantes.
3. Para cada día/evento indica:
   - "diaOffset": número de días transcurridos desde el inicio de la campaña (0 = día de inicio, 1 = día 2, 2 = día 3, etc.)
   - "horaAprox": hora aproximada del suceso (0 a 23)
   - "resumen": resumen narrativo claro y evocador en 1-3 frases de lo acontecido en ese día o escena.
   - "lugar": ubicación o región donde transcurre.
   - "clima": clima o atmósfera del día si se menciona o es deducible (ej. "Lluvia otoñal", "Cielo despejado y gélido", "Niebla espesa").
   - "hito": suceso clave o etiqueta de hito (ej. "Victoria en el molino", "Llegada a Phandalin", "Pacto con la bruja").
   - "tipo": "sesion" | "descanso" | "viaje" | "combate" | "noticia"
4. Identifica posibles "hilos" o consecuencias programadas pendientes (ej. "La guardia investigará en 3 días", "La poción dura 24 horas").
5. Calcula la fecha final exacta de la campaña (año, día del año, minuto/hora) al terminar la última escena relatada.

Devuelve EXCLUSIVAMENTE un objeto JSON con este formato:
{
  "diasTranscurridosTotal": número,
  "fechaFinal": { "year": número, "dayOfYear": número, "minute": número (0 a 1439) },
  "resumenGlobal": "Resumen en 2 líneas de la cronología recuperada",
  "entradas": [
    {
      "diaOffset": 0,
      "horaAprox": 14,
      "resumen": "Descripción del suceso",
      "lugar": "Nombre del lugar",
      "clima": "Clima",
      "hito": "Hito clave",
      "tipo": "sesion"
    }
  ],
  "hilosPendientes": [
    {
      "title": "Nombre del hilo",
      "effect": "Consecuencia que se activará",
      "venceEnDiasDesdeInicio": número,
      "hidden": false
    }
  ]
}`;

  const modelo = getBackgroundTaskModel();
  const response = await generateContentWithFailover({
    primaryModel: modelo,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      ...(esModeloAbierto(modelo)
        ? {}
        : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
    } as any
  });

  const raw = (response.text || '').trim();
  if (!raw) throw new Error('El modelo no devolvió datos de cronología.');

  let limpio = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const a = limpio.indexOf('{');
  const b = limpio.lastIndexOf('}');
  if (a !== -1 && b > a) limpio = limpio.slice(a, b + 1);

  const parsed = JSON.parse(limpio);
  
  const entries: TimelineEntry[] = [];
  if (Array.isArray(parsed.entradas)) {
    parsed.entradas.forEach((e: any, idx: number) => {
      const offset = typeof e.diaOffset === 'number' ? Math.max(0, e.diaOffset) : idx;
      const targetAbs = startAbs + offset;
      const entryDateObj = desdeDiaAbsoluto(cal, targetAbs);
      const minute = typeof e.minute === 'number' ? e.minute : (typeof e.horaAprox === 'number' ? e.horaAprox * 60 : 720);

      entries.push({
        id: `resync_${targetAbs}_${idx}_${Date.now().toString(36)}`,
        absDay: targetAbs,
        date: fechaLegible(cal, entryDateObj),
        summary: String(e.resumen || '').trim(),
        lugar: e.lugar ? String(e.lugar).trim() : undefined,
        clima: e.clima ? String(e.clima).trim() : undefined,
        hito: e.hito ? String(e.hito).trim() : undefined,
        minute,
        tipo: e.tipo || 'sesion'
      });
    });
  }

  // Ordenar cronológicamente por día y minuto
  entries.sort((x, y) => x.absDay === y.absDay ? (x.minute || 0) - (y.minute || 0) : x.absDay - y.absDay);

  let newCurrentDate: CampaignDate = initDate;
  if (parsed.fechaFinal && typeof parsed.fechaFinal.dayOfYear === 'number') {
    newCurrentDate = {
      year: typeof parsed.fechaFinal.year === 'number' ? parsed.fechaFinal.year : initDate.year,
      dayOfYear: Math.max(1, Math.min(diasPorAno(cal), parsed.fechaFinal.dayOfYear)),
      minute: typeof parsed.fechaFinal.minute === 'number' ? parsed.fechaFinal.minute : 720
    };
  } else if (entries.length > 0) {
    const lastEntry = entries[entries.length - 1];
    const lastDateObj = desdeDiaAbsoluto(cal, lastEntry.absDay);
    newCurrentDate = {
      year: lastDateObj.year,
      dayOfYear: lastDateObj.dayOfYear,
      minute: lastEntry.minute || 720
    };
  }

  const newThreads: ScheduledThread[] = [];
  if (Array.isArray(parsed.hilosPendientes)) {
    parsed.hilosPendientes.forEach((h: any, idx: number) => {
      const offset = typeof h.venceEnDiasDesdeInicio === 'number' ? h.venceEnDiasDesdeInicio : 5;
      const dueAbs = startAbs + offset;
      newThreads.push({
        id: `resync_thread_${dueAbs}_${idx}_${Date.now().toString(36)}`,
        title: String(h.title || 'Consecuencia pendiente').trim(),
        effect: String(h.effect || h.title || '').trim(),
        dueAbsDay: dueAbs,
        dueDate: fechaLegible(cal, desdeDiaAbsoluto(cal, dueAbs)),
        hidden: Boolean(h.hidden),
        status: 'pending',
        origin: 'narrador'
      });
    });
  }

  const diasUnicos = new Set(entries.map(e => e.absDay)).size;

  return {
    timeline: entries,
    currentDate: newCurrentDate,
    threads: newThreads,
    resumen: parsed.resumenGlobal || `Cronología reconstruida: ${entries.length} acontecimientos en ${diasUnicos} días.`,
    diasDetectados: diasUnicos
  };
}

