import { Aprendizaje, TipoDeAprendizaje } from '../types';

/**
 * Lo que se gana al subir de nivel, que no lo llevaba nadie.
 *
 * La aplicación sabía el NÚMERO de nivel —`[NIVEL: 4]` lo escribe y pone los
 * hitos a cero— y ahí se acababa. Los conjuros nuevos, los espacios, los
 * rasgos de clase, las competencias y las mejoras de característica no
 * constaban en ninguna parte: solo estaban en la ficha subida, congelados en
 * el nivel al que se subió el archivo.
 *
 * El resultado es un personaje de nivel 5 jugando con la lista de conjuros del
 * 3, sin que ni la jugadora ni el Narrador se enteren, porque en ningún sitio
 * consta que falte algo. Esto lo apunta según pasa, igual que la mochila.
 */

/** `[APRENDE: ...]`, con o sin tildes y en cualquier caja. */
const APRENDE_RE = /\[\s*APRENDE\s*:\s*([^\]]*)\]/gi;

/** Cómo nombra el Narrador cada clase de cosa aprendida. */
const TIPOS: { patron: RegExp; tipo: TipoDeAprendizaje }[] = [
  { patron: /^(?:conjuro|hechizo|truco|cantrip|sortilegio|poder)s?$/i, tipo: 'conjuro' },
  { patron: /^(?:rasgo|dote|talento|aptitud|feat|habilidad de clase)s?$/i, tipo: 'rasgo' },
  { patron: /^(?:competencia|pericia|proficiencia|idioma|lengua|herramienta)s?$/i, tipo: 'competencia' },
  { patron: /^(?:mejora|caracteristica|atributo|asi|subida)s?$/i, tipo: 'mejora' }
];

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');

const tipoDe = (texto?: string): TipoDeAprendizaje | undefined =>
  texto ? TIPOS.find(t => t.patron.test(sinTildes(texto).trim()))?.tipo : undefined;

/**
 * Parte la lista por comas de fuera de paréntesis.
 *
 * Un conjuro trae su tipo y sus notas entre paréntesis —«(conjuro, nivel 2)»—
 * y partir a lo bruto lo convertía en dos entradas rotas.
 */
function partirPorComas(lista: string): string[] {
  const trozos: string[] = [];
  let actual = '';
  let dentro = 0;
  for (const ch of lista) {
    if (ch === '(') dentro++;
    else if (ch === ')') dentro = Math.max(0, dentro - 1);
    if (ch === ',' && dentro === 0) {
      trozos.push(actual);
      actual = '';
    } else {
      actual += ch;
    }
  }
  trozos.push(actual);
  return trozos;
}

/**
 * Lee `[APRENDE: +Rayo de escarcha (conjuro, nivel 1), +Sentido salvaje (rasgo)]`.
 *
 * El `+` es opcional: aquí solo se suma, porque aprender algo no se deshace
 * solo. Lo que se pierde de verdad —una maldición que le quita un rasgo— se
 * corrige hablando con el Director, que para eso está.
 */
export function leerAprendizajes(texto: string, nivel?: string): Aprendizaje[] {
  if (!texto || !/APRENDE/i.test(texto)) return [];

  const leidos: Aprendizaje[] = [];
  APRENDE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = APRENDE_RE.exec(texto)) !== null) {
    for (const trozo of partirPorComas(m[1])) {
      let resto = trozo.trim().replace(/^[+-]\s*/, '').trim();
      if (!resto) continue;
      // «1 Rayo de escarcha» → el número sobra: no se aprende dos veces.
      resto = resto.replace(/^\d{1,3}\s+/, '').trim();
      if (!resto) continue;

      let tipo: TipoDeAprendizaje | undefined;
      let notas: string | undefined;
      const conParentesis = resto.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (conParentesis && conParentesis[1].trim()) {
        resto = conParentesis[1].trim();
        const partes = conParentesis[2]
          .split(/[,|]/)
          .map(p => p.trim())
          .filter(Boolean);
        const sueltas: string[] = [];
        for (const parte of partes) {
          const t = tipoDe(parte);
          if (t && !tipo) tipo = t;
          else sueltas.push(parte);
        }
        notas = sueltas.join(', ') || undefined;
      }

      const nombre = resto.slice(0, 140);
      if (!nombre) continue;
      leidos.push({
        id: `apr_${huella(nombre.toLowerCase())}`,
        name: nombre,
        tipo: tipo || 'otro',
        notas,
        nivel: nivel || undefined
      });
    }
  }
  return leidos;
}

/** Huella corta y estable de un nombre, para que aprender lo mismo dos veces no duplique. */
function huella(v: string): string {
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

/** Dos nombres que son la misma cosa escrita de dos maneras. */
const mismaCosa = (a: string, b: string) =>
  sinTildes(a).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ===
  sinTildes(b).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Añade lo aprendido a lo que ya constaba, sin repetir.
 *
 * Si vuelve a salir algo que ya estaba, se completa con lo que traiga de nuevo
 * —el tipo, las notas, el nivel— pero no entra otra vez.
 */
export function aplicarAprendizajes(
  previo: Aprendizaje[] | undefined,
  nuevos: Aprendizaje[],
  diaAbs?: number
): Aprendizaje[] {
  const fuera = [...(previo || [])];
  for (const a of nuevos) {
    const i = fuera.findIndex(x => x && mismaCosa(x.name || '', a.name));
    if (i >= 0) {
      fuera[i] = {
        ...fuera[i],
        tipo: fuera[i].tipo === 'otro' ? a.tipo : fuera[i].tipo,
        notas: fuera[i].notas || a.notas,
        nivel: fuera[i].nivel || a.nivel
      };
    } else {
      fuera.push({ ...a, diaAbs });
    }
  }
  return fuera;
}

/** Si el turno no ha enseñado nada, no hay que tocar la ficha. */
export const nadaAprendido = (a: Aprendizaje[]): boolean => a.length === 0;

/**
 * Rehace lo aprendido leyendo todo el historial de golpe.
 *
 * Igual que la mochila: la etiqueta se puede haber escrito durante meses sin
 * que nadie la leyera, y esto lo recupera sin gastar una llamada a la IA. Se
 * parte de cero y se recorre en orden, así que repetirlo da lo mismo.
 */
export function reconstruirAprendido(
  mensajes: { role: string; content: string }[],
  previo?: Aprendizaje[]
): { aprendido: Aprendizaje[]; vistos: number } {
  // Lo que no salió de una etiqueta se respeta: es de la ficha o del Director.
  const aMano = (previo || []).filter(a => a.id && !a.id.startsWith('apr_'));
  let aprendido: Aprendizaje[] = [];
  let vistos = 0;
  for (const m of mensajes) {
    if (!m || m.role === 'user' || !m.content) continue;
    const leidos = leerAprendizajes(m.content);
    if (!leidos.length) continue;
    vistos += leidos.length;
    aprendido = aplicarAprendizajes(aprendido, leidos);
  }
  const nombres = new Set(aprendido.map(a => sinTildes(a.name || '').toLowerCase()));
  return {
    aprendido: [...aMano.filter(a => !nombres.has(sinTildes(a.name || '').toLowerCase())), ...aprendido],
    vistos
  };
}

/** Para contárselo a la jugadora en una línea. */
export function resumirAprendido(a: Aprendizaje[]): string {
  if (!a.length) return '';
  return a.map(x => x.name).join(', ');
}
