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

export function esRequisado(i?: { enPoderDe?: string } | null): boolean {
  if (!i || !i.enPoderDe) return false;
  const p = i.enPoderDe.trim().toLowerCase();
  return !/^(nadie|ningun|ninguno|ninguna|devuelto|recuperado|la protagonista|el protagonista|ella|el|yo|en sus manos)$/i.test(p);
}

export function esDetalleReal(d?: string): boolean {
  if (!d) return false;
  const t = d.trim().toLowerCase();
  return !/^(?:recuperad[oa]s?|devuelt[oa]s?|restituid[oa]s?|de vuelta|en sus manos)$/i.test(t);
}

/** `[INVENTARIO: ...]`, así como variantes directas como `[REQUISADO: ...]`, `[RECUPERADO: ...]`, `[ELIMINADO: ...]`, `[ADQUIRIDO: ...]`. */
const INVENTARIO_RE = /\[\s*(INVENTARIO|REQUISAD[OA]S?|INCAUTAD[OA]S?|CONFISCAD[OA]S?|RECUPERAD[OA]S?|DEVUELT[OA]S?|RESTITUID[OA]S?|ELIMINAD[OA]S?|BAJAS?|ADQUIRID[OA]S?|OBTENID[OA]S?|GANAD[OA]S?)\s*:\s*([^\]]*)\]/gi;

/**
 * Lee `[INVENTARIO: +1 Máscara de Disfraz (mágica), -3 Buenas Bayas, -15 PO]`,
 * así como formatos narrativos naturales:
 * - Adquiridos: `+1 Espada`, `Adquirido: 1 Espada`, `Obtenido: Escudo`, `[ADQUIRIDO: Espada]`
 * - Eliminados: `-1 Flecha`, `Eliminado: 1 Flecha`, `Baja: Poción`, `Consumido: 1 Poción`, `[ELIMINADO: Flecha]`
 * - Requisados: `~1 Violín (en poder de: Jarlaxle)`, `Requisado: 1 Violín`, `Incautado: Diario`, `[REQUISADO: Violín]`
 * - Recuperados: `Recuperado: 1 Violín`, `Devuelto: Diario`, `+1 Violín (recuperado)`, `[RECUPERADO: Violín]`
 */
