import { ProjectFile } from '../types';

/**
 * Búsqueda dentro de los documentos, sin salir del navegador.
 *
 * El problema que resuelve: un manual de trescientas páginas no cabe en cada
 * turno, pero de él hacen falta dos párrafos por escena. Hasta ahora la única
 * opción era mandarlo entero o anunciarlo y que el Narrador lo pidiera. Esto
 * busca los fragmentos que vienen a cuento y manda solo esos.
 *
 * Es BM25 escrito a mano: la fórmula clásica de recuperación por palabras, la
 * misma que hay debajo de cualquier buscador de texto. No hace falta descargar
 * ningún modelo ni gastar una petición de API por turno, funciona sin conexión y
 * tarda milisegundos. A cambio busca por las palabras que aparecen, no por el
 * sentido: encuentra «Aguasprofundas» y «veneno de serpiente lunar» —que es el
 * 80% de lo que se consulta en una partida— pero no relaciona «me quedo sin
 * comida» con «inanición» si esa palabra no está escrita.
 */

// ---------------------------------------------------------------- tokenizado

/**
 * Palabras tan frecuentes que no distinguen un fragmento de otro. Si se indexan,
 * un documento largo gana siempre por tener más «de» que los demás.
 */
const VACIAS = new Set([
  'para',
  'por',
  'con',
  'sin',
  'sobre',
  'entre',
  'hasta',
  'desde',
  'hacia',
  'durante',
  'segun',
  'contra',
  'que',
  'como',
  'cuando',
  'donde',
  'porque',
  'pero',
  'aunque',
  'mientras',
  'si',
  'no',
  'ni',
  'o',
  'u',
  'y',
  'e',
  'del',
  'las',
  'los',
  'una',
  'uno',
  'unos',
  'unas',
  'este',
  'esta',
  'estos',
  'estas',
  'ese',
  'esa',
  'esos',
  'esas',
  'aquel',
  'aquella',
  'todo',
  'toda',
  'todos',
  'todas',
  'otro',
  'otra',
  'otros',
  'otras',
  'mismo',
  'misma',
  'mas',
  'muy',
  'tan',
  'ya',
  'solo',
  'tambien',
  'cada',
  'algun',
  'alguna',
  'ningun',
  'ninguna',
  'cual',
  'quien',
  'ser',
  'estar',
  'haber',
  'tener',
  'hacer',
  'puede',
  'pueden',
  'debe',
  'deben',
  'tiene',
  'tienen',
  'hay',
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'these',
  'those',
  'you',
  'your',
  'are',
  'can',
  'will',
  'have',
  'has',
  'not',
  'but',
  'was',
  'were',
  'its',
  'into',
  'than',
  'then',
  'when',
  'what',
  'which',
  'they'
]);

