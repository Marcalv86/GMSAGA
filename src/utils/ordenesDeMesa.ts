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
  /** Frases tachadas del bloque de memoria general. */
  frasesDeMemoria: string[];
}

const vacio = (): LoOlvidado => ({
  notas: [],
  entradasDeDiario: [],
  hitos: [],
  personajes: [],
  frasesDeMemoria: []
});

/**
 * Tacha del bloque de memoria general las FRASES que hablen de algo.
 *
 * Es la pieza que faltaba para que «olvida que desembarcamos en Luskan»
 * sirviera de verdad. La memoria general viaja entera en cada turno de
 * partida, así que mientras esa frase siguiera ahí el Narrador volvía a
 * plantar la escena en el muelle por mucho que se corrigiera el diario, se
 * borrara el chat o se lo dijera la jugadora tres veces.
 *
 * Trabaja por FRASES, no por bloques: se quita la oración que lo menciona y el
 * resto de la memoria se queda intacto. Y nunca vacía el bloque entero — si
 * después de tachar no quedara nada, se deja como estaba: una memoria en
 * blanco es mucho peor que una memoria con una frase de más.
 */
function tacharDeLaMemoria(texto: string | undefined, orden: string): { texto: string; fuera: string[] } {
  const original = texto || '';
  if (!original.trim()) return { texto: original, fuera: [] };
  const clave = normalizar(orden);
  if (clave.length < 6) return { texto: original, fuera: [] };

  const fuera: string[] = [];
  const lineas = original.split('\n').map(linea => {
    // Una línea de lista o un encabezado se juega entero; la prosa, por frases.
    const esLista = /^\s*([-*•]|\d+[.)])\s/.test(linea) || /^\s*#{1,6}\s/.test(linea);
    if (esLista) {
      if (normalizar(linea).includes(clave)) {
        fuera.push(linea.trim().slice(0, 120));
        return null;
      }
      return linea;
    }
    const frases = linea.split(/(?<=[.!?…])\s+/);
    const quedan = frases.filter(f => {
      if (f.trim() && normalizar(f).includes(clave)) {
        fuera.push(f.trim().slice(0, 120));
        return false;
      }
      return true;
    });
    return quedan.join(' ');
  });

  if (!fuera.length) return { texto: original, fuera: [] };
  const limpio = lineas
    .filter(l => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // El seguro: tachar no puede dejar la campaña sin memoria.
  if (!limpio) return { texto: original, fuera: [] };
  return { texto: limpio, fuera };
}

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
     * 4. Personajes: por nombre exacto o sin prefijos comunes ("el pnj", "ficha de", "a", etc.).
     *
     * Aquí no vale la coincidencia parcial que se usa arriba: borrar una nota
     * de más se repone escribiéndola otra vez, pero una ficha de personaje se
     * lleva por delante su historia, sus vínculos y sus secretos.
     */
    const npcs = mem.npcs || [];
    const ordenLimpia = normalizar(orden)
      .replace(/^(el|la|los|las)\s+/g, '')
      .replace(/^(pnj|npc|personaje|ficha\s+de|la\s+ficha\s+de|al\s+pnj|a\s+la\s+pnj|al\s+npc|al|a)\s+/g, '')
      .replace(/^(el|la)\s+/g, '')
      .trim();

    const coincideNpc = (n: NPC) => {
      const nom = normalizar(n.name);
      const alias = normalizar(n.alias || '');
      const trueId = normalizar(n.trueIdentity || '');
      const ord = normalizar(orden);
      return (
        nom === ord ||
        nom === ordenLimpia ||
        (alias && (alias === ord || alias === ordenLimpia)) ||
        (trueId && (trueId === ord || trueId === ordenLimpia))
      );
    };

    const fuera = npcs.filter(coincideNpc);
    if (fuera.length) {
      quitado.personajes.push(...fuera.map(n => n.name));
      mem.npcs = npcs.filter(n => !coincideNpc(n));
      // Y se veta el nombre, o la siguiente sincronización lo vuelve a fichar.
      const vetados = new Set([...(mem.no_son_pnj || []), ...fuera.map(n => n.name)]);
      mem.no_son_pnj = [...vetados];
    }

    /*
     * 5. El bloque de memoria general, que es el que de verdad manda.
     *
     * Iba sin goma, y era el único de los cinco que viaja ENTERO en cada turno
     * de partida. Por eso una escena desmentida seguía dirigiendo la campaña
     * desde ahí dentro aunque se hubiera limpiado todo lo demás.
     */
    const tachado = tacharDeLaMemoria(mem.raw_project_memory, orden);
    if (tachado.fuera.length) {
      mem.raw_project_memory = tachado.texto;
      quitado.frasesDeMemoria.push(...tachado.fuera);
    }
  }

  return { memoria: mem, timeline: linea, quitado };
}

