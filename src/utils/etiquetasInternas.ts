/**
 * LA LISTA ÚNICA DE ETIQUETAS QUE LA JUGADORA NO DEBE VER JAMÁS.
 *
 * Había dos limpiadores, cada uno con su propia lista escrita a mano, y las
 * dos se habían quedado atrás. Auditadas una por una, DIEZ etiquetas se
 * colaban hasta la pantalla —entre ellas `[SECRETO:]`, que es literalmente el
 * texto del giro sin destapar, y `[BAMBALINAS:]`, que es lo que la gente hace
 * a sus espaldas—. Bastaba con un mensaje editado a mano, uno importado o un
 * repintado para que se leyera el final de una trama en mitad de una escena.
 *
 * El fallo no era de ninguna de las dos listas: era tener dos. Cada vez que se
 * añade una etiqueta nueva hay que acordarse de meterla en ambas, y antes o
 * después no te acuerdas. Ahora se escribe aquí una vez y las dos la usan; una
 * etiqueta nueva que no pase por este fichero no existe.
 */

/** Todas las etiquetas internas, por su nombre tal como las escribe el Narrador. */
export const ETIQUETAS_INTERNAS = [
  'ESTADO',
  'INVENTARIO',
  'TIEMPO',
  'AGENDA',
  'HILO',
  'PRESENTES',
  'V[IÍ]NCULO',
  'AFINIDAD',
  'CHAPTER',
  'SECRETO',
  'REVELADO',
  'NIVEL',
  'AVANCE',
  'VIAJE',
  'LUGAR',
  'MEMORIA',
  'OLVIDA',
  'APRENDE',
  'BAMBALINAS',
  'RELOJ'
] as const;

/**
 * Las que además son SPOILER, no solo ruido técnico.
 *
 * `[INVENTARIO: +1 Daga]` que se cuele es feo; `[SECRETO: ...]` o
 * `[BAMBALINAS: ...]` que se cuelen le destripan la campaña. La distinción
 * existe para poder comprobarlo aparte y para que quien toque esto mañana sepa
 * cuáles no se pueden fallar.
 */
export const ETIQUETAS_SPOILER = ['SECRETO', 'REVELADO', 'BAMBALINAS', 'RELOJ', 'HILO'] as const;

const EXPRESIONES = ETIQUETAS_INTERNAS.map(t => new RegExp(`\\[\\s*${t}\\s*:[^\\]]*\\]`, 'gi'));

/** Deja el texto tal y como debe leerlo la jugadora: sin una sola etiqueta interna. */
export function quitarEtiquetasInternas(texto: string): string {
  if (!texto) return '';
  let limpio = texto;
  for (const re of EXPRESIONES) limpio = limpio.replace(re, '');
  return limpio;
}
