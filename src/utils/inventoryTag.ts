import { CambioDeInventario, InventoryItem, PlayerCurrencies } from '../types';

/**
 * El inventario que el Narrador apuntaba y nadie guardaba.
 *
 * La etiqueta `[INVENTARIO: ...]` llevaba desde el principio en los protocolos,
 * el Narrador la escribía obedientemente en cada turno con botín, y la
 * aplicación la borraba del texto junto a las demás… y ahí se acababa todo.
 * No había lector, no había almacén y no había pantalla: la mochila de la
 * protagonista era una lista en su ficha que nunca cambiaba. De ahí que un
 * pergamino pudiera «aparecer» en su zurrón sin que constara en ninguna parte,
 * y que gastar quince monedas de oro no dejara rastro.
 */

/** Cómo escribe el Narrador las monedas: PO, PP, PE, PA, PC (y sus variantes). */
const MONEDAS: { patron: RegExp; clave: keyof PlayerCurrencies }[] = [
  { patron: /^(?:pp|pt|platino?s?)$/i, clave: 'pp' },
  { patron: /^(?:po|go?ld|oros?|monedas? de oro)$/i, clave: 'gp' },
  { patron: /^(?:pe|electro?s?)$/i, clave: 'ep' },
  { patron: /^(?:pa|plata|platas?)$/i, clave: 'sp' },
  { patron: /^(?:pc|cobre|cobres?)$/i, clave: 'cp' }
];

const claveDeMoneda = (texto: string): keyof PlayerCurrencies | null =>
  MONEDAS.find(m => m.patron.test(texto.trim()))?.clave ?? null;

/**
 * Parte la lista por comas, pero solo por las de fuera de un paréntesis.
 *
 * Los detalles de un objeto llevan comas dentro —«(mágica, equipada)»— y
 * partir a lo bruto convertía ese único objeto en tres entradas rotas, una de
 * ellas llamada «equipada)».
 */
function partirPorComas(lista: string): string[] {
  const trozos: string[] = [];
  let actual = '';
  let dentro = 0;
  for (const ch of lista) {
    if (ch === '(') dentro++;
    else if (ch === ')') dentro = Math.max(0, dentro - 1);
    if (ch === ',' && dentro === 0) {
      trozos.push(actual);
      actual = '';
    } else {
      actual += ch;
    }
  }
  trozos.push(actual);
  return trozos;
}

/** `[INVENTARIO: ...]`, con o sin tildes y en cualquier caja. */
const INVENTARIO_RE = /\[\s*INVENTARIO\s*:\s*([^\]]*)\]/gi;

/**
 * Lee `[INVENTARIO: +1 Máscara de Disfraz (mágica), -3 Buenas Bayas, -15 PO]`.
 *
 * Acepta varias etiquetas en el mismo turno y las acumula. Una entrada sin
 * signo se toma como alta, que es lo que el Narrador quiere decir cuando
 * escribe el nombre a secas.
 */
export function leerInventario(texto: string): CambioDeInventario {
  const cambio: CambioDeInventario = { altas: [], bajas: [], monedas: {} };
  if (!texto || !/INVENTARIO/i.test(texto)) return cambio;

  INVENTARIO_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INVENTARIO_RE.exec(texto)) !== null) {
    for (const trozo of partirPorComas(m[1])) {
      const entrada = trozo.trim();
      if (!entrada) continue;

      const signo = entrada.startsWith('-') ? -1 : 1;
      let resto = entrada.replace(/^[+-]\s*/, '').trim();
      if (!resto) continue;

      // «3 Buenas Bayas» → cantidad 3; «Máscara de Disfraz» → cantidad 1.
      let cantidad = 1;
      const conNumero = resto.match(/^(\d{1,6})\s+(.*)$/);
      if (conNumero) {
        cantidad = parseInt(conNumero[1], 10);
        resto = conNumero[2].trim();
      }
      if (!resto || !Number.isFinite(cantidad) || cantidad <= 0) continue;

      // Los detalles entre paréntesis son del objeto, no de su nombre.
      let detalles: string | undefined;
      const conParentesis = resto.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (conParentesis && conParentesis[1].trim()) {
        resto = conParentesis[1].trim();
        detalles = conParentesis[2].trim() || undefined;
      }

      const moneda = claveDeMoneda(resto);
      if (moneda) {
        cambio.monedas[moneda] = (cambio.monedas[moneda] || 0) + signo * cantidad;
        continue;
      }

      const nombre = resto.slice(0, 120);
      if (signo > 0) cambio.altas.push({ nombre, cantidad, ...leerCampos(detalles) });
      else cambio.bajas.push({ nombre, cantidad });
    }
  }

  return cambio;
}

/**
 * Saca de los detalles lo que convierte un objeto en un encargo.
 *
 * Dentro del paréntesis, el Narrador puede escribir `encargo: ...` (o
 * `misión: ...`) y `de: ...` separados por `|`. Con eso el objeto entra ya
 * clasificado y la jugadora no tiene que marcarlo a mano. Lo que no sea
 * ninguno de los dos se queda como descripción, que es lo que era antes.
 */
