/**
 * Lo que cuesta de verdad cada modelo, medido con tus partidas.
 *
 * Google devuelve en cada respuesta cuántos tokens ha consumido realmente: los de
 * entrada, los de salida y —lo interesante— cuántos de los de entrada le ha
 * servido su caché sin volver a procesarlos. Aquí se van acumulando por modelo,
 * para que la comparación entre uno y otro salga de tu campaña y no de una tabla
 * de la documentación.
 *
 * Vive en localStorage y no en la campaña: es una propiedad de tu clave y tu
 * manera de jugar, no del tomo que tengas abierto.
 */

const CLAVE = 'gmstudio_uso_modelos';

export interface UsoModelo {
  turnos: number;
  entrada: number;
  /** De los de entrada, los que sirvió la caché de Google sin reprocesar. */
  cacheados: number;
  salida: number;
  /** El total del último turno, para ver el efecto de un cambio al momento. */
  ultimoTotal: number;
}

export type RegistroDeUso = Record<string, UsoModelo>;

export function leerUso(): RegistroDeUso {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function guardar(registro: RegistroDeUso): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(registro));
  } catch {
    // Sin sitio en localStorage: unas estadísticas no valen romper el turno.
  }
}

/**
 * Apunta el consumo de un turno.
 *
 * Se ignoran las llamadas sin datos de uso: algunas respuestas cortadas a mitad
 * no traen `usageMetadata`, y contarlas como un turno de cero tokens hundiría el
 * promedio y haría creer que un modelo consume menos de lo que consume.
 */
export function registrarUso(
  modelo: string,
  datos: { entrada?: number; cacheados?: number; salida?: number; total?: number },
  /**
   * Distingue configuraciones del mismo modelo, para poder compararlas: los
   * turnos con búsqueda en documentos y sin ella se acumulan por separado, que es
   * la única manera de saber si compensa sin fiarse de la impresión.
   */
  variante?: string
): void {
  const entrada = Math.max(0, Math.round(datos.entrada || 0));
  const salida = Math.max(0, Math.round(datos.salida || 0));
  if (!modelo || (entrada === 0 && salida === 0)) return;

  const clave = variante ? `${modelo} · ${variante}` : modelo;
  const registro = leerUso();
  const previo: UsoModelo = registro[clave] || {
    turnos: 0,
    entrada: 0,
    cacheados: 0,
    salida: 0,
    ultimoTotal: 0
  };

  registro[clave] = {
    turnos: previo.turnos + 1,
    entrada: previo.entrada + entrada,
    cacheados: previo.cacheados + Math.max(0, Math.round(datos.cacheados || 0)),
    salida: previo.salida + salida,
    ultimoTotal: Math.round(datos.total || entrada + salida)
  };

  guardar(registro);
}

// ---------------------------------------------------------------- peticiones del día

const CLAVE_DIA = 'gmstudio_peticiones_dia';

interface ContadorDiario {
  fecha: string;
  /** Peticiones del día por modelo, sumando todas las claves. */
  porModelo: Record<string, number>;
  /** Y desglosadas por clave, porque cada clave tiene su propio cupo. */
  porClave: Record<string, Record<string, number>>;
}

/** La fecha local en formato AAAA-MM-DD, que es como se agrupa el día. */
function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Una huella corta y estable de la clave, para poder contar por clave sin
 * guardarla. Nunca se escribe la clave en el contador: solo este número.
 */
