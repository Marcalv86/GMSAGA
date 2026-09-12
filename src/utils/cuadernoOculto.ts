import { MovimientoOculto, RelojOculto } from '../types';

/**
 * El cuaderno del Director, que estaba a medias.
 *
 * Guardaba los GIROS —lo que se va a revelar— y nada más. Pero un mundo vivo
 * no es una lista de sorpresas guardadas en un cajón: es gente con planes que
 * avanza mientras la protagonista duerme en otra ciudad.
 *
 * El fallo se nota jugando y es de los que vacían una campaña. A un aliado se
 * le encarga averiguar de dónde salió un objeto; se va, y desaparece del mapa
 * hasta que vuelve a entrar en escena. Entonces el Narrador improvisa qué ha
 * estado haciendo esos cuatro días, y como no lo apuntó nadie, la respuesta
 * suele ser «nada». Aquí se apunta el día en que pasa: fue a tal sitio, habló
 * con tal persona, sacó esto o se topó con aquello.
 *
 * Y los relojes, que son la otra mitad: lo que convierte una amenaza en
 * amenaza es que avance sola.
 */

const BAMBALINAS_RE = /\[\s*BAMBALINAS\s*:\s*([^\]]*)\]/gi;
const RELOJ_RE = /\[\s*RELOJ\s*:\s*([^\]]*)\]/gi;

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Huella corta y estable, para que el mismo apunte no entre dos veces. */
function huella(v: string): string {
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

/** Parte por `|` y devuelve los campos con nombre, que es como los escribe el modelo. */
function leerCampos(resto: string[]): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const parte of resto) {
    const corte = parte.indexOf(':');
    if (corte < 1) continue;
    const campo = sinTildes(parte.slice(0, corte)).trim().toLowerCase();
    const valor = parte.slice(corte + 1).trim();
    if (campo && valor) campos[campo] = valor;
  }
  return campos;
}

/**
 * Lee `[BAMBALINAS: Braelin | hizo: pregunta por el violín en los muelles | donde: Luskan | con: un marinero de las islas | resultado: sabe qué es y de dónde viene | hilo: el violín]`.
 *
 * El primer trozo es SIEMPRE quién. Los demás van por nombre y son opcionales,
 * porque un modelo se salta un campo intermedio con toda naturalidad.
 */
export function leerBambalinas(texto: string, diaAbs: number, fecha?: string): MovimientoOculto[] {
  if (!texto || !/BAMBALINAS/i.test(texto)) return [];
  BAMBALINAS_RE.lastIndex = 0;
  const out: MovimientoOculto[] = [];
  let m: RegExpExecArray | null;
  while ((m = BAMBALINAS_RE.exec(texto)) !== null) {
    const partes = m[1].split('|').map(p => p.trim());
    const quien = (partes.shift() || '').trim();
    if (!quien) continue;
    const c = leerCampos(partes);
    const que = c['hizo'] || c['que'] || c['accion'] || '';
    if (!que) continue;
    out.push({
      id: `bmb_${diaAbs}_${huella(`${quien}|${que}`.toLowerCase())}`,
      diaAbs,
      fecha,
      quien: quien.slice(0, 100),
      que: que.slice(0, 400),
      donde: c['donde']?.slice(0, 120),
      conQuien: (c['con'] || c['con quien'])?.slice(0, 160),
      resultado: (c['resultado'] || c['saco'] || c['consigue'])?.slice(0, 300),
      hilo: (c['hilo'] || c['trama'] || c['giro'])?.slice(0, 160)
    });
  }
  return out;
}

/**
 * Lee `[RELOJ: Bregan D'aerthe localiza el violín | van: 3/6 | al llenarse: mandan a alguien a por ella | de: Bregan D'aerthe]`.
 *
 * `van: 3/6` fija los dos números de una vez, que es como se piensa un reloj.
 * También vale `van: 3` sobre uno que ya existía, o `+1` para avanzarlo sin
 * tener que acordarse de por dónde iba.
 */
export type RelojLeido = RelojOculto & {
  /** Si venía como «van: +1», cuánto hay que SUMAR a lo que ya hubiera. */
  incremento?: number;
};

