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

const CLAVE = "gmstudio_uso_modelos";

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
    return parsed && typeof parsed === "object" ? parsed : {};
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
  datos: {
    entrada?: number;
    cacheados?: number;
    salida?: number;
    total?: number;
  },
  /**
   * Distingue configuraciones del mismo modelo, para poder compararlas: los
   * turnos con búsqueda en documentos y sin ella se acumulan por separado, que es
   * la única manera de saber si compensa sin fiarse de la impresión.
   */
  variante?: string,
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
    ultimoTotal: 0,
  };

  registro[clave] = {
    turnos: previo.turnos + 1,
    entrada: previo.entrada + entrada,
    cacheados: previo.cacheados + Math.max(0, Math.round(datos.cacheados || 0)),
    salida: previo.salida + salida,
    ultimoTotal: Math.round(datos.total || entrada + salida),
  };

  guardar(registro);
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
      porcentajeCache:
        u.entrada > 0 ? Math.round((u.cacheados / u.entrada) * 100) : 0,
      ultimoTotal: u.ultimoTotal,
    }))
    .sort((a, b) => b.turnos - a.turnos);
}
