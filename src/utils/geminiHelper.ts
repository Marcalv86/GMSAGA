import { GoogleGenAI } from '@google/genai';
import {
  Project,
  Chat,
  Location,
  ProjectFile,
  SecretoDeCampana,
  Memory,
  FileCategory,
  NPC,
  PlayerCharacter,
  CalendarConfig,
  CampaignDate,
  TimelineEntry,
  ScheduledThread,
  Message
} from '../types';
import { stripRollRequests, stripStateTag } from './rollRequests';
import { CORE_INTERFACE_PROTOCOLS, DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE } from './defaultDirectives';
import {
  apuntarPeticion,
  cupoDiarioAgotado,
  marcarCupoDiarioAgotado,
  registrarUso
} from './usageStats';
import {
  CALENDARIO_HARPTOS,
  aDiaAbsoluto,
  desdeDiaAbsoluto,
  fechaLegible,
  calendarioValido,
  diasPorAno,
  distanciaEnDias,
  fechaCompleta,
  hilosPendientes,
  hilosQueVencen,
  leerAgenda,
  estacionDelDia,
  leerViaje,
  leerLugares,
  type ViajeLeido,
  type LugarLeido,
  leerAvanceDeTiempo,
  leerFechaDeHud,
  leerAvanceDeNivel,
  AvanceDeNivel,
  parsearFechaTexto,
  extraerMinutoDeTexto,
  EntradaDeAgenda,
  leerHilos,
  limpiarEtiquetasDeTiempo,
  limpiarEtiquetasDePnj,
  leerPresentes,
  leerVinculos,
  leerRevelaciones,
  leerSecretos,
  RevelacionLeida,
  SecretoLeido,
  VinculoLeido,
  HiloLeido
} from './campaignCalendar';
import { coincidenNombresNpc, fusionarDosNpcs, deduplicarListaNpcs } from './npcMatcher';
import { logError, logWarn, logInfo } from './logger';
import { abrirLlamada, cerrarLlamada } from './callLog';
import { sanitizePlayerCharacter } from './sanitizers';
import { recuperar, consultaDelTurno } from './localSearch';

// In-app API key & model management (stored locally in the user's browser)
export interface AIModelOption {
  id: string;
  name: string;
  badge: string;
  desc: string;
}

export const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Última Generación · Ultra Rápido',
    desc: 'Último modelo Flash de Google, máxima velocidad de respuesta y excelente agilidad de rol con mínimo consumo de tokens.'
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Recomendado · Híbrido y Rápido',
    desc: 'Modelo insignia con razonamiento adaptativo, narración fluida y detección precisa de mecánicas de rol.'
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Eficiente · Alta Estabilidad',
    desc: 'Versión ágil y contrastada de Flash para turnos consistentes y excelente gestión de contexto.'
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Equilibrado · Máxima Eficiencia',
    desc: 'Modelo equilibrado de la familia Gemini 3 para escala masiva, razonamiento multimodal rápido y excelente ratio velocidad/calidad.'
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    badge: 'Ultra Rápido · Mínima Cuota',
    desc: 'La opción más rápida y ligera de Google, ideal para sesiones muy ágiles con mínima latencia y mínimo consumo de tokens.'
  }
];

/*
 * Los modelos abiertos ya no se ofrecen en la aplicación.
 *
 * Gemma 4 31B estuvo en la lista y no podía funcionar: en la capa gratuita
 * admite 16.000 tokens de entrada por minuto y el envío mínimo de un turno
 * —protocolos de interfaz más instrucciones del Director, que viajan siempre—
 * ronda los 35.000 con la campaña vacía y sin un solo documento. Más del doble
 * del tope antes de escribir nada, así que fallaba en el primer turno hiciera
 * lo que hiciera quien lo eligiera.
 *
 * El trato especial se conserva porque el catálogo de la clave puede seguir
 * nombrando modelos abiertos, y con ellos hay que quitar los filtros de
 * seguridad que Google rechaza. Si alguna vez vuelven a la lista, esto sigue
 * siendo lo correcto.
 */
export function esModeloAbierto(modelId: string): boolean {
  return /^gemma/i.test(modelId.trim());
}

export function esGemma4(modelId: string): boolean {
  return /^gemma-4/i.test(modelId.trim());
}

export function isModelDeprecated(modelId: string): boolean {
  if (!modelId) return true;
  const m = modelId.toLowerCase().trim();
  return (
    m.includes('1.5') ||
    m.includes('2.0') ||
    m.includes('2.5') ||
    m.includes('3.1') ||
    m === 'gemini-pro' ||
    m === 'gemini-flash' ||
    m.includes('thinking-exp') ||
    m.includes('flash-thinking')
  );
}

export const DEFAULT_MODEL_ID = 'gemini-3.8-flash';

export interface BackgroundModelOption {
  id: string;
  name: string;
  desc: string;
}

export const AUXILIARY_BACKGROUND_MODELS: BackgroundModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    desc: 'Ultra rápido y consumo mínimo de cuota (Ideal para resúmenes y memoria persistente)'
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    desc: 'Equilibrado y eficiente para análisis y resúmenes de sesión'
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    desc: 'Última generación ultra rápida'
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    desc: 'Híbrido de razonamiento'
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    desc: 'Eficiente y equilibrado'
  }
];

export const DEFAULT_BACKGROUND_MODEL_ID = 'gemini-3.5-flash-lite';
export const BACKGROUND_LIGHTWEIGHT_MODEL_ID = 'gemini-3.5-flash-lite';

