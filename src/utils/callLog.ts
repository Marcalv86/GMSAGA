/**
 * Registro de llamadas: qué se le pide a Google en cada turno y cómo acaba.
 *
 * El registro de errores solo apunta lo que FALLA, y eso deja fuera justo lo
 * que hace falta cuando algo va raro sin romperse: un turno que tardó dos
 * minutos, una clave que se agotó y rotó sin avisar, una respuesta cortada por
 * tope de salida, o esas llamadas de fondo que nadie pidió y que sí gastan.
 * Con «0 errores registrados» en pantalla y la partida atascada, no hay por
 * dónde empezar a mirar.
 *
 * Esto apunta TODAS las llamadas, salgan bien o mal, con lo que de verdad hace
 * falta para entender un turno: para qué era, a qué modelo, con qué clave, si
 * fue un reintento, cuánto tardó, cuántas fichas entraron y salieron y por qué
 * se cerró.
 */

import { versionEnUso } from './versionCheck';

export type EstadoLlamada = 'en curso' | 'ok' | 'fallo' | 'cortada';

export interface LlamadaRegistrada {
  id: string;
  /** Momento en que se lanzó. */
  inicio: string;
  horaLegible: string;
  /** Para qué era: «Turno narrado», «Memoria», «Trama», «Mesa (GM)»… */
  proposito: string;
  modelo: string;
  /** Qué clave del bolsillo se usó, para ver rotaciones de un vistazo. */
  claveN?: number;
  totalClaves?: number;
  /** 0 = primer intento. Mayor = reintento por saturación o modelo de respaldo. */
  intento?: number;
  /** Si vino de una cadena de respaldo tras fallar el modelo preferido. */
  esRespaldo?: boolean;
  estado: EstadoLlamada;
  duracionMs?: number;
  /** Lo que dice la propia API, no una estimación nuestra. */
  fichasEntrada?: number;
  fichasSalida?: number;
  fichasEnCache?: number;
  /**
   * Lo que gastó pensando antes de escribir una sola palabra.
   *
   * La API lo devuelve y lo estábamos tirando. Es el dato que separa «tarda
   * porque el envío es enorme» de «tarda porque se lo está pensando»: las dos
   * cosas ocurren en el mismo hueco —antes del primer trozo— y a ojo son
   * idénticas. Con la cifra delante, la pregunta se contesta en vez de
   * discutirse.
   */
  fichasDePensamiento?: number;
  /** Lo que se midió al construir el envío, para cuando la API no lo diga. */
  caracteresEnviados?: number;
  /**
   * Qué documentos viajaron en este turno y cómo.
   *
   * «No envía todos los documentos» era imposible de comprobar desde fuera: se
   * discutía a ojo. Con la lista delante se ve de un vistazo cuáles fueron
   * enteros, cuáles se quedaron en la biblioteca y de cuáles se rescataron
   * fragmentos, que es lo que separa «se le ha olvidado» de «nunca lo tuvo».
   */
  documentos?: {
    /** Nombres que viajaron con su texto completo. */
    enteros?: string[];
    /** Nombres de consulta de los que se rescataron fragmentos este turno. */
    fragmentos?: string[];
    /** Nombres de consulta que NO aportaron nada a este turno. */
    sinUsar?: string[];
  };
  /** STOP, MAX_TOKENS, SAFETY… Es lo que explica un relato cortado. */
  motivoDeCierre?: string;
  /** Cuándo llegó el primer trozo: separa «pensando» de «colgado». */
  primerTrozoMs?: number;
  detalle?: string;
  proyecto?: string;
  capitulo?: string;
}

const CLAVE = 'gmstudio_registro_llamadas_v1';
/**
 * Un tope holgado pero real: son unas cuantas sesiones de juego, y vive en
 * localStorage junto a la campaña, que es lo que no se puede perder.
 */
const MAX_LLAMADAS = 300;

let cache: LlamadaRegistrada[] = [];
let cargado = false;
const oyentes = new Set<(l: LlamadaRegistrada[]) => void>();

function horaDe(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function cargar(): LlamadaRegistrada[] {
  if (cargado) return cache;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CLAVE);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
    // Una llamada «en curso» al arrancar es de una sesión anterior que se cerró
    // a medias: se marca como cortada en vez de dejarla girando para siempre.
    cache = cache.map(l => (l.estado === 'en curso' ? { ...l, estado: 'cortada' as const, detalle: l.detalle || 'La aplicación se cerró antes de terminar.' } : l));
  } catch {
    cache = [];
  }
  cargado = true;
  return cache;
}

