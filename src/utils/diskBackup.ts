import { Project, Chat, ProjectFile } from '../types';
import { getDB } from './fileStorage';
import {
  getStoredApiKeys,
  getStoredKeyRotationMode,
  getStoredModel,
  getStoredBackgroundModel,
  getStoredSafetyLevel,
  getStoredThinkingLevel,
  getStoredTemperature,
  getStoredTopP,
  getStoredAutoFailover,
  getStoredMemorySyncGranularity
} from './geminiHelper';

/**
 * Copia automática de la campaña a una carpeta real del disco.
 *
 * El navegador sigue siendo donde se trabaja; esto es la red de seguridad. Se usa
 * la File System Access API: la usuaria elige una carpeta una sola vez, el
 * identificador se guarda en IndexedDB y a partir de ahí la app puede escribir
 * ficheros ahí dentro.
 *
 * Dos límites que no dependen de nosotros:
 *  - El selector de carpeta hoy solo existe en navegadores Chromium (Chrome,
 *    Edge) de escritorio y Android. En Firefox, Safari y iOS no está.
 *  - El permiso de escritura se pierde al cerrar todas las pestañas del sitio.
 *    El identificador sobrevive, pero hay que reconfirmar con un clic. Es a
 *    propósito: ninguna web puede escribir en el disco sin que lo autorices.
 */

const APP_STORE = 'app_data';
const HANDLE_KEY = 'disk_backup_dir';

type DirHandle = FileSystemDirectoryHandle;

// Se guarda también en memoria: es lo que se usa durante la sesión, y así una
// escritura no depende de volver a leer IndexedDB cada vez.
let cachedHandle: DirHandle | null | undefined;

export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function isDiskBackupSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).showDirectoryPicker === 'function' &&
    !isRunningInIframe()
  );
}

// Abrir la base es cosa de fileStorage: es quien crea los almacenes. Abrirla aquí
// por separado creaba una base vacía si esta llamada llegaba primero.
const openDB = getDB;