export function leerInventario(texto: string): CambioDeInventario {
  const cambio: CambioDeInventario = { altas: [], bajas: [], incautadas: [], monedas: {} };
  if (!texto || !/(?:INVENTARIO|REQUISAD|INCAUTAD|CONFISCAD|RECUPERAD|DEVUELT|RESTITUID|ELIMINAD|BAJA|ADQUIRID|OBTENID|GANAD)/i.test(texto)) {
    return cambio;
  }

  INVENTARIO_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INVENTARIO_RE.exec(texto)) !== null) {
    const nombreEtiqueta = (m[1] || 'INVENTARIO').toUpperCase();
    let modoPorDefecto: 'auto' | 'alta' | 'baja' | 'requisado' | 'recuperado' = 'auto';

    if (/^(?:REQUISAD|INCAUTAD|CONFISCAD)/i.test(nombreEtiqueta)) {
      modoPorDefecto = 'requisado';
    } else if (/^(?:RECUPERAD|DEVUELT|RESTITUID)/i.test(nombreEtiqueta)) {
      modoPorDefecto = 'recuperado';
    } else if (/^(?:ELIMINAD|BAJA)/i.test(nombreEtiqueta)) {
      modoPorDefecto = 'baja';
    } else if (/^(?:ADQUIRID|OBTENID|GANAD)/i.test(nombreEtiqueta)) {
      modoPorDefecto = 'alta';
    }

    for (const trozo of partirPorComas(m[2])) {
      const entrada = trozo.trim();
      if (!entrada) continue;

      let modo = modoPorDefecto;

      // 1. Detectar acción según prefijos o palabras clave de inicio
      if (/^(?:~|requisad[oa]s?|incautad[oa]s?|confiscad[oa]s?|retenid[oa]s?)\b/i.test(entrada)) {
        modo = 'requisado';
      } else if (/^(?:recuperad[oa]s?|devuelt[oa]s?|restituid[oa]s?|recobrad[oa]s?|de vuelta)\b/i.test(entrada)) {
        modo = 'recuperado';
      } else if (/^(?:-|eliminad[oa]s?|bajas?|gastad[oa]s?|consumid[oa]s?|perdid[oa]s?|vendid[oa]s?|destruid[oa]s?|quitad[oa]s?)\b/i.test(entrada)) {
        modo = 'baja';
      } else if (/^(?:\+|adquirid[oa]s?|obtenid[oa]s?|ganad[oa]s?|recibid[oa]s?|encontrad[oa]s?|comprad[oa]s?|añadid[oa]s?)\b/i.test(entrada)) {
        modo = 'alta';
      } else if (modo === 'auto') {
        if (entrada.startsWith('-')) modo = 'baja';
        else if (entrada.startsWith('~')) modo = 'requisado';
        else modo = 'alta';
      }

      // 2. Limpiar prefijos de control y palabras clave del texto de la entrada
      let resto = entrada
        .replace(/^[+~-]\s*/, '')
        .replace(
          /^(?:requisad[oa]s?|incautad[oa]s?|confiscad[oa]s?|retenid[oa]s?|recuperad[oa]s?|devuelt[oa]s?|restituid[oa]s?|recobrad[oa]s?|de vuelta|eliminad[oa]s?|bajas?|gastad[oa]s?|consumid[oa]s?|perdid[oa]s?|vendid[oa]s?|destruid[oa]s?|quitad[oa]s?|adquirid[oa]s?|obtenid[oa]s?|ganad[oa]s?|recibid[oa]s?|encontrad[oa]s?|comprad[oa]s?|añadid[oa]s?)\s*[:\-–—]?\s*/i,
          ''
        )
        .replace(/^[+~-]\s*/, '')
        .trim();

      if (!resto) continue;

      // 3. Extraer cantidad si existe: «3 Buenas Bayas» → cantidad 3; «Máscara» → 1
      let cantidad = 1;
      const conNumero = resto.match(/^(\d{1,6})\s+(.*)$/);
      if (conNumero) {
        cantidad = parseInt(conNumero[1], 10);
        resto = conNumero[2].trim();
      }
      if (!resto || !Number.isFinite(cantidad) || cantidad <= 0) continue;

      // 4. Los detalles entre paréntesis son metadatos, no parte del nombre del objeto
      let detalles: string | undefined;
      const conParentesis = resto.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (conParentesis && conParentesis[1].trim()) {
        resto = conParentesis[1].trim();
        detalles = conParentesis[2].trim() || undefined;
      }

      // 5. Monedas
      const moneda = claveDeMoneda(resto);
      if (moneda) {
        const factor = modo === 'baja' ? -1 : 1;
        cambio.monedas[moneda] = (cambio.monedas[moneda] || 0) + factor * cantidad;
        continue;
      }

      const campos = leerCampos(detalles);

      // Detectar si el texto o los detalles indican recuperación/devolución
      const textoDevolucion = `${resto} ${detalles || ''}`.toLowerCase();
      const esDevolucion =
        modo === 'recuperado' ||
        /devuelt[oa]s?|recuperad[oa]s?|de vuelta|en sus manos|restituid[oa]s?|rescatad[oa]s?/i.test(textoDevolucion) ||
        (campos.enPoderDe && /^(nadie|ningun|ninguno|ninguna|devuelto|recuperado|la protagonista|el protagonista|ella|el|yo|en sus manos)$/i.test(campos.enPoderDe.trim()));

      if (esDevolucion) {
        campos.enPoderDe = undefined;
        campos.dondeEsta = undefined;
        if (modo === 'requisado') modo = 'alta';
      }

      // Limpiar coletillas de devolución del nombre del objeto
      const nombreLimpio = resto
        .replace(/^[:\-–—]\s*/, '')
        .replace(/\b(?:devuelt[oa]s?|recuperad[oa]s?|restituid[oa]s?|de vuelta)\b(?:\s+(?:por|de)\s+[^,)]+)?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const nombre = (nombreLimpio || resto).slice(0, 120);

      // Detectar si debe quedar equipado
      const equipped =
        Boolean(detalles && /equipada|equipado|puesto|puesta|empuñad|al cinto|al cuello/i.test(detalles)) ||
        Boolean(/equipada|equipado|puesto|puesta|empuñad|al cinto|al cuello/i.test(resto));

      const detalleLimpio = esDetalleReal(detalles) ? detalles : undefined;

      // Clasificación final en la estructura CambioDeInventario
      if (modo === 'requisado' || (!esDevolucion && campos.enPoderDe)) {
        cambio.incautadas.push({
          nombre,
          cantidad,
          enPoderDe: campos.enPoderDe || 'sin saber quién',
          dondeEsta: campos.dondeEsta
        });
      } else if (modo === 'baja') {
        cambio.bajas.push({ nombre, cantidad, motivo: detalleLimpio });
      } else {
        // modo === 'alta' o esDevolucion
        cambio.altas.push({
          nombre,
          cantidad,
          equipped: equipped || undefined,
          ...campos,
          detalles: detalleLimpio
        });
      }
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
function leerCampos(detalles?: string): {
  detalles?: string;
  encargo?: string;
  origen?: string;
  enPoderDe?: string;
  dondeEsta?: string;
  deMision?: boolean;
} {
  if (!detalles) return {};
  const sueltos: string[] = [];
  let encargo: string | undefined;
  let origen: string | undefined;
  let enPoderDe: string | undefined;
  let dondeEsta: string | undefined;

  for (const parte of detalles.split('|')) {
    const t = parte.trim();
    if (!t) continue;
    const corte = t.indexOf(':');
    const campo = corte > 0 ? sinTildes(t.slice(0, corte)).trim().toLowerCase() : '';
    const valor = corte > 0 ? t.slice(corte + 1).trim() : '';
    if (valor && (campo === 'encargo' || campo === 'mision')) encargo = valor.slice(0, 200);
    else if (valor && (campo === 'de' || campo === 'origen')) origen = valor.slice(0, 200);
    else if (valor && (campo === 'en poder de' || campo === 'lo tiene' || campo === 'incautado por'))
      enPoderDe = valor.slice(0, 200);
    else if (valor && (campo === 'donde' || campo === 'esta en')) dondeEsta = valor.slice(0, 200);
    else sueltos.push(t);
  }

  return {
    detalles: sueltos.join(', ') || undefined,
    encargo,
    origen,
    enPoderDe,
    dondeEsta,
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

export function normalizarNombreObjeto(t: string): string {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Comprueba si dos nombres hacen referencia al mismo objeto físico,
 * reconociendo variaciones naturales ("Violín" vs "Violín de las Moonshae",
 * "Daga" vs "Daga de plata", singular/plural, o coletillas).
 */
export function sonElMismoObjeto(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (mismaCosa(a, b)) return true;

  const na = normalizarNombreObjeto(a);
  const nb = normalizarNombreObjeto(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  // Si uno contiene al otro y el más corto tiene al menos 4 caracteres
  if ((na.includes(nb) && nb.length >= 4) || (nb.includes(na) && na.length >= 4)) {
    // Evitar falsos positivos entre armas/armaduras de subtipos opuestos
    const partesA = na.split(' ');
    const partesB = nb.split(' ');
    const opuestos = [
      ['corto', 'largo'],
      ['corta', 'larga'],
      ['mayor', 'menor'],
      ['superior', 'inferior'],
      ['pesada', 'ligera'],
      ['pesado', 'ligero']
    ];
    const hayConflicto = opuestos.some(([op1, op2]) =>
      (partesA.includes(op1) && partesB.includes(op2)) ||
      (partesA.includes(op2) && partesB.includes(op1))
    );
    if (!hayConflicto) return true;
  }

  const STOPWORDS = new Set([
    'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas',
    'para', 'con', 'en', 'y', 'o', 'su', 'sus', 'mi', 'mis', 'al', 'se',
    'devuelto', 'devuelta', 'devueltos', 'devueltas',
    'recuperado', 'recuperada', 'recuperados', 'recuperadas',
    'equipado', 'equipada', 'equipados', 'equipadas',
    'portado', 'portada', 'portados', 'portadas'
  ]);

  const palabrasA = na.split(' ').filter(w => w.length >= 4 && !STOPWORDS.has(w));
  const palabrasB = nb.split(' ').filter(w => w.length >= 4 && !STOPWORDS.has(w));

  if (palabrasA.length > 0 && palabrasB.length > 0) {
    const compartidas = palabrasA.filter(w => palabrasB.includes(w));
    if (compartidas.length >= 2 || (compartidas.length === 1 && (palabrasA.length === 1 || palabrasB.length === 1))) {
      return true;
    }
  }

  return false;
}

/**
 * Deduplica una lista de objetos de inventario combinando duplicados.
 * Si un objeto figura como requisado en poder de alguien (enPoderDe definido),
 * ese estado prevalece sobre un registro base neutral sin dueño, evitando que
 * el inventario inicial de la ficha anule las requisas ocurridas en la trama.
 * Solo vuelve a las manos del personaje si hay indicación expresa de devolución o recuperación.
 */
export function deduplicarInventario(items: InventoryItem[]): InventoryItem[] {
  const resultado: InventoryItem[] = [];

  for (const it of items) {
    if (!it || !it.name) continue;

    const idx = resultado.findIndex(existente => sonElMismoObjeto(existente.name || '', it.name || ''));

    if (idx >= 0) {
      const existente = resultado[idx];

      const itReq = !it.eliminado && esRequisado(it);
      const extReq = !existente.eliminado && esRequisado(existente);
      const algunRequisado = itReq || extReq;

      // Se considera devuelto a sus manos solo si expresamente se marca como devuelto/recuperado
      const esDevuelto =
        it.enPoderDe === 'devuelto' ||
        it.enPoderDe === 'recuperado' ||
        existente.enPoderDe === 'devuelto' ||
        existente.enPoderDe === 'recuperado';

      const esReq = algunRequisado && !esDevuelto;
      const estaEnSusManos = !esReq && !it.eliminado && !existente.eliminado;
      const esElim = !esReq && !estaEnSusManos && Boolean(it.eliminado || existente.eliminado);

      const enPoderDe = esReq ? (itReq ? it.enPoderDe : existente.enPoderDe) : undefined;
      const dondeEsta = esReq ? (itReq ? (it.dondeEsta || existente.dondeEsta) : (existente.dondeEsta || it.dondeEsta)) : undefined;
      const incautadoDiaAbs = esReq ? (existente.incautadoDiaAbs ?? it.incautadoDiaAbs) : undefined;

      const nombreMasCompleto = (existente.name?.length || 0) >= (it.name?.length || 0) ? existente.name : it.name;

      resultado[idx] = {
        ...existente,
        ...it,
        id: existente.id || it.id,
        name: nombreMasCompleto,
        quantity: Math.max(existente.quantity || 1, it.quantity || 1),
        equipped: estaEnSusManos && Boolean(existente.equipped || it.equipped),
        enPoderDe,
        dondeEsta,
        incautadoDiaAbs,
        eliminado: esElim ? true : undefined,
        motivoBaja: esElim ? (it.motivoBaja || existente.motivoBaja) : undefined,
        eliminadoDiaAbs: esElim ? (it.eliminadoDiaAbs || existente.eliminadoDiaAbs) : undefined,
        resuelto: Boolean(existente.resuelto && it.resuelto),
        deMision: Boolean(existente.deMision || it.deMision),
        encargo: existente.encargo || it.encargo,
        origen: existente.origen || it.origen,
        description: existente.description || it.description
      };
    } else {
      resultado.push({ ...it });
    }
  }

  return resultado;
}

/**
 * Detecta si el texto de la narración describe la devolución o recuperación
 * de objetos que actualmente figuraban como requisados.
 */
export function detectarDevolucionesEnTexto(
  texto: string,
  requisados: InventoryItem[]
): { nombre: string; cantidad: number; equipped?: boolean; detalles?: string }[] {
  if (!texto || requisados.length === 0) return [];
  const devueltos: { nombre: string; cantidad: number; equipped?: boolean; detalles?: string }[] = [];

  // 1. Detección global: "te devuelve todas tus pertenencias / tus cosas / tu equipaje"
  const patronGlobal =
    /(?:te\s+(?:devuelve|entrega|retorna|restituye|tiende)|recuperas|recobras|tomas\s+de\s+vuelta)\s+(?:todas?\s+tus?\s+|el\s+total\s+de\s+tus?\s+|tu\s+)?(?:pertenencias|cosas|equipaje|equipo|mochila|enseres|bienes)/i;

  if (patronGlobal.test(texto)) {
    for (const r of requisados) {
      devueltos.push({
        nombre: r.name,
        cantidad: r.quantity || 1,
        equipped: r.equipped,
        detalles: 'Devuelto voluntariamente / recuperado'
      });
    }
    return devueltos;
  }

  // 2. Detección por objeto específico
  for (const r of requisados) {
    if (!r.name) continue;
    const palabras = normalizarNombreObjeto(r.name)
      .split(' ')
      .filter(w => w.length >= 4);
    if (palabras.length === 0) continue;

    const palabraClave = palabras[0]; // ej. "violin", "diario", "daga"
    const regexObjeto = new RegExp(
      `(?:te\\s+(?:devuelve|entrega|restituye|retorna|tiende|alarga)|recuperas|recobras|tomas?\\s+de\\s+vuelta|desenvainas|te\\s+ciñes|te\\s+pones|te\\s+cuelgas|empuñas)\\s+(?:el|la|los|las|tu|tus|su|sus)?\\s*(?:[\\wáéíóúñ]+\\s+){0,3}${palabraClave}|${palabraClave}\\s+(?:devuelt[oa]|recuperad[oa]|de\\s+vuelta|en\\s+tus\\s+manos)`,
      'i'
    );

    if (regexObjeto.test(texto)) {
      const equipado = /(?:te\s+ciñes|te\s+pones|te\s+cuelgas|empuñas|desenvainas|al\s+cinto|al\s+cuello)/i.test(texto);
      devueltos.push({
        nombre: r.name,
        cantidad: r.quantity || 1,
        equipped: equipado || r.equipped,
        detalles: 'Devuelto / recuperado en escena'
      });
    }
  }

  return devueltos;
}

/**
 * Detecta si el texto de la narración describe la requisa, desarme, captura o confinamiento
 * de pertenencias del personaje (ej. apresamiento por corsarios, guardias, piratas, etc.).
 *
 * REGLAS INVIOLABLES DE CONFISCACIÓN A PRISIONEROS:
 * 1. «¿Puede usarlo de arma, para golpear, forzar cerraduras o escapar? -> SÍ -> SE LE QUITA.»
 *    ¡TODO PUEDE SER UN ARMA, HASTA UN ALFILER! (Escudos, trampas de caza, armas, sogas, ganzúas, herramientas).
 * 2. «¿Puede servirnos para obtener información sobre el preso, saber si es un espía, descubrir sus secretos o contactos? -> SÍ -> SE LE QUITA.»
 *    (Diarios, cuadernos, cartas, notas, mapas, pergaminos, libros, sellos, reliquias).
 *
 * Ningún captor deja estos objetos a un preso. SOLO se le deja puesta su ropa básica modesta/común para no desnudarla.
 */
export function detectarRequisasEnTexto(
  texto: string,
  candidatos: InventoryItem[]
): { nombre: string; cantidad: number; enPoderDe?: string; dondeEsta?: string }[] {
  if (!texto || candidatos.length === 0) return [];
  const incautadas: { nombre: string; cantidad: number; enPoderDe?: string; dondeEsta?: string }[] = [];

  // Detección de captor en el texto
  let captor = 'Bregan D\'aerthe';
  if (/\b(?:jarlaxle)\b/i.test(texto)) captor = 'Jarlaxle';
  else if (/\b(?:dab'nay|dabnay)\b/i.test(texto)) captor = "Dab'nay";
  else if (/\b(?:braelin)\b/i.test(texto)) captor = 'Braelin';
  else if (/\b(?:valas)\b/i.test(texto)) captor = 'Valas';
  else if (/\b(?:kimmuriel)\b/i.test(texto)) captor = 'Kimmuriel';
  else if (/\b(?:corsarios?|tripulaci[oó]n|drows?)\b/i.test(texto)) captor = 'Tripulación corsaria';
  else if (/\b(?:guardias?|soldados?|carceleros?|alguacil)\b/i.test(texto)) captor = 'Guardia';

  let ubicacion = 'pañol del navío';
  if (/\b(?:camarote)\b/i.test(texto)) ubicacion = 'camarote de Jarlaxle';
  else if (/\b(?:bodega|sentina)\b/i.test(texto)) ubicacion = 'bodega del navío';
  else if (/\b(?:calabozo|celda|prisi[oó]n)\b/i.test(texto)) ubicacion = 'pañol de requisas';

  // Patrón amplio de captura, apresamiento, desarme, retención, despojo o confinamiento
  const patronRequisaGlobal =
    /(?:te\s+(?:requisan|confiscan|despojan|quitan|retiran|desarman|registran)|desarmad[ao]|cautiv[ao]|prisioner[ao]|pres[ao]|apresad[ao]|capturad[ao]|detenid[ao]|encerrad[ao]|confinad[ao]|maniatad[ao]|encadenad[ao]|atad[ao]|arrojad[ao]\s+a\s+la\s+sentina|confinad[ao]\s+en\s+el\s+calabozo|grilletes|esposas|registran\s+tu\s+(?:equipaje|mochila|petate|ropaje)|privad[ao]\s+de\s+(?:su|tu)\s+equipo|bajo\s+custodia\s+de\s+(?:los\s+corsarios|bregan|d'aerthe|jarlaxle|la\s+guardia|los\s+drows)|en\s+calidad\s+de\s+(?:presa|preso|cautiva|cautivo|prisionera|prisionero))/i;

  if (patronRequisaGlobal.test(texto)) {
    // En requisa global o captura, confiscan TODO lo que pueda ser un arma, servir para escapar,
    // golpear, forzar cerraduras, contener venenos o tener valor.
    // Solo se permite conservar ropa básica inofensiva (no armaduras, no cueros endurecidos).
    for (const c of candidatos) {
      if (esRequisado(c)) continue;
      const nom = (c.name || '').toLowerCase();
      
      // Ropa básica inocua: ropas sencillas / comunes / de viaje sin blindaje ni armas
      const esRopaBasicaInocua =
        /^(?:ropa\s+(?:com[uú]n|de\s+viaje|modesta|sencilla|humilde)|ropajes?\s+comunes?|vestid[oa]\s+(?:sencill[oa]|modest[oa]|com[uú]n)|t[uú]nica\s+(?:sencilla|modesta|com[uú]n|de\s+lino)|harapos|camisa|pantal[oó]n|calzas|falda)$/i.test(nom.trim()) &&
        !/(?:armadura|cuero|malla|placas|metal|ocult|arma|pu[ñn]al|daga|acero|reforzad)/i.test(nom);

      if (!esRopaBasicaInocua) {
        const esEscrito = /\b(?:diario|almanaque|cuaderno|libro|tomo|bit[aá]cora|pergamino|mapa|escrito)\b/i.test(nom);
        incautadas.push({
          nombre: c.name,
          cantidad: c.quantity || 1,
          enPoderDe: esEscrito ? (captor === 'Guardia' ? 'Guardia' : 'Jarlaxle') : captor,
          dondeEsta: esEscrito ? (captor === 'Guardia' ? 'sala de guardia' : 'camarote de Jarlaxle') : ubicacion
        });
      }
    }
  }

  // Detección por mención específica de retención o requisa en la escena
  for (const c of candidatos) {
    if (esRequisado(c) || incautadas.some(inc => sonElMismoObjeto(inc.nombre, c.name))) continue;
    const palabras = normalizarNombreObjeto(c.name).split(' ').filter(w => w.length >= 4);
    if (palabras.length === 0) continue;
    const palabraClave = palabras[0];
    const regexIncautado = new RegExp(
      `(?:(?:confisc|requisa|arrebata|retiene|custodia|apoder|arrebatad|incautad|retirad)[\\wáéíóúñ]*\\s+(?:el|la|los|las|tu|tus)?\\s*(?:[\\wáéíóúñ]+\\s+){0,3}${palabraClave}|${palabraClave}\\s+(?:requirad[oa]|confiscad[oa]|incautad[oa]|retenid[oa]|en\\s+(?:su|el)\\s+camarote|en\\s+manos\\s+de|sobre\\s+el\\s+escritorio))`,
      'i'
    );
    if (regexIncautado.test(texto)) {
      const nom = (c.name || '').toLowerCase();
      const esEscrito = /\b(?:diario|almanaque|cuaderno|libro|tomo|bit[aá]cora|pergamino|mapa|escrito)\b/i.test(nom);
      incautadas.push({
        nombre: c.name,
        cantidad: c.quantity || 1,
        enPoderDe: esEscrito ? (captor === 'Guardia' ? 'Guardia' : 'Jarlaxle') : captor,
        dondeEsta: esEscrito ? (captor === 'Guardia' ? 'sala de guardia' : 'camarote de Jarlaxle') : ubicacion
      });
    }
  }

  return incautadas;
}

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
    // 1. Buscar si hay algún objeto requisado que coincida
    const iReq = fuera.findIndex(it => it && esRequisado(it) && sonElMismoObjeto(it.name || '', alta.nombre));
    // 2. Buscar si hay algún objeto eliminado que coincida
    const iElim = fuera.findIndex(it => it && it.eliminado && sonElMismoObjeto(it.name || '', alta.nombre));
    // 3. Buscar si hay algún objeto en sus manos que coincida
    const iActivo = fuera.findIndex(it => it && !it.eliminado && !esRequisado(it) && sonElMismoObjeto(it.name || '', alta.nombre));

    const estaEquipado = alta.equipped ||
      Boolean(alta.detalles && /equipada|equipado|puesto|puesta|empuñad|al cinto|al cuello/i.test(alta.detalles)) ||
      Boolean(/equipada|equipado|puesto|puesta|empuñad|al cinto|al cuello/i.test(alta.nombre));

    const detalleLimpio = esDetalleReal(alta.detalles) ? alta.detalles : undefined;

    if (iReq >= 0 && iActivo >= 0) {
      // Había dos copias (una requisada y una activa). La requisada se purga y la activa se actualiza limpia.
      fuera[iActivo] = {
        ...fuera[iActivo],
        quantity: Math.max(fuera[iActivo].quantity || 1, fuera[iReq].quantity || 1, alta.cantidad),
        enPoderDe: undefined,
        dondeEsta: undefined,
        incautadoDiaAbs: undefined,
        eliminado: undefined,
        resuelto: false,
        equipped: estaEquipado || fuera[iActivo].equipped || fuera[iReq].equipped,
        description: fuera[iActivo].description || fuera[iReq].description || detalleLimpio
      };
      fuera.splice(iReq, 1);
    } else if (iReq >= 0) {
      // Estaba requisado: ¡se recupera y vuelve a sus manos!
      fuera[iReq] = {
        ...fuera[iReq],
        quantity: Math.max(1, alta.cantidad > 1 ? alta.cantidad : (fuera[iReq].quantity || 1)),
        resuelto: false,
        eliminado: undefined,
        enPoderDe: undefined,
        dondeEsta: undefined,
        incautadoDiaAbs: undefined,
        equipped: estaEquipado || fuera[iReq].equipped,
        description: fuera[iReq].description || detalleLimpio,
        encargo: fuera[iReq].encargo || alta.encargo,
        origen: fuera[iReq].origen || alta.origen,
        deMision: fuera[iReq].deMision || alta.deMision
      };
    } else if (iElim >= 0) {
      // Estaba marcado como eliminado: ¡se recupera o adquiere de nuevo!
      fuera[iElim] = {
        ...fuera[iElim],
        quantity: Math.max(1, alta.cantidad),
        eliminado: undefined,
        resuelto: false,
        motivoBaja: undefined,
        eliminadoDiaAbs: undefined,
        enPoderDe: undefined,
        dondeEsta: undefined,
        equipped: estaEquipado || fuera[iElim].equipped,
        description: fuera[iElim].description || detalleLimpio,
        encargo: fuera[iElim].encargo || alta.encargo,
        origen: fuera[iElim].origen || alta.origen,
        deMision: fuera[iElim].deMision || alta.deMision
      };
    } else if (iActivo >= 0) {
      // Ya estaba en sus manos: actualizar cantidad y detalles
      fuera[iActivo] = {
        ...fuera[iActivo],
        quantity: Math.max(1, (fuera[iActivo].quantity || 1) + (alta.cantidad > 1 ? alta.cantidad : 0)),
        resuelto: false,
        eliminado: undefined,
        equipped: estaEquipado || fuera[iActivo].equipped,
        description: fuera[iActivo].description || detalleLimpio,
        encargo: fuera[iActivo].encargo || alta.encargo,
        origen: fuera[iActivo].origen || alta.origen,
        deMision: fuera[iActivo].deMision || alta.deMision
      };
    } else {
      // Nuevo objeto que entra
      fuera.push({
        id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: alta.nombre,
        quantity: alta.cantidad,
        description: detalleLimpio,
        encargo: alta.encargo,
        origen: alta.origen,
        deMision: alta.deMision,
        equipped: estaEquipado,
        diaAbs
      });
    }
  }

  /*
   * LO REQUISADO CAMBIA DE MANOS, NO DESAPARECE.
   *
   * Si el objeto ya estaba en la mochila se queda donde está y solo se le
   * apunta quién lo tiene. Y si NO estaba —porque se lo quitaron antes de que
   * nadie llevara la cuenta, que es lo normal— se crea igualmente: que le
   * requisen algo es justo cuando la aplicación se entera de que lo tenía.
   */
  for (const quitado of cambio.incautadas) {
    const i = fuera.findIndex(it => it && sonElMismoObjeto(it.name || '', quitado.nombre));
    if (i >= 0) {
      fuera[i] = {
        ...fuera[i],
        quantity: Math.max(fuera[i].quantity || 0, quitado.cantidad),
        enPoderDe: quitado.enPoderDe || fuera[i].enPoderDe || 'sin saber quién',
        dondeEsta: quitado.dondeEsta || fuera[i].dondeEsta,
        incautadoDiaAbs: fuera[i].incautadoDiaAbs ?? diaAbs,
        equipped: false, // Un objeto requisado deja de estar equipado
        eliminado: undefined
      };
    } else {
      fuera.push({
        id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: quitado.nombre,
        quantity: quitado.cantidad,
        enPoderDe: quitado.enPoderDe || 'sin saber quién',
        dondeEsta: quitado.dondeEsta,
        incautadoDiaAbs: diaAbs,
        equipped: false,
        diaAbs
      });
    }
  }

  for (const baja of cambio.bajas) {
    let cantRestanteABajar = baja.cantidad;
    for (let i = fuera.length - 1; i >= 0 && cantRestanteABajar > 0; i--) {
      if (fuera[i] && !fuera[i].eliminado && sonElMismoObjeto(fuera[i].name || '', baja.nombre)) {
        const cantItem = fuera[i].quantity || 1;
        if (cantItem <= cantRestanteABajar) {
          cantRestanteABajar -= cantItem;
          if (fuera[i].deMision) {
            fuera[i] = { ...fuera[i], quantity: 0, resuelto: true };
          } else {
            fuera[i] = {
              ...fuera[i],
              quantity: 0,
              eliminado: true,
              eliminadoDiaAbs: diaAbs,
              motivoBaja: baja.motivo || 'Consumido, gastado o eliminado'
            };
          }
        } else {
          fuera[i] = { ...fuera[i], quantity: cantItem - cantRestanteABajar };
          cantRestanteABajar = 0;
        }
      }
    }
  }

  return deduplicarInventario(fuera);
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
  return (
    c.altas.length === 0 &&
    c.bajas.length === 0 &&
    c.incautadas.length === 0 &&
    Object.keys(c.monedas).length === 0
  );
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

    // Detección de devolución o recuperación en el texto narrativo si había objetos requisados
    const requisadosActuales = inventario.filter(i => i.enPoderDe);
    if (requisadosActuales.length > 0) {
      const devueltos = detectarDevolucionesEnTexto(m.content, requisadosActuales);
      for (const d of devueltos) {
        if (!cambio.altas.some(a => sonElMismoObjeto(a.nombre, d.nombre))) {
          cambio.altas.push({
            nombre: d.nombre,
            cantidad: d.cantidad || 1,
            equipped: d.equipped,
            detalles: d.detalles
          });
        }
      }
    }

    // Detección de requisa, desarme o confiscación en el texto narrativo
    const candidatosRequisa = [...inventario, ...aMano].filter(i => !i.enPoderDe && !i.eliminado);
    if (candidatosRequisa.length > 0) {
      const incautadasNarrativas = detectarRequisasEnTexto(m.content, candidatosRequisa);
      for (const inc of incautadasNarrativas) {
        if (!cambio.incautadas.some(ci => sonElMismoObjeto(ci.nombre, inc.nombre))) {
          cambio.incautadas.push({
            nombre: inc.nombre,
            cantidad: inc.cantidad,
            enPoderDe: inc.enPoderDe,
            dondeEsta: inc.dondeEsta
          });
        }
      }
    }

    if (cambioVacio(cambio)) continue;
    objetosVistos += cambio.altas.length + cambio.incautadas.length;
    inventario = aplicarInventario(inventario, cambio);
    for (const clave of Object.keys(cambio.monedas) as (keyof typeof neto)[]) {
      neto[clave] = (neto[clave] || 0) + (cambio.monedas[clave] || 0);
    }
  }

  // Si algo de aMano fue modificado o devuelto en inventario, manda inventario
  const aManoFiltrado = aMano.filter(m => {
    const enInv = inventario.find(inv => sonElMismoObjeto(inv.name || '', m.name || ''));
    if (!enInv) return true;
    return false;
  });

  return {
    inventario: deduplicarInventario([...aManoFiltrado, ...inventario]),
    netoDeMonedas: neto,
    objetosVistos
  };
}

const ICONOS: [string[], string][] = [
  [['violin', 'viol[ií]n', 'lira', 'arpa', 'la[uú]d', 'flauta', 'tambor', 'instrumento', 'c[ií]tara'], '🎻'],
  [['diario', 'cuaderno', 'libreta', 'bit[aá]cora', 'libro', 'tomo', 'grimorio', 'c[oó]dice'], '📓'],
  [['carta', 'misiva', 'nota', 'mensaje', 'sobre', 'pergamino', 'rollo', 'manuscrito', 'documento'], '📜'],
  [['mapa', 'plano', 'derrotero', 'carta de navegaci[oó]n'], '🗺️'],
  [['espada', 'sable', 'estoque', 'hoja', 'acero', 'cimitarra', 'mandoble'], '⚔️'],
  [['daga', 'pu[ñn]al', 'cuchillo', 'estilete', 'navaja'], '🗡️'],
  [['arco', 'ballesta', 'flecha', 'virote', 'carcaj'], '🏹'],
  [['escudo', 'broquel', 'rodela'], '🛡️'],
  [['armadura', 'coraza', 'cota', 'peto', 'casco', 'yelmo'], '🥋'],
  [['capa', 'manto', 'piwafwi', 'tabardo', 'ropa', 'vestido', 't[uú]nica', 'bota', 'guante'], '🧥'],
  [['poci[oó]n', 'elixir', 'brebaje', 'ampolla', 'vial', 'frasco', 'ant[ií]?doto'], '🧪'],
  [['hierba', 'planta', 'flor', 'semilla', 'ra[ií]z', 'baya', 'hongo', 'seta', 'mu[eé]rdago'], '🌿'],
  [['anillo', 'sortija', 'colgante', 'amuleto', 'medall[oó]n', 'joya', 'gema', 'collar', 'broche', 'pendiente', 'talism[aá]n'], '💍'],
  [['llave', 'ganz[uú]a', 'cerradura'], '🗝️'],
  [['moneda', 'monedero', 'oro', 'plata', 'tesoro', 'bolsa de monedas'], '💰'],
  [['vara', 'bast[oó]n', 'cetro', 'b[aá]culo', 'runa', '[oó]gham', 'ogham', 'talla'], '🪄'],
  [['vela', 'farol', 'l[aá]mpara', 'antorcha', 'linterna'], '🕯️'],
  [['comida', 'raci[oó]n', 'pan', 'queso', 'carne', 'provisi[oó]n', 'v[ií]ver'], '🍞'],
  [['agua', 'odre', 'cantimplora', 'vino', 'cerveza', 'licor', 'petaca'], '🍶'],
  [['cuerda', 'soga', 'garfio', 'saco', 'mochila', 'zurr[oó]n', 'morral', 'petate'], '🎒'],
  [['m[aá]scara', 'disfraz', 'antifaz', 'peluca'], '🎭'],
  [['espejo', 'cristal', 'lente', 'catalejo', 'orbe', 'esfera'], '🔮'],
  [['hueso', 'cr[aá]neo', 'calavera', 'reliquia', 'urna'], '💀'],
  [['concha', 'caracola', 'perla', 'coral', 'red', 'ancla', 'remo'], '🐚'],
  [['pluma', 'tinta', 'tintero', 'papel', 'c[aá]lamo'], '🪶'],
  [['sello', 'lacre', 'insignia', 'emblema', 'estandarte', 'bandera'], '🏅'],
  [['pipa', 'tabaco', 'incienso', 'perfume', 'aceite'], '🫗'],
  [['piel', 'pelaje', 'cuero', 'foca', 'lobo', 'garra', 'colmillo'], '🐾']
];

const PATRONES: [RegExp, string][] = ICONOS.map(([raices, emoji]) => [
  new RegExp(`\\b(?:${raices.join('|')})(?:e?s)?\\b`, 'i'),
  emoji
]);

export function iconoDe(item: InventoryItem): string {
  const donde = `${item.name || ''} ${item.description || ''}`;
  for (const [patron, emoji] of PATRONES) if (patron.test(donde)) return emoji;
  return item.deMision ? '📌' : '📦';
}

