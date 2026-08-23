/**
 * Pide al navegador que NO borre los datos de esta app.
 *
 * Sin esto, IndexedDB es "best effort": el navegador puede desalojar la base
 * cuando anda justo de espacio, y una campaña con retratos y mapas en base64
 * ocupa bastante, lo que la pone antes en esa cola. Con permiso de persistencia
 * los datos solo se borran si la usuaria lo pide expresamente.
 */
export async function requestPersistentStorage(): Promise<{ persisted: boolean; supported: boolean }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { persisted: false, supported: false };
  }
  try {
    const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    if (already) return { persisted: true, supported: true };
    const granted = await navigator.storage.persist();
    return { persisted: granted, supported: true };
  } catch (err) {
    console.warn('No se pudo solicitar almacenamiento persistente:', err);
    return { persisted: false, supported: true };
  }
}

/** Espacio usado y disponible, para avisar antes de quedarse sin sitio. */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

import { ProjectFile, Project, Chat } from '../types';

const DB_NAME = 'gmstudio_app_db';
const FILES_STORE = 'project_files';
const APP_STORE = 'app_data';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Punto ÚNICO de apertura de la base. Cualquier otro módulo que necesite
 * IndexedDB debe llamar aquí: si alguien abre `gmstudio_app_db` por su cuenta
 * sin `onupgradeneeded` y gana la carrera en un navegador nuevo, la base se crea
 * en la versión 2 pero vacía, sin almacenes, y a partir de ahí no se guarda nada.
 */
function createStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(FILES_STORE)) {
    db.createObjectStore(FILES_STORE, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(APP_STORE)) {
    db.createObjectStore(APP_STORE, { keyPath: 'key' });
  }
}

const hasStores = (db: IDBDatabase) =>
  db.objectStoreNames.contains(FILES_STORE) && db.objectStoreNames.contains(APP_STORE);

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      createStores((event.target as IDBOpenDBRequest).result);
    };

    request.onsuccess = () => {
      const db = request.result;
      if (hasStores(db)) {
        resolve(db);
        return;
      }
      // Reparación: una versión anterior podía dejar la base creada en la v2 pero
      // sin almacenes. Así no hay `onupgradeneeded` que valga y nada se guarda
      // nunca. Una base sin almacenes no contiene datos por definición, así que
      // borrarla y rehacerla no pierde nada.
      console.warn('IndexedDB sin almacenes; se recrea la base.');
      db.close();
      const del = indexedDB.deleteDatabase(DB_NAME);
      const retry = () => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = event => createStores((event.target as IDBOpenDBRequest).result);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      };
      del.onsuccess = retry;
      del.onerror = retry;
      del.onblocked = retry;
    };

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Cleans up any bloated legacy keys from localStorage to free up browser quota immediately
 */
export function cleanupLocalStorageQuota(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('gmstudio_local_files_') || key.startsWith('gmstudio_temp_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Also sanitize local projects in localStorage to strip any raw image data URLs
    const projectsRaw = localStorage.getItem('gmstudio_local_projects');
    if (projectsRaw) {
      const projs: Project[] = JSON.parse(projectsRaw);
      const sanitized = sanitizeProjectsForLocalStorage(projs);
      localStorage.setItem('gmstudio_local_projects', JSON.stringify(sanitized));
    }
  } catch (err) {
    console.warn('Cleanup localStorage error:', err);
  }
}

/**
 * Strips heavy data (like huge raw base64 thumbnails or files) before placing into localStorage
 */
export function sanitizeProjectsForLocalStorage(projects: Project[]): Project[] {
  return projects.map(p => ({
    ...p,
    files: [], // Do not keep files array inside project in localStorage
    memory: {
      ...p.memory,
      visual_memory: (p.memory?.visual_memory || []).map(vm => ({
        id: vm.id,
        fileId: vm.fileId,
        fileName: vm.fileName,
        analysis: vm.analysis
        // Omit raw thumbnail base64 from localStorage
      }))
    }
  }));
}

// ---------------- FILES (IndexedDB) ----------------

export async function saveFilesToDB(projectId: string, files: ProjectFile[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const store = tx.objectStore(FILES_STORE);

    store.put({ id: `project_${projectId}`, files });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('IndexedDB save files error:', error);
  }
}

export async function loadFilesFromDB(projectId: string): Promise<ProjectFile[]> {
  try {
    const db = await getDB();
    const tx = db.transaction(FILES_STORE, 'readonly');
    const store = tx.objectStore(FILES_STORE);
    const request = store.get(`project_${projectId}`);

    return new Promise(resolve => {
      request.onsuccess = () => {
        if (request.result && Array.isArray(request.result.files)) {
          resolve(request.result.files);
        } else {
          resolve([]);
        }
      };
      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (error) {
    return [];
  }
}

export async function deleteProjectFilesFromDB(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const store = tx.objectStore(FILES_STORE);
    store.delete(`project_${projectId}`);
  } catch (e) {
    console.error('Error deleting project files from DB:', e);
  }
}

// ---------------- PROJECTS & CHATS BACKUP (IndexedDB) ----------------

export async function saveProjectsToDB(projects: Project[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(APP_STORE, 'readwrite');
    const store = tx.objectStore(APP_STORE);
    store.put({ key: 'projects', data: projects });
  } catch (e) {
    console.error('IndexedDB save projects error:', e);
  }
}

export async function loadProjectsFromDB(): Promise<Project[] | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(APP_STORE, 'readonly');
    const store = tx.objectStore(APP_STORE);
    const request = store.get('projects');

    return new Promise(resolve => {
      request.onsuccess = () => {
        if (request.result && Array.isArray(request.result.data)) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function saveChatsToDB(projectId: string, chats: Chat[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(APP_STORE, 'readwrite');
    const store = tx.objectStore(APP_STORE);
    store.put({ key: `chats_${projectId}`, data: chats });
  } catch (e) {
    console.error('IndexedDB save chats error:', e);
  }
}

export async function loadChatsFromDB(projectId: string): Promise<Chat[] | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(APP_STORE, 'readonly');
    const store = tx.objectStore(APP_STORE);
    const request = store.get(`chats_${projectId}`);

    return new Promise(resolve => {
      request.onsuccess = () => {
        if (request.result && Array.isArray(request.result.data)) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Optimizes/downscales an image to prevent massive base64 strings while keeping high detail
 */
export async function optimizeImageFile(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(file.type.startsWith('image/png') ? 'image/png' : 'image/jpeg', 0.85));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => resolve(event.target?.result as string);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      console.error('No se pudo leer la imagen:', file.name, reader.error);
      resolve('');
    };
    reader.readAsDataURL(file);
  });
}