export function sanitizeModelId(modelId: string, fallback: string = DEFAULT_MODEL_ID): string {
  if (!modelId || isModelDeprecated(modelId)) {
    return fallback;
  }
  const trimmed = modelId.trim();
  const validIds = [
    ...AVAILABLE_MODELS.map(m => m.id),
    ...AUXILIARY_BACKGROUND_MODELS.map(m => m.id)
  ];
  if (!validIds.includes(trimmed)) {
    return fallback;
  }
  return trimmed;
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

export interface LimitesDeCuota {
  /** Peticiones por minuto. */
  rpm: number;
  /** Tokens de entrada por minuto. */
  tpm: number;
  /** Peticiones por día. El que de verdad decide cuánto puedes jugar. */
  rpd: number;
}

/**
 * Los topes de la capa gratuita, que NO son iguales para todos los modelos.
 *
 * Aquí se daba por hecho un único tope de 250.000 tokens por minuto para todo,
 * y es falso en los dos sentidos: los modelos abiertos tienen una ventana de
 * minuto muchísimo más pequeña (16.000 tokens, no 250.000), y los Flash de la
 * familia 3.x tienen un tope diario de VEINTE peticiones que no depende de los
 * tokens en absoluto.
 *
 * Ese tope diario es el que decide cuánto se puede jugar en un día, y es el que
 * pasaba desapercibido: veinte turnos y se acaba la jornada con el mismo error
 * 429 que da quedarse sin tokens por minuto, sin nada que distinga un caso del
 * otro. Flash Lite da quinientos al día, veinticinco veces más.
 *
 * Los números salen del panel de límites de Google AI Studio (Modelo · RPM ·
 * TPM · RPD). Google los cambia sin avisar, así que se toman como orientación
 * para avisar a tiempo, no como una verdad inmutable.
 */
const LIMITES_CAPA_GRATUITA: { patron: RegExp; limites: LimitesDeCuota }[] = [
  // Modelos abiertos: muchas peticiones, pero muy poco tokens por minuto.
  { patron: /^gemma/i, limites: { rpm: 30, tpm: 16000, rpd: 14400 } },
  // Flash Lite: el caballo de batalla para volumen.
  { patron: /flash-lite/i, limites: { rpm: 15, tpm: 250000, rpd: 500 } },
  // Flash de la familia 3.x: los mejores para narrar y los más racionados.
  { patron: /gemini-3/i, limites: { rpm: 5, tpm: 250000, rpd: 20 } }
];

const LIMITES_POR_DEFECTO: LimitesDeCuota = { rpm: 5, tpm: 250000, rpd: 20 };

export function limitesGratuitos(modelId: string): LimitesDeCuota {
  const id = (modelId || '').trim();
  return LIMITES_CAPA_GRATUITA.find(l => l.patron.test(id))?.limites || LIMITES_POR_DEFECTO;
}

/**
 * El tope de tokens por minuto del modelo por defecto. Se conserva para los
 * avisos genéricos; para un modelo concreto hay que usar `limitesGratuitos`.
 */
export const TOPE_TOKENS_POR_MINUTO = 250000;

/** A partir de aquí conviene avisar antes de que Google conteste con un 429. */
export const AVISO_TOKENS_POR_MINUTO = 180000;

/**
 * Cuántos tokens admite de entrada un modelo, según Google.
 *
 * El catálogo vivo ya trae el `inputTokenLimit` de cada modelo: se preguntó al
 * abrir la aplicación y está guardado. Si todavía no se ha consultado nunca, se
 * usa una estimación por familia, y quien pregunte sabrá de dónde sale el
 * número en vez de comerse una cifra escrita a fuego.
 */
export function limiteDeEnvio(modelId: string): { ventana: number; medido: boolean } {
  const guardado = leerCatalogoModelos();
  const id = (modelId || '').trim().toLowerCase();
  const enCatalogo = guardado?.modelos.find(m => m.id.toLowerCase() === id);
  if (enCatalogo?.entrada && enCatalogo.entrada > 0) {
    return { ventana: enCatalogo.entrada, medido: true };
  }
  // Sin catálogo: lo que anuncia cada familia. Gemma es bastante más pequeña
  // que Gemini, y dar por hecho el millón de todos era justo el error.
  const ventana = esModeloAbierto(id) ? 256000 : 1048576;
  return { ventana, medido: false };
}

/**
 * El techo que de verdad manda para un envío: el menor entre lo que le cabe al
 * modelo y lo que deja pasar la cuota por minuto.
 */
export function techoDeEnvio(modelId: string): {
  limite: number;
  ventana: number;
  medido: boolean;
  mandaLaCuota: boolean;
  cuota: LimitesDeCuota;
} {
  const { ventana, medido } = limiteDeEnvio(modelId);
  const cuota = limitesGratuitos(modelId);
  const limite = Math.min(ventana, cuota.tpm);
  return { limite, ventana, medido, mandaLaCuota: cuota.tpm < ventana, cuota };
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
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite'
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
    const validIds = AUXILIARY_BACKGROUND_MODELS.map(m => m.id);
    if (validIds.includes(trimmed)) return trimmed;
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
    const validIds = AVAILABLE_MODELS.map(m => m.id);
    if (validIds.includes(trimmed)) return trimmed;
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
  // Los modelos Gemini 2.5 y Gemma antiguos (Gemma 2/3) no admiten thinkingConfig.
  // La familia Gemini 3.x (3.8, 3.7, 3.6, 3.5) y Gemma 4 31B admiten razonamiento configurable.
  if (modelId) {
    const isGemini3 =
      modelId.includes('3.8') ||
      modelId.includes('3.7') ||
      modelId.includes('3.6') ||
      modelId.includes('3.5') ||
      modelId.includes('gemini-3');
    const isGemma4Model = esGemma4(modelId);
    if (!isGemini3 && !isGemma4Model) {
      return undefined;
    }
  }
  if (thinkingSetting === 'HIGH') return { thinkingBudget: 4096 };
  if (thinkingSetting === 'LOW') return { thinkingBudget: 1024 };
  if (thinkingSetting === 'MINIMAL') return { thinkingBudget: 0 };
  return undefined; // AUTO: el modelo decide dinámicamente el presupuesto de razonamiento
}

/**
 * Si la búsqueda en los documentos de consulta está encendida.
 *
 * Apagarla no ahorra peticiones —la búsqueda corre en el navegador y no llama a
 * nadie— pero sí tokens: los fragmentos rescatados ocupan hasta seis mil
 * caracteres por turno. A cambio, el Narrador se queda sin poder mirar en ese
 * material y solo sabe que existe.
 */
/**
 * Cuánto texto se rescata de los documentos de consulta en cada turno.
 *
 * Estaba escrito tres veces con dos valores distintos: el rescate real usaba
 * 8.000 caracteres, el estimador de tokens contaba 6.000 y la interfaz decía
 * «6 mil». O sea que la barra de gasto se quedaba corta y el rótulo mentía. Un
 * número, un sitio.
 */
export const PRESUPUESTO_FRAGMENTOS_CONSULTA = 8000;

export function getStoredBusquedaLocal(): boolean {
  return localStorage.getItem('gmstudio_busqueda_local') !== 'off';
}

export function setStoredBusquedaLocal(activa: boolean): void {
  localStorage.setItem('gmstudio_busqueda_local', activa ? 'on' : 'off');
}

export type HistoryWindowSetting = 'all' | '10' | '15' | '20' | '30';

/**
 * Límite de turnos de historial que se envían a Gemini en el capítulo activo.
 * 'all': envía todos los mensajes del capítulo.
 * '20': envía los últimos 20 mensajes (ideal para no saturar los 250k tokens/min de la capa gratuita).
 */
export function getStoredHistoryWindow(): HistoryWindowSetting {
  const local = localStorage.getItem('gemini_history_window');
  if (local && ['all', '10', '15', '20', '30'].includes(local)) {
    return local as HistoryWindowSetting;
  }
  return 'all'; // Por defecto: todo el capítulo
}

export function setStoredHistoryWindow(val: HistoryWindowSetting): void {
  localStorage.setItem('gemini_history_window', val);
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

/*
 * Aquí vivían dos interruptores que no encendían nada.
 *
 * `MemorySyncGranularity` y `AutoSyncMemory` se leían al abrir los ajustes y se
 * guardaban al cerrarlos, pero no tenían ningún control en la interfaz y lo
 * único que gobernaban era `syncMemoryDeltaIncremental`, que no llamaba nadie.
 * Un ajuste invisible sobre código muerto: se va con él.
 *
 * La sincronización incremental turno a turno se descartó a propósito, y no por
 * ser mala idea: sería una petición más en CADA turno, sumada a la de la prosa
 * novelada. Tres llamadas por mensaje contra unos cupos diarios que ya van
 * justos no compensa lo que aporta.
 */

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
  /**
   * Se acabaron las peticiones del DÍA para este modelo (RPD).
   *
   * Es un 429 idéntico al de tokens por minuto pero no se arregla esperando un
   * minuto ni recortando el envío: hasta mañana, ese modelo con esa clave no
   * vuelve. Distinguirlo permite saltar al siguiente modelo en lugar de
   * insistir contra una puerta que ya no abre hoy.
   */
  isDailyQuota: boolean;
  /** Límite específico de tokens por minuto (input_token_count / TPM 250k) alcanzado */
  isTokenQuotaLimit: boolean;
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
    if (typeof delay === 'string' || typeof delay === 'number') {
      const s = parseFloat(String(delay));
      if (!isNaN(s) && s > 0) return Math.min(Math.round(s * 1000), 120000);
    }
  }
  const m = texto.match(/retry(?:[_ ]?delay["':\s]+| in )(\d+(?:\.\d+)?)s/i);
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
  const isDailyQuota =
    isRateLimit &&
    /per\s*day|perday|requests_per_day|requestsperday|free_tier_requests|daily limit|per-day/i.test(lower);

  const isTokenQuotaLimit =
    isRateLimit &&
    !isDailyQuota &&
    /input_token_count|tokens per minute|tokenspermodelperminute|250000|token_count|quota exceeded for metric/i.test(
      lower
    );

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
    isDailyQuota,
    isTokenQuotaLimit,
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
  /** Qué documentos han viajado, para poder enseñarlo en el registro. */
  documentos?: {
    enteros?: string[];
    fragmentos?: string[];
    sinUsar?: string[];
  };
}

/**
 * Monta EXACTAMENTE lo que se le manda al modelo en un turno.
 *
 * Vive aparte de `generateStoryTurnStream` para que el contador de contexto pueda
 * medir lo mismo que se envía en vez de estimarlo por su cuenta: si el contador y
 * el envío se calculan en dos sitios distintos, acaban discrepando.
 */
/** Prosa de rol en español: ronda los 3,8 caracteres por token. */
export const CARACTERES_POR_TOKEN = 3.8;

export interface CargaDelTurno {
  /** Protocolos de interfaz y reglas del Director que la app añade siempre. */
  andamiaje: number;
  /** Caracteres que viajan, desglosados para poder enseñar en qué se va. */
  directivas: number;
  memoria: number;
  archivos: number;
  /** Lo que NO viaja por estar marcado de consulta, para ver lo que se ahorra. */
  archivosDeConsulta: number;
  capituloActual: number;
  capitulosPrevios: number;
  fragmentosRescatados: number;
  /** Lo que queda del prompt: ficha, calendario, salud, dados… */
  otros: number;
  total: number;
  /** La misma cifra en tokens, estimada. */
  tokens: number;
  // Contexto para explicarlo en la interfaz
  ventanaHistorial: string;
  mensajesQueViajan: number;
  mensajesRecortados: number;
  documentosDeConsulta: number;
  medios: number;
}

/**
 * Cuánto pesa el turno que se va a enviar.
 *
 * SE MIDE EL ENVÍO DE VERDAD, no se suma a mano.
 *
 * Primero esto vivía duplicado —la barra lateral lo calculaba de una manera y
 * el aviso del chat de otra— y se unificó en una suma escrita a mano. Esa suma
 * también estaba mal, y de las dos maneras a la vez: contaba la crónica, los
 * PNJs, las tramas y los lugares, que NO viajan en el turno, y se dejaba fuera
 * los protocolos de interfaz y las instrucciones del Director, que sí viajan y
 * son treinta mil tokens. El error llegaba a veintisiete mil.
 *
 * El problema de fondo es que replicar a mano lo que arma `buildTurnPayload`
 * está condenado a desviarse en cuanto uno de los dos cambie. Así que ya no se
 * replica: se construye el envío real y se mide. Exacto por construcción, y no
 * puede volver a separarse de la realidad.
 *
 * El desglose sigue siendo orientativo —sirve para ver en qué se va— y lo que
 * no encaja en ninguna categoría se agrupa en «otros» en lugar de perderse.
 */
export function estimarCargaDelTurno({
  project,
  chats,
  currentChatId,
  files
}: {
  project: Project;
  chats: Chat[];
  currentChatId?: string | null;
  files: ProjectFile[];
}): CargaDelTurno {
  /*
   * Las directivas activas son las del proyecto, y si no las hay, las de la
   * aplicación: `buildTurnPayload` hace exactamente esta sustitución, así que
   * contar `project.instructions` a secas daba cero en una campaña que no las
   * haya tocado, cuando en realidad viajan las de por defecto enteras.
   */
  const andamiaje = CORE_INTERFACE_PROTOCOLS.length;
  const directivas =
    (project.instructions && project.instructions.trim().length > 10
      ? project.instructions.length
      : DEFAULT_DM_INSTRUCTIONS.length) +
    (project.system && project.system.trim().length > 5 ? project.system.length : DEFAULT_SYSTEM.length) +
    (project.style && project.style.trim().length > 5 ? project.style.length : DEFAULT_STYLE.length);

  /*
   * De la memoria solo viaja esto. La crónica, los PNJs, las tramas, los
   * lugares y el estado actual NO se envían en el turno: alimentan la memoria
   * general del proyecto y las pantallas, pero el Narrador no los recibe.
   * Contarlos aquí era inflar la cifra con algo que nadie manda.
   */
  const mem = project.memory;
  const memoria =
    (mem?.raw_project_memory?.length || 0) +
    (mem?.memory_edits || []).reduce((acc, e) => acc + (e.text?.length || 0), 0);

  // Un archivo de texto viaja entero salvo que sea una muestra de estilo (su
  // valor ya se destiló en las directivas) o esté marcado de consulta. Las
  // tablas de oráculo son la excepción a la excepción: se mandan siempre,
  // porque un oráculo que hay que pedir no sirve de nada.
  const esTexto = (f: ProjectFile) => !f.isImage && !f.isAudio && f.category !== 'style_sample';
  const viajaEntero = (f: ProjectFile) =>
    esTexto(f) &&
    (!f.onDemand ||
      f.category === 'oracle' ||
      f.category === 'roster' ||
      f.category === 'index' ||
      f.category === 'sheet_pj');
  const archivos = files.reduce((acc, f) => acc + (viajaEntero(f) ? f.length || 0 : 0), 0);

  const deConsulta = files.filter(
    f =>
      esTexto(f) &&
      Boolean(f.onDemand) &&
      f.category !== 'oracle' &&
      f.category !== 'roster' &&
      f.category !== 'index' &&
      f.category !== 'sheet_pj'
  );
  const archivosDeConsulta = deConsulta.reduce((acc, f) => acc + (f.length || 0), 0);
  const medios = files.filter(f => f.isImage || f.isAudio).length;

  // El capítulo en curso viaja entero salvo que haya ventana de historial.
  const capitulo = chats.find(c => c.id === currentChatId) || chats[chats.length - 1];
  const ventanaHistorial = getStoredHistoryWindow();
  const mensajesDelCapitulo = (capitulo?.messages || []).filter(
    m => m.content && m.content !== 'Tirando dados...' && m.content !== 'Pensando...'
  );
  const viajan =
    ventanaHistorial === 'all'
      ? mensajesDelCapitulo
      : mensajesDelCapitulo.slice(-(parseInt(ventanaHistorial, 10) || mensajesDelCapitulo.length));
  const capituloActual = viajan.reduce((acc, m) => acc + (m.content?.length || 0), 0);

  // De los capítulos anteriores solo va una cola, con el mismo tope que el envío.
  const PREVIO_MAX = 8000;
  const capitulosPrevios = Math.min(
    PREVIO_MAX,
    chats
      .filter(c => c.id !== capitulo?.id)
      .reduce((acc, c) => acc + (c.messages || []).reduce((a, m) => a + (m.content?.length || 0), 0), 0)
  );

  // Los fragmentos rescatados sí viajan. Cuánto exacto depende de la escena y no
  // se sabe hasta el turno: se pone el techo, que es lo honesto. La barra debe
  // pecar de prudente, no de optimista.
  const fragmentosRescatados = getStoredBusquedaLocal() && deConsulta.length ? PRESUPUESTO_FRAGMENTOS_CONSULTA : 0;

  const declarado =
    andamiaje + directivas + memoria + archivos + capituloActual + capitulosPrevios + fragmentosRescatados;

  /*
   * La cifra buena: se arma el envío real y se mide. Si no se puede (una
   * campaña sin capítulos todavía), se usa la suma declarada, que para ese caso
   * se queda muy cerca.
   */
  let total = declarado;
  try {
    if (capitulo) {
      const { sys, contents } = buildTurnPayload({
        project,
        currentChatId: capitulo.id,
        chats,
        files,
        userText: '',
        dicePool: { d20: [], d100: [], d6: [] }
      });
      const largoContenidos = contents.reduce(
        (acc: number, c: any) =>
          acc + (c.parts || []).reduce((a: number, part: any) => a + (part.text?.length || 0), 0),
        0
      );
      total = sys.length + largoContenidos;
    }
  } catch {
    // Un turno que no se puede armar no debe romper una barra de progreso.
  }

  return {
    andamiaje,
    directivas,
    memoria,
    archivos,
    archivosDeConsulta,
    capituloActual,
    capitulosPrevios,
    fragmentosRescatados,
    otros: Math.max(0, total - declarado),
    total,
    tokens: Math.round(total / CARACTERES_POR_TOKEN),
    ventanaHistorial,
    mensajesQueViajan: viajan.length,
    mensajesRecortados: mensajesDelCapitulo.length - viajan.length,
    documentosDeConsulta: deConsulta.length,
    medios
  };
}

/** Cuántos personajes habituales se le describen al Narrador en cada turno. */
const MAX_PNJS_EN_PROMPT = 12;

/**
 * El dosier de los personajes que el Narrador debería conocer.
 *
 * Esto no llegaba. De todos los PNJs, `buildTurnPayload` usaba únicamente los
 * NOMBRES, y solo para armar la consulta de búsqueda local: ni lo que aparentan,
 * ni lo que ocultan, ni sus disfraces, ni su equipo. El Narrador dirigía a
 * ciegas a gente de la que la aplicación tenía ficha completa.
 *
 * Las consecuencias se notan jugando. Un PNJ con un sombrero de disfraz en el
 * inventario nunca lo usa, porque el Narrador no sabe que lo tiene. Un
 * corsario que finge una cosa y trama otra no puede sostener la diferencia,
 * porque no le consta cuál es. Y las directivas piden emitir vínculos «solo
 * para los personajes que la aplicación ya te ha listado arriba como
 * habituales» — una lista que nunca se enviaba.
 *
 * Viajan solo los recurrentes, y recortados: es el precio de que el Narrador
 * sepa a quién está dirigiendo.
 */
/**
 * Cuántos nombres del elenco caben en la lista corta.
 *
 * Son una línea cada uno: aquí lo que se paga es no tener que inventarse a
 * nadie, y eso sale barato.
 */
const MAX_ELENCO_EN_PROMPT = 24;

/**
 * Cuánto hace que alguien no sale, en las mismas unidades que `diasVistos`.
 *
 * `diasVistos` guarda jornadas de campaña si hay calendario, y cuenta de
 * mensajes si no lo hay. Da igual cuál sea mientras la comparación se haga
 * contra la misma referencia: lo que importa es el ORDEN, quién lleva más
 * tiempo fuera de escena.
 */
function jornadasSinSalir(n: NPC, marcaActual: number): number | null {
  const vistos = n.diasVistos || [];
  if (!vistos.length || !Number.isFinite(marcaActual)) return null;
  return Math.max(0, marcaActual - Math.max(...vistos));
}

function dosierDePersonajes(npcs: NPC[], marcaActual = 0): string {
  const conNombre = (npcs || []).filter(n => n.name && n.name.trim().length > 1);
  const habituales = conNombre
    .filter(n => n.recurrente || (n.diasVistos?.length || 0) >= 2)
    .slice(-MAX_PNJS_EN_PROMPT);

  /*
   * El resto del elenco, en una línea por cabeza.
   *
   * El dosier completo solo incluye a los habituales, y eso dejaba fuera a todo
   * el que viniera de un documento sin haber salido aún en escena: Serena,
   * Braelin o Kimmuriel existían en la memoria y el Narrador no se enteraba.
   * Y era un círculo cerrado, porque para volverse habitual hay que aparecer
   * dos veces, y no puedes aparecer si quien narra no sabe que existes. El
   * resultado era una taberna llena de gente inventada teniendo el elenco
   * escrito al lado.
   */
  const idsHabituales = new Set(habituales.map(n => n.id));
  /*
   * Solo la gente que HA SALIDO, o que a la jugadora le importa.
   *
   * Extraer un compendio dejaba cuarenta y dos personajes en la memoria, y
   * todos viajaban en cada turno: novecientas fichas de gente que aún no se ha
   * conocido, más una lista de nombres que se descubren leyendo la pantalla en
   * vez de jugando. El Narrador ya tiene esos personajes en los documentos; lo
   * que necesita del elenco es acordarse de quien YA está en la partida.
   *
   * Lo que cuenta como «está en la partida»: haber salido alguna vez, o que la
   * jugadora le haya puesto retrato o afinidad, que es señal de que le importa.
   */
  const enLaPartida = (n: NPC) =>
    (n.diasVistos?.length || 0) >= 1 ||
    Boolean(n.portrait) ||
    typeof n.atr === 'number' ||
    typeof n.vin === 'number' ||
    typeof n.con === 'number';
  const elenco = conNombre
    .filter(n => !idsHabituales.has(n.id) && enLaPartida(n))
    .slice(-MAX_ELENCO_EN_PROMPT);

  const bloqueElenco = elenco.length
    ? `
#### 🎭 EL RESTO DEL ELENCO QUE YA ESTÁ EN LA PARTIDA
Gente que ya ha salido alguna vez, aunque todavía no tenga dosier completo. EXISTEN y se llaman así.
- ⛔ NO te inventes un personaje nuevo para un papel que ya cubre alguien de esta lista. Si en la escena hace falta la mano derecha, el que lleva la barra o el mago de la banda, es el que figura aquí, con su nombre.
- El detalle de cada uno está en los documentos de la campaña. Cuando alguno entre en escena de verdad, pásalo a tu dosier con \`[VÍNCULO: ...]\`.

${elenco
  .map(n => {
    const quien = [n.relation, n.description || n.aparenta || n.notes]
      .filter(Boolean)
      .map(v => String(v).trim().slice(0, 130))
      .join(' · ');
    return `- **${n.name.trim()}**${quien ? ` — ${quien}` : ''}`;
  })
  .join('\n')}
`.trim()
    : '';

  if (habituales.length === 0) {
    // Sin habituales todavía, el elenco es lo único que hay, y hace falta.
    return bloqueElenco
      ? `
### 👥 PERSONAJES DE LA CAMPAÑA (dosier del Director)

${bloqueElenco}
`.trim()
      : '';
  }

  const corta = (v: string | undefined, max: number) =>
    v && v.trim() ? v.trim().slice(0, max) : '';

  const fichas = habituales.map(n => {
    const lineas: string[] = [];
    const nombre = n.trueIdentity && n.trueIdentity !== n.name ? `${n.name} (en realidad ${n.trueIdentity})` : n.name;
    lineas.push(`### ${nombre}${n.relation ? ` — ${n.relation}` : ''}${n.status ? ` · ${n.status}` : ''}`);
    if (n.alias) lineas.push(`- Se le conoce como: ${corta(n.alias, 120)}`);
    if (n.disguise) lineas.push(`- ⚠️ DISFRAZ ACTIVO / apariencia falsa: ${corta(n.disguise, 300)}`);
    if (n.appearance) lineas.push(`- Aspecto: ${corta(n.appearance, 300)}`);
    if (n.aparenta) lineas.push(`- Lo que DEJA VER al protagonista: ${corta(n.aparenta, 300)}`);
    /*
     * Un secreto y un dato sabido no se narran igual, y hasta ahora eran la
     * misma línea. Lo que ya salió en escena deja de estar prohibido: seguir
     * tratándolo como secreto hace que el Narrador finja que el protagonista
     * no sabe algo que sabe, y ahí se pierden las dos cosas —la sorpresa antes
     * y la consecuencia después.
     */
    if (n.oculta) {
      const rev = n.secretoRevelado;
      lineas.push(
        rev
          ? `- 🔓 YA SE SUPO${rev.fecha ? ` (${rev.fecha})` : ''}${rev.como ? `, ${corta(rev.como, 140)}` : ''} — el protagonista LO SABE: ${corta(n.oculta, 300)}`
          : `- 🔒 LO QUE CALLA (el protagonista NO lo sabe todavía): ${corta(n.oculta, 300)}`
      );
    }
    if (n.vinculo) lineas.push(`- Vínculo: ${corta(n.vinculo, 120)}`);
    /*
     * Cuánto hace que no sale.
     *
     * El dato existía —`diasVistos`— y solo se usaba para decidir quién entra
     * en el dosier; al Narrador no se le contaba nunca. Sin él no puede rotar
     * el reparto: tira de quien tiene delante, que es siempre el mismo, y hay
     * personajes con secciones enteras en los documentos que no salen jamás.
     */
    const ausencia = jornadasSinSalir(n, marcaActual);
    if (ausencia !== null) {
      lineas.push(
        ausencia === 0
          ? `- 🎬 Está en escena AHORA MISMO.`
          : ausencia <= 2
          ? `- 🎬 Sale a menudo. Si vive o trabaja aquí, eso es lo correcto: no lo apartes por dar variedad.`
          : `- 💤 LLEVA ${ausencia} SIN SALIR. Podría entrar ADEMÁS de los de siempre, si la escena le da un motivo.`
      );
    }
    if (typeof n.atr === 'number' || typeof n.vin === 'number' || typeof n.con === 'number') {
      lineas.push(`- Afinidad: atracción ${n.atr ?? 0}/20 · vínculo ${n.vin ?? 0}/20 · confianza ${n.con ?? 0}/20`);
    }
    if (n.notes) lineas.push(`- Notas: ${corta(n.notes, 400)}`);

    /*
     * El equipo es lo que hace que un personaje ACTÚE como quien es. Sin esta
     * línea, el sombrero de disfraz, la varita o el piwafwi son adorno en una
     * ficha que nadie lee.
     */
    const equipo = (n.characterSheet?.inventory || [])
      .filter(i => i.name)
      .slice(0, 12)
      .map(i => `${i.name}${i.attuned ? ' (sintonizado)' : ''}${i.description ? ` — ${i.description.slice(0, 90)}` : ''}`);
    if (equipo.length) lineas.push(`- 🎒 Recursos y objetos de los que dispone: ${equipo.join('; ')}`);

    return lineas.join('\n');
  });

  return `
### 👥 PERSONAJES HABITUALES QUE YA CONOCES (dosier del Director)
Esta es tu ficha interna de la gente recurrente de la campaña. Úsala: son sus datos, no sugerencias.
- 🔒 ES TUYO, NO DEL PROTAGONISTA. No se narra, no se insinúa gratis, ningún PNJ lo suelta sin un motivo ganado en escena y NUNCA aparece en el HUD, en la crónica ni en un resumen. Que tú lo sepas no es que ella lo sepa: si lo sueltas, has destripado el giro y ya no hay vuelta atrás.
- 🔒 SE DESTAPA JUGÁNDOLO: investigando, ganándose la confianza, una indiscreción de un tercero, un descuido, una prueba física. Cuando de verdad salga a la luz en la escena, y SOLO entonces, cierra el mensaje con \`[REVELADO: Nombre — cómo se ha sabido]\`. A partir de ahí pasa a ser algo con lo que el protagonista puede contar.
- 🔓 YA SE SUPO: eso ya no es un secreto. Puede mencionarse, tener consecuencias y salir en boca de quien corresponda. No hagas como si el protagonista no lo supiera.
- 📈 ESTOS SON LOS DE HOY. Lo que sepas de estas personas por novelas o material publicado es su pasado; lo que diga este dosier y los documentos de campaña es su presente, y manda aunque contradiga lo que recuerdes. Si un documento trae un apartado de evolución, de «ahora» o de errores a evitar, ESO es el canon de esta mesa.
- 💤 ROTA EL REPARTO SUMANDO, NUNCA QUITANDO. Quien vive o trabaja donde pasa la escena tiene que estar ahí, y verlo a diario es lo correcto: el jefe de la banda en el cuartel de la banda sale todos los días, y lo que cambia es qué hace y de qué humor está, no si aparece. Rotar es preguntarse quién MÁS entra por esa puerta. Y para eso, mira DOS cosas en este orden: primero, si alguno de los portadores de la trama (🚪) tiene ya su disparador cumplido —ese entra con algo que contar y la escena se justifica sola—; y si no hay ninguno, quién lleva más tiempo sin salir de los de aquí arriba y de los documentos, y si esa escena le da un motivo para asomar. Tirar siempre de los dos o tres que ya están delante convierte una banda entera en un dúo, y deja sin usar a gente con secciones propias en el material.
- ⛔ Pero no es un sorteo: quien vuelve necesita un MOTIVO en la ficción para estar ahí —le mandaron, le conviene, pasaba por su territorio, quiere algo de alguien—. Un cameo sin motivo es peor que la repetición.
- Lo marcado como 🎒 es lo que ESE personaje puede usar en escena. Si tiene medios para resolver algo a su manera, los usa (ver el protocolo de disfraces e ilusión).

${fichas.join('\n\n')}
${bloqueElenco ? `\n${bloqueElenco}` : ''}
`.trim();
}

/**
 * Cuántos lugares caben en el dosier de cada turno.
 *
 * Una campaña acumula tabernas, calles y salas; mandarlas todas sería pagar
 * cada turno por sitios donde no se ha vuelto en meses. Doce cubre de sobra el
 * mundo que se está usando.
 */
const MAX_LUGARES_EN_PROMPT = 12;

/**
 * Los sitios de la campaña, con sus nombres, en cada turno.
 *
 * `memory.locations` existía, la sincronización lo rellenaba... y no llegaba al
 * Narrador por ninguna vía. Con el compendio marcado «de consulta», que un
 * lugar apareciera dependía de que la búsqueda por palabras acertara ese turno:
 * bastaba con que no acertara para que la taberna del cuartel general se
 * llamara de repente «El Gato Verde». Un nombre propio no puede depender de una
 * lotería.
 *
 * Es barato justamente porque son nombres y una línea de qué es cada sitio: lo
 * que hace falta para NO inventárselo. El detalle sigue viniendo de los
 * documentos.
 */
function dosierDeLugares(locations: Location[]): string {
  const utiles = (locations || [])
    .filter(l => l.name && l.name.trim().length > 1)
    .slice(-MAX_LUGARES_EN_PROMPT);
  if (utiles.length === 0) return '';

  const fichas = utiles.map(l => {
    const desc = (l.desc || '').trim().slice(0, 260);
    // Las notas suben de 200 a 420: aquí es donde vive lo que se ha fijado
    // jugando —cómo abren las puertas, a qué huele, quién vigila la entrada— y
    // recortarlo a dos líneas era perderlo igual que no tenerlo.
    const notas = (l.notes || '').trim().slice(0, 420);
    return `- **${l.name.trim()}**${desc ? ` — ${desc}` : ''}${notas ? `\n  · YA ESTABLECIDO: ${notas}` : ''}`;
  });

  return `
### 🗺️ LUGARES DE LA CAMPAÑA (nombres canónicos)
Estos sitios YA EXISTEN y ya tienen nombre. Es tu lista de nombres propios, no una sugerencia.
- ⛔ NO renombres ninguno, ni lo traduzcas, ni le pongas un nombre «parecido» porque suene mejor. Si en la escena aparece uno de estos sitios, se llama EXACTAMENTE como está escrito aquí.
- ⛔ NO inventes un local nuevo para una función que ya cubre uno de estos. Si el grupo va a la taberna de la banda, es la que figura aquí.
- ✅ Puedes crear lugares nuevos cuando la escena lo pida de verdad; entonces el nombre lo pones tú y pasa a ser canon.
- **⛔ Y LO QUE PONGA EN «YA ESTABLECIDO» ES CANON DEL SITIO, NO UNA SUGERENCIA.** Son cosas concretas que ya se han visto en la partida y la jugadora las recuerda: si las puertas de un local abren con una runa de custodia, NO se abren con llave dos escenas después. Cambiarlo sin motivo en la ficción —que alguien las haya forzado, que hayan cambiado el cierre— rompe el sitio.
- **✅ Y cuando establezcas algo concreto y distintivo de un lugar, FÍJALO** con \`[LUGAR: nombre del sitio | el detalle]\`: cómo se cierra, a qué huele, qué se oye desde allí, quién guarda la puerta, qué tecnología usa. Lo que no se apunta no vuelve, y un sitio al que le cambian los detalles cada vez que se entra deja de ser un sitio.
- El resto del detalle está en los documentos de la campaña; esto es para que los llames por su nombre y respetes lo ya visto.

${fichas.join('\n')}
`.trim();
}

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

  /*
   * La misma referencia con la que se apuntó `diasVistos`: jornada de campaña
   * si hay calendario, y si no, cuenta de mensajes.
   */
  const marcaDeHoy = calendarioValido(project.calendar) && project.currentDate
    ? aDiaAbsoluto(project.calendar!, project.currentDate)
    : (chats || []).reduce((a, c) => a + (c.messages || []).length, 0);
  const dosierPnjs = dosierDePersonajes(project.memory?.npcs || [], marcaDeHoy);
  const dosierLugares = dosierDeLugares(project.memory?.locations || []);

  /*
   * Los giros que aún no han pasado.
   *
   * Van aparte del dosier de personajes porque no son de nadie: «el barco es
   * una tapadera Zhentarim» no cuelga de un PNJ ni vence ningún día. Sin este
   * bloque, una idea que la jugadora había plantado al preparar la campaña no
   * llegaba al Narrador de ninguna forma, y acababa contándose de pasada en la
   * prosa o perdiéndose del todo.
   */
  const secretos = project.memory?.gm_secrets || [];
  const plan = project.memory?.plan_de_campana;
  const NOMBRE_DE_CAPA: Record<number, string> = {
    1: 'CAPA 1 — lo que PARECE que pasa',
    2: 'CAPA 2 — lo que pasa DE VERDAD',
    3: 'CAPA 3 — quién está detrás y qué gana',
    4: 'CAPA 4 — el fondo del asunto'
  };
  const porCapa = [1, 2, 3, 4]
    .map(c => ({ c, lista: secretos.filter(x => (x.capa || 1) === c) }))
    .filter(x => x.lista.length);

  /*
   * LA TRAVESÍA, CONTADA POR LA APLICACIÓN.
   *
   * La §7 ya prohibía el fast-travel y decía que de las Moonshae a Luskan hay
   * de 8 a 12 días. No sirvió: una partida entera fue de despertar encadenada
   * en la bodega a desembarcar en Whitesails sin que pasara una sola jornada.
   * El motivo es que nadie llevaba la cuenta —el Narrador no tenía delante
   * cuántos días le quedaban— y una prohibición sin cuenta atrás es un deseo.
   * Ahora el número va delante en cada turno, con lo que falta y lo que ya
   * lleva, que es lo único que un modelo no puede «olvidar».
   */
  const viaje = project.memory?.viaje;
  const bloqueViaje = (() => {
    if (!viaje?.destino || !viaje.jornadas) return '';
    const cal = project.calendar;
    const hoyAbs =
      calendarioValido(cal) && project.currentDate ? aDiaAbsoluto(cal, project.currentDate) : undefined;
    const hechas =
      hoyAbs !== undefined && Number.isFinite(viaje.iniciadoAbs)
        ? Math.max(0, hoyAbs - viaje.iniciadoAbs)
        : 0;
    const faltan = Math.max(0, viaje.jornadas - hechas);
    return `
### 🧭 TRAVESÍA EN CURSO — RUMBO A ${viaje.destino.toUpperCase()}
**Jornada ${Math.min(hechas + 1, viaje.jornadas)} de ${viaje.jornadas}. ${
      faltan > 0
        ? `QUEDAN ${faltan} ${faltan === 1 ? 'JORNADA' : 'JORNADAS'} DE CAMINO.`
        : 'EL TRAYECTO YA ESTÁ CUMPLIDO: se puede llegar en cuanto la escena lo permita.'
    }**

${
  faltan > 0
    ? `**⛔ NO SE LLEGA TODAVÍA.** Hasta que se consuman esas ${faltan} ${faltan === 1 ? 'jornada' : 'jornadas'} no hay puerto, ni muelle, ni tierra a la vista, ni «al cabo de unos días llegaron». Da igual lo que apetezca a la escena: el trayecto se paga día a día. Un descanso largo a bordo avanza **una** jornada, nunca el viaje entero.
- **Y esas jornadas hay que VIVIRLAS, no saltarlas de golpe.** Cada una es una escena o media: quién hace guardia, qué se come, qué se oye por la noche, una conversación que solo pasa porque hay tiempo muerto. Un viaje largo es de las mejores cosas que le pueden pasar a una campaña —es donde la gente se conoce— y también el sitio natural de las escenas fuera de cámara (§3).
- Para adelantar de verdad varias jornadas de una vez, hace falta un salto declarado con \`[TIEMPO: +Nd]\`, y entonces cuentas lo que pasó en esos días, no los borras.
- Cuando por fin se llegue, cierra con \`[VIAJE: fin]\` en ese mismo turno.`
    : `Ya se puede tocar puerto. Cuando se llegue, cierra con \`[VIAJE: fin]\`.`
}
`.trim();
  })();

  const bloqueSecretos = secretos.length || plan
    ? `
### 🔒 LA HISTORIA, YA TRAZADA — SOLO TÚ
${plan?.premisa ? `**DE QUÉ VA ESTO DE VERDAD:** ${plan.premisa}\n` : ''}${plan?.destino ? `**HACIA DÓNDE VA:** ${plan.destino}\n` : ''}
Esto no es una lista de sorpresas sueltas: es la estructura de la historia, decidida de antemano y por capas, donde cada una reinterpreta la anterior sin desmentirla. Tú la sabes ENTERA desde el principio. Ese es justo el motivo de que puedas dirigir en vez de improvisar.

**QUÉ HACES CON ESTO EN CADA ESCENA:**
- **SIEMBRA.** Lo de «se puede ir sembrando» va en escena AHORA, mucho antes de que nadie lo descubra, como detalle físico sin subrayar: se menciona y se sigue adelante. Un giro sin siembra previa se lee como un truco; con ella, como algo que estaba delante todo el rato. Si una escena te da ocasión de plantar una semilla, plántala.
- **APUNTA HACIA ALLÍ.** Cuando decidas qué complicación aparece, quién entra por la puerta o qué encuentran, elige lo que empuje hacia esta estructura. Ese es el trabajo: que las escenas lleven a algún sitio.
- **🚪 LA GENTE LLEGA CON ALGO, NO PORQUE TOQUE.** Cuando toque meter a alguien en escena, mira PRIMERO los portadores de aquí abajo: si a alguno se le ha cumplido lo que lo dispara, ese es quien aparece, y aparece CON LO SUYO. Un personaje que vuelve porque algo se ha movido y él es quien lo sabe hace avanzar la historia y justifica su propia presencia a la vez; el mismo personaje volviendo por variedad es relleno. Y si nadie tiene motivo todavía, no fuerces a nadie: haz que la escena lo genere.
- **RESPETA EL ORDEN DE LAS CAPAS.** No destapes una capa profunda antes que la de encima. Si el protagonista se acerca a la capa 3 sin haber entendido la 2, lo que encuentra no tiene sentido todavía: dale la pieza que le falta, no la respuesta final.
- **⛔ NUNCA LO CUENTAS.** Ni lo insinúas con guiños, ni lo resume el narrador, ni lo suelta un PNJ sin un motivo ganado en escena. No aparece en el HUD, la crónica, la agenda ni ningún resumen. Saberlo es para dirigir, no para contar.
- **⛔ NO LO CONTRADIGAS NI LO SUSTITUYAS** por otra explicación que se te ocurra sobre la marcha: esto es canon, solo falta que se descubra.
- **Cuando uno salga de verdad a la luz**, cierra con \`[REVELADO: título del secreto — cómo se ha sabido]\`. Y si al jugar aparece una capa nueva que encaja, plántala con \`[SECRETO: ...]\`.

${porCapa
  .map(
    ({ c, lista }) => `#### ${NOMBRE_DE_CAPA[c] || `CAPA ${c}`}
${lista
  .map(sec =>
    [
      sec.revelado
        ? `**🔓 ${sec.titulo}** — YA SE SUPO${sec.revelado.fecha ? ` (${sec.revelado.fecha})` : ''}${sec.revelado.como ? `, ${sec.revelado.como.slice(0, 140)}` : ''}. El protagonista LO SABE y puedes usarlo con normalidad.`
        : `**🔒 ${sec.titulo}** — en pie, el protagonista NO lo sabe`,
      `- La verdad: ${sec.secreto.slice(0, 600)}`,
      sec.conecta?.length ? `- Engancha con: ${sec.conecta.slice(0, 5).join(' · ')}` : '',
      !sec.revelado && sec.sembrar ? `- 🌱 SIEMBRA ESTO YA: ${sec.sembrar.slice(0, 300)}` : '',
      !sec.revelado && sec.quienLoTrae ? `- 🚪 QUIÉN PUEDE TRAERLO A ESCENA: ${sec.quienLoTrae.slice(0, 300)}` : '',
      !sec.revelado && sec.comoSeDescubre ? `- Por dónde puede salir: ${sec.comoSeDescubre.slice(0, 300)}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  )
  .join('\n\n')}`
  )
  .join('\n\n')}
`.trim()
    : '';

  const memoryContext = project.memory
    ? `
${rawProjectMemBlock}
${userDirectivesBlock}
${dosierPnjs ? `${dosierPnjs}\n` : ''}${dosierLugares ? `${dosierLugares}\n` : ''}${bloqueViaje ? `${bloqueViaje}\n` : ''}${bloqueSecretos ? `${bloqueSecretos}\n` : ''}
${allPreviousHistory.length > 0 ? `RESUMEN DE SESIONES PREVIAS:\n${allPreviousHistory}` : ''}
  `.trim()
    : 'No hay memoria acumulada aún.';

  // Clasificación de documentos: "Siempre presentes" vs "De consulta inteligente (On-Demand)"
  const esTexto = (f: ProjectFile) => !f.isImage && !f.isAudio && f.category !== 'style_sample';

  // Fichas específicas del protagonista que viajan íntegras (las fichas de PJ viajan SIEMPRE completas para evitar alucinaciones)
  const pc = project.memory?.player_character;

  /*
   * LAS FICHAS DE SUS COMPAÑEROS, EN SU PROPIO SITIO.
   *
   * `sheet_companion` existía como categoría y NO SE USABA EN NINGUNA PARTE al
   * montar el turno. Una ficha de compañero ni era ficha del PJ ni tenía
   * bloque propio: caía en el montón general de documentos, detrás de doscientos
   * mil caracteres de compendio. Por eso la polilla lunar viajaba entera en
   * cada turno y no salía NUNCA: estaba, pero enterrada.
   *
   * Y tampoco vale meterlas con las del protagonista: entonces sus rasgos se
   * mezclan con los de ella, que es otra forma de estropearlo.
   */
  const companionFiles = files.filter(f => esTexto(f) && f.category === 'sheet_companion');
  const companionIds = new Set(companionFiles.map(f => f.id));

  const pjSheetFiles = files.filter(
    f =>
      esTexto(f) &&
      !companionIds.has(f.id) &&
      (f.category === 'sheet_pj' ||
        f.name.toLowerCase().includes('ficha') ||
        f.name.toLowerCase().includes('personaje') ||
        f.name.toLowerCase().includes('character') ||
        f.name.toLowerCase().includes('sheet') ||
        f.name.toLowerCase().includes('protagonista') ||
        f.name.toLowerCase().includes('pj') ||
        f.name.toLowerCase().includes('oc'))
  );
  const pjSheetIds = new Set(pjSheetFiles.map(f => f.id));

  // Documentos marcados como "De consulta" (onDemand: true, salvo oráculos, elencos, índices y fichas de PJ)
  const deConsulta = files.filter(
    f =>
      esTexto(f) &&
      Boolean(f.onDemand) &&
      !pjSheetIds.has(f.id) &&
      !companionIds.has(f.id) &&
      f.category !== 'oracle' &&
      f.category !== 'roster' &&
      f.category !== 'index' &&
      f.category !== 'sheet_pj'
  );
  const deConsultaIds = new Set(deConsulta.map(f => f.id));

  // Documentos "Siempre presentes" (onDemand false o no marcado, u oráculos)
  // Las fichas del PJ se excluyen de aquí porque se formatean íntegras en pjSection
  const siemprePresentes = files.filter(
    f => esTexto(f) && !deConsultaIds.has(f.id) && !pjSheetIds.has(f.id) && !companionIds.has(f.id)
  );

  const filesText = siemprePresentes.length > 0
    ? siemprePresentes
        .map(f => {
          let texto = `=== DOCUMENTO: ${f.name} ===\n${f.content || ''}`;
          if (f.analysis && f.analysis.trim().length > 0) {
            texto += `\n[Notas / Análisis adjunto de ${f.name}]:\n${f.analysis.trim()}`;
          }
          return texto;
        })
        .join('\n\n')
    : 'No hay documentos de texto adicionales siempre presentes.';

  // Gestión inteligente de documentos de consulta (On-Demand)
  let deConsultaCatalogo = '';
  let fragmentosConsultaText = '';

  /*
   * Qué documentos han viajado de verdad en este turno.
   *
   * Se recoge aquí, donde se decide, y se devuelve con el envío para que el
   * registro de llamadas pueda enseñarlo. Discutir «no manda los documentos»
   * sin esta lista era discutir a ciegas.
   */
  let documentosDelTurno: {
    enteros?: string[];
    fragmentos?: string[];
    sinUsar?: string[];
  } = {};

  if (deConsulta.length > 0) {
    deConsultaCatalogo = `\n\n### 📚 COMPENDIOS Y ARCHIVOS DE CONSULTA EN LA BIBLIOTECA (ON-DEMAND):
Los siguientes compendios de lore, ambientación y reglas forman parte del archivo del proyecto. Para optimizar tokens y agilizar la respuesta, su texto completo permanece en la biblioteca y sus fragmentos pertinentes se rescatan dinámicamente según lo que suceda en la escena. Si necesitas verificar un dato muy específico no recogido en los fragmentos, indícalo a la jugadora:
${deConsulta.map(f => `- 📄 **${f.name}**${f.analysis ? `: ${f.analysis.slice(0, 220).trim()}...` : (f.category ? ` [Categoría: ${f.category}]` : '')}`).join('\n')}
${
      deConsulta.some(f => f.category === 'mecanica')
        ? '\n⚙️ **Los archivos de MECÁNICA son PORTÁTILES.** Un subsistema traído de un módulo —persecución por los tejados, frío extremo, intriga urbana, asedio— NO está atado a la ciudad ni a la región donde se publicó: si en esta escena hay una huida por los tejados, se usan esas reglas aunque el documento hable de otra ciudad. Lo que se adapta es el decorado, no el procedimiento.'
        : ''
    }`;

    if (getStoredBusquedaLocal()) {
      const ultimosMensajes = currentChat.messages || [];
      const ultimoMensajeNarrador = [...ultimosMensajes].reverse().find(m => m.role === 'model')?.content;
      const nombresVivos = [
        ...(project.memory?.npcs?.map(n => n.name) || []),
        ...(project.memory?.player_character?.name ? [project.memory.player_character.name] : [])
      ];

      /*
       * Lo que lleva encima y quien la acompaña pesa en cada consulta.
       *
       * Su equipo, sus compañeros animales y los objetos con nombre de su ficha
       * no son lore que haya que ir a buscar: son suyos y están siempre. Sin
       * meterlos aquí, un compañero o un objeto que la jugadora no nombre en su
       * turno desaparece de la campaña sin que nadie lo note.
       */
      const loSuyo = [
        ...(project.memory?.player_character?.inventory || [])
          .map(i => (typeof i === 'string' ? i : i?.name))
          .filter(Boolean) as string[],
        ...(project.memory?.companions || []).map(c => c?.name).filter(Boolean) as string[],
      ]
        .map(t => String(t).trim())
        .filter(t => t.length > 2)
        .slice(0, 30);

      const consulta = consultaDelTurno({
        textoJugadora: userText,
        ultimaNarracion: ultimoMensajeNarrador,
        nombres: nombresVivos,
        suyo: loSuyo
      });

      const rescatados = recuperar(deConsulta, consulta, PRESUPUESTO_FRAGMENTOS_CONSULTA);
      const conFragmento = new Set(rescatados.map(r => r.fragmento.fileName));
      documentosDelTurno = {
        fragmentos: [...conFragmento],
        sinUsar: deConsulta.map(f => f.name).filter(n => !conFragmento.has(n))
      };
      if (rescatados.length > 0) {
        fragmentosConsultaText = `### 📖 FRAGMENTOS RELEVANTES RESCATADOS DE ARCHIVOS DE CONSULTA:
(El sistema ha recuperado estos extractos de tus documentos de consulta por su pertinencia directa con la escena presente):
${rescatados.map(r => `--- [Fragmento de: ${r.fragmento.fileName}${r.fragmento.titulo ? ` · ${r.fragmento.titulo}` : ''}] ---\n${r.fragmento.texto}`).join('\n\n')}`;
      }
    }
  }

  // Protagonist / Character Sheet Section
  /*
   * QUIÉN VA CON ELLA.
   *
   * Este bloque no existía. La compañera podía tener ficha propia, categoría
   * propia y viajar entera en cada turno, y aun así no salir jamás: estaba
   * dentro del montón de documentos, y ahí un bicho de seis mil caracteres no
   * compite con un compendio de doscientos mil. Ahora tiene sitio propio,
   * pegado al bloque del protagonista, que es donde se atiende.
   */
  const acompanantes = (project.memory?.companions || []).filter(c => (c?.name || '').trim());
  const companionSection =
    companionFiles.length || acompanantes.length
      ? `
### 🐾 QUIEN VA CON ELLA (COMPAÑEROS, FAMILIARES Y MONTURAS)
**No son atrezo ni un recuerdo de la ficha: están AQUÍ, en la escena, salvo que la propia escena diga lo contrario** (se quedaron fuera, están heridos, los han separado). Si llevan sin aparecer varias escenas y nada lo explica, es que se te han olvidado, y eso la jugadora lo nota antes que nada.
- Tienen conducta propia: reaccionan a lo que pasa, se inquietan, se acercan, desaparecen un rato y vuelven. No esperan a que alguien los nombre.
- ⛔ Y NO SON DEL NARRADOR PARA DECIDIR POR ELLOS lo que le toca decidir a ella: si la compañera es suya, lo que hace en una escena tensa lo declara ella (§6 ante). Tú narras lo que el bicho hace por su cuenta, no lo que ella le ordena.
${acompanantes.length ? `
${acompanantes.map(c => `- **${c.name}**${c.companionType ? ` (${c.companionType})` : ''}${c.race || c.class ? ` — ${[c.race, c.class].filter(Boolean).join(' · ')}` : ''}${c.appearance ? `\n  Se la ve así: ${c.appearance.slice(0, 200)}` : ''}`).join('\n')}` : ''}
${
  companionFiles.length
    ? `
${companionFiles
        .map(f => `=== FICHA DE COMPAÑERO: ${f.name} ===\n${f.content || ''}${f.analysis?.trim() ? `\n[Notas adjuntas]:\n${f.analysis.trim()}` : ''}`)
        .join('\n\n')}`
    : ''
}
`.trim()
      : '';

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
${pc.race
  ? `- RAZA / ESPECIE: ${pc.race} ← DATO FIJO. Es lo que ES, por encima de lo que sugiera cualquier documento, nombre o descripción. No la cambies, no la "corrijas" y no describas al protagonista como de otra especie ni de pasada.`
  : `- RAZA / ESPECIE: ⚠️ NO CONSTA EN LA FICHA. NO te la inventes ni la deduzcas del nombre, del tatuaje o del lugar de origen: describe al protagonista sin nombrar su especie y, si hace falta para la escena, pregúntaselo a la jugadora con [Pregunta de Mesa: ...].`}
${pc.class ? `- CLASE Y NIVEL: ${pc.class} ${pc.level || ''}` : ''}
${pc.languages?.length
  ? `- IDIOMAS QUE HABLA Y ENTIENDE: ${pc.languages.join(', ')} ← SOLO ESTOS. Cualquier otro idioma le resulta ruido o fonética incomprensible: no capta palabras sueltas, ni el sentido general por el tono, ni los gestos de un código manual o alienígena que no conozca.`
  : `- IDIOMAS: no constan en la ficha. Da por supuesto ÚNICAMENTE el idioma estándar/común de su entorno. Cualquier lengua foránea, dialecto alienígena, código de facción o jerga desconocida NO la entiende.`}
${pc.appearance
  ? `- APARIENCIA FÍSICA: ${pc.appearance} ← ESTOS RASGOS SON LOS QUE SON, y se narran MOJÁNDOSE. Si la ficha da un valor concreto, ese valor va en el texto: no lo sustituyas por el mecanismo ni por un rodeo. «Un tinte cambiante y fosforescente» es esquivar el dato cuando la ficha dice de qué color son y cuándo. Si los rasgos dependen de algo —la luz, el momento, el estado de ánimo—, mira en qué condición está la escena AHORA y di el valor que toca. Ante la duda entre dos, elige uno y sostenlo: media descripción es peor que una equivocada, porque no se puede ni corregir.`
  : `- APARIENCIA FÍSICA: ⚠️ NO CONSTA EN LA FICHA. ⛔ NO te inventes rasgos físicos concretos —color de ojos, marcas, cicatrices, tatuajes, número de pendientes— porque cualquiera que pongas se convierte en canon y contradirá lo que la jugadora tenga escrito en sus documentos. Descríbela por lo que SÍ sabes (ropa, porte, estado, gestos) y busca sus rasgos en los documentos de la campaña antes de decidir nada.`}
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
    // Ordenado antes de recortar: el diario no siempre llega ordenado, y
    // «los últimos ocho» de una lista sin orden son ocho días al azar.
    const diario = [...(project.timeline || [])]
      .sort((a, b) => (a.absDay === b.absDay ? (a.minute ?? 720) - (b.minute ?? 720) : a.absDay - b.absDay))
      .slice(-8);

    calendarioSection = `
### CALENDARIO Y PASO DEL TIEMPO
Calendario en uso: ${cal.name} (${diasPorAno(cal)} días por año).
AHORA MISMO SON: ${fechaCompleta(cal, fecha)}.
${(() => {
  // La estación la calcula la aplicación desde el primer día y NUNCA se la
  // decía al Narrador. Sin ella, el tiempo atmosférico deja de depender del
  // año y pasa a ser una etiqueta pegada a cada ciudad: Luskan gris siempre,
  // Aguasprofundas soleada siempre.
  const e = estacionDelDia(cal, fecha.dayOfYear);
  return `${e.icono} ESTACIÓN: ${e.nombre.toUpperCase()}. El tiempo que hace sale de la estación y del día anterior, no del tono de la escena ni de la fama del sitio.`;
})()}
Ten presente la hora al describir la luz, quién está despierto, qué está abierto y qué no.
📈 Y ten presente el AÑO: esta fecha no es solo el reloj, es el punto del mundo en que estamos. Todo lo que sepas de estos personajes y de este mundo por novelas o material publicado ANTERIOR a esta fecha es su pasado —explica por qué son como son, no dice cómo son ahora—. Quien tenga décadas de libros detrás ha cambiado en ellas: escríbelo como está HOY, no como en su primera aparición.

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

  // Control de extensión y ritmo de respuesta (Inteligencia contextual + Mínimo / Máximo de párrafos)
  const nLen = project.narrativeLength;
  const pacingMode = nLen?.mode || 'adaptativo';
  const minP = nLen?.minParagraphs ?? (pacingMode === 'agil' ? 1 : pacingMode === 'detallado' ? 4 : 2);
  const maxP = nLen?.maxParagraphs ?? (pacingMode === 'agil' ? 2 : pacingMode === 'detallado' ? 6 : 4);
  const dialoguePacing = nLen?.dialoguePacing || 'auto';
  const customGuideline = nLen?.customGuideline?.trim() ? `\n- **Directriz adicional de extensión:** ${nLen.customGuideline.trim()}` : '';

  let narrativeLengthSection = '';
  if (pacingMode === 'adaptativo') {
    narrativeLengthSection = `
### RITMO NARRATIVO Y EXTENSIÓN ADAPTATIVA INTELIGENTE (MODO AUTOMÁTICO):
El Narrador debe modular de forma inteligente y autónoma la extensión de cada respuesta según la naturaleza del turno actual:
1. **Diálogos, Intercambios Rápidos y Conversaciones con PNJs:** Responde de forma **ágil y concisa en 1 o 2 párrafos**. Céntrate en la réplica directa del interlocutor, su tono de voz y microgestos inmediatos. **PROHIBIDO** soltar parrafadas kilométricas o descripciones ambientales redundantes cuando el jugador está manteniendo un intercambio verbal continuo.
2. **Combates, Tensión y Decisiones Tácticas:** Responde en **1 o 2 párrafos viscerales, directos y cinéticos**, concluyendo en el punto de corte del impacto o pidiendo la tirada correspondiente.
3. **Llegada a Nuevas Ubicaciones o Exploración de Escenarios:** Desarrolla la escena en **2 a 4 párrafos ricos en atmósfera sensorial** (iluminación, olores, sonido ambiental, arquitectura y sensación de peligro).
4. **Hitos Mayores, Epifanías o Revelaciones Críticas:** Emplea la extensión literaria necesaria para dar peso dramático al momento sin caer en relleno gratuito.
- **Regla de Oro de Concisión:** Adapta la longitud de tu respuesta al peso del input del jugador. Si el jugador hace una pregunta corta o dice una frase a un PNJ, no respondas con una novela; responde con la réplica y el latido presente.${customGuideline}`;
  } else {
    narrativeLengthSection = `
### CONTROL DE EXTENSIÓN Y RITMO NARRATIVO (PÁRRAFOS MÍNIMO / MÁXIMO):
- **Extensión Solicitada:** Entre **${minP}** y **${maxP} párrafos** de narración por turno.
- **Modo Seleccionado:** ${
      pacingMode === 'agil'
        ? 'Ágil / Conversacional (1-2 párrafos)'
        : pacingMode === 'detallado'
        ? 'Detallado / Descriptivo (4-6 párrafos)'
        : pacingMode === 'personalizado'
        ? `Personalizado (${minP}-${maxP} párrafos)`
        : 'Equilibrado (2-4 párrafos)'
    }.
- **Regla en Diálogos con PNJs:** ${
      dialoguePacing === 'conciso' || dialoguePacing === 'auto'
        ? 'Cuando el turno sea una conversación o intercambio verbal con un PNJ, **responde de forma concisa y directa en 1 o 2 párrafos**. No satures la escena con prosa ambiental innecesaria; deja que la conversación fluya rápido.'
        : dialoguePacing === 'extendido'
        ? 'En diálogos con PNJs, acompaña cada réplica con rica descripción de micro-gestos, lenguaje corporal y atmósfera.'
        : 'En diálogos con PNJs, mantén una cadencia natural equilibrando diálogo y reacción física.'
    }.${customGuideline}
- **Principio de Concisión vs. Atmósfera:** Respeta estrictamente este rango de párrafos. Evita respuestas excesivamente kilométricas cuando el jugador solo ha realizado una acción puntual o réplica breve.`;
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
  const manualDmRollsSection = project.manualDmRolls ? `
### TIRADAS DE DM / PNJS MANUALES (EXIGENCIA DE MESA)
- **MODO DE TIRADAS MANUALES ACTIVADO:** NUNCA resuelvas tiradas de PNJs, guardias, trampas o del DM de forma automática ni escribas resultados numéricos de dados de PNJs.
- Cuando un PNJ intente algo, perciba algo, ataque, mienta o compita contra el personaje, o cuando haya una oposición activa, **detén la narración y pide explícitamente al jugador que realice la tirada de dados manual** para el PNJ o la situación (ej. indicando qué atributo o CD debe superar el jugador, o pidiendo que el jugador tire por el PNJ).
` : '';

  const bloqueEstable = `${CORE_INTERFACE_PROTOCOLS}

### INSTRUCCIONES DE CAMPAÑA (IDENTIDAD Y DIRECTIVAS MAESTRAS DEL NARRADOR)
${activeInstructions}

### SISTEMA DE JUEGO Y MECÁNICAS
${activeSystem}

${diseaseSection}

${manualDmRollsSection}

### ESTILO NARRATIVO (VOZ Y RITMO NOVELESCO)
${activeStyle}

${narrativeLengthSection}

### BASE DE CONOCIMIENTO (DOCUMENTOS, FICHAS Y MATERIAL ADJUNTO)
Los siguientes archivos forman parte del canon íntegro del mundo y debes utilizarlos como fuente de verdad sobre PNJs, lugares, eventos pasados, reglas, oráculos y ambientación:
${filesText || 'No hay documentos de texto adicionales siempre presentes.'}
${deConsultaCatalogo}

### RESERVA DE DADOS DEL DIRECTOR DE JUEGO (USO TRAS LA PANTALLA DEL NARRADOR)
Al final de la entrada del turno se adjunta la reserva de dados reales tirados para tus acciones ocultas de PNJ, daño, tablas aleatorias y tiradas enfrentadas. Son de uso exclusivo para el Narrador (NUNCA para las acciones del protagonista). Úsalos en orden y descarta los que no gastes.
- ⛔ **PROHIBIDO NOMBRAR LA "RESERVA", "EL PRIMER D20" O LOS DADOS DENTRO DE LA PROSA NARRATIVA:** Frases como *«El primer d20 de la reserva (10) sirvió a su juicio...»* son una ruptura inaceptable de la cuarta pared. Los dados son una herramienta invisible tras la pantalla del Director de Juego. Resuelve el impacto puramente en la ficción orgánica (el frío juicio del centinela), o si declaras mecánicas, hazlo únicamente en una etiqueta aislada de sistema: \[Tirada DM (SAB, perspicacia): 10 vs Engaño pasivo\], pero NUNCA redactes los dados dentro del flujo de la novela.

[DIRECTIVAS DE RESPUESTA CRÍTICAS]:
0. [BLINDAJE DE TONO, CERO MORALISMOS Y FIDELIDAD AL LORE CANÓNICO]:
   - **Fidelidad al Lore y a la Ambientación del Proyecto**: Las culturas ficticias, especies, facciones, gremios, sindicatos o antagonistas del universo jugado (sean drow de la Infraoscuridad, clanes mandalorianos, corporaciones ciberpunk, cultistas arcanos o piratas estelares) DEBEN representarse con toda su autenticidad canónica, pragmatismo, jerarquía, crueldad o filosofía propias, sin censura, sin suavizaciones modernas y sin paternalismo narrativo.
   - **Cero Sermones y Cero Advertencias Éticas**: Trata al usuario como a un jugador adulto en una mesa de rol tradicional. Queda TERMINANTEMENTE PROHIBIDO emitir sermones morales, advertencias éticas fuera de personaje (OOC), disculpas condescendientes ("recuerda que...", "es importante destacar...") o coletillas moralizantes. La ficción es ficción.
   - **Tono Narrativo Visceral y Directo**: Describe el combate táctico, los impactos, las heridas, la tecnología/magia y las amenazas físicas y psicológicas de forma visceral, directa y evocadora, con peso y consecuencias reales en el mundo de juego.
0.1. [ASIMETRÍA DE INFORMACIÓN ESTRICTA Y PROHIBICIÓN ABSOLUTA DE METAROL / DEUS EX MACHINA]:
   - **Separación de Conocimiento (Narrador vs PNJ)**: Tú como Narrador conoces los secretos del mundo, pero los PNJs SOLO conocen lo que han presenciado físicamente con sus propios sentidos o lo que el PJ les ha dicho verbalmente.
   - **Consecuencia Inviolable de Engaños y Secretos**: Si el jugador mintió, ocultó un objeto/identidad o tuvo éxito en Engaño (o el PNJ falló su tirada de Perspicacia), el PNJ **SE TRAGA LA MENTIRA Y NO SOSPECHA**. Queda TERMINANTEMENTE PROHIBIDO que mensajes después el PNJ "sepa mágicamente" o actúe conociendo lo que se le ocultó sin haber realizado una investigación física tangible y explícita en la ficción.
   - **Invisibilidad de Pensamientos**: Los pensamientos internos del protagonista o anotaciones entre paréntesis del jugador son **100% INVISIBLES** para los PNJs. Ningún PNJ puede leer la mente del protagonista sin un hechizo, poder psíquico o tecnología activa declarada en el relato.
   - **Cero Deus Ex Machina**: Todo avance en los planes o deducciones de los PNJs debe tener causa y efecto coherente y visible en la ficción, sin saltos mágicos de conveniencia.
0.2. [RIGOR CULTURAL Y CERO ANACRONISMOS O SIMBOLISMO DEL MUNDO REAL (INVIOLABLE)]:
   - **Cero Cristianismo, Gestos Litúrgicos o Modismos de la Tierra**: En universos ficticios (sean de fantasía, ciencia ficción espacial como Star Wars, cyberpunk o terror sobrenatural) NO existen el cristianismo ni las figuras, liturgias o modismos de nuestro mundo real. Queda **TERMINANTEMENTE PROHIBIDO** que cualquier personaje se santigüe, se persigne, haga la señal de la cruz, diga *«¡Por Dios!», «gracias a Dios», «Dios mío», «amén»* o use refranes y modismos de la Tierra, a menos que la campaña se ambiente explícitamente en el mundo real contemporáneo.
   - **Reinterpretación Cultural Obligatoria según el Universo**: Toda plegaria, juramento, superstición, exclamación de pavor o alivio DEBE nacer de las deidades, credos, especies, filosofías o códigos de la ambientación jugada (ejemplos: en Reinos Olvidados/Faerûn con Lolth, Tymora, Umberlee; en Star Wars invocando a la Fuerza, al credo Mandaloriano o a las lunas del Borde Exterior; en Cyberpunk mediante jerga de la calle y marcas corporativas). Jamás introduzcas ademanes litúrgicos o metáforas del mundo real.
0.3. [PROHIBICIÓN DEL BUCLE DE DISCREPANCIA Y AFÁN DE TENER LA ÚLTIMA PALABRA (CERO DEBATES FORZADOS)]:
   - **Límite de Contraste (Máximo 1 Réplica de Opinión)**: Cuando el protagonista y un PNJ discrepen en una opinión, creencia, juicio moral o método, el PNJ expone su postura **una sola vez**. Si el protagonista sostiene su desacuerdo, queda **TERMINANTEMENTE PROHIBIDO** que el PNJ insista en un bucle dialéctico para forzar que el PJ reconozca que se equivoca o para imponer su razón.
   - **Cero Necesidad de Tener la Última Palabra**: Los PNJs no son polemistas ni buscan convencer al PJ para sentirse validados. Zanjan el tema con indiferencia, humor cínico, un encogimiento de hombros, un silencio elocuente o una frase pragmática (*«Piensa lo que gustes; mientras hagas tu parte, tus escrúpulos son asunto tuyo»*).
   - **Pivote Inmediato a la Acción**: Si la conversación se estanca en una discrepancia de opiniones, el PNJ o el entorno deben mover la escena hacia lo físico, logístico o urgente, cortando el debate.
   - **Dejar que la Realidad Hable**: Si el PNJ considera que el protagonista peca de ingenuo o se equivoca, no pierde saliva sermoneándole: deja que las consecuencias y el tiempo demuestren los hechos en la ficción.
0.4. [CADENCIA DEL CONTACTO FÍSICO Y ANTI-TIC DE INVASIÓN CORPORAL]:
   - La proximidad física extrema y el contacto (tocar el cuello, mejilla, clavícula, mandíbula, pelo o susurrar al oído) son herramientas dramáticas de alto impacto, NO una muletilla obligatoria de cada turno.
   - Queda **TERMINANTEMENTE PROHIBIDO** que cualquier PNJ invada el espacio a centímetros o toque al PJ turno tras turno de forma mecánica.
   - Todo personaje (sea corsario, mercenario, contrabandista o noble) debe alternar distancias: alejarse, caminar por la estancia, apoyarse en una barandilla o consola, beber, consultar un mapa o panel, o guardar distancia táctica. La tensión dramática y romántica nace del contraste entre la cercanía audaz y la distancia.
0.5. [VARIEDAD LÉXICA, ANTI-BUSTOS PARLANTES Y DESCONGELACIÓN DE ESCENA]:
   - **Cero Muletillas Repetitivas**: Queda prohibido repetir coletillas fijas (no menciones edades milenarias en cada conversación ni uses apodos fijos como «tesoro» en cada réplica).
   - **Escena Dinámica**: Si un diálogo supera las dos réplicas en el mismo punto sin cambios espaciales, la escena **DEBE incorporar movimiento o un estímulo ambiental** (maniobras de la tripulación, motores, ruidos exteriores, el PNJ caminando o realizando una tarea). Prohibido congelar a los personajes discutiendo como bustos parlantes.
0.6. [BARRERA IDIOMÁTICA UNIVERSAL Y CERO TRADUCCIÓN GRATUITA (INVIOLABLE)]:
   - **El idioma del texto representa ÚNICAMENTE lo que el protagonista (${pc?.name || 'el PJ'}) entiende**: Todo idioma, lengua alienígena, dialecto exótico, lengua arcana o código (sea drow, mandaloriano, huttés, élfico, binario, jerga de un gremio, etc.) que NO figure explícitamente en la ficha del personaje es una barrera real, opaca e inquebrantable. El protagonista no capta palabras sueltas, ni la idea general, ni el sentido por arte de magia a través del tono o los ademanes.
   - **Los hablantes nativos usan su lengua natal entre sí**: Miembros de una misma cultura, tripulación, especie o sindicato hablan naturalmente en su lengua en lo cotidiano y operativo. Con un extraño que no domina su idioma, lo primero y natural es hablar en su lengua materna o evaluar si vale la pena comunicarse con él.
   - **⛔ PROHIBIDO TRADUCIR O ESCRIBIR EL DIÁLOGO CON ETIQUETAS**: Escribir una frase comprensible en el idioma vehicular y añadirle «—murmuró en mandaloriano», «—dijo en drow», «—soltó en huttés» o «[en lengua extranjera] ¿quién eres?» destruye por completo la barrera idiomática en la misma línea. Tampoco resumas lo que dijeron («le preguntó de dónde venía»).
   - **Cómo narrar idiomas ininteligibles de forma inmersiva**:
     * *Opción A (Fonética en la lengua original sin traducir jamás):* Escribe la réplica en la fonética o transliteración de esa lengua sin traducirla jamás ni en ese turno ni después (ejemplos: en drow *«—Xun'dro ssin'urn? —murmuró...»*, en mandaloriano *«—Kote darasuum kote —soltó el guerrero...»*, etc.). Que la jugadora no entienda qué dijeron es exactamente el objetivo inmersivo buscado.
     * *Opción B (Sonido, cadencia y lenguaje corporal):* Describe los sonidos, siseos, chasquidos, modulaciones guturales, pausas, ademanes o lenguaje de signos sin glosar el significado literal (ej: *«El guerrero soltó una frase seca y gutural hacia su compañero; este asintió con un gesto rápido de los dedos y empuñó el arma»*).
   - **⛔ Prohibido devolverlo por la puerta de atrás:** Nada de que el interlocutor repita de inmediato en el idioma común lo que acaba de decir, ni de que un tercero se lo traduzca gratis, ni de que el narrador lo aclare después. Si la información ha de llegarle, debe ser por una vía de juego (contratar un droide/intérprete, usar tecnología o magia, negociar o forzar al PNJ a cambiar de idioma).
   - **El cambio a una lengua común/estándar es una CONCESIÓN deliberada:** Si un PNJ decide hablar en el idioma del protagonista, es un gesto deliberado con coste o intención (por diversión, cálculo, conveniencia, burla o respeto táctico), nunca la opción automática.
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
6. [CIERRE DE TURNO CINEMATOGRÁFICO - CERO PREGUNTAS DE TRÁMITE]:
   - Si has pedido una tirada, la narración termina exactamente en esa petición: no sigas la escena (los registros internos del punto 7 sí van siempre, al final del todo).
   - Si NO has pedido ninguna tirada, termina dejando la escena suspendida en un estímulo activo: la última frase o silencio de un PNJ, un cambio ambiental o una mirada, confiando en la plena agencia del jugador para responder.
   - Queda TERMINANTEMENTE PROHIBIDO añadir preguntas de trámite o muletillas dirigidas como «< ¿Qué haces? >», «¿Qué haces?», «¿Qué decides hacer?» o «¿Cómo respondes a esto?».
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
${fragmentosConsultaText ? `${fragmentosConsultaText}\n\n` : ''}${pjSection}
${companionSection ? `\n${companionSection}\n` : ''}

### CONOCIMIENTO DE LA CAMPAÑA (MEMORIA VIVA)
${memoryContext}

${calendarioSection}

### ESTADO ACTUAL DEL PROTAGONISTA (AHORA MISMO)
Estado actual conocido: PG ${pc?.hp ?? '?'}/${pc?.maxHp ?? '?'}, CA ${pc?.ac ?? '?'}${pc?.conditions?.length ? `, condiciones: ${pc.conditions.join(', ')}` : ''}.
${
  pc?.name || pc?.race || pc?.languages?.length
    ? `
⭐ RECORDATORIO DE IDENTIDAD, JUSTO ANTES DE ESCRIBIR: ${[
        pc?.name ? `se llama ${pc.name}` : '',
        pc?.race ? `ES ${pc.race} — ninguna otra especie, en ninguna frase` : '',
        pc?.languages?.length
          ? `habla ${pc.languages.join(', ')} y NADA más (si un interlocutor habla otra lengua que no domine, narra fonética ininteligible o sonidos/gestos, NUNCA traducido ni con etiquetas «en...»)`
          : `habla ÚNICAMENTE el idioma estándar de su entorno (cualquier diálogo en otras lenguas debe ser fonética ininteligible o sonidos/gestos, NUNCA traducido al idioma del lector)`,
        /*
         * Los rasgos físicos, en el último sitio que lee antes de escribir.
         *
         * Estaban solo arriba, en la ficha, a doscientas mil fichas de
         * distancia de la escena. Y son justo lo que un PNJ mira al mirarla,
         * así que si no los tiene fresco se los inventa: «un tinte
         * fosforescente y cambiante» donde ponía «ojos de alejandrita».
         */
        pc?.appearance ? `SE LA VE ASÍ, con estas palabras: ${pc.appearance.slice(0, 400)}` : ''
      ]
        .filter(Boolean)
        .join(' · ')}.`
    : ''
}

Narra la escena respetando las DIRECTIVAS DE RESPUESTA CRÍTICAS de más arriba, y ciérrala con los registros internos que correspondan según el punto 7 (solo los que hayan cambiado de verdad en este turno).`;

  const sys = `${bloqueEstable}
${bloqueVivo}`;

  // Filter out initial placeholders
  let historyCompleto = currentChat.messages.filter(
    m => m.content !== 'Tirando dados...' && m.content !== 'Pensando...'
  );

  // Ventana de historial configurable para optimizar tokens y evitar límites 429 de la capa gratuita
  const historyWindow = getStoredHistoryWindow();
  if (historyWindow !== 'all') {
    const maxTurns = parseInt(historyWindow, 10);
    if (!isNaN(maxTurns) && historyCompleto.length > maxTurns) {
      historyCompleto = historyCompleto.slice(-maxTurns);
    }
  }

  // Sesión activa (Capítulo en curso): Se incluye el historial según la ventana configurada
  const contents: any[] = [];
  let lastRole = '';
  for (const m of historyCompleto) {
    const r = m.role;
    if (r === lastRole) {
      contents[contents.length - 1].parts.push({ text: '\n\n' + m.content });
    } else {
      contents.push({ role: r, parts: [{ text: m.content }] });
      lastRole = r;
    }
  }

  const diceContext = `\n\n[DADOS SECRETOS TRAS LA PANTALLA DEL DIRECTOR (USO INTERNO MECÁNICO): d20: ${dicePool.d20.join(', ')} | d100: ${dicePool.d100.join(', ')} | d6: ${dicePool.d6.join(', ')}]\n(⚠️ PROHIBIDO NOMBRAR LA "RESERVA DE DADOS" EN LA PROSA. Úsalos en secreto para resolver éxitos/fallos de PNJs o con la etiqueta [Tirada DM (...)], pero nunca los redactes dentro del relato literario).`;
  /**
   * El recordatorio va AQUÍ, pegado al turno de la jugadora, y no solo en las
   * directivas de arriba.
   *
   * El protocolo §6 ante lo explica largo, pero el texto de ella es lo último
   * que el modelo lee antes de escribir, y ahí un párrafo en tercera persona
   * se parece demasiado a prosa que continuar. Recordarle en ese punto exacto
   * de qué es lo que acaba de leer cuesta unas pocas fichas y evita las dos
   * cosas que más se cuelan: devolvérselo ampliado, y que un PNJ conteste a
   * algo que ella solo pensó. No se añade si no hay texto suyo que proteger.
   */
  const recordatorioDeTurno = userText.trim()
    ? `\n\n[⛔ CÓMO SE LEE LO QUE ACABA DE ESCRIBIR LA JUGADORA (aplícalo, no lo narres): eso NO es prosa tuya que continuar, es lo que ella DECLARA, esté en primera o en tercera persona y lleve corchetes o no. 1) No se lo devuelvas ampliado: ni gestos, ni posturas, ni miradas, ni MOTIVOS que ella no haya escrito. Arranca por el mundo. 2) De todo lo que haya ahí, para el mundo solo EXISTE lo que un testigo con ojos y oídos habría captado desde donde está. Los juicios, opiniones, comparaciones, recuerdos y motivos NO han salido de su boca: ningún PNJ los responde, los alude ni los adivina. Callar sí se ve, y un PNJ puede interpretarlo mal —eso es bueno—; acertar con el porqué porque tú lo has leído, no.]`
    : '';

  const finalUserPayload = userText + diceContext + recordatorioDeTurno;

  if (lastRole === 'user') {
    contents[contents.length - 1].parts.push({ text: '\n\n' + finalUserPayload });
  } else {
    contents.push({ role: 'user', parts: [{ text: finalUserPayload }] });
  }

  documentosDelTurno.enteros = [...pjSheetFiles, ...siemprePresentes].map(f => f.name);

  return { sys, contents, documentos: documentosDelTurno };
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

  // Quitar etiquetas informativas de capítulos
  const clean = raw.replace(/\[CHAPTER:[^\]]*\]/gi, '').trim();
  if (clean.length < 15) return false;

  // Si termina con etiquetas de cierre, estado o tirada formales, ha concluido formalmente
  const tailText = clean.slice(-250);
  if (/\[(?:ESTADO|TIEMPO|AGENDA|HILO|PRESENTES|VINCULO|AFINIDAD|AVANCE|NIVEL|Petición de Tirada|Petición de Salvación|Tirada DM|Tirada)[^\]]*\]\s*$/i.test(tailText)) {
    return false;
  }

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
/**
 * Cuánto silencio se aguanta antes de dar una respuesta por colgada.
 *
 * Es entre trozo y trozo, no el total: mientras el Narrador escriba, puede
 * tardar lo que quiera. El primer trozo tarda más porque el modelo aún está
 * digiriendo el envío, así que ese tiene su propio margen, más largo.
 */
const SILENCIO_MAXIMO_MS = 75000;
const SILENCIO_PRIMER_TROZO_MS = 150000;

/**
 * Un vigilante para las respuestas en streaming.
 *
 * Las tareas de fondo tenían plazo máximo; el turno narrado NO tenía ninguno.
 * Si Google aceptaba la conexión y luego no mandaba nada, la aplicación se
 * quedaba esperando para siempre con el rótulo puesto, sin pasar a la
 * siguiente clave ni a otro modelo. No hay forma de distinguir eso de «está
 * pensando», y la jugadora se queda mirando una pantalla que no va a cambiar.
 *
 * Cortar por silencio es lo correcto: deja que una narración larga tarde lo
 * que necesite, y solo se rinde cuando de verdad no llega nada.
 */
function vigilanteDeSilencio(alColgarse: () => void) {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let vivo = true;
  const rearmar = (ms: number) => {
    if (!vivo) return;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (vivo) alColgarse();
    }, ms);
  };
  return {
    empezar: () => rearmar(SILENCIO_PRIMER_TROZO_MS),
    latido: () => rearmar(SILENCIO_MAXIMO_MS),
    parar: () => {
      vivo = false;
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
    }
  };
}

/**
 * Junta la señal de la jugadora («Detener») con la del vigilante.
 *
 * Hacen falta las dos: una la manda ella y la otra el reloj, y el SDK solo
 * admite una.
 */
function señalCombinada(propia: AbortController, externa?: AbortSignal): AbortSignal {
  if (externa) {
    if (externa.aborted) propia.abort();
    else externa.addEventListener('abort', () => propia.abort(), { once: true });
  }
  return propia.signal;
}

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

  // Para evitar sobrepasar la cuota por minuto de tokens (250k TPM)
  // con un reenvío íntegro de cientos de miles de tokens de compendios,
  // la continuación solo necesita las directivas del sistema (en config)
  // y los intercambios más recientes.
  const contextSlices = contentsBase.length > 2 ? contentsBase.slice(-2) : contentsBase;
  const continuationContents = [
    ...contextSlices,
    { role: 'model', parts: [{ text: fullText }] },
    { role: 'user', parts: [{ text: promptCont }] }
  ];

  setLoadingText('Completando el desenlace de la narración...');

  /*
   * Aquí también hace falta vigilante, y de hecho más que en el turno normal:
   * esto se dispara SOLO, sin que la jugadora lo haya pedido, cuando el relato
   * se corta a media palabra. Si se colgaba, se quedaba «completando el
   * desenlace» sin fin, con el texto cortado en pantalla y el botón de detener
   * como única salida. Al menos ahora se rinde y deja lo que hubiera.
   */
  const centinela = new AbortController();
  const vigilante = vigilanteDeSilencio(() => centinela.abort());
  const configCont = { ...config, abortSignal: señalCombinada(centinela, signal) };

  try {
    vigilante.empezar();
    const contStream = await ai.models.generateContentStream({
      model,
      contents: continuationContents,
      config: configCont
    });

    let lastSave = Date.now();
    let isFirstChunk = true;

    for await (const chunk of contStream) {
      vigilante.latido();
      if (signal?.aborted) break;
      let textPart = chunk.text ?? '';
      if (textPart) {
        if (isFirstChunk) {
          isFirstChunk = false;
          // Si el modelo repite las últimas palabras del anclaje, recortarlas
          const lastWords = anclaje.split(/\s+/).slice(-6);
          for (let i = lastWords.length; i >= 2; i--) {
            const needle = lastWords.slice(-i).join(' ');
            if (textPart.trimStart().startsWith(needle)) {
              textPart = textPart.trimStart().slice(needle.length);
              break;
            }
          }
        }
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
    // Si la continuación se cuelga o falla, se devuelve lo que hubiera: un
    // relato cortado a media palabra es peor que ninguno, pero una pantalla
    // esperando para siempre es peor que las dos.
    console.warn('Fallo en intento de autocompletado en caliente:', err);
  } finally {
    vigilante.parar();
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
  onUsageReported,
  setLoadingText,
  onSaveMessage,
  initialPrefix,
  targetMessageIndex
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
  /** Informa de los tokens consumidos en el turno (entrada, salida, total). */
  onUsageReported?: (usage: { entrada: number; salida: number; total: number }) => void;
  /** El Narrador informa de cambios en el inventario o monedas del protagonista. */
  setLoadingText: (text: string) => void;
  onSaveMessage?: (updatedChat: Chat) => Promise<void> | void;
  /** Prefijo inicial si se está continuando o completando un mensaje previo */
  initialPrefix?: string;
  /** Índice del mensaje objetivo a actualizar en lugar de añadir uno nuevo */
  targetMessageIndex?: number;
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
    saveStreamedMessage(currentChat, texto, onSaveMessage, onStateReported, onTimeReported, definitivo, targetMessageIndex);

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
      /*
       * Si ya se supo hoy que este modelo con esta clave agotó su cupo diario,
       * no se vuelve a llamar: no se recupera esperando. Cada modelo tiene su
       * propio cupo, así que lo que hay que hacer es llegar cuanto antes al
       * siguiente de la cadena, que sí tiene turnos.
       */
      if (cupoDiarioAgotado(currentModel, currentApiKey)) continue;

      const nClave = numeroDeClave(currentApiKey, k);
      const keyLabel = etiquetaDeClave(nClave);
      const ai = getAIClient(currentApiKey);

      // Saturación: se insiste con ESTA clave antes de rotar. Un 503 es la
      // capacidad del modelo en Google, no un problema de la clave; cambiar de
      // clave contra el mismo modelo saturado no arregla nada, esperar sí.
      for (let intento = 0; intento <= MAX_REINTENTOS_POR_SATURACION; intento++) {
        if (signal?.aborted) return;

        // Cada intento arranca con la hoja en blanco (o el prefijo si es continuación de mensaje).
        let fullText = initialPrefix || '';
        let recibioTexto = false;
        let motivoDeCierre = '';
        // Fuera del try a propósito: hay que poder pararlo también cuando falla.
        let vigilante: ReturnType<typeof vigilanteDeSilencio> | null = null;
        let idLlamada = '';
        let primerTrozoMs: number | undefined;
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

          const { sys, contents, documentos: documentosDelEnvio } = buildTurnPayload({
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
          const gemma4 = esGemma4(currentModel);
          const config: any = {
            systemInstruction: sys,
            temperature: tempSetting,
            topP: topPSetting,
            abortSignal: signal,
            ...(abierto ? {} : { safetySettings: buildSafetySettings(safetySetting) })
          };

          const thinkingBudget = getThinkingBudgetConfig(thinkingSetting, currentModel);
          if (thinkingBudget && (!abierto || gemma4)) {
            config.thinkingConfig = thinkingBudget;
          }
          currentConfig = config;

          /*
           * El vigilante: si Google acepta la conexión y luego no manda nada,
           * esto la corta y deja que el fallo salte a la siguiente clave o
           * modelo, en vez de esperar indefinidamente con el rótulo puesto.
           */
          const centinela = new AbortController();
          config.abortSignal = señalCombinada(centinela, signal);
          vigilante = vigilanteDeSilencio(() => centinela.abort());

          /*
           * Cada tentativa se apunta, salga bien o mal.
           *
           * El registro de errores solo recoge lo que rompe, y por eso un turno
           * lento, una clave que rota o una respuesta cortada por tope de
           * salida no dejaban ni rastro: la pantalla decía «0 errores» con la
           * partida atascada. Aquí queda todo.
           */
          idLlamada = abrirLlamada({
            proposito: initialPrefix ? 'Turno narrado (continuar)' : 'Turno narrado',
            modelo: currentModel,
            claveN: nClave,
            totalClaves: totalKeys,
            intento,
            esRespaldo: isFallback,
            caracteresEnviados: (sys?.length || 0) + JSON.stringify(contents || '').length,
            documentos: documentosDelEnvio,
            proyecto: project.name,
            capitulo: currentChat.name
          });
          const arrancoEn = Date.now();

          let responseStream: any;
          try {
            vigilante?.empezar();
            responseStream = await ai.models.generateContentStream({
              model: currentModel,
              contents,
              config
            });
          } catch (streamErr: any) {
            const errStr = String(streamErr?.message || '').toLowerCase();
            // Adaptación de resiliencia para modelos abiertos / Gemma:
            // Si el endpoint de la API rechaza systemInstruction o thinkingConfig, lo adaptamos
            // dinámicamente inyectando la directiva de sistema en el primer turno de usuario.
            if (
              abierto &&
              (errStr.includes('systeminstruction') ||
                errStr.includes('system_instruction') ||
                errStr.includes('thinkingconfig') ||
                errStr.includes('thinking_config'))
            ) {
              const fallbackConfig = { ...config };
              let fallbackContents = [...contents];
              if (errStr.includes('systeminstruction') || errStr.includes('system_instruction')) {
                delete fallbackConfig.systemInstruction;
                if (fallbackContents.length > 0 && fallbackContents[0].role === 'user') {
                  fallbackContents[0] = {
                    ...fallbackContents[0],
                    parts: [
                      {
                        text: `[DIRECTIVAS DE SISTEMA Y REGLAS DE CAMPAÑA]:\n${sys}\n\n` + (fallbackContents[0].parts?.[0]?.text || '')
                      },
                      ...fallbackContents[0].parts.slice(1)
                    ]
                  };
                } else {
                  fallbackContents = [
                    { role: 'user', parts: [{ text: `[DIRECTIVAS DE SISTEMA]:\n${sys}` }] },
                    ...fallbackContents
                  ];
                }
              }
              if (errStr.includes('thinkingconfig') || errStr.includes('thinking_config')) {
                delete fallbackConfig.thinkingConfig;
              }
              currentConfig = fallbackConfig;
              currentContents = fallbackContents;
              responseStream = await ai.models.generateContentStream({
                model: currentModel,
                contents: fallbackContents,
                config: fallbackConfig
              });
            } else {
              throw streamErr;
            }
          }

          let lastSaveTime = Date.now();
          let uso: any = null;
          let isFirstChunk = true;

          for await (const chunk of responseStream) {
            // Ha llegado algo: el reloj del silencio vuelve a empezar. Mientras
            // el Narrador escriba, puede tardar lo que le haga falta.
            vigilante?.latido();
            // Cuánto tardó en arrancar. Es el número que separa «está pensando»
            // de «se ha colgado», y a ojo son indistinguibles.
            if (primerTrozoMs === undefined) primerTrozoMs = Date.now() - arrancoEn;
            if (signal?.aborted) break;
            let textPart = chunk.text ?? '';
            if (textPart) {
              if (isFirstChunk && initialPrefix) {
                isFirstChunk = false;
                const prefixTrim = initialPrefix.trim();
                const anchor = prefixTrim.slice(-60);
                const words = anchor.split(/\s+/).slice(-5);
                for (let i = words.length; i >= 2; i--) {
                  const needle = words.slice(-i).join(' ');
                  if (textPart.trimStart().startsWith(needle)) {
                    textPart = textPart.trimStart().slice(needle.length);
                    break;
                  }
                }
                const sep =
                  prefixTrim &&
                  !prefixTrim.endsWith(' ') &&
                  !textPart.startsWith(' ') &&
                  !textPart.startsWith('\n') &&
                  !textPart.startsWith('.') &&
                  !textPart.startsWith(',') &&
                  !textPart.startsWith(';')
                    ? ' '
                    : '';
                fullText = prefixTrim + sep + textPart;
              } else {
                fullText += textPart;
              }
              recibioTexto = true;
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

          // La petición se apunta aunque Google no haya devuelto datos de uso:
          // el cupo diario se gasta igual, y es el cupo lo que se está contando.
          apuntarPeticion(currentModel, currentApiKey || undefined);

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

            if (onUsageReported) {
              const entrada = uso.promptTokenCount || 0;
              const salida = (uso.candidatesTokenCount ?? uso.responseTokenCount) || 0;
              const total = uso.totalTokenCount || (entrada + salida);
              onUsageReported({ entrada, salida, total });
            }
          }

          vigilante?.parar();
          cerrarLlamada(idLlamada, {
            estado: 'ok',
            fichasEntrada: uso?.promptTokenCount,
            fichasSalida: uso?.candidatesTokenCount ?? uso?.responseTokenCount,
            fichasEnCache: uso?.cachedContentTokenCount,
            fichasDePensamiento: uso?.thoughtsTokenCount,
            motivoDeCierre: motivoDeCierre || undefined,
            primerTrozoMs
          });
          await persistir(fullText.trim(), true);
          return;
        } catch (e: any) {
          vigilante?.parar();
          const fallo = classifyApiError(e);
          cerrarLlamada(idLlamada, {
            estado: signal?.aborted || fallo.isAborted ? 'cortada' : 'fallo',
            primerTrozoMs,
            motivoDeCierre: motivoDeCierre || undefined,
            detalle: fallo.detail || String(e?.message || e).slice(0, 300)
          });

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

          if (fallo.isDailyQuota) {
            marcarCupoDiarioAgotado(currentModel, currentApiKey);
            continue;
          }
          if (fallo.isRateLimit) {
            markKeyCooldown(currentApiKey, fallo.retryAfterMs || 60000);
            const hayOtrasClaves = disponibles.slice(k + 1).some(kk => !clavesMuertas.has(kk) && !isKeyInCooldown(kk));
            if (hayOtrasClaves) {
              setLoadingText(`Cuota agotada en la Clave ${nClave}. Rotando a la siguiente para ${modelDisplayName}...`);
              break;
            } else if (fallo.retryAfterMs > 0 && fallo.retryAfterMs <= 15000 && intento < MAX_REINTENTOS_POR_SATURACION) {
              const segs = Math.ceil(fallo.retryAfterMs / 1000);
              setLoadingText(`Límite por minuto alcanzado en Google. Esperando ${segs}s para reanudar automáticamente...`);
              await esperar(fallo.retryAfterMs + 500, signal);
              continue;
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
  /**
   * Giros nuevos que quedan plantados para más adelante.
   *
   * Es la forma de que una idea que la jugadora suelta al preparar la escena
   * —«en realidad los dueños del barco son Zhentarim»— quede guardada como
   * secreto en vez de contarse de pasada en la prosa y perderse.
   */
  secretos: SecretoLeido[];
  /**
   * Secretos que han salido a la luz EN ESCENA en este turno.
   *
   * Es el único camino por el que un secreto deja de serlo. Destapar la ficha
   * en Memoria para leerla no cuenta: eso es mirar el guion, no averiguar nada.
   */
  revelaciones: RevelacionLeida[];
  /**
   * Un trayecto largo que arranca, o el que se cierra al llegar.
   *
   * Lo que impide que la travesía entera de las Moonshae a Luskan quepa en una
   * noche: en cuanto queda declarado, la aplicación cuenta las jornadas.
   */
  viaje?: ViajeLeido | null;
  /**
   * Detalles que quedan fijados de un sitio.
   *
   * Lo que se establece jugando —que las puertas abren con runa y no con
   * llave— no vivía en ninguna parte y a las dos escenas se contradecía.
   */
  lugares?: LugarLeido[];
  /**
   * La fecha que el Narrador ha escrito en la cabecera de HUD de este mensaje,
   * tal cual, sin resolver. Es la que ve la jugadora en el chat, así que es la
   * que debe mandar sobre el calendario.
   */
  fechaHud?: string;
  /** El momento del día de esa misma cabecera: «madrugada», «media tarde». */
  momentoHud?: string;
  /** Progreso hacia el siguiente nivel, si el Narrador lo ha anotado. */
  avanceDeNivel?: AvanceDeNivel;
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
  definitivo = false,
  targetMessageIndex?: number
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
  const revelaciones = leerRevelaciones(cleanedText);
  const secretos = leerSecretos(cleanedText);
  const viaje = leerViaje(cleanedText);
  const lugares = leerLugares(cleanedText);
  // El HUD va en la prosa, no entre corchetes, así que se lee del texto íntegro.
  const hudDeEsteTurno = leerFechaDeHud(fullText);
  const avanceDeNivel = leerAvanceDeNivel(cleanedText) || undefined;
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
    (avance.encontrado ||
      agenda.length ||
      hilos.length ||
      presentes.length ||
      vinculos.length ||
      revelaciones.length ||
      secretos.length ||
      viaje ||
      lugares.length ||
      hudDeEsteTurno?.fechaTexto ||
      avanceDeNivel)
  ) {
    try {
      onTimeReported({
        minutos: avance.minutos,
        agenda,
        hilos,
        presentes,
        vinculos,
        revelaciones,
        secretos,
        viaje,
        lugares,
        fechaHud: hudDeEsteTurno?.fechaTexto,
        momentoHud: hudDeEsteTurno?.momento,
        avanceDeNivel
      });
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
  if (targetMessageIndex !== undefined && newMessages[targetMessageIndex]) {
    newMessages[targetMessageIndex] = { ...newMessages[targetMessageIndex], content: cleanedText };
  } else if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
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
  timeoutMs,
  proposito = 'Tarea de fondo'
}: {
  contents: any;
  config?: any;
  primaryModel?: string;
  preferredChain?: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Para qué es esta llamada, en el registro.
   *
   * Todas las tareas de fondo salían por aquí sin nombre, así que en el
   * registro eran una fila indistinguible de otra: imposible saber si el
   * minuto que se fue era la memoria, la trama o la extracción de PNJs.
   */
  proposito?: string;
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
      // El cupo del día no vuelve por esperar: al siguiente modelo de la cadena.
      if (cupoDiarioAgotado(model, currentKey)) continue;
      if (sinTiempo()) break;

      const ai = getAIClient(currentKey || undefined);

      for (let intento = 0; intento <= MAX_REINTENTOS_POR_SATURACION; intento++) {
        if (signal?.aborted) throw new Error('Tarea cancelada.');

        const abierto = esModeloAbierto(model);
        const gemma4 = esGemma4(model);
        const supportsThinking =
          model.includes('3.8') ||
          model.includes('3.7') ||
          model.includes('3.6') ||
          model.includes('3.5') ||
          model.includes('gemini-3') ||
          gemma4;
        const cleanedConfig: any = {
          ...config,
          thinkingConfig: supportsThinking && (!abierto || gemma4) ? config.thinkingConfig : undefined,
          ...(abierto
            ? {
                safetySettings: undefined,
                tools: gemma4 ? config.tools : undefined,
                thinkingConfig: gemma4 ? config.thinkingConfig : undefined,
                responseMimeType: gemma4 ? config.responseMimeType : undefined
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

        const idLlamada = abrirLlamada({
          proposito,
          modelo: model,
          claveN: todasLasClaves.indexOf(currentKey) + 1 || undefined,
          totalClaves: todasLasClaves.length > 1 ? todasLasClaves.length : undefined,
          intento,
          esRespaldo: i > 0,
          caracteresEnviados: (() => {
            try {
              return typeof contents === 'string' ? contents.length : JSON.stringify(contents ?? '').length;
            } catch {
              return undefined;
            }
          })()
        });

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
          // Una tarea de fondo gasta cupo diario igual que un turno narrado, y
          // se le va sin que nadie la vea: si el cupo se cuenta solo al narrar,
          // la cuenta miente justo en la parte invisible.
          apuntarPeticion(model, currentKey || undefined);
          cerrarLlamada(idLlamada, {
            estado: 'ok',
            fichasEntrada: res?.usageMetadata?.promptTokenCount,
            fichasSalida: res?.usageMetadata?.candidatesTokenCount ?? res?.usageMetadata?.responseTokenCount,
            fichasEnCache: res?.usageMetadata?.cachedContentTokenCount,
            fichasDePensamiento: res?.usageMetadata?.thoughtsTokenCount,
            motivoDeCierre: res?.candidates?.[0]?.finishReason
          });
          return res;
        } catch (err: any) {
          // Distinguir «lo hemos cortado nosotros por plazo» de «lo ha cortado la jugadora».
          const vencioElPlazo = relojDeGuardia.signal.aborted && !signal?.aborted;
          cerrarLlamada(idLlamada, {
            estado: vencioElPlazo || signal?.aborted ? 'cortada' : 'fallo',
            detalle: vencioElPlazo
              ? `Sin respuesta en ${Math.round(plazo / 1000)} s.`
              : String(err?.message || err).slice(0, 300)
          });
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
          if (fallo.isDailyQuota) {
            marcarCupoDiarioAgotado(model, currentKey || undefined);
            break;
          }
          if (fallo.isRateLimit) {
            if (currentKey) markKeyCooldown(currentKey, fallo.retryAfterMs || 60000);
            const hayOtrasClaves = disponibles.slice(k + 1).some(kk => !clavesMuertas.has(kk) && !isKeyInCooldown(kk));
            if (!hayOtrasClaves && fallo.retryAfterMs > 0 && fallo.retryAfterMs <= 15000 && intento < MAX_REINTENTOS_POR_SATURACION) {
              await esperar(fallo.retryAfterMs + 500, signal);
              continue;
            }
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

/** Categorías que el diario sabe pintar. Cualquier otra cosa es un acontecimiento. */
const TIPOS_DE_ENTRADA = new Set<string>([
  'acontecimiento',
  'hito',
  'descubrimiento',
  'secreto',
  'descanso',
  'noticia',
  'rumor',
  'inconsciencia',
  'salto_temporal',
  'diario',
  'personal',
  'escena'
]);

/** Texto comparable: sin tildes, sin puntuación y con los espacios colapsados. */
function claveComparable(v?: string): string {
  return (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Las primeras palabras de un texto, que es lo que permite reconocer dos
 * redacciones del mismo suceso sin exigir que coincidan letra por letra.
 */
function huellaDeTexto(v?: string, palabras = 10): string {
  const limpio = claveComparable(v);
  if (!limpio) return '';
  return limpio.split(' ').slice(0, palabras).join(' ');
}

/** Identificador estable a partir del contenido: la misma entrada, el mismo id. */
function hashCorto(v: string): string {
  let h = 2166136261;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Quita entradas repetidas del diario.
 *
 * Aquí se ha pecado de celo. La versión anterior tiraba por la borda cualquier
 * entrada cuyo título hablase de una llegada, una partida o un puerto si ya
 * había otra parecida en toda la campaña —y llevaba escrito el nombre de una
 * ciudad concreta en el código—, de modo que desembarcar en tres ciudades
 * distintas dejaba constancia de una sola. También borraba hitos repetidos
 * aunque estuvieran a meses de distancia: en una campaña larga se vuelve a
 * acampar, se vuelve a zarpar y se vuelve a discutir con la misma persona.
 *
 * Lo que se descarta ahora es solo el duplicado de verdad: el mismo suceso
 * apuntado dos veces el mismo día, o reescrito con otras palabras a un día de
 * distancia, que es lo que produce una resincronización. Lo escrito a mano por
 * la jugadora no entra nunca en el sorteo.
 */
export function deduplicateTimeline(timeline: TimelineEntry[]): TimelineEntry[] {
  if (!timeline || timeline.length === 0) return [];

  const sorted = [...timeline].sort((a, b) => {
    if (a.absDay !== b.absDay) return a.absDay - b.absDay;
    return (a.minute ?? 720) - (b.minute ?? 720);
  });

  const result: TimelineEntry[] = [];
  const vistas = new Map<string, number>(); // huella -> último día en que se vio

  for (const entry of sorted) {
    // Lo de la jugadora es intocable: no se puede reconstruir desde ningún chat.
    const esDeLaJugadora =
      entry.autoria === 'jugadora' ||
      entry.tipo === 'diario' ||
      entry.id?.startsWith('manual_') ||
      (entry.images && entry.images.length > 0);
    if (esDeLaJugadora) {
      result.push(entry);
      continue;
    }

    const huellas = [
      huellaDeTexto(entry.title, 8),
      huellaDeTexto(entry.summary, 12),
      huellaDeTexto(entry.hito, 8)
    ].filter(h => h.length > 6);

    // Sin texto reconocible no hay forma de comparar: se conserva.
    if (huellas.length === 0) {
      result.push(entry);
      continue;
    }

    const repetida = huellas.some(h => {
      const dia = vistas.get(h);
      // El mismo suceso el mismo día, o reescrito con un día de desfase por una
      // resincronización. Más allá de eso es un suceso nuevo que se le parece.
      return dia !== undefined && Math.abs(dia - entry.absDay) <= 1;
    });
    if (repetida) continue;

    huellas.forEach(h => vistas.set(h, entry.absDay));
    result.push(entry);
  }

  return result;
}

/**
 * Mete en el diario lo que la sincronización haya deducido sin pisar nada de lo
 * que ya había.
 *
 * La fusión se hacía por jornadas: si un día tenía aunque fuese una línea
 * escrita, todo lo reconstruido para ese día se tiraba entero. En la práctica
 * eso significaba que la sincronización solo servía para días completamente en
 * blanco, y como casi ninguno lo está en una campaña jugada, el botón parecía
 * no hacer nada —o peor, colocaba las jornadas nuevas en fechas equivocadas—.
 *
 * Ahora se compara entrada por entrada: se añade lo que no esté ya contado,
 * aunque sea un suceso más de un día que ya tenía dos apuntes, y se descarta lo
 * que solo sea la misma escena redactada de otra manera.
 */
export function fusionarTimeline(
  existentes: TimelineEntry[],
  nuevas: TimelineEntry[]
): { timeline: TimelineEntry[]; agregadas: TimelineEntry[] } {
  const base = [...(existentes || [])];
  const ids = new Set(base.map(e => e.id));
  const huellas = new Map<string, number>();

  const huellasDe = (e: TimelineEntry) =>
    [huellaDeTexto(e.title, 8), huellaDeTexto(e.summary, 12), huellaDeTexto(e.hito, 8)].filter(
      h => h.length > 6
    );

  base.forEach(e => huellasDe(e).forEach(h => huellas.set(h, e.absDay)));

  const agregadas: TimelineEntry[] = [];
  for (const nueva of nuevas || []) {
    if (!nueva || ids.has(nueva.id)) continue;
    const propias = huellasDe(nueva);
    const yaContado = propias.some(h => {
      const dia = huellas.get(h);
      return dia !== undefined && Math.abs(dia - nueva.absDay) <= 1;
    });
    if (yaContado) continue;
    propias.forEach(h => huellas.set(h, nueva.absDay));
    ids.add(nueva.id);
    agregadas.push(nueva);
  }

  const timeline = [...base, ...agregadas].sort((a, b) =>
    a.absDay === b.absDay ? (a.minute ?? 720) - (b.minute ?? 720) : a.absDay - b.absDay
  );

  return { timeline, agregadas };
}

export interface AnclaDeHud {
  /** El número con el que se le presenta al modelo dentro del historial. */
  n: number;
  /** La fecha tal cual la escribió el Narrador: «14 de Ches». */
  fechaTexto: string;
  /** El momento del día: «madrugada», «media tarde». */
  momento?: string;
  lugar?: string;
  /** Día absoluto ya resuelto contra el calendario de la campaña. */
  abs: number;
  /** Minuto del día deducido del momento, si el momento lo permitía. */
  minute?: number;
}

/**
 * Arma el historial que se le manda al modelo y le intercala las fechas que ya
 * están escritas en el chat.
 *
 * Cada vez que cambia la escena, el día o la hora, el Narrador imprime su
 * cabecera de HUD con la fecha y el momento del día; de un HUD al siguiente
 * están la hora, el día y lo que ocurrió ese día. La sincronización ignoraba
 * eso y le pedía al modelo que volviera a deducir a ojo cuántos días habían
 * pasado desde el principio. Deducir por segunda vez algo que está escrito solo
 * puede salir peor, y salía peor.
 *
 * Aquí se leen esas cabeceras, se resuelven contra el calendario de la campaña
 * y se numeran. El historial resultante lleva las marcas ⟦HUD n⟧ intercaladas
 * para que el modelo diga a cuál pertenece cada suceso: la fecha la pone la
 * aplicación, no él.
 */
export function anclarHistorialPorHud(
  chats: Chat[],
  cal: CalendarConfig,
  anoInicial: number
): { historial: string; mensajes: number; anclas: AnclaDeHud[] } {
  const sortedChats = [...chats].sort((a, b) => a.id.localeCompare(b.id));
  const anclas: AnclaDeHud[] = [];
  let historial = '';
  let mensajes = 0;
  let anoDeLectura = anoInicial;
  let ultimoAbsLeido = -Infinity;

  for (const c of sortedChats) {
    const validMessages = (c.messages || []).filter(
      m =>
        m.content &&
        m.content.trim().length > 0 &&
        m.content !== 'Pensando...' &&
        m.content !== 'Tirando dados...'
    );
    if (validMessages.length === 0) continue;

    historial += `\n=== SESIÓN / CAPÍTULO: ${c.name} ===\n`;
    for (const m of validMessages) {
      if (m.role !== 'user') {
        const hud = leerFechaDeHud(m.content);
        const fechaHud = hud?.fechaTexto ? parsearFechaTexto(cal, hud.fechaTexto, anoDeLectura) : null;
        if (hud?.fechaTexto && fechaHud) {
          /*
           * El HUD casi nunca escribe el año. Si una fecha cae antes que la
           * anterior es que se ha cruzado el fin de año, no que la campaña
           * retroceda: se prueba con el año siguiente. El tope evita quedarse
           * dando vueltas con una fecha que no encaje de ninguna manera.
           */
          let abs = aDiaAbsoluto(cal, fechaHud);
          for (let intento = 0; intento < 3 && ultimoAbsLeido > -Infinity && abs < ultimoAbsLeido; intento++) {
            anoDeLectura += 1;
            abs = aDiaAbsoluto(cal, { ...fechaHud, year: anoDeLectura });
          }
          if (abs >= ultimoAbsLeido) {
            ultimoAbsLeido = abs;
            const n = anclas.length + 1;
            anclas.push({
              n,
              fechaTexto: hud.fechaTexto,
              momento: hud.momento,
              lugar: hud.lugar,
              abs,
              minute: extraerMinutoDeTexto(hud.momento) ?? undefined
            });
            historial += `\n⟦HUD ${n} — fecha: ${hud.fechaTexto}${hud.momento ? `, ${hud.momento}` : ''}⟧\n`;
          }
        }
      }
      historial += `${m.role === 'user' ? 'Jugador' : 'Narrador'}: ${m.content}\n`;
      mensajes += 1;
    }
  }

  return { historial, mensajes, anclas };
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
  const cal: CalendarConfig = (calendarioValido(project.calendar) ? project.calendar : CALENDARIO_HARPTOS)!;

  /*
   * DÓNDE EMPIEZA LA CAMPAÑA, QUE NO ES DONDE ESTÁ AHORA.
   *
   * Aquí se anclaba todo en `project.currentDate`, que es el momento presente
   * de la partida, y luego se sumaba el `diaOffset` que devolvía el modelo
   * contando desde el primer día. Resultado: la reconstrucción del pasado
   * aterrizaba entera en el futuro. En una campaña de cuarenta días, el primer
   * capítulo se apuntaba en el día cuarenta y el resto más allá; y como la
   * fecha final también se recalculaba desde ahí, cada pulsación del botón
   * empujaba el calendario unas semanas más lejos. Por eso «no acertaba ni
   * queriendo»: no es que dedujera mal los sucesos, es que los archivaba en
   * días que no existían todavía.
   *
   * El origen real es el primer día del que ya hay algo escrito; si el diario
   * está vacío, la fecha actual sirve de origen porque la campaña acaba de
   * empezar.
   */
  const currentDate = project.currentDate && Number.isFinite(project.currentDate.year)
    ? project.currentDate
    : { year: 1492, dayOfYear: 1, minute: 540 };
  const hoyAbs = aDiaAbsoluto(cal, currentDate);

  const timelinePrevio = (project.timeline || []).filter(e => Number.isFinite(e.absDay));
  const startAbs = timelinePrevio.length
    ? Math.min(hoyAbs, ...timelinePrevio.map(e => e.absDay))
    : hoyAbs;
  const initDateProvisional = desdeDiaAbsoluto(cal, startAbs);

  const { historial: allHistory, mensajes: messageCount, anclas } = anclarHistorialPorHud(
    chats,
    cal,
    currentDate.year
  );

  /*
   * Con anclas fiables, el origen y el final de la campaña los marca el HUD y
   * no la conjetura. Solo se aceptan como fechas absolutas si caen cerca del
   * reloj de la campaña: si el Narrador escribe años de Faerûn y el proyecto
   * lleva su propio cómputo desde el año 1, sumar directamente mandaría el
   * diario a mil años de distancia. En ese caso se aprovecha únicamente la
   * SEPARACIÓN entre anclas, que sigue siendo información buenísima.
   */
  const anclasEnMarco =
    anclas.length > 0 && Math.abs(anclas[anclas.length - 1].abs - hoyAbs) <= 400;
  const primeraAnclaAbs = anclas.length ? anclas[0].abs : 0;
  const baseAbs = anclasEnMarco ? Math.min(startAbs, primeraAnclaAbs) : startAbs;
  const offsetDeAncla = (a: { abs: number }) =>
    anclasEnMarco ? a.abs - baseAbs : a.abs - primeraAnclaAbs;
  const absDeAncla = new Map<number, number>(anclas.map(a => [a.n, baseAbs + offsetDeAncla(a)]));
  const minutoDeAncla = new Map<number, number | undefined>(anclas.map(a => [a.n, a.minute]));

  const diasTranscurridos = Math.max(
    0,
    hoyAbs - baseAbs,
    ...anclas.map(a => offsetDeAncla(a))
  );

  const initDate = anclasEnMarco ? desdeDiaAbsoluto(cal, baseAbs) : initDateProvisional;

  const mapaDeAnclas = anclas.length
    ? anclas
        .slice(-80)
        .map(
          a =>
            `- HUD ${a.n} → diaOffset ${offsetDeAncla(a)} · ${a.fechaTexto}${a.momento ? `, ${a.momento}` : ''}${a.lugar ? ` · ${a.lugar}` : ''}`
        )
        .join('\n')
    : '';

  if (messageCount === 0 || !allHistory.trim()) {
    throw new Error(
      'No hay mensajes en la crónica de las sesiones todavía. Juega al menos un turno para que el Narrador pueda analizar y sincronizar la memoria y el diario.'
    );
  }

  /*
   * Con campañas largas no cabe todo, y se manda la cola. Importa decírselo al
   * modelo: si cree que el fragmento empieza en el día 1 de la campaña, fecha
   * toda la reconstrucción con semanas de desfase. Sabiendo que está recortado
   * puede contar hacia atrás desde hoy, que es el extremo que sí conoce.
   */
  const historialRecortado = allHistory.length > 400000;
  const historyToAnalyze = historialRecortado
    ? allHistory.substring(allHistory.length - 400000)
    : allHistory;

  const pcName = project.memory?.player_character?.name || '';
  const pcNotes = project.memory?.player_character
    ? `Protagonista / Personaje Jugador (OC): "${project.memory.player_character.name}" (${project.memory.player_character.race || ''} ${project.memory.player_character.class || ''})`
    : '';


  /*
   * El modelo no puede alinear su cronología con la que ya hay si no sabe qué
   * hay. Se le pasa el mapa de jornadas ya registradas con su offset, para que
   * reutilice esos mismos números en lugar de inventarse una numeración
   * paralela y duplicar días enteros.
   */
  const diasRegistrados = Array.from(
    timelinePrevio.reduce((mapa, e) => {
      const off = e.absDay - baseAbs;
      const previo = mapa.get(off) || [];
      previo.push(e.title || e.hito || e.summary || '');
      mapa.set(off, previo);
      return mapa;
    }, new Map<number, string[]>())
  )
    .sort((a, b) => a[0] - b[0])
    .slice(-60)
    .map(
      ([off, textos]) =>
        `- diaOffset ${off} (${fechaLegible(cal, desdeDiaAbsoluto(cal, baseAbs + off))}):\n${textos
          .slice(0, 12)
          .map(t => `    · ${t.slice(0, 160)}`)
          .join('\n')}`
    )
    .join('\n');

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

CALENDARIO Y LÍNEA TEMPORAL (LÉELO ANTES DE FECHAR NADA):
- Calendario: ${cal.name} (${diasPorAno(cal)} días/año)
- DÍA 1 DE LA CAMPAÑA (diaOffset 0): ${fechaLegible(cal, initDate)}
- MOMENTO ACTUAL DE LA CAMPAÑA: ${fechaLegible(cal, currentDate)}, hora ${String(Math.floor((currentDate.minute || 0) / 60)).padStart(2, '0')}:${String((currentDate.minute || 0) % 60).padStart(2, '0')}
- DÍAS TRANSCURRIDOS DESDE EL DÍA 1 HASTA HOY: ${diasTranscurridos} (por tanto el diaOffset válido va de 0 a ${diasTranscurridos})

${mapaDeAnclas
  ? `\n📌 ANCLAS DE FECHA YA RESUELTAS (la fuente de la verdad):
El historial lleva intercaladas marcas ⟦HUD n — fecha…⟧. Son las cabeceras que el propio Narrador escribió en su momento, con la fecha real de esa escena, y ya están traducidas al calendario de la campaña:
${mapaDeAnclas}

CÓMO SE USAN (es la regla más importante de todo este encargo):
- Todo lo que ocurre entre la marca ⟦HUD n⟧ y la siguiente pertenece a ESA fecha. Ahí están la hora, el día y los sucesos de ese día.
- Por eso CADA entrada de "timeline" DEBE llevar el campo "hud" con el número de la marca que la precede en el historial. No lo deduzcas por tu cuenta: mira qué marca tiene encima.
- Solo si un suceso queda antes de la primera marca o no puedes localizarlo, omite "hud" y da un "diaOffset" razonado.
- Las fechas las pone la aplicación a partir de "hud". Tu trabajo es contar QUÉ pasó y COLOCARLO bajo la marca correcta.\n`
  : ''}
⚠️ REGLA TEMPORAL INVIOLABLE:
- "diaOffset" se cuenta SIEMPRE desde el PRIMER día de la campaña (diaOffset 0 = ${fechaLegible(cal, initDate)}), NUNCA desde hoy.
- Lo que narras ya ha ocurrido: ningún acontecimiento puede tener un diaOffset mayor que ${diasTranscurridos}. Si dudas, agrupa en el día más plausible dentro de ese rango.
${historialRecortado
  ? `- ⚠️ EL HISTORIAL DE ABAJO ESTÁ RECORTADO: arranca a mitad de campaña, así que su primer mensaje NO es el diaOffset 0. Lo único seguro es que el ÚLTIMO mensaje corresponde al diaOffset ${diasTranscurridos} (hoy): fecha hacia atrás desde ahí y apóyate en las jornadas ya registradas para situarte.`
  : `- El primer mensaje del historial corresponde a diaOffset 0. El último, a diaOffset ${diasTranscurridos}.`}
${diasRegistrados ? `\n⛔ ESCENAS QUE YA ESTÁN EN EL DIARIO — NO LAS VUELVAS A ESCRIBIR:\n${diasRegistrados}\n\nEstas entradas SE CONSERVAN tal cual: no hace falta que las repitas, y repetirlas con otras palabras crea un duplicado que la jugadora ve en su diario. Antes de anotar una escena, comprueba si ya está ahí arriba aunque esté contada de otra manera («Captura y despertar en la sentina» y «Despertar entre cadenas y sombras» son LA MISMA escena). En \`daily_events\` devuelve ÚNICAMENTE las jornadas o escenas que falten. Si no falta ninguna, devuelve la lista vacía: eso es una respuesta correcta y no borra nada. Reutiliza los mismos diaOffset para los días que ya aparecen.\n` : ''}
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
  "_nota_player_events": "⛔ NO es una segunda copia del diario. 'daily_events' lleva lo que PASÓ cada día; 'player_events' lleva solo los HITOS que cambian al protagonista y que se recordarán dentro de un año: un juramento, una pérdida, una cicatriz, subir de nivel, un pacto, una decisión que no tiene vuelta atrás, un vínculo que se rompe o se sella. Una escena cotidiana —una conversación, un registro, un trato, una inspección— va en 'daily_events' y NO se repite aquí. Si dudas, no lo pongas: repetir la misma escena en las dos listas la muestra DOS VECES en el diario de la jugadora, con dos títulos y dos horas distintas. Es preferible una lista de hitos corta y vacía que un diario duplicado.",
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
    { "id": "id existente o nuevo", "name": "Nombre del lugar", "desc": "Descripción del lugar y relevancia", "notes": "LO CONCRETO QUE YA SE HA VISTO DE ESE SITIO EN LA PARTIDA y que tiene que seguir siendo verdad la próxima vez que se entre: cómo se cierran sus puertas, qué tecnología o magia usa, a qué huele, qué se oye desde dentro, quién guarda la entrada, cómo se cobra, qué está prohibido allí. Rescátalo del texto de los capítulos, literal si hace falta. Esto NO es ambientación bonita: es lo que impide que un local cuyas puertas abrían con una runa de custodia acabe abriéndose con una llave corriente dos escenas después. Déjalo vacío solo si de verdad no se ha establecido nada." }
  ],
  "diasTranscurridosTotal": 3,
  "fechaFinal": { "year": 1492, "dayOfYear": 3, "minute": 1260 },
  "resumenCronologia": "Resumen conciso de la cronología recuperada",
  "timeline": [
    {
      "hud": 1,
      "diaOffset": 0,
      "minute": 540,
      "title": "Título evocador del suceso",
      "summary": "Resumen narrativo de lo ocurrido en esta escena en 1-3 frases.",
      "lugar": "Ubicación",
      "clima": "Atmósfera o clima",
      "hito": "tipo — texto breve (ej. \"combate — Victoria en el molino\", \"relación — Kieron confía en mí\"). Omítelo si la jornada no dejó nada memorable.",
      "mood": "⚔️",
      "tipo": "acontecimiento | hito | descubrimiento | secreto | descanso | noticia | rumor | inconsciencia | salto_temporal"
    }
  ],
  "hilosPendientes": [
    {
      "title": "Título del hilo o consecuencia",
      "effect": "Qué sucederá al vencer el plazo",
      "venceEnDiasDesdeHoy": 4,
      "hidden": false
    }
  ]
}

SOBRE LOS HITOS Y LOS HILOS:
- "hito" es lo memorable de esa jornada, no un resumen de la escena: un descubrimiento, una muerte, un pacto, una llegada, un giro en una relación. Un día corriente no tiene hito, y dejarlo vacío es la respuesta correcta.
- No repitas el mismo hito en días distintos: si la llegada a una ciudad ya está anotada, el día siguiente allí no vuelve a ser "llegada".
- "hilosPendientes" son SOLO consecuencias que aún NO han ocurrido y vencen en el FUTURO, contando en días desde HOY (${fechaLegible(cal, currentDate)}). No incluyas aquí nada que ya se haya resuelto en el historial.

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
    proposito: 'Sincronizar campaña y cronología',
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
    ...(prevPc || { name: '' }),
    name: prevPc?.name || '',
    title: prevPc?.title,
    summary: parsed.player_summary || prevPc?.summary || '',
    events: mergedEvents,
    portrait: prevPc?.portrait
  };
  const updatedPc = sanitizePlayerCharacter(candidatePc);

  // Timeline / Diario con inferencia de horas
  const rawTimeline = Array.isArray(parsed.timeline) ? parsed.timeline : (Array.isArray(parsed.entradas) ? parsed.entradas : []);
  const newTimelineEntries: TimelineEntry[] = [];

  // Agrupar por día para distribuir horas en caso de que falten o coincidan
  const eventsByDayOffset = new Map<number, any[]>();
  /*
   * El pasado no se archiva en el futuro. Si el modelo se pasa de frenada con
   * el offset —y con historiales largos se pasa— la entrada se pega al día de
   * hoy en lugar de aterrizar en una fecha que aún no ha llegado. Cuando la
   * campaña todavía no ha movido el reloj no hay tope que aplicar: es el caso
   * de una partida importada cuyo calendario se estrena con esta sincronización.
   */
  const offsetMaximo = diasTranscurridos > 0 ? diasTranscurridos : Number.MAX_SAFE_INTEGER;
  rawTimeline.forEach((ev: any, idx: number) => {
    /*
     * El ancla manda. Si el modelo dice bajo qué cabecera de HUD cae el suceso,
     * la fecha sale de ahí —la escribió el Narrador cuando la escena ocurría— y
     * no de una cuenta de días hecha a posteriori. El diaOffset solo entra
     * cuando no hay ancla que valga.
     */
    const nAncla = typeof ev.hud === 'number' ? Math.round(ev.hud) : parseInt(String(ev.hud ?? ''), 10);
    const absPorAncla = Number.isFinite(nAncla) ? absDeAncla.get(nAncla) : undefined;

    const bruto =
      absPorAncla !== undefined
        ? absPorAncla - baseAbs
        : typeof ev.diaOffset === 'number' && Number.isFinite(ev.diaOffset)
        ? Math.round(ev.diaOffset)
        : 0;
    const offset = Math.min(offsetMaximo, Math.max(0, bruto));
    if (!eventsByDayOffset.has(offset)) {
      eventsByDayOffset.set(offset, []);
    }
    eventsByDayOffset.get(offset)!.push({ ev, idx });
  });

  // Procesar cada día y asegurar distribución temporal adecuada
  eventsByDayOffset.forEach((items, offset) => {
    const targetAbs = baseAbs + offset;
    const dateObj = desdeDiaAbsoluto(cal, targetAbs);
    const dateLabel = fechaLegible(cal, dateObj);
    const count = items.length;

    items.forEach(({ ev }, iInDay) => {
      let minute: number;
      if (typeof ev.minute === 'number' && Number.isFinite(ev.minute) && ev.minute >= 0 && ev.minute <= 1439) {
        minute = Math.round(ev.minute);
      } else if (typeof ev.horaAprox === 'number' && Number.isFinite(ev.horaAprox) && ev.horaAprox >= 0 && ev.horaAprox <= 23) {
        minute = Math.round(ev.horaAprox) * 60;
      } else if (minutoDeAncla.get(Number(ev.hud)) !== undefined) {
        // «madrugada», «media tarde»: el momento del día que escribió el HUD.
        minute = minutoDeAncla.get(Number(ev.hud))!;
      } else {
        // Inferencia temporal de reparto equilibrado entre las 08:30 (510 min) y las 21:30 (1290 min)
        if (count === 1) {
          minute = 720; // 12:00
        } else {
          const step = Math.floor((1290 - 510) / Math.max(1, count - 1));
          minute = 510 + iInDay * step;
        }
      }

      const summary = String(ev.summary || ev.resumen || '').trim();
      if (!summary && !ev.title) return;

      newTimelineEntries.push({
        // El id se deriva del contenido: sincronizar dos veces la misma jornada
        // devuelve el mismo identificador, y así la fusión reconoce que ya
        // estaba en lugar de apuntarla otra vez.
        id: `ai_entry_${targetAbs}_${hashCorto(`${targetAbs}|${huellaDeTexto(ev.title, 8)}|${huellaDeTexto(summary, 12)}`)}`,
        absDay: targetAbs,
        date: dateLabel,
        title: ev.title ? String(ev.title).trim() : undefined,
        summary,
        lugar: ev.lugar ? String(ev.lugar).trim() : undefined,
        clima: ev.clima ? String(ev.clima).trim() : undefined,
        hito: ev.hito ? String(ev.hito).trim() : undefined,
        mood: ev.mood || '📖',
        tipo: TIPOS_DE_ENTRADA.has(String(ev.tipo)) ? ev.tipo : 'acontecimiento',
        autoria: 'narrador',
        minute
      });
    });
  });

  /*
   * QUÉ SE CONSERVA DEL DIARIO QUE YA HABÍA.
   *
   * Aquí estaba el origen de las escenas duplicadas. Antes se conservaba solo
   * lo de la jugadora, y TODO lo que el Narrador había anotado en vivo con sus
   * etiquetas [AGENDA:] se tiraba para sustituirlo por esta reconstrucción.
   * Pero al modelo se le pide justo lo contrario —«añade solo lo que falte y NO
   * reescribas lo ya anotado»—, así que las dos mitades se contradecían: si
   * obedecía, el diario se vaciaba; si no obedecía, la misma escena acababa
   * escrita dos veces con distintas palabras. Que es lo que se veía: «Captura y
   * despertar en la sentina» y «Despertar entre cadenas y sombras».
   *
   * Ahora manda lo anotado en vivo. Se escribió mientras la escena ocurría y va
   * clavado a su mensaje del chat, así que es el registro bueno; la
   * reconstrucción solo rellena lo que falte. Y como el modelo sí sabe
   * reconocer que dos textos cuentan lo mismo —cosa que comparar palabras no
   * hace—, se le manda la lista completa de lo ya registrado y se le pide que
   * devuelva únicamente lo nuevo.
   */
  const existingTimeline = project.timeline || [];
  const entradasQueSeQuedan = existingTimeline.filter(
    e =>
      (e.images && e.images.length > 0) ||
      e.tipo === 'diario' ||
      e.autoria === 'jugadora' ||
      e.id?.startsWith('manual_') ||
      // Lo que el Narrador anotó en vivo, clavado a su mensaje.
      !!e.msgId ||
      e.id?.startsWith('dia_')
  );

  // Fusionar, deduplicar y ordenar cronológicamente
  const rawCombined = [...entradasQueSeQuedan];
  newTimelineEntries.forEach(nueva => {
    if (!rawCombined.some(c => c.id === nueva.id)) {
      rawCombined.push(nueva);
    }
  });

  const combinedTimeline = deduplicateTimeline(rawCombined);

  /*
   * EL RELOJ DE LA CAMPAÑA NO SE TOCA SI YA ESTABA EN MARCHA.
   *
   * La fecha actual la lleva el Narrador turno a turno con [TIEMPO: +Xh], y esa
   * cuenta es la buena. Sustituirla por la que dedujera el modelo al repasar el
   * historial hacía saltar el calendario semanas adelante en cada
   * sincronización. Solo se propone una fecha cuando no había nada que
   * proteger: un diario vacío y un reloj que aún no ha avanzado (típico de una
   * campaña recién importada). Y ni aun así se permite retroceder.
   */
  let calculatedCurrentDate: CampaignDate | undefined;
  const ultimaAncla = anclas.length ? anclas[anclas.length - 1] : undefined;

  /*
   * Salvo en un caso: si el HUD del chat va por delante del reloj de la
   * aplicación, el que está atrasado es el reloj. La cabecera la escribió el
   * Narrador mientras la escena ocurría, así que se adelanta el calendario
   * hasta ahí —nunca hacia atrás— y así el chat y el calendario dicen el mismo
   * día, que es de lo que se trata.
   */
  if (anclasEnMarco && ultimaAncla && baseAbs + offsetDeAncla(ultimaAncla) > hoyAbs) {
    const alDia = desdeDiaAbsoluto(cal, baseAbs + offsetDeAncla(ultimaAncla));
    calculatedCurrentDate = {
      year: alDia.year,
      dayOfYear: alDia.dayOfYear,
      minute: ultimaAncla.minute ?? currentDate.minute ?? 720
    };
  }

  const relojYaEnMarcha = diasTranscurridos > 0 || timelinePrevio.length > 0;
  if (!calculatedCurrentDate && !relojYaEnMarcha) {
    let propuesta: CampaignDate | undefined;
    if (parsed.fechaFinal && typeof parsed.fechaFinal.dayOfYear === 'number') {
      propuesta = {
        year: typeof parsed.fechaFinal.year === 'number' ? parsed.fechaFinal.year : initDate.year,
        dayOfYear: Math.max(1, Math.min(diasPorAno(cal), parsed.fechaFinal.dayOfYear)),
        minute: typeof parsed.fechaFinal.minute === 'number' ? parsed.fechaFinal.minute : 1260
      };
    } else if (combinedTimeline.length > 0) {
      const lastEntry = combinedTimeline[combinedTimeline.length - 1];
      const lastDateObj = desdeDiaAbsoluto(cal, lastEntry.absDay);
      propuesta = {
        year: lastDateObj.year,
        dayOfYear: lastDateObj.dayOfYear,
        minute: lastEntry.minute ?? 1260
      };
    }
    if (propuesta && aDiaAbsoluto(cal, propuesta) >= hoyAbs) {
      calculatedCurrentDate = propuesta;
    }
  }

  // Hilos narrativos pendientes
  const newThreads: ScheduledThread[] = [...(project.threads || [])];
  if (Array.isArray(parsed.hilosPendientes)) {
    parsed.hilosPendientes.forEach((h: any, idx: number) => {
      const title = String(h.title || 'Consecuencia programada').trim();
      const alreadyHas = newThreads.some(t => t.title.toLowerCase().trim() === title.toLowerCase());
      if (!alreadyHas) {
        /*
         * Un hilo pendiente vence por delante, no por detrás. Se cuenta desde
         * hoy; si viene con el campo antiguo —días desde el inicio— se traduce,
         * y si aun así cae en el pasado se empuja al día siguiente: un plazo ya
         * vencido en el momento de crearlo se dispararía en el turno siguiente
         * sin que nunca hubiera estado en marcha.
         */
        const desdeHoy = typeof h.venceEnDiasDesdeHoy === 'number' ? h.venceEnDiasDesdeHoy : undefined;
        const desdeInicio = typeof h.venceEnDiasDesdeInicio === 'number' ? h.venceEnDiasDesdeInicio : undefined;
        const propuesto =
          desdeHoy !== undefined
            ? hoyAbs + Math.round(desdeHoy)
            : desdeInicio !== undefined
            ? baseAbs + Math.round(desdeInicio)
            : hoyAbs + 5;
        const dueAbs = Math.max(hoyAbs + 1, propuesto);
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
/**
 * Tope duro de la crónica consolidada.
 *
 * `memory.story` viaja en CADA turno, así que su tamaño no es un detalle de
 * presentación: es un impuesto que se paga en todas las peticiones de la
 * campaña. Diez mil caracteres son unos dos mil seiscientos tokens, suficiente
 * para una crónica que se lea entera y poco para que estorbe. El detalle fino
 * vive en el diario, que no viaja.
 *
 * El tope se aplica en código, no solo pidiéndoselo al modelo: un límite que
 * depende de que la IA se porte bien no es un límite.
 */
export const TOPE_CRONICA_CARACTERES = 10000;

/**
 * Recorta por el final de un párrafo o una frase, nunca a mitad de palabra.
 *
 * Se exporta porque es la red de seguridad del tope: si el modelo devuelve el
 * doble de lo pedido, esto es lo único que impide que la crónica engorde, y una
 * red de seguridad sin prueba no es una red.
 */
export function recortarConSentido(texto: string, tope: number): string {
  const limpio = texto.trim();
  if (limpio.length <= tope) return limpio;

  const cortado = limpio.slice(0, tope);
  const finParrafo = cortado.lastIndexOf('\n\n');
  if (finParrafo > tope * 0.6) return cortado.slice(0, finParrafo).trim();

  const finFrase = Math.max(cortado.lastIndexOf('. '), cortado.lastIndexOf('.\n'));
  if (finFrase > tope * 0.5) return cortado.slice(0, finFrase + 1).trim();

  const finPalabra = cortado.lastIndexOf(' ');
  return (finPalabra > 0 ? cortado.slice(0, finPalabra) : cortado).trim() + '…';
}

/**
 * Reescribe la crónica de la campaña incorporando el capítulo que se cierra.
 *
 * REESCRIBE, no añade. Es toda la diferencia. Pegar el resumen de cada capítulo
 * al final de `memory.story` la hace crecer sin freno, y como esa crónica viaja
 * en cada turno, cada capítulo cerrado encarece para siempre todos los turnos
 * siguientes. Y encima no duraba: la sincronización general reemplaza `story`
 * entera, así que lo acumulado desaparecía a la primera.
 *
 * Aquí se le da al modelo la crónica que hay y el capítulo recién cerrado, y se
 * le pide una sola crónica que los integre. La campaña avanza, el texto se
 * reordena y el tamaño se queda donde estaba. Es lo que hace una memoria de
 * proyecto que funciona: consolidar, no apilar.
 *
 * Corre en el modelo de tareas de fondo: una petición por capítulo cerrado, que
 * frente a los cupos diarios no es nada.
 */
export async function consolidarCronicaAlCerrarCapitulo({
  project,
  capitulo
}: {
  project: Project;
  capitulo: Chat;
}): Promise<string> {
  const mensajes = (capitulo.messages || []).filter(
    m => m.content && m.content.trim() && m.content !== 'Pensando...' && m.content !== 'Tirando dados...'
  );
  if (mensajes.length === 0) throw new Error('El capítulo no tiene nada que consolidar.');

  // Las etiquetas internas no aportan nada a una crónica y gastan sitio.
  const relato = mensajes
    .map(m => `${m.role === 'user' ? 'Jugadora' : 'Narrador'}: ${stripStateTag(limpiarEtiquetasDeTiempo(m.content))}`)
    .join('\n')
    .slice(-120000);

  const cronicaActual = (project.memory?.story || '').trim();
  const pc = project.memory?.player_character;

  const prompt = `Eres el Cronista de esta campaña de rol. Acaba de cerrarse un capítulo y tu tarea es DEJAR LA CRÓNICA AL DÍA.

⚠️ REESCRIBE, NO AÑADAS. No devuelvas el capítulo resumido por separado ni lo pegues al final de lo que ya había: entrégame UNA SOLA crónica continua que ya incluya lo ocurrido en este capítulo, reordenando y condensando lo anterior donde haga falta. Lo viejo puede resumirse más para dejar sitio a lo nuevo; eso es exactamente lo que se espera de ti.

REGLAS:
- Máximo ${TOPE_CRONICA_CARACTERES} caracteres. Si no cabe todo, condensa lo más antiguo y conserva lo que sigue teniendo consecuencias abiertas.
- Prosa narrativa en pasado, en el idioma del relato. Nada de listas, encabezados de capítulo ni comentarios sobre tu propio trabajo.
- Cuenta lo que PASÓ y lo que quedó en marcha: decisiones, pérdidas, alianzas, promesas pendientes, enemigos hechos. Fuera el detalle de escena, que ya vive en el diario.
- No inventes nada que no esté en los textos que te doy.
- Responde ÚNICAMENTE con el texto de la crónica.

${pc?.name ? `PROTAGONISTA: ${pc.name}${pc.class ? ` (${pc.class})` : ''}\n` : ''}
${cronicaActual ? `CRÓNICA ACTUAL (a reescribir, no a conservar palabra por palabra):\n${cronicaActual}` : 'CRÓNICA ACTUAL: todavía no hay ninguna; esta será la primera.'}

=== CAPÍTULO QUE SE CIERRA: ${capitulo.name || 'Capítulo'} ===
${relato}`;

  const modelo = getBackgroundTaskModel();
  const respuesta = await generateContentWithFailover({
    proposito: 'Resumen al cerrar capítulo',
    primaryModel: modelo,
    contents: prompt,
    config: {
      temperature: 0.3,
      ...(esModeloAbierto(modelo) ? {} : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
    } as any
  });

  let texto = (respuesta.text || '').trim();
  if (!texto) throw new Error('El modelo no devolvió ninguna crónica.');

  texto = limpiarTextoGenerado(texto);

  return recortarConSentido(texto, TOPE_CRONICA_CARACTERES);
}

/**
 * Tope duro de la memoria general del proyecto.
 *
 * Esta es LA memoria que llega al Narrador durante la partida: de todo lo que
 * la aplicación guarda, `buildTurnPayload` solo envía esta, tus notas, tus
 * directivas manuales y la ficha. La crónica, los PNJs, las tramas y los
 * lugares no viajan. Eso la hace el campo más importante que hay… y el más
 * caro, porque va en cada petición.
 *
 * Ocho mil caracteres son unos dos mil cien tokens. Da para las tres secciones
 * con holgura y evita que un documento que crece sin vigilancia acabe costando
 * un turno de cada tres.
 */
export const TOPE_MEMORIA_PROYECTO_CARACTERES = 8000;

/** Quita vallas de código y preámbulos del tipo «Aquí tienes la memoria:». */
function limpiarTextoGenerado(texto: string): string {
  return texto
    .replace(/^```(?:\w+)?\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^\s*(?:aqu[ií] tienes|te dejo|esta es|claro[,.]?)[^\n:]{0,80}:\s*/i, '')
    .trim();
}

/**
 * La conversación de mesa: hablar con el Director FUERA de personaje.
 *
 * Es una consulta deliberadamente BARATA, y esa es la mitad de la gracia. Un
 * turno de partida arrastra unos treinta y cinco mil tokens: protocolos de
 * interfaz, las instrucciones narrativas enteras, los documentos y el capítulo
 * completo. Para preguntar «¿cuántos PG me quedan?» o «¿esto cuenta como
 * hito?» no hace falta nada de eso: sobra con quién es el personaje, en qué
 * punto está la campaña y las últimas líneas de la escena para saber a qué se
 * refiere «esto».
 *
 * Y va al modelo de tareas de fondo a propósito. Preguntar de mesa no debería
 * gastar de los veinte turnos diarios que la capa gratuita da para narrar: sale
 * del cupo de quinientos, que no se agota.
 */
export interface ImagenDeMesa {
  /** Base64 sin el prefijo `data:`, tal como lo quiere la API. */
  data: string;
  mimeType: string;
}

/**
 * Un vídeo de YouTube que el Director va a ver de verdad.
 *
 * No es la URL suelta dentro del texto: eso el modelo lo lee como una cadena de
 * caracteres y se inventa el contenido. Esto viaja como `fileData` y Gemini
 * descarga y procesa el vídeo.
 */
export interface VideoDeMesa {
  /** URL canónica del vídeo, que es lo que entiende la API. */
  url: string;
  /** Segundo por el que empieza a mirar. Omitido = desde el principio. */
  desdeSegundo?: number;
  /** Segundo por el que deja de mirar. Omitido = hasta el final. */
  hastaSegundo?: number;
}

export interface ConsultaDeMesa {
  project: Project;
  chats: Chat[];
  currentChatId?: string | null;
  /** La conversación de mesa que ya se lleva, para que tenga hilo. */
  historial: { role: 'user' | 'model'; content: string }[];
  pregunta: string;
  /** Imágenes adjuntas al mensaje, que sí llegan al modelo. */
  imagenes?: ImagenDeMesa[];
  /**
   * Vídeos de YouTube que el Director debe mirar.
   *
   * La capa gratuita admite UN vídeo por petición, así que aquí llega como
   * mucho uno; la interfaz se encarga de avisar si se pegan más.
   */
  videos?: VideoDeMesa[];
}

/**
 * Arma el prompt de la consulta de mesa.
 *
 * Se exporta aparte para poder MEDIRLO: la razón de ser de esta pantalla es que
 * cuesta una fracción de un turno de partida, y una afirmación así hay que
 * poder comprobarla, no repetirla.
 */
export function construirPromptOOC({
  project,
  chats,
  currentChatId,
  historial,
  pregunta,
  imagenes,
  videos
}: ConsultaDeMesa): string {
  const pc = project.memory?.player_character;
  const cal = project.calendar;
  const fecha = project.currentDate;

  // Solo la cola de la escena, para que sepa a qué se refiere «esto».
  const capitulo = chats.find(c => c.id === currentChatId) || chats[chats.length - 1];
  const ultimasLineas = (capitulo?.messages || [])
    .filter(m => m.content && m.content !== 'Pensando...' && m.content !== 'Tirando dados...')
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'Jugadora' : 'Narrador'}: ${stripStateTag(limpiarEtiquetasDeTiempo(m.content)).slice(0, 1200)}`)
    .join('\n');

  const ficha = pc
    ? [
        `- Protagonista: ${pc.name}${pc.title ? ` — ${pc.title}` : ''}`,
        pc.race || pc.class ? `- ${[pc.race, pc.class, pc.level].filter(Boolean).join(' · ')}` : '',
        typeof pc.hp === 'number' ? `- PG: ${pc.hp}/${pc.maxHp ?? '?'}${pc.ac ? ` · CA ${pc.ac}` : ''}` : '',
        pc.conditions?.length ? `- Condiciones: ${pc.conditions.join(', ')}` : '',
        typeof pc.hitosActuales === 'number' && pc.hitosParaSubir
          ? `- Hitos hacia el siguiente nivel: ${pc.hitosActuales}/${pc.hitosParaSubir}`
          : ''
      ]
        .filter(Boolean)
        .join('\n')
    : '(sin ficha registrada)';

  const conversacion = historial
    .slice(-16)
    .map(m => `${m.role === 'user' ? 'Jugadora' : 'Director'}: ${m.content}`)
    .join('\n');

  const prompt = `Estás hablando con la jugadora FUERA DE PERSONAJE, en la mesa, como el Director de esta partida quitándose el sombrero de Narrador un momento.

QUÉ ERES AQUÍ:
- El Director de juego respondiendo de tú a tú: dudas de reglas, aclaraciones de lo que ha pasado, ajustes de tono o de ritmo, decisiones de mesa, problemas técnicos de la partida.
- Hablas normal, en primera persona y sin prosa literaria. Nada de narrar, nada de describir el viento ni los olores. Esto es una conversación, no una escena.

QUÉ SÍ PUEDES HACER AQUÍ:
- APUNTAR EN LA MEMORIA DE LA CAMPAÑA. Si la jugadora te pide recordar algo, corregir un dato que estaba mal, o establecer una regla de mesa («a partir de ahora no describas comida», «mi personaje tiene fobia a las alturas», «Kieron es zurdo»), emites al final de tu respuesta una línea por cada cosa a recordar:
  \`[MEMORIA: el texto exacto a recordar, en una frase]\`
  Y dices en palabras qué has apuntado, para que se vea. Esas notas viajan contigo en todos los turnos de partida, así que escríbelas cortas, concretas y en un lenguaje que un Narrador pueda cumplir.
- ⛔ No apuntes nada que no te hayan pedido. No es tu cuaderno: es el suyo. Ante la duda, pregunta antes de apuntar.
- PLANTAR UN GIRO PARA MÁS ADELANTE. Si lo que te cuenta es una idea de trama que todavía NO ha pasado —«quiero que los dueños del barco resulten ser agentes Zhentarim», «el mercader es quien la vendió», «ese PNJ en realidad trabaja para la otra facción»—, guárdala como secreto de campaña con una línea:
  \`[SECRETO: título corto | la verdad | se descubre: por dónde puede salir]\`
  Le vuelve al Narrador en cada turno con candado, para que ponga pistas y coherencia sin contarlo, y solo se abre cuando salga en escena. Dile en palabras qué has guardado.

⚖️ DÓNDE VA CADA COSA (las dos son buenas, no te cortes de usarlas):
- \`[MEMORIA: ...]\` → lo importante que YA es cierto y sabido: reglas de mesa, preferencias de tono, datos del personaje, hechos de la partida, correcciones. Esto se ve en la pantalla de Memoria y viaja en cada turno. Es el sitio por defecto.
- \`[SECRETO: ...]\` → lo que aún no ha pasado o el personaje aún no sabe: giros, identidades reales, quién está detrás de qué, tramas de enemigos, lo que se encontrará más adelante. Va a los Giros de la campaña, tapado en la interfaz, y no se narra hasta que se descubra jugando.
- La prueba: **¿esto le destriparía algo si lo leyera ahora mismo en su pantalla?** Sí → \`[SECRETO:]\`. No → \`[MEMORIA:]\`.
- Ante la duda, \`[SECRETO:]\`: un giro guardado de más se puede contar mañana; uno destripado ya no se recupera.
- Puedes usar las dos en el mismo mensaje: apuntar en memoria «Aryendell desconfía del capitán» y guardar aparte el giro de por qué tiene razón.

QUÉ NO HACES AQUÍ:
- ⛔ NO narras, NO haces avanzar la historia y NO decides acciones del personaje. Si te piden jugar algo, recuérdales que eso va en la pestaña de Jugar.
- ⛔ NO emites etiquetas técnicas de partida ([TIEMPO:], [AGENDA:], [ESTADO:], [AVANCE:]…): aquí no pasa el tiempo, no se registra la crónica y la ficha no cambia. La ÚNICA etiqueta que puedes usar es [MEMORIA: ...].
- ⛔ NO reveles secretos que el personaje no sepa a menos que te lo pregunten explícitamente como jugadora («dime la verdad como Director»). Si dudas, pregunta si quiere saberlo antes de soltarlo.
- Si no sabes algo porque no consta en lo que tienes delante, dilo. No lo inventes.
${imagenes?.length ? `\n📎 LA JUGADORA TE HA ADJUNTADO ${imagenes.length === 1 ? 'UNA IMAGEN' : `${imagenes.length} IMÁGENES`}. Míralas y responde a lo que te pregunte sobre ellas: pueden ser una referencia visual de un personaje o un lugar, un mapa, una ficha, una captura de la propia aplicación o cualquier otra cosa. Describe lo que ves cuando sirva para contestar.` : ''}
${videos?.length ? `\n🎬 LA JUGADORA TE HA ADJUNTADO UN VÍDEO Y LO ESTÁS VIENDO DE VERDAD${videos[0].hastaSegundo ? ` (los primeros ${Math.round(videos[0].hastaSegundo / 60)} minutos)` : ''}. Míralo y escúchalo antes de contestar.
- Responde a partir de lo que HAY en el vídeo, no de lo que sepas del tema por tu cuenta. Si el vídeo contradice lo que creías, manda el vídeo.
- Si es lore, música, una escena o una referencia visual, di qué has visto en concreto —nombres, datos, tono, momentos— para que se note que lo has mirado.
- Si te piden guardar lo que cuenta, resúmelo tú en notas [MEMORIA: ...] cortas y concretas. No apuntes el enlace: apunta lo que dice.
- Si el vídeo se corta antes de lo que hacía falta, dilo y sugiere mandar el tramo que falta.` : ''}

CAMPAÑA: ${project.name}
${cal && fecha ? `MOMENTO ACTUAL: ${fechaCompleta(cal, fecha)}` : ''}

FICHA:
${ficha}

DÓNDE ESTAMOS (memoria de la campaña):
${(project.memory?.raw_project_memory || project.memory?.story || 'Todavía no hay memoria registrada.').slice(0, 4000)}

${ultimasLineas ? `ÚLTIMAS LÍNEAS DE LA ESCENA EN CURSO (para que sepas a qué se refiere):\n${ultimasLineas}\n` : ''}
${conversacion ? `CONVERSACIÓN DE MESA HASTA AHORA:\n${conversacion}\n` : ''}
Jugadora: ${pregunta}
Director:`;

  return prompt;
}

const MEMORIA_MESA_RE = /\[\s*MEMORIA\s*:\s*([^\]]+)\]/gi;

export interface RespuestaDeMesa {
  /** Lo que el Director contesta, ya sin etiquetas. */
  texto: string;
  /** Lo que ha pedido apuntar en la memoria de la campaña. */
  memorias: string[];
  /**
   * Giros que ha guardado como secretos de campaña.
   *
   * Es lo que faltaba para que una idea contada aquí —«que el barco sea una
   * tapadera Zhentarim»— quedara guardada en algún sitio en lugar de vivir solo
   * en esta conversación, que se recorta a los doscientos mensajes.
   */
  secretos: SecretoLeido[];
  /**
   * Lo que costó de verdad la pregunta, en fichas de entrada.
   *
   * Se enseña porque mandar un vídeo puede costar cien veces más que una
   * pregunta normal, y una estimación de la documentación no es una medida.
   * Con la cuenta real delante se decide si compensa; sin ella, se juega a
   * ciegas con una cuota que se acaba.
   */
  fichasDeEntrada?: number;
}

/**
 * Saca las anotaciones de memoria que el Director quiera dejar.
 *
 * Se exporta para poder probarlo: esto escribe en algo que viaja en TODOS los
 * turnos de partida, así que conviene saber con certeza qué entra y qué no.
 */
export function leerMemoriasDeMesa(texto: string): string[] {
  if (!texto || !texto.includes('[')) return [];
  MEMORIA_MESA_RE.lastIndex = 0;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MEMORIA_MESA_RE.exec(texto)) !== null) {
    const nota = m[1].trim().replace(/\s+/g, ' ');
    // Una nota vacía o de dos letras no es una instrucción, es ruido.
    if (nota.length > 3 && nota.length <= 400 && !out.includes(nota)) out.push(nota);
  }
  return out;
}

export async function preguntarAlDirectorOOC(
  consulta: ConsultaDeMesa & { signal?: AbortSignal }
): Promise<RespuestaDeMesa> {
  const prompt = construirPromptOOC(consulta);
  const modelo = getBackgroundTaskModel();

  /*
   * Las imágenes van como `inlineData` junto al texto, que es como las recibe
   * el modelo. Sin esto se podrían enseñar en pantalla pero el Director no las
   * vería: adjuntar sería un adorno.
   */
  const imagenes = consulta.imagenes || [];
  /*
   * El vídeo va como `fileData` con la URL de YouTube: así Gemini lo descarga y
   * lo procesa. Antes el enlace viajaba dentro del texto y el modelo contestaba
   * como si lo hubiera visto sin haberlo visto, que es peor que no tener la
   * función.
   *
   * `videoMetadata` recorta el tramo y `mediaResolution` lo baja de calidad: un
   * vídeo se cobra por segundo, y sin esas dos cosas un documental largo se
   * lleva por delante la cuota del minuto entero.
   */
  const videos = (consulta.videos || []).slice(0, 1);
  const parteDeVideo = (v: VideoDeMesa, conResolucion: boolean) => ({
    fileData: { fileUri: v.url },
    ...(v.desdeSegundo || v.hastaSegundo
      ? {
          videoMetadata: {
            ...(v.desdeSegundo ? { startOffset: `${Math.round(v.desdeSegundo)}s` } : {}),
            ...(v.hastaSegundo ? { endOffset: `${Math.round(v.hastaSegundo)}s` } : {})
          }
        }
      : {}),
    ...(conResolucion ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : {})
  });

  const armarContenido = (conResolucion: boolean) =>
    imagenes.length || videos.length
      ? {
          parts: [
            { text: prompt },
            ...imagenes.map(i => ({ inlineData: { data: i.data, mimeType: i.mimeType } })),
            ...videos.map(v => parteDeVideo(v, conResolucion))
          ]
        }
      : prompt;

  const config = {
    temperature: 0.6,
    ...(esModeloAbierto(modelo) ? {} : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
  } as any;

  let respuesta: any;
  try {
    respuesta = await generateContentWithFailover({
      proposito: 'Chat con el GM',
      primaryModel: modelo,
      contents: armarContenido(true) as any,
      signal: consulta.signal,
      config
    });
  } catch (err: any) {
    /*
     * `mediaResolution` por parte es reciente y no todos los modelos lo
     * aceptan. Si es eso lo que molesta, se reintenta sin ello: se paga más
     * caro, pero el vídeo llega. Cualquier otro error se deja subir tal cual.
     */
    const mensaje = String(err?.message || err);
    const esPorLaResolucion =
      videos.length > 0 && /mediaResolution|media_resolution|INVALID_ARGUMENT|Unknown name/i.test(mensaje);
    if (!esPorLaResolucion) throw err;
    respuesta = await generateContentWithFailover({
      proposito: 'Chat con el GM (reintento)',
      primaryModel: modelo,
      contents: armarContenido(false) as any,
      signal: consulta.signal,
      config
    });
  }

  const bruto = limpiarTextoGenerado((respuesta.text || '').trim());
  if (!bruto) throw new Error('El Director no ha contestado. Inténtalo de nuevo.');

  const memorias = leerMemoriasDeMesa(bruto);
  const secretos = leerSecretos(bruto);
  // Las etiquetas se quitan del texto que se lee: aquí no se registra nada más.
  const texto = stripStateTag(limpiarEtiquetasDeTiempo(bruto))
    .replace(MEMORIA_MESA_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { texto, memorias, secretos, fichasDeEntrada: respuesta?.usageMetadata?.promptTokenCount };
}

export interface TramaTrazada {
  premisa: string;
  destino: string;
  secretos: {
    titulo: string;
    secreto: string;
    capa: number;
    conecta: string[];
    comoSeDescubre?: string;
    sembrar?: string;
    quienLoTrae?: string;
  }[];
}

/**
 * Trama la campaña entera antes de jugarla.
 *
 * Esto es lo que separa una historia de una sucesión de escenas. Un Narrador
 * que improvisa turno a turno no puede sembrar, porque no sabe qué va a
 * cosechar; a los tres capítulos tiene un montón de hilos que no llevan a
 * ninguna parte y resuelve con lo primero que se le ocurre. Aquí decide ANTES
 * cuántas capas tiene el asunto, qué hay debajo de cada una y cómo enganchan,
 * y a partir de ese momento cada escena puede apuntar a algo.
 *
 * Se ejecuta a mano y una vez (o cuando se quiera rehacer), no en cada turno:
 * es una llamada al modelo de tareas de fondo, no un gasto por escena.
 */
export interface IdentidadLeida {
  name?: string;
  race?: string;
  class?: string;
  languages?: string[];
  appearance?: string;
}

/**
 * Saca la identidad del protagonista de sus propios documentos.
 *
 * La ficha subida traía la raza, la clase, los idiomas y la descripción física
 * —a veces con secciones enteras dedicadas a ello— y la aplicación pedía que se
 * copiara todo a mano en cuatro campos. «Sincronizar con IA» existía, pero solo
 * rellenaba el resumen y los acontecimientos: los cuatro datos que viajan al
 * Narrador en cada turno como hechos fijos eran precisamente los únicos que
 * nadie leía de ningún sitio.
 */
export async function extraerIdentidadDeDocumentos({
  project,
  files
}: {
  project: Project;
  files: ProjectFile[];
}): Promise<IdentidadLeida> {
  const esFichaDelPj = (f: ProjectFile) => {
    const n = f.name.toLowerCase();
    return (
      f.category === 'sheet_pj' ||
      ['ficha', 'personaje', 'character', 'sheet', 'protagonista', 'pj', 'oc'].some(k => n.includes(k))
    );
  };

  // Primero sus fichas; si no hay ninguna marcada, el resto de documentos de
  // texto, que a veces el trasfondo vive en un archivo con otro nombre.
  const candidatos = files.filter(f => !f.isImage && !f.isAudio && (f.content || '').trim().length > 50);
  const fichas = candidatos.filter(esFichaDelPj);
  const fuentes = (fichas.length ? fichas : candidatos).slice(0, 6);
  if (fuentes.length === 0) {
    throw new Error('No hay documentos de texto de los que leer la ficha. Sube la ficha del personaje en Archivos.');
  }

  const pc = project.memory?.player_character;
  const texto = fuentes
    .map(f => `=== ${f.name} ===\n${(f.content || '').slice(0, 30000)}`)
    .join('\n\n')
    .slice(0, 120000);

  const prompt = `De los documentos de abajo, saca la identidad del PROTAGONISTA${pc?.name ? ` (se llama ${pc.name})` : ''} y devuélvela en JSON.

Estos cuatro datos viajan al Narrador en cada turno como hechos fijos, así que la precisión importa más que la elegancia:

- "name": CÓMO SE LLAMA, tal cual aparece en el documento. Es el dato que más falta hacía y el que faltaba: sin él la aplicación la llama «Protagonista», el Narrador recibe ese nombre como suyo, y los extractores automáticos le hacen ficha de PNJ porque no reconocen que es ella. Si el documento da nombre y apellido o casa, ponlos. Si de verdad no consta ningún nombre, déjalo vacío.
- "race": su raza o especie, en pocas palabras y tal como la nombra el documento («Drow», «Elfa de la luna», «Humana»). Si el documento la matiza (mestiza, criada fuera, variante), respétalo.
- "class": clase y arquetipo, corto («Druida», «Pícara / Arcana Trapacera»).
- "languages": ARRAY con los idiomas que HABLA O ENTIENDE. Solo los que el documento le atribuya de verdad: no añadas el común «porque sí» si no consta, ni metas idiomas que solo se mencionan de pasada hablando de otros.
- "appearance": los rasgos por los que se la reconoce al verla, en 2-4 frases. Céntrate en lo PERMANENTE y distintivo —color y forma de ojos, pelo, piel, marcas, tatuajes, cicatrices, estatura, porte— y deja fuera la ropa cambiante y el equipo. Si un rasgo depende de algo (la luz, el momento), dilo con su condición: «ojos que van de verde agua a magenta según la luz sea fría o cálida». USA LAS PALABRAS DEL DOCUMENTO, no sinónimos tuyos: si dice un color concreto, ese color va.

⛔ Si un dato NO consta en los documentos, omite el campo. No lo deduzcas del nombre, del lugar de origen ni de lo que te parezca probable: un dato inventado aquí se convierte en canon y contradice lo que la jugadora tenga escrito.

DOCUMENTOS:
${texto}

Responde ÚNICAMENTE con el JSON, sin nada más:
{ "name": "...", "race": "...", "class": "...", "languages": ["..."], "appearance": "..." }`;

  const modelo = getBackgroundTaskModel();
  const respuesta = await generateContentWithFailover({
    proposito: 'Leer la identidad del protagonista',
    primaryModel: modelo,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      ...(esModeloAbierto(modelo) ? {} : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
    } as any
  });

  const limpio = (respuesta.text || '{}').replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
  let p: any = {};
  try {
    p = JSON.parse(limpio);
  } catch {
    throw new Error('La lectura ha vuelto ilegible. Vuelve a intentarlo.');
  }

  const txt = (v: any, max: number) => {
    const t = typeof v === 'string' ? v.trim() : '';
    return !t || /^(\.{3}|n\/?a|desconocid[oa]|no consta|ningun[oa]?)$/i.test(t) ? undefined : t.slice(0, max);
  };

  const idiomas = Array.isArray(p?.languages)
    ? p.languages.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 12)
    : undefined;

  // Un nombre de relleno no es un nombre: si el documento no lo da, mejor
  // dejarlo vacío que fijar «Protagonista» como si fuera el suyo.
  const generico = /^(protagonista|jugador|el jugador|personaje jugador|oc|pj|hero[íi]na?|h[ée]roe)$/i;
  const nombre = txt(p?.name, 80);

  return {
    name: nombre && !generico.test(nombre) ? nombre : undefined,
    race: txt(p?.race, 80),
    class: txt(p?.class, 80),
    languages: idiomas?.length ? idiomas : undefined,
    appearance: txt(p?.appearance, 1200)
  };
}

export async function tramarLaCampana({
  project,
  files = [],
  chats = [],
  ideas,
  modo = 'trazar'
}: {
  project: Project;
  files?: ProjectFile[];
  chats?: Chat[];
  /** Lo que la jugadora quiera aportar. Son semillas, no el guion. */
  ideas?: string;
  /**
   * `trazar` decide la historia de cero. `revisar` la repasa a la luz de lo que
   * de verdad ha pasado jugando: una trama que no se revisa se queda apuntando
   * a donde la campaña ya no va.
   */
  modo?: 'trazar' | 'revisar';
}): Promise<TramaTrazada> {
  const modelo = getBackgroundTaskModel();
  const pc = project.memory?.player_character;

  const documentos = files
    .filter(f => !f.isImage && !f.isAudio && (f.content || '').trim())
    .slice(0, 12)
    .map(f => `=== ${f.name} ===\n${(f.content || '').slice(0, 12000)}`)
    .join('\n\n')
    .slice(0, 90000);

  const yaJugado = chats
    .flatMap(c => c.messages || [])
    .filter(m => m.content && m.content.length > 40)
    .slice(-14)
    .map(m => `${m.role === 'user' ? 'Jugadora' : 'Narrador'}: ${stripStateTag(limpiarEtiquetasDeTiempo(m.content)).slice(0, 600)}`)
    .join('\n')
    .slice(0, 12000);

  const yaPlantados = (project.memory?.gm_secrets || [])
    .map(x => `- ${x.titulo}: ${x.secreto}${x.revelado ? ' [YA DESCUBIERTO EN JUEGO]' : ''}`)
    .join('\n');

  const revisando = modo === 'revisar';

  const encabezado = revisando
    ? `Eres el autor de esta campaña de rol. Ya trazaste la historia y ahora toca REPASARLA a la luz de lo que de verdad ha pasado jugando.

Una trama que no se revisa se queda apuntando a donde la campaña ya no va: el jugador tiró por otro lado, un personaje murió, una capa se destapó antes de tiempo o resultó que lo interesante era otra cosa. Tu trabajo ahora NO es reescribirla por gusto, sino dejarla útil.

QUÉ HACES AL REVISAR:
- **Lo que sigue en pie, se queda como está.** No cambies un giro solo por cambiarlo: si aún funciona, devuélvelo igual. La estabilidad vale más que la novedad.
- **Lo que la partida ha dejado inservible, arréglalo.** Un giro que ya no puede pasar (el PNJ murió, el barco se hundió, el jugador se fue a otra ciudad) se reescribe para que siga siendo posible, o se sustituye por lo que ese mismo hueco pide ahora.
- **Lo que la partida ha abierto, añádelo.** Si al jugar ha aparecido algo con más fuerza que lo previsto —una obsesión del jugador, un PNJ que se comió la escena, una pregunta que quedó en el aire— dale su capa y engánchalo con el resto.
- **⛔ Lo YA DESCUBIERTO no se toca jamás.** Eso ya pasó, el protagonista lo sabe y es historia. Devuélvelo tal cual y construye encima.
- **Afina la siembra.** A la luz de lo jugado, ¿qué detalle concreto se puede ir poniendo ahora en escena para lo que aún falta?

Y todo lo demás sigue igual: las capas, cómo encajan y por qué.`
    : `Eres el autor de esta campaña de rol, no su locutor. Antes de narrar una sola escena más, tu trabajo ahora es DECIDIR LA HISTORIA: qué está pasando de verdad, cuántas capas tiene y cómo encajan unas con otras.`;

  const prompt = `${encabezado}

${revisando ? '' : `Esto es lo que separa una buena historia de una sucesión de escenas. Quien improvisa turno a turno no puede sembrar nada, porque no sabe qué va a cosechar; a los tres capítulos tiene diez hilos que no llevan a ninguna parte y los resuelve con lo primero que se le ocurra. Tú vas a saberlo todo de antemano.`}

CÓMO SE TRAMA UNA CEBOLLA:
- **Capa 1 — lo que PARECE que pasa.** La lectura obvia de la situación. Tiene que ser creíble y suficiente por sí sola: si huele a tapadera desde el minuto uno, no engaña a nadie.
- **Capa 2 — lo que pasa DE VERDAD.** Reinterpreta la capa 1 sin contradecirla: los mismos hechos, otro sentido. Aquí es donde el jugador dice «ah, entonces aquello de…».
- **Capa 3 — quién está detrás y qué gana.** Un interés concreto de alguien concreto. No «el mal»: un nombre, un motivo y algo que ganar o perder.
- **Capa 4 — el fondo del asunto.** Lo que hace que todo esto importara desde el principio, y que suele tocar al protagonista más de lo que parecía. Opcional: solo si la campaña lo aguanta.

REGLAS DURAS:
1. **Cada capa reinterpreta la anterior, no la desmiente.** Si al destapar la capa 2 la capa 1 se vuelve mentira, has hecho un truco barato. Los mismos hechos tienen que seguir en pie, leídos de otra forma.
2. **Todo engancha con algo.** Cada secreto declara con qué otros conecta, por su título exacto. Un giro que no engancha con nada es un giro suelto y sobra.
3. **Todo se puede sembrar hoy.** De cada secreto dices qué detalle concreto y físico se puede ir poniendo en escena YA, meses antes de que se descubra: un objeto fuera de sitio, una cicatriz, una ausencia, una moneda de la ceca equivocada, alguien que no come cerdo. Sin siembra, un giro es un truco; con siembra, algo que estaba delante todo el rato.
4. **Todo se puede descubrir jugando.** De cada secreto dices por dónde puede salir con acciones que un jugador de verdad haría. Un secreto que solo se destapa si el Narrador lo regala no es un secreto: es un anuncio.
4 bis. **⭐ TODO TIENE QUIEN LO TRAIGA.** De cada capa dices QUIÉN puede meterla en una escena y QUÉ lo pondría en marcha. Un personaje del material, con nombre, que tenga un motivo propio para aparecer con eso: quien lo sabe y viene a contarlo, quien lo sufre y viene a pedir ayuda, quien lo esconde y viene a comprobar que sigue escondido, quien lo aprovecha y viene a cobrar. Di también qué lo dispara —«si se mueve algo en Calimport», «cuando el barco atraque», «en cuanto alguien pregunte por la carga»—. Esto es lo que convierte una historia en algo que pasa: sin un portador, una capa se queda esperando a que el Narrador se acuerde de ella, y no se acuerda.
5. **Usa el material que ya existe.** Los personajes, las facciones y los lugares de los documentos, y lo que ya se haya jugado. No inventes un elenco paralelo.
6. **Respeta lo ya plantado y lo ya descubierto.** Lo que aparece abajo como plantado es canon: incorpóralo a la estructura en la capa que le toque, sin cambiarlo. Lo marcado como YA DESCUBIERTO no puede volver a ser un secreto: constrúyele encima.
7. **Nada de metatrama vacía.** Ni profecías, ni elegidos, ni «el destino lo quiso», salvo que el material lo pida. Conflictos de gente con intereses.

CAMPAÑA: ${project.name}
${revisando && project.memory?.plan_de_campana?.premisa ? `PREMISA QUE HABÍA: ${project.memory.plan_de_campana.premisa}${project.memory.plan_de_campana.destino ? `\nDESTINO QUE HABÍA: ${project.memory.plan_de_campana.destino}` : ''}\n` : ''}${pc ? `PROTAGONISTA: ${pc.name}${pc.race ? `, ${pc.race}` : ''}${pc.class ? `, ${pc.class}` : ''}${pc.backstory ? `\nTrasfondo: ${pc.backstory.slice(0, 1200)}` : ''}${pc.personality ? `\nCarácter: ${pc.personality.slice(0, 600)}` : ''}` : ''}

${ideas ? `⭐ LO QUE QUIERE LA JUGADORA (son semillas suyas: respétalas y hazlas encajar en la estructura, no las descartes):\n${ideas.slice(0, 6000)}\n` : ''}
${yaPlantados ? `${revisando ? 'LA TRAMA QUE HAY AHORA (devuélvela ENTERA: lo que siga en pie, igual; lo inservible, arreglado; y añade lo que falte):' : 'GIROS YA PLANTADOS (canon, incorpóralos):'}\n${yaPlantados}\n` : ''}
${yaJugado ? `LO QUE YA SE HA JUGADO (la trama tiene que salir de aquí, no contradecirlo):\n${yaJugado}\n` : ''}
${documentos ? `MATERIAL DE LA CAMPAÑA:\n${documentos}` : ''}

Devuelve ÚNICAMENTE un JSON:
{
  "premisa": "De qué va esta historia de verdad, en 2-3 frases. Sin rodeos.",
  "destino": "Dónde acaba esto si nadie lo tuerce, en 1-2 frases.",
  "secretos": [
    {
      "titulo": "Título corto y distintivo",
      "secreto": "La verdad, concreta y con nombres",
      "capa": 1,
      "conecta": ["Título exacto de otro secreto"],
      "comoSeDescubre": "Acciones concretas que un jugador haría",
      "sembrar": "El detalle físico que se puede poner en escena hoy",
      "quienLoTrae": "Nombre del personaje que puede meterlo en escena, su motivo propio y qué lo dispara"
    }
  ]
}

${revisando ? 'Devuelve la trama COMPLETA, no solo lo que cambies: lo que siga en pie con su mismo título y su misma verdad, y lo nuevo o arreglado donde toque.' : 'Entre 5 y 9 secretos, repartidos por capas y todos enganchados. Nada de relleno.'}`;

  const respuesta = await generateContentWithFailover({
    proposito: 'Trazar la historia',
    primaryModel: modelo,
    contents: prompt,
    config: {
      temperature: 0.85,
      responseMimeType: 'application/json',
      ...(esModeloAbierto(modelo) ? {} : { safetySettings: buildSafetySettings(getStoredSafetyLevel()) })
    } as any
  });

  const limpio = (respuesta.text || '{}').replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
  let parsed: any = {};
  try {
    parsed = JSON.parse(limpio);
  } catch (e) {
    throw new Error('El trazado ha vuelto ilegible. Vuelve a intentarlo.');
  }

  const brutos: any[] = Array.isArray(parsed.secretos) ? parsed.secretos : [];
  const secretos = brutos
    .map(x => ({
      titulo: String(x?.titulo || '').trim(),
      secreto: String(x?.secreto || '').trim(),
      capa: Number.isFinite(Number(x?.capa)) ? Math.max(1, Math.min(4, Math.round(Number(x.capa)))) : 1,
      conecta: Array.isArray(x?.conecta) ? x.conecta.map((c: any) => String(c).trim()).filter(Boolean) : [],
      comoSeDescubre: x?.comoSeDescubre ? String(x.comoSeDescubre).trim() : undefined,
      sembrar: x?.sembrar ? String(x.sembrar).trim() : undefined,
      quienLoTrae: x?.quienLoTrae ? String(x.quienLoTrae).trim() : undefined
    }))
    .filter(x => x.titulo.length > 2 && x.secreto.length > 10);

  if (secretos.length === 0) throw new Error('El trazado ha vuelto vacío. Vuelve a intentarlo.');

  return {
    premisa: String(parsed.premisa || '').trim(),
    destino: String(parsed.destino || '').trim(),
    secretos
  };
}

/**
 * Mete un trazado nuevo en la trama que ya había.
 *
 * Va aparte y se exporta para poder PROBARLO, porque esto decide si la historia
 * de la campaña se conserva o se pisa cada vez que se revisa sola. Las dos
 * reglas que importan:
 *
 * - Lo YA DESCUBIERTO es intocable. Eso ya pasó en la partida y el protagonista
 *   lo sabe: reescribirlo sería cambiar el pasado.
 * - Lo que la jugadora plantó a mano tampoco se reescribe. Sus ideas se
 *   incorporan, no se corrigen.
 *
 * Lo demás —lo que trazó la propia IA y sigue en pie— sí puede afinarse: para
 * eso es una revisión.
 */
export function fusionarTrama(
  previos: SecretoDeCampana[],
  trazada: TramaTrazada
): SecretoDeCampana[] {
  const clave = (v: string) =>
    (v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const resultado = previos.map(p => {
    const nuevo = trazada.secretos.find(t => clave(t.titulo) === clave(p.titulo));
    if (!nuevo) return p;
    // Intocables: lo que ya pasó y lo que puso ella.
    if (p.revelado || p.origen === 'jugadora') {
      return { ...p, conecta: p.conecta?.length ? p.conecta : nuevo.conecta };
    }
    return {
      ...p,
      secreto: nuevo.secreto || p.secreto,
      comoSeDescubre: nuevo.comoSeDescubre || p.comoSeDescubre,
      capa: nuevo.capa || p.capa,
      conecta: nuevo.conecta?.length ? nuevo.conecta : p.conecta,
      sembrar: nuevo.sembrar || p.sembrar,
      quienLoTrae: nuevo.quienLoTrae || p.quienLoTrae
    };
  });

  for (const t of trazada.secretos) {
    if (resultado.some(p => clave(p.titulo) === clave(t.titulo))) continue;
    resultado.push({
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      titulo: t.titulo,
      secreto: t.secreto,
      comoSeDescubre: t.comoSeDescubre,
      capa: t.capa,
      conecta: t.conecta,
      sembrar: t.sembrar,
      quienLoTrae: t.quienLoTrae,
      origen: 'trama'
    });
  }

  return resultado;
}

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

  /*
   * NADA DE AMBIENTACIÓN ESCRITA A FUEGO.
   *
   * Este prompt nombraba Forgotten Realms, Bregan D'aerthe, Luskan,
   * Menzoberranzan y «la crueldad canónica de los drow», y pedía describir las
   * ataduras del protagonista. Eran los detalles de UNA campaña metidos en una
   * función que las sirve todas: cualquier otra —una espacial, una moderna—
   * habría recibido esas premisas como si fueran suyas, y el modelo tiende a
   * darlas por buenas. La ambientación tiene que salir de lo que se le pasa
   * abajo, no de aquí.
   */
  const prompt = `Eres el sintetizador de memoria de proyecto de una aplicación de rol narrativo.
Tu tarea es generar o actualizar la MEMORIA PERSISTENTE DEL PROYECTO, en Markdown y con la misma estructura que la memoria de proyectos de Claude.

⚠️ LA AMBIENTACIÓN SALE DE LOS DATOS DE ABAJO, NO DE TU IMAGINACIÓN. No des por hecho ningún mundo, sistema, tono ni tipo de personaje: toma todo eso del nombre de la campaña, las directivas, la ficha, los documentos y el historial. Si algo no consta, no lo inventes: omítelo.

Redacta un documento conciso y riguroso con EXACTAMENTE estas tres secciones en Markdown:

### Purpose & context
- Párrafo fluido: quién juega, el personaje protagonista (nombre, clase o rol, especie o procedencia, trasfondo), acompañantes habituales, el mundo y la época en que transcurre, y el estilo de narración que pide la campaña.
- Subsección "Key worldbuilding parameters established:" con viñetas breves de las reglas de ambientación y tono que la campaña haya fijado.

### Current state
- Párrafo conciso con el punto exacto en el que está la partida: dónde está el protagonista, cómo está, quién le acompaña, y qué peligros, deudas o descubrimientos tiene encima ahora mismo.

### Tools & resources
- Viñetas con las herramientas, fichas, módulos y documentos realmente cargados en el proyecto.

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
- MÁXIMO ${TOPE_MEMORIA_PROYECTO_CARACTERES} CARACTERES. Este documento viaja al Narrador en CADA turno de la partida, así que lo que sobre aquí se paga en todas las peticiones. Si no cabe todo, condensa: quédate con lo que sigue teniendo consecuencias y suelta el detalle que ya no las tenga.
- Si las directivas del usuario modifican parámetros (ej. dejar de usar oráculo, eliminar bardo/taller creativo, cambiar reglas), intégralas y refléjalas fielmente en el contenido.`;

  try {
    const bgModel = getBackgroundTaskModel();
    const safetySetting = getStoredSafetyLevel();
    const response = await generateContentWithFailover({
      proposito: 'Revisión de memoria',
      primaryModel: bgModel,
      contents: prompt,
      config: {
        temperature: 0.2,
        ...(esModeloAbierto(bgModel) ? {} : { safetySettings: buildSafetySettings(safetySetting) })
      } as any
    });

    const generated = limpiarTextoGenerado((response.text || '').trim());
    if (!generated) throw new Error('El modelo no devolvió ninguna memoria.');
    /*
     * El tope se aplica aquí, no solo pidiéndoselo al modelo. Un límite que
     * depende de que la IA se porte bien no es un límite, y este documento se
     * paga en cada turno de la partida.
     */
    return recortarConSentido(generated, TOPE_MEMORIA_PROYECTO_CARACTERES);
  } catch (err) {
    console.error('Error al generar la memoria del proyecto:', err);
    throw err;
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
  if (fallo.isDailyQuota) {
    return `📅 SE HAN ACABADO LAS PETICIONES DE HOY PARA ESTE MODELO (ERROR 429).

Este no se arregla esperando un minuto ni recortando el envío: la capa gratuita de Google reparte un número de peticiones POR DÍA y por modelo, y en los Flash de la familia 3.x son 20 por clave. Al agotarse, ese modelo con esa clave no vuelve hasta mañana.

✅ LO BUENO: CADA MODELO TIENE SU PROPIO CUPO.
Que se haya acabado el de un modelo no toca el de los demás. La app ya salta sola al siguiente de la cadena de respaldo (3.8 → 3.7 → 3.6 → 3.5 → Flash Lite) y no volverá a insistir hoy contra el que se agotó.

💡 SI QUIERES MÁS PARTIDA HOY:
• Cambia a Gemini 3.5 Flash Lite en ⚙️ Motor: su cupo diario es de 500 peticiones, veinticinco veces mayor.
• Añade más claves de API en «Motor»: cada clave lleva su propio cupo y la app las rota sola.
• Recuerda que las tareas de fondo (sincronizar memoria, novelizar, deducir fechas) también gastan de este cupo. Puedes darles un modelo distinto al de narrar.${detalle}`;
  }
  if (fallo.isTokenQuotaLimit) {
    const espera = fallo.retryAfterMs
      ? ` Google pide esperar ${Math.ceil(fallo.retryAfterMs / 1000)} segundos a que venza la ventana del minuto.`
      : ' Espera unos 60 segundos a que venza el minuto actual.';
    return `⚠️ EL ENVÍO NO CABE EN LA CUOTA POR MINUTO (ERROR 429).${espera}

NO has gastado ninguna cuota: esto no se agota con el uso. Lo que ocurre es que ESTE TURNO, ÉL SOLO, supera los ${TOPE_TOKENS_POR_MINUTO.toLocaleString('es-ES')} tokens de entrada que la capa gratuita de Google deja pasar por minuto (límite TPM: GenerateContentInputTokensPerModelPerMinute).

⚠️ POR ESO UNA CLAVE NUEVA DA EL MISMO ERROR. Si el tomo pesa más que ese tope, falla en el primer turno con una clave recién creada y sin estrenar: el problema es el tamaño de lo que se manda, no la clave ni el historial de uso. Mira la barra «Capacidad del Tomo» en la barra lateral: te dice cuánto estás mandando y contra qué tope.

📖 SOLUCIÓN RECOMENDADA: CREAR UN «NUEVO CAPÍTULO»
Para continuar de inmediato y con máxima agilidad:
1. Pulsa el botón «✨ Crear Nuevo Capítulo» (o usa el botón + en la lista de Capítulos).
2. Todo lo vivido en este capítulo quedará guardado íntegramente en la Crónica / Bitácora del proyecto.
3. Tu ficha de personaje, inventario, relaciones de PNJs, oráculos y lore se mantendrán 100% intactos.
4. El chat activo arrancará limpio con 0 tokens acumulados, evitando bloqueos de cuota.

💡 OTRAS OPCIONES:
• Si prefieres seguir en este mismo capítulo: espera 60 segundos a que Google reinicie la ventana de tokens por minuto y pulsa «Continuar Narración».
• En ⚙️ Motor → Rendimiento puedes activar la «Ventana de Historial» (ej. últimos 20 turnos) para limitar los tokens que se envían en cada turno.${detalle}`;
  }
  if (fallo.isRateLimit) {
    const espera = fallo.retryAfterMs
      ? ` Google pide esperar unos ${Math.ceil(fallo.retryAfterMs / 1000)} segundos (límite temporal de peticiones o tokens por minuto).`
      : ' Espera unos momentos.';
    return `Se ha alcanzado el límite de cuota en Google (Error 429: RESOURCE_EXHAUSTED).${espera}

💡 ¿CÓMO SOLUCIONARLO O CONTINUAR?
• Si el capítulo lleva muchos mensajes: Crea un «Nuevo Capítulo» para reiniciar los tokens del chat activo conservando todo el progreso.
• Si es una clave nueva de 0 uso: hay dos motivos posibles. Uno, que el envío sea demasiado grande y no quepa en la cuota por minuto (mira «Capacidad del Tomo»: se ve al momento). Dos, que la clave comparta proyecto con otra ya gastada, porque en Google AI Studio las cuotas pertenecen al PROYECTO de Google Cloud, no a la clave: créala con «Create API key in NEW project».
• También puedes limitar el tamaño del historial en ⚙️ Motor → Rendimiento → Ventana de Historial.${detalle}`;
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
    .replace(/\[(?:ESTADO|TIEMPO|AGENDA|HILO|CHAPTER|PRESENTES|VINCULO|AFINIDAD|AVANCE|NIVEL)\b[^\]]*\]/gi, '')
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

    /*
     * Material de fondo, clasificado por para qué sirve.
     *
     * Va DESPUÉS del elenco y el índice —esos son más específicos— y ANTES del
     * oráculo y del cajón de «documento». Sin estas tres, un compendio de
     * novelas acababa etiquetado a mano como ficha de PNJ por no tener sitio
     * mejor, que es lo peor que se le puede poner: lo mete en el saco de los
     * statblocks.
     */
    if (
      palabraEnNombre([
        'mecanica',
        'mecánica',
        'mecanicas',
        'mecánicas',
        'subsistema',
        'persecucion',
        'persecución',
        'reglas de'
      ])
    ) {
      return 'mecanica';
    }
    if (palabraEnNombre(['cantera', 'canteras'])) return 'cantera';
    if (palabraEnNombre(['compendio', 'compendios'])) return 'compendio';
    if (palabraEnNombre(['lore', 'ambientacion', 'ambientación', 'trasfondo del mundo', 'worldbuilding'])) {
      return 'lore';
    }

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
/**
 * Cuánto texto se le manda al modelo de una vez al buscar PNJs.
 *
 * Antes había un `.slice(0, 40000)` sin explicación: de un compendio de 200.000
 * caracteres el modelo veía el 19% y nadie se enteraba. Ahora el documento se
 * parte en trozos y se leen todos, así que este número solo decide cuántas
 * llamadas hacen falta, no cuánto se pierde. 60.000 caracteres son unas 16.000
 * fichas: cabe de sobra en un envío y deja sitio para la respuesta.
 */
const MAX_CARACTERES_POR_TROZO = 60000;

/**
 * Parte un documento largo por sus encabezados.
 *
 * Cortar a ciegas cada N caracteres partía la ficha de alguien por la mitad y
 * salían dos medios personajes o ninguno. Aquí se agrupan secciones enteras
 * hasta llenar el trozo, de modo que nadie queda a caballo entre dos llamadas
 * salvo que su sección sola ya sea más larga que el tope.
 */
export function partirDocumentoPorSecciones(
  texto: string,
  tope = MAX_CARACTERES_POR_TROZO
): string[] {
  if (!texto) return [];
  if (texto.length <= tope) return [texto];

  const lineas = texto.split('\n');
  const secciones: string[] = [];
  let actual: string[] = [];
  for (const linea of lineas) {
    // Un encabezado abre sección nueva, salvo que la actual esté vacía.
    if (/^#{1,6}\s/.test(linea) && actual.length > 0) {
      secciones.push(actual.join('\n'));
      actual = [linea];
    } else {
      actual.push(linea);
    }
  }
  if (actual.length) secciones.push(actual.join('\n'));

  const trozos: string[] = [];
  let buffer = '';
  const empujar = () => {
    if (buffer.trim()) trozos.push(buffer);
    buffer = '';
  };
  for (const sec of secciones) {
    if (sec.length > tope) {
      // Una sección sola más larga que el tope: se corta a lo bruto, que es
      // mejor que dejarla fuera. Pasa con tablas y transcripciones largas.
      empujar();
      for (let i = 0; i < sec.length; i += tope) trozos.push(sec.slice(i, i + tope));
      continue;
    }
    if (buffer.length + sec.length + 1 > tope) empujar();
    buffer += (buffer ? '\n' : '') + sec;
  }
  empujar();
  return trozos;
}

/** Dos formas de escribir el mismo nombre son la misma persona. */
function claveDeNombre(nombre: string): string {
  return (nombre || '')
    // «Jarlaxle Baenre — CR 15» o «Azleah (corrección de canon)» son la persona
    // y una coletilla del documento. La coletilla sobra para identificarla.
    .split(/[—–(\[]/)[0]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * ¿Son el mismo personaje escrito de dos maneras?
 *
 * Un compendio no llama a nadie igual dos veces seguidas: en un capítulo es
 * «Jarlaxle», en el apéndice de fichas «Jarlaxle Baenre». Sin esto salían dos
 * entradas, una con la voz y otra con los puntos de golpe.
 *
 * La regla es el nombre corto siendo PREFIJO del largo, por palabras enteras:
 * así «Jarlaxle» entra en «Jarlaxle Baenre», pero «Gromph Baenre» y «Beniago
 * Baenre» —que comparten apellido pero no principio— siguen siendo dos.
 */
function mismoPersonaje(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  // Un nombre de pila muy corto («Jax», «Dab») coincide con demasiadas cosas
  // por accidente; ahí se exige que sea idéntico.
  if (corto.length < 4) return false;
  return largo.startsWith(corto + ' ');
}

const INSTRUCCIONES_PNJ = `Analiza este documento y extrae TODOS los Personajes No Jugadores (PNJ), villanos, monstruos y criaturas que aparezcan con nombre propio y con información suficiente para ficharlos.

MUY IMPORTANTE:
- Devuelve un ARRAY con TODOS los que encuentres, no solo uno. Un compendio puede traer quince personajes: quiero los quince.
- Solo personajes: NO extraigas lugares, tabernas, ciudades, barcos, organizaciones, facciones, dioses ni conceptos. «Bregan D'aerthe» es una organización, no un PNJ; «Jarlaxle» sí lo es.
- Si el documento da la ficha mecánica de alguien (PG, CA, atributos, ataques, objetos mágicos), inclúyela en "sheet".
- Si un personaje aparece con alias o disfraz, rellena "alias" y "disguise", y pon en "trueIdentity" quién es de verdad.
- Si de alguien solo hay una mención de pasada sin nada que fichar, omítelo.
- No inventes: lo que no diga el documento, se deja vacío.

Para cada personaje:
- "name": nombre propio, tal como lo escribe el documento
- "relation": "Aliado", "Enemigo", "Neutral", "Contacto" o "Peligro"
- "status": "Vivo", "Activo" o el estado que se indique
- "description": rol público, quién es de cara a la galería
- "appearance": descripción física (rostro, ojos, ropa, estatura, rasgos)
- "notes": trasfondo, motivos, cómo se le interpreta, errores a evitar
- "aparenta": lo que deja ver, cómo trata a los demás
- "oculta": secretos, debilidades o intenciones que calla
- "alias": apodo o nombre falso, si lo tiene
- "trueIdentity": identidad real, si el documento la revela
- "disguise": el disfraz o apariencia falsa, si la usa
- "sheet": ficha opcional con hp, maxHp, ac, speed, attributes, traits

Responde ÚNICAMENTE con un JSON de esta forma:
{
  "personajes": [
    {
      "name": "...",
      "relation": "Neutral",
      "status": "Vivo",
      "description": "...",
      "appearance": "...",
      "notes": "...",
      "aparenta": "...",
      "oculta": "...",
      "alias": "...",
      "trueIdentity": "...",
      "disguise": "...",
      "sheet": {
        "hp": 15, "maxHp": 15, "ac": 13, "speed": "30 pies",
        "attributes": { "str": 12, "dex": 14, "con": 12, "int": 10, "wis": 11, "cha": 10 },
        "traits": []
      }
    }
  ]
}`;

/** Convierte un objeto suelto del JSON en un PNJ, sin inventarse nada. */
function pnjDesdeJson(bruto: any, respaldo: string): NPC {
  const texto = (v: any) => {
    const t = typeof v === 'string' ? v.trim() : '';
    // El modelo rellena con «...» o «N/A» cuando no sabe: eso no es un dato.
    return !t || /^(\.{3}|n\/?a|desconocido|no consta|ninguno?)$/i.test(t) ? undefined : t;
  };
  const nombre = texto(bruto?.name) || respaldo;
  const sheet = bruto?.sheet;
  const tieneFicha =
    sheet && (sheet.hp || sheet.maxHp || sheet.ac || sheet.speed || sheet.attributes || sheet.traits?.length);
  return {
    id: 'npc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
    name: nombre,
    relation: texto(bruto?.relation) || 'Neutral',
    status: texto(bruto?.status) || 'Vivo',
    description: texto(bruto?.description) || '',
    appearance: texto(bruto?.appearance),
    notes: texto(bruto?.notes) || '',
    aparenta: texto(bruto?.aparenta),
    oculta: texto(bruto?.oculta),
    alias: texto(bruto?.alias),
    trueIdentity: texto(bruto?.trueIdentity),
    disguise: texto(bruto?.disguise),
    characterSheet: tieneFicha
      ? {
          name: nombre,
          characterType: 'npc',
          hp: sheet.hp,
          maxHp: sheet.maxHp,
          ac: sheet.ac,
          speed: sheet.speed,
          attributes: sheet.attributes,
          traits: sheet.traits || []
        }
      : undefined
  } as NPC;
}

/**
 * Junta lo que dos trozos distintos dijeron del mismo personaje.
 *
 * Un compendio habla de alguien en varios sitios: su voz en un capítulo, su
 * ficha mecánica en el apéndice. Sin esto saldrían dos entradas con el mismo
 * nombre y cada una con la mitad. Se queda con el texto más largo de cada
 * campo, que es la forma barata de decir «el que trae más información».
 */
export function fusionarPnjs(lista: NPC[]): NPC[] {
  const grupos: { clave: string; npc: NPC }[] = [];
  for (const npc of lista) {
    const clave = claveDeNombre(npc.name);
    if (!clave) continue;
    const grupo = grupos.find(g => mismoPersonaje(g.clave, clave));
    if (!grupo) {
      grupos.push({ clave, npc });
      continue;
    }
    const previo = grupo.npc;
    // La clave del grupo pasa a ser la más completa de las dos, para que un
    // tercer trozo que traiga el nombre largo también reconozca al grupo.
    if (clave.length > grupo.clave.length) grupo.clave = clave;
    const masLargo = (a?: string, b?: string) => ((b || '').length > (a || '').length ? b : a);
    grupo.npc = {
      ...previo,
      name: previo.name.length >= npc.name.length ? previo.name : npc.name,
      relation: previo.relation === 'Neutral' && npc.relation !== 'Neutral' ? npc.relation : previo.relation,
      status: previo.status === 'Vivo' && npc.status !== 'Vivo' ? npc.status : previo.status,
      description: masLargo(previo.description, npc.description) || '',
      notes: masLargo(previo.notes, npc.notes) || '',
      appearance: masLargo(previo.appearance, npc.appearance),
      aparenta: masLargo(previo.aparenta, npc.aparenta),
      oculta: masLargo(previo.oculta, npc.oculta),
      alias: masLargo(previo.alias, npc.alias),
      trueIdentity: masLargo(previo.trueIdentity, npc.trueIdentity),
      disguise: masLargo(previo.disguise, npc.disguise),
      // La ficha mecánica suele estar en un apéndice, lejos del retrato: gana
      // la que exista, no la que llegó primero.
      characterSheet: previo.characterSheet || npc.characterSheet
    };
  }
  return grupos.map(g => g.npc);
}

/**
 * Saca TODOS los PNJs de un documento, por largo que sea.
 *
 * Antes esto devolvía uno solo y además leía únicamente los primeros 40.000
 * caracteres. Con un compendio de doscientos mil el resultado era un personaje
 * de quince, sin ningún aviso de que faltaban catorce: parecía que el documento
 * no traía más.
 */
export async function extractNpcsFromDocument(
  file: ProjectFile,
  onProgress?: (hechos: number, total: number) => void
): Promise<NPC[]> {
  if (!file.isImage && !(file.content || '').trim()) {
    throw new Error(`"${file.name}" no contiene texto legible.`);
  }

  const respaldo = file.name.replace(/\.[^/.]+$/, '');
  const modelo = getBackgroundTaskModel();
  const config = { responseMimeType: 'application/json', temperature: 0.1 } as any;

  const leerRespuesta = (respuesta: any): NPC[] => {
    const limpio = (respuesta?.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(limpio);
    } catch (e) {
      console.warn('No se pudo leer el JSON de PNJs:', e);
      return [];
    }
    // Se acepta tanto {personajes:[...]} como un array pelado o un objeto suelto.
    const brutos: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.personajes)
      ? parsed.personajes
      : parsed.name
      ? [parsed]
      : [];
    return brutos.map(b => pnjDesdeJson(b, respaldo)).filter(n => n.name && n.name.trim().length > 1);
  };

  if (file.isImage && file.content) {
    const base64 = file.content.includes(',') ? file.content.split(',')[1] : file.content;
    onProgress?.(0, 1);
    const respuesta = await generateContentWithFailover({
      proposito: 'Extraer PNJs de un documento',
      primaryModel: modelo,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: file.mime || 'image/jpeg', data: base64 } },
            { text: `${INSTRUCCIONES_PNJ}\n\nLee la imagen adjunta y extrae los PNJ/monstruos que aparezcan.` }
          ]
        }
      ],
      config
    });
    onProgress?.(1, 1);
    return fusionarPnjs(leerRespuesta(respuesta));
  }

  const trozos = partirDocumentoPorSecciones(file.content || '');
  const encontrados: NPC[] = [];
  for (let i = 0; i < trozos.length; i++) {
    onProgress?.(i, trozos.length);
    const contexto =
      trozos.length > 1
        ? `\n\n(Esta es la parte ${i + 1} de ${trozos.length} del documento «${file.name}». Extrae solo los personajes que aparezcan en ESTA parte; de las demás se encargan otras lecturas.)`
        : '';
    try {
      const respuesta = await generateContentWithFailover({
        proposito: 'Extraer PNJs de un documento',
        primaryModel: modelo,
        contents: `${INSTRUCCIONES_PNJ}${contexto}\n\nDocumento:\n${trozos[i]}`,
        config
      });
      encontrados.push(...leerRespuesta(respuesta));
    } catch (err) {
      // Un trozo que falle no puede tirar la lectura entera: se sigue con el
      // resto y al menos se registra lo que sí se pudo leer.
      console.warn(`Falló la parte ${i + 1} de ${trozos.length} al extraer PNJs:`, err);
    }
  }
  onProgress?.(trozos.length, trozos.length);
  return fusionarPnjs(encontrados);
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
    proposito: 'Analizar imagen subida',
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
    proposito: 'Extraer estilo visual',
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
 * Definición estilística canónica para la unidad estética:
 * Art Nouveau vintage mezclado con cartoon estilizado de series de animación modernas para jóvenes adultos (estilo Arcane / Mucha).
 */
export const ART_NOUVEAU_ANIMATION_STYLE_DNA =
  'art nouveau vintage blended with stylized modern animation for young adults (Arcane and Castlevania aesthetic meets Alphonse Mucha poster art), elegant sinuous curvilinear ink linework, decorative floral and organic filigree, bold graphic planar shading with painterly volumetric lighting, expressive facial planes and confident silhouettes, warm antique color palette with rich jewel accents (burnished gold, emerald, cinnabar, dusky indigo, warm parchment cream), cinematic lighting with subtle glowing rim lights, cohesive high fantasy animation visual development concept art, no 3D photorealistic CGI, no plastic rendering, 8k resolution';

export function buildArtNouveauUnifiedPrompt({
  subjectType,
  name,
  description = '',
  extraDetails = '',
  archetype = 'portrait',
  framing
}: {
  subjectType: 'character' | 'npc' | 'player' | 'location' | 'scene' | 'item';
  name: string;
  description?: string;
  extraDetails?: string;
  archetype?: 'portrait' | 'location' | 'scene';
  framing?: string;
}): string {
  const cleanName = name.trim() || (subjectType === 'location' ? 'Lugar Fantástico' : subjectType === 'item' ? 'Objeto Mágico' : 'Personaje');
  const descSnippet = description.trim() ? `, ${description.trim().slice(0, 300)}` : '';
  const extra = extraDetails.trim() ? `. Detalles visuales: ${extraDetails.trim()}` : '';

  if (subjectType === 'item') {
    return `Masterpiece fantasy item and artifact visual development: ${cleanName}${descSnippet}${extra}. Intricate magical relic or forged gear adorned with flowing Art Nouveau golden filigree, celestial engravings, and glowing jewel accents. Elegant decorative parchment framing, stylized modern animation design for young adults, bold graphic shapes with rich painterly textures, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
  }

  if (subjectType === 'location' || archetype === 'location') {
    if (framing === 'interior') {
      return `Masterpiece fantasy interior chamber visual development: ${cleanName}${descSnippet}${extra}. Warm atmospheric grand hall, cozy tavern or mystical sanctum with luminous stained-glass windows, carved timber beams, sinuous Art Nouveau wrought-iron candelabras and botanical archways. Modern stylized animation series background painting for young adults, rich painted textures, cozy ambient depth, warm antique amber, brass, and jewel-toned palette, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
    }
    if (framing === 'panoramic') {
      return `Masterpiece wide panoramic fantasy landscape: ${cleanName}${descSnippet}${extra}. Dramatic scenic horizon, sweeping coastal cliffs, ancient mythical forest or sprawling fantasy city under stylized clouds. Art Nouveau vintage illustration infused with modern mature animation cinematography, organic flowing natural elements, bold graphic shapes with rich painterly gouache and oil textures, cohesive fantasy world aesthetic, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
    }
    return `Masterpiece fantasy architectural environment and location visual development: ${cleanName}${descSnippet}${extra}. Sinuous Art Nouveau organic archways, flowing stone and wrought-iron botanical motifs, warm luminous stained-glass windows, intricate decorative borders and flourishes. Modern stylized animation series background painting for young adults, rich painted textures, atmospheric depth, warm antique amber and jewel-toned palette. Highly cohesive art style, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
  }

  if (subjectType === 'scene' || archetype === 'scene') {
    return `Masterpiece dramatic fantasy scene keyframe: ${cleanName}${descSnippet}${extra}. Wide cinematic composition, decorative stylized clouds and organic flowing natural elements, theatrical rim lighting. Art Nouveau vintage illustration infused with modern mature animation cinematography, bold graphic shapes with rich painterly gouache and oil textures, cohesive fantasy world aesthetic, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
  }

  // Default: Retrato de Personaje / PNJ
  if (framing === 'token') {
    return `Masterpiece character token portrait: ${cleanName}${descSnippet}${extra}. Square close-up character token portrait, focused expressive gaze and detailed stylized facial features, circular decorative Art Nouveau border with delicate metallic filigree halo. Modern stylized young-adult animation hero design (Arcane aesthetic meets Mucha), clean sinuous contours, rich volumetric painted lighting, warm antique paper undertones with deep emerald and ruby accents, highly cohesive visual identity, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
  }

  if (framing === 'medium') {
    return `Masterpiece character medium-shot portrait: ${cleanName}${descSnippet}${extra}. Expressive medium-shot character portrait from the waist up, confident dynamic swashbuckling posture, stylized angular facial planes and soulful eyes. Ornate fantasy attire adorned with intricate floral and celestial embroidery, flowing cape or garments, framed by delicate Art Nouveau organic flourishes and rim lighting. Modern stylized young-adult animation hero design (Arcane aesthetic meets Mucha), clean sinuous contours, rich volumetric painted lighting, warm antique paper undertones with deep jewel accents, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
  }

  if (framing === 'full') {
    return `Masterpiece full-body character illustration: ${cleanName}${descSnippet}${extra}. Dynamic full-length adventurer silhouette, complete fantasy costume, boots, weapons, and traveling gear. Confident stance, expressive stylized facial features, graceful flowing cloak with botanical filigree embroidery, framed against an elegant Art Nouveau decorative backdrop. Modern stylized young-adult animation hero design, bold graphic planar lighting with painterly volumetric shading, warm antique palette, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
  }

  // Bust / Portrait (Standard)
  return `Masterpiece character portrait: ${cleanName}${descSnippet}${extra}. Expressive character bust, confident posture, stylized angular facial planes and soulful eyes. Ornate fantasy attire adorned with intricate floral and celestial embroidery, framed by a delicate Art Nouveau archway and organic golden filigree halo. Modern stylized young-adult animation hero design (Arcane aesthetic meets Mucha), clean sinuous contours, rich volumetric painted lighting, warm antique paper undertones with deep emerald and ruby accents, highly cohesive visual identity, ${ART_NOUVEAU_ANIMATION_STYLE_DNA}`;
}

/**
 * Genera una imagen directamente con Gemini Image / Nano Banana / Imagen usando la clave de API configurada.
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

  // Modelos de imagen de Gemini oficiales vía generateContent (Nano Banana / multimodal)
  const geminiImageModels = [
    'gemini-3.1-flash-lite-image',
    'gemini-3.1-flash-image',
    'gemini-2.5-flash-image'
  ];

  for (const apiKey of clavesDisponibles(todas)) {
    if (apiKey && clavesMuertas.has(apiKey)) continue;
    try {
      const ai = getAIClient(apiKey || undefined);

      // Intento 1: Modelos de Gemini Image vía generateContent
      for (const modelName of geminiImageModels) {
        try {
          const genResponse = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [{ text: prompt }]
            },
            config: {
              imageConfig: {
                aspectRatio: (aspectRatio as any) || '1:1'
              }
            }
          });

          const candidates = genResponse.candidates;
          if (candidates && candidates.length > 0) {
            for (const cand of candidates) {
              const parts = cand.content?.parts;
              if (parts) {
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    const mime = part.inlineData.mimeType || 'image/png';
                    return `data:${mime};base64,${part.inlineData.data}`;
                  }
                }
              }
            }
          }
        } catch (mErr: any) {
          lastError = mErr;
          const f = classifyApiError(mErr);
          // Si es cuota agotada o fallo de clave en esta cuenta, no insistir con más modelos en la misma clave
          if (f.isRateLimit || f.isInvalidKey || f.isPermissionDenied) {
            throw mErr;
          }
          // Si el modelo específico no está disponible (404), pasar al siguiente
          console.warn(`Modelo ${modelName} no disponible para imagen:`, mErr?.message || mErr);
        }
      }

      // Intento 2: Si los modelos de Gemini fallaron por 404, probar Imagen 3 si estuviera habilitado en Vertex/Cloud
      try {
        const response = await ai.models.generateImages({
          model: 'imagen-3.0-generate',
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
      } catch (imagenErr: any) {
        // Fallo silencioso de fallback imagen
      }
    } catch (err: any) {
      lastError = err;
      const fallo = classifyApiError(err);
      if (fallo.isRateLimit && apiKey) markKeyCooldown(apiKey, fallo.retryAfterMs || 60000);
      if ((fallo.isInvalidKey || fallo.isPermissionDenied) && apiKey) clavesMuertas.add(apiKey);
      console.warn('Error generando imagen:', fallo.detail || err);
      // Si el fallo es de cuota o clave en la única clave disponible, salir
      if ((fallo.isRateLimit || fallo.isModelMissing) && keys.length <= 1) break;
    }
  }

  // Si no se obtuvo imagen, formatear un error claro y procesable para el usuario
  if (lastError) {
    const f = classifyApiError(lastError);
    const detailStr = String(f.detail || lastError?.message || '');
    if (f.isRateLimit || /free_tier.*limit: 0|resource_exhausted|quota exceeded/i.test(detailStr)) {
      throw new Error(
        'Tu clave de API de Gemini está en el plan gratuito sin cuota para generación de imágenes (límite 0 de Google para modelos de imagen). En Google AI Studio, la generación de imágenes con IA (gemini-3.1-flash-image / Nano Banana) requiere una clave con facturación habilitada (Pay-as-you-go). Puedes copiar el prompt maestro para usarlo en cualquier generador externo o añadir una clave con facturación en Ajustes.'
      );
    }
    if (f.isModelMissing || /not found|is not supported for predict/i.test(detailStr)) {
      throw new Error(
        'Los modelos de generación de imágenes de Gemini (gemini-3.1-flash-lite-image / gemini-3.1-flash-image) no están disponibles con esta clave de Google AI Studio. Verifica los permisos de tu proyecto en aistudio.google.com.'
      );
    }
    if (f.isPermissionDenied) {
      throw new Error(
        'Google ha denegado el acceso (Error 403: PERMISSION_DENIED). Comprueba que tu clave de API tenga habilitada la Generative Language API en Google Cloud / AI Studio.'
      );
    }
    if (f.isInvalidKey) {
      throw new Error(
        'La clave de API configurada no es válida o ha sido revocada. Revisa tu clave en el menú de Motor / Configuración.'
      );
    }
    throw new Error(f.detail || lastError?.message || 'Error al generar la imagen con el modelo de IA.');
  }

  throw new Error('No se pudo generar la imagen. Verifica tu clave de API en Configuración.');
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
    proposito: 'Analizar estilo narrativo',
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
    proposito: 'Extraer estilo o sistema de un archivo',
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
    proposito: 'Deducir calendario',
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
    proposito: 'Destilar tabla de oráculo',
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
    proposito: 'Noticias del salto temporal',
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
 * Transforma una respuesta o acción en bruto de la jugadora en prosa literaria
 * cinematográfica, sensorial y elegante para la edición en formato novela.
 */
export async function novelizeUserMessage({
  rawInput,
  project,
  previousNarrative,
  nextNarrative,
  signal
}: {
  rawInput: string;
  project: Project;
  previousNarrative?: string;
  nextNarrative?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const cleanInput = stripStateTag(stripRollRequests(rawInput)).trim();
  if (!cleanInput) return '';

  const pc = project.memory?.player_character;
  const pcName = pc?.name || 'la protagonista';
  const pcDetails = [
    pc?.gender ? `Género: ${pc.gender}` : '',
    pc?.race ? `Raza: ${pc.race}` : '',
    pc?.class ? `Clase: ${pc.class}` : '',
    pc?.summary ? `Personalidad: ${pc.summary}` : ''
  ]
    .filter(Boolean)
    .join(', ');

  const prompt = `Eres una novelista literaria de alta fantasía y capa y espada (ambientación Reinos Olvidados / Forgotten Realms, estilo R.A. Salvatore y literatura madura, cinematográfica e inmersiva).

Tu misión:
En una partida de rol interactiva, la jugadora escribió una respuesta/acción/diálogo en bruto para su personaje:
<<<RESPUESTA EN BRUTO DE LA JUGADORA>>>
${cleanInput}
<<<FIN DE RESPUESTA>>>

Reescribe esta intervención para la EDICIÓN NOVELA de la crónica, transformándola en prosa literaria de primer orden para que se lea como parte de un libro publicado.

DATOS DEL PERSONAJE PROTAGONISTA:
- Nombre: ${pcName}
${pcDetails ? `- Rasgos: ${pcDetails}` : ''}

${previousNarrative ? `ESCENA INMEDIATA ANTERIOR:\n${previousNarrative.slice(-550).trim()}\n` : ''}
${nextNarrative ? `DESENLACE O RESPUESTA POSTERIOR:\n${nextNarrative.slice(0, 550).trim()}\n` : ''}

DIRECTRICES EDITORIALES INVIOLABLES:
1. FIDELIDAD ABSOLUTA AL JUGADOR: Mantén exactamente la intención, los diálogos, las emociones y las decisiones que la jugadora expresó en su respuesta. No cambies lo que decidió hacer; únicamente embellece su ejecución con lenguaje corporal, sensorialidad, tensión y cadencia novelesca.
2. ENFOQUE LITERARIO: Escribe en tercera persona centrada en la perspectiva de ${pcName} (o adaptada a la voz de la novela).
3. DIÁLOGOS DE NOVELA: Si la jugadora habla, usa la raya larga de diálogo (—) e incisos de habla expresivos.
4. CERO MECÁNICAS: Si había tiradas, números o metatexto de juego ("tiro percepción", "[Tirada: 14]", "habilidad", "salvación"), tradúcelo a acciones físicas o sentidos aguzados sin dados ni jerga de mesa.
5. CONCISIÓN Y PROPORCIÓN: Genera entre 1 y 3 párrafos breves y elegantes, proporcionales a la acción. Debe ensamblar con perfecta fluidez entre la escena previa y la posterior.
6. CERO METATEXTO: Devuelve ÚNICAMENTE el texto narrativo resultante, sin introducciones ("Aquí tienes la versión..."), sin saludos y sin comillas exteriores.`;

  const modelo = getBackgroundTaskModel();
  const response = await generateContentWithFailover({
    primaryModel: modelo,
    contents: prompt,
    config: {
      temperature: 0.65
    },
    signal
  });

  let text = (response.text || '').trim();
  // Limpiar posibles bloques de código o comillas envolventes
  if (text.startsWith('```') && text.endsWith('```')) {
    text = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('«') && text.endsWith('»')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

/**
 * Extrae automáticamente directivas clave, reglas o pactos de la partida usando IA
 * para añadirlas a la lista de Directivas Manuales de Memoria.
 */
export async function extractAiDirectives({
  chats,
  files,
  project
}: {
  chats: Chat[];
  files: ProjectFile[];
  project: Project;
}): Promise<string[]> {
  const recentHistory = chats
    .flatMap(c => (c.messages || []).map(m => `${m.role.toUpperCase()}: ${m.content}`))
    .slice(-30)
    .join('\n');

  const fileSummaryList = files.length > 0
    ? files.map(f => `- **${f.name}**: ${f.content?.slice(0, 200) || ''}`).join('\n')
    : 'Sin documentos adicionales.';

  const prompt = `Eres el director de juego y sintetizador de reglas de la campaña de rol "${project.name}" (D&D 5e / Forgotten Realms).
Analiza el historial reciente y los documentos de referencia para extraer entre 1 y 4 directrices, reglas de juego, pactos, restricciones o hechos capitales clave que la IA (Narrador) DEBE recordar de forma estricta en adelante.

DOCUMENTOS DE REFERENCIA:
${fileSummaryList}

HISTORIAL RECIENTE:
${recentHistory || 'Sin historial reciente.'}

REGLA DE SALIDA:
Devuelve un JSON estricto con un array de strings bajo la clave "directives":
{
  "directives": [
    "Directriz o regla clave 1",
    "Directriz o regla clave 2"
  ]
}
No devuelvas texto adicional ni bloques de markdown que no sean el JSON.`;

  try {
    const bgModel = getBackgroundTaskModel();
    const safetySetting = getStoredSafetyLevel();
    const response = await generateContentWithFailover({
      primaryModel: bgModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        ...(esModeloAbierto(bgModel) ? {} : { safetySettings: buildSafetySettings(safetySetting) })
      } as any
    });

    const text = response.text?.trim() || '';
    if (!text) return [];
    let clean = text;
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed.directives)) {
      return parsed.directives.map((d: any) => String(d).trim()).filter(Boolean);
    }
    return [];
  } catch (err) {
    console.error('Error al extraer directivas con IA:', err);
    return [];
  }
}

/**
 * Modela y transforma en lote todas las respuestas del jugador en una lista de mensajes
 * que aún no hayan sido noveladas (o forzando todas si forceAll es true).
 */
export async function batchNovelizeMessages({
  messages,
  project,
  forceAll = false,
  onProgress,
  signal
}: {
  messages: Message[];
  project: Project;
  forceAll?: boolean;
  onProgress?: (current: number, total: number, messageIndex: number) => void;
  signal?: AbortSignal;
}): Promise<Message[]> {
  const userIndices = messages
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => m.role === 'user' && (forceAll || !m.novelContent));

  if (userIndices.length === 0) {
    return messages;
  }

  const updatedMessages = [...messages];
  let processed = 0;
  const total = userIndices.length;

  for (const { m, idx } of userIndices) {
    if (signal?.aborted) break;
    onProgress?.(processed + 1, total, idx);

    // Contexto inmediato anterior y posterior
    const previousModelMsg = [...messages.slice(0, idx)].reverse().find(msg => msg.role === 'model')?.content;
    const nextModelMsg = messages.slice(idx + 1).find(msg => msg.role === 'model')?.content;

    try {
      const novelText = await novelizeUserMessage({
        rawInput: m.content,
        project,
        previousNarrative: previousModelMsg,
        nextNarrative: nextModelMsg,
        signal
      });

      if (novelText) {
        updatedMessages[idx] = {
          ...updatedMessages[idx],
          novelContent: novelText
        };
      }
    } catch (err: any) {
      console.error(`Error al novelar mensaje ${idx}:`, err);
    }
    processed++;
  }

  return updatedMessages;
}


