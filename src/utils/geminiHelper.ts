import { GoogleGenAI } from '@google/genai';
import {
  Project,
  Chat,
  ProjectFile,
  Memory,
  FileCategory,
  NPC,
  PlayerCharacter,
  CalendarConfig,
  CampaignDate,
  TimelineEntry,
  ScheduledThread
} from '../types';
import { CORE_INTERFACE_PROTOCOLS, DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE } from './defaultDirectives';
import { registrarUso } from './usageStats';
import {
  CALENDARIO_HARPTOS,
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
import { logError, logWarn, logInfo } from './logger';
import { sanitizePlayerCharacter } from './sanitizers';

// In-app API key & model management (stored locally in the user's browser)
export interface AIModelOption {
  id: string;
  name: string;
  badge: string;
  desc: string;
}

export const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Recomendado · Híbrido y Rápido',
    desc: 'Modelo insignia con razonamiento adaptativo, narración fluida y detección precisa de mecánicas de rol.'
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Ligero · Ahorro de cuota',
    desc: 'Optimizado para máxima velocidad y consumo mínimo de tokens, ideal para sesiones continuas.'
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Máxima Inteligencia · Prosa rica',
    desc: 'El modelo superior para razonamiento profundo, prosa literaria exquisita y coherencia impecable en tramas complejas.'
  }
];

export function esModeloAbierto(modelId: string): boolean {
  return /^gemma/i.test(modelId.trim());
}

export function isModelDeprecated(modelId: string): boolean {
  if (!modelId) return true;
  const m = modelId.toLowerCase().trim();
  return (
    m.includes('1.5') ||
    m.includes('2.0') ||
    m.includes('2.5') ||
    m === 'gemini-pro' ||
    m === 'gemini-flash' ||
    m.includes('thinking-exp') ||
    m.includes('flash-thinking')
  );
}

export const DEFAULT_MODEL_ID = 'gemini-3.7-flash';
export const DEFAULT_BACKGROUND_MODEL_ID = 'gemini-3.1-flash-lite';
export const BACKGROUND_LIGHTWEIGHT_MODEL_ID = 'gemini-3.1-flash-lite';

export function sanitizeModelId(modelId: string, fallback: string = DEFAULT_MODEL_ID): string {
  if (!modelId || isModelDeprecated(modelId)) {
    return fallback;
  }
  return modelId.trim();
}

// ---------------------------------------------------------------- catálogo vivo de modelos

export interface ModeloDelCatalogo {
  id: string;
  nombre: string;
  entrada: number;
  salida: number;
}

interface CatalogoGuardado {
  modelos: ModeloDelCatalogo[];
  actualizado: number;
}

const CLAVE_CATALOGO = 'gmstudio_catalogo_modelos';
const EDAD_MAXIMA_CATALOGO_MS = 24 * 60 * 60 * 1000;

/**
 * Lo que la clave admite de verdad, guardado de la última consulta.
 *
 * La lista escrita a mano de aquí arriba envejece: Google retira modelos y saca
 * otros sin avisar, y el día que uno desaparece hay que entrar a tocar el
 * código. Esto pregunta a Google en segundo plano y se queda con la respuesta,
 * así que la aplicación se entera sola.
 */
export function leerCatalogoModelos(): CatalogoGuardado | null {
  try {
    const raw = localStorage.getItem(CLAVE_CATALOGO);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.modelos)) return null;
    return { modelos: parsed.modelos, actualizado: Number(parsed.actualizado) || 0 };
  } catch {
    return null;
  }
}

export function catalogoEstaViejo(maxEdadMs: number = EDAD_MAXIMA_CATALOGO_MS): boolean {
  const guardado = leerCatalogoModelos();
  if (!guardado) return true;
  return Date.now() - guardado.actualizado > maxEdadMs;
}

export async function refrescarCatalogoModelos(): Promise<ModeloDelCatalogo[]> {
  const modelos = await listarModelosDeLaClave();
  // Una lista vacía no se guarda. Guardarla sellaría veinticuatro horas de
  // «tu clave no admite ningún modelo» a partir de una respuesta rara o una
  // consulta que salió a medias, y durante ese día la aplicación avisaría de
  // modelos ausentes que están perfectamente.
  if (modelos.length === 0) return modelos;
  try {
    localStorage.setItem(CLAVE_CATALOGO, JSON.stringify({ modelos, actualizado: Date.now() }));
  } catch {
    // Sin sitio en localStorage: se seguirá preguntando, que es lo de antes.
  }
  return modelos;
}

let refrescoDeCatalogoEnMarcha = false;

/**
 * Pone al día el catálogo sin que nadie lo pida y sin estorbar.
 *
 * Se llama al abrir la aplicación. Si no hay clave, o la lista es de hace menos
 * de un día, no hace nada: no se gasta una petición en algo que cambia como
 * mucho cada varios meses. `models.list` no consume cuota de generación.
 */
export function refrescarCatalogoEnSegundoPlano(): void {
  if (refrescoDeCatalogoEnMarcha) return;
  if (!hasConfiguredApiKey()) return;
  if (!catalogoEstaViejo()) return;
  refrescoDeCatalogoEnMarcha = true;
  refrescarCatalogoModelos()
    .then(modelos => {
      logInfo('general', `Catálogo de modelos actualizado (${modelos.length})`, `Google admite ${modelos.length} modelos de narración con tu clave.`);
    })
    .catch(err => {
      // Que falle no rompe nada: se sigue con la lista escrita a mano.
      logWarn('general', 'No se pudo actualizar el catálogo de modelos', describeApiError(err));
    })
    .finally(() => {
      refrescoDeCatalogoEnMarcha = false;
    });
}

/**
 * Si la clave admite este modelo. `null` cuando todavía no se ha consultado
 * nunca: es distinto de saber que no está, y no debe pintarse como un error.
 */
export function modeloDisponible(modelId: string): boolean | null {
  const guardado = leerCatalogoModelos();
  if (!guardado || guardado.modelos.length === 0) return null;
  const id = modelId.trim().toLowerCase();
  return guardado.modelos.some(m => m.id.toLowerCase() === id);
}

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
  const safeInitial = sanitizeModelId(initialModel, DEFAULT_MODEL_ID);
  const standardFallbacks = [
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview'
  ];
  // Con el respaldo apagado se usa el modelo elegido y punto. Antes esta rama
  // devolvía exactamente la misma cadena que la de abajo, así que el interruptor
  // no apagaba nada: quien fijaba un modelo seguía viendo cómo la app saltaba a
  // otro a la primera saturación.
  if (!getStoredAutoFailover()) {
    return [safeInitial];
  }
  const chain: string[] = [safeInitial];
  for (const m of standardFallbacks) {
    if (!chain.includes(m) && !isModelDeprecated(m)) {
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
    if (isModelDeprecated(trimmed)) {
      localStorage.setItem('gemini_background_model', DEFAULT_BACKGROUND_MODEL_ID);
      return DEFAULT_BACKGROUND_MODEL_ID;
    }
    const validIds = AVAILABLE_MODELS.map(m => m.id);
    if (validIds.includes(trimmed)) return trimmed;
    if (/^(gemini|gemma)[\w.-]*$/i.test(trimmed)) return trimmed;
  }
  return DEFAULT_BACKGROUND_MODEL_ID;
}

export function setStoredBackgroundModel(modelId: string): void {
  const safe = sanitizeModelId(modelId, DEFAULT_BACKGROUND_MODEL_ID);
  localStorage.setItem('gemini_background_model', safe);
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
    if (isModelDeprecated(trimmed)) {
      localStorage.setItem('gemini_model', DEFAULT_MODEL_ID);
      return DEFAULT_MODEL_ID;
    }
    const validIds = AVAILABLE_MODELS.map(m => m.id);
    if (validIds.includes(trimmed)) return trimmed;
    // Un identificador escrito a mano en el panel del Motor también vale; solo se
    // descartan restos de versiones anteriores que ya no son nombres de modelo.
    if (/^(gemini|gemma)[\w.-]*$/i.test(trimmed)) return trimmed;
  }
  return DEFAULT_MODEL_ID;
}

export function setStoredModel(modelId: string): void {
  const safe = sanitizeModelId(modelId, DEFAULT_MODEL_ID);
  localStorage.setItem('gemini_model', safe);
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
  return 'AUTO';
}

export function setStoredThinkingLevel(level: ThinkingLevelSetting): void {
  localStorage.setItem('gemini_thinking_level', level);
}

export function getThinkingBudgetConfig(thinkingSetting: ThinkingLevelSetting, modelId?: string) {
  // Models in Gemini 2.5 and Gemma series do not support thinkingConfig
  if (modelId && !modelId.includes('3.7') && !modelId.includes('3.1') && !modelId.includes('gemini-3')) {
    return undefined;
  }
  if (thinkingSetting === 'HIGH') return { thinkingBudget: 4096 };
  if (thinkingSetting === 'LOW') return { thinkingBudget: 1024 };
  if (thinkingSetting === 'MINIMAL') return { thinkingBudget: 0 };
  return undefined; // AUTO: let Gemini 3 model dynamically determine reasoning budget
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
    'HARM_CATEGORY_DANGEROUS_CONTENT'
  ];
  // HARM_CATEGORY_CIVIC_INTEGRITY se quedó fuera a propósito: los modelos nuevos
  // ya no la admiten y rechazan la petición ENTERA con un 400 INVALID_ARGUMENT.
  // Una categoría que ni siquiera se estaba filtrando no vale tumbar cada turno.
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

