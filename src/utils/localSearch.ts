import { ProjectFile } from "../types";

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
  "para",
  "por",
  "con",
  "sin",
  "sobre",
  "entre",
  "hasta",
  "desde",
  "hacia",
  "durante",
  "segun",
  "contra",
  "que",
  "como",
  "cuando",
  "donde",
  "porque",
  "pero",
  "aunque",
  "mientras",
  "si",
  "no",
  "ni",
  "o",
  "u",
  "y",
  "e",
  "del",
  "las",
  "los",
  "una",
  "uno",
  "unos",
  "unas",
  "este",
  "esta",
  "estos",
  "estas",
  "ese",
  "esa",
  "esos",
  "esas",
  "aquel",
  "aquella",
  "todo",
  "toda",
  "todos",
  "todas",
  "otro",
  "otra",
  "otros",
  "otras",
  "mismo",
  "misma",
  "mas",
  "muy",
  "tan",
  "ya",
  "solo",
  "tambien",
  "cada",
  "algun",
  "alguna",
  "ningun",
  "ninguna",
  "cual",
  "quien",
  "ser",
  "estar",
  "haber",
  "tener",
  "hacer",
  "puede",
  "pueden",
  "debe",
  "deben",
  "tiene",
  "tienen",
  "hay",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "these",
  "those",
  "you",
  "your",
  "are",
  "can",
  "will",
  "have",
  "has",
  "not",
  "but",
  "was",
  "were",
  "its",
  "into",
  "than",
  "then",
  "when",
  "what",
  "which",
  "they",
]);

export function normalizarTexto(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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
  for (const suf of [
    "aciones",
    "iciones",
    "amiento",
    "imiento",
    "antes",
    "entes",
  ]) {
    if (palabra.length > suf.length + 3 && palabra.endsWith(suf))
      return palabra.slice(0, -suf.length);
  }
  for (const suf of [
    "ando",
    "endo",
    "ados",
    "idos",
    "adas",
    "idas",
    "aron",
    "ando",
  ]) {
    if (palabra.length > suf.length + 2 && palabra.endsWith(suf))
      return palabra.slice(0, -suf.length);
  }
  for (const suf of ["ado", "ido", "ada", "ida", "ar", "er", "ir"]) {
    if (palabra.length > suf.length + 3 && palabra.endsWith(suf))
      return palabra.slice(0, -suf.length);
  }
  if (palabra.endsWith("es") && palabra.length > 5) return palabra.slice(0, -2);
  if (palabra.endsWith("s") && palabra.length > 4) return palabra.slice(0, -1);
  return palabra;
}

export function tokenizar(texto: string): string[] {
  return normalizarTexto(texto)
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length >= 3 && !VACIAS.has(t))
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
  const texto = file.content || "";
  if (!texto.trim()) return [];

  const lineas = texto.split(/\r?\n/);
  const fragmentos: Fragmento[] = [];
  let titulo = "";
  let buffer = "";

  const cerrar = () => {
    const t = buffer.trim();
    if (t.length < 40) {
      buffer = "";
      return;
    }
    fragmentos.push(crearFragmento(file, titulo, t));
    // Se arrastra la cola para que una frase partida siga apareciendo entera en
    // alguno de los dos trozos.
    buffer = t.length > SOLAPE ? t.slice(-SOLAPE) : "";
  };

  for (const linea of lineas) {
    if (esEncabezado(linea)) {
      cerrar();
      buffer = "";
      titulo = linea.replace(/^#{1,6}\s*/, "").trim();
      continue;
    }
    buffer += (buffer ? "\n" : "") + linea;
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
      if (trozo.length >= 40)
        salida.push(crearFragmento(file, fr.titulo, trozo));
    }
  }

  return salida;
}

function crearFragmento(
  file: ProjectFile,
  titulo: string,
  texto: string,
): Fragmento {
  const tokens = tokenizar(`${titulo} ${texto}`);
  const frecuencias = new Map<string, number>();
  for (const t of tokens) frecuencias.set(t, (frecuencias.get(t) || 0) + 1);
  return {
    fileId: file.id,
    fileName: file.name,
    titulo,
    texto,
    frecuencias,
    largo: tokens.length || 1,
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
  return files.map((f) => `${f.id}:${(f.content || "").length}`).join("|");
}

export function construirIndice(files: ProjectFile[]): Indice {
  const clave = claveDe(files);
  const hit = cache.get(clave);
  if (hit) return hit;

  const fragmentos = files.flatMap((f) => trocear(f));
  const documentos = new Map<string, number>();
  for (const fr of fragmentos) {
    for (const termino of fr.frecuencias.keys()) {
      documentos.set(termino, (documentos.get(termino) || 0) + 1);
    }
  }
  const largoMedio = fragmentos.length
    ? fragmentos.reduce((a, f) => a + f.largo, 0) / fragmentos.length
    : 1;

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

export function buscar(
  indice: Indice,
  consulta: string,
  maximo = 8,
): Resultado[] {
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

  return resultados
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, maximo);
}

/**
 * Recupera fragmentos hasta llenar el presupuesto de caracteres.
 *
 * Se descartan los que puntúan muy por debajo del mejor: rellenar el hueco con
 * fragmentos mediocres solo mete ruido, y el ruido en un prompt cuesta lo mismo
 * que la información.
 */
export function recuperar(
  files: ProjectFile[],
  consulta: string,
  presupuesto = 6000,
): Resultado[] {
  const indice = construirIndice(files);
  const candidatos = buscar(indice, consulta, 12);
  if (!candidatos.length) return [];

  const corte = candidatos[0].puntuacion * 0.35;
  const elegidos: Resultado[] = [];
  let gastado = 0;

  for (const c of candidatos) {
    if (c.puntuacion < corte) break;
    const coste = c.fragmento.texto.length + c.fragmento.titulo.length + 40;
    if (gastado + coste > presupuesto && elegidos.length) break;
    elegidos.push(c);
    gastado += coste;
  }

  return elegidos;
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
}: {
  textoJugadora: string;
  ultimaNarracion?: string;
  nombres?: string[];
}): string {
  const partes = [
    textoJugadora || "",
    (ultimaNarracion || "").slice(-1200),
    (nombres || []).join(" "),
  ];
  return partes.filter(Boolean).join("\n");
}
