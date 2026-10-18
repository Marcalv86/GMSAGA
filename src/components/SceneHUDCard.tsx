import React from 'react';
import { Project } from '../types';

export interface SceneHUDData {
  location: string;
  subLocation?: string;
  region?: string;
  date?: string;
  timeOfDay?: string;
  weather?: string;
  light?: string;
  characters: string[];
  hp?: string;
  conditions: string[];
  entorno?: string;
  rawText: string;
}

/**
 * Analiza y extrae el HUD de escena en cualquier posición de un mensaje de la IA
 * (inicio, intermedio o final de texto).
 * Soporta formato por bloques (```text 📍... ```), formato de líneas sueltas (📍, 🌤, 👥, 🩸),
 * formato estructurado [ESCENA: ...] y etiquetas [ESTAMOS: ...] / [LUGAR: ...].
 */
export function parseSceneHUD(rawContent: string): { narrativeText: string; sceneHUD: SceneHUDData | null } {
  if (!rawContent || typeof rawContent !== 'string') {
    return { narrativeText: rawContent || '', sceneHUD: null };
  }

  let text = rawContent;
  let lastHudRaw = '';
  let maxIterations = 5;

  while (maxIterations-- > 0) {
    let hudRaw = '';
    let matchIndex = -1;
    let matchLength = 0;

    // Patrón 1: Bloque de código en cualquier posición con 📍, [ESCENA, 📅, Lugar: o Estado:
    const codeBlockRegex = /```(?:text|md|markdown)?\s*\n([\s\S]*?(?:📍|\[ESCENA|📅|Lugar:|Estado:|Clima:|Presentes:)[\s\S]*?)```[ \t]*(?:\r?\n|$)/i;
    const codeBlockMatch = text.match(codeBlockRegex);

    if (codeBlockMatch && codeBlockMatch.index !== undefined) {
      hudRaw = codeBlockMatch[1];
      matchIndex = codeBlockMatch.index;
      matchLength = codeBlockMatch[0].length;
    }

    // Patrón 2: Bloque [ESCENA: ... ] o [ESCENA] ... [/ESCENA]
    if (!hudRaw) {
      const tagRegex = /\[\s*ESCENA(?:\s*:|\])([\s\S]*?)(?:\[\s*\/ESCENA\s*\]|\])/i;
      const tagMatch = text.match(tagRegex);
      if (tagMatch && tagMatch.index !== undefined) {
        hudRaw = tagMatch[1];
        matchIndex = tagMatch.index;
        matchLength = tagMatch[0].length;
      }
    }

    // Patrón 3: Líneas directas que comienzan con 📍 (con o sin prefijos markdown como ---, *, #, etc.)
    if (!hudRaw) {
      const linesRegex = /(?:^|\n)[ \t]*(?:[-*#_~—–]+\s*)?(📍[^\n\r]+(?:\r?\n[ \t]*(?:[-*#_~—–]+\s*)?(?:[🌤⛅🌧⛈🌩❄🌪☀️🌞👥👤🩸❤️⚡]|Clima:|Ambiente:|Presentes:|Estado:|Tiempo:|Fecha:)[^\n\r]*|\r?\n[ \t]*(?=\r?\n[ \t]*(?:[-*#_~—–]+\s*)?(?:[🌤⛅🌧⛈🌩❄🌪☀️🌞👥👤🩸❤️⚡]|Clima:|Ambiente:|Presentes:|Estado:|Tiempo:|Fecha:)))*)/iu;
      const linesMatch = text.match(linesRegex);
      if (linesMatch && linesMatch.index !== undefined && linesMatch[1]?.includes('📍')) {
        hudRaw = linesMatch[1];
        const offset = linesMatch[0].indexOf('📍');
        const startPos = linesMatch.index + (offset > 0 ? linesMatch[0].slice(0, offset).lastIndexOf('\n') + 1 : 0);
        matchIndex = startPos >= 0 ? startPos : linesMatch.index;
        matchLength = (linesMatch.index + linesMatch[0].length) - matchIndex;
      }
    }

    // Patrón 4: [ESTAMOS: ... ] o [LUGAR: ... ]
    if (!hudRaw) {
      const estamosRegex = /\[\s*(?:ESTAMOS|LUGAR)\s*:\s*([^\]]+)\]/i;
      const estamosMatch = text.match(estamosRegex);
      if (estamosMatch && estamosMatch.index !== undefined) {
        hudRaw = `📍 ${estamosMatch[1]}`;
        matchIndex = estamosMatch.index;
        matchLength = estamosMatch[0].length;

        // Buscar si también hay [PRESENTES: ...], [ESTADO: ...], [TIEMPO: ...] o [CLIMA: ...] en el mensaje
        const presMatch = text.match(/\[\s*PRESENTES\s*:\s*([^\]]+)\]/i);
        if (presMatch) hudRaw += `\n👥 ${presMatch[1]}`;
        const estMatch = text.match(/\[\s*ESTADO\s*:\s*([^\]]+)\]/i);
        if (estMatch) hudRaw += `\n🩸 ${estMatch[1]}`;
        const cliMatch = text.match(/\[\s*CLIMA\s*:\s*([^\]]+)\]/i);
        if (cliMatch) hudRaw += `\n🌤 ${cliMatch[1]}`;
      }
    }

    // Patrón 5: Formato previo de fecha/hora (📅 ... | ⏳ ...)
    if (!hudRaw) {
      const legacyRegex = /(?:^|\n)[ \t]*(📅[^\n\r]+(?:\r?\n[ \t]*(?:👤|🌟|⚜️|🖤|❤️)[^\n\r]+)*)/i;
      const legacyMatch = text.match(legacyRegex);
      if (legacyMatch && legacyMatch.index !== undefined) {
        hudRaw = legacyMatch[1];
        const offset = legacyMatch[0].startsWith('\n') ? 1 : 0;
        matchIndex = legacyMatch.index + offset;
        matchLength = legacyMatch[0].length - offset;
      }
    }

    if (!hudRaw.trim() || matchIndex === -1) {
      break;
    }

    lastHudRaw = hudRaw;

    // Recortar limpiamente el bloque HUD del texto narrativo
    text = (text.slice(0, matchIndex) + text.slice(matchIndex + matchLength))
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (!lastHudRaw) {
    return { narrativeText: rawContent, sceneHUD: null };
  }

  const hudData = parseHUDContent(lastHudRaw);
  return {
    narrativeText: text,
    sceneHUD: hudData
  };
}

