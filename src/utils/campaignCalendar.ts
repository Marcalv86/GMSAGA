import { CalendarConfig, CampaignDate, ScheduledThread } from '../types';
import { coincidenNombresNpc } from './npcMatcher';

/**
 * El tiempo de la campaña.
 *
 * No es un adorno de la interfaz: es lo que permite que el mundo actúe mientras
 * el protagonista mira a otro lado. Un calendario sin consecuencias con fecha de
 * vencimiento es una fecha bonita en una esquina; con ellas, la vigilancia que
 * empezó el día que llegaste se vuelve evidente a los quince días aunque te
 * hayas olvidado por completo de que existía.
 *
 * El calendario es configurable a propósito. Doce meses de treinta días con
 * festivales sueltos sirven para una fantasía; una campaña espacial cuenta por
 * ciclos y una moderna usa el nuestro. Se define una vez por campaña.
 */

// ---------------------------------------------------------------- presets

export const CALENDARIO_GREGORIANO: CalendarConfig = {
  name: 'Gregoriano',
  months: [
    { name: 'enero', days: 31 },
    { name: 'febrero', days: 28 },
    { name: 'marzo', days: 31 },
    { name: 'abril', days: 30 },
    { name: 'mayo', days: 31 },
    { name: 'junio', days: 30 },
    { name: 'julio', days: 31 },
    { name: 'agosto', days: 31 },
    { name: 'septiembre', days: 30 },
    { name: 'octubre', days: 31 },
    { name: 'noviembre', days: 30 },
    { name: 'diciembre', days: 31 }
  ],
  festivals: [],
  weekdays: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
  yearSuffix: ''
};

/**
 * Doce meses de treinta días con cinco festivales intercalares: la forma clásica
 * de los calendarios de fantasía. Los nombres son estacionales y neutros para que
 * valgan en cualquier mundo; cámbialos por los tuyos en cuanto tengas los propios.
 */
export const CALENDARIO_FANTASTICO: CalendarConfig = {
  name: 'Fantástico genérico',
  months: [
    { name: 'Alba', days: 30 },
    { name: 'Deshielo', days: 30 },
    { name: 'Siembra', days: 30 },
    { name: 'Flor', days: 30 },
    { name: 'Solsticio', days: 30 },
    { name: 'Ardiente', days: 30 },
    { name: 'Siega', days: 30 },
    { name: 'Grano', days: 30 },
    { name: 'Ocaso', days: 30 },
    { name: 'Bruma', days: 30 },
    { name: 'Escarcha', days: 30 },
    { name: 'Sepulcro', days: 30 }
  ],
  festivals: [
    { name: 'Noche de las Semillas', afterMonth: 2 },
    { name: 'Fuego Alto', afterMonth: 5 },
    { name: 'Fiesta de la Siega', afterMonth: 7 },
    { name: 'Velada de las Sombras', afterMonth: 9 },
    { name: 'Vigilia del Año', afterMonth: 11 }
  ],
  weekdays: [],
  yearSuffix: ''
};

export const CALENDARIOS_PREDEFINIDOS: CalendarConfig[] = [CALENDARIO_FANTASTICO, CALENDARIO_GREGORIANO];

export const MINUTOS_POR_DIA = 24 * 60;

// ---------------------------------------------------------------- estructura del año

interface DaySlot {
  kind: 'month' | 'festival';
  monthIndex: number;
  day: number;
  festivalName?: string;
}

const layoutCache = new Map<string, DaySlot[]>();

/**
 * Despliega el año en una lista ordenada de días, intercalando los festivales
 * donde toque. Se memoriza porque se consulta en cada formateo y un año son
 * varios cientos de entradas.
 */
function yearLayout(cal: CalendarConfig): DaySlot[] {
  const key = JSON.stringify([cal.months, cal.festivals]);
  const hit = layoutCache.get(key);
  if (hit) return hit;

  const slots: DaySlot[] = [];
  cal.months.forEach((m, mi) => {
    for (let d = 1; d <= m.days; d++) {
      slots.push({ kind: 'month', monthIndex: mi, day: d });
    }
    (cal.festivals || [])
      .filter(f => f.afterMonth === mi)
      .forEach(f => slots.push({ kind: 'festival', monthIndex: mi, day: 0, festivalName: f.name }));
  });

  layoutCache.set(key, slots);
  return slots;
}