export function leerRelojes(texto: string): RelojLeido[] {
  if (!texto || !/RELOJ/i.test(texto)) return [];
  RELOJ_RE.lastIndex = 0;
  const out: RelojLeido[] = [];
  let m: RegExpExecArray | null;
  while ((m = RELOJ_RE.exec(texto)) !== null) {
    const partes = m[1].split('|').map(p => p.trim());
    const nombre = (partes.shift() || '').trim();
    if (!nombre) continue;
    const c = leerCampos(partes);

    const crudo = c['van'] || c['avance'] || c['progreso'] || '';
    let llenos = NaN;
    let segmentos = NaN;
    let incremento = NaN;
    const fraccion = crudo.match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
    if (fraccion) {
      llenos = parseInt(fraccion[1], 10);
      segmentos = parseInt(fraccion[2], 10);
    } else if (/^[+-]\s*\d{1,3}$/.test(crudo)) {
      incremento = parseInt(crudo.replace(/\s+/g, ''), 10);
    } else if (/^\d{1,3}$/.test(crudo)) {
      llenos = parseInt(crudo, 10);
    }

    out.push({
      id: `rlj_${huella(nombre.toLowerCase())}`,
      nombre: nombre.slice(0, 160),
      segmentos: Number.isFinite(segmentos) ? Math.max(1, Math.min(12, segmentos)) : 0,
      llenos: Number.isFinite(llenos) ? Math.max(0, llenos) : 0,
      ...(Number.isFinite(incremento) ? { incremento } : {}),
      alLlenarse: (c['al llenarse'] || c['cuando se llene'] || c['pasa'] || '').slice(0, 300),
      deQuien: (c['de'] || c['de quien'] || c['quien'])?.slice(0, 120),
      loIntuye: /^(si|sí|true)$/i.test(c['lo intuye'] || c['intuye'] || '')
    });
  }
  return out;
}

/** Nada que apuntar en el cuaderno este turno. */
export const cuadernoQuieto = (movs: MovimientoOculto[], relojes: RelojOculto[]): boolean =>
  movs.length === 0 && relojes.length === 0;

/** Cuántos movimientos se guardan. Lo viejo se cae solo: el cuaderno es de trabajo. */
export const TOPE_BAMBALINAS = 120;

/**
 * Añade lo de este turno a lo que ya había, sin repetir.
 *
 * El mismo movimiento apuntado dos veces —porque el turno se reintenta o
 * porque el Narrador insiste— entra una sola vez: la huella sale del día, de
 * quién y de qué hizo.
 */
export function aplicarBambalinas(
  previo: MovimientoOculto[] | undefined,
  nuevos: MovimientoOculto[]
): MovimientoOculto[] {
  const fuera = [...(previo || [])];
  for (const mov of nuevos) {
    if (fuera.some(x => x.id === mov.id)) continue;
    fuera.push(mov);
  }
  // Ordenados por día, y con tope: esto es un cuaderno de trabajo, no un archivo.
  fuera.sort((a, b) => a.diaAbs - b.diaAbs);
  return fuera.slice(-TOPE_BAMBALINAS);
}

/**
 * Mueve los relojes.
 *
 * Un reloj que ya existe se actualiza sin perder lo que no se vuelve a decir:
 * de cuántos segmentos era y qué pasa al llenarse se escribieron una vez, y no
 * hay que repetirlos para avanzarlo. Un `+1` suma sobre lo que hubiera.
 */
