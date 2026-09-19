import { quitarEtiquetasInternas } from './etiquetasInternas';
/**
 * Peticiones de tirada del Narrador.
 *
 * El Narrador escribe `[Petición de Tirada: Percepción | CD 15]` cuando una acción
 * del protagonista tiene resultado incierto. Aquí las localizamos para pintarlas
 * como un aviso con botón en vez de dejarlas como texto suelto en mitad del relato.
 */

export interface RollRequest {
  /** Habilidad o característica pedida, tal cual la escribió el Narrador. */
  skill: string;
  /** Clase de dificultad, si la indicó. */
  dc?: number;
  /** El texto original completo, para poder recortarlo del cuerpo del mensaje. */
  raw: string;
}

/**
 * Acepta variantes con y sin tilde, con «CD», «DC» o «Dificultad», con «|», «-», «,» o entre paréntesis,
 * con 'Petición de Tirada', 'Petición de Salvación' o 'Tirada requerida'.
 */
const ROLL_REQUEST_RE =
  /(?:\*{1,2})?\[\s*(?:petici[oó]n\s+de\s+(?:tirada|salvaci[oó]n)|tirada\s+requerida)\s*:\s*([^\]]+)\](?:\*{1,2})?/gi;

export function parseRollRequests(text: string): RollRequest[] {
  if (!text || (!text.toLowerCase().includes('tirada') && !text.toLowerCase().includes('salvaci'))) return [];
  const out: RollRequest[] = [];
  const seen = new Set<string>();
  ROLL_REQUEST_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ROLL_REQUEST_RE.exec(text)) !== null) {
    const rawContent = (match[1] || '').trim();
    if (!rawContent) continue;

    let dc: number | undefined = undefined;
    const cdMatch = rawContent.match(/(?:cd|dc|dificultad)\s*[:=]?\s*(\d{1,3})/i);
    if (cdMatch) {
      dc = Number(cdMatch[1]);
    }

    const key = rawContent.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      skill: rawContent,
      dc,
      raw: match[0]
    });
  }
  return out;
}

/** Quita las peticiones del cuerpo del mensaje: se pintan aparte, con su botón. */
export function stripRollRequests(text: string): string {
  if (!text) return text;
  ROLL_REQUEST_RE.lastIndex = 0;
  return text
    .replace(ROLL_REQUEST_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * El registro de estado y todas las etiquetas técnicas se recortan al guardar el mensaje,
 * pero un mensaje editado a mano o venido de una importación puede traerlo. Limpiar también
 * al pintar sale gratis y evita que se cuele cualquier etiqueta en mitad del relato.
 */
/**
 * ⛔ LAS PREGUNTAS DEL NARRADOR SE BORRABAN ANTES DE ENSEÑARLAS.
 *
 * `[Pregunta de Mesa: ...]` es la vía por la que el Director pregunta en vez de
 * inventarse un dato: qué arranque se juega, qué encuentra un PNJ en el diario,
 * cómo ayuda exactamente la protagonista. Está documentada por todo el envío y
 * el Narrador la usa.
 *
 * Y `stripStateTag` la BORRABA del texto antes de pintarlo. Así que el Narrador
 * preguntaba, la aplicación se tragaba la pregunta, y a la jugadora le llegaba
 * una escena que se paraba sin decir por qué. La aplicación callándose justo
 * donde tenía que gritar, otra vez.
 *
 * Se siguen quitando de la prosa —para que no salgan como un corchete suelto en
 * mitad del párrafo— pero ahora se recogen antes y se pintan aparte.
 */
export function parsePreguntasDeMesa(text: string): string[] {
  if (!text) return [];
  const fuera: string[] = [];
  for (const m of text.matchAll(/\[\s*Pregunta\s+de\s+Mesa\s*:([^\]]*)\]/gi)) {
    const cuerpo = (m[1] || '').trim();
    if (cuerpo) fuera.push(cuerpo);
  }
  return fuera;
}

export function stripStateTag(text: string): string {
  if (!text) return '';
  return quitarEtiquetasInternas(text)
    .replace(/\[\s*Pregunta\s+de\s+Mesa\s*:[^\]]*\]/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Un dado de verdad: azar criptográfico, no `Math.random`. */
export function rollDie(sides: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / sides) * sides;
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return (value % sides) + 1;
}

/**
 * El texto que se manda al Narrador. Enviamos el d20 **natural**: los modificadores
 * los aplica él, que es quien tiene la ficha delante y sabe si hay competencia,
 * ventaja o una condición encima.
 */
export function formatRollResult(req: RollRequest, natural: number): string {
  const dc = req.dc ? ` | CD ${req.dc}` : '';
  return `[Tirada de ${req.skill}: d20 natural = ${natural}${dc}]`;
}