export function diasPorAno(cal: CalendarConfig): number {
  return yearLayout(cal).length;
}

export function calendarioValido(cal: CalendarConfig | undefined): cal is CalendarConfig {
  return Boolean(cal && Array.isArray(cal.months) && cal.months.length > 0 && diasPorAno(cal) > 0);
}

// ---------------------------------------------------------------- conversiones

/**
 * Día absoluto desde el origen del calendario. Es el número con el que se
 * comparan vencimientos: comparar «año, mes y día» por separado invita a errores
 * en cada cambio de mes.
 */
export function aDiaAbsoluto(cal: CalendarConfig, fecha: CampaignDate): number {
  const porAno = diasPorAno(cal);
  return (fecha.year - 1) * porAno + (fecha.dayOfYear - 1);
}

export function desdeDiaAbsoluto(cal: CalendarConfig, abs: number, minuto = 0): CampaignDate {
  const porAno = diasPorAno(cal);
  const year = Math.floor(abs / porAno) + 1;
  const dayOfYear = (((abs % porAno) + porAno) % porAno) + 1;
  return { year, dayOfYear, minute: minuto };
}

/** Amanecida del primer día: un comienzo neutro para cualquier campaña. */
export function fechaInicial(year = 1): CampaignDate {
  return { year, dayOfYear: 1, minute: 8 * 60 };
}

/** Normaliza una fecha cuyos minutos o día se hayan salido de rango. */
export function normalizar(cal: CalendarConfig, fecha: CampaignDate): CampaignDate {
  const porAno = diasPorAno(cal);
  let minute = Math.round(fecha.minute || 0);
  let dias = Math.floor(minute / MINUTOS_POR_DIA);
  minute -= dias * MINUTOS_POR_DIA;

  let abs = (fecha.year - 1) * porAno + (fecha.dayOfYear - 1) + dias;
  if (abs < 0) abs = 0;
  const base = desdeDiaAbsoluto(cal, abs, minute);
  return base;
}

export function avanzar(
  cal: CalendarConfig,
  fecha: CampaignDate,
  { dias = 0, horas = 0, minutos = 0 }: { dias?: number; horas?: number; minutos?: number }
): CampaignDate {
  return normalizar(cal, {
    year: fecha.year,
    dayOfYear: fecha.dayOfYear + dias,
    minute: (fecha.minute || 0) + horas * 60 + minutos
  });
}

// ---------------------------------------------------------------- formateo

const FRANJAS: { hasta: number; nombre: string }[] = [
  { hasta: 5, nombre: 'de madrugada' },
  { hasta: 7, nombre: 'al amanecer' },
  { hasta: 12, nombre: 'por la mañana' },
  { hasta: 14, nombre: 'al mediodía' },
  { hasta: 19, nombre: 'por la tarde' },
  { hasta: 21, nombre: 'al anochecer' },
  { hasta: 24, nombre: 'de noche' }
];

export function franjaDelDia(minuto: number): string {
  const hora = Math.floor((minuto || 0) / 60);
  return (FRANJAS.find(f => hora < f.hasta) || FRANJAS[FRANJAS.length - 1]).nombre;
}

export function horaLegible(minuto: number): string {
  const m = Math.max(0, Math.round(minuto || 0)) % MINUTOS_POR_DIA;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** «3 de Siembra de 1492» o «Fuego Alto de 1492» si cae en festival. */
export function fechaLegible(cal: CalendarConfig, fecha: CampaignDate): string {
  const slots = yearLayout(cal);
  const slot = slots[Math.min(Math.max(0, fecha.dayOfYear - 1), slots.length - 1)];
  const sufijo = cal.yearSuffix ? ` ${cal.yearSuffix}` : '';
  if (!slot) return `año ${fecha.year}${sufijo}`;
  if (slot.kind === 'festival') return `${slot.festivalName} de ${fecha.year}${sufijo}`;
  return `${slot.day} de ${cal.months[slot.monthIndex]?.name || '?'} de ${fecha.year}${sufijo}`;
}

/** Lo que ve el Narrador: fecha, franja y hora exacta. */
export function fechaCompleta(cal: CalendarConfig, fecha: CampaignDate): string {
  return `${fechaLegible(cal, fecha)}, ${franjaDelDia(fecha.minute)} (${horaLegible(fecha.minute)})`;
}

/** Versión corta para la cabecera, donde no cabe todo. */
export function fechaCompacta(cal: CalendarConfig, fecha: CampaignDate): string {
  const slots = yearLayout(cal);
  const slot = slots[Math.min(Math.max(0, fecha.dayOfYear - 1), slots.length - 1)];
  if (!slot) return `${horaLegible(fecha.minute)}`;
  const dia =
    slot.kind === 'festival' ? slot.festivalName : `${slot.day} ${cal.months[slot.monthIndex]?.name || ''}`;
  return `${dia} · ${horaLegible(fecha.minute)}`;
}

/** «faltan 3 días», «hoy», «venció hace 2 días». */
export function distanciaEnDias(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias > 1) return `en ${dias} días`;
  if (dias === -1) return 'venció ayer';
  return `venció hace ${Math.abs(dias)} días`;
}

