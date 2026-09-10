/**
 * Enlaces de YouTube: reconocerlos y saber qué le cuesta mandarlos.
 *
 * Vive aparte porque hasta ahora había dos verdades distintas sobre un mismo
 * enlace: la interfaz sabía reconocerlo para pintar el reproductor, y el modelo
 * recibía la URL como texto plano y se inventaba lo que había dentro. Ahora el
 * mismo enlace se reconoce una sola vez y viaja de verdad.
 */

/**
 * Reconoce las formas habituales de un enlace de YouTube.
 *
 * El identificador de un vídeo son siempre once caracteres; anclarlo a esa
 * longitud evita tragarse medio párrafo cuando alguien pega una URL con cola de
 * parámetros.
 */
const ENLACE_YOUTUBE =
  /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/g;

export interface VideoDeYouTube {
  /** Los once caracteres que identifican el vídeo. */
  id: string;
  /** URL canónica, que es la que entiende la API. */
  url: string;
}

/** Saca los vídeos de un texto, sin repetidos y en el orden en que aparecen. */
export function leerEnlacesDeYouTube(texto?: string): VideoDeYouTube[] {
  if (!texto || !/youtu/i.test(texto)) return [];
  ENLACE_YOUTUBE.lastIndex = 0;
  const vistos = new Set<string>();
  const out: VideoDeYouTube[] = [];
  let m: RegExpExecArray | null;
  while ((m = ENLACE_YOUTUBE.exec(texto)) !== null) {
    const id = m[1];
    if (vistos.has(id)) continue;
    vistos.add(id);
    out.push({ id, url: `https://www.youtube.com/watch?v=${id}` });
  }
  return out;
}

/**
 * Cuánto del vídeo se manda.
 *
 * No es un capricho de configuración: un vídeo largo se cobra por segundo, y
 * con una cuota gratuita un documental de dos horas se lleva por delante el
 * minuto entero. El recorte por defecto existe para que mandar un enlace sea
 * una decisión barata y no una ruleta.
 */
export type TramoDeVideo = 'corto' | 'medio' | 'entero';

export interface OpcionesDeTramo {
  segundos: number | null;
  etiqueta: string;
  descripcion: string;
}

export const TRAMOS_DE_VIDEO: Record<TramoDeVideo, OpcionesDeTramo> = {
  corto: {
    segundos: 5 * 60,
    etiqueta: 'Primeros 5 min',
    descripcion: 'Lo justo para pillar de qué va. Lo más barato.'
  },
  medio: {
    segundos: 15 * 60,
    etiqueta: 'Primeros 15 min',
    descripcion: 'Un vídeo de lore normal entero, o el grueso de uno largo.'
  },
  entero: {
    segundos: null,
    etiqueta: 'Vídeo entero',
    descripcion: 'Sin recorte. Cuidado con los vídeos de más de media hora.'
  }
};

/**
 * Coste aproximado, en fichas, de un segundo de vídeo a resolución baja.
 *
 * Gemini muestrea un fotograma por segundo y le suma el audio. A resolución
 * baja el fotograma sale por unas 66 fichas y el audio por unas 32. Es una
 * estimación de la documentación, no una medida: por eso, cuando llega la
 * respuesta, se enseña además lo que costó DE VERDAD.
 */
export const FICHAS_POR_SEGUNDO_DE_VIDEO = 100;

/** Estimación en fichas de mandar un tramo. `null` = sin recorte, no se sabe. */
export function estimarCosteDeVideo(tramo: TramoDeVideo): number | null {
  const s = TRAMOS_DE_VIDEO[tramo].segundos;
  return s === null ? null : s * FICHAS_POR_SEGUNDO_DE_VIDEO;
}

/** «30.000» en vez de «30000», que a ojo se lee fatal. */
export function conMiles(n: number): string {
  return n.toLocaleString('es-ES');
}