export function normalizarTexto(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Recorta terminaciones para que «monturas» y «montura», o «paralizada» y
 * «paralizar», cuenten como la misma palabra.
 *
 * No es un lematizador de verdad —eso serían diccionarios y megas— sino un
 * recorte de sufijos frecuentes del español. Se queda corto con los verbos
 * irregulares, pero resuelve el caso que más se da al buscar en un manual:
 * preguntar en singular algo que el libro escribió en plural.
 */
function raiz(palabra: string): string {
  if (palabra.length <= 4) return palabra;
  for (const suf of ['aciones', 'iciones', 'amiento', 'imiento', 'antes', 'entes']) {
    if (palabra.length > suf.length + 3 && palabra.endsWith(suf)) return palabra.slice(0, -suf.length);
  }
  for (const suf of ['ando', 'endo', 'ados', 'idos', 'adas', 'idas', 'aron', 'ando']) {
    if (palabra.length > suf.length + 2 && palabra.endsWith(suf)) return palabra.slice(0, -suf.length);
  }
  for (const suf of ['ado', 'ido', 'ada', 'ida', 'ar', 'er', 'ir']) {
    if (palabra.length > suf.length + 3 && palabra.endsWith(suf)) return palabra.slice(0, -suf.length);
  }
  if (palabra.endsWith('es') && palabra.length > 5) return palabra.slice(0, -2);
  if (palabra.endsWith('s') && palabra.length > 4) return palabra.slice(0, -1);
  return palabra;
}

export function tokenizar(texto: string): string[] {
  return normalizarTexto(texto)
    .split(/[^a-z0-9ñ]+/)
    .filter(t => t.length >= 3 && !VACIAS.has(t))
    .map(raiz);
}

// ---------------------------------------------------------------- troceado

export interface Fragmento {
  fileId: string;
  fileName: string;
  /** El encabezado bajo el que cae, para que el fragmento no llegue descolgado. */
  titulo: string;
  texto: string;
  /** Frecuencia de cada término, calculada una vez. */
  frecuencias: Map<string, number>;
  largo: number;
}

const OBJETIVO = 900;
const SOLAPE = 150;

/** ¿Parece un encabezado? Markdown, MAYÚSCULAS sueltas o líneas cortas sin punto. */
function esEncabezado(linea: string): boolean {
  const l = linea.trim();
  if (!l || l.length > 90) return false;
  if (/^#{1,6}\s/.test(l)) return true;
  if (/^[A-ZÁÉÍÓÚÑ0-9][^a-z]{4,}$/.test(l)) return true;
  return /^(cap[ií]tulo|secci[oó]n|ap[eé]ndice|tabla)\b/i.test(l);
}

/**
 * Trocea respetando los encabezados. Cortar cada 900 caracteres a pelo parte las
 * tablas y las reglas por la mitad; seguir la estructura del documento hace que
 * cada fragmento se entienda solo, que es lo que necesita el Narrador.
 */
export function trocear(file: ProjectFile): Fragmento[] {
  const texto = file.content || '';
  if (!texto.trim()) return [];

  const lineas = texto.split(/\r?\n/);
  const fragmentos: Fragmento[] = [];
  let titulo = '';
  let buffer = '';

  const cerrar = () => {
    const t = buffer.trim();
    if (t.length < 40) {
      buffer = '';
      return;
    }
    fragmentos.push(crearFragmento(file, titulo, t));
    // Se arrastra la cola para que una frase partida siga apareciendo entera en
    // alguno de los dos trozos.
    buffer = t.length > SOLAPE ? t.slice(-SOLAPE) : '';
  };

  for (const linea of lineas) {
    if (esEncabezado(linea)) {
      cerrar();
      buffer = '';
      titulo = linea.replace(/^#{1,6}\s*/, '').trim();
      continue;
    }
    buffer += (buffer ? '\n' : '') + linea;
    if (buffer.length >= OBJETIVO) cerrar();
  }
  cerrar();

  // Un PDF extraído suele venir en una sola línea kilométrica: el bucle de arriba
  // no encuentra dónde cortar y devuelve fragmentos enormes, que como unidad de
  // búsqueda no valen —si el fragmento es el documento entero, buscar no
  // selecciona nada—. Los que se hayan pasado de largo se parten aquí.
  const MAXIMO = OBJETIVO * 1.6;
  const salida: Fragmento[] = [];
  for (const fr of fragmentos) {
    if (fr.texto.length <= MAXIMO) {
      salida.push(fr);
      continue;
    }
    for (let i = 0; i < fr.texto.length; i += OBJETIVO - SOLAPE) {
      const trozo = fr.texto.slice(i, i + OBJETIVO).trim();
      if (trozo.length >= 40) salida.push(crearFragmento(file, fr.titulo, trozo));
    }
  }

  return salida;
}

/**
 * Con qué palabras describe cada etiqueta lo que hay dentro.
 *
 * La categoría NO se indexaba: el índice se construía solo con el título y el
 * texto del fragmento, así que marcar un archivo como «cantera de lugares» no
 * cambiaba absolutamente nada en la búsqueda, por mucho que sea justo lo que
 * uno espera de una etiqueta. Aquí se convierte en términos de verdad, que es
 * lo único que entiende un índice BM25.
 */
const PALABRAS_DE_CATEGORIA: Partial<Record<NonNullable<ProjectFile['category']>, string>> = {
  compendio: 'compendio resumen novelas trasfondo material de fondo canon',
  cantera: 'cantera lugar lugares localizacion escenario ciudad barrio taberna edificio sitio',
  lore: 'lore ambientacion historia cultura facciones religion costumbres mundo',
  // Aquí van las palabras de la SITUACIÓN, no las del módulo de origen: una
  // persecución por los tejados de Luskan tiene que enganchar con las reglas de
  // persecución vengan de donde vengan.
  mecanica:
    'mecanica regla reglas subsistema procedimiento tirada prueba complicacion persecucion perseguir huir huida escapar carrera tejados sigilo urbano intriga frio helada ventisca temperatura exposicion agotamiento asedio viaje travesia peligro',
  sheet_npc: 'ficha pnj personaje monstruo criatura estadisticas',
  sheet_pj:
    'ficha protagonista personaje jugador diario runas adivinacion posesiones pertenencias equipo trasfondo cuaderno reliquia',
  sheet_companion:
    'ficha compañero familiar montura animal polilla lechuza cuervo mascota vinculo empatico espiritu',
  oracle: 'oraculo tabla tablas azar resultado',
  roster: 'elenco reparto personajes lista',
  index: 'indice ganchos aventura',
  document: 'documento'
};

function crearFragmento(file: ProjectFile, titulo: string, texto: string): Fragmento {
  /*
   * El NOMBRE del archivo y su etiqueta entran en el índice de cada fragmento.
   *
   * Un párrafo suelto sobre un barrio no dice de qué documento sale, así que
   * una consulta como «buscamos un sitio donde dormir en Aguas Profundas» no
   * enganchaba con la cantera de Aguas Profundas salvo que esas palabras
   * estuvieran literalmente en el párrafo. Con el nombre y la etiqueta dentro,
   * todos los fragmentos de ese archivo saben de dónde vienen y para qué son.
   */
  /*
   * Las etiquetas de la IA entran DOS veces, y es a propósito.
   *
   * Son la única parte del índice que sabe cosas que el texto no dice —que
   * este documento sobre Menzoberranzan le sirve a Jarlaxle, por ejemplo— y
   * compiten contra fragmentos enteros de prosa donde el término buscado
   * aparece muchas veces. Con una sola aparición se quedaban por debajo del
   * ruido. Es el mismo truco que ya se usa con las cosas de la protagonista en
   * `consultaDelTurno`, y por el mismo motivo.
   *
   * Dos y no más: si pesaran demasiado, un documento bien etiquetado saldría
   * en todas las escenas y volveríamos al acaparamiento que arregló el reparto
   * por documento.
   */
  const etiquetas = (file.etiquetasBusqueda || '').trim();
  const procedencia = `${file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')} ${
    PALABRAS_DE_CATEGORIA[file.category as NonNullable<ProjectFile['category']>] || ''
  } ${etiquetas} ${etiquetas}`;
  const tokens = tokenizar(`${procedencia} ${titulo} ${texto}`);
  const frecuencias = new Map<string, number>();
  for (const t of tokens) frecuencias.set(t, (frecuencias.get(t) || 0) + 1);
  return {
    fileId: file.id,
    fileName: file.name,
    titulo,
    texto,
    frecuencias,
    largo: tokens.length || 1
  };
}

// ---------------------------------------------------------------- índice

export interface Indice {
  fragmentos: Fragmento[];
  /** En cuántos fragmentos aparece cada término. */
  documentos: Map<string, number>;
  largoMedio: number;
  clave: string;
}

const cache = new Map<string, Indice>();

/** Cambia si cambia cualquier archivo, y solo entonces se reindexa. */
function claveDe(files: ProjectFile[]): string {
  /*
   * Las etiquetas entran en la clave, o el índice se queda viejo.
   *
   * Esto miraba solo el id y el largo del contenido, que es lo único que
   * cambiaba entonces. Con las etiquetas de la IA ya no basta: generarlas no
   * toca el texto del archivo, así que la clave salía idéntica, se servía el
   * índice cacheado de antes y las etiquetas recién hechas no existían para la
   * búsqueda. Un fallo silencioso de los buenos: todo parece funcionar y no
   * hace nada.
   */
  return files.map(f => `${f.id}:${(f.content || '').length}:${(f.etiquetasBusqueda || '').length}`).join('|');
}

export function construirIndice(files: ProjectFile[]): Indice {
  const clave = claveDe(files);
  const hit = cache.get(clave);
  if (hit) return hit;

  const fragmentos = files.flatMap(f => trocear(f));
  const documentos = new Map<string, number>();
  for (const fr of fragmentos) {
    for (const termino of fr.frecuencias.keys()) {
      documentos.set(termino, (documentos.get(termino) || 0) + 1);
    }
  }
  const largoMedio = fragmentos.length ? fragmentos.reduce((a, f) => a + f.largo, 0) / fragmentos.length : 1;

  const indice: Indice = { fragmentos, documentos, largoMedio, clave };
  // Solo se guarda el último: son campañas de una en una y el índice de un manual
  // grande ocupa lo suyo en memoria.
  cache.clear();
  cache.set(clave, indice);
  return indice;
}

// ---------------------------------------------------------------- búsqueda

const K1 = 1.5;
const B = 0.75;

export interface Resultado {
  fragmento: Fragmento;
  puntuacion: number;
  /** Los términos de la consulta que han hecho saltar este fragmento. */
  aciertos: string[];
}

export function buscar(indice: Indice, consulta: string, maximo = 8): Resultado[] {
  const terminos = [...new Set(tokenizar(consulta))];
  if (!terminos.length || !indice.fragmentos.length) return [];

  const N = indice.fragmentos.length;
  const resultados: Resultado[] = [];

  for (const fragmento of indice.fragmentos) {
    let puntuacion = 0;
    const aciertos: string[] = [];

    for (const termino of terminos) {
      const tf = fragmento.frecuencias.get(termino);
      if (!tf) continue;
      const df = indice.documentos.get(termino) || 1;
      // IDF de BM25: un término que sale en casi todos los fragmentos no informa;
      // uno que sale en dos, muchísimo. Es lo que hace que los nombres propios
      // manden sobre las palabras corrientes.
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const norma = 1 - B + (B * fragmento.largo) / indice.largoMedio;
      puntuacion += idf * ((tf * (K1 + 1)) / (tf + K1 * norma));
      aciertos.push(termino);
    }

    if (puntuacion > 0) resultados.push({ fragmento, puntuacion, aciertos });
  }

  return resultados.sort((a, b) => b.puntuacion - a.puntuacion).slice(0, maximo);
}

/**
 * Recupera fragmentos hasta llenar el presupuesto de caracteres.
 *
 * EL REPARTO IMPORTA TANTO COMO LA PUNTUACIÓN.
 *
 * Antes esto cogía los 12 mejores fragmentos del montón y los metía en orden
 * hasta llenar. Suena razonable y está mal, porque los fragmentos no compiten
 * en igualdad: un documento con muchas secciones que casan puede quedarse con
 * los doce huecos, y entonces los demás no pierden la puja, es que no llegan a
 * jugarla.
 *
 * Medido en la campaña: en una conversación con Jarlaxle —un drow de
 * Menzoberranzan— el compendio de Bregan D'aerthe ganaba todos los turnos por
 * su nombre propio y la cantera de cultura drow sacaba CERO fragmentos, con la
 * escena pidiéndola a gritos. El Narrador, sin ella, no se equivocaba: se
 * quedaba en vaguedades («la pompa de las mujeres de allá abajo»), que es un
 * agujero tapado con un gesto y no se nota leyendo.
 *
 * Así que ahora se reparte en dos vueltas: primero UN fragmento de cada
 * documento que venga al caso, de mejor a peor, y solo después se rellena el
 * hueco que quede con los segundos y terceros. Ningún documento puede
 * acaparar, y el que tiene algo que decir dice al menos una cosa.
 *
 * El corte por puntuación se mantiene —el ruido en un prompt cuesta lo mismo
 * que la información— pero baja del 35% al 15%: con el reparto arreglado, lo
 * que antes había que cortar por acaparamiento ahora se corta solo por
 * presupuesto.
 */
export function recuperar(files: ProjectFile[], consulta: string, presupuesto = 6000): Resultado[] {
  const indice = construirIndice(files);
  // Se piden muchos más candidatos que huecos: con doce no había de dónde
  // diversificar, porque los doce eran del mismo puñado de documentos.
  const candidatos = buscar(indice, consulta, 40);
  if (!candidatos.length) return [];

  const corte = candidatos[0].puntuacion * 0.15;
  /** Ni el mejor documento del turno se lleva más de esto. */
  const topePorDocumento = Math.max(1800, Math.round(presupuesto * 0.4));
  const MAX_FRAGMENTOS_POR_DOCUMENTO = 3;

  const elegidos: Resultado[] = [];
  const yaElegidos = new Set<Resultado>();
  const gastadoPor = new Map<string, number>();
  const cuantosDe = new Map<string, number>();
  let gastado = 0;

  const costeDe = (c: Resultado) => c.fragmento.texto.length + c.fragmento.titulo.length + 40;

  const intentar = (c: Resultado, respetarTopeDeDocumento: boolean): boolean => {
    if (yaElegidos.has(c)) return false;
    if (c.puntuacion < corte) return false;
    const doc = c.fragmento.fileName;
    const coste = costeDe(c);
    if (gastado + coste > presupuesto) return false;
    if (respetarTopeDeDocumento) {
      if ((cuantosDe.get(doc) || 0) >= MAX_FRAGMENTOS_POR_DOCUMENTO) return false;
      if ((gastadoPor.get(doc) || 0) + coste > topePorDocumento) return false;
    }
    elegidos.push(c);
    yaElegidos.add(c);
    gastado += coste;
    gastadoPor.set(doc, (gastadoPor.get(doc) || 0) + coste);
    cuantosDe.set(doc, (cuantosDe.get(doc) || 0) + 1);
    return true;
  };

  // Primera vuelta: lo mejor de cada documento. Esto es lo que garantiza que
  // una cantera pertinente entre aunque otro documento puntúe más alto en
  // todos sus fragmentos.
  const vistos = new Set<string>();
  for (const c of candidatos) {
    if (vistos.has(c.fragmento.fileName)) continue;
    vistos.add(c.fragmento.fileName);
    intentar(c, true);
  }

  // Segunda vuelta: con lo que sobre, se profundiza en los que más puntúan.
  for (const c of candidatos) intentar(c, true);

  // Tercera: si aún sobra presupuesto y ya no hay nada que respete los topes,
  // se rellena sin ellos antes que devolver hueco sin usar.
  for (const c of candidatos) intentar(c, false);

  return elegidos.sort((a, b) => b.puntuacion - a.puntuacion);
}

/**
 * La consulta con la que se busca cada turno.
 *
 * No basta con lo que acaba de escribir la jugadora: «abro la puerta» no tiene
 * ni un término buscable. Se mezcla con lo último que narró el Narrador y con los
 * nombres que están vivos en la memoria, que es donde están los nombres propios.
 */
export function consultaDelTurno({
  textoJugadora,
  ultimaNarracion,
  nombres,
  suyo
}: {
  textoJugadora: string;
  ultimaNarracion?: string;
  nombres?: string[];
  /**
   * Lo que es DE ELLA: su equipo, su compañero animal, su diario.
   *
   * Sin esto la consulta se armaba solo con lo que YA estaba en escena, y eso
   * es circular: el Narrador no podía mencionar la polilla lunar porque no
   * tenía el fragmento, y no tenía el fragmento porque nadie había mencionado
   * la polilla lunar. Sus cosas no son lore que haya que ir a buscar cuando
   * salga: van con ella a todas partes, así que pesan en la consulta de cada
   * turno y sus fragmentos suben solos.
   */
  suyo?: string[];
}): string {
  /*
   * EL EQUILIBRIO ENTRE LO QUE CAMBIA Y LO QUE NO.
   *
   * Tres de las cuatro partes de esta consulta son iguales todos los turnos:
   * los nombres vivos y lo suyo (que además iba duplicado). Solo el texto de
   * la jugadora y la última narración se mueven, y la narración pesaba hasta
   * mil doscientos caracteres frente a un «abro la puerta» de quince.
   *
   * El resultado era una consulta casi constante, y con una consulta constante
   * ganan siempre los mismos documentos: medido en la campaña, cinco de ellos
   * entraban en el 100% de los turnos y cuatro no entraban jamás. Y va a peor
   * solo, porque `nombres` crece con cada PNJ que conoce.
   *
   * Además, esos mil doscientos caracteres son de la escena ANTERIOR. En una
   * transición —un viaje, un salto, subir a cubierta— tiran de la búsqueda
   * hacia donde estaba, no hacia donde va, que es justo lo contrario de lo que
   * hace falta.
   *
   * Así que lo que declara la jugadora AHORA se dobla (mismo truco que ya se
   * usaba con lo suyo), la cola de narración se recorta, y los nombres llevan
   * tope para que la parte fija no siga engordando sin freno.
   */
  const MAX_NOMBRES = 30;
  const partes = [
    textoJugadora || '',
    // Doblado: es lo único de aquí que describe el turno que se va a jugar.
    textoJugadora || '',
    (ultimaNarracion || '').slice(-700),
    (nombres || []).slice(0, MAX_NOMBRES).join(' '),
    // Repetido a propósito: en BM25 un término que aparece dos veces pesa más,
    // y lo suyo tiene que competir con la narración reciente.
    (suyo || []).join(' '),
    (suyo || []).join(' ')
  ];
  return partes.filter(Boolean).join('\n');
}