function guardar() {
  if (typeof window === 'undefined') return;
  try {
    if (cache.length > MAX_LLAMADAS) cache = cache.slice(cache.length - MAX_LLAMADAS);
    localStorage.setItem(CLAVE, JSON.stringify(cache));
  } catch {
    // Sin sitio: el registro no vale romper una partida.
  }
}

function avisar() {
  const copia = [...cache];
  oyentes.forEach(cb => {
    try {
      cb(copia);
    } catch {
      /* un oyente roto no tumba el registro */
    }
  });
}

/** Apunta que una llamada empieza. Devuelve el id con el que cerrarla. */
export function abrirLlamada(datos: {
  proposito: string;
  modelo: string;
  claveN?: number;
  totalClaves?: number;
  intento?: number;
  esRespaldo?: boolean;
  caracteresEnviados?: number;
  documentos?: LlamadaRegistrada['documentos'];
  proyecto?: string;
  capitulo?: string;
}): string {
  cargar();
  const ahora = new Date();
  const id = `ll_${ahora.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
  cache.push({
    id,
    inicio: ahora.toISOString(),
    horaLegible: horaDe(ahora),
    estado: 'en curso',
    ...datos
  });
  guardar();
  avisar();
  return id;
}

/** Cierra una llamada abierta con cómo acabó. */
export function cerrarLlamada(
  id: string,
  cierre: {
    estado: EstadoLlamada;
    fichasEntrada?: number;
    fichasSalida?: number;
    fichasEnCache?: number;
    fichasDePensamiento?: number;
    motivoDeCierre?: string;
    primerTrozoMs?: number;
    detalle?: string;
  }
): void {
  if (!id) return;
  cargar();
  const i = cache.findIndex(l => l.id === id);
  if (i < 0) return;
  const inicio = new Date(cache[i].inicio).getTime();
  cache[i] = {
    ...cache[i],
    ...cierre,
    duracionMs: Number.isFinite(inicio) ? Date.now() - inicio : undefined
  };
  guardar();
  avisar();
}

export function getLlamadas(): LlamadaRegistrada[] {
  return [...cargar()].reverse();
}

export function limpiarLlamadas(): void {
  cache = [];
  cargado = true;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que hacer */
  }
  avisar();
}

export function suscribirseALlamadas(cb: (l: LlamadaRegistrada[]) => void): () => void {
  cargar();
  oyentes.add(cb);
  cb([...cache]);
  return () => {
    oyentes.delete(cb);
  };
}

/**
 * Caracteres a fichas, y qué parte del techo se lleva.
 *
 * El registro apuntaba «enviado: 698.390 caracteres», que contra un techo
 * medido en fichas no dice absolutamente nada: hay que dividir a mano para
 * enterarse de que eso era el 75% del envío máximo de un minuto. Un número que
 * hay que traducir para entenderlo es un número que no se mira.
 *
 * En español salen unos 3,7 caracteres por ficha. Es una aproximación, y por
 * eso se enseña con «≈» y solo cuando la API no ha dado la cuenta de verdad.
 */
export const CARACTERES_POR_FICHA = 3.7;
export const TECHO_FICHAS_POR_MINUTO = 250000;

export function fichasAproximadas(caracteres?: number): number | undefined {
  if (caracteres === undefined || !Number.isFinite(caracteres)) return undefined;
  return Math.round(caracteres / CARACTERES_POR_FICHA);
}

/** Qué parte del techo del minuto se lleva un envío, en porcentaje redondeado. */
export function porcentajeDelTecho(fichas?: number): number | undefined {
  if (fichas === undefined || !Number.isFinite(fichas)) return undefined;
  return Math.round((fichas / TECHO_FICHAS_POR_MINUTO) * 100);
}

/**
 * Las fichas de entrada que se pueden enseñar, vengan de donde vengan.
 *
 * Si la API contestó, manda su cuenta. Si la llamada se cortó antes —que es
 * justo cuando más falta hace saber cuánto se estaba mandando— se cae en la
 * estimación por caracteres.
 */
export function entradaMostrable(l: LlamadaRegistrada): { fichas?: number; estimada: boolean } {
  if (l.fichasEntrada !== undefined) return { fichas: l.fichasEntrada, estimada: false };
  return { fichas: fichasAproximadas(l.caracteresEnviados), estimada: true };
}

/**
 * Qué parte de la entrada vino de caché.
 *
 * Es el número que explica por qué dos turnos del mismo tamaño tardan cosas
 * distintas: con el prefijo ya cacheado, el modelo no tiene que volver a
 * digerir doscientas mil fichas. Como cifra suelta —«caché 192.460»— no se
 * compara con nada; como porcentaje se entiende sola.
 */
export function porcentajeEnCache(l: LlamadaRegistrada): number | undefined {
  if (!l.fichasEnCache || !l.fichasEntrada) return undefined;
  return Math.round((l.fichasEnCache / l.fichasEntrada) * 100);
}

/** «1,2 s», «45 s», «2 min 10 s» — a ojo se lee mejor que 74213. */
export function duracionLegible(ms?: number): string {
  if (ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace('.', ',')} s`;
  const min = Math.floor(s / 60);
  return `${min} min ${Math.round(s - min * 60)} s`;
}

