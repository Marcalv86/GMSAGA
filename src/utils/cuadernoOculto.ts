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
