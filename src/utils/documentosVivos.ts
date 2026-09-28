import type {
  DocumentosVivos,
  EntradaDeBitacora,
  InventoryItem,
  Memory,
  NPC,
  VersionDeDocumento
} from '../types';
import { coincidenNombresNpc } from './npcMatcher';

/*
 * 📚 LOS DOCUMENTOS VIVOS.
 *
 * Dos documentos que el Director reescribe y uno que solo crece:
 *
 * - 🕯️ Cuaderno del GM (oculto): el estado del mundo que ella no ve.
 * - 🎒 Ficha viva (visible y editable): heridas, dinero, inventario y compras.
 * - 📖 Bitácora (visible): una entrada por capítulo, que ya no se toca.
 *
 * Se actualizan de una sentada al cerrar capítulo o con «Volcar ahora», nunca
 * turno a turno: así una respuesta rehecha no deja restos, y solo hay una vía
 * escribiendo sobre cada cosa.
 */

/** Cuántas versiones anteriores de cada documento se guardan para deshacer. */
export const VERSIONES_GUARDADAS = 10;

/*
 * La estructura sale del «Códice de campaña» que ya funcionaba jugando con
 * Claude: el estado del mundo corto arriba, la verdad oculta de cada trama,
 * quién quiere qué, relojes, vínculos, secretos e hilos con fecha, y abajo lo
 * cerrado que sigue pesando y cómo se arranca la próxima vez.
 */
export const SECCIONES_CUADERNO = [
  'Estado general',
  'La verdad oculta (tramas)',
  'Actores',
  'Relojes y fuera de cámara',
  'Lugares clave',
  'Tono y límites',
  'PNJs menores',
  'Vínculos',
  'Secretos vigentes',
  'Hilos con vencimiento',
  'Canon de mesa',
  'Semillas',
  'Consecuencias vivas',
  'Reputación y rumores',
  'Arranques y cortes'
] as const;

export const SECCIONES_FICHA = [
  'Nivel, PG y recursos',
  'Dinero',
  'Lo que lleva encima',
  'Mochila y contenedores',
  'Guardado en otro sitio',
  'Requisado o en manos ajenas',
  'Encargos',
  'Lista de compras'
] as const;

const plantilla = (titulo: string, secciones: readonly string[]) =>
  `# ${titulo}\n\n${secciones.map(s => `## ${s}\n- (vacío)`).join('\n\n')}\n`;

export const plantillaCuaderno = (pj?: string) =>
  plantilla(`Cuaderno del GM${pj ? ` — ${pj}` : ''}`, SECCIONES_CUADERNO);

export const plantillaFicha = (pj?: string) =>
  plantilla(`Ficha viva${pj ? ` — ${pj}` : ''}`, SECCIONES_FICHA);

export const hayDocumentosVivos = (mem?: Memory | null): boolean =>
  Boolean(mem?.documentos_vivos && (mem.documentos_vivos.cuaderno || mem.documentos_vivos.ficha));

// ---------------------------------------------------------------- migración

const linea = (t?: string | null) => (t || '').replace(/\s+/g, ' ').trim();

const lista = (items: string[]) => (items.length ? items.map(i => `- ${i}`).join('\n') : '- (vacío)');

const seccion = (titulo: string, items: string[]) => `## ${titulo}\n${lista(items)}`;

const lineaDeObjeto = (i: InventoryItem) => {
  const partes = [`**${linea(i.name)}**${i.quantity && i.quantity > 1 ? ` ×${i.quantity}` : ''}`];
  if (i.equipped) partes.push('(equipado)');
  if (i.description) partes.push(`— ${linea(i.description)}`);
  return partes.join(' ');
};

/**
 * Monta los documentos por primera vez con lo que ya hay guardado.
 *
 * Sin IA: es trasladar lo que las listas ya dicen al formato nuevo, para que
 * nadie pierda su campaña al cambiar de sistema. Lo que no tenga dónde ir se
 * queda en su sección como «(vacío)» y el primer volcado lo rellena.
 */