export function aplicarRelojes(
  previo: RelojOculto[] | undefined,
  leidos: RelojLeido[],
  diaAbs?: number
): RelojOculto[] {
  const fuera = [...(previo || [])];
  for (const r of leidos) {
    const i = fuera.findIndex(x => x.id === r.id);
    if (i < 0) {
      const segmentos = r.segmentos || 6;
      // Un reloj nuevo que llega como «+1» empieza en ese uno.
      const llenos = Math.max(0, Math.min(segmentos, r.incremento ?? r.llenos));
      fuera.push({
        ...r,
        segmentos,
        llenos,
        cumplidoDiaAbs: llenos >= segmentos ? diaAbs : undefined
      });
      continue;
    }
    const anterior = fuera[i];
    const segmentos = r.segmentos || anterior.segmentos || 6;
    /*
     * Un valor absoluto reemplaza; «+1» SUMA sobre lo que hubiera.
     *
     * Es la diferencia entre avanzar un reloj y reiniciarlo, y la forma
     * natural de escribirlo cuando no te acuerdas de por dónde iba es
     * justamente «+1»: si eso lo fijara en uno, cada avance lo haría retroceder.
     */
    const llenos = Math.max(
      0,
      Math.min(segmentos, r.incremento !== undefined ? (anterior.llenos || 0) + r.incremento : r.llenos)
    );
    fuera[i] = {
      ...anterior,
      segmentos,
      llenos,
      alLlenarse: r.alLlenarse || anterior.alLlenarse,
      deQuien: r.deQuien || anterior.deQuien,
      loIntuye: r.loIntuye || anterior.loIntuye,
      cumplidoDiaAbs:
        llenos >= segmentos ? anterior.cumplidoDiaAbs ?? diaAbs : anterior.cumplidoDiaAbs
    };
  }
  return fuera.slice(-40);
}

/** Los relojes que siguen corriendo. */
export const relojesEnMarcha = (r: RelojOculto[] | undefined): RelojOculto[] =>
  (r || []).filter(x => x.llenos < x.segmentos);

/** Cuántos días lleva alguien sin mover ficha, para saber a quién le toca. */
export function diasSinMoverse(movs: MovimientoOculto[] | undefined, quien: string, hoyAbs: number): number {
  const suyos = (movs || []).filter(m => sinTildes(m.quien).toLowerCase() === sinTildes(quien).toLowerCase());
  if (!suyos.length) return Infinity;
  return hoyAbs - Math.max(...suyos.map(m => m.diaAbs));
}

/**
 * Rehace el cuaderno leyendo todo el historial de golpe.
 *
 * Igual que la mochila y lo aprendido: las etiquetas están escritas en los
 * turnos, así que recuperarlas no cuesta una llamada a la IA. Sirve para una
 * campaña anterior a esta pantalla y para cuando algo se pierde por el camino.
 *
 * ⚠ El día NO se puede deducir del texto, así que los apuntes recuperados se
 * marcan con el día que se les pase (el de hoy) salvo que ya lo trajeran. Es el
 * precio de recuperarlos: se sabe QUÉ pasó, no exactamente cuándo.
 */
export function reconstruirCuaderno(
  mensajes: { role: string; content: string }[],
  diaAbs: number,
  previo?: { movimientos?: MovimientoOculto[]; relojes?: RelojOculto[] }
): { movimientos: MovimientoOculto[]; relojes: RelojOculto[]; vistos: number } {
  let movimientos: MovimientoOculto[] = [...(previo?.movimientos || [])];
  let relojes: RelojOculto[] = [...(previo?.relojes || [])];
  let vistos = 0;

  for (const m of mensajes) {
    if (!m || m.role === 'user' || !m.content) continue;
    const movs = leerBambalinas(m.content, diaAbs);
    const rel = leerRelojes(m.content);
    if (!movs.length && !rel.length) continue;
    vistos += movs.length + rel.length;
    if (movs.length) movimientos = aplicarBambalinas(movimientos, movs);
    if (rel.length) relojes = aplicarRelojes(relojes, rel, diaAbs);
  }

  return { movimientos, relojes, vistos };
}

/** Rehace también las facciones y lo preparado, del mismo historial y gratis. */
export function reconstruirMesa(
  mensajes: { role: string; content: string }[],
  diaAbs: number,
  previo?: { facciones?: Faccion[]; preparado?: CartaPreparada[] }
): { facciones: Faccion[]; preparado: CartaPreparada[]; vistos: number } {
  let facciones: Faccion[] = [...(previo?.facciones || [])];
  let preparado: CartaPreparada[] = [...(previo?.preparado || [])];
  let vistos = 0;
  for (const m of mensajes) {
    if (!m || m.role === 'user' || !m.content) continue;
    const fa = leerFacciones(m.content);
    const pr = leerPreparado(m.content);
    if (!fa.length && !pr.length) continue;
    vistos += fa.length + pr.length;
    if (fa.length) facciones = aplicarFacciones(facciones, fa);
    if (pr.length) preparado = aplicarPreparado(preparado, pr, diaAbs);
  }
  return { facciones, preparado, vistos };
}