// ---------------------------------------------------------------- etiquetas del Narrador

const TIEMPO_RE = /\[\s*TIEMPO\s*:\s*([^\]]+)\]/gi;
const AGENDA_RE = /\[\s*AGENDA\s*:\s*([^\]]+)\]/gi;
const HILO_RE = /\[\s*HILO\s*:\s*([^\]]+)\]/gi;

/**
 * Lee `[TIEMPO: +2h]`, `[TIEMPO: +1d 6h]`, `[TIEMPO: +45m]` o `[TIEMPO: +3 días]`.
 * Devuelve el total en minutos. Si el Narrador no dice nada, no pasa el tiempo:
 * es preferible un reloj parado a uno que corre solo.
 */
export function leerAvanceDeTiempo(texto: string): { minutos: number; encontrado: boolean } {
  if (!texto) return { minutos: 0, encontrado: false };
  TIEMPO_RE.lastIndex = 0;
  let total = 0;
  let encontrado = false;
  let m: RegExpExecArray | null;
  while ((m = TIEMPO_RE.exec(texto)) !== null) {
    const cuerpo = m[1].toLowerCase();
    const partes = cuerpo.matchAll(
      /(\d+(?:[.,]\d+)?)\s*(d[ií]as?|d|h(?:oras?)?|m(?:in(?:utos?)?)?|semanas?|s)\b/g
    );
    let parcial = 0;
    for (const p of partes) {
      const n = parseFloat(p[1].replace(',', '.'));
      const u = p[2];
      if (u.startsWith('sem') || u === 's') parcial += n * 7 * MINUTOS_POR_DIA;
      else if (u.startsWith('d')) parcial += n * MINUTOS_POR_DIA;
      else if (u.startsWith('h')) parcial += n * 60;
      else parcial += n;
    }
    if (parcial > 0) {
      total += parcial;
      encontrado = true;
    }
  }
  return { minutos: Math.round(total), encontrado };
}

export interface EntradaDeAgenda {
  resumen: string;
  lugar?: string;
  clima?: string;
  hito?: string;
  diaOffset?: number;
  tipo?: 'acontecimiento' | 'noticia' | 'rumor' | 'inconsciencia' | 'salto_temporal';
}

/**
 * Lee `[AGENDA: resumen | lugar: X | clima: Y | hito: tipo — texto | dia: +2 | tipo: noticia/rumor/inconsciencia]`.
 *
 * Los campos son opcionales y van por nombre, no por posición: un modelo se salta
 * un campo intermedio con toda naturalidad, y si se leyeran por orden acabaría
 * apuntándose el clima en el lugar.
 */
