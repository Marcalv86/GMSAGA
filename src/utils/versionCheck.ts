/**
 * Saber si hay una versión nueva publicada, sin depender de la caché.
 *
 * Los archivos de la aplicación llevan un hash en el nombre, así que lo único
 * que puede quedarse viejo es el `index.html`. GitHub Pages lo sirve con caché
 * de unos minutos, y una aplicación instalada guarda además su propia copia del
 * arranque: el resultado es abrir la app y seguir viendo la versión de ayer sin
 * que nada lo indique. Ha pasado dos veces y las dos costaron un rato de
 * desconcierto.
 *
 * No hace falta un fichero de versión ni tocar el build: basta con pedir el
 * `index.html` saltándose la caché y mirar qué archivo principal referencia. Si
 * no es el que está cargado, hay build nuevo.
 */

/** El archivo principal que cargó ESTA pestaña, leído del propio documento. */
function guionActual(): string | null {
  // Sin DOM —al arrancar, en un worker, o en una prueba fuera del navegador—
  // no hay versión que leer, y eso no puede tumbar a quien pregunte.
  if (typeof document === 'undefined') return null;
  try {
    const el = document.querySelector<HTMLScriptElement>('script[src*="assets/index-"]');
    const src = el?.getAttribute('src') || '';
    return src.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Pregunta si hay algo más nuevo publicado.
 *
 * Devuelve `false` ante cualquier duda —en desarrollo no hay archivos con hash,
 * y sin red no hay nada que comprobar—: avisar de una actualización que no
 * existe es peor que no avisar.
 */
export async function hayVersionNueva(): Promise<boolean> {
  const actual = guionActual();
  if (!actual) return false;

  try {
    const url = new URL('index.html', window.location.href);
    url.searchParams.set('_', String(Date.now()));
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return false;
    const html = await res.text();
    const publicado = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
    return Boolean(publicado && publicado !== actual);
  } catch {
    return false;
  }
}

/**
 * Desde qué versión se pidió la última actualización.
 *
 * GitHub Pages sirve desde varios nodos y no todos se enteran a la vez de un
 * despliegue: se puede preguntar a uno que ya tiene la versión nueva, recargar,
 * y que otro te devuelva la vieja. Entonces el aviso vuelve a saltar, se
 * actualiza otra vez, y a girar. Guardando desde qué versión se salió, al
 * volver se sabe si el viaje sirvió de algo.
 *
 * Vive en `sessionStorage` a propósito: es un dato de este intento, no de la
 * campaña, y debe desaparecer al cerrar del todo.
 */
const CLAVE_INTENTO = 'gmstudio_version_al_actualizar';

/**
 * Recarga de verdad, no la recarga de mentira.
 *
 * `location.reload()` puede volver a servir el mismo HTML cacheado y dejar todo
 * igual. Se limpian antes las cachés y los service workers que hubiera, y se
 * entra por una dirección con marca de tiempo para que el navegador no tenga
 * más remedio que pedirlo de nuevo.
 *
 * No se toca `localStorage`: ahí viven las campañas.
 */
export async function recargarConLaVersionNueva(): Promise<void> {
  try {
    // Desde dónde salimos, para reconocer una recarga que no cambió nada.
    const actual = guionActual();
    if (actual) sessionStorage.setItem(CLAVE_INTENTO, actual);
  } catch {
    /* sin sessionStorage se sigue igual, solo que sin la red de seguridad */
  }
  try {
    if ('caches' in window) {
      const nombres = await caches.keys();
      await Promise.all(nombres.map(n => caches.delete(n)));
    }
    if ('serviceWorker' in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registros.map(r => r.unregister()));
    }
  } catch {
    // Si no se puede limpiar, al menos se recarga saltándose la caché.
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}

/** Cada cuánto se vuelve a mirar. Un build no sale cada minuto. */
const CADA = 15 * 60 * 1000;

/**
 * Vigila si aparece una versión nueva y avisa una sola vez.
 *
 * Comprueba al arrancar, cada cuarto de hora, y al volver a la pestaña —que es
 * cuando de verdad importa: se deja la app abierta en el móvil durante días y
 * es al retomarla cuando conviene enterarse.
 */
/**
 * Cuánto se calla el aviso cuando se aparta con «Ahora no».
 *
 * Antes no se callaba: se apagaba. `avisado` se ponía a true con el primer
 * aviso y no se bajaba nunca, así que tras un solo «Ahora no» la aplicación
 * dejaba de comprobar durante el resto de la sesión —horas, y todos los
 * despliegues que hubiera— sin volver a decir nada. En una app que se deja
 * abierta días en el móvil, eso es quedarse con una versión vieja para
 * siempre sin enterarte. Ahora aparta, no apaga.
 */
const SILENCIO_TRAS_APARTAR = 30 * 60 * 1000;

export function vigilarVersion(
  alHaberNueva: () => void,
  /** Se le entrega una función para apartar el aviso sin apagarlo. */
  alPoderApartar?: (apartar: () => void) => void
): () => void {
  let parado = false;
  let avisado = false;
  let calladoHasta = 0;

  /*
   * ¿Venimos de actualizar y seguimos en la misma versión?
   *
   * Entonces el despliegue aún no ha llegado al nodo que nos sirve, y volver a
   * avisar solo consigue que se actualice otra vez para nada. Se calla hasta la
   * siguiente comprobación del reloj, que da tiempo de sobra a que propague.
   */
  let enGracia = false;
  try {
    const desde = sessionStorage.getItem(CLAVE_INTENTO);
    if (desde) {
      sessionStorage.removeItem(CLAVE_INTENTO);
      enGracia = desde === guionActual();
    }
  } catch {
    /* sin sessionStorage, se comporta como antes */
  }

  const mirar = async () => {
    if (parado || avisado || Date.now() < calladoHasta) return;
    // La primera comprobación tras una actualización que no cambió nada se
    // salta; a partir de la siguiente se mira con normalidad.
    if (enGracia) {
      enGracia = false;
      return;
    }
    if (await hayVersionNueva()) {
      avisado = true;
      alHaberNueva();
    }
  };

  const alVolver = () => {
    if (document.visibilityState === 'visible') void mirar();
  };

  // Apartar el aviso lo silencia un rato y luego vuelve a mirar, en lugar de
  // dejar de comprobar hasta que se reabra la aplicación.
  alPoderApartar?.(() => {
    avisado = false;
    calladoHasta = Date.now() + SILENCIO_TRAS_APARTAR;
  });

  // Un respiro al arrancar: el primer segundo es para pintar la aplicación.
  const arranque = setTimeout(mirar, 4000);
  const reloj = setInterval(mirar, CADA);
  document.addEventListener('visibilitychange', alVolver);

  return () => {
    parado = true;
    clearTimeout(arranque);
    clearInterval(reloj);
    document.removeEventListener('visibilitychange', alVolver);
  };
}

/**
 * Qué build está corriendo ahora mismo, en corto.
 *
 * El nombre del archivo principal lleva el hash del build, así que sirve de
 * número de versión sin tener que generar ninguno. Se enseña en el registro de
 * llamadas: sin esto no hay forma de saber —ni desde dentro ni contándolo— si
 * lo que se está ejecutando ya trae un arreglo o es de hace tres despliegues.
 */
export function versionEnUso(): string {
  const g = guionActual();
  if (!g) return 'desarrollo';
  return g.match(/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[1] || 'desconocida';
}
