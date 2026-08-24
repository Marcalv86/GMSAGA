/**
 * Gestor de Registro y Captura de Errores (Logger)
 * 
 * Captura errores, advertencias e incidencias durante la generación de hilos narrativos,
 * streaming con Gemini, sincronización de cronología/memoria y persistencia local.
 * Permite consultar el historial y exportarlo a un archivo de texto para depuración técnica.
 */

export type LogLevel = 'error' | 'warn' | 'info';

export type LogCategory =
  | 'threads'
  | 'gemini_stream'
  | 'memory_sync'
  | 'calendar_timeline'
  | 'storage'
  | 'general';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO 8601
  formattedTime: string; // HH:MM:SS DD/MM/YYYY
  level: LogLevel;
  category: LogCategory;
  title: string;
  message: string;
  details?: string;
  stack?: string;
  projectName?: string;
  chatName?: string;
  model?: string;
}

const STORAGE_KEY = 'gm_studio_error_logs_v1';
const MAX_LOGS = 200;

// Estado en memoria
let logsCache: LogEntry[] = [];
let isLoaded = false;
const listeners = new Set<(logs: LogEntry[]) => void>();

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

function loadLogs(): LogEntry[] {
  if (isLoaded) return logsCache;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      logsCache = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[Logger] No se pudieron cargar los logs desde localStorage:', e);
    logsCache = [];
  }
  isLoaded = true;
  return logsCache;
}

function persistLogs() {
  if (typeof window === 'undefined') return;
  try {
    // Mantener solo los últimos MAX_LOGS
    if (logsCache.length > MAX_LOGS) {
      logsCache = logsCache.slice(logsCache.length - MAX_LOGS);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logsCache));
  } catch (e) {
    console.warn('[Logger] Error al guardar logs en localStorage:', e);
  }
}

function notifyListeners() {
  const current = [...logsCache];
  listeners.forEach(cb => {
    try {
      cb(current);
    } catch (e) {
      console.error('[Logger] Error en suscriptor de logs:', e);
    }
  });
}

/**
 * Registra un nuevo evento o error en el sistema de logs.
 */
export function addLog(entry: {
  level: LogLevel;
  category: LogCategory;
  title: string;
  message: string;
  error?: any;
  details?: string | Record<string, any>;
  projectName?: string;
  chatName?: string;
  model?: string;
}): LogEntry {
  loadLogs();

  const now = new Date();
  let detailsStr = '';
  let stackStr = '';

  if (entry.error) {
    if (entry.error instanceof Error) {
      stackStr = entry.error.stack || '';
      if (!detailsStr) detailsStr = entry.error.message;
    } else if (typeof entry.error === 'object') {
      try {
        detailsStr = JSON.stringify(entry.error, null, 2);
      } catch {
        detailsStr = String(entry.error);
      }
    } else {
      detailsStr = String(entry.error);
    }
  }

  if (entry.details) {
    if (typeof entry.details === 'object') {
      try {
        const extraJson = JSON.stringify(entry.details, null, 2);
        detailsStr = detailsStr ? `${detailsStr}\n\nContexto adicional:\n${extraJson}` : extraJson;
      } catch {
        detailsStr = detailsStr ? `${detailsStr}\n\n${String(entry.details)}` : String(entry.details);
      }
    } else {
      detailsStr = detailsStr ? `${detailsStr}\n\n${entry.details}` : entry.details;
    }
  }

  const logItem: LogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now.toISOString(),
    formattedTime: formatDateTime(now),
    level: entry.level,
    category: entry.category,
    title: entry.title,
    message: entry.message,
    details: detailsStr || undefined,
    stack: stackStr || undefined,
    projectName: entry.projectName,
    chatName: entry.chatName,
    model: entry.model
  };

  logsCache.push(logItem);
  persistLogs();
  notifyListeners();

  return logItem;
}

/**
 * Atajo para registrar un error crítico.
 */
export function logError(
  category: LogCategory,
  title: string,
  error: any,
  context?: {
    message?: string;
    details?: string | Record<string, any>;
    projectName?: string;
    chatName?: string;
    model?: string;
  }
): LogEntry {
  const errMsg =
    context?.message ||
    (error instanceof Error ? error.message : typeof error === 'string' ? error : 'Error no especificado');

  console.error(`[GM Logger][${category.toUpperCase()}] ${title}:`, error);

  return addLog({
    level: 'error',
    category,
    title,
    message: errMsg,
    error,
    details: context?.details,
    projectName: context?.projectName,
    chatName: context?.chatName,
    model: context?.model
  });
}