export function huellaDeClave(clave: string): string {
  let h = 2166136261;
  for (let i = 0; i < clave.length; i++) {
    h ^= clave.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function leerContador(): ContadorDiario {
  const vacio: ContadorDiario = { fecha: hoy(), porModelo: {}, porClave: {} };
  try {
    const raw = localStorage.getItem(CLAVE_DIA);
    if (!raw) return vacio;
    const parsed: ContadorDiario = JSON.parse(raw);
    if (!parsed || parsed.fecha !== hoy()) return vacio;
    return {
      fecha: parsed.fecha,
      porModelo: parsed.porModelo || {},
      porClave: parsed.porClave || {}
    };
  } catch {
    return vacio;
  }
}

/**
 * Cuántas peticiones lleva hoy cada modelo.
 *
 * El límite que de verdad se nota en la capa gratuita no son los tokens: son las
 * peticiones por día, y en los Flash de la familia 3.x son VEINTE por clave.
 * Veinte turnos y se acabó la jornada, con el mismo error 429 que da quedarse
 * sin tokens por minuto y sin nada que distinga un caso del otro. Sin llevar la
 * cuenta no hay manera de saber si te queda partida.
 *
 * La cuenta de Google va por hora del Pacífico y esta por la hora local, así que
 * pueden no reiniciarse a la vez. Sirve para saber por dónde vas, no para
 * discutirle a Google.
 */
export function peticionesDeHoy(modelo: string): number {
  return leerContador().porModelo[modelo] || 0;
}

/** Lo mismo, desglosado por clave: cada una tiene su propio cupo diario. */
export function peticionesPorClaveDeHoy(modelo: string): Record<string, number> {
  return leerContador().porClave[modelo] || {};
}

/** Suma una petición. Se llama una vez por turno o tarea de fondo que sale bien. */
export function apuntarPeticion(modelo: string, clave?: string): void {
  if (!modelo) return;
  try {
    const contador = leerContador();
    contador.porModelo[modelo] = (contador.porModelo[modelo] || 0) + 1;
    if (clave) {
      const huella = huellaDeClave(clave);
      const delModelo = contador.porClave[modelo] || {};
      delModelo[huella] = (delModelo[huella] || 0) + 1;
      contador.porClave[modelo] = delModelo;
    }
    localStorage.setItem(CLAVE_DIA, JSON.stringify(contador));
  } catch {
    // Sin sitio en localStorage: la cuenta del día no vale romper el turno.
  }
}

// ---------------------------------------------------------------- cupos agotados hoy

const CLAVE_AGOTADOS = 'gmstudio_cupos_agotados';

interface CuposAgotados {
  fecha: string;
  /** Pares «modelo|huella de clave» que ya han agotado su cupo del día. */
  pares: string[];
}

function leerAgotados(): CuposAgotados {
  const vacio: CuposAgotados = { fecha: hoy(), pares: [] };
  try {
    const raw = localStorage.getItem(CLAVE_AGOTADOS);
    if (!raw) return vacio;
    const parsed: CuposAgotados = JSON.parse(raw);
    if (!parsed || parsed.fecha !== hoy() || !Array.isArray(parsed.pares)) return vacio;
    return parsed;
  } catch {
    return vacio;
  }
}

/**
 * Apunta que este modelo, con esta clave, ya no da más hoy.
 *
 * El cupo diario no se recupera esperando: insistir contra él quema una petición
 * y un poco de paciencia cada vez, y en una cadena de respaldo con varias claves
 * eso son cinco intentos inútiles antes de llegar al modelo que sí funciona.
 * Cada modelo lleva su propio cupo, así que saltar al siguiente no es rendirse:
 * es donde está la partida que queda.
 */
export function marcarCupoDiarioAgotado(modelo: string, clave?: string): void {
  if (!modelo) return;
  try {
    const agotados = leerAgotados();
    const par = `${modelo}|${clave ? huellaDeClave(clave) : '*'}`;
    if (!agotados.pares.includes(par)) {
      agotados.pares.push(par);
      localStorage.setItem(CLAVE_AGOTADOS, JSON.stringify({ fecha: hoy(), pares: agotados.pares }));
    }
  } catch {
    /* sin sitio: se seguirá intentando, que es lo de antes */
  }
}

export function cupoDiarioAgotado(modelo: string, clave?: string): boolean {
  if (!modelo) return false;
  const pares = leerAgotados().pares;
  return (
    pares.includes(`${modelo}|*`) || (clave ? pares.includes(`${modelo}|${huellaDeClave(clave)}`) : false)
  );
}

/** Los modelos que hoy ya no dan más con NINGUNA de las claves que se le pasen. */
export function modelosSinCupoHoy(modelos: string[], claves: string[]): string[] {
  return modelos.filter(m => claves.length > 0 && claves.every(c => cupoDiarioAgotado(m, c)));
}

export function borrarUso(modelo?: string): void {
  if (!modelo) {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada que hacer */
    }
    return;
  }
  const registro = leerUso();
  delete registro[modelo];
  guardar(registro);
}

export interface ResumenUso {
  modelo: string;
  turnos: number;
  mediaEntrada: number;
  mediaSalida: number;
  mediaTotal: number;
  /** Porcentaje de la entrada que sirvió la caché. Cuanto más alto, más barato. */
  porcentajeCache: number;
  ultimoTotal: number;
}

export function resumirUso(registro: RegistroDeUso = leerUso()): ResumenUso[] {
  return Object.entries(registro)
    .filter(([, u]) => u && u.turnos > 0)
    .map(([modelo, u]) => ({
      modelo,
      turnos: u.turnos,
      mediaEntrada: Math.round(u.entrada / u.turnos),
      mediaSalida: Math.round(u.salida / u.turnos),
      mediaTotal: Math.round((u.entrada + u.salida) / u.turnos),
      porcentajeCache: u.entrada > 0 ? Math.round((u.cacheados / u.entrada) * 100) : 0,
      ultimoTotal: u.ultimoTotal
    }))
    .sort((a, b) => b.turnos - a.turnos);
}
