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

export function borrarMesa(projectId: string): void {
  try {
    localStorage.removeItem(CLAVE_MESA + projectId);
  } catch {
    /* nada que hacer */
  }
}