function leerCampos(detalles?: string): { detalles?: string; encargo?: string; origen?: string; deMision?: boolean } {
  if (!detalles) return {};
  const sueltos: string[] = [];
  let encargo: string | undefined;
  let origen: string | undefined;

  for (const parte of detalles.split('|')) {
    const t = parte.trim();
    if (!t) continue;
    const corte = t.indexOf(':');
    const campo = corte > 0 ? sinTildes(t.slice(0, corte)).trim().toLowerCase() : '';
    const valor = corte > 0 ? t.slice(corte + 1).trim() : '';
    if (valor && (campo === 'encargo' || campo === 'mision')) encargo = valor.slice(0, 200);
    else if (valor && (campo === 'de' || campo === 'origen')) origen = valor.slice(0, 200);
    else sueltos.push(t);
  }

  return {
    detalles: sueltos.join(', ') || undefined,
    encargo,
    origen,
    deMision: encargo ? true : undefined
  };
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Dos nombres que son el mismo objeto escrito de dos maneras. */
const mismaCosa = (a: string, b: string) =>
  a
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ===
  b
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Aplica un cambio leído sobre la mochila que ya había.
 *
 * Sumar y restar, sin sorpresas: lo que ya estaba conserva todo lo suyo —si era
 * de misión, sigue siéndolo— y lo que baja a cero desaparece, salvo que
 * arrastre trama, porque un objeto de misión entregado es parte de la historia
 * y no un hueco en una lista.
 */
export function aplicarInventario(
  inventarioPrevio: InventoryItem[] | undefined,
  cambio: CambioDeInventario,
  diaAbs?: number
): InventoryItem[] {
  const fuera = [...(inventarioPrevio || [])];

  for (const alta of cambio.altas) {
    const i = fuera.findIndex(it => it && mismaCosa(it.name || '', alta.nombre));
    if (i >= 0) {
      fuera[i] = {
        ...fuera[i],
        quantity: Math.max(0, (fuera[i].quantity || 0) + alta.cantidad),
        // Un objeto que vuelve a entrar deja de estar resuelto.
        resuelto: false,
        description: fuera[i].description || alta.detalles,
        encargo: fuera[i].encargo || alta.encargo,
        origen: fuera[i].origen || alta.origen,
        deMision: fuera[i].deMision || alta.deMision
      };
    } else {
      fuera.push({
        id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: alta.nombre,
        quantity: alta.cantidad,
        description: alta.detalles,
        encargo: alta.encargo,
        origen: alta.origen,
        deMision: alta.deMision,
        diaAbs
      });
    }
  }

  for (const baja of cambio.bajas) {
    const i = fuera.findIndex(it => it && mismaCosa(it.name || '', baja.nombre));
    if (i < 0) continue;
    const restante = Math.max(0, (fuera[i].quantity || 0) - baja.cantidad);
    if (restante > 0) {
      fuera[i] = { ...fuera[i], quantity: restante };
    } else if (fuera[i].deMision) {
      // Entregado o usado: deja de pesar, pero el rastro se queda.
      fuera[i] = { ...fuera[i], quantity: 0, resuelto: true };
    } else {
      fuera.splice(i, 1);
    }
  }

  return fuera;
}

/** Suma o resta monedas sin dejar que ninguna baje de cero. */
export function aplicarMonedas(
  previas: PlayerCurrencies | undefined,
  monedas: CambioDeInventario['monedas']
): PlayerCurrencies {
  const base: PlayerCurrencies = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...(previas || {}) };
  for (const clave of Object.keys(monedas) as (keyof PlayerCurrencies)[]) {
    base[clave] = Math.max(0, (base[clave] || 0) + (monedas[clave] || 0));
  }
  return base;
}

/** Si un cambio leído no mueve nada, no hace falta tocar la ficha. */
export function cambioVacio(c: CambioDeInventario): boolean {
  return c.altas.length === 0 && c.bajas.length === 0 && Object.keys(c.monedas).length === 0;
}

/**
 * Rehace la mochila leyendo TODO el historial de golpe.
 *
 * Hace falta porque la etiqueta llevaba meses escribiéndose y nadie la leía:
 * cuando por fin se le puso lector, la mochila seguía vacía aunque el chat
 * estuviera lleno de objetos ganados y gastados. Esto los recupera sin gastar
 * una sola llamada a la IA —ya está todo escrito, solo hay que aplicarlo en
 * orden— y se puede repetir sin miedo: siempre se parte de cero y se recorre
 * lo mismo, así que sincronizar dos veces da el mismo resultado.
 *
 * ⚠ El dinero NO se toca. La etiqueta anota lo que entra y sale, no el saldo,
 * y el punto de partida está en la ficha, no aquí: reconstruirlo desde cero
 * dejaría a cero a quien empezó con una bolsa llena. Se devuelve el neto para
 * poder enseñárselo a la jugadora y que lo ajuste ella si quiere.
 */
export function reconstruirInventario(
  mensajes: { role: string; content: string }[],
  inventarioActual?: InventoryItem[]
): { inventario: InventoryItem[]; netoDeMonedas: CambioDeInventario['monedas']; objetosVistos: number } {
  // Lo que puso la jugadora a mano se respeta: solo se rehace lo que salió de
  // las etiquetas, que es lo que se puede volver a deducir del historial.
  const aMano = (inventarioActual || []).filter(i => i.id && !i.id.startsWith('inv_'));

  let inventario: InventoryItem[] = [];
  const neto: CambioDeInventario['monedas'] = {};
  let objetosVistos = 0;

  for (const m of mensajes) {
    if (!m || m.role === 'user' || !m.content) continue;
    const cambio = leerInventario(m.content);
    if (cambioVacio(cambio)) continue;
    objetosVistos += cambio.altas.length;
    inventario = aplicarInventario(inventario, cambio);
    for (const clave of Object.keys(cambio.monedas) as (keyof typeof neto)[]) {
      neto[clave] = (neto[clave] || 0) + (cambio.monedas[clave] || 0);
    }
  }

  // Lo escrito a mano vuelve, y lo reconstruido no lo pisa.
  const nombres = new Set(inventario.map(i => (i.name || '').toLowerCase()));
  return {
    inventario: [...aMano.filter(i => !nombres.has((i.name || '').toLowerCase())), ...inventario],
    netoDeMonedas: neto,
    objetosVistos
  };
}