// ---------------------------------------------------------------- facciones

import { CartaPreparada, Faccion } from '../types';

const FACCION_RE = /\[\s*FACCI[OÓ]N\s*:\s*([^\]]*)\]/gi;
const PREPARADO_RE = /\[\s*PREPARADO\s*:\s*([^\]]*)\]/gi;

const POSTURAS_CON_ELLA: Record<string, NonNullable<Faccion['conElla']>> = {
  aliada: 'aliada', aliado: 'aliada', amiga: 'aliada',
  neutral: 'neutral', neutra: 'neutral',
  recelosa: 'recelosa', receloso: 'recelosa', desconfiada: 'recelosa',
  enemiga: 'enemiga', enemigo: 'enemiga', hostil: 'enemiga',
  'no la conoce': 'no la conoce', desconocida: 'no la conoce'
};

const POSTURAS_ENTRE: Record<string, 'aliada' | 'neutral' | 'rival' | 'guerra'> = {
  aliada: 'aliada', aliado: 'aliada', amiga: 'aliada',
  neutral: 'neutral', neutra: 'neutral',
  rival: 'rival', rivales: 'rival', competencia: 'rival',
  guerra: 'guerra', abierta: 'guerra'
};

/**
 * Lee `[FACCIÓN: Nombre | es: una banda de mercenarios | quiere: el control del puerto | tiene: barcos e informadores | cabeza: Fulano | con ella: recelosa | contra: los Otros (rival) | oculto: en realidad trabajan para un tercero]`.
 *
 * Una facción no es la suma de su gente: tiene un objetivo que sigue vivo
 * aunque muera quien lo llevaba. Por eso lleva ficha propia y no un renglón en
 * la de cada PNJ.
 */
export function leerFacciones(texto: string): Faccion[] {
  if (!texto || !/FACCI[OÓ]N/i.test(texto)) return [];
  FACCION_RE.lastIndex = 0;
  const out: Faccion[] = [];
  let m: RegExpExecArray | null;
  while ((m = FACCION_RE.exec(texto)) !== null) {
    const partes = m[1].split('|').map(p => p.trim());
    const name = (partes.shift() || '').trim();
    if (!name) continue;
    const c = leerCampos(partes);

    const relaciones: NonNullable<Faccion['relaciones']> = [];
    for (const clave of ['contra', 'con', 'relacion']) {
      const bruto = c[clave];
      if (!bruto) continue;
      for (const trozo of bruto.split(';')) {
        const t = trozo.trim();
        if (!t) continue;
        const conParentesis = t.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
        const faccion = (conParentesis ? conParentesis[1] : t).trim().slice(0, 100);
        if (!faccion) continue;
        const etiqueta = sinTildes(conParentesis?.[2] || '').trim().toLowerCase();
        relaciones.push({ faccion, postura: POSTURAS_ENTRE[etiqueta] || 'rival' });
      }
    }

    out.push({
      id: `fac_${huella(name.toLowerCase())}`,
      name: name.slice(0, 120),
      queEs: (c['es'] || c['que es'])?.slice(0, 200),
      objetivo: (c['quiere'] || c['objetivo'] || c['busca'])?.slice(0, 300),
      recursos: (c['tiene'] || c['recursos'])?.slice(0, 300),
      cabeza: (c['cabeza'] || c['lidera'] || c['manda'])?.slice(0, 120),
      conElla: POSTURAS_CON_ELLA[sinTildes(c['con ella'] || '').trim().toLowerCase()],
      relaciones: relaciones.length ? relaciones : undefined,
      oculto: c['oculto']?.slice(0, 500),
      conocida: !/^(no|false)$/i.test(c['conocida'] || 'si')
    });
  }
  return out;
}