function parseHUDContent(raw: string): SceneHUDData {
  let location = '';
  let subLocation = '';
  let region = '';
  let date = '';
  let timeOfDay = '';
  let weather = '';
  let light = '';
  const characters: string[] = [];
  let hp = '';
  const conditions: string[] = [];
  let entorno = '';

  const rawLines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/^(?:[-*#_~—–]+\s*)+/, '').replace(/^\*\*|\*\*$/g, '').trim();
    if (!line) continue;

    // Etiqueta explícita de Entorno [ENTORNO: descanso | taberna | etc]
    if (/^\[\s*ENTORNO\s*:/i.test(line) || /^Entorno:/i.test(line)) {
      const clean = line
        .replace(/^\[\s*ENTORNO\s*:\s*/i, '')
        .replace(/^Entorno:\s*/i, '')
        .replace(/\]$/, '')
        .trim();
      if (clean) entorno = clean;
    }
    // Línea de Ubicación y Tiempo (📍 ...)
    else if (line.includes('📍') || /^Lugar:/i.test(line) || /^\[\s*(?:ESTAMOS|LUGAR)\s*:/i.test(line)) {
      const clean = line
        .replace(/^.*📍\s*/, '')
        .replace(/^Lugar:\s*/i, '')
        .replace(/^\[\s*(?:ESTAMOS|LUGAR)\s*:\s*/i, '')
        .replace(/\]$/, '')
        .trim();
      
      // Separar por guión largo — para separar ubicación de fecha/hora
      const partsDash = clean.split(/—|--/);
      const locPart = partsDash[0]?.trim() || '';
      const timePart = partsDash[1]?.trim() || '';

      // Procesar locPart (ej: "Camarote de popa · bergantín Cormorán · Mar de las Espadas")
      const locChunks = locPart.split(/·|\s+-\s+/).map(c => c.trim().replace(/^\*+|\*+$/g, '')).filter(Boolean);
      if (locChunks.length > 0) location = locChunks[0];
      if (locChunks.length > 1) subLocation = locChunks[1];
      if (locChunks.length > 2) region = locChunks.slice(2).join(' · ');

      // Procesar timePart (ej: "Ches 14, madrugada" o "14 de Ches, noche")
      if (timePart) {
        const tChunks = timePart.split(/,|·/).map(c => c.trim()).filter(Boolean);
        date = tChunks[0] || '';
        timeOfDay = tChunks.slice(1).join(', ') || '';
      }
    }
    // Línea de Clima, Luz y Presentes (🌤 ...)
    else if (/^(?:🌤|⛅|🌧|⛈|🌩|❄|🌪|☀️|🌞|Clima:|Ambiente:)/iu.test(line) || /^\[\s*CLIMA\s*:/i.test(line)) {
      const clean = line
        .replace(/^(?:🌤️?|⛅|🌧️?|⛈️?|🌩️?|❄️?|🌪️?|☀️|🌞)\s*/u, '')
        .replace(/^(?:Clima|Ambiente):\s*/i, '')
        .replace(/^\[\s*CLIMA\s*:\s*/i, '')
        .replace(/\]$/, '')
        .trim();
      
      // Puede contener 👥 incrustado
      if (clean.includes('👥')) {
        const [weatherPart, charPart] = clean.split('👥');
        extractWeatherAndLight(weatherPart, w => { weather = w; }, l => { light = l; });
        extractCharacters(charPart, characters);
      } else {
        extractWeatherAndLight(clean, w => { weather = w; }, l => { light = l; });
      }
    }
    // Línea exclusiva de Presentes (👥 ...)
    else if (/^(?:👥|👤|Presentes:)/iu.test(line) || /^\[\s*PRESENTES\s*:/i.test(line)) {
      const clean = line
        .replace(/^(?:👥|👤)\s*/u, '')
        .replace(/^Presentes:\s*/i, '')
        .replace(/^\[\s*PRESENTES\s*:\s*/i, '')
        .replace(/\]$/, '')
        .trim();
      extractCharacters(clean, characters);
    }
    // Línea de Estado y Salud (🩸 ...)
    else if (/^(?:🩸|❤️|Estado:)/iu.test(line) || /^\[\s*ESTADO\s*:/i.test(line)) {
      const clean = line
        .replace(/^(?:🩸|❤️)\s*/u, '')
        .replace(/^Estado:\s*/i, '')
        .replace(/^\[\s*ESTADO\s*:\s*/i, '')
        .replace(/\]$/, '')
        .trim();
      
      // Buscar patrón de PG (ej: 22/38 PG o 15 PG)
      const hpMatch = clean.match(/(\d+\s*\/\s*\d+\s*(?:PG|PV|HP)?|\d+\s*(?:PG|PV|HP))/i);
      if (hpMatch) {
        hp = hpMatch[1].trim();
      }

      // El resto son condiciones / heridas
      const remainder = hpMatch ? clean.replace(hpMatch[0], '').trim() : clean;
      const condChunks = remainder.split(/·|,|\|/).map(c => c.trim().replace(/^[-–—]\s*/, '')).filter(Boolean);
      for (const cond of condChunks) {
        if (cond && !cond.toLowerCase().includes('pg')) {
          conditions.push(cond);
        }
      }
    }
    // Tiempo explícito (Tiempo: Ches 14, ...)
    else if (/^Tiempo:|^Fecha:/i.test(line)) {
      const clean = line.replace(/^(?:Tiempo|Fecha):\s*/i, '').trim();
      const tChunks = clean.split(/,|·/).map(c => c.trim()).filter(Boolean);
      date = tChunks[0] || '';
      timeOfDay = tChunks.slice(1).join(', ') || '';
    }
    // Formato previo de fecha/hora (📅 ...)
    else if (line.startsWith('📅')) {
      const clean = line.replace(/^📅\s*/, '').trim();
      const parts = clean.split(/\||·/);
      date = parts[0]?.replace(/^📅\s*/, '').trim() || '';
      if (parts[1]) {
        timeOfDay = parts[1].replace(/⏳\s*/, '').trim();
      }
    }
    // Formato previo de nivel o estado (👤 ...)
    else if (line.startsWith('👤')) {
      const clean = line.replace(/^👤\s*/, '').trim();
      conditions.push(clean);
    }
  }

  return {
    location: location || 'Entorno de la escena',
    subLocation,
    region,
    date,
    timeOfDay,
    weather,
    light,
    characters,
    hp,
    conditions,
    entorno: entorno || undefined,
    rawText: raw
  };
}

function extractWeatherAndLight(text: string, setWeather: (w: string) => void, setLight: (l: string) => void): void {
  if (!text) return;
  const chunks = text.split(/·|,|\|/).map(c => c.trim()).filter(Boolean);
  const weathers: string[] = [];
  const lights: string[] = [];

  for (const c of chunks) {
    if (/luz|farol|antorcha|penumbra|oscuridad|candil|sombras|luna/i.test(c)) {
      lights.push(c);
    } else {
      weathers.push(c);
    }
  }

  if (weathers.length > 0) setWeather(weathers.join(', '));
  if (lights.length > 0) setLight(lights.join(', '));
}

function extractCharacters(text: string, characters: string[]): void {
  if (!text) return;
  const chunks = text.split(/·|,|;| y /i).map(c => c.trim()).filter(Boolean);
  for (const c of chunks) {
    // Limpiar notas de paréntesis o mantenerlas limpias
    if (c && !characters.includes(c)) {
      characters.push(c);
    }
  }
}

interface SceneHUDCardProps {
  hud: SceneHUDData;
  messageIndex?: number;
  project?: Project;
}

export const SceneHUDCard: React.FC<SceneHUDCardProps> = ({ hud }) => {
  const fullLocation = [hud.location, hud.subLocation, hud.region].filter(Boolean).join(' · ');
  const fullTime = [hud.date, hud.timeOfDay].filter(Boolean).join(' · ');
  const fullLocWithTime = fullTime ? `${fullLocation} — ${fullTime}` : fullLocation;
  const weatherLine = [hud.weather, hud.light].filter(Boolean).join(' · ');
  const charactersLine = hud.characters.length > 0 ? hud.characters.join(' · ') : null;

  return (
    <div className="w-full mb-3 rounded-xl border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] px-3.5 py-2.5 text-xs font-lora shadow-2xs space-y-1.5 border-l-4 border-l-[var(--accent)] select-text">
      <div className="font-cinzel font-bold text-xs sm:text-[13px] text-[var(--accent)] flex items-start gap-2 leading-snug">
        <span className="shrink-0 select-none">📍</span>
        <span>{fullLocWithTime}</span>
      </div>
      {weatherLine && (
        <div className="text-[var(--text-secondary)] flex items-start gap-2 leading-snug pl-0.5 text-[11px] sm:text-xs">
          <span className="shrink-0 select-none">🌤</span>
          <span>{weatherLine}</span>
        </div>
      )}
      {charactersLine && (
        <div className="text-[var(--text-primary)] flex items-start gap-2 leading-snug pl-0.5 text-[11px] sm:text-xs">
          <span className="shrink-0 select-none">👥</span>
          <span>{charactersLine}</span>
        </div>
      )}
    </div>
  );
};

