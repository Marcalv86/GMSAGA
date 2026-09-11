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