/**
 * Atajo para registrar una advertencia (p.ej. reintento de modelo o parseo parcial).
 */
export function logWarn(
  category: LogCategory,
  title: string,
  message: string,
  context?: {
    details?: string | Record<string, any>;
    projectName?: string;
    chatName?: string;
    model?: string;
  }
): LogEntry {
  console.warn(`[GM Logger][${category.toUpperCase()}] ${title}: ${message}`);
  return addLog({
    level: 'warn',
    category,
    title,
    message,
    details: context?.details,
    projectName: context?.projectName,
    chatName: context?.chatName,
    model: context?.model
  });
}

/**
 * Atajo para registrar información diagnóstica.
 */
export function logInfo(
  category: LogCategory,
  title: string,
  message: string,
  context?: {
    details?: string | Record<string, any>;
    projectName?: string;
    chatName?: string;
    model?: string;
  }
): LogEntry {
  return addLog({
    level: 'info',
    category,
    title,
    message,
    details: context?.details,
    projectName: context?.projectName,
    chatName: context?.chatName,
    model: context?.model
  });
}

/**
 * Obtiene todos los logs ordenados por fecha (más recientes primero).
 */
export function getLogs(): LogEntry[] {
  return [...loadLogs()].reverse();
}

/**
 * Elimina todos los logs del historial.
 */
export function clearLogs(): void {
  logsCache = [];
  persistLogs();
  notifyListeners();
}

/**
 * Suscribe un componente React a las actualizaciones de logs.
 */
export function subscribeToLogs(callback: (logs: LogEntry[]) => void): () => void {
  listeners.add(callback);
  callback(getLogs());
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Da formato de texto plano estructurado a todos los logs para exportación o copia.
 */
export function getLogsAsFormattedText(): string {
  const currentLogs = [...loadLogs()].reverse();
  const dateStr = formatDateTime(new Date());

  const errorsCount = currentLogs.filter(l => l.level === 'error').length;
  const warnsCount = currentLogs.filter(l => l.level === 'warn').length;
  const infosCount = currentLogs.filter(l => l.level === 'info').length;

  const lines: string[] = [
    '================================================================================',
    'GM STUDIO — REGISTRO DE EVENTOS, ERRORES Y GENERACIÓN DE HILOS PARA DEPURACIÓN',
    `Fecha de exportación: ${dateStr}`,
    `Total de eventos: ${currentLogs.length} (Errores: ${errorsCount} | Advertencias: ${warnsCount} | Info: ${infosCount})`,
    `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconocido'}`,
    '================================================================================',
    ''
  ];

  if (currentLogs.length === 0) {
    lines.push('No hay registros ni errores capturados en el historial.');
    return lines.join('\n');
  }

  currentLogs.forEach((log, index) => {
    lines.push(`[#${currentLogs.length - index}] [${log.formattedTime}] [${log.level.toUpperCase()}] [${log.category.toUpperCase()}]`);
    lines.push(`Título: ${log.title}`);
    lines.push(`Mensaje: ${log.message}`);

    if (log.projectName) lines.push(`Tomo/Proyecto: ${log.projectName}`);
    if (log.chatName) lines.push(`Capítulo: ${log.chatName}`);
    if (log.model) lines.push(`Modelo de IA: ${log.model}`);

    if (log.details) {
      lines.push('Detalles técnicos / Contexto:');
      lines.push(
        log.details
          .split('\n')
          .map(l => `  ${l}`)
          .join('\n')
      );
    }

    if (log.stack) {
      lines.push('Stack Trace:');
      lines.push(
        log.stack
          .split('\n')
          .map(l => `  ${l}`)
          .join('\n')
      );
    }

    lines.push('--------------------------------------------------------------------------------');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Exporta y descarga un archivo .txt con todo el historial de depuración.
 */
export function exportLogsToTextFile(customFilename?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const textContent = getLogsAsFormattedText();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = customFilename || `gm_studio_log_errores_${timestamp}.txt`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[Logger] Error al exportar archivo de texto de logs:', err);
    return false;
  }
}