/** El resumen del día, que es lo que contesta «¿cuánto llevo gastado?». */
export function resumenDeLlamadas(llamadas: LlamadaRegistrada[]): {
  total: number;
  ok: number;
  fallidas: number;
  enCurso: number;
  fichasEntrada: number;
  fichasSalida: number;
  duracionMedia: number;
} {
  const conDuracion = llamadas.filter(l => Number.isFinite(l.duracionMs));
  return {
    total: llamadas.length,
    ok: llamadas.filter(l => l.estado === 'ok').length,
    fallidas: llamadas.filter(l => l.estado === 'fallo' || l.estado === 'cortada').length,
    enCurso: llamadas.filter(l => l.estado === 'en curso').length,
    fichasEntrada: llamadas.reduce((a, l) => a + (l.fichasEntrada || 0), 0),
    fichasSalida: llamadas.reduce((a, l) => a + (l.fichasSalida || 0), 0),
    duracionMedia: conDuracion.length
      ? Math.round(conDuracion.reduce((a, l) => a + (l.duracionMs || 0), 0) / conDuracion.length)
      : 0
  };
}

/** Vuelca el registro a texto plano, para pegarlo en una conversación. */
export function llamadasComoTexto(llamadas: LlamadaRegistrada[]): string {
  const r = resumenDeLlamadas(llamadas);
  const cab = [
    '=== REGISTRO DE LLAMADAS — GM Studio ===',
    `Generado: ${new Date().toLocaleString('es-ES')} · versión ${versionEnUso()}`,
    `Total: ${r.total} · correctas: ${r.ok} · fallidas: ${r.fallidas} · en curso: ${r.enCurso}`,
    `Fichas de entrada: ${r.fichasEntrada.toLocaleString('es-ES')} · de salida: ${r.fichasSalida.toLocaleString('es-ES')}`,
    `Duración media: ${duracionLegible(r.duracionMedia)}`,
    ''
  ].join('\n');

  const filas = llamadas.map(l =>
    [
      `[${l.horaLegible}] ${l.proposito} — ${l.estado.toUpperCase()}`,
      `  modelo: ${l.modelo}${l.claveN ? ` · clave ${l.claveN}${l.totalClaves ? `/${l.totalClaves}` : ''}` : ''}${l.intento ? ` · intento ${l.intento}` : ''}${l.esRespaldo ? ' · respaldo' : ''}`,
      `  duración: ${duracionLegible(l.duracionMs)}${l.primerTrozoMs !== undefined ? ` · primer trozo: ${duracionLegible(l.primerTrozoMs)}` : ''}`,
      (() => {
        const d = l.documentos;
        if (!d) return '';
        const filas = [
          d.enteros?.length ? `  documentos enteros (${d.enteros.length}): ${d.enteros.join(', ')}` : '',
          d.fragmentos?.length ? `  fragmentos rescatados de: ${d.fragmentos.join(', ')}` : '',
          d.sinUsar?.length ? `  de consulta, SIN usar este turno (${d.sinUsar.length}): ${d.sinUsar.join(', ')}` : ''
        ].filter(Boolean);
        return filas.join('\n');
      })(),
      (() => {
        const e = entradaMostrable(l);
        if (e.fichas === undefined) return '';
        const pct = porcentajeDelTecho(e.fichas);
        return `  entrada: ${e.estimada ? '≈' : ''}${e.fichas.toLocaleString('es-ES')} fichas${pct !== undefined ? ` (${pct}% del techo del minuto)` : ''}${
          l.fichasSalida !== undefined ? ` · salida ${l.fichasSalida.toLocaleString('es-ES')}` : ''
        }${l.fichasEnCache ? ` · caché ${l.fichasEnCache.toLocaleString('es-ES')}${(() => { const c = porcentajeEnCache(l); return c !== undefined ? ` (${c}% de la entrada)` : ''; })()}` : ''}${
          l.fichasDePensamiento ? ` · pensando ${l.fichasDePensamiento.toLocaleString('es-ES')}` : ''
        }${
          e.estimada && l.caracteresEnviados ? ` [estimado sobre ${l.caracteresEnviados.toLocaleString('es-ES')} caracteres]` : ''
        }`;
      })(),
      l.motivoDeCierre ? `  cierre: ${l.motivoDeCierre}` : '',
      l.detalle ? `  detalle: ${l.detalle}` : '',
      l.capitulo ? `  capítulo: ${l.capitulo}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  );

  return cab + filas.join('\n\n');
}

/**
 * Lo que Google cacheó DE VERDAD en el último turno narrado.
 *
 * El badge de «caché activa» se encendía mirando el tamaño de los archivos:
 * si el lore pesaba, se daba por hecho que estaba cacheado. Eso no es una
 * medida, es un deseo. Podía estar encendido con cero tokens cacheados y con
 * el prefijo roto desde hacía veinte turnos, y nadie se enteraba.
 *
 * Esto lee lo único que lo sabe: el `cachedContentTokenCount` que devuelve la
 * propia API. Si no hay ninguna llamada narrada con el dato, devuelve
 * `undefined`, y quien pregunte deberá decir «todavía no se sabe» en lugar de
 * inventarse un sí.
 */
export function ultimoCacheMedido(): { fichas: number; porcentaje: number; modelo: string } | undefined {
  const llamadas = getLlamadas();
  for (let i = llamadas.length - 1; i >= 0; i--) {
    const l = llamadas[i];
    // Solo cuentan los turnos narrados: las llamadas de fondo van a otro
    // modelo, con otro prompt, y su caché no dice nada del turno de juego.
    if (!/^Turno narrado/i.test(l.proposito || '')) continue;
    if (!l.fichasEntrada) continue;
    const fichas = l.fichasEnCache || 0;
    return {
      fichas,
      porcentaje: Math.round((fichas / l.fichasEntrada) * 100),
      modelo: l.modelo
    };
  }
  return undefined;
}

export interface UsoDeDocumento {
  nombre: string;
  /** Turnos en los que aportó fragmentos a la escena. */
  conFragmentos: number;
  /** Turnos en los que estaba disponible de consulta y no aportó nada. */
  sinUsar: number;
  /** Turnos en los que viajó con su texto completo. */
  enteros: number;
  /** Cuántos turnos narrados hace que aportó algo. `undefined` = nunca lo hizo. */
  turnosDesdeElUltimo?: number;
}

/**
 * Qué documentos trabajan y cuáles llevan toda la campaña de brazos cruzados.
 *
 * El desglose por turno contesta «qué entró AHORA», y esa no es la pregunta
 * que importa. La que importa es si la biblioteca responde al sitio: en el mar
 * debería subir el módulo náutico, y al llegar a la ciudad el de la ciudad. Un
 * documento que jamás aparece no es necesariamente un documento que sobre —es,
 * casi siempre, uno que la búsqueda no sabe encontrar—, y esa avería es
 * invisible turno a turno porque la escena sale bien igualmente: el Narrador
 * rellena el hueco y nadie nota lo que no llegó.
 *
 * Solo se miran los turnos narrados. Las llamadas de fondo no llevan
 * documentos de consulta y contarlas desplazaría la cuenta hacia abajo.
 */
export function usoDeDocumentos(llamadas: LlamadaRegistrada[]): UsoDeDocumento[] {
  const turnos = llamadas.filter(l => /^Turno narrado/i.test(l.proposito || '') && l.documentos);
  const mapa = new Map<string, UsoDeDocumento>();

  const dame = (nombre: string): UsoDeDocumento => {
    let u = mapa.get(nombre);
    if (!u) {
      u = { nombre, conFragmentos: 0, sinUsar: 0, enteros: 0 };
      mapa.set(nombre, u);
    }
    return u;
  };

  turnos.forEach((l, i) => {
    const d = l.documentos!;
    // Cuántos turnos narrados quedan por detrás de este, para fechar el último uso.
    const desdeElFinal = turnos.length - 1 - i;
    (d.enteros || []).forEach(n => dame(n).enteros++);
    (d.sinUsar || []).forEach(n => dame(n).sinUsar++);
    (d.fragmentos || []).forEach(n => {
      const u = dame(n);
      u.conFragmentos++;
      u.turnosDesdeElUltimo = desdeElFinal;
    });
  });

  /*
   * Los mudos primero. Una lista ordenada por uso enseña arriba lo que ya
   * funciona, que es justo lo que no hay que mirar: el que nunca aparece es el
   * que tiene algo que contar, y es el que se queda enterrado al final.
   */
  return [...mapa.values()].sort((a, b) => {
    if (a.conFragmentos !== b.conFragmentos) return a.conFragmentos - b.conFragmentos;
    return b.sinUsar - a.sinUsar;
  });
}
