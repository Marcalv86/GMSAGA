import type {
  DocumentosVivos,
  EntradaDeBitacora,
  InventoryItem,
  Memory,
  VersionDeDocumento
} from '../types';

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
        typeof n.vin === 'number' ? `VÍN ${n.vin}` : '',
        typeof n.con === 'number' ? `CON ${n.con}` : ''
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
- ⛔ Estos documentos NO los actualizas tú desde el chat: **no emitas** \`[INVENTARIO:]\`, \`[BAMBALINAS:]\`, \`[RELOJ:]\`, \`[FACCIÓN:]\` ni \`[PREPARADO:]\`. Lleva lo que cambie en la cabeza; se vuelca de una sentada al cerrar el capítulo.
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