/** Si no se quitó nada, no hace falta tocar la campaña ni decir nada. */
export function nadaQueOlvidar(q: LoOlvidado): boolean {
  return (
    !q.notas.length &&
    !q.entradasDeDiario.length &&
    !q.hitos.length &&
    !q.personajes.length &&
    !q.frasesDeMemoria.length
  );
}

/** Lo quitado, en una línea por familia, para enseñárselo a la jugadora. */
export function resumirOlvidos(q: LoOlvidado): string[] {
  const partes: string[] = [];
  if (q.notas.length) partes.push(`${q.notas.length} nota(s) de memoria`);
  if (q.entradasDeDiario.length) partes.push(`${q.entradasDeDiario.length} entrada(s) del diario`);
  if (q.hitos.length) partes.push(`${q.hitos.length} hito(s)`);
  if (q.personajes.length) partes.push(`la ficha de ${q.personajes.join(', ')}`);
  if (q.frasesDeMemoria.length)
    partes.push(`${q.frasesDeMemoria.length} frase(s) de la memoria general`);
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


/** `[ESTADO: dónde están y cómo están ahora mismo]`. */
/*
 * «Estado» significaba DOS cosas distintas según quién escribiera.
 *
 * Para el Narrador, \`[ESTADO: PG 18/25 | CA 15 | condiciones: ...]\` son los
 * puntos de golpe del personaje. Para el Director, la memoria general de la
 * campaña. Cada tubería tenía su propio lector y por eso nunca ha estallado,
 * pero es una mina con el pie encima: basta que uno escriba en el formato del
 * otro. \`SITUACIÓN\` dice lo mismo sin ambigüedad, y \`ESTADO\` se sigue
 * aceptando para no romper lo que ya está escrito.
 */
const ESTADO_RE = /\[\s*(?:SITUACI[OÓ]N|ESTADO)\s*:\s*([^\]]+)\]/gi;

/** La marca del bloque que gestiona la aplicación dentro de la memoria general. */
const MARCA_ESTADO = '— DÓNDE ESTAMOS AHORA (corregido en la mesa) —';

/**
 * Lee la declaración de estado que hace el Director en la mesa.
 */
export function leerEstado(texto: string): string | null {
  if (!texto || !/ESTADO/i.test(texto)) return null;
  ESTADO_RE.lastIndex = 0;
  let ultimo: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = ESTADO_RE.exec(texto)) !== null) {
    const v = m[1].trim().replace(/\s+/g, ' ');
    if (v.length >= 10) ultimo = v.slice(0, 600);
  }
  return ultimo;
}

/**
 * Escribe ese estado en la memoria general, en un bloque que es SUYO.
 *
 * El Director no reescribe la memoria entera —eso es meterle la mano al
 * cuaderno de la campaña, y una etiqueta mal emitida se llevaría por delante
 * meses de juego—. Mantiene un solo bloque al final, siempre el mismo, que se
 * reemplaza al completo cada vez. Va al final a propósito: es lo último que
 * lee el Narrador de ese bloque, y lo último desmiente a lo anterior.
 *
 * Pasar una cadena vacía retira el bloque y deja la memoria como estaba.
 */
export function fijarEstadoEnMemoria(memoriaBruta: string | undefined, estado: string): string {
  const base = (memoriaBruta || '').split(MARCA_ESTADO)[0].trimEnd();
  if (!estado.trim()) return base;
  return `${base}\n\n${MARCA_ESTADO}\n${estado.trim()}`.trim();
}
