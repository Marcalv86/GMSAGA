import { Memory, NPC, TimelineEntry } from '../types';

/**
 * Lo que el Director puede DESHACER desde el chat de mesa.
 *
 * Hasta aquí su cuaderno solo escribía hacia delante: sabía apuntar en la
 * memoria y plantar un giro, y nada más. Así que cuando algo quedaba mal —una
 * escena que ya no ocurrió, un hito que sobra, alguien fichado como personaje
 * sin serlo— la única salida era que la jugadora entrara a la pantalla de
 * Memoria y lo borrase a mano.
 *
 * Y eso es justo lo que no debe pasar: en una mesa de verdad nadie le abre el
 * cuaderno al Director y le tacha cosas. Se le dice, y él corrige si lo ve
 * razonable. Para que esa conversación sirva de algo, el Director necesita
 * poder borrar; esta es su goma.
 */

/** `[OLVIDA: lo que hay que quitar]`, una por línea. */
const OLVIDA_RE = /\[\s*OLVIDA\s*:\s*([^\]]+)\]/gi;

const normalizar = (t: string) =>
  (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Lee las órdenes de olvido de una respuesta del Director.
 *
 * Se exige algo de longitud a propósito: un «OLVIDA: el» borraría media
 * campaña por coincidencia de subcadena.
 */
export function leerOlvidos(texto: string): string[] {
  if (!texto || !/OLVIDA/i.test(texto)) return [];
  OLVIDA_RE.lastIndex = 0;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = OLVIDA_RE.exec(texto)) !== null) {
    const orden = m[1].trim().replace(/\s+/g, ' ');
    if (normalizar(orden).length >= 6 && orden.length <= 200 && !out.includes(orden)) {
      out.push(orden);
    }
  }
  return out;
}

export interface LoOlvidado {
  notas: string[];
  entradasDeDiario: string[];
  hitos: string[];
  personajes: string[];
}

const vacio = (): LoOlvidado => ({ notas: [], entradasDeDiario: [], hitos: [], personajes: [] });

/** Si el texto de una ficha cae dentro de lo que se manda olvidar, o al revés. */
const coincide = (candidato: string | undefined, orden: string) => {
  const a = normalizar(candidato || '');
  const b = normalizar(orden);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
};

/**
 * Aplica los olvidos sobre la memoria y la cronología.
 *
 * Devuelve también QUÉ se ha quitado, y eso no es un detalle: el Director tiene
 * que poder decir en voz alta lo que ha borrado. Una goma silenciosa es peor
 * que no tener goma — nadie puede comprobar lo que desapareció.
 */
export function aplicarOlvidos(
  memoria: Memory | undefined,
  timeline: TimelineEntry[] | undefined,
  ordenes: string[]
): { memoria: Memory; timeline: TimelineEntry[]; quitado: LoOlvidado } {
  const mem: Memory = { ...(memoria || ({} as Memory)) };
  let linea = [...(timeline || [])];
  const quitado = vacio();
  if (!ordenes.length) return { memoria: mem, timeline: linea, quitado };

  for (const orden of ordenes) {
    // 1. Notas de memoria.
    const notas = mem.memory_edits || [];
    const notasFuera = notas.filter(n => coincide(n.text, orden));
    if (notasFuera.length) {
      quitado.notas.push(...notasFuera.map(n => n.text));
      mem.memory_edits = notas.filter(n => !coincide(n.text, orden));
    }

    // 2. Entradas del diario y de la cronología.
    const entradasFuera = linea.filter(
      e => coincide(e.title, orden) || coincide(e.hito, orden) || coincide(e.summary, orden)
    );
    if (entradasFuera.length) {
      quitado.entradasDeDiario.push(...entradasFuera.map(e => e.title || e.hito || e.summary || 'entrada'));
      const ids = new Set(entradasFuera.map(e => e.id));
      linea = linea.filter(e => !ids.has(e.id));
    }

    // 3. Hitos del protagonista.
    const pc = mem.player_character;
    const hitos = pc?.events || [];
    const hitosFuera = hitos.filter(h => coincide(h.title, orden) || coincide(h.description, orden));
    if (hitosFuera.length && pc) {
      quitado.hitos.push(...hitosFuera.map(h => h.title));
      mem.player_character = { ...pc, events: hitos.filter(h => !hitosFuera.includes(h)) };
    }

    /*
     * 4. Personajes: solo por nombre EXACTO.
     *
     * Aquí no vale la coincidencia parcial que se usa arriba: borrar una nota
     * de más se repone escribiéndola otra vez, pero una ficha de personaje se
     * lleva por delante su historia, sus vínculos y sus secretos. Un «olvida a
     * Ser» no puede cargarse a Serena.
     */
    const npcs = mem.npcs || [];
    const fuera = npcs.filter((n: NPC) => normalizar(n.name) === normalizar(orden));
    if (fuera.length) {
      quitado.personajes.push(...fuera.map(n => n.name));
      mem.npcs = npcs.filter((n: NPC) => normalizar(n.name) !== normalizar(orden));
      // Y se veta el nombre, o la siguiente sincronización lo vuelve a fichar.
      const vetados = new Set([...(mem.no_son_pnj || []), ...fuera.map(n => n.name)]);
      mem.no_son_pnj = [...vetados];
    }
  }

  return { memoria: mem, timeline: linea, quitado };
}

