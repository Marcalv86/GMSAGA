/**
 * Dónde vive la charla de mesa (la conversación OOC con el Director).
 *
 * Estaba dentro del componente que la pinta, y por eso se quedó fuera de las
 * copias de seguridad: `diskBackup` no puede importar un .tsx sin arrastrar
 * React entero, así que nadie más que la pantalla sabía que estos mensajes
 * existían. Sacarlo aquí es lo que permite que la copia de la campaña se los
 * lleve con todo lo demás.
 */

export interface MensajeDeMesa {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
  /** Si fue una reacción espontánea del DM a lo ocurrido en un turno de juego. */
  origen?: 'escena' | 'charla';
  /** Lo que el Director apuntó en la memoria en ese mensaje, para poder verlo. */
  memorias?: string[];
  /**
   * Miniaturas de lo que se adjuntó, en `data:` para poder repintarlas.
   *
   * Se guardan reducidas a propósito: la conversación vive en localStorage y
   * una foto de móvil a tamaño completo se come el sitio de la campaña entera.
   */
  adjuntos?: string[];
  /**
   * Lo que costó el turno en fichas de entrada, cuando se sabe.
   *
   * Se guarda con el mensaje para que la cuenta siga ahí mañana: mandar un
   * vídeo es la única cosa de esta pantalla que puede costar de verdad, y
   * conviene poder mirar atrás y ver cuál fue el caro.
   */
  fichasDeEntrada?: number;
  /** Si el Director vio un vídeo en ese mensaje, y qué tramo. */
  videoVisto?: string;
  /** Giros que guardó como secretos de campaña en ese mensaje. */
  secretos?: string[];
}

const CLAVE_MESA = 'gmstudio_mesa_';
const CLAVE_MESA_LEIDA = 'gmstudio_mesa_leida_';
/**
 * Un tope generoso pero real. La conversación de mesa vive en localStorage
 * junto a todo lo demás, y una charla sin fin acabaría compitiendo por el sitio
 * con la campaña, que es lo que de verdad no se puede perder.
 */
export const TOPE_MENSAJES = 200;

export function leerMesa(projectId: string): MensajeDeMesa[] {
  try {
    const raw = localStorage.getItem(CLAVE_MESA + projectId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function guardarMesa(projectId: string, mensajes: MensajeDeMesa[]): void {
  try {
    localStorage.setItem(CLAVE_MESA + projectId, JSON.stringify(mensajes.slice(-TOPE_MENSAJES)));
  } catch {
    // Sin sitio: la charla de mesa no vale romper nada.
  }
}

export function marcarMesaLeida(projectId: string): void {
  try {
    localStorage.setItem(CLAVE_MESA_LEIDA + projectId, Date.now().toString());
  } catch {
    /* nada que hacer */
  }
}

export function hayMensajesSinLeerEnMesa(projectId: string): boolean {
  try {
    const rawLeida = localStorage.getItem(CLAVE_MESA_LEIDA + projectId);
    const ultimaLeida = rawLeida ? parseInt(rawLeida, 10) : 0;
    const msgs = leerMesa(projectId);
    if (!msgs || msgs.length === 0) return false;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === 'model') {
        const msgTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
        if (msgTime > ultimaLeida) return true;
        if (!m.timestamp && ultimaLeida === 0) return true;
        if (msgTime <= ultimaLeida && msgTime > 0) break;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function contarMensajesSinLeerEnMesa(projectId: string): number {
  try {
    const rawLeida = localStorage.getItem(CLAVE_MESA_LEIDA + projectId);
    const ultimaLeida = rawLeida ? parseInt(rawLeida, 10) : 0;
    const msgs = leerMesa(projectId);
    if (!msgs || msgs.length === 0) return 0;
    let count = 0;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === 'model') {
        const msgTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
        if (msgTime > ultimaLeida) {
          count++;
        } else if (msgTime <= ultimaLeida && msgTime > 0) {
          break;
        }
      }
    }
    return count;
  } catch {
    return 0;
  }
}

export function borrarMesa(projectId: string): void {
  try {
    localStorage.removeItem(CLAVE_MESA + projectId);
    localStorage.removeItem(CLAVE_MESA_LEIDA + projectId);
  } catch {
    /* nada que hacer */
  }
}

/**
 * Con qué modelo contesta el Director en esta pestaña.
 *
 * Va aparte del modelo de narración y del de tareas de fondo porque no hace
 * ninguna de las dos cosas: aquí no se narra —así que no importa la prosa— y
 * las preguntas son de las más exigentes de la aplicación, con toda la campaña
 * delante. Que herede el modelo «de fondo», que es el más barato de la lista,
 * era un accidente de cómo se montó, no una decisión.
 */
const CLAVE_MODELO_MESA = 'gmstudio_mesa_modelo';

export function leerModeloDeMesa(): string {
  try {
    return localStorage.getItem(CLAVE_MODELO_MESA)?.trim() || '';
  } catch {
    return '';
  }
}

export function guardarModeloDeMesa(id: string): void {
  try {
    if (id.trim()) localStorage.setItem(CLAVE_MODELO_MESA, id.trim());
    else localStorage.removeItem(CLAVE_MODELO_MESA);
  } catch {
    /* sin sitio: se seguirá usando el de fondo */
  }
}