/**
 * Lee `[PREPARADO: Título | tipo: escena | detalle: qué pasa | cuando: al llegar a puerto | hilo: de qué cuelga]`.
 *
 * Lo que un director apunta antes de sentarse. Sin esto, lo que no estaba
 * previsto se improvisa en caliente, y en caliente sale lo genérico.
 */
export function leerPreparado(texto: string): CartaPreparada[] {
  if (!texto || !/PREPARADO/i.test(texto)) return [];
  PREPARADO_RE.lastIndex = 0;
  const TIPOS = ['escena', 'encuentro', 'complicacion', 'revelacion', 'pnj'] as const;
  const out: CartaPreparada[] = [];
  let m: RegExpExecArray | null;
  while ((m = PREPARADO_RE.exec(texto)) !== null) {
    const partes = m[1].split('|').map(p => p.trim());
    const titulo = (partes.shift() || '').trim();
    if (!titulo) continue;
    const c = leerCampos(partes);
    const tipoBruto = sinTildes(c['tipo'] || '').trim().toLowerCase();
    out.push({
      id: `prep_${huella(titulo.toLowerCase())}`,
      titulo: titulo.slice(0, 160),
      tipo: (TIPOS as readonly string[]).includes(tipoBruto) ? (tipoBruto as CartaPreparada['tipo']) : 'otro',
      detalle: (c['detalle'] || c['que pasa'] || c['contenido'])?.slice(0, 600),
      cuando: (c['cuando'] || c['encaja'])?.slice(0, 200),
      hilo: (c['hilo'] || c['trama'])?.slice(0, 160),
      usada: /^(si|sí|true|ya)$/i.test(c['usada'] || '')
    });
  }
  return out;
}

/** Funde facciones nuevas con las que había, completando en vez de pisar. */
export function aplicarFacciones(previo: Faccion[] | undefined, leidas: Faccion[]): Faccion[] {
  const fuera = [...(previo || [])];
  for (const f of leidas) {
    const i = fuera.findIndex(x => x.id === f.id || mismoNombre(x.name, f.name));
    if (i < 0) {
      fuera.push(f);
      continue;
    }
    const a = fuera[i];
    fuera[i] = {
      ...a,
      queEs: f.queEs || a.queEs,
      objetivo: f.objetivo || a.objetivo,
      recursos: f.recursos || a.recursos,
      cabeza: f.cabeza || a.cabeza,
      conElla: f.conElla || a.conElla,
      oculto: f.oculto || a.oculto,
      conocida: f.conocida ?? a.conocida,
      relaciones: f.relaciones?.length ? f.relaciones : a.relaciones
    };
  }
  return fuera.slice(-30);
}

/** Añade lo preparado sin duplicar, y marca como usado lo que llegue así. */
export function aplicarPreparado(
  previo: CartaPreparada[] | undefined,
  leidas: CartaPreparada[],
  diaAbs?: number
): CartaPreparada[] {
  const fuera = [...(previo || [])];
  for (const c of leidas) {
    const i = fuera.findIndex(x => x.id === c.id || mismoNombre(x.titulo, c.titulo));
    if (i < 0) {
      fuera.push({ ...c, usadaDiaAbs: c.usada ? diaAbs : undefined });
      continue;
    }
    const a = fuera[i];
    fuera[i] = {
      ...a,
      tipo: c.tipo && c.tipo !== 'otro' ? c.tipo : a.tipo,
      detalle: c.detalle || a.detalle,
      cuando: c.cuando || a.cuando,
      hilo: c.hilo || a.hilo,
      usada: c.usada || a.usada,
      usadaDiaAbs: c.usada && !a.usada ? diaAbs : a.usadaDiaAbs
    };
  }
  return fuera.slice(-40);
}

const mismoNombre = (a: string, b: string) =>
  sinTildes(a || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ===
  sinTildes(b || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Lo que sigue sin usarse. */
export const preparadoEnPie = (c: CartaPreparada[] | undefined): CartaPreparada[] =>
  (c || []).filter(x => !x.usada);

/** Nada nuevo que apuntar de facciones ni de lo preparado. */
export const sinNovedadDeMesa = (f: Faccion[], c: CartaPreparada[]): boolean =>
  f.length === 0 && c.length === 0;
