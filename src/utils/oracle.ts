import { rollDie } from "./rollRequests";

/**
 * El oráculo: la parte del juego en solitario que la IA no debe decidir.
 *
 * Un modelo de lenguaje preguntado «¿el capitán está mintiendo?» contesta lo que
 * mejor le encaja a la escena, y eso convierte una partida en solitario en una
 * novela escrita contigo misma de público. Un d100 contra una probabilidad que
 * has fijado TÚ no tiene ese sesgo: puede decirte que no cuando los dos queríais
 * un sí, y ahí es donde aparece la historia que no habías planeado.
 *
 * Por eso el reparto de papeles es estricto: la jugadora fija la probabilidad, la
 * aplicación tira el dado, y el Narrador solo lee la tabla e interpreta. Las
 * tablas viven en el documento que suba la jugadora, no aquí dentro: así esto
 * sirve para cualquier oráculo y no se hace copia de ninguno.
 */

/**
 * Nueve escalones simétricos, que es la forma habitual de estas tablas. Son
 * etiquetas genéricas: la traducción a números la pone el documento de cada cual.
 */
export const PROBABILIDADES = [
  "Seguro",
  "Casi seguro",
  "Muy probable",
  "Probable",
  "50/50 o no se sabe",
  "Poco probable",
  "Muy poco probable",
  "Casi imposible",
  "Imposible",
] as const;

export type Probabilidad = (typeof PROBABILIDADES)[number] | string;

export const PROBABILIDAD_POR_DEFECTO: Probabilidad = "50/50 o no se sabe";

/**
 * Dígitos repetidos: 11, 22, 33… En varios oráculos eso dispara un suceso
 * inesperado. Aquí solo se detecta y se anota; qué significa lo dice la tabla de
 * la jugadora, no nosotros.
 */
export function esDoble(n: number): boolean {
  return n >= 11 && n <= 99 && n % 11 === 0;
}

export function tirarD100(): number {
  return rollDie(100);
}

export interface ConsultaOraculo {
  pregunta: string;
  probabilidad: Probabilidad;
  resultado: number;
  doble: boolean;
}

export function nuevaConsulta(
  pregunta: string,
  probabilidad: Probabilidad,
): ConsultaOraculo {
  const resultado = tirarD100();
  return {
    pregunta: pregunta.trim(),
    probabilidad,
    resultado,
    doble: esDoble(resultado),
  };
}

/** Lo que se manda al Narrador. El dado ya está tirado: él solo lo lee. */
export function formatoConsulta(c: ConsultaOraculo): string {
  const doble = c.doble ? " | DÍGITOS REPETIDOS" : "";
  return `[Oráculo — «${c.pregunta}» | probabilidad: ${c.probabilidad} | d100 = ${c.resultado}${doble}]`;
}

/** Dos tiradas para las tablas de significado: acción y descripción. */
export function formatoSignificado(): string {
  const a = tirarD100();
  const b = tirarD100();
  return `[Oráculo — descubrir significado | d100 = ${a} y ${b}]`;
}

// ---------------------------------------------------------------- invitaciones

/**
 * El Narrador puede dejar caer `[Oráculo?: ¿el capitán miente?]` al final de su
 * turno. No se muestra como texto: la aplicación lo convierte en un botón
 * discreto bajo la escena, para que la prosa siga siendo prosa y la mecánica no
 * se meta en medio de la ficción.
 */
const INVITACION_RE = /\[\s*or[aá]culo\s*\?\s*:\s*([^\]]+)\]/gi;

export function leerInvitaciones(texto: string): string[] {
  // Atajo: la inmensa mayoría de los mensajes no llevan ninguna.
  if (!texto || !/or[aá]culo/i.test(texto)) return [];
  INVITACION_RE.lastIndex = 0;
  const out: string[] = [];
  const vistas = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = INVITACION_RE.exec(texto)) !== null) {
    const p = m[1].trim();
    if (!p) continue;
    const clave = p.toLowerCase();
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(p);
  }
  return out;
}

export function limpiarInvitaciones(texto: string): string {
  if (!texto || !/or[aá]culo/i.test(texto)) return texto;
  INVITACION_RE.lastIndex = 0;
  return texto
    .replace(INVITACION_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