export function migrarADocumentosVivos(mem: Memory | undefined, ahora = Date.now()): DocumentosVivos {
  const pc = mem?.player_character;
  const pj = pc?.name?.trim() || undefined;

  // ---- Cuaderno
  const estado: string[] = [];
  if (mem?.raw_project_memory?.trim()) {
    estado.push(
      ...mem.raw_project_memory
        .trim()
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => (/^#+\s*/.test(l) ? `**${l.replace(/^#+\s*/, '')}**` : l.replace(/^[-*]\s+/, '')))
    );
  } else if (mem?.current_status?.trim()) {
    estado.push(linea(mem.current_status));
  }

  const tramas: string[] = [];
  if (mem?.plan_de_campana?.premisa) tramas.push(`**Premisa (oculta):** ${linea(mem.plan_de_campana.premisa)}`);
  if (mem?.plan_de_campana?.destino) tramas.push(`**Hacia dónde va:** ${linea(mem.plan_de_campana.destino)}`);

  const actores = (mem?.gm_facciones || []).map(
    f =>
      `**${linea(f.name)}**${f.queEs ? ` — ${linea(f.queEs)}` : ''}${f.cabeza ? ` · la lleva ${linea(f.cabeza)}` : ''}${
        f.objetivo ? ` · quiere: ${linea(f.objetivo)}` : ''
      }${f.recursos ? ` · cuenta con: ${linea(f.recursos)}` : ''}${f.conElla ? ` · con ella: ${f.conElla}` : ''}${
        f.oculto ? ` · 🔒 ${linea(f.oculto)}` : ''
      }`
  );

  const relojes = (mem?.gm_relojes || [])
    .filter(r => r.llenos < r.segmentos)
    .map(
      r =>
        `**${linea(r.nombre)}** — ${r.llenos}/${r.segmentos}${r.deQuien ? ` · lo mueve ${linea(r.deQuien)}` : ''}${
          r.alLlenarse ? ` · al llenarse: ${linea(r.alLlenarse)}` : ''
        }`
    );

  const fuera = (mem?.gm_bambalinas || [])
    .slice(-15)
    .map(
      m =>
        `${m.fecha ? `(${m.fecha}) ` : ''}**${linea(m.quien)}:** ${linea(m.que)}${m.donde ? ` — en ${linea(m.donde)}` : ''}${
          m.resultado ? ` → ${linea(m.resultado)}` : ''
        }${m.loSupo ? ' (ella ya lo sabe)' : ''}`
    );

  const lugares = (mem?.locations || [])
    .slice(0, 25)
    .map(l => `**${linea(l.name)}**${l.desc ? ` — ${linea(l.desc).slice(0, 200)}` : ''}`);

  const vinculos = (mem?.npcs || [])
    .filter(
      n =>
        n.aparenta || n.oculta || n.atraccion || typeof n.vin === 'number' || typeof n.con === 'number' ||
        n.promesas?.length || n.confidencias?.length || n.impresionActual
    )
    .map(n => {
      const ejes = [
        n.atraccion ? `ATR ${n.atraccion}` : '',
        typeof n.atr === 'number' && !n.atraccion ? `ATR ${Math.round(n.atr / 2)}` : '',
        typeof n.vin === 'number' ? `VÍN ${Math.round(n.vin / 2)}` : '',
        typeof n.con === 'number' ? `CON ${Math.round(n.con / 2)}` : ''
      ].filter(Boolean);
      const extra = [
        n.aparenta ? `aparenta: ${linea(n.aparenta)}` : '',
        n.oculta ? `oculta: ${linea(n.oculta)}` : '',
        n.impresionActual ? `piensa de ella: ${linea(n.impresionActual)}` : '',
        n.promesas?.length ? `promesas: ${n.promesas.map(linea).join('; ')}` : '',
        n.confidencias?.length ? `confidencias: ${n.confidencias.map(linea).join('; ')}` : ''
      ].filter(Boolean);
      return `**${linea(n.name)}**${ejes.length ? ` (${ejes.join(' · ')})` : ''}${extra.length ? ` — ${extra.join(' · ')}` : ''}`;
    });

  const descubiertos = (mem?.gm_secrets || [])
    .filter(s => s.revelado)
    .map(s => `**${linea(s.titulo)}** — ${linea(s.secreto)}${s.revelado?.como ? ` (lo supo: ${linea(s.revelado.como)})` : ''}`);

  for (const q of mem?.quests || []) {
    if (/complet|fallad|cerrad|resuelt/i.test(q.status || '')) continue;
    tramas.push(
      `**${linea(q.title)}** [${linea(q.type) || 'trama'}]${q.objective ? ` — objetivo: ${linea(q.objective)}` : ''}${
        q.progress ? ` · va: ${linea(q.progress)}` : ''
      }${q.origin ? ` · de: ${linea(q.origin)}` : ''}`
    );
  }

  const semillas = (mem?.gm_preparado || [])
    .filter(c => !c.usada)
    .map(
      c =>
        `**${linea(c.titulo)}**${c.tipo && c.tipo !== 'otro' ? ` [${c.tipo}]` : ''}${c.detalle ? ` — ${linea(c.detalle)}` : ''}${
          c.cuando ? ` · encaja: ${linea(c.cuando)}` : ''
        }${c.deLaJugadora ? ' · la pidió ella' : ''}`
    );

  const cuaderno = [
    `# Cuaderno del GM${pj ? ` — ${pj}` : ''}`,
    seccion('Estado general', estado),
    seccion('La verdad oculta (tramas)', tramas),
    seccion('Actores', actores),
    seccion('Relojes y fuera de cámara', [...relojes, ...fuera]),
    seccion('Lugares clave', lugares),
    seccion('Tono y límites', []),
    seccion('PNJs menores', []),
    seccion('Vínculos', vinculos),
    seccion('Secretos vigentes', descubiertos),
    seccion('Hilos con vencimiento', []),
    seccion('Canon de mesa', []),
    seccion('Semillas', semillas),
    seccion('Consecuencias vivas', []),
    seccion('Reputación y rumores', []),
    seccion('Arranques y cortes', [])
  ].join('\n\n');

  // ---- Ficha viva
  const inventario = (pc?.inventory || []).filter(i => i && i.name && !i.eliminado && !(i.quantity === 0 && !i.deMision));
  const requisado = inventario.filter(i => i.enPoderDe);
  const suyo = inventario.filter(i => !i.enPoderDe);
  const encargos = suyo.filter(i => i.deMision && !i.resuelto);
  const resto = suyo.filter(i => !i.deMision || i.resuelto);
  const encima = resto.filter(i => i.equipped);
  const mochila = resto.filter(i => !i.equipped);

  const monedas = pc?.currencies;
  const dinero = monedas
    ? [
        [monedas.pp, 'PP'],
        [monedas.gp, 'PO'],
        [monedas.ep, 'PE'],
        [monedas.sp, 'PA'],
        [monedas.cp, 'PC']
      ]
        .filter(([n]) => typeof n === 'number' && (n as number) > 0)
        .map(([n, u]) => `${n} ${u}`)
    : [];

  const estadoPj = [
    ...(pc?.level ? [`Nivel ${linea(String(pc.level))}`] : []),
    ...(typeof pc?.maxHp === 'number' ? [`PG ${typeof pc.hp === 'number' ? pc.hp : pc.maxHp}/${pc.maxHp}`] : []),
    ...(pc?.conditions || []).map(c => `Condición: ${linea(c)}`),
    ...(typeof pc?.agotamiento === 'number' && pc.agotamiento > 0 ? [`Agotamiento: nivel ${pc.agotamiento}`] : []),
    ...(pc?.dolencias || []).map(d => `Dolencia: ${linea(d.nombre)}`)
  ];

  const ficha = [
    `# Ficha viva${pj ? ` — ${pj}` : ''}`,
    `> Los PG del momento los lleva el HUD turno a turno; aquí queda cómo está al último volcado.`,
    seccion('Nivel, PG y recursos', estadoPj),
    seccion('Dinero', dinero.length ? [dinero.join(' · ')] : []),
    seccion('Lo que lleva encima', encima.map(lineaDeObjeto)),
    seccion('Mochila y contenedores', mochila.map(lineaDeObjeto)),
    seccion('Guardado en otro sitio', []),
    seccion(
      'Requisado o en manos ajenas',
      requisado.map(i => `${lineaDeObjeto(i)} — lo tiene **${linea(i.enPoderDe)}**${i.dondeEsta ? `, en ${linea(i.dondeEsta)}` : ''}`)
    ),
    seccion(
      'Encargos',
      encargos.map(i => `${lineaDeObjeto(i)}${i.encargo ? ` — encargo: ${linea(i.encargo)}` : ''}${i.origen ? ` (de ${linea(i.origen)})` : ''}`)
    ),
    seccion('Lista de compras', [])
  ].join('\n\n');

  return {
    cuaderno,
    ficha,
    bitacora: [],
    versiones: { cuaderno: [], ficha: [] },
    volcadoHasta: {},
    creadoEl: ahora,
    actualizadoEl: ahora
  };
}

// ---------------------------------------------------------------- versiones

const conVersion = (previas: VersionDeDocumento[] | undefined, texto: string, motivo: string, fecha: number) =>
  [...(previas || []), { texto, fecha, motivo }].slice(-VERSIONES_GUARDADAS);

/**
 * Sustituye uno o los dos documentos guardando antes la versión que había.
 * Si el texto nuevo es igual al anterior, no se guarda versión.
 */
export function reescribirDocumentos(
  docs: DocumentosVivos,
  cambios: { cuaderno?: string; ficha?: string },
  motivo: string,
  ahora = Date.now()
): DocumentosVivos {
  const versiones = docs.versiones || { cuaderno: [], ficha: [] };
  const nuevoCuaderno = cambios.cuaderno?.trim() ? cambios.cuaderno.trim() : undefined;
  const nuevaFicha = cambios.ficha?.trim() ? cambios.ficha.trim() : undefined;
  const cambiaCuaderno = nuevoCuaderno !== undefined && nuevoCuaderno !== docs.cuaderno;
  const cambiaFicha = nuevaFicha !== undefined && nuevaFicha !== docs.ficha;
  return {
    ...docs,
    cuaderno: cambiaCuaderno ? nuevoCuaderno! : docs.cuaderno,
    ficha: cambiaFicha ? nuevaFicha! : docs.ficha,
    versiones: {
      cuaderno: cambiaCuaderno ? conVersion(versiones.cuaderno, docs.cuaderno, motivo, ahora) : versiones.cuaderno,
      ficha: cambiaFicha ? conVersion(versiones.ficha, docs.ficha, motivo, ahora) : versiones.ficha
    },
    actualizadoEl: cambiaCuaderno || cambiaFicha ? ahora : docs.actualizadoEl
  };
}

/** Vuelve a la última versión guardada de un documento. La actual pasa a ser la última versión. */
export function deshacerDocumento(docs: DocumentosVivos, cual: 'cuaderno' | 'ficha', ahora = Date.now()): DocumentosVivos | null {
  const versiones = docs.versiones || { cuaderno: [], ficha: [] };
  const lista = versiones[cual];
  if (!lista.length) return null;
  const anterior = lista[lista.length - 1];
  return {
    ...docs,
    [cual]: anterior.texto,
    versiones: { ...versiones, [cual]: lista.slice(0, -1) },
    actualizadoEl: ahora
  };
}

/** Añade una entrada a la bitácora, numerando la parte si el capítulo ya tenía alguna. */
export function anotarEnBitacora(
  docs: DocumentosVivos,
  entrada: { chatId: string; capitulo: string; texto: string },
  ahora = Date.now()
): DocumentosVivos {
  const texto = entrada.texto.trim();
  if (!texto) return docs;
  const delMismo = docs.bitacora.filter(b => b.chatId === entrada.chatId);
  const nueva: EntradaDeBitacora = {
    id: `bit_${ahora.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    chatId: entrada.chatId,
    capitulo: entrada.capitulo,
    parte: delMismo.length ? delMismo.length + 1 : undefined,
    texto,
    fecha: ahora
  };
  // Si había una sola entrada sin número, pasa a ser la parte 1.
  const bitacora = docs.bitacora.map(b =>
    b.chatId === entrada.chatId && delMismo.length === 1 && b.parte === undefined ? { ...b, parte: 1 } : b
  );
  return { ...docs, bitacora: [...bitacora, nueva] };
}

// ---------------------------------------------------------------- comprobaciones

/** Las secciones `## ...` de un documento y cuántas entradas `- ` tiene cada una. */
export function contarEntradas(doc: string): Record<string, number> {
  const fuera: Record<string, number> = {};
  let actual = '';
  for (const l of (doc || '').split('\n')) {
    const h = l.match(/^##\s+(.+?)\s*$/);
    if (h) {
      actual = h[1];
      fuera[actual] = 0;
      continue;
    }
    if (actual && /^\s*[-*]\s+/.test(l) && !/^\s*[-*]\s+\(vac[ií]o\)\s*$/i.test(l)) fuera[actual]++;
  }
  return fuera;
}

/**
 * Secciones que se han quedado fuera o han perdido más de la mitad de sus
 * entradas. No es un error —podar es parte del trabajo—, pero se enseña para
 * que nada desaparezca sin que nadie lo vea.
 */
export function seccionesMermadas(antes: string, despues: string): string[] {
  const a = contarEntradas(antes);
  const d = contarEntradas(despues);
  const fuera: string[] = [];
  for (const [sec, n] of Object.entries(a)) {
    if (!(sec in d)) fuera.push(`«${sec}» ha desaparecido`);
    else if (n >= 3 && d[sec] < n / 2) fuera.push(`«${sec}» baja de ${n} a ${d[sec]} entradas`);
  }
  return fuera;
}

/**
 * Qué líneas se van y cuáles llegan, para enseñar los cambios de la Ficha viva
 * antes de guardarlos. Comparación por línea: basta para ver qué objeto entra,
 * sale o cambia de sección.
 */
export function diferenciasPorLinea(antes: string, despues: string): { quitadas: string[]; nuevas: string[] } {
  const limpia = (t: string) =>
    (t || '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/^[-*]\s+\(vac[ií]o\)$/i.test(l));
  const a = limpia(antes);
  const d = limpia(despues);
  const enA = new Set(a);
  const enD = new Set(d);
  return { quitadas: a.filter(l => !enD.has(l)), nuevas: d.filter(l => !enA.has(l)) };
}

// ---------------------------------------------------------------- para el Narrador

/**
 * Lo que recibe el Narrador en cada turno: el cuaderno entero, la ficha viva
 * y solo la última entrada de la bitácora (lo demás ya está en el cuaderno).
 */
export function bloqueDocumentosParaNarrador(docs: DocumentosVivos): string {
  const ultima = docs.bitacora[docs.bitacora.length - 1];
  return `
### 📚 DOCUMENTOS VIVOS DE LA CAMPAÑA — mandan sobre tu memoria
Son el estado de la partida **al último volcado**. Lo que se haya jugado después está en este chat, y **lo del chat manda** si se contradicen: el documento se pone al día al cerrar el capítulo.
- ⛔ Estos documentos NO los actualizas tú desde el chat: **no emitas** \`[INVENTARIO:]\`, \`[VÍNCULO:]\`, \`[MISIÓN:]\`, \`[PLAN:]\`, \`[BAMBALINAS:]\`, \`[RELOJ:]\`, \`[FACCIÓN:]\` ni \`[PREPARADO:]\`. Lleva lo que cambie en la cabeza; se vuelca de una sentada al cerrar el capítulo, y de ahí salen también las fichas de PNJs, lugares y tramas.
- ✅ Consúltalos antes de afirmar un dato concreto: si no está aquí, ni en su ficha, ni en los documentos del proyecto, ni en este chat, no lo inventes.

#### 🕯️ CUADERNO DEL GM (⛔ ella NO lo lee: no lo narres, no lo insinúes, no lo cuentes sin una vía jugada)
${docs.cuaderno.trim()}

#### 🎒 FICHA VIVA (ella la ve y la puede corregir; lo que no esté aquí ni en su ficha, no lo lleva)
${docs.ficha.trim()}
${
  ultima
    ? `
#### 📖 ÚLTIMA ENTRADA DE LA BITÁCORA — ${ultima.capitulo}${ultima.parte ? ` (parte ${ultima.parte})` : ''}
${ultima.texto.trim()}`
    : ''
}
`.trim();
}

// ---------------------------------------------------------------- las pantallas leen de los documentos

/*
 * 📚 LAS FICHAS SALEN DE LOS DOCUMENTOS, NO DE LAS ETIQUETAS.
 *
 * Las pantallas de PNJs, Lugares, Tramas y Protagonista eran bonitas pero se
 * alimentaban de etiquetas turno a turno y se desincronizaban. Con documentos
 * vivos, cada vez que el Cuaderno o la Ficha viva cambian (volcado, edición a
 * mano o deshacer) se leen aquí y se ponen al día solo los campos que dicen
 * los documentos. Retratos, apariencia, idiomas y lo que vino de los
 * compendios no se tocan.
 *
 * Escala: en el Cuaderno ATR, VÍN y CON van de 0 a 10, como en las
 * instrucciones de la mesa; las barras de la app van de 0 a 20.
 */

const plegar = (t: string) =>
  (t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Las secciones «## …» de un documento (sin el número de delante), con sus líneas. */
export function leerSecciones(doc: string): { titulo: string; clave: string; lineas: string[] }[] {
  const fuera: { titulo: string; clave: string; lineas: string[] }[] = [];
  for (const l of (doc || '').split('\n')) {
    const h = l.match(/^##\s+(.+?)\s*$/);
    if (h) {
      const titulo = h[1].replace(/^\d+[.)]\s*/, '').trim();
      fuera.push({ titulo, clave: plegar(titulo), lineas: [] });
    } else if (fuera.length) {
      fuera[fuera.length - 1].lineas.push(l);
    }
  }
  return fuera;
}

const seccionQue = (doc: string, ...claves: string[]) =>
  leerSecciones(doc).find(s => claves.some(c => s.clave.includes(c)));

/** Quita viñeta y negritas y deja la línea limpia; vacía si es un «(vacío)». */
const limpiarLinea = (l: string) => {
  const t = l.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').trim();
  return /^\(vac[ií]o\)$/i.test(t) ? '' : t;
};

/** El nombre al principio de una entrada: antes de « — », « (», «:» o «. ». */
const nombreDeEntrada = (t: string) =>
  t
    .replace(/\s*\[[^\]]*\]/g, '')
    .split(/\s+—\s+|\s+\(|:\s|\.\s/)[0]
    .replace(/[.,;:]+$/, '')
    .trim();

/** Palabras que abren una línea pero no son el nombre de nadie ni de ningún sitio. */
const NO_ES_NOMBRE = /^(otros?|otras?|varios|varias|resto|dem[aá]s|nota|ahora|general)$/i;

const aVeinte = (n: number) => Math.max(0, Math.min(20, Math.round(n * 2)));

export interface VinculoDelCuaderno {
  nombre: string;
  atr?: number;
  atraccion?: 'desea' | 'interes' | 'ninguna';
  vin?: number;
  con?: number;
  aparenta?: string;
  oculta?: string;
  impresion?: string;
  promesas?: string[];
  confidencias?: string[];
}

/** Los vínculos del Cuaderno. Si un PNJ sale varias veces, manda la última línea. */
export function leerVinculosDelCuaderno(cuaderno: string): VinculoDelCuaderno[] {
  const sec = seccionQue(cuaderno, 'vinculo');
  if (!sec) return [];
  const porNombre = new Map<string, VinculoDelCuaderno>();
  for (const bruto of sec.lineas) {
    let t = limpiarLinea(bruto);
    if (!t) continue;
    let nombre: string;
    const etiqueta = t.match(/^\[\s*V[IÍ]NCULO\s*:\s*([^|\]]+)\|(.*)\]?$/i);
    if (etiqueta) {
      nombre = etiqueta[1].trim();
      // En las líneas de historial, los valores buenos van tras la flecha.
      const tras = etiqueta[2].split('→');
      t = tras.length > 1 ? tras.slice(1).join('→') : etiqueta[2];
    } else {
      nombre = nombreDeEntrada(t);
    }
    if (!nombre || nombre.length > 60) continue;
    const previo = porNombre.get(plegar(nombre)) || { nombre };
    const v: VinculoDelCuaderno = { ...previo, nombre: previo.nombre || nombre };
    const num = (re: RegExp) => {
      const m = t.match(re);
      return m ? Number(m[1]) : undefined;
    };
    const atrTexto = t.match(/\bATR\s*[:=]?\s*(desea|inter[eé]s)/i);
    if (atrTexto) v.atraccion = /desea/i.test(atrTexto[1]) ? 'desea' : 'interes';
    const atr = num(/\bATR\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
    const vin = num(/\bV[IÍ]N\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
    const con = num(/\bCON\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
    if (atr !== undefined && !isNaN(atr)) {
      v.atr = aVeinte(atr);
      // La tarjeta enseña la atracción como «la desea» o «interés», no como barra.
      if (!atrTexto) v.atraccion = atr >= 6 ? 'desea' : atr >= 3 ? 'interes' : 'ninguna';
    }
    if (vin !== undefined && !isNaN(vin)) v.vin = aVeinte(vin);
    if (con !== undefined && !isNaN(con)) v.con = aVeinte(con);
    const campo = (...nombres: string[]) => {
      for (const n of nombres) {
        const m = t.match(new RegExp(`${n}\\s*:\\s*([^·|]+)`, 'i'));
        if (m && m[1].trim()) return m[1].trim().replace(/[.;]$/, '');
      }
      return undefined;
    };
    v.aparenta = campo('aparenta') ?? v.aparenta;
    v.oculta = campo('oculta') ?? v.oculta;
    v.impresion = campo('piensa de ella', 'impresi[oó]n') ?? v.impresion;
    const promesas = campo('promesas?');
    if (promesas) v.promesas = promesas.split(/;\s*/).filter(Boolean);
    const confidencias = campo('confidencias?');
    if (confidencias) v.confidencias = confidencias.split(/;\s*/).filter(Boolean);
    porNombre.set(plegar(nombre), v);
  }
  return [...porNombre.values()];
}

/** Entradas «Nombre — lo que sea» de una sección (PNJs menores, lugares…). */
function leerEntradas(doc: string, ...claves: string[]): { nombre: string; texto: string }[] {
  const sec = seccionQue(doc, ...claves);
  if (!sec) return [];
  const fuera: { nombre: string; texto: string }[] = [];
  for (const bruto of sec.lineas) {
    if (/^\s*#/.test(bruto)) continue;
    const t = limpiarLinea(bruto);
    if (!t || t.startsWith('[') || t.startsWith('>')) continue;
    const nombre = nombreDeEntrada(t);
    if (!nombre || NO_ES_NOMBRE.test(nombre) || nombre.length > 60 || nombre.split(' ').length > 7) continue;
    const texto = t
      .replace(/\s*\[[^\]]*\]/g, '')
      .slice(nombre.length)
      .replace(/^\s*(—|:|\.)\s*/, '')
      .trim();
    const ya = fuera.find(e => plegar(e.nombre) === plegar(nombre));
    if (ya) ya.texto = [ya.texto, texto].filter(Boolean).join(' ');
    else fuera.push({ nombre, texto });
  }
  return fuera;
}

export interface TramaDelCuaderno {
  titulo: string;
  escala?: string;
  loQueParece?: string;
}

/** Las tramas abiertas. «La verdad» NO se lee: la pantalla de Tramas la ve ella. */
export function leerTramasDelCuaderno(cuaderno: string): TramaDelCuaderno[] {
  const sec = seccionQue(cuaderno, 'verdad oculta', 'tramas');
  if (!sec) return [];
  const fuera: TramaDelCuaderno[] = [];
  for (const bruto of sec.lineas) {
    const h = bruto.match(/^#{3,}\s*(?:TRAMA\s*:\s*)?(.+?)\s*$/i);
    if (h) {
      const [titulo, escala] = h[1].split(/\s+—\s+/);
      fuera.push({ titulo: titulo.replace(/\*\*/g, '').trim(), escala: escala?.trim().toLowerCase() });
      continue;
    }
    const t = limpiarLinea(bruto);
    if (!t) continue;
    const parece = t.match(/^lo que parece\s*:\s*(.+)$/i);
    if (parece && fuera.length) {
      fuera[fuera.length - 1].loQueParece = parece[1].trim();
      continue;
    }
    // Formato corto de una línea: «Nombre [escala] — objetivo: …»
    const corta = bruto.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s*(?:\[([^\]]+)\])?\s*(?:—\s*(.*))?$/);
    if (corta && !/^(premisa|hacia d[oó]nde)/i.test(corta[1])) {
      const objetivo = (corta[3] || '').match(/objetivo\s*:\s*([^·]+)/i)?.[1]?.trim();
      fuera.push({ titulo: corta[1].trim(), escala: corta[2]?.trim().toLowerCase(), loQueParece: objetivo });
    }
  }
  return fuera.filter(t => t.titulo);
}

/** Nivel y PG máximos de la Ficha viva, y el avance de la última entrada de bitácora. */
export function leerProgresion(docs: DocumentosVivos): {
  nivel?: string;
  maxHp?: number;
  hitos?: number;
  hitosParaSubir?: number;
} {
  const sec = seccionQue(docs.ficha, 'nivel', 'estado');
  const texto = sec ? sec.lineas.join('\n') : '';
  const nivel = texto.match(/\bNivel\s+(\d+)/i)?.[1];
  const pg = texto.match(/\bPG\s*(?:[:=]\s*)?\d+\s*\/\s*(\d+)/i)?.[1];
  const ultima = docs.bitacora[docs.bitacora.length - 1]?.texto || '';
  const avance = ultima.match(/\[\s*Avance\s*:\s*(\d+)\s*\/\s*(\d+)/i);
  return {
    nivel,
    maxHp: pg ? Number(pg) : undefined,
    hitos: avance ? Number(avance[1]) : undefined,
    hitosParaSubir: avance ? Number(avance[2]) : undefined
  };
}

const idNuevo = (pre: string) => `${pre}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const slug = (t: string) => plegar(t).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

/**
 * Pone al día PNJs, lugares, tramas y progresión con lo que dicen los
 * documentos. Se llama cada vez que cambian, y es idempotente: aplicarlo dos
 * veces da lo mismo.
 */
export function sincronizarFichasConDocumentos(mem: Memory): Memory {
  const docs = mem.documentos_vivos;
  if (!docs || !(docs.cuaderno || docs.ficha)) return mem;

  // ---- PNJs: vínculos y PNJs menores
  let npcs = [...(mem.npcs || [])];
  const buscar = (nombre: string) =>
    npcs.findIndex(n => coincidenNombresNpc(nombre, n.name, undefined, { alias: n.alias, trueIdentity: n.trueIdentity }));
  const esElla = (nombre: string) => {
    const pj = mem.player_character?.name;
    return Boolean(pj && coincidenNombresNpc(nombre, pj));
  };
  const nuevoNpc = (nombre: string, notas: string): NPC => ({
    id: idNuevo('npc_doc'),
    name: nombre,
    relation: '',
    status: '',
    notes: notas
  });

  for (const v of leerVinculosDelCuaderno(docs.cuaderno)) {
    if (esElla(v.nombre)) continue;
    let i = buscar(v.nombre);
    if (i < 0) {
      npcs.push(nuevoNpc(v.nombre, v.aparenta || ''));
      i = npcs.length - 1;
    }
    const n = npcs[i];
    npcs[i] = {
      ...n,
      ...(v.atr !== undefined ? { atr: v.atr } : {}),
      ...(v.atraccion ? { atraccion: v.atraccion === 'ninguna' ? undefined : v.atraccion } : {}),
      ...(v.vin !== undefined ? { vin: v.vin } : {}),
      ...(v.con !== undefined ? { con: v.con } : {}),
      ...(v.aparenta ? { aparenta: v.aparenta } : {}),
      ...(v.oculta ? { oculta: v.oculta } : {}),
      ...(v.impresion ? { impresionActual: v.impresion } : {}),
      ...(v.promesas ? { promesas: v.promesas } : {}),
      ...(v.confidencias ? { confidencias: v.confidencias } : {})
    };
  }
  for (const e of leerEntradas(docs.cuaderno, 'pnjs menores', 'pnj menores', 'secundarios')) {
    if (esElla(e.nombre) || buscar(e.nombre) >= 0) continue;
    npcs.push(nuevoNpc(e.nombre, e.texto));
  }

  // ---- Lugares
  let locations = [...(mem.locations || [])];
  for (const e of leerEntradas(docs.cuaderno, 'lugares')) {
    const i = locations.findIndex(l => plegar(l.name) === plegar(e.nombre));
    if (i < 0) {
      locations.push({ id: idNuevo('loc_doc'), name: e.nombre, desc: e.texto, notes: '' });
    } else if (!(locations[i].desc || '').trim() && e.texto) {
      locations[i] = { ...locations[i], desc: e.texto };
    }
  }

  // ---- Tramas: las del Cuaderno abiertas; las que salieron de él y ya no están, cerradas
  const tramas = leerTramasDelCuaderno(docs.cuaderno);
  const quests = (mem.quests || []).map(q => {
    const t = tramas.find(x => plegar(x.titulo) === plegar(q.title));
    if (t) {
      return {
        ...q,
        status: 'Activa',
        ...(t.escala ? { type: t.escala } : {}),
        ...(t.loQueParece && !q.objective ? { objective: t.loQueParece } : {})
      };
    }
    return q.id.startsWith('q_doc_') && q.status === 'Activa' ? { ...q, status: 'Completada' } : q;
  });
  for (const t of tramas) {
    if (quests.some(q => plegar(q.title) === plegar(t.titulo))) continue;
    quests.push({
      id: `q_doc_${slug(t.titulo)}`,
      title: t.titulo,
      origin: '',
      objective: t.loQueParece || '',
      progress: '',
      status: 'Activa',
      type: t.escala || 'secundaria'
    });
  }

  // ---- Protagonista: nivel, PG máximos y avance
  const prog = leerProgresion(docs);
  const pc = mem.player_character;
  const player_character = pc
    ? {
        ...pc,
        ...(prog.nivel ? { level: prog.nivel } : {}),
        ...(prog.maxHp ? { maxHp: prog.maxHp } : {}),
        ...(prog.hitos !== undefined && prog.hitosParaSubir
          ? {
              hitosActuales: prog.hitos,
              hitosParaSubir: prog.hitosParaSubir,
              levelProgress: Math.max(0, Math.min(100, Math.round((prog.hitos / prog.hitosParaSubir) * 100)))
            }
          : {})
      }
    : pc;

  return { ...mem, npcs, locations, quests, player_character };
}
