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
  'REQUISAD[OA]S?',
  'INCAUTAD[OA]S?',
  'CONFISCAD[OA]S?',
  'RECUPERAD[OA]S?',
  'DEVUELT[OA]S?',
  'RESTITUID[OA]S?',
  'ELIMINAD[OA]S?',
  'BAJAS?',
  'ADQUIRID[OA]S?',
  'OBTENID[OA]S?',
  'GANAD[OA]S?',
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
  'ESTAMOS',
  'ESCENA',
  'MEMORIA',
  'OLVIDA',
  'APRENDE',
  'APRENDIDO',
  'BAMBALINAS',
  'RELOJ',
  'FACCI[OÓ]N',
  'FACCIONES',
  'PREPARADO',
  'ENTORNO',
  'MISI[OÓ]N',
  'MISIONES',
  'TRAMA',
  'ENCARGO',
  'OBJETIVO',
  'FICHA',
  'DOLENCIA',
  'DOLENCIAS',
  'GRUPO',
  'PUENTE',
  'CLIMA',
  'CAMBIO',
  'CONOCIMIENTO',
  'CORREGIR',
  'CORREGIR_[A-Z_]+',
  'SISTEMA',
  'SITUACI[OÓ]N',
  'PLAN',
  'NPC',
  'PNJ',
  'MODIFICAR_PNJ',
  'REHACER_ULTIMO_TURNO',
  'COMENTARIO_DM',
  'HUD'
] as const;

/**
 * Las que además son SPOILER, no solo ruido técnico.
 *
 * `[INVENTARIO: +1 Daga]` que se cuele es feo; `[SECRETO: ...]` o
 * `[BAMBALINAS: ...]` que se cuelen le destripan la campaña. La distinción
 * existe para poder comprobarlo aparte y para que quien toque esto mañana sepa
 * cuáles no se pueden fallar.
 */
export const ETIQUETAS_SPOILER = ['SECRETO', 'REVELADO', 'BAMBALINAS', 'RELOJ', 'HILO', 'PREPARADO', 'FACCI[OÓ]N'] as const;

const EXPRESIONES = ETIQUETAS_INTERNAS.map(
  t => new RegExp(`(?:\\*\\*|__|_|\\*|\\x60)?\\[\\s*${t}\\s*:[^\\]]*\\](?:\\*\\*|__|_|\\*|\\x60)?`, 'gi')
);

/** Deja el texto tal y como debe leerlo la jugadora: sin una sola etiqueta interna. */
export function quitarEtiquetasInternas(texto: string): string {
  if (!texto) return '';
  let limpio = texto;
  for (const re of EXPRESIONES) limpio = limpio.replace(re, '');
  // Limpieza adicional de directivas o etiquetas auxiliares con corchetes
  limpio = limpio
    .replace(/(?:\*\*|__|_|\*|\x60)?\[\s*ESTO SE JUEGA[^\\]]*\](?:\*\*|__|_|\*|\x60)?/gi, '')
    .replace(/(?:\*\*|__|_|\*|\x60)?\[\s*DURACI[OÓ]N EXACTA[^\\]]*\](?:\*\*|__|_|\*|\x60)?/gi, '')
    .replace(/(?:\*\*|__|_|\*|\x60)?\[\s*TRANSICI[OÓ]N[^\\]]*\](?:\*\*|__|_|\*|\x60)?/gi, '');
  return limpio;
}