/** Si no se quitó nada, no hace falta tocar la campaña ni decir nada. */
export function nadaQueOlvidar(q: LoOlvidado): boolean {
  return !q.notas.length && !q.entradasDeDiario.length && !q.hitos.length && !q.personajes.length;
}

/** Lo quitado, en una línea por familia, para enseñárselo a la jugadora. */
export function resumirOlvidos(q: LoOlvidado): string[] {
  const partes: string[] = [];
  if (q.notas.length) partes.push(`${q.notas.length} nota(s) de memoria`);
  if (q.entradasDeDiario.length) partes.push(`${q.entradasDeDiario.length} entrada(s) del diario`);
  if (q.hitos.length) partes.push(`${q.hitos.length} hito(s)`);
  if (q.personajes.length) partes.push(`la ficha de ${q.personajes.join(', ')}`);
  return partes;
}

/* ------------------------------------------------- etiquetas de búsqueda */

/**
 * `[ETIQUETA: nombre del archivo | términos, separados, por, comas]`
 *
 * El etiquetador automático lee el documento y deduce por qué buscarlo, pero
 * hay puentes que solo sabe tender quien conoce la biblioteca: que la cantera
 * de Menzoberranzan explica a Jarlaxle es evidente para el Director de la mesa
 * y no tiene por qué serlo para un modelo que solo ha visto ese archivo.
 *
 * Con esto se le dice hablando: «encontrarás información de Jarlaxle en Bregan
 * D'aerthe, Menzoberranzan y Waterdeep», y él emite una etiqueta por cada
 * documento. Es la misma operación en los dos sentidos —de documento a
 * términos, o de término a documentos— porque al final es la misma tabla.
 */
const ETIQUETA_RE = /\[\s*ETIQUETA\s*:\s*([^|\]]+)\|\s*([^\]]+)\]/gi;

export interface OrdenDeEtiquetado {
  /** Lo que dijo el Director: un trozo reconocible del nombre, no el nombre exacto. */
  archivo: string;
  terminos: string[];
}

export function leerEtiquetados(texto: string): OrdenDeEtiquetado[] {
  if (!texto || !/ETIQUETA/i.test(texto)) return [];
  ETIQUETA_RE.lastIndex = 0;
  const out: OrdenDeEtiquetado[] = [];
  let m: RegExpExecArray | null;
  while ((m = ETIQUETA_RE.exec(texto)) !== null) {
    const archivo = m[1].trim().replace(/\s+/g, ' ');
    const terminos = m[2]
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length >= 3 && t.length <= 60);
    // Un nombre de archivo demasiado corto casaría con media biblioteca.
    if (normalizar(archivo).length >= 4 && terminos.length) {
      out.push({ archivo, terminos });
    }
  }
  return out;
}

export interface EtiquetadoAplicado {
  archivo: string;
  anadidos: string[];
}

/**
 * Cuela las etiquetas nuevas en los archivos que toque.
 *
 * SE SUMAN, NUNCA SE SUSTITUYEN. Lo que hay puesto puede venir del etiquetador
 * automático o de otra conversación, y perderlo por añadir un nombre sería el
 * peor intercambio posible: se arregla un puente y se tiran veinte.
 *
 * El nombre del archivo se busca por coincidencia laxa a propósito: en el chat
 * se dice «Bregan D'aerthe», no «COMPENDIO Mundo Bregan Daerthe (Jax, PNJs,
 * Jarlaxle, Luskan).md». Si una orden casa con varios archivos se aplica a
 * todos, que es lo que se ha pedido cuando se nombra una colección.
 */
export function aplicarEtiquetados<T extends { name: string; etiquetasBusqueda?: string }>(
  archivos: T[],
  ordenes: OrdenDeEtiquetado[]
): { archivos: T[]; aplicado: EtiquetadoAplicado[] } {
  if (!ordenes.length) return { archivos, aplicado: [] };

  const aplicado: EtiquetadoAplicado[] = [];
  const salida = archivos.map(f => {
    const pedidos = ordenes.filter(o => coincide(f.name, o.archivo));
    if (!pedidos.length) return f;

    const yaPuestas = (f.etiquetasBusqueda || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const vistos = new Set(yaPuestas.map(normalizar));
    const anadidos: string[] = [];

    for (const o of pedidos) {
      for (const t of o.terminos) {
        const n = normalizar(t);
        if (!n || vistos.has(n)) continue;
        vistos.add(n);
        anadidos.push(t);
      }
    }

    if (!anadidos.length) return f;
    aplicado.push({ archivo: f.name, anadidos });
    return { ...f, etiquetasBusqueda: [...yaPuestas, ...anadidos].join(', ') };
  });

  return { archivos: salida, aplicado };
}