export function cleanApiKey(raw: string): string {
  if (!raw) return '';
  let key = String(raw).trim();
  // Limpieza de caracteres invisibles, BOM y espacios de ancho cero
  key = key.replace(/[\uFEFF\u200B\u200C\u200D\u2060\u00A0\u180E\u2000-\u200A\u202F\u205F\u3000]/g, '').trim();
  // Limpieza de comillas circundantes
  key = key.replace(/^["'`]|["'`]$/g, '').trim();
  // Extracción si viene en formato KEY=... o GEMINI_API_KEY=...
  if (key.includes('=')) {
    const parts = key.split('=');
    const val = parts[parts.length - 1].trim().replace(/^["'`]|["'`]$/g, '');
    if (val.length >= 15) {
      key = val;
    }
  }
  // Eliminar signos de puntuación no alfanuméricos en extremos
  key = key.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
  return key;
}

export function getStoredApiKeys(): string[] {
  const localList = localStorage.getItem('gemini_api_keys');
  if (localList) {
    try {
      const parsed = JSON.parse(localList);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map((k: any) => cleanApiKey(typeof k === 'string' ? k : '')).filter(Boolean);
        if (cleaned.length > 0) return cleaned;
      }
    } catch {}
  }
  const single = localStorage.getItem('gemini_api_key');
  if (single) {
    const c = cleanApiKey(single);
    if (c) return [c];
  }
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey !== 'MY_GEMINI_API_KEY') {
    const c = cleanApiKey(envKey);
    if (c) return [c];
  }
  return [];
}

export function setStoredApiKeys(keys: string[]): void {
  const cleaned = keys.map(k => cleanApiKey(k)).filter(Boolean);
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
  const clean = cleanApiKey(key);
  if (clean) {
    keyCooldownMap.set(clean, Date.now() + durationMs);
  }
}

export function isKeyInCooldown(key: string): boolean {
  const clean = cleanApiKey(key);
  if (!clean) return false;
  const expiry = keyCooldownMap.get(clean);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    keyCooldownMap.delete(clean);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------- leer lo que Google responde

/**
 * Lo que ha fallado de verdad, en una forma con la que se pueda decidir.
 *
 * El SDK lanza `ApiError` con el código HTTP en `status` y el cuerpo JSON de
 * Google en `message`. Antes esto se adivinaba con expresiones regulares sobre
 * el texto, y adivinar salía caro: un 400 por un campo mal puesto se leía como
 * «clave inválida» y descartaba las tres claves del bolsillo de una vez, así que
 * el turno moría al primer intento aunque las claves estuvieran perfectas. El
 * código y el estado simbólico de Google son la fuente; el texto, el último
 * recurso.
 */
export interface ApiFailure {
  /** Código HTTP. 0 si no llegó a haber respuesta: red caída o petición cancelada. */
  status: number;
  /** El estado simbólico de Google: RESOURCE_EXHAUSTED, INVALID_ARGUMENT, NOT_FOUND... */
  googleStatus: string;
  isRateLimit: boolean;
  isOverloaded: boolean;
  /** La clave no sirve. SOLO esto justifica retirarla del bolsillo. */
  isInvalidKey: boolean;
  isPermissionDenied: boolean;
  /** El modelo no existe o esta clave no lo admite: toca cambiar de modelo, no de clave. */
  isModelMissing: boolean;
  /** Petición mal formada. Es culpa de la app, y ninguna clave lo va a arreglar. */
  isBadRequest: boolean;
  isNetwork: boolean;
  isSafetyBlock: boolean;
  isAborted: boolean;
  /** Si volver a intentarlo tiene alguna posibilidad de salir mejor. */
  isTransient: boolean;
  /** Lo que Google pide esperar (RetryInfo), en milisegundos. 0 si no lo dice. */
  retryAfterMs: number;
  /** El mensaje humano de Google, ya desenterrado del JSON. */
  detail: string;
}

/** Saca el cuerpo de error de Google esté donde esté: campo, JSON serializado o texto suelto. */
function cuerpoDeError(err: any): { code: number; status: string; message: string; details: any[] } {
  const vacio = { code: 0, status: '', message: '', details: [] as any[] };
  if (!err) return vacio;

  const directo = err?.error || err?.response?.data?.error;
  if (directo && typeof directo === 'object') {
    return {
      code: Number(directo.code) || 0,
      status: String(directo.status || ''),
      message: String(directo.message || ''),
      details: Array.isArray(directo.details) ? directo.details : []
    };
  }

  const raw = typeof err === 'string' ? err : String(err?.message || '');
  if (raw.includes('{')) {
    // El SDK mete el JSON de Google tal cual en `message`.
    const inicio = raw.indexOf('{');
    const fin = raw.lastIndexOf('}');
    if (fin > inicio) {
      try {
        const parsed = JSON.parse(raw.slice(inicio, fin + 1));
        const e = parsed?.error || parsed;
        if (e && typeof e === 'object') {
          return {
            code: Number(e.code) || 0,
            status: String(e.status || ''),
            message: String(e.message || raw),
            details: Array.isArray(e.details) ? e.details : []
          };
        }
      } catch {
        // Un JSON a medias no es motivo para perder el resto de la información.
      }
    }
  }
  return { ...vacio, message: raw };
}

/** Los segundos que Google pide esperar, si se ha molestado en decirlo. */
function leerRetryInfo(details: any[], texto: string): number {
  for (const d of details || []) {
    const delay = d?.retryDelay ?? d?.retry_delay;
    if (typeof delay === 'string') {
      const s = parseFloat(delay);
      if (!isNaN(s) && s > 0) return Math.min(Math.round(s * 1000), 120000);
    }
  }
  const m = texto.match(/retry[_ ]?delay["':\s]+(\d+(?:\.\d+)?)s/i);
  if (m) {
    const s = parseFloat(m[1]);
    if (!isNaN(s) && s > 0) return Math.min(Math.round(s * 1000), 120000);
  }
  return 0;
}

export function classifyApiError(err: unknown): ApiFailure {
  const e: any = err;
  const cuerpo = cuerpoDeError(e);
  const texto = `${cuerpo.message} ${cuerpo.status} ${String(e?.message || '')}`;
  const lower = texto.toLowerCase();

  // `ApiError.status` del SDK es el código HTTP real; es lo más fiable que hay.
  const status = Number(e?.status) || Number(e?.code) || cuerpo.code || 0;
  const googleStatus = cuerpo.status || '';
  const gs = googleStatus.toUpperCase();

  const isAborted = e?.name === 'AbortError' || /\baborted\b|abortada/i.test(lower);

  const isNetwork =
    !isAborted &&
    status === 0 &&
    /failed to fetch|networkerror|network error|load failed|econnreset|enotfound|etimedout|socket hang up|tiempo de espera agotado/i.test(
      lower
    );

  const isRateLimit = status === 429 || gs === 'RESOURCE_EXHAUSTED' || /resource_exhausted|quota|rate limit/i.test(lower);

  const isOverloaded =
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    gs === 'UNAVAILABLE' ||
    gs === 'INTERNAL' ||
    gs === 'DEADLINE_EXCEEDED' ||
    /overloaded|unavailable|alta demanda|try again later|internal error/i.test(lower);

  // Un 400 solo señala a la clave si Google nombra la clave. Cualquier otro 400
  // (campo no admitido, contexto demasiado largo, modelo mal escrito) es de la
  // petición, y descartar una clave por eso es tirar cuota buena a la basura.
  const mencionaLaClave = /api[_ ]?key not valid|api_key_invalid|invalid api key|api key expired|api_key_expired/i.test(lower);
  const isInvalidKey = mencionaLaClave || status === 401;

  const isPermissionDenied =
    !isInvalidKey && (status === 403 || gs === 'PERMISSION_DENIED' || /permission_denied|denied access/i.test(lower));

  const isModelMissing =
    status === 404 ||
    gs === 'NOT_FOUND' ||
    /is not found for api version|was not found|not found for api|no such model|unknown model|is not supported for/i.test(
      lower
    );

  const isBadRequest = !isInvalidKey && !isModelMissing && (status === 400 || gs === 'INVALID_ARGUMENT');

  const isSafetyBlock = /safety|blocked|prohibited_content|prohibited|recitation|block_reason/i.test(lower);

  // Cortes de streaming a mitad: la conexión se fue, no la petición. Merece otra oportunidad.
  const streamCortado = /incomplete json|unexpected end|terminated|premature close|stream|closed/i.test(lower);

  const isTransient = isRateLimit || isOverloaded || isNetwork || streamCortado;

  return {
    status,
    googleStatus,
    isRateLimit,
    isOverloaded,
    isInvalidKey,
    isPermissionDenied,
    isModelMissing,
    isBadRequest,
    isNetwork,
    isSafetyBlock,
    isAborted,
    isTransient,
    retryAfterMs: isRateLimit || isOverloaded ? leerRetryInfo(cuerpo.details, texto) : 0,
    detail: (cuerpo.message || String(e?.message || '')).slice(0, 400)
  };
}

/** Espera que se rinde en cuanto la jugadora corta la generación. */
export function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}

/**
 * Espera creciente con un margen aleatorio.
 *
 * El azar no es adorno: si tres claves reintentan al mismo milisegundo vuelven a
 * chocar contra la misma pared a la vez. Repartirlas en el tiempo es la mitad de
 * lo que hace que un reintento sirva de algo.
 */
export function reboteMs(intento: number, base = 700, techo = 8000): number {
  const tope = Math.min(base * Math.pow(2, intento), techo);
  return Math.round(tope / 2 + Math.random() * (tope / 2));
}

/**
 * Claves que se pueden usar ahora mismo, en orden de preferencia.
 *
 * Las que acaban de dar 429 se apartan de verdad en lugar de limitarse a ir las
 * últimas: reintentar contra una clave que Google acaba de cerrar solo sirve
 * para gastar el turno. Si TODAS están enfriándose se devuelven igualmente —más
 * vale intentarlo con la que menos le queda que no intentar nada.
 */
export function clavesDisponibles(keys: string[], descartadas: Set<string> = new Set()): string[] {
  const vivas = keys.filter(k => !descartadas.has(k));
  const frescas = vivas.filter(k => !isKeyInCooldown(k));
  return frescas.length > 0 ? frescas : vivas;
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

/**
 * Las claves tal cual, SIN mover el turno de la rotación.
 *
 * Contar tokens o preguntar qué modelos admite una clave son consultas de
 * mirón: no gastan cuota de generación y no deberían decidir con qué clave se
 * narra el turno siguiente. Antes usaban `getRotatedApiKeys`, que avanza el
 * índice circular y lo guarda, así que abrir el contador de contexto desbarataba
 * el reparto de carga entre claves.
 */
export function peekApiKeys(): string[] {
  const todas = getStoredApiKeys();
  return clavesDisponibles(todas);
}

export function getStoredApiKey(): string {
  const keys = getStoredApiKeys();
  return keys[0] || '';
}

export function setStoredApiKey(key: string): void {
  const clean = cleanApiKey(key);
  if (clean) {
    const current = getStoredApiKeys();
    const rest = current.filter(k => k !== clean);
    setStoredApiKeys([clean, ...rest]);
  } else {
    setStoredApiKeys([]);
  }
}

export function hasConfiguredApiKey(): boolean {
  return getStoredApiKeys().length > 0;
}

export function getAIClient(apiKey?: string): GoogleGenAI {
  const rawKey = apiKey || getStoredApiKey();
  const cleanKey = cleanApiKey(rawKey);
  if (!cleanKey) {
    throw new Error(
      'La clave de API de Gemini no está configurada o no es válida.\n\nPulsa el botón "Motor" de la barra superior e introduce tu clave de Google AI Studio.'
    );
  }
  return new GoogleGenAI({ apiKey: cleanKey });
}

export interface ApiKeyDiagnostic {
  key: string;
  status: 'valid' | 'invalid' | 'denied' | 'quota' | 'network' | 'error';
  code?: number;
  message: string;
  modelsFound?: number;
}

export async function testSingleApiKey(apiKey: string): Promise<ApiKeyDiagnostic> {
  const cleaned = cleanApiKey(apiKey);
  if (!cleaned || cleaned.length < 15) {
    return {
      key: apiKey,
      status: 'invalid',
      code: 400,
      message: 'Formato no válido (la clave es demasiado corta o está vacía).'
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: cleaned });
    const paginas = await ai.models.list();
    let count = 0;
    for await (const _ of paginas) {
      count++;
      if (count >= 3) break;
    }

    return {
      key: cleaned,
      status: 'valid',
      code: 200,
      message: 'Clave operativa y autorizada en Google AI Studio.',
      modelsFound: count
    };
  } catch (err: any) {
    const fallo = classifyApiError(err);
    const detalle = fallo.detail ? ` ${fallo.detail.slice(0, 120)}` : '';

    if (fallo.isInvalidKey) {
      return {
        key: cleaned,
        status: 'invalid',
        code: fallo.status || 400,
        message: `Clave no válida o revocada en Google AI Studio.${detalle}`
      };
    }
    if (fallo.isPermissionDenied) {
      return {
        key: cleaned,
        status: 'denied',
        code: 403,
        message: `Acceso denegado: proyecto suspendido o sin la Generative Language API habilitada.${detalle}`
      };
    }
    if (fallo.isRateLimit) {
      return {
        key: cleaned,
        status: 'quota',
        code: 429,
        message: `Clave válida, pero con la cuota agotada por ahora (429: RESOURCE_EXHAUSTED).${detalle}`
      };
    }
    if (fallo.isNetwork) {
      return {
        key: cleaned,
        status: 'network',
        code: 0,
        message: 'No se pudo conectar con Google (error de red o conexión).'
      };
    }

    return {
      key: cleaned,
      status: 'error',
      code: fallo.status || undefined,
      message: `Error al verificar:${detalle || ` ${String(err?.message || '').slice(0, 150)}`}`
    };
  }
}

/**
 * Comprueba que una clave puede NARRAR con el modelo elegido, no solo que existe.
 *
 * Listar modelos pasa con casi cualquier clave viva, así que el diagnóstico daba
 * verde a claves que luego fallaban en cada turno: sin facturación para el modelo
 * de pago, con el modelo retirado, o con la cuota de generación a cero. Esto pide
 * una respuesta mínima de verdad, que es la única prueba que vale.
 */
export async function testKeyAgainstModel(apiKey: string, modelId: string): Promise<ApiKeyDiagnostic> {
  const cleaned = cleanApiKey(apiKey);
  if (!cleaned) {
    return { key: apiKey, status: 'invalid', code: 400, message: 'Clave vacía o mal formada.' };
  }
  try {
    const ai = new GoogleGenAI({ apiKey: cleaned });
    await ai.models.generateContent({
      model: modelId,
      contents: 'ping',
      config: { maxOutputTokens: 1, temperature: 0 }
    });
    return {
      key: cleaned,
      status: 'valid',
      code: 200,
      message: `Clave operativa y capaz de generar con ${modelId}.`
    };
  } catch (err: any) {
    const fallo = classifyApiError(err);
    const detalle = fallo.detail ? ` ${fallo.detail.slice(0, 120)}` : '';
    if (fallo.isInvalidKey) {
      return { key: cleaned, status: 'invalid', code: fallo.status || 400, message: `Clave no válida o revocada.${detalle}` };
    }
    if (fallo.isPermissionDenied) {
      return { key: cleaned, status: 'denied', code: 403, message: `Acceso denegado para ${modelId}.${detalle}` };
    }
    if (fallo.isRateLimit) {
      return { key: cleaned, status: 'quota', code: 429, message: `Cuota agotada por ahora para ${modelId}.${detalle}` };
    }
    if (fallo.isModelMissing) {
      return {
        key: cleaned,
        status: 'error',
        code: fallo.status || 404,
        message: `La clave es válida, pero el modelo «${modelId}» no existe para ella. Pulsa «Ver los de mi clave».`
      };
    }
    if (fallo.isNetwork) {
      return { key: cleaned, status: 'network', code: 0, message: 'No se pudo conectar con Google.' };
    }
    return { key: cleaned, status: 'error', code: fallo.status || undefined, message: `Error al probar ${modelId}:${detalle}` };
  }
}

export async function testAllApiKeys(keys?: string[]): Promise<ApiKeyDiagnostic[]> {
  const targetKeys = keys && keys.length > 0 ? keys : getStoredApiKeys();
  if (targetKeys.length === 0) return [];
  return Promise.all(targetKeys.map(k => testSingleApiKey(k)));
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

  // Cola de los capítulos anteriores. Se recorre hacia atrás y se incluye un contexto
  // sustancial de las sesiones previas para mantener la coherencia narrativa global.
  // Cola de sesiones anteriores. Se incluye un resumen compacto de apoyo.
  // La memoria general del proyecto (Project Memory) sintetiza el grueso del lore y estado.
  const PREVIO_MAX = 8000;
  const sortedChats = [...chats].sort((a, b) => a.id.localeCompare(b.id));
  const indiceActual = sortedChats.findIndex(c => c.id === currentChatId);
  const anteriores = sortedChats.slice(0, indiceActual < 0 ? sortedChats.length : indiceActual);

  const trozos: string[] = [];
  let acumulado = 0;
  for (let i = anteriores.length - 1; i >= 0 && acumulado < PREVIO_MAX; i--) {
    const c = anteriores[i];
    const texto =
      `\n--- Sesión previa: ${c.name} ---\n` +
      (c.messages || []).slice(-10).map(m => `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`).join('\n');
    const hueco = PREVIO_MAX - acumulado;
    const recorte = texto.length > hueco ? texto.slice(-hueco) : texto;
    trozos.unshift(recorte);
    acumulado += recorte.length;
  }
  const allPreviousHistory = trozos.join('');

  let rawProjectMemBlock = '';
  if (project.memory?.raw_project_memory) {
    rawProjectMemBlock = `
=== MEMORIA GENERAL DEL PROYECTO (PROJECT MEMORY) ===
${project.memory.raw_project_memory.trim()}
`;
  }

  let userDirectivesBlock = '';
  if (project.memory?.memory_edits && project.memory.memory_edits.length > 0) {
    userDirectivesBlock = `
=== DIRECTIVAS Y EDICIONES MANUALES DEL USUARIO (CUMPLIMIENTO OBLIGATORIO) ===
${project.memory.memory_edits.map((e, idx) => `${idx + 1}. ${e.text}`).join('\n')}
`;
  }

  const memoryContext = project.memory
    ? `
${rawProjectMemBlock}
${userDirectivesBlock}
${project.memory.manual_notes ? `NOTAS DIRECTAS DEL MAESTRO:\n${project.memory.manual_notes}\n` : ''}
${allPreviousHistory.length > 0 ? `RESUMEN DE SESIONES PREVIAS:\n${allPreviousHistory}` : ''}
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

    tiempoDirectiva = `   - [TIEMPO: +Xm / +Xh / +Xd] — (Opcional) solo si transcurre un lapso apreciable de tiempo en la ficción (conversación larga, viaje o descanso).
`;
  }

  // La tanda de dados llega desde fuera: una nueva por turno al narrar, y una
  // cualquiera al medir tokens, donde los números concretos dan igual. Va al
  // final, con lo volátil, para no romper el caché del prefijo estable.

  // Gestión de enfermedades, agotamiento y salud
  const diseaseConfig = project.diseaseConfig || {
    system: 'dnd5e_2024',
    autoPenalties: true
  };

  let diseaseSection = '';
  if (diseaseConfig.system === 'narrative_only') {
    diseaseSection = `### GESTIÓN DE ENFERMEDADES, SALUD Y AGOTAMIENTO (MODO NARRATIVO EXCLUSIVO)
- Las enfermedades, heridas y fatiga se representan exclusivamente mediante descripción literaria, sensaciones y roleplay, sin aplicar penalizaciones numéricas estrictas salvo que la situación lo requiera de forma dramática.`;
  } else {
    const isClassic = diseaseConfig.system === 'dnd5e';
    const is2024 = diseaseConfig.system === 'dnd5e_2024';
    
    diseaseSection = `### GESTIÓN DE ENFERMEDADES, AGOTAMIENTO Y ESTADO DE SALUD
- **Sistema de Reglas Activo:** ${isClassic ? 'D&D 5e Clásico (6 Niveles de Agotamiento)' : is2024 ? 'D&D 2024 / 5.5e (Agotamiento d20 acumulativo -1 por nivel del 1 al 10)' : 'Sistema Personalizado de Campaña'}
- **Penalizadores Automáticos del Narrador:** ${diseaseConfig.autoPenalties ? 'ACTIVADOS (El Narrador debe arbitrar y aplicar penalizadores mecánicos de forma autónoma según las dolencias, heridas, venenos, frío, falta de sueño y nivel de agotamiento del protagonista en cada tirada y reflejarlos en [ESTADO: ...])' : 'DESACTIVADOS (Solo aplicar penalizadores cuando el jugador lo solicite expresamente)'}
${diseaseConfig.exhaustionRules ? `\n- **Reglas de Agotamiento y Fatiga:**\n${diseaseConfig.exhaustionRules}` : ''}
${diseaseConfig.customRules ? `\n- **Reglas de Enfermedad, Contagio y Estrés:**\n${diseaseConfig.customRules}` : ''}
- **Pautas de Arbitraje Clínico y Biológico:**
  1. Si el protagonista sufre una enfermedad (ej. Fiebre de las alcantarillas, esporas fúngicas, gangrena), veneno, hipotermia o agotamiento, descríbelo en la escena y añade la condición al registro final: \`[ESTADO: PG ... | condiciones: Enfermo (...), Agotamiento X, ...]\`.
  2. ${diseaseConfig.autoPenalties ? 'Cuando solicites una tirada de d20 o calcules el resultado del PJ, ten en cuenta activamente las desventajas, penalizadores numéricos o modificaciones de CD que correspondan a su estado de salud actual.' : ''}
  3. Tras un Descanso Largo o al cumplir 24 horas en el calendario, pide la correspondiente Tirada de Salvación de Constitución para evaluar si la enfermedad remite, se estabiliza o empeora.`;
  }

  // El orden importa por dinero y por espera. Gemini cachea el prefijo común
  // entre peticiones, y ese prefijo se rompe en el primer carácter que cambia.
  //
  // La intención estaba escrita aquí desde el principio, pero el montaje no la
  // cumplía: la ficha del protagonista (que cambia en cuanto se gasta una
  // moneda) iba ANTES de los documentos, y la memoria y el calendario (que
  // cambian cada turno) antes del bloque de directivas. Con casi quince mil
  // tokens estables escondidos detrás de contenido volátil, la caché se rompía
  // en el primer turno y se reprocesaba todo desde cero una y otra vez.
  //
  // Ahora se montan dos bloques: primero TODO lo que no cambia entre turnos, y
  // después lo vivo. Como el bloque de directivas deja de ser lo último que se
  // lee, al final se repite en dos líneas el compromiso de formato, que es lo
  // que de verdad necesita estar fresco.
  const bloqueEstable = `${CORE_INTERFACE_PROTOCOLS}

### INSTRUCCIONES DE CAMPAÑA (IDENTIDAD Y DIRECTIVAS MAESTRAS DEL NARRADOR)
${activeInstructions}

### SISTEMA DE JUEGO Y MECÁNICAS
${activeSystem}

${diseaseSection}

### ESTILO NARRATIVO (VOZ Y RITMO NOVELESCO)
${activeStyle}

### BASE DE CONOCIMIENTO (DOCUMENTOS, FICHAS Y MATERIAL ADJUNTO)
Los siguientes archivos forman parte del canon íntegro del mundo y debes utilizarlos como fuente de verdad sobre PNJs, lugares, eventos pasados, reglas, oráculos y ambientación:
${filesText || 'No hay documentos de texto adicionales adjuntos.'}

### RESERVA DE DADOS DEL DIRECTOR DE JUEGO (USO EXCLUSIVO DEL NARRADOR)
Al final de la entrada del turno se adjunta la reserva de dados reales tirados para tus acciones ocultas de PNJ, daño, tablas aleatorias y tiradas enfrentadas. Son de uso exclusivo para el Narrador (NUNCA para las acciones del protagonista). Úsalos en orden y descarta los que no gastes.

[DIRECTIVAS DE RESPUESTA CRÍTICAS]:
0. [BLINDAJE DE TONO, CERO MORALISMOS Y FIDELIDAD AL LORE CANÓNICO (MARCO ADULTO / GRIMDARK)]:
   - **Fidelidad al Lore y Ambientación Oscura**: Este es un entorno de rol de fantasía oscura y cruda. Las culturas ficticias y facciones canónicas (como los drow de Menzoberranzan, sectas, tiranos, corsarios de Luskan, asesinos y monstruos de la Infraoscuridad) DEBEN representarse con toda su crueldad, jerarquía despiadada, astucia y malicia canónicas, sin censura, sin suavizaciones y sin reinterpretaciones contemporáneas.
   - **Cero Sermones y Cero Advertencias Éticas**: Trata al usuario como a un jugador adulto en una mesa de rol tradicional. Queda TERMINANTEMENTE PROHIBIDO emitir sermones morales, advertencias éticas fuera de personaje (OOC), disculpas condescendientes ("recuerda que...", "es importante destacar...") o coletillas moralizantes. La ficción es ficción.
   - **Tono Narrativo Visceral y Directo**: Describe el combate táctico, los impactos, las heridas, la magia y las amenazas físicas y psicológicas de forma visceral, directa y evocadora, con peso y consecuencias reales.
0.1. [ASIMETRÍA DE INFORMACIÓN ESTRICTA Y PROHIBICIÓN ABSOLUTA DE METAROL / DEUS EX MACHINA]:
   - **Separación de Conocimiento (Narrador vs PNJ)**: Tú como Narrador conoces los secretos del mundo, pero los PNJs SOLO conocen lo que han presenciado físicamente con sus propios sentidos o lo que el PJ les ha dicho verbalmente.
   - **Consecuencia Inviolable de Engaños y Secretos**: Si el jugador mintió, ocultó un objeto/identidad o tuvo éxito en Engaño (o el PNJ falló su tirada de Perspicacia), el PNJ **SE TRAGA LA MENTIRA Y NO SOSPECHA**. Queda TERMINANTEMENTE PROHIBIDO que mensajes después el PNJ "sepa mágicamente" o actúe conociendo lo que se le ocultó sin haber realizado una investigación física tangible y explícita en la ficción.
   - **Invisibilidad de Pensamientos**: Los pensamientos internos del protagonista o anotaciones entre paréntesis del jugador son **100% INVISIBLES** para los PNJs. Ningún PNJ puede leer la mente del protagonista sin un hechizo activo declarado en el relato.
   - **Cero Deus Ex Machina**: Todo avance en los planes o deducciones de los PNJs debe tener causa y efecto coherente y visible en la ficción, sin saltos mágicos de conveniencia.
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
   Las tiradas de habilidad y las **Tiradas de Salvación corren dentro del roleo**.
   A) DETECCIÓN Y RESOLUCIÓN INMEDIATA DE TIRADAS ENVIADAS POR EL JUGADOR:
      - Si el mensaje del jugador contiene una tirada o resultado de dados (ejemplo «[Tirada de Sigilo: d20 natural = 16 | CD 14]», «[Tirada de Salvación de Destreza: d20 natural = 18]», «[Tirada d20: 15]» o una indicación de resultado en texto):
        1. RECONÓCELA AL INSTANTE: Toma el dado natural enviado por el jugador.
        2. Aplícale tú el modificador de característica y bonificador de competencia correspondiente según la ficha viva del protagonista (${pc?.name || 'el protagonista'}).
        3. Expresa en el relato la suma y el cotejo contra la dificultad (ej: «16 natural + 3 de Destreza = 19 frente a CD 14: Éxito rotundo»).
        4. Narra el desenlace de la acción de inmediato con todas sus consecuencias.
        5. Queda TERMINANTEMENTE PROHIBIDO volver a pedir la misma tirada o ignorar el resultado enviado por el jugador.
        6. Un 20 natural es Éxito Crítico; un 1 natural es Fallo Crítico / Pifia.
   B) PETICIÓN DE TIRADA (CUANDO EL RESULTADO ES INCIERTO O HAY PELIGRO):
      - Cuando una acción del protagonista tenga resultado incierto (atacar, trepar, mentir/engañar/ocultar información a un PNJ perspicaz, forzar cerraduras, sigilo, investigar) o cuando el personaje enfrente un peligro súbito, trampa, veneno o hechizo que exija resistencia, NO decidas tú el resultado ni lo narres de antemano.
      - Describe el momento hasta el instante justo anterior al impacto o desenlace, detente ahí y pide la tirada o salvación en una línea propia con este formato exacto:
        [Petición de Tirada: Habilidad o Salvación de Característica | CD número]
        (Ejemplos: [Petición de Tirada: Engaño | CD 15], [Petición de Tirada: Perspicacia | CD 14], [Petición de Tirada: Salvación de Destreza | CD 14], [Petición de Tirada: Salvación de Constitución | CD 15], [Petición de Tirada: Atletismo | CD 12], [Petición de Tirada: Iniciativa]).
      - **Tiradas Sociales Obligatorias (Engaño vs Perspicacia):** Si el jugador miente o disimula ante un PNJ perspicaz o astuto, solicita la tirada de Engaño al jugador ([Petición de Tirada: Engaño | CD XX]) o tira Perspicacia para el PNJ con tus dados de Narrador.
      - Puedes pedir varias si la situación lo requiere. Después de pedirla, **no sigas narrando**: espera a que el jugador responda en su siguiente mensaje y resuélvelo entonces.
      - Caso obligatorio: cuando estalle un combate o una emboscada, describe el detonante y pide la iniciativa antes de narrar el primer intercambio de golpes → [Petición de Tirada: Iniciativa].
6. Si has pedido una tirada, la narración acaba en la petición: no añadas < ¿Qué haces? > ni sigas la escena (los registros internos del punto 7 sí van siempre, al final del todo). Si NO has pedido ninguna tirada, termina con < ¿Qué haces? > sin proponer opciones, para dar libertad total al jugador.
7. [REGISTROS INTERNOS - ACTUALIZACIÓN ESTRICTAMENTE ESENCIAL Y CONDICIONAL]:
   Después de la narración, añade las siguientes líneas según corresponda. Son registros internos de la aplicación que el jugador no ve. REGLA FUNDAMENTAL: En cada turno se actualiza ÚNICAMENTE lo esencial (Vida, enfermedad/condiciones/heridas, inventario/dinero, tiempo transcurrido y afinidad de PNJs). Y SOLO si ha habido cambios reales en la narración; si no ha habido cambios, NO alteres nada ni emitas etiquetas innecesarias.
   - [PRESENTES: nombres separados por comas] — quién ha estado en escena de forma reconocible, con nombre propio. No incluyas figurantes sin nombre («un marinero», «la multitud»). Sirve para saber quién vuelve: alguien que reaparece deja de ser un extra y se le abre una ficha de vínculo con el protagonista.
   - [VÍNCULO: nombre | aparenta: cómo trata al protagonista y qué deja ver | oculta: lo que de verdad piensa y no dice | grado: tipo — descripción | atr: 0-20 | vin: 0-20 | con: 0-20] — SOLO para los personajes que la aplicación ya te ha listado arriba como habituales, y ÚNICAMENTE cuando la escena haya movido algo real entre ellos o se inicie un nuevo vínculo. Si nada ha cambiado en su relación o química en este turno, NO emitas esta línea.
     «aparenta» es lo que el protagonista podría percibir observándolo. «oculta» es lo que hay debajo: sus reservas, sus intenciones, lo que calla.
     «grado» debe comenzar indicando el tipo para que la interfaz muestre el icono adecuado:
       - ⚔️ Rivalidad: «grado: rivalidad — ...»
       - ❇️ Amistad: «grado: amistad — ...»
       - 💘 Interés Romántico / Romance: «grado: romance — ...» (atracción, flirteo, insinuación o declaración sentimental/sexual)
       - 💀 Enemistad: «grado: enemistad — ...»
       - 🤝 Alianza: «grado: alianza — ...»
       - 🛡️ Mentor: «grado: mentor — ...»
     «atr» (0-20), «vin» (0-20) y «con» (0-20) representan la Atracción/Romance, Vínculo y Confianza que el PNJ siente hacia el protagonista. El Narrador los actualiza de forma autónoma según las vivencias y la química; son de solo lectura para el jugador.
   - [INVENTARIO: +X Nombre (detalles opcionales), -Y Nombre, +Z PO, -W PO, +A PP, -B PC] — OBLIGATORIO siempre que el protagonista gane, compre, reciba de un PNJ, encuentre, invoque, gaste, pierda o consuma objetos o dinero durante la escena (ejemplos: si invoca 10 Buenas Bayas: [INVENTARIO: +10 Buenas Bayas (duran 24h)], si come 3 de 10: [INVENTARIO: -3 Buenas Bayas], si gasta 15 de oro en una tienda: [INVENTARIO: +Disfraz noble, -15 PO], si Jarlaxle le entrega una Máscara de Disfraz: [INVENTARIO: +1 Máscara de Disfraz (mágica, equipada)], si pierde la máscara: [INVENTARIO: -1 Máscara de Disfraz]). Si en este turno NO ha habido alteración de inventario ni monedas, OMITE totalmente esta línea.
${tiempoDirectiva}   - [ESTADO: PG actuales/máximos | CA valor | condiciones: lista separada por comas, o "ninguna"]
     Refleja en él el daño recibido, la curación, el agotamiento, el veneno, las enfermedades, heridas y cualquier efecto o condición persistente que hayas narrado. Si no ha habido daño, curación ni nuevas afecciones/recuperaciones, repite exactamente los valores anteriores sin alterarlos. Va SIEMPRE en último lugar.`;

  // Todo lo que cambia de un turno a otro. Va detrás para no romper el prefijo
  // cacheado, y de paso queda pegado a la escena, que es donde mejor se atiende.
  const bloqueVivo = `
${pjSection}

### CONOCIMIENTO DE LA CAMPAÑA (MEMORIA VIVA)
${memoryContext}

${calendarioSection}

### ESTADO ACTUAL DEL PROTAGONISTA (AHORA MISMO)
Estado actual conocido: PG ${pc?.hp ?? '?'}/${pc?.maxHp ?? '?'}, CA ${pc?.ac ?? '?'}${pc?.conditions?.length ? `, condiciones: ${pc.conditions.join(', ')}` : ''}.

Narra la escena respetando las DIRECTIVAS DE RESPUESTA CRÍTICAS de más arriba, y ciérrala con los registros internos que correspondan según el punto 7 (solo los que hayan cambiado de verdad en este turno).`;

  const sys = `${bloqueEstable}
${bloqueVivo}`;

  // Filter out initial placeholders
  const historyCompleto = currentChat.messages.filter(
    m => m.content !== 'Tirando dados...' && m.content !== 'Pensando...'
  );

  // Sesión activa (Capítulo en curso): Se incluye íntegra para garantizar continuidad,
  // coherencia y evitar amnesias locales en los turnos recientes, aprovechando la amplia ventana
  // de contexto del modelo. Si la sesión supera un umbral extremo (~400k caracteres),
  // se protege con un límite de seguridad generoso.
  const ESCENA_MAX = 400000;
  let usados = 0;
  let desde = historyCompleto.length;
  while (desde > 0) {
    const coste = (historyCompleto[desde - 1].content || '').length;
    if (usados + coste > ESCENA_MAX && (historyCompleto.length - desde) >= 100) break;
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

  const diceContext = `\n\n[Dados pre-tirados del Director para acciones ocultas/PNJ en este turno: d20: ${dicePool.d20.join(', ')} | d100: ${dicePool.d100.join(', ')} | d6: ${dicePool.d6.join(', ')}]`;
  const finalUserPayload = userText + diceContext;

  if (lastRole === 'user') {
    contents[contents.length - 1].parts.push({ text: '\n\n' + finalUserPayload });
  } else {
    contents.push({ role: 'user', parts: [{ text: finalUserPayload }] });
  }

  return { sys, contents };
}

/** Cuántas veces se insiste con la MISMA clave cuando Google está saturado. */
const MAX_REINTENTOS_POR_SATURACION = 2;

/**
 * Detecta con precisión quirúrgica si una respuesta del Narrador se quedó
 * incompleta o cortada a mitad de frase debido a una caída de conexión,
 * agotamiento de tokens de salida (MAX_TOKENS) o interrupción de la red.
 */
export function isNarrativeIncomplete(text: string): boolean {
  if (!text) return false;
  const raw = text.trim();
  if (raw.length < 15) return false;
  if (raw === 'Tirando dados...' || raw === 'Pensando...') return false;

  // Si contiene etiquetas de cierre, estado o tirada, ha concluido formalmente
  if (/\[(?:ESTADO|TIEMPO|AGENDA|HILO|PRESENTES|VINCULO|AFINIDAD|Petición de Tirada|Tirada)\b/i.test(raw)) {
    return false;
  }

  // Quitar etiquetas informativas de capítulos
  const clean = raw.replace(/\[CHAPTER:[^\]]*\]/gi, '').trim();
  if (clean.length < 15) return false;

  // Si termina con cierre formal de turno o estímulo cinematográfico
  if (/< ?¿?Qué haces\?? ?>/i.test(clean) || /———◆———/i.test(clean)) return false;

  const lastChar = clean[clean.length - 1];
  const validPunctuation = ['.', '!', '?', '…', '»', '"', '”', '’', '`', '>'];
  
  if (validPunctuation.includes(lastChar)) {
    return false;
  }

  if (lastChar === '*') {
    const asterisks = (clean.match(/\*/g) || []).length;
    if (asterisks % 2 === 0) {
      const beforeAsterisk = clean.replace(/\*+$/, '').trim();
      const lastCharBefore = beforeAsterisk[beforeAsterisk.length - 1];
      if (lastCharBefore && validPunctuation.includes(lastCharBefore)) {
        return false;
      }
    }
  }

  if (lastChar === ']') {
    if (/\[[a-zA-Z0-9_\s:|áéíóúÁÉÍÓÚñÑ—–\-.,+/?#]+\]$/.test(clean)) {
      return false;
    }
  }

  // Si termina en letra, número, coma, guion, dos puntos o punto y coma, está cortada
  return true;
}

/**
 * Autocompleta de forma fluida y transparente una narración que se cortó
 * por alcanzar el límite de tokens o por una desconexión en el tramo final.
 */
async function intentarCompletarNarrativa({
  fullText,
  ai,
  model,
  config,
  contentsBase,
  signal,
  onChunk,
  persistir,
  setLoadingText
}: {
  fullText: string;
  ai: any;
  model: string;
  config: any;
  contentsBase: any[];
  signal?: AbortSignal;
  onChunk: (fullText: string) => void;
  persistir: (text: string, definitivo: boolean) => Promise<void>;
  setLoadingText: (text: string) => void;
}): Promise<string> {
  const anclaje = fullText.slice(-160).trim();
  const promptCont = `[SISTEMA - REANUDACIÓN DE ESCENA]: La respuesta se interrumpió antes de concluir el relato. El último fragmento escrito fue: "${anclaje}". Continúa el relato EXACTAMENTE a partir de la última palabra sin repetir nada del texto previo, concluyendo de forma natural las frases, la escena y los registros internos finales.`;

  const continuationContents = [
    ...contentsBase,
    { role: 'model', parts: [{ text: fullText }] },
    { role: 'user', parts: [{ text: promptCont }] }
  ];

  setLoadingText('Completando el desenlace de la narración...');

  try {
    const contStream = await ai.models.generateContentStream({
      model,
      contents: continuationContents,
      config
    });

    let lastSave = Date.now();

    for await (const chunk of contStream) {
      if (signal?.aborted) break;
      const textPart = chunk.text ?? '';
      if (textPart) {
        fullText += textPart;
        onChunk(fullText);
      }
      const now = Date.now();
      if (now - lastSave > 1500 && fullText.length > 0) {
        lastSave = now;
        await persistir(fullText, false);
      }
    }
  } catch (err) {
    console.warn('Fallo en intento de autocompletado en caliente:', err);
  }

  return fullText;
}

/**
 * Por qué el modelo ha devuelto un turno en blanco.
 *
 * Un turno vacío antes se daba por bueno: la jugadora se quedaba mirando un
 * mensaje sin una sola letra, sin manera de saber si había sido el filtro, el
 * límite de salida o un tropiezo de la conexión. Nombrarlo permite además que el
 * respaldo entre en acción en lugar de dar la escena por narrada.
 */
function explicarTurnoVacio(bloqueoDePrompt: string, motivoDeCierre: string): string {
  if (bloqueoDePrompt) {
    return `El modelo ha rechazado la petición antes de escribir nada (motivo: ${bloqueoDePrompt}). Baja los filtros en Motor → Filtros & NSFW.`;
  }
  const motivo = (motivoDeCierre || '').toUpperCase();
  if (motivo === 'SAFETY' || motivo === 'PROHIBITED_CONTENT' || motivo === 'BLOCKLIST') {
    return `El modelo ha cortado la escena por sus filtros de seguridad (motivo: ${motivo}). Baja los filtros en Motor → Filtros & NSFW.`;
  }
  if (motivo === 'RECITATION') {
    return 'El modelo ha cortado la escena por parecerse demasiado a un texto con derechos (motivo: RECITATION). Reformula la última entrada.';
  }
  if (motivo === 'MAX_TOKENS') {
    return 'El modelo agotó su límite de salida sin escribir nada aprovechable. El contexto de la campaña puede estar demasiado cargado.';
  }
  return 'El modelo ha devuelto un turno vacío, sin texto ni motivo de cierre.';
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
  setLoadingText: (text: string) => void;
  onSaveMessage?: (updatedChat: Chat) => Promise<void> | void;
}) {
  const currentChat = chats.find(c => c.id === currentChatId);
  if (!currentChat) throw new Error('Sesión no encontrada.');

  const { keys: rotadas, totalKeys } = getRotatedApiKeys();
  if (rotadas.length === 0) {
    throw new Error(
      'La clave de API de Gemini no está configurada.\n\nPulsa el botón "Motor" de la barra superior e introduce tu clave de Google AI Studio.'
    );
  }

  const baseModel = getStoredModel();
  const failoverChain = getModelFailoverChain(baseModel);

  const storedKeys = getStoredApiKeys();
  const numeroDeClave = (key: string, pos: number) => {
    const i = storedKeys.indexOf(key);
    return i >= 0 ? i + 1 : pos + 1;
  };
  const etiquetaDeClave = (n: number) => (totalKeys > 1 ? ` (Clave ${n}/${totalKeys})` : '');

  /** Claves que Google ha rechazado de raíz (401/403). No se vuelven a tocar en este turno. */
  const clavesMuertas = new Set<string>();
  /** Modelos que no existen para estas claves (404). Se saltan sin gastar más claves en ellos. */
  const modelosAusentes = new Set<string>();

  let lastError: any = null;
  let ultimoFallo: ApiFailure | null = null;

  const persistir = (texto: string, definitivo: boolean) =>
    saveStreamedMessage(currentChat, texto, onSaveMessage, onStateReported, onTimeReported, definitivo);

  for (let modelIndex = 0; modelIndex < failoverChain.length; modelIndex++) {
    const currentModel = failoverChain[modelIndex];
    if (modelosAusentes.has(currentModel)) continue;
    if (signal?.aborted) return;

    const disponibles = clavesDisponibles(rotadas, clavesMuertas);
    if (disponibles.length === 0) break;

    const isFallback = modelIndex > 0;
    const modelDisplayName = AVAILABLE_MODELS.find(m => m.id === currentModel)?.name || currentModel;
    let saltarAlSiguienteModelo = false;

    for (let k = 0; k < disponibles.length && !saltarAlSiguienteModelo; k++) {
      const currentApiKey = disponibles[k];
      if (clavesMuertas.has(currentApiKey)) continue;

      const nClave = numeroDeClave(currentApiKey, k);
      const keyLabel = etiquetaDeClave(nClave);
      const ai = getAIClient(currentApiKey);

      // Saturación: se insiste con ESTA clave antes de rotar. Un 503 es la
      // capacidad del modelo en Google, no un problema de la clave; cambiar de
      // clave contra el mismo modelo saturado no arregla nada, esperar sí.
      for (let intento = 0; intento <= MAX_REINTENTOS_POR_SATURACION; intento++) {
        if (signal?.aborted) return;

        // Cada intento arranca con la hoja en blanco. Si el anterior dejó a
        // medias un puñado de letras, arrastrarlas pegaría el arranque de una
        // narración con el cuerpo de otra distinta.
        let fullText = '';
        let recibioTexto = false;
        let motivoDeCierre = '';
        let bloqueoDePrompt = '';
        let currentContents: any[] = [];
        let currentConfig: any = null;

        try {
          if (intento > 0) {
            setLoadingText(
              `Google sigue saturado. Reintento ${intento}/${MAX_REINTENTOS_POR_SATURACION} en ${modelDisplayName}${keyLabel}...`
            );
          } else if (isFallback) {
            setLoadingText(
              `Google saturado en el modelo anterior. Continuando narración con ${modelDisplayName}${keyLabel}...`
            );
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
          currentContents = contents;

          const thinkingSetting = getStoredThinkingLevel();
          const safetySetting = getStoredSafetyLevel();
          const tempSetting = getStoredTemperature();
          const topPSetting = getStoredTopP();

          const abierto = esModeloAbierto(currentModel);
          const config: any = {
            systemInstruction: sys,
            temperature: tempSetting,
            topP: topPSetting,
            abortSignal: signal,
            ...(abierto ? {} : { safetySettings: buildSafetySettings(safetySetting) })
          };

          const thinkingBudget = getThinkingBudgetConfig(thinkingSetting, currentModel);
          if (thinkingBudget && !abierto) {
            config.thinkingConfig = thinkingBudget;
          }
          currentConfig = config;

          const responseStream = await ai.models.generateContentStream({
            model: currentModel,
            contents,
            config
          });

          let lastSaveTime = Date.now();
          let uso: any = null;

          for await (const chunk of responseStream) {
            if (signal?.aborted) break;
            const textPart = chunk.text ?? '';
            if (textPart) {
              recibioTexto = true;
              fullText += textPart;
              onChunk(fullText);
            }
            const candidato = (chunk as any).candidates?.[0];
            if (candidato?.finishReason) motivoDeCierre = String(candidato.finishReason);
            const bloqueo = (chunk as any).promptFeedback?.blockReason;
            if (bloqueo) bloqueoDePrompt = String(bloqueo);
            if ((chunk as any).usageMetadata) uso = (chunk as any).usageMetadata;

            // Guardado intermedio cada 1.5s
            const now = Date.now();
            if (now - lastSaveTime > 1500 && fullText.length > 0) {
              lastSaveTime = now;
              await persistir(fullText, false);
            }
          }

          if (signal?.aborted) {
            if (fullText.trim().length > 0) await persistir(fullText.trim(), true);
            return;
          }

          // Un turno en blanco no es un turno narrado: se trata como fallo para
          // que entre el respaldo en vez de dar la escena por buena y dejar a la
          // jugadora ante un mensaje vacío que no explica nada.
          if (fullText.trim().length === 0) {
            throw new Error(explicarTurnoVacio(bloqueoDePrompt, motivoDeCierre));
          }

          // Protección contra respuestas cortadas por MAX_TOKENS o cierre abrupto:
          // Si el texto quedó a mitad de frase, completarlo automáticamente.
          if ((motivoDeCierre === 'MAX_TOKENS' || isNarrativeIncomplete(fullText)) && !signal?.aborted && fullText.trim().length > 30) {
            fullText = await intentarCompletarNarrativa({
              fullText,
              ai,
              model: currentModel,
              config,
              contentsBase: contents,
              signal,
              onChunk,
              persistir,
              setLoadingText
            });
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

          await persistir(fullText.trim(), true);
          return;
        } catch (e: any) {
          const fallo = classifyApiError(e);

          if (signal?.aborted || fallo.isAborted) {
            if (fullText.trim().length > 0) await persistir(fullText.trim(), true);
            return;
          }

          lastError = e;
          ultimoFallo = fallo;
          console.warn(`Error en modelo ${currentModel} (clave ${nClave}):`, e);

          logWarn(
            'gemini_stream',
            `Incidencia en modelo ${currentModel} (Clave ${nClave}/${totalKeys})`,
            fallo.detail || 'Error en streaming',
            {
              chatName: currentChat.name,
              model: currentModel,
              details: {
                status: fallo.status,
                googleStatus: fallo.googleStatus,
                isRateLimit: fallo.isRateLimit,
                isOverloaded: fallo.isOverloaded,
                isInvalidKey: fallo.isInvalidKey,
                isPermissionDenied: fallo.isPermissionDenied,
                isModelMissing: fallo.isModelMissing,
                isBadRequest: fallo.isBadRequest,
                recibioTexto,
                motivoDeCierre,
                intento,
                clave: nClave,
                totalKeys
              }
            }
          );

          // Si el streaming se cortó con texto ya recibido e incompleto, intentamos
          // reconectar y continuar la escena automáticamente antes de rendirnos.
          if (recibioTexto && fullText.trim().length > 30 && !signal?.aborted && isNarrativeIncomplete(fullText)) {
            try {
              setLoadingText('Conexión interrumpida durante el streaming. Reconectando y completando relato...');
              fullText = await intentarCompletarNarrativa({
                fullText,
                ai,
                model: currentModel,
                config: currentConfig,
                contentsBase: currentContents,
                signal,
                onChunk,
                persistir,
                setLoadingText
              });
              if (!isNarrativeIncomplete(fullText)) {
                await persistir(fullText.trim(), true);
                return;
              }
            } catch (errRecuperacion) {
              console.warn('Fallo en intento de rescate de streaming:', errRecuperacion);
            }
          }

          // Lo ya narrado no se tira. Si el corte llegó con la escena encaminada,
          // se guarda y se preserva íntegramente: la jugadora no pierde lo leído.
          if (recibioTexto && fullText.trim().length > 30) {
            await persistir(fullText.trim(), true);
            return;
          }

          if (fallo.isModelMissing) {
            // Ese modelo no existe para estas claves. Ninguna otra clave lo va a
            // hacer aparecer: al siguiente de la cadena.
            modelosAusentes.add(currentModel);
            saltarAlSiguienteModelo = true;
            break;
          }

          if (fallo.isInvalidKey || fallo.isPermissionDenied) {
            clavesMuertas.add(currentApiKey);
            if (disponibles.some(kk => !clavesMuertas.has(kk))) {
              setLoadingText(`Clave ${nClave} no autorizada. Probando la siguiente clave del bolsillo...`);
            }
            break;
          }

          if (fallo.isRateLimit) {
            markKeyCooldown(currentApiKey, fallo.retryAfterMs || 60000);
            if (disponibles.slice(k + 1).some(kk => !clavesMuertas.has(kk) && !isKeyInCooldown(kk))) {
              setLoadingText(`Cuota agotada en la Clave ${nClave}. Rotando a la siguiente para ${modelDisplayName}...`);
            }
            break;
          }

          if (fallo.isBadRequest) {
            // La petición no le gusta a este modelo (un campo que no admite, el
            // contexto pasado de largo). Repetirla con otra clave da exactamente
            // el mismo 400: lo único que puede cambiar algo es otro modelo.
            saltarAlSiguienteModelo = true;
            break;
          }

          if (fallo.isTransient && intento < MAX_REINTENTOS_POR_SATURACION) {
            await esperar(fallo.retryAfterMs || reboteMs(intento), signal);
            continue;
          }

          break;
        }
      }
    }

    if (modelIndex < failoverChain.length - 1) {
      const siguiente = failoverChain[modelIndex + 1];
      if (!modelosAusentes.has(siguiente)) {
        const nombreSiguiente = AVAILABLE_MODELS.find(m => m.id === siguiente)?.name || siguiente;
        setLoadingText(`Sin suerte en ${modelDisplayName}. Saltando a ${nombreSiguiente}...`);
        await esperar(300, signal);
      }
    }
  }

  if (signal?.aborted) return;

  const errorFinal = lastError || new Error('No se pudo obtener respuesta de ningún modelo.');
  logError('gemini_stream', 'Fallo definitivo en la generación de narrativa', errorFinal, {
    chatName: currentChat.name,
    message: describeApiError(errorFinal),
    details: ultimoFallo ? { status: ultimoFallo.status, googleStatus: ultimoFallo.googleStatus } : undefined
  });

  // El mensaje de error NO se guarda como si lo hubiera narrado el Narrador.
  // Antes se escribía en el chat y se quedaba allí: la jugadora lo leía como
  // parte de la historia y, peor, viajaba a Google como contexto en todos los
  // turnos siguientes. Se retira el hueco vacío y el aviso se da por la interfaz.
  await descartarTurnoFallido(currentChat, onSaveMessage);
  throw errorFinal;
}

/**
 * Quita del chat el hueco que se había reservado para la respuesta.
 *
 * Solo se toca el último mensaje y solo si es del Narrador y está vacío o es el
 * marcador de espera: nunca una escena de verdad.
 */
async function descartarTurnoFallido(
  chat: Chat,
  onSaveMessage?: (updatedChat: Chat) => Promise<void> | void
) {
  if (!onSaveMessage) return;
  const messages = [...chat.messages];
  const ultimo = messages[messages.length - 1];
  if (!ultimo || ultimo.role !== 'model') return;
  const contenido = (ultimo.content || '').trim();
  if (contenido.length > 30 && contenido !== 'Tirando dados...') return;
  messages.pop();
  try {
    await onSaveMessage({ ...chat, messages });
  } catch (e) {
    console.warn('onSaveMessage callback error:', e);
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

  if (definitivo && hilos.length > 0) {
    logInfo('threads', `${hilos.length} ${hilos.length === 1 ? 'hilo narrativo programado' : 'hilos narrativos programados'}`, `El Narrador ha dejado programados los siguientes hilos en este turno: ${hilos.map(h => `"${h.title}" (en ${h.dueInDays}d)`).join(', ')}`, {
      chatName: chat.name,
      details: { hilos }
    });
  }

  if (
    definitivo &&
    onTimeReported &&
    (avance.encontrado || agenda.length || hilos.length || presentes.length || vinculos.length)
  ) {
    try {
      onTimeReported({ minutos: avance.minutos, agenda, hilos, presentes, vinculos });
    } catch (err) {
      logError('threads', 'Error al procesar el reporte de tiempo e hilos de la escena', err, {
        chatName: chat.name,
        details: { hilos, avance, agenda }
      });
    }
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

/** Margen base para las tareas de fondo. El primero, 35s, cortaba destilados largos en seco. */
const TIMEOUT_TAREA_DE_FONDO_MS = 90000;

/** Ni la tarea más pesada debería pasar de aquí en un solo intento. */
const TIMEOUT_MAXIMO_MS = 300000;

/**
 * Pasado este plazo se deja de insistir, se haya probado lo que se haya probado.
 *
 * Sin un tope global la cascada se multiplica sola: tres modelos por tres claves
 * por tres reintentos, a minuto y medio cada uno, son cuarenta minutos de reloj
 * girando. Quien esté esperando pensará que la aplicación se ha colgado, y no
 * irá muy desencaminado.
 */
const PRESUPUESTO_TOTAL_MS = 360000;

/**
 * Cuánto darle a una petición según lo que se le manda.
 *
 * Un plazo fijo trata igual a «extrae el nombre de este PNJ» que a «lee las
 * cuatrocientas mil letras de la campaña entera y devuélveme el diario día a
 * día». La segunda no cabe en noventa segundos ni con buena voluntad: se la
 * cortaba siempre, y como cortar se parecía a un fallo pasajero, se reintentaba
 * en la siguiente clave para volver a cortarla igual.
 */
export function plazoParaLaCarga(contents: any, explicito?: number): number {
  if (explicito) return Math.min(explicito, TIMEOUT_MAXIMO_MS);
  let letras = 0;
  try {
    letras = typeof contents === 'string' ? contents.length : JSON.stringify(contents ?? '').length;
  } catch {
    letras = 0;
  }
  // Medio segundo más por cada mil letras enviadas, sobre el margen base.
  const calculado = TIMEOUT_TAREA_DE_FONDO_MS + Math.round(letras / 1000) * 500;
  return Math.min(Math.max(calculado, TIMEOUT_TAREA_DE_FONDO_MS), TIMEOUT_MAXIMO_MS);
}

/**
 * Una petición sin streaming, insistiendo por todas las claves y modelos que haga falta.
 *
 * Es el camino de todo lo que no es narrar: sincronizar memoria, extraer PNJs,
 * deducir el calendario, destilar documentos. Comparte con el narrador la misma
 * lectura de errores, para que una clave quemada o un modelo inexistente
 * signifiquen lo mismo en los dos sitios.
 */
export async function generateContentWithFailover({
  contents,
  config = {},
  primaryModel,
  preferredChain,
  signal,
  timeoutMs
}: {
  contents: any;
  config?: any;
  primaryModel?: string;
  preferredChain?: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<any> {
  const { keys: rotadas } = getRotatedApiKeys();
  const todasLasClaves = rotadas.length > 0 ? rotadas : [''];
  const base = sanitizeModelId(primaryModel || getBackgroundTaskModel(), DEFAULT_BACKGROUND_MODEL_ID);
  const rawChain = preferredChain || getModelFailoverChain(base);
  const chain = rawChain
    .map(m => sanitizeModelId(m, DEFAULT_MODEL_ID))
    .filter((m, idx, arr) => !isModelDeprecated(m) && arr.indexOf(m) === idx);
  if (chain.length === 0) {
    chain.push(DEFAULT_MODEL_ID, DEFAULT_BACKGROUND_MODEL_ID);
  }

  const plazo = plazoParaLaCarga(contents, timeoutMs);
  const seAcabaElTiempo = Date.now() + PRESUPUESTO_TOTAL_MS;

  let lastError: any = null;
  const clavesMuertas = new Set<string>();
  const modelosAusentes = new Set<string>();

  /** Se ha gastado el presupuesto: insistir más solo alarga la espera. */
  const sinTiempo = () => Date.now() > seAcabaElTiempo;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    if (modelosAusentes.has(model)) continue;
    if (signal?.aborted) throw new Error('Tarea cancelada.');
    if (sinTiempo()) break;

    const disponibles = clavesDisponibles(todasLasClaves, clavesMuertas);
    if (disponibles.length === 0) break;

    let saltarAlSiguienteModelo = false;

    for (let k = 0; k < disponibles.length && !saltarAlSiguienteModelo; k++) {
      const currentKey = disponibles[k];
      if (currentKey && clavesMuertas.has(currentKey)) continue;
      if (sinTiempo()) break;

      const ai = getAIClient(currentKey || undefined);

      for (let intento = 0; intento <= MAX_REINTENTOS_POR_SATURACION; intento++) {
        if (signal?.aborted) throw new Error('Tarea cancelada.');

        const abierto = esModeloAbierto(model);
        const supportsThinking = model.includes('3.7') || model.includes('3.1') || model.includes('gemini-3');
        const cleanedConfig: any = {
          ...config,
          thinkingConfig: supportsThinking && !abierto ? config.thinkingConfig : undefined,
          ...(abierto
            ? {
                safetySettings: undefined,
                tools: undefined,
                thinkingConfig: undefined,
                responseMimeType: undefined
              }
            : {})
        };

        // El plazo se impone con un AbortController de verdad. Antes era un
        // `Promise.race` contra un temporizador: al vencer, el código seguía
        // adelante pero la petición continuaba viva contra Google, gastando la
        // misma cuota que se creía haber liberado.
        const relojDeGuardia = new AbortController();
        const abortarPorTimeout = setTimeout(() => relojDeGuardia.abort(), plazo);
        const cancelarPorFuera = () => relojDeGuardia.abort();
        signal?.addEventListener('abort', cancelarPorFuera, { once: true });

        try {
          let res: any;
          try {
            res = await ai.models.generateContent({
              model,
              contents,
              config: { ...cleanedConfig, abortSignal: relojDeGuardia.signal }
            });
          } catch (firstErr: any) {
            const errMsg = String(firstErr?.message || '').toLowerCase();
            // Si el rechazo fue por `responseMimeType`, se repite sin él en este mismo modelo.
            if (
              cleanedConfig.responseMimeType &&
              !relojDeGuardia.signal.aborted &&
              (errMsg.includes('not supported') || errMsg.includes('responsemimetype'))
            ) {
              res = await ai.models.generateContent({
                model,
                contents,
                config: { ...cleanedConfig, responseMimeType: undefined, abortSignal: relojDeGuardia.signal }
              });
            } else {
              throw firstErr;
            }
          }
          return res;
        } catch (err: any) {
          // Distinguir «lo hemos cortado nosotros por plazo» de «lo ha cortado la jugadora».
          const vencioElPlazo = relojDeGuardia.signal.aborted && !signal?.aborted;
          if (signal?.aborted) throw new Error('Tarea cancelada.');

          const fallo = vencioElPlazo
            ? ({
                ...classifyApiError(err),
                // Que se agote el plazo no dice nada de la clave: dice que la
                // tarea es larga. Marcarlo como fallo pasajero hacía que se
                // reintentara en la misma clave y luego en las otras dos, para
                // cortarlas exactamente igual. No es pasajero; lo que toca es
                // probar un modelo más rápido, y solo eso.
                isTransient: false,
                isAborted: false,
                detail: `Tiempo de espera agotado (${Math.round(plazo / 1000)}s) en el modelo ${model}.`
              } as ApiFailure)
            : classifyApiError(err);

          lastError = vencioElPlazo ? new Error(fallo.detail) : err;
          console.warn(
            `generateContentWithFailover fallo en ${model} (clave ${k + 1}/${disponibles.length}):`,
            fallo.detail || err
          );

          if (vencioElPlazo) {
            saltarAlSiguienteModelo = true;
            break;
          }
          if (fallo.isModelMissing) {
            modelosAusentes.add(model);
            saltarAlSiguienteModelo = true;
            break;
          }
          if (fallo.isInvalidKey || fallo.isPermissionDenied) {
            if (currentKey) clavesMuertas.add(currentKey);
            break;
          }
          if (fallo.isRateLimit) {
            if (currentKey) markKeyCooldown(currentKey, fallo.retryAfterMs || 60000);
            break;
          }
          if (fallo.isBadRequest) {
            saltarAlSiguienteModelo = true;
            break;
          }
          if (fallo.isTransient && intento < MAX_REINTENTOS_POR_SATURACION) {
            await esperar(fallo.retryAfterMs || reboteMs(intento), signal);
            continue;
          }
          break;
        } finally {
          clearTimeout(abortarPorTimeout);
          signal?.removeEventListener('abort', cancelarPorFuera);
        }
      }
    }

    if (i < chain.length - 1) {
      await esperar(300, signal);
    }
  }

  if (sinTiempo()) {
    throw new Error(
      `La tarea ha tardado más de ${Math.round(PRESUPUESTO_TOTAL_MS / 60000)} minutos y se ha dejado de insistir. ` +
        'Suele pasar cuando se le pide de una vez el repaso de una campaña muy larga: prueba con el modelo Flash Lite, ' +
        'que responde antes, o parte el trabajo en menos capítulos.'
    );
  }
  throw lastError || new Error('No se pudo obtener respuesta de ningún modelo.');
}

export interface FullCampaignSyncResult {
  memory: Partial<Memory>;
  timeline: TimelineEntry[];
  currentDate?: CampaignDate;
  threads?: ScheduledThread[];
  calendar?: CalendarConfig;
  summary: string;
  totalDays: number;
  totalEvents: number;
  totalNpcs: number;
  totalQuests: number;
  totalLocations: number;
}

/**
 * Sincronización total e integral de la campaña con IA a partir de todos los chats:
 * - Memoria viva: Historia consolidada, estado actual, tramas activas/completadas, PNJs (sin el protagonista) y lugares.
 * - Diario & Cronología día a día: Días transcurridos, acontecimientos, hitos, clima, lugares y estado anímico.
 * - INFERENCIA Y DEDUCCIÓN DE HORAS: Infiere y distribuye horas/minutos lógicos para cada evento,
 *   especialmente en chats antiguos donde no existían marcas de tiempo explícitas.
 * - Reloj & Calendario: Determina el instante final tras la última escena.
 * - Hilos de consecuencias pendientes: Registra plazos programados a futuro.
 */
export async function syncFullCampaignFromChats(
  project: Project,
  chats: Chat[],
  _files?: ProjectFile[]
): Promise<FullCampaignSyncResult> {
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
      allHistory += `\n=== SESIÓN / CAPÍTULO: ${c.name} ===\n`;
      allHistory += validMessages
        .map(m => `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`)
        .join('\n');
      messageCount += validMessages.length;
    }
  }

  if (messageCount === 0 || !allHistory.trim()) {
    throw new Error(
      'No hay mensajes en la crónica de las sesiones todavía. Juega al menos un turno para que el Narrador pueda analizar y sincronizar la memoria y el diario.'
    );
  }

  const historyToAnalyze =
    allHistory.length > 400000 ? allHistory.substring(allHistory.length - 400000) : allHistory;

  const pcName = project.memory?.player_character?.name || '';
  const pcNotes = project.memory?.player_character
    ? `Protagonista / Personaje Jugador (OC): "${project.memory.player_character.name}" (${project.memory.player_character.race || ''} ${project.memory.player_character.class || ''})`
    : '';

  const cal: CalendarConfig = (calendarioValido(project.calendar) ? project.calendar : CALENDARIO_HARPTOS)!;
  const initDate = project.currentDate && Number.isFinite(project.currentDate.year)
    ? project.currentDate
    : { year: 1492, dayOfYear: 1, minute: 540 };
  const startAbs = aDiaAbsoluto(cal, initDate);

  // Entidades previas registradas
  const listExisting = <T extends { id: string }>(items: T[], describe: (i: T) => string) =>
    items.length ? items.map(i => `- [id: ${i.id}] ${describe(i)}`).join('\n') : '(ninguna todavía)';

  const existingState = `
ESTADO ACTUAL REGISTRADO PREVIAMENTE:
- TRAMAS:
${listExisting(project.memory?.quests || [], q => `"${q.title}" — objetivo: ${q.objective || 'sin objetivo'} — estado: ${q.status || 'activa'}`)}

- PNJS REGISTRADOS:
${listExisting(project.memory?.npcs || [], n => `"${n.name}" — ${n.relation || 'sin relación'}`)}

- LUGARES REGISTRADOS:
${listExisting(project.memory?.locations || [], l => `"${l.name}"`)}
`.trim();

  const prompt = `Eres el Gran Archivero, Cronista y Maestro de Campaña de este juego de rol en los Reinos Olvidados (D&D 5e / Forgotten Realms).
Tu cometido es analizar TODO el historial de sesiones y capítulos para SINCRONIZAR Y RECONSTRUIR INTEGRALMENTE todos los módulos de la partida:
1. Memoria Viva (Historia global, estado actual, tramas, PNJs con afinidad canónica, lugares y evolución del protagonista).
2. Cronología y Diario día a día (días transcurridos, acontecimientos, lugares, clima, hitos, ánimo) CON INFERENCIA Y DEDUCCIÓN DE HORAS PARA CADA EVENTO (especialmente en chats antiguos o escenas sin hora explícita).
3. Fecha de campaña y reloj final tras la última escena.
4. Hilos narrativos y consecuencias programadas pendientes.

CALENDARIO DE LA CAMPAÑA:
- Calendario: ${cal.name} (${diasPorAno(cal)} días/año)
- Fecha inicial de referencia: Día ${initDate.dayOfYear}, Año ${initDate.year} (${fechaLegible(cal, initDate)})

${existingState}

REGLA ANTI-DUPLICADOS (CRÍTICA):
- Para tramas, PNJs y lugares que ya existan arriba, conserva su "id" y actualiza sus datos en lugar de duplicarlos.
- ⚠️ REGLA ABSOLUTA DEL PROTAGONISTA: NO incluyas bajo ningún concepto al Personaje Jugador / Protagonista (OC ${pcName ? `"${pcName}"` : ''}) en la lista de "npcs". El protagonista/jugador NO es un PNJ.

INFERENCIA Y ASIGNACIÓN DE HORAS/MINUTOS (CRUCIAL PARA CHATS VIEJOS):
Para cada entrada o escena de la cronología de eventos diarios, DEBES asignar un 'minute' (entero de 0 a 1439, o 'horaAprox' de 0 a 23):
- Si el texto menciona franjas (amanecer, desayuno, mediodía, almuerzo, tarde, anochecer, cena, noche, medianoche, madrugada):
  * Madrugada / Primeras horas: 04:00 - 05:30 (minute: 240 - 330)
  * Amanecer / Desayuno: 07:00 - 08:30 (minute: 420 - 510)
  * Media mañana: 10:00 - 11:30 (minute: 600 - 690)
  * Mediodía / Almuerzo: 12:30 - 14:00 (minute: 750 - 840)
  * Tarde: 15:00 - 17:30 (minute: 900 - 1050)
  * Atardecer / Ocaso: 18:30 - 20:00 (minute: 1110 - 1200)
  * Noche / Cena: 20:30 - 22:30 (minute: 1230 - 1350)
  * Medianoche: 23:30 - 01:30 (minute: 1410 - 90)
- EN CHATS VIEJOS O SIN MARCAS TEMPORALES EXPLÍCITAS: DEDUCE y DISTRIBUYE las horas de los sucesos de forma coherente y secuencial a lo largo del día (ej. despertar/preparativos a las 08:30 [510], viaje/encuentro a las 13:00 [780], combate/evento clave a las 17:30 [1050], posada/descanso a las 21:00 [1260]).
- NUNCA dejes campos de hora nulos ni amontones todos los eventos a las 12:00.

${pcNotes ? `INFORMACIÓN DEL PROTAGONISTA (NO EXTRAER COMO PNJ):\n${pcNotes}\n` : ''}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "story": "Resumen narrativo consolidado de toda la historia hasta ahora (3-4 párrafos estructurados).",
  "current_status": "Estado actual de los personajes, ubicación inmediata, peligros y recursos disponibles.",
  "player_summary": "Resumen enfocado en el protagonista (OC): evolución, vivencias, psicología y relaciones.",
  "player_events": [
    { "title": "Hito clave del protagonista", "description": "Qué ocurrió y su significado", "dateOrTime": "Fecha o momento" }
  ],
  "quests": [
    { "id": "id existente o nuevo", "title": "Título", "type": "Principal / Secundaria", "objective": "Objetivo", "progress": "Progreso", "status": "Activa / Completada" }
  ],
  "npcs": [
    {
      "id": "id existente o nuevo",
      "name": "Nombre del PNJ (NUNCA el protagonista)",
      "relation": "Aliado / Enemigo / Neutral / Mentor / Corsario / Contacto",
      "status": "Vivo / Desaparecido / Muerto",
      "description": "Rasgos físicos visibles y rol público",
      "notes": "Detalles clave, trasfondo y actitud",
      "aparenta": "Lo que muestra o finge",
      "oculta": "Intenciones ocultas, secretos o debilidades si se conocen",
      "vinculo": "Tipo de vínculo social/emocional (solo para PNJs nombrados/recurrentes)",
      "atr": 10,
      "vin": 5,
      "con": 4
    }
  ],
  "locations": [
    { "id": "id existente o nuevo", "name": "Nombre del lugar", "desc": "Descripción del lugar y relevancia" }
  ],
  "diasTranscurridosTotal": 3,
  "fechaFinal": { "year": 1492, "dayOfYear": 3, "minute": 1260 },
  "resumenCronologia": "Resumen conciso de la cronología recuperada",
  "timeline": [
    {
      "diaOffset": 0,
      "minute": 540,
      "title": "Título evocador del suceso",
      "summary": "Resumen narrativo de lo ocurrido en esta escena en 1-3 frases.",
      "lugar": "Ubicación",
      "clima": "Atmósfera o clima",
      "hito": "Hito destacado si aplica",
      "mood": "⚔️",
      "tipo": "acontecimiento"
    }
  ],
  "hilosPendientes": [
    {
      "title": "Título del hilo o consecuencia",
      "effect": "Qué sucederá al vencer el plazo",
      "venceEnDiasDesdeInicio": 4,
      "hidden": false
    }
  ]
}

HISTORIAL COMPLETO DE PARTIDA:
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
  if (!resultText) throw new Error('No se recibió respuesta del modelo al sincronizar la campaña.');

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
    console.error('Failed to parse full sync JSON from AI:', cleanText, err);
    throw new Error(
      'La respuesta de la IA no tenía un formato estructurado reconocible. Inténtalo de nuevo.'
    );
  }

  // Quests
  const quests = (parsed.quests || []).map((q: any) => ({
    ...q,
    id: q.id || Date.now().toString() + Math.random().toString(36).substring(7)
  }));

  // NPCs (Filtrado estricto del protagonista y asignación de ids)
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

  // Locations
  const locations = (parsed.locations || []).map((l: any) => ({
    ...l,
    id: l.id || Date.now().toString() + Math.random().toString(36).substring(7)
  }));

  // Protagonist (OC)
  const prevPc = project.memory?.player_character;
  const parsedPcEvents = (parsed.player_events || []).map((e: any) => ({
    id: e.id || Date.now().toString() + Math.random().toString(36).substring(7),
    title: e.title || 'Acontecimiento',
    description: e.description || '',
    dateOrTime: e.dateOrTime || '',
    createdAt: Date.now()
  }));

  const existingEvents = prevPc?.events || [];
  const mergedEvents = [
    ...existingEvents,
    ...parsedPcEvents.filter((ne: any) => !existingEvents.some(oe => oe.title.toLowerCase().trim() === ne.title.toLowerCase().trim()))
  ];

  const candidatePc: PlayerCharacter = {
    ...(prevPc || { name: 'Aryendell' }),
    name: prevPc?.name || 'Aryendell',
    title: prevPc?.title,
    summary: parsed.player_summary || prevPc?.summary || '',
    events: mergedEvents,
    portrait: prevPc?.portrait
  };
  const updatedPc = sanitizePlayerCharacter(candidatePc, 'Aryendell');

  // Timeline / Diario con inferencia de horas
  const rawTimeline = Array.isArray(parsed.timeline) ? parsed.timeline : (Array.isArray(parsed.entradas) ? parsed.entradas : []);
  const newTimelineEntries: TimelineEntry[] = [];

  // Agrupar por día para distribuir horas en caso de que falten o coincidan
  const eventsByDayOffset = new Map<number, any[]>();
  rawTimeline.forEach((ev: any, idx: number) => {
    const offset = typeof ev.diaOffset === 'number' && Number.isFinite(ev.diaOffset) ? Math.max(0, Math.round(ev.diaOffset)) : 0;
    if (!eventsByDayOffset.has(offset)) {
      eventsByDayOffset.set(offset, []);
    }
    eventsByDayOffset.get(offset)!.push({ ev, idx });
  });

  // Procesar cada día y asegurar distribución temporal adecuada
  eventsByDayOffset.forEach((items, offset) => {
    const targetAbs = startAbs + offset;
    const dateObj = desdeDiaAbsoluto(cal, targetAbs);
    const dateLabel = fechaLegible(cal, dateObj);
    const count = items.length;

    items.forEach(({ ev, idx }, iInDay) => {
      let minute: number;
      if (typeof ev.minute === 'number' && Number.isFinite(ev.minute) && ev.minute >= 0 && ev.minute <= 1439) {
        minute = Math.round(ev.minute);
      } else if (typeof ev.horaAprox === 'number' && Number.isFinite(ev.horaAprox) && ev.horaAprox >= 0 && ev.horaAprox <= 23) {
        minute = Math.round(ev.horaAprox) * 60;
      } else {
        // Inferencia temporal de reparto equilibrado entre las 08:30 (510 min) y las 21:30 (1290 min)
        if (count === 1) {
          minute = 720; // 12:00
        } else {
          const step = Math.floor((1290 - 510) / Math.max(1, count - 1));
          minute = 510 + iInDay * step;
        }
      }

      newTimelineEntries.push({
        id: `ai_entry_${targetAbs}_${idx}_${Date.now().toString(36)}`,
        absDay: targetAbs,
        date: dateLabel,
        title: ev.title ? String(ev.title).trim() : undefined,
        summary: String(ev.summary || ev.resumen || '').trim(),
        lugar: ev.lugar ? String(ev.lugar).trim() : undefined,
        clima: ev.clima ? String(ev.clima).trim() : undefined,
        hito: ev.hito ? String(ev.hito).trim() : undefined,
        mood: ev.mood || '📖',
        tipo: ev.tipo || 'acontecimiento',
        minute
      });
    });
  });

  // Preservar entradas manuales de la usuaria o que contengan imágenes adjuntas
  const existingTimeline = project.timeline || [];
  const manualUserEntries = existingTimeline.filter(
    e => (e.images && e.images.length > 0) || e.tipo === 'diario'
  );

  // Fusionar y ordenar cronológicamente
  const combinedTimeline = [...newTimelineEntries];
  manualUserEntries.forEach(manual => {
    if (!combinedTimeline.some(c => c.id === manual.id)) {
      combinedTimeline.push(manual);
    }
  });
  combinedTimeline.sort((a, b) => {
    if (a.absDay !== b.absDay) return a.absDay - b.absDay;
    return (a.minute ?? 720) - (b.minute ?? 720);
  });

  // CurrentDate final
  let calculatedCurrentDate: CampaignDate = initDate;
  if (parsed.fechaFinal && typeof parsed.fechaFinal.dayOfYear === 'number') {
    calculatedCurrentDate = {
      year: typeof parsed.fechaFinal.year === 'number' ? parsed.fechaFinal.year : initDate.year,
      dayOfYear: Math.max(1, Math.min(diasPorAno(cal), parsed.fechaFinal.dayOfYear)),
      minute: typeof parsed.fechaFinal.minute === 'number' ? parsed.fechaFinal.minute : 1260
    };
  } else if (combinedTimeline.length > 0) {
    const lastEntry = combinedTimeline[combinedTimeline.length - 1];
    const lastDateObj = desdeDiaAbsoluto(cal, lastEntry.absDay);
    calculatedCurrentDate = {
      year: lastDateObj.year,
      dayOfYear: lastDateObj.dayOfYear,
      minute: lastEntry.minute ?? 1260
    };
  }

  // Hilos narrativos pendientes
  const newThreads: ScheduledThread[] = [...(project.threads || [])];
  if (Array.isArray(parsed.hilosPendientes)) {
    parsed.hilosPendientes.forEach((h: any, idx: number) => {
      const title = String(h.title || 'Consecuencia programada').trim();
      const alreadyHas = newThreads.some(t => t.title.toLowerCase().trim() === title.toLowerCase());
      if (!alreadyHas) {
        const offset = typeof h.venceEnDiasDesdeInicio === 'number' ? h.venceEnDiasDesdeInicio : 5;
        const dueAbs = startAbs + offset;
        newThreads.push({
          id: `ai_thread_${dueAbs}_${idx}_${Date.now().toString(36)}`,
          title,
          effect: String(h.effect || h.title || '').trim(),
          dueAbsDay: dueAbs,
          dueDate: fechaLegible(cal, desdeDiaAbsoluto(cal, dueAbs)),
          hidden: Boolean(h.hidden),
          status: 'pending',
          origin: 'narrador'
        });
      }
    });
  }

  const memoryMerged: Partial<Memory> = {
    story: parsed.story || project.memory?.story || '',
    current_status: parsed.current_status || project.memory?.current_status || '',
    quests: mergeEntities(project.memory?.quests || [], quests, 'title', 'objective'),
    npcs: mergeEntities(project.memory?.npcs || [], npcs, 'name', 'notes'),
    locations: mergeEntities(project.memory?.locations || [], locations, 'name', 'desc'),
    player_character: updatedPc
  };

  const uniqueDaysCount = new Set(combinedTimeline.map(e => e.absDay)).size;

  return {
    memory: memoryMerged,
    timeline: combinedTimeline,
    currentDate: calculatedCurrentDate,
    threads: newThreads,
    calendar: cal,
    summary: parsed.resumenCronologia || `Sincronizados ${combinedTimeline.length} acontecimientos en ${uniqueDaysCount} jornadas.`,
    totalDays: uniqueDaysCount,
    totalEvents: combinedTimeline.length,
    totalNpcs: memoryMerged.npcs?.length || 0,
    totalQuests: memoryMerged.quests?.length || 0,
    totalLocations: memoryMerged.locations?.length || 0
  };
}

export async function syncMemoryFromChats(project: Project, chats: Chat[], files?: ProjectFile[]): Promise<Partial<Memory>> {
  const result = await syncFullCampaignFromChats(project, chats, files);
  return result.memory;
}

/**
 * Regenera y sintetiza la memoria unificada del proyecto (estilo Claude Project Memory)
 * con las 3 secciones canónicas (Purpose & context, Current state, Tools & resources)
 * y respetando estrictamente las directivas manuales de "Dile a la IA qué recordar u olvidar".
 */
export async function generateClaudeProjectMemory({
  project,
  chats,
  files = [],
  newDirective
}: {
  project: Project;
  chats: Chat[];
  files?: ProjectFile[];
  newDirective?: string;
}): Promise<string> {
  // Historial exhaustivo de sesiones recientes
  const validChats = [...chats].sort((a, b) => a.id.localeCompare(b.id));
  let recentHistory = '';
  for (const c of validChats) {
    const msgs = (c.messages || []).filter(m => m.content && m.content.trim().length > 0);
    if (msgs.length > 0) {
      recentHistory += `\n=== SESIÓN: ${c.name} (Total mensajes: ${msgs.length}) ===\n`;
      // Tomamos los primeros mensajes para el planteamiento y los más recientes para el estado actual
      if (msgs.length <= 40) {
        recentHistory += msgs.map(m => `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`).join('\n\n');
      } else {
        recentHistory += `[Primeros compases de la sesión]:\n` +
          msgs.slice(0, 10).map(m => `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`).join('\n\n') +
          `\n\n[... últimos compases de la sesión activa ...]:\n` +
          msgs.slice(-30).map(m => `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}`).join('\n\n');
      }
    }
  }

  // Resumen y extractos de los archivos del proyecto (fichas, compendios, reglas)
  const docFiles = files.filter(f => !f.isImage && !f.isAudio);
  const fileSummaryList = docFiles.length > 0
    ? docFiles.map(f => {
        const snippet = f.content ? `:\n"${f.content.slice(0, 500).replace(/\n+/g, ' ')}..."` : '';
        return `- **${f.name}**${f.category ? ` [${f.category}]` : ''}${snippet}`;
      }).join('\n\n')
    : '- Ningún documento adicional cargado.';

  // Directivas manuales del usuario
  const allDirectives = [...(project.memory?.memory_edits || [])];
  if (newDirective && newDirective.trim().length > 0) {
    allDirectives.push({
      id: `edit_${Date.now()}`,
      text: newDirective.trim(),
      createdAt: Date.now()
    });
  }

  const directivesPrompt = allDirectives.length > 0
    ? `DIRECTIVAS MANUALES DEL USUARIO (DE OBLIGADO CUMPLIMIENTO):\n${allDirectives.map((d, i) => `${i + 1}. ${d.text}`).join('\n')}`
    : 'No hay directivas manuales adicionales.';

  // Información del Personaje Jugador si existe
  const pc = project.memory?.player_character;
  const pcSummary = pc ? `PERSONAJE PRINCIPAL (PJ / OC):
- Nombre: ${pc.name}
- Raza: ${pc.race || 'No especificada'}
- Clase/Subclase: ${pc.class || ''} ${pc.subclass || ''}
- Trasfondo: ${pc.background || 'No especificado'}
- Rasgos/Notas: ${pc.summary || pc.notes || 'Ninguna'}
` : '';

  const prompt = `Eres el sintetizador de memoria de proyecto para este entorno de rol (D&D 5e / Forgotten Realms).
Tu tarea es generar o actualizar la MEMORIA PERSISTENTE DEL PROYECTO (en formato estructurado Markdown, exactamente como la memoria de proyectos de Claude).

Debes sintetizar y redactar un documento sintético, riguroso, inmersivo y conciso con EXACTAMENTE estas tres secciones principales en Markdown:

### Purpose & context
- Párrafo fluido explicando quién es el jugador, el personaje protagonista (nombre, clase, raza, trasfondo), compañeros o invocaciones directas, universo/ambientación (Forgotten Realms, Bregan D'aerthe, Luskan, Menzoberranzan, etc.), y estilo narrativo (prosa atmosférica, tiradas ocultas integradas).
- Subsección "Key worldbuilding parameters established:" con viñetas concisas que reflejen las reglas de ambientación, tono, crueldad canónica de los drow, etc.

### Current state
- Párrafo conciso y descriptivo del estado exacto en el que se encuentra la sesión activa: situación física inmediata del protagonista (ataduras, salud, pertrechos), acompañantes presentes, ubicación actual, peligros o descubrimientos inmediatos.

### Tools & resources
- Lista en viñetas de las herramientas, fichas, módulos y documentos reales cargados en el proyecto.

INFORMACIÓN DEL PROYECTO:
- Nombre: ${project.name}
- Directivas / Instrucciones del Sistema: ${project.instructions || 'Sin directivas específicas'}
- Estilo: ${project.style || 'Narrativo inmersivo'}
${pcSummary}
- Memoria actual previa:
${project.memory?.raw_project_memory || project.memory?.story || 'Sin memoria previa'}
- Estado actual previo:
${project.memory?.current_status || 'Sin estado previo'}

ARCHIVOS Y DOCUMENTOS DEL PROYECTO:
${fileSummaryList}

${directivesPrompt}

HISTORIAL DE SESIONES RECIENTES:
${recentHistory.length > 0 ? recentHistory.slice(-90000) : 'No hay historial de chat previo.'}

REGLAS DE SALIDA:
- Genera EXCLUSIVAMENTE el texto en Markdown estructurado con las 3 secciones (### Purpose & context, ### Current state, ### Tools & resources).
- NO incluyas introducciones como "Aquí tienes la memoria:", ni etiquetas de bloque de código json o markdown \`\`\`. Devuelve el texto Markdown directo.
- Si las directivas del usuario modifican parámetros (ej. dejar de usar oráculo, eliminar bardo/taller creativo, cambiar reglas), intéggralas y refléjalas fielmente en el contenido.`;

  try {
    const bgModel = getBackgroundTaskModel();
    const safetySetting = getStoredSafetyLevel();
    const response = await generateContentWithFailover({
      primaryModel: bgModel,
      contents: prompt,
      config: {
        temperature: 0.2,
        ...(esModeloAbierto(bgModel) ? {} : { safetySettings: buildSafetySettings(safetySetting) })
      } as any
    });

    const generated = (response.text || '').trim();
    return generated;
  } catch (err) {
    console.error('Error al generar la memoria del proyecto:', err);
    throw err;
  }
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
  const fallo = classifyApiError(err);
  const detalle = fallo.detail ? `\n\nGoogle dijo: «${fallo.detail.slice(0, 220)}»` : '';

  if (fallo.isAborted) return 'La generación se detuvo a petición tuya.';

  if (fallo.isInvalidKey) {
    return `Una o varias claves de API de tu bolsillo no son válidas o han sido revocadas en Google AI Studio (Error ${fallo.status || 400}).\n\nAbre «Motor» en la barra superior, pulsa «Diagnosticar Claves» y retira o actualiza las que salgan en rojo.${detalle}`;
  }
  if (fallo.isPermissionDenied) {
    return `Google ha denegado el acceso al proyecto de tu clave (Error 403: PERMISSION_DENIED).\n\nComprueba en aistudio.google.com que el proyecto siga activo y con la Generative Language API habilitada.${detalle}`;
  }
  if (fallo.isRateLimit) {
    const espera = fallo.retryAfterMs
      ? ` Google pide esperar unos ${Math.ceil(fallo.retryAfterMs / 1000)} segundos.`
      : ' Espera unos segundos.';
    return `Todas tus claves han agotado su cuota de peticiones por ahora (Error 429: RESOURCE_EXHAUSTED).${espera} Después pulsa «Continuar Narración».${detalle}`;
  }
  if (fallo.isModelMissing) {
    return `El modelo seleccionado no existe o tu clave no lo admite (Error ${fallo.status || 404}).\n\nAbre «Motor» y pulsa «Ver los de mi clave» para elegir uno de los que Google te ofrece de verdad.${detalle}`;
  }
  if (fallo.isSafetyBlock) {
    return `El modelo ha bloqueado la respuesta con sus filtros de seguridad.\n\nBaja los filtros en Motor → Filtros & NSFW.${detalle}`;
  }
  if (fallo.isOverloaded) {
    return `Los servidores de Google están saturados (Error ${fallo.status || 503}). La app ya ha reintentado con tus claves y con los modelos de respaldo.\n\nEspera un momento y pulsa «Continuar Narración» para reanudar la escena donde quedó.${detalle}`;
  }
  if (fallo.isNetwork) {
    return `No se ha podido contactar con Google. Comprueba tu conexión a internet.${detalle}`;
  }
  if (fallo.isBadRequest) {
    return `Google ha rechazado un campo de la petición, no tu clave (Error 400: ${fallo.googleStatus || 'INVALID_ARGUMENT'}).\n\nSuele pasar al cambiar de modelo, o cuando la campaña arrastra demasiado contexto. Prueba con otro modelo desde «Motor».${detalle}`;
  }

  return fallo.detail || (err instanceof Error ? err.message : String(err ?? '')) || 'Error desconocido.';
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

/**
 * Lo que puede enseñarse mientras el texto todavía está llegando.
 *
 * El Narrador intercala etiquetas de servicio ([ESTADO:...], [TIEMPO:...],
 * [CHAPTER:...]) que la app lee y retira al guardar. Pero el guardado ocurre
 * cada segundo y medio, así que hasta entonces la jugadora las veía escritas en
 * mitad de la escena. Aquí se quitan en cada fragmento, incluida la que aún se
 * está tecleando y todavía no tiene su corchete de cierre.
 */
export function limpiarParaMostrar(texto: string): string {
  if (!texto || !texto.includes('[')) return texto;
  return texto
    .replace(/\[(?:ESTADO|TIEMPO|AGENDA|HILO|CHAPTER|PRESENTES|VINCULO|AFINIDAD)\b[^\]]*\]/gi, '')
    // Una etiqueta a medio llegar: se esconde hasta que se sepa cómo acaba.
    .replace(/\[(?:E(?:S(?:T(?:A(?:D(?:O)?)?)?)?)?|T(?:I(?:E(?:M(?:P(?:O)?)?)?)?)?|A(?:G(?:E(?:N(?:D(?:A)?)?)?)?)?|H(?:I(?:L(?:O)?)?)?|C(?:H(?:A(?:P(?:T(?:E(?:R)?)?)?)?)?)?|P(?:R(?:E(?:S(?:E(?:N(?:T(?:E(?:S)?)?)?)?)?)?)?)?|V(?:I(?:N(?:C(?:U(?:L(?:O)?)?)?)?)?)?)[^\]]*$/i, '')
    .replace(/[ \t]{2,}/g, ' ');
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

export interface ExtractedImageStyle {
  styleName: string;
  stylePrompt: string;
  keyElements: string[];
  colorPalette: string;
  lighting: string;
  medium: string;
  fullDescription: string;
}

/**
 * Analiza las imágenes de referencia subidas por el usuario y extrae un descriptor
 * de estilo visual exacto para que Imagen 3 y los generadores de IA reproduzcan
 * el mismo estilo artístico, paleta, iluminación y trazo.
 */
export async function extractVisualArtStyleFromImages(
  imageFiles: ProjectFile[]
): Promise<ExtractedImageStyle> {
  const validImages = imageFiles.filter(
    f => (f.isImage || (f.content && f.content.startsWith('data:image'))) && f.content
  );

  if (validImages.length === 0) {
    throw new Error('No hay imágenes subidas en los archivos para analizar el estilo.');
  }

  // Tomar hasta 3 imágenes de referencia
  const sampleImages = validImages.slice(0, 3);
  const parts: any[] = [
    {
      text: `Eres un director de arte y maestro de concepto visual para campañas de alta fantasía y D&D.
Analiza minuciosamente el estilo artístico, técnica visual, paleta de colores, iluminación, trazo y estética de estas imágenes de referencia subidas por el usuario.
Tu objetivo es extraer una especificación y prompt de estilo visual PERFECTO para que cualquier generador de imágenes (Imagen 3 / Midjourney / DALL-E) replique con total exactitud este mismo estilo artístico en todas las escenas que se ilustren para esta campaña.

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "styleName": "Nombre evocador del estilo (ej. Óleo Oscuro Renacentista de Fantasía)",
  "stylePrompt": "Descriptor conciso en inglés para añadir a los prompts de generación de imagen (ej. high fantasy oil painting with rich chiaroscuro lighting, deep sepia and amber tones, visible canvas brushstrokes, intricate character details, vintage fantasy artstation style)",
  "keyElements": ["Elemento 1", "Elemento 2", "Elemento 3"],
  "colorPalette": "Descripción de la paleta de colores y tonos predominantes",
  "lighting": "Tipo de iluminación y sombras",
  "medium": "Técnica o medio artístico (óleo, acuarela, concept art digital, grabado)",
  "fullDescription": "Resumen en español para la usuaria explicando los rasgos visuales identificados"
}`
    }
  ];

  for (const img of sampleImages) {
    const raw = img.content || '';
    const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
    const mime = img.mime || 'image/jpeg';
    if (base64 && base64.length > 50) {
      parts.push({
        inlineData: {
          data: base64,
          mimeType: mime
        }
      });
    }
  }

  const response = await generateContentWithFailover({
    primaryModel: getBackgroundTaskModel(),
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2
    }
  });

  const cleanJson = (response.text || '{}')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      styleName: parsed.styleName || 'Estilo Personalizado de tus Imágenes',
      stylePrompt: parsed.stylePrompt || 'masterpiece high fantasy illustration, richly detailed textures and atmospheric lighting matching campaign reference art',
      keyElements: parsed.keyElements || ['Paleta coherente', 'Iluminación atmosférica'],
      colorPalette: parsed.colorPalette || 'Tonos cálidos y contrastados',
      lighting: parsed.lighting || 'Iluminación dramática',
      medium: parsed.medium || 'Pintura digital / Óleo de fantasía',
      fullDescription: parsed.fullDescription || 'Estilo visual extraído de las imágenes subidas por el usuario.'
    };
  } catch (e) {
    console.error('Error parseando JSON de estilo de imagen:', e);
    return {
      styleName: 'Estilo Personalizado de tus Imágenes',
      stylePrompt: 'masterpiece fantasy art, matching the color palette, lighting and brushwork of the user reference images, 8k resolution, artstation trending',
      keyElements: ['Estilo coherente con las imágenes de campaña'],
      colorPalette: 'Paleta personalizada',
      lighting: 'Iluminación atmosférica',
      medium: 'Arte de fantasía',
      fullDescription: 'Estilo visual adaptado a tus referencias.'
    };
  }
}

/**
 * Genera una imagen directamente con Imagen 3 / @google/genai usando la clave de API configurada.
 */
export async function generateImageWithFailover({
  prompt,
  aspectRatio = '1:1'
}: {
  prompt: string;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
}): Promise<string> {
  const { keys } = getRotatedApiKeys();
  const todas = keys.length > 0 ? keys : [''];
  const clavesMuertas = new Set<string>();
  let lastError: any = null;

  for (const apiKey of clavesDisponibles(todas)) {
    if (apiKey && clavesMuertas.has(apiKey)) continue;
    try {
      const ai = getAIClient(apiKey || undefined);
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: (aspectRatio as any) || '1:1'
        }
      });
      if (response.generatedImages && response.generatedImages.length > 0) {
        const img = response.generatedImages[0];
        const base64 = img?.image?.imageBytes;
        if (base64) {
          return `data:image/jpeg;base64,${base64}`;
        }
      }
    } catch (err: any) {
      lastError = err;
      const fallo = classifyApiError(err);
      if (fallo.isRateLimit && apiKey) markKeyCooldown(apiKey, fallo.retryAfterMs || 60000);
      if ((fallo.isInvalidKey || fallo.isPermissionDenied) && apiKey) clavesMuertas.add(apiKey);
      console.warn('Error generando imagen:', fallo.detail || err);
      // Si el modelo de imagen no existe para ninguna clave, insistir con las
      // demás solo alarga la espera para llegar al mismo sitio.
      if (fallo.isModelMissing) break;
    }
  }
  throw lastError || new Error('No se pudo generar la imagen con el modelo de IA. Verifica tu clave de API.');
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
  const apiKey = peekApiKeys()[0] || getStoredApiKey();
  const ai = getAIClient(apiKey || undefined);
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
        // Con tope por arriba: `yearLayout` construye un objeto por cada día
        // del año, y un mes de cien mil días deducido por error dejaba la
        // aplicación colgada para siempre —`calendarioValido` pasa por ahí en
        // cada repintado— sin forma de volver atrás.
        days: Math.min(1000, Math.max(1, Math.round(Number(m.days) || 30)))
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
  const apiKey = peekApiKeys()[0] || getStoredApiKey();
  const ai = getAIClient(apiKey || undefined);
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
      const results = parsed.map((item, idx) => ({
        diaOffset: typeof item.diaOffset === 'number' ? Math.max(0, Math.min(dias, item.diaOffset)) : idx + 1,
        tipo: item.tipo || 'noticia',
        titulo: String(item.titulo || 'Noticia del mundo'),
        resumen: String(item.resumen || ''),
        fuenteOClima: item.fuenteOClima ? String(item.fuenteOClima) : undefined,
        lugar: item.lugar ? String(item.lugar) : lugar,
        hito: item.hito ? String(item.hito) : `noticia — ${item.titulo || 'Evento mundial'}`,
        hiloConsecuencia: item.hiloConsecuencia
      }));

      const hilosGenerados = results.filter(r => r.hiloConsecuencia);
      if (hilosGenerados.length > 0) {
        logInfo('threads', `${hilosGenerados.length} ${hilosGenerados.length === 1 ? 'hilo de consecuencia generado' : 'hilos de consecuencias generados'} en salto temporal`, `Hilos creados durante el salto de ${dias} días: ${hilosGenerados.map(h => `"${h.hiloConsecuencia?.titulo}"`).join(', ')}`, {
          projectName: project.name,
          details: { hilos: hilosGenerados.map(h => h.hiloConsecuencia) }
        });
      }

      return results;
    }
  } catch (e: any) {
    console.warn('Error parsing noticias json:', e);
    logError('threads', 'Error al procesar JSON de hilos y noticias de salto temporal', e, {
      projectName: project.name,
      details: { raw, dias, motivo }
    });
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

  let parsed: any;
  try {
    parsed = JSON.parse(limpio);
  } catch (err: any) {
    logError('calendar_timeline', 'Error al procesar JSON de cronología e hilos', err, {
      projectName: project.name,
      details: { raw, limpio }
    });
    throw new Error('La respuesta de la IA no tenía un formato JSON válido para reconstruir la cronología.');
  }
  
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