export function leerAgenda(texto: string): EntradaDeAgenda[] {
  if (!texto) return [];
  AGENDA_RE.lastIndex = 0;
  const out: EntradaDeAgenda[] = [];
  let m: RegExpExecArray | null;
  while ((m = AGENDA_RE.exec(texto)) !== null) {
    const partes = m[1].split('|').map(p => p.trim());
    const resumen = (partes.shift() || '').trim();
    if (!resumen) continue;

    const entrada: EntradaDeAgenda = { resumen };
    for (const parte of partes) {
      const corte = parte.indexOf(':');
      if (corte < 1) continue;
      const campo = sinTildes(parte.slice(0, corte)).trim();
      const valor = parte.slice(corte + 1).trim();
      if (!valor) continue;
      if (campo === 'lugar') entrada.lugar = valor;
      else if (campo === 'clima' || campo === 'tiempo') entrada.clima = valor;
      else if (campo === 'hito') entrada.hito = valor;
      else if (campo === 'dia' || campo === 'offset' || campo === 'diaoffset') {
        const num = parseInt(valor.replace(/[^\d+-]/g, ''), 10);
        if (Number.isFinite(num)) entrada.diaOffset = num;
      }
      else if (campo === 'tipo' || campo === 'categoria') {
        const valNorm = sinTildes(valor);
        if (/noticia|prensa|bando|gaceta|pregonero/i.test(valNorm)) entrada.tipo = 'noticia';
        else if (/rumor|murmullo|taberna/i.test(valNorm)) entrada.tipo = 'rumor';
        else if (/inconscien|coma|convalecen|letargo|herido/i.test(valNorm)) entrada.tipo = 'inconsciencia';
        else if (/salto|elipsis/i.test(valNorm)) entrada.tipo = 'salto_temporal';
        else entrada.tipo = 'acontecimiento';
      }
    }

    // Detección automática de categoría según hito o resumen si no viene explícita
    if (!entrada.tipo) {
      const textoCompleto = `${entrada.hito || ''} ${entrada.resumen}`.toLowerCase();
      if (/noticia|pregonero|bando municipal|gaceta|tabl[oó]n de anuncios|comunicado|noticias/i.test(textoCompleto)) {
        entrada.tipo = 'noticia';
      } else if (/rumor|se dice en|se comenta|habladur[ií]as|murmullos en la taberna/i.test(textoCompleto)) {
        entrada.tipo = 'rumor';
      } else if (/inconscien|en coma|desmayad|recuper[aá]ndose de las heridas|convalecen|enfermer[ií]a|despert[oó] tras/i.test(textoCompleto)) {
        entrada.tipo = 'inconsciencia';
      } else if (/salto temporal|pasaron los d[ií]as|semanas despu[eé]s/i.test(textoCompleto)) {
        entrada.tipo = 'salto_temporal';
      }
    }

    out.push(entrada);
  }
  return out;
}