async function readHandle(): Promise<DirHandle | null> {
  if (cachedHandle !== undefined) return cachedHandle;
  try {
    const db = await openDB();
    return await new Promise(resolve => {
      const tx = db.transaction(APP_STORE, 'readonly');
      const get = tx.objectStore(APP_STORE).get(HANDLE_KEY);
      get.onsuccess = () => {
        const found: DirHandle | null = get.result?.handle ?? null;
        cachedHandle = found;
        resolve(found);
      };
      get.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeHandle(handle: DirHandle | null): Promise<void> {
  cachedHandle = handle;
  try {
    const db = await openDB();
    const tx = db.transaction(APP_STORE, 'readwrite');
    const store = tx.objectStore(APP_STORE);
    if (handle) store.put({ key: HANDLE_KEY, handle });
    else store.delete(HANDLE_KEY);
  } catch (err) {
    console.warn('No se pudo recordar la carpeta de copia:', err);
  }
}

/** Pide la carpeta a la usuaria. Requiere un clic suyo, no se puede automatizar. */
export async function chooseBackupFolder(): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (isRunningInIframe()) {
    return {
      ok: false,
      error: 'El navegador bloquea la selección directa de carpetas en disco dentro de un marco integrado (iframe). Abre la aplicación en una pestaña independiente para activar el guardado en disco, o utiliza la pestaña "Copias JSON" para descargar tus campañas.'
    };
  }
  if (!isDiskBackupSupported()) {
    return { ok: false, error: 'Este navegador no admite la selección de carpetas en disco (File System Access API).' };
  }
  try {
    const handle: DirHandle = await (window as any).showDirectoryPicker({
      id: 'gmstudio-backup',
      mode: 'readwrite',
      startIn: 'documents'
    });
    await writeHandle(handle);
    return { ok: true, name: handle.name };
  } catch (err: any) {
    // Cancelar el diálogo no es un fallo que haya que reportar.
    if (err?.name === 'AbortError') return { ok: false };
    if (err?.name === 'SecurityError' || (err?.message && err.message.toLowerCase().includes('sub frame'))) {
      return {
        ok: false,
        error: 'El navegador bloquea el acceso a carpetas locales dentro de un marco integrado (iframe). Abre la app en una pestaña nueva o descarga una copia JSON.'
      };
    }
    return { ok: false, error: err?.message || 'No se pudo abrir la carpeta.' };
  }
}

export async function forgetBackupFolder(): Promise<void> {
  await writeHandle(null);
}

export async function getBackupFolderName(): Promise<string | null> {
  const handle = await readHandle();
  return handle?.name ?? null;
}

/**
 * Comprueba el permiso de escritura. Con `interactive` pide confirmación, cosa
 * que solo funciona dentro de un gesto de la usuaria (un clic).
 */
export async function checkBackupPermission(
  interactive = false
): Promise<'granted' | 'prompt' | 'denied' | 'none'> {
  const handle = await readHandle();
  if (!handle) return 'none';
  try {
    const opts = { mode: 'readwrite' } as any;
    let state = await (handle as any).queryPermission(opts);
    if (state !== 'granted' && interactive) {
      state = await (handle as any).requestPermission(opts);
    }
    return state;
  } catch {
    return 'denied';
  }
}

function safeName(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'campana'
  );
}

/**
 * Escribe la campaña completa en la carpeta elegida. Devuelve false sin ruido si
 * no hay carpeta o el permiso no está concedido: es una copia de seguridad, no
 * debe interrumpir la partida.
 */
export async function writeCampaignToDisk(
  project: Project,
  chats: Chat[],
  files: ProjectFile[]
): Promise<{ written: boolean; reason?: 'no-folder' | 'no-permission' | 'error' }> {
  const handle = await readHandle();
  if (!handle) return { written: false, reason: 'no-folder' };

  try {
    const state = await (handle as any).queryPermission({ mode: 'readwrite' });
    if (state !== 'granted') return { written: false, reason: 'no-permission' };

    const apiKeys = getStoredApiKeys();
    const payload = JSON.stringify(
      {
        ...project,
        chats,
        files,
        apiKeys: apiKeys.length > 0 ? apiKeys : undefined,
        keyRotationMode: getStoredKeyRotationMode(),
        geminiSettings: {
          model: getStoredModel(),
          backgroundModel: getStoredBackgroundModel(),
          safetyLevel: getStoredSafetyLevel(),
          thinkingLevel: getStoredThinkingLevel(),
          temperature: getStoredTemperature(),
          topP: getStoredTopP(),
          autoFailover: getStoredAutoFailover(),
          memorySyncGranularity: getStoredMemorySyncGranularity()
        },
        exportadaEl: new Date().toISOString()
      },
      null,
      2
    );
    const fileName = `${safeName(project.name)}.gmstudio.json`;

    // createWritable() ya escribe a un fichero de intercambio y lo sustituye al
    // cerrar, así que un corte a mitad no deja la copia truncada. No hace falta
    // hacerlo a mano, y además en Android no hay renombrado atómico.
    const target = await handle.getFileHandle(fileName, { create: true });
    const writable = await target.createWritable();
    await writable.write(payload);
    await writable.close();

    return { written: true };
  } catch (err) {
    console.warn('No se pudo escribir la copia en disco:', err);
    return { written: false, reason: 'error' };
  }
}

export interface DiskCampaignFile {
  name: string;
  size: number;
  lastModified: number;
  getFile: () => Promise<File>;
}

/**
 * Lista los archivos de campaña (.json / .gmstudio.json) guardados en la carpeta activa del disco.
 */
export async function listCampaignFilesFromDisk(): Promise<{
  ok: boolean;
  files: DiskCampaignFile[];
  error?: string;
  permissionNeeded?: boolean;
}> {
  const handle = await readHandle();
  if (!handle) return { ok: false, files: [], error: 'No hay carpeta vinculada.' };

  try {
    const opts = { mode: 'read' } as any;
    let state = await (handle as any).queryPermission(opts);
    if (state !== 'granted') {
      return { ok: false, files: [], permissionNeeded: true };
    }

    const files: DiskCampaignFile[] = [];
    
    // Iteración compatible con entries() o values()
    if (typeof (handle as any).values === 'function') {
      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file') {
          const lower = entry.name.toLowerCase();
          if (lower.endsWith('.json') || lower.endsWith('.gmstudio.json')) {
            try {
              const fileObj: File = await (entry as FileSystemFileHandle).getFile();
              files.push({
                name: entry.name,
                size: fileObj.size,
                lastModified: fileObj.lastModified,
                getFile: () => (entry as FileSystemFileHandle).getFile()
              });
            } catch (e) {
              console.warn('Error leyendo archivo en disco:', entry.name, e);
            }
          }
        }
      }
    } else if (typeof (handle as any).entries === 'function') {
      for await (const [name, entry] of (handle as any).entries()) {
        if (entry.kind === 'file') {
          const lower = name.toLowerCase();
          if (lower.endsWith('.json') || lower.endsWith('.gmstudio.json')) {
            try {
              const fileObj: File = await (entry as FileSystemFileHandle).getFile();
              files.push({
                name,
                size: fileObj.size,
                lastModified: fileObj.lastModified,
                getFile: () => (entry as FileSystemFileHandle).getFile()
              });
            } catch (e) {
              console.warn('Error leyendo archivo en disco:', name, e);
            }
          }
        }
      }
    }

    // Ordenar del más recientemente modificado al más antiguo
    files.sort((a, b) => b.lastModified - a.lastModified);
    return { ok: true, files };
  } catch (err: any) {
    console.warn('Error listando archivos de carpeta en disco:', err);
    return { ok: false, files: [], error: err?.message || 'No se pudieron listar los archivos de la carpeta.' };
  }
}

