import React, { useState } from 'react';
import {
  Compass,
  Clock,
  CloudSun,
  Users,
  Heart,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

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
  rawText: string;
}

/**
 * Analiza y extrae el HUD de escena del inicio de un mensaje de la IA.
 * Soporta formato por bloques (```text 📍... ```), formato de líneas sueltas (📍, 🌤, 👥, 🩸)
 * y formato estructurado [ESCENA: ...].
 */
export function parseSceneHUD(rawContent: string): { narrativeText: string; sceneHUD: SceneHUDData | null } {
  if (!rawContent || typeof rawContent !== 'string') {
    return { narrativeText: rawContent, sceneHUD: null };
  }

  let text = rawContent;
  let hudRaw = '';

  // Patrón 1: Bloque de código al inicio con 📍, [ESCENA o 📅
  const codeBlockMatch = text.match(/^[ \t]*```(?:text|md|markdown)?\s*\n([\s\S]*?(?:📍|\[ESCENA|📅)[\s\S]*?)```[ \t]*\n?/i);

  if (codeBlockMatch) {
    hudRaw = codeBlockMatch[1];
    text = text.slice(codeBlockMatch[0].length);
  } else {
    // Patrón 2: Bloque [ESCENA: ... ] o [ESCENA] ... [/ESCENA]
    const tagMatch = text.match(/^[ \t]*\[\s*ESCENA(?:\s*:|\])([\s\S]*?)(?:\[\s*\/ESCENA\s*\]|\])[ \t]*\n?/i);
    if (tagMatch) {
      hudRaw = tagMatch[1];
      text = text.slice(tagMatch[0].length);
    } else {
      // Patrón 3: Líneas directas que comienzan con 📍 al inicio del mensaje
      const linesMatch = text.match(/^[ \t]*(📍[^\n\r]+(?:\r?\n[ \t]*(?:🌤|👥|🩸|⚡)[^\n\r]+)*)[ \t]*(?:\r?\n|$)/i);
      if (linesMatch) {
        hudRaw = linesMatch[1];
        text = text.slice(linesMatch[0].length);
      } else {
        // Patrón 4: Formato previo de fecha/hora (📅 ... | ⏳ ...)
        const legacyMatch = text.match(/^[ \t]*(📅[^\n\r]+(?:\r?\n[ \t]*(?:👤|🌟|⚜️|🖤|❤️)[^\n\r]+)*)[ \t]*(?:\r?\n|$)/i);
        if (legacyMatch) {
          hudRaw = legacyMatch[1];
          text = text.slice(legacyMatch[0].length);
        }
      }
    }
  }

  if (!hudRaw.trim()) {
    return { narrativeText: rawContent, sceneHUD: null };
  }

  const hudData = parseHUDContent(hudRaw);
  return {
    narrativeText: text.trim(),
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

  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Línea de Ubicación y Tiempo (📍 ...)
    if (line.startsWith('📍') || /^Lugar:/i.test(line)) {
      const clean = line.replace(/^📍\s*/, '').replace(/^Lugar:\s*/i, '').trim();
      
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
    else if (line.startsWith('🌤') || /^Clima:|^Ambiente:/i.test(line)) {
      const clean = line.replace(/^🌤\s*/, '').replace(/^(?:Clima|Ambiente):\s*/i, '').trim();
      
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
    else if (line.startsWith('👥') || /^Presentes:/i.test(line)) {
      const clean = line.replace(/^👥\s*/, '').replace(/^Presentes:\s*/i, '').trim();
      extractCharacters(clean, characters);
    }
    // Línea de Estado y Salud (🩸 ...)
    else if (line.startsWith('🩸') || /^Estado:/i.test(line)) {
      const clean = line.replace(/^🩸\s*/, '').replace(/^Estado:\s*/i, '').trim();
      
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
}

export const SceneHUDCard: React.FC<SceneHUDCardProps> = ({ hud }) => {
  // Estado de colapso local: por defecto expandido con vista limpia
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gmstudio_scene_hud_default_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const fullLocation = [hud.location, hud.subLocation, hud.region].filter(Boolean).join(' · ');
  const fullTime = [hud.date, hud.timeOfDay].filter(Boolean).join(' · ');

  return (
    <div className="w-full mb-3 select-none transition-all duration-200">
      <div className="rounded-lg border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] shadow-xs overflow-hidden backdrop-blur-xs">
        {/* Cabecera / Barra principal del Cintillo */}
        <div className="px-3.5 py-2 flex items-center justify-between gap-2 border-b border-[var(--glass-border)]/50 bg-[color-mix(in_srgb,var(--surface)_50%,transparent)]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="p-1 rounded bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] shrink-0">
              <Compass className="w-3.5 h-3.5" />
            </span>
            <div
              className="truncate font-cinzel text-xs font-semibold text-[var(--accent)]"
              title={fullLocation}
            >
              {hud.location}
              {hud.subLocation && (
                <span className="opacity-80 font-normal font-lora ml-1 text-[var(--text-secondary)]">
                  · {hud.subLocation}
                </span>
              )}
              {hud.region && (
                <span className="opacity-60 text-[11px] font-normal font-lora ml-1 text-[var(--text-secondary)]">
                  ({hud.region})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {fullTime && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-cinzel font-medium bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] border border-[var(--accent)]/20">
                <Clock className="w-3 h-3 opacity-70" />
                <span>{fullTime}</span>
              </span>
            )}
            
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] transition-colors cursor-pointer"
              title={collapsed ? 'Expandir detalles de escena' : 'Colapsar a cintillo compacto'}
              aria-label={collapsed ? 'Expandir escena' : 'Colapsar escena'}
            >
              {collapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Contenido expandido con detalles limpios y ordenados */}
        {!collapsed && (
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-lora animate-in fade-in duration-200">
            {/* Atmósfera: Clima e Iluminación */}
            {(hud.weather || hud.light) && (
              <div className="flex items-start gap-2 bg-[color-mix(in_srgb,var(--surface-soft)_60%,transparent)] p-2 rounded-md border border-[var(--glass-border)]/40">
                <CloudSun className="w-3.5 h-3.5 text-amber-500/80 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-cinzel text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Atmósfera
                  </span>
                  <span className="text-[var(--text-primary)] leading-snug">
                    {hud.weather}
                    {hud.weather && hud.light && ' · '}
                    {hud.light && <span className="opacity-90 italic">{hud.light}</span>}
                  </span>
                </div>
              </div>
            )}

            {/* Presentes en Escena */}
            {hud.characters.length > 0 && (
              <div className="flex items-start gap-2 bg-[color-mix(in_srgb,var(--surface-soft)_60%,transparent)] p-2 rounded-md border border-[var(--glass-border)]/40">
                <Users className="w-3.5 h-3.5 text-sky-500/80 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="font-cinzel text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Presentes ({hud.characters.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {hud.characters.map((char, cIdx) => (
                      <span
                        key={cIdx}
                        className="inline-block px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] text-[11px] font-medium border border-[var(--glass-border)] text-[var(--text-primary)] leading-none"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Estado Vital & Heridas */}
            {(hud.hp || hud.conditions.length > 0) && (
              <div className="flex items-start gap-2 bg-[color-mix(in_srgb,var(--surface-soft)_60%,transparent)] p-2 rounded-md border border-[var(--glass-border)]/40 sm:col-span-2 md:col-span-1">
                <Heart className="w-3.5 h-3.5 text-rose-500/80 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-cinzel text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Estado Vital
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {hud.hp && (
                      <span className="font-bold text-rose-700 dark:text-rose-400 font-cinzel text-xs">
                        {hud.hp}
                      </span>
                    )}
                    {hud.conditions.map((cond, kIdx) => (
                      <span
                        key={kIdx}
                        className="text-[11px] italic text-[var(--text-secondary)] leading-tight"
                      >
                        {cond}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