/** Sin tildes y en minúsculas, para comparar palabras sin sorpresas. */
function sinTildes(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// ---------------------------------------------------------------- iconos

/**
 * El diario se lee de un vistazo, y un icono se lee antes que una palabra.
 *
 * Es la única parte de la aplicación con emojis a propósito: en el resto se usan
 * iconos de trazo, pero aquí lo que se busca es que el diario apetezca abrirlo.
 */
const CLIMAS: [RegExp, string][] = [
  [/tormenta|rayo|relámpag|trueno/i, '⛈️'],
  [/nieve|nevad|ventisca|granizo/i, '❄️'],
  [/lluvia|llovizna|chubasco|aguacero|lloviendo|húmed/i, '🌧️'],
  [/niebla|bruma|neblin/i, '🌫️'],
  [/viento|vendaval|racha|galerna/i, '💨'],
  [/nublad|nubes|encapotad|gris|plomiz/i, '☁️'],
  [/despejad|sol|soleado|claro|luminos/i, '☀️'],
  [/bochorn|calor|sofocante|abrasador/i, '🔥'],
  [/frío|helad|gélid|escarcha/i, '🥶']
];

export function iconoDeClima(clima?: string): string {
  if (!clima) return '';
  return (CLIMAS.find(([re]) => re.test(clima)) || [, '🌤️'])[1] as string;
}

export function iconoDeFranja(minuto?: number): string {
  if (minuto === undefined) return '';
  const hora = Math.floor(minuto / 60);
  if (hora < 5) return '🌑';
  if (hora < 7) return '🌅';
  if (hora < 12) return '🌤️';
  if (hora < 14) return '☀️';
  if (hora < 19) return '🌇';
  if (hora < 21) return '🌆';
  return '🌙';
}

const HITOS: [RegExp, string][] = [
  [/descanso|dormir|acamp|sueño|pernoct|reposo|aliento/i, '⛺'],
  [/inconscien|coma|desmay|convalecen|fiebre|letargo|enfermer|despertar/i, '💤'],
  [/reloj|semilla|hilo|tiempo|plazo|cuenta\s*atr[aá]s/i, '⏳'],
  [/consecuencia|repercusi[oó]n|secuela|efecto\s*colateral|gremio|familia|zona/i, '💥'],
  [/rumor|noticia|prensa|pregonero|bando|gaceta|aviso|tabl[oó]n|comunicado|habladur/i, '📜'],
  [/rivalidad|rival|competidor|desaf[ií]o|enfrentamiento/i, '⚔️'],
  [/romance|amor|enamor|cortej|declaraci[oó]n|insinuaci[oó]n|pasi[oó]n|sexual|emocional|pareja|beso|inter[eé]s\s*rom[aá]ntico/i, '💘'],
  [/amistad|amigo|camarada|confidente|cercan[ií]a|afecto/i, '❇️'],
  [/enemistad|enemigo|antagonista|rencor|odio|hostil|venganza/i, '💀'],
  [/alianza|pacto|juramento|promesa|trato|socio/i, '🤝'],
  [/mentor|maestro|tutor|protector|custodio/i, '🛡️'],
  [/guerra|asedio|invasi[oó]n|asalto|tropas|ej[eé]rcito|ataque/i, '⚔️'],
  [/muerte|muri|caíd|funeral|entierr|luto/i, '🕯️'],
  [/combate|batalla|duelo|pelea|abordaje|emboscada/i, '⚔️'],
  [/traici|engañ|mentir|puñalada/i, '🗡️'],
  [/hallazg|encontr|tesoro|reliquia|descubr/i, '💎'],
  [/revelaci|secreto|verdad|desvel/i, '🔍'],
  [/viaje|partida|zarp|rumbo|llegad/i, '🧭'],
  [/herid|veneno|enferm|maldici/i, '🩸'],
  [/nivel|logro|maestr|ascens|título/i, '⭐'],
  [/pérdida|robo|perdi|arruin|desamor|ruptura/i, '💔']
];

export function iconoDeHito(hito?: string): string {
  if (!hito) return '';
  return (HITOS.find(([re]) => re.test(hito)) || [, '✨'])[1] as string;
}

export interface RelacionInfo {
  icono: string;
  tipo: 'rivalidad' | 'amistad' | 'romance' | 'enemistad' | 'alianza' | 'mentor' | 'ruptura' | 'desconfianza' | 'neutral';
  label: string;
  badgeClass: string;
}

/**
 * Devuelve el icono y estilo adecuado para un tipo o grado de relación con un PNJ:
 * ⚔️ = Rivalidad
 * ❇️ = Amistad
 * 💘 = Interés romántico (sexual o emocional, insinuación o declaración)
 * 💀 = Enemistad
 * 🤝 = Alianza / Negocio
 * 🛡️ = Mentor / Protector
 * 💔 = Ruptura / Traición
 * 👁️ = Desconfianza / Tensión
 * ⚖️ = Neutral
 */
export function obtenerInfoRelacion(texto?: string): RelacionInfo {
  if (!texto) {
    return {
      icono: '⚖️',
      tipo: 'neutral',
      label: 'Conocido',
      badgeClass: 'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900/60 dark:text-stone-300 dark:border-stone-700'
    };
  }

  const t = sinTildes(texto);

  // Rivalidad
  if (/rival|competidor|desafio|duelo|antagonis|enfrentad|rivalidad/i.test(t)) {
    return {
      icono: '⚔️',
      tipo: 'rivalidad',
      label: 'Rivalidad',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60'
    };
  }

  // Interés Romántico / Amor / Romance
  if (/romance|amor|enamor|cortej|declaraci|insinuaci|pasion|sexual|emocional|pareja|beso|amante|interes romantico|atracci|quimica/i.test(t)) {
    return {
      icono: '💘',
      tipo: 'romance',
      label: 'Interés Romántico',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700/60'
    };
  }

  // Amistad / Camarada
  if (/amistad|amig|camarada|confidente|cercan|afecto|leal|fratern/i.test(t)) {
    return {
      icono: '❇️',
      tipo: 'amistad',
      label: 'Amistad',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60'
    };
  }

  // Enemistad / Odio
  if (/enemig|antagonista|rencor|odio|hostil|venganza|enemistad|amenaza/i.test(t)) {
    return {
      icono: '💀',
      tipo: 'enemistad',
      label: 'Enemistad',
      badgeClass: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700/60'
    };
  }

  // Alianza / Pacto
  if (/alian|pacto|juramento|promesa|trato|socio|negocio/i.test(t)) {
    return {
      icono: '🤝',
      tipo: 'alianza',
      label: 'Alianza / Pacto',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/60'
    };
  }

  // Mentor / Protector
  if (/mentor|maestro|tutor|protector|custodio|guia/i.test(t)) {
    return {
      icono: '🛡️',
      tipo: 'mentor',
      label: 'Mentor / Protector',
      badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700/60'
    };
  }

  // Ruptura / Traición
  if (/traici|ruptura|desamor|desengano|abandono/i.test(t)) {
    return {
      icono: '💔',
      tipo: 'ruptura',
      label: 'Ruptura / Traición',
      badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700/60'
    };
  }

  // Desconfianza / Tensión
  if (/desconfian|tension|suspicaz|recelo|vigilancia|frialdad/i.test(t)) {
    return {
      icono: '👁️',
      tipo: 'desconfianza',
      label: 'Desconfianza',
      badgeClass: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-700/60'
    };
  }

  return {
    icono: '⚖️',
    tipo: 'neutral',
    label: texto,
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900/60 dark:text-stone-300 dark:border-stone-700'
  };
}

export function iconoDeRelacion(texto?: string): string {
  return obtenerInfoRelacion(texto).icono;
}

export interface Estacion {
  nombre: string;
  icono: string;
}

/**
 * La estación, deducida de en qué punto del año cae el día.
 *
 * Es una aproximación deliberada: se reparte el año en cuatro y se asume que
 * empieza en primavera, que es como está construido casi cualquier calendario de
 * fantasía. Si el mes lleva el nombre de la estación —«Primer mes de Primavera»—
 * eso manda sobre el cálculo, porque el propio calendario ya lo está diciendo.
 */
export function estacionDelDia(cal: CalendarConfig, dayOfYear: number): Estacion {
  const slots = yearLayout(cal);
  const slot = slots[Math.min(Math.max(0, dayOfYear - 1), slots.length - 1)];
  const nombreMes = sinTildes(cal.months[slot?.monthIndex ?? 0]?.name || '');

  if (/primavera/.test(nombreMes)) return { nombre: 'primavera', icono: '🌱' };
  if (/verano|estio/.test(nombreMes)) return { nombre: 'verano', icono: '🌞' };
  if (/otono/.test(nombreMes)) return { nombre: 'otoño', icono: '🍂' };
  if (/invierno/.test(nombreMes)) return { nombre: 'invierno', icono: '❄️' };

  const fraccion = (dayOfYear - 1) / Math.max(1, slots.length);
  if (fraccion < 0.25) return { nombre: 'primavera', icono: '🌱' };
  if (fraccion < 0.5) return { nombre: 'verano', icono: '🌞' };
  if (fraccion < 0.75) return { nombre: 'otoño', icono: '🍂' };
  return { nombre: 'invierno', icono: '❄️' };
}

export interface HiloLeido {
  title: string;
  dueInDays: number;
  effect: string;
  hidden: boolean;
}

/**
 * Lee `[HILO: título | vence en 15d | efecto | oculto]`.
 * El último campo es opcional; sin él, el hilo es visible para el jugador.
 */
export function leerHilos(texto: string): HiloLeido[] {
  if (!texto) return [];
  HILO_RE.lastIndex = 0;
  const out: HiloLeido[] = [];
  let m: RegExpExecArray | null;
  while ((m = HILO_RE.exec(texto)) !== null) {
    const campos = m[1].split('|').map(s => s.trim());
    const title = campos[0];
    if (!title) continue;

    const plazo = campos[1] || '';
    const { minutos } = leerAvanceDeTiempo(`[TIEMPO: ${plazo}]`);
    const dias = minutos > 0 ? Math.max(1, Math.round(minutos / MINUTOS_POR_DIA)) : 0;
    if (!dias) continue;

    out.push({
      title,
      dueInDays: dias,
      effect: campos[2] || title,
      hidden: /oculto|secreto/i.test(campos[3] || '')
    });
  }
  return out;
}

/** Quita las etiquetas de tiempo del texto que lee el jugador. */
export function limpiarEtiquetasDeTiempo(texto: string): string {
  if (!texto || !texto.includes('[')) return texto;
  return texto
    .replace(TIEMPO_RE, '')
    .replace(AGENDA_RE, '')
    .replace(HILO_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------- hilos

export function hilosQueVencen(hilos: ScheduledThread[], diaAbs: number): ScheduledThread[] {
  return (hilos || []).filter(h => h.status === 'pending' && h.dueAbsDay <= diaAbs);
}

export function hilosPendientes(hilos: ScheduledThread[]): ScheduledThread[] {
  return (hilos || []).filter(h => h.status === 'pending');
}

/** Un identificador estable sin depender de la hora del sistema. */
export function nuevoIdHilo(existentes: ScheduledThread[]): string {
  const n = (existentes || []).length + 1;
  return `hilo_${n}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------- rejilla mensual

export interface DiaDelMes {
  /** Día del año, 1-based: la clave para comparar con cualquier fecha. */
  dayOfYear: number;
  /** Lo que se pinta en la casilla: el número del día o el nombre del festival. */
  etiqueta: string;
  esFestival: boolean;
}

/**
 * Los días de un mes, con sus festivales intercalares al final.
 *
 * Los festivales no pertenecen a ningún mes de verdad —por eso son intercalares—
 * pero tienen que verse en algún sitio, así que se cuelgan del mes tras el que
 * caen y se pintan aparte para que quede claro que no son días normales.
 */
export function diasDelMes(cal: CalendarConfig, monthIndex: number): DiaDelMes[] {
  const slots = yearLayout(cal);
  const out: DiaDelMes[] = [];
  slots.forEach((s, i) => {
    if (s.monthIndex !== monthIndex) return;
    out.push({
      dayOfYear: i + 1,
      etiqueta: s.kind === 'festival' ? s.festivalName || 'Festival' : String(s.day),
      esFestival: s.kind === 'festival'
    });
  });
  return out;
}

/** A qué mes pertenece un día del año (para abrir la rejilla donde toca). */
export function mesDelDia(cal: CalendarConfig, dayOfYear: number): number {
  const slots = yearLayout(cal);
  const slot = slots[Math.min(Math.max(0, dayOfYear - 1), slots.length - 1)];
  return slot ? slot.monthIndex : 0;
}

/**
 * Nombre del día de la semana, si el calendario define semanas. Se ancla al día 1
 * del año 1: sin una referencia externa, cualquier otro anclaje sería igual de
 * arbitrario y este al menos es estable entre partidas.
 */
export function diaDeLaSemana(cal: CalendarConfig, diaAbs: number): string | null {
  const dias = cal.weekdays || [];
  if (!dias.length) return null;
  const i = ((diaAbs % dias.length) + dias.length) % dias.length;
  return dias[i];
}

// ---------------------------------------------------------------- presencia y vínculos

const PRESENTES_RE = /\[\s*PRESENTES\s*:\s*([^\]]+)\]/gi;
const VINCULO_RE = /\[\s*V[IÍ]NCULO\s*:\s*([^\]]+)\]/gi;
const AFINIDAD_TAG_RE = /\[\s*AFINIDAD\s*:\s*([^\]]+)\]/gi;
const AFINIDAD_INLINE_RE = /(?:🖤|♥|❤️|🤍|💔|❤️‍🔥)\s*([^—\-\n\r]+?)\s*[-—]\s*ATR:\s*(\d{1,2})\s*\|\s*V[IÍ]N:\s*(\d{1,2})\s*\|\s*CON:\s*(\d{1,2})/gi;

/** Quién ha estado en escena, para contar quién vuelve y quién fue de paso. */
export function leerPresentes(texto: string): string[] {
  if (!texto || !/PRESENTES/i.test(texto)) return [];
  PRESENTES_RE.lastIndex = 0;
  const out: string[] = [];
  const vistos = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = PRESENTES_RE.exec(texto)) !== null) {
    for (const bruto of m[1].split(/[,;]/)) {
      const nombre = bruto.trim().replace(/^(el|la|los|las)\s+/i, '');
      if (nombre.length < 2 || nombre.length > 60) continue;
      const clave = sinTildes(nombre);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push(nombre);
    }
  }
  return out;
}

export interface VinculoLeido {
  nombre: string;
  aparenta?: string;
  oculta?: string;
  vinculo?: string;
  atr?: number;
  vin?: number;
  con?: number;
}

/**
 * Lee `[VÍNCULO: Kieron | aparenta: ... | oculta: ... | grado: ... | atr: 7 | vin: 3 | con: 2]`
 * y los formatos de afinidad `🖤 Jarlaxle — ATR: 7 | VÍN: 3 | CON: 2`.
 */
export function leerVinculos(texto: string): VinculoLeido[] {
  if (!texto) return [];
  const out: VinculoLeido[] = [];

  // 1. Parsear [VÍNCULO: ...]
  if (/V[IÍ]NCULO/i.test(texto)) {
    VINCULO_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VINCULO_RE.exec(texto)) !== null) {
      const partes = m[1].split('|').map(p => p.trim());
      const nombre = (partes.shift() || '').trim();
      if (!nombre) continue;

      const v: VinculoLeido = { nombre };
      for (const parte of partes) {
        const corte = parte.indexOf(':');
        if (corte < 1) continue;
        const campo = sinTildes(parte.slice(0, corte)).trim().toLowerCase();
        const valor = parte.slice(corte + 1).trim();
        if (!valor) continue;
        if (campo === 'aparenta' || campo === 'muestra') v.aparenta = valor;
        else if (campo === 'oculta' || campo === 'calla' || campo === 'piensa') v.oculta = valor;
        else if (campo === 'grado' || campo === 'vinculo' || campo === 'relacion') v.vinculo = valor;
        else if (campo === 'atr' || campo === 'atraccion') {
          const num = parseInt(valor, 10);
          if (!isNaN(num)) v.atr = Math.max(0, Math.min(20, num));
        } else if (campo === 'vin' || campo === 'afecto') {
          const num = parseInt(valor, 10);
          if (!isNaN(num)) v.vin = Math.max(0, Math.min(20, num));
        } else if (campo === 'con' || campo === 'confianza') {
          const num = parseInt(valor, 10);
          if (!isNaN(num)) v.con = Math.max(0, Math.min(20, num));
        }
      }
      out.push(v);
    }
  }

  // 2. Parsear [AFINIDAD: Jarlaxle | ATR: 7 | VIN: 3 | CON: 2]
  if (/AFINIDAD/i.test(texto)) {
    AFINIDAD_TAG_RE.lastIndex = 0;
    let am: RegExpExecArray | null;
    while ((am = AFINIDAD_TAG_RE.exec(texto)) !== null) {
      const partes = am[1].split('|').map(p => p.trim());
      const nombre = (partes.shift() || '').trim();
      if (!nombre) continue;

      let existing = out.find(item => coincidenNombresNpc(item.nombre, nombre));
      if (!existing) {
        existing = { nombre };
        out.push(existing);
      } else if (nombre.length > existing.nombre.length) {
        // Conservar el nombre más completo si llega uno con apellido
        existing.nombre = nombre;
      }

      for (const parte of partes) {
        const corte = parte.indexOf(':');
        if (corte < 1) continue;
        const campo = sinTildes(parte.slice(0, corte)).trim().toLowerCase();
        const num = parseInt(parte.slice(corte + 1).trim(), 10);
        if (isNaN(num)) continue;
        if (campo === 'atr' || campo === 'atraccion') existing.atr = Math.max(0, Math.min(20, num));
        else if (campo === 'vin' || campo === 'afecto') existing.vin = Math.max(0, Math.min(20, num));
        else if (campo === 'con' || campo === 'confianza') existing.con = Math.max(0, Math.min(20, num));
      }
    }
  }

  // 3. Parsear líneas 🖤 [Nombre] — ATR: 7 | VÍN: 3 | CON: 2
  AFINIDAD_INLINE_RE.lastIndex = 0;
  let im: RegExpExecArray | null;
  while ((im = AFINIDAD_INLINE_RE.exec(texto)) !== null) {
    const nombre = im[1].trim();
    const atrNum = parseInt(im[2], 10);
    const vinNum = parseInt(im[3], 10);
    const conNum = parseInt(im[4], 10);
    if (!nombre) continue;

    let existing = out.find(item => coincidenNombresNpc(item.nombre, nombre));
    if (!existing) {
      existing = { nombre };
      out.push(existing);
    } else if (nombre.length > existing.nombre.length) {
      existing.nombre = nombre;
    }
    if (!isNaN(atrNum)) existing.atr = Math.max(0, Math.min(20, atrNum));
    if (!isNaN(vinNum)) existing.vin = Math.max(0, Math.min(20, vinNum));
    if (!isNaN(conNum)) existing.con = Math.max(0, Math.min(20, conNum));
  }

  return out;
}

export function limpiarEtiquetasDePnj(texto: string): string {
  if (!texto) return texto;
  return texto
    .replace(PRESENTES_RE, '')
    .replace(VINCULO_RE, '')
    .replace(AFINIDAD_TAG_RE, '')
    .replace(AFINIDAD_INLINE_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Cuántos días distintos hacen falta para dejar de ser figurante. */
export const DIAS_PARA_SER_RECURRENTE = 3;
