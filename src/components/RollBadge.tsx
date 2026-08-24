import React from "react";
import { Dices, Sparkles, AlertTriangle, Flame } from "lucide-react";

interface RollInfo {
  type: "skill" | "simple" | "oracle_query" | "oracle_meaning";
  skillName?: string;
  sides?: number;
  natural?: number;
  dc?: number;
  question?: string;
  probability?: string;
  d100Result?: number;
  d100Pair?: [number, number];
  isDouble?: boolean;
  rawText: string;
}

export function parseMessageRolls(text: string): {
  narrativeText: string;
  rolls: RollInfo[];
} {
  if (!text) return { narrativeText: "", rolls: [] };

  const rolls: RollInfo[] = [];
  let narrativeText = text;

  // 1. Tirada de Habilidad: [Tirada de Percepción: d20 natural = 18 | CD 15]
  const skillRollRegex =
    /\[\s*Tirada\s+de\s+([^:]+?)\s*:\s*d(\d+)\s+natural\s*=\s*(\d+)(?:\s*[|,]\s*(?:CD|DC)\s*[:=]?\s*(\d+))?\s*\]/gi;
  let match;
  while ((match = skillRollRegex.exec(text)) !== null) {
    const rawText = match[0];
    const skillName = match[1].trim();
    const sides = parseInt(match[2], 10) || 20;
    const natural = parseInt(match[3], 10);
    const dc = match[4] ? parseInt(match[4], 10) : undefined;
    rolls.push({
      type: "skill",
      skillName,
      sides,
      natural,
      dc,
      rawText,
    });
  }

  // 2. Tirada simple: [Tirada d20: 17] o [Tirada d6: 4]
  const simpleRollRegex = /\[\s*Tirada\s+d(\d+)\s*:\s*(\d+)\s*\]/gi;
  while ((match = simpleRollRegex.exec(text)) !== null) {
    const rawText = match[0];
    const sides = parseInt(match[1], 10);
    const natural = parseInt(match[2], 10);
    rolls.push({
      type: "simple",
      sides,
      natural,
      rawText,
    });
  }

  // 3. Oráculo con pregunta: [Oráculo — «¿pregunta?» | probabilidad: Probable | d100 = 42 | DÍGITOS REPETIDOS]
  const oracleQueryRegex =
    /\[\s*Or[aá]culo\s*—\s*[«"']?([^»"'\n|]+?)[»"']?\s*\|\s*probabilidad\s*:\s*([^|\n]+?)\s*\|\s*d100\s*=\s*(\d+)(?:\s*\|\s*D[ÍI]GITOS\s+REPETIDOS)?\s*\]/gi;
  while ((match = oracleQueryRegex.exec(text)) !== null) {
    const rawText = match[0];
    const question = match[1].trim();
    const probability = match[2].trim();
    const d100Result = parseInt(match[3], 10);
    const isDouble =
      rawText.toUpperCase().includes("DÍGITOS REPETIDOS") ||
      rawText.toUpperCase().includes("DIGITOS REPETIDOS");
    rolls.push({
      type: "oracle_query",
      question,
      probability,
      d100Result,
      isDouble,
      rawText,
    });
  }

  // 4. Oráculo significado: [Oráculo — descubrir significado | d100 = 12 y 78]
  const oracleMeaningRegex =
    /\[\s*Or[aá]culo\s*—\s*descubrir\s+significado\s*\|\s*d100\s*=\s*(\d+)\s+y\s+(\d+)\s*\]/gi;
  while ((match = oracleMeaningRegex.exec(text)) !== null) {
    const rawText = match[0];
    const a = parseInt(match[1], 10);
    const b = parseInt(match[2], 10);
    rolls.push({
      type: "oracle_meaning",
      d100Pair: [a, b],
      rawText,
    });
  }

  // Eliminar los tags del texto narrativo para que se dibujen como tarjetas ricas
  for (const r of rolls) {
    narrativeText = narrativeText.replace(r.rawText, "").trim();
  }

  return { narrativeText, rolls };
}

export const RollBadgeCard: React.FC<{ roll: RollInfo }> = ({ roll }) => {
  if (roll.type === "skill") {
    const isCrit = roll.natural === 20;
    const isFumble = roll.natural === 1;

    let borderClass =
      "border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] shadow-sm";
    let textResultClass = "text-[var(--accent)]";

    if (isCrit) {
      borderClass =
        "border-amber-400/80 bg-gradient-to-r from-amber-500/15 via-yellow-400/10 to-amber-500/20 shadow-md shadow-amber-500/20";
      textResultClass =
        "text-amber-500 font-black dark:text-amber-300 drop-shadow-sm";
    } else if (isFumble) {
      borderClass =
        "border-red-400/80 bg-gradient-to-r from-red-500/15 via-rose-400/10 to-red-500/20 shadow-md shadow-red-500/20";
      textResultClass = "text-red-600 font-black dark:text-red-400";
    }

    return (
      <div
        className={`my-2 p-2.5 sm:p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2.5 transition-all ${borderClass} font-lora`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              isCrit
                ? "bg-amber-400/20 border-amber-400 text-amber-500 dark:text-amber-300 shadow-xs shadow-amber-400/40"
                : isFumble
                  ? "bg-red-400/20 border-red-400 text-red-500 dark:text-red-400"
                  : "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent)]"
            }`}
          >
            {isCrit ? (
              <Flame className="w-4 h-4 animate-pulse" />
            ) : isFumble ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Dices className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-cinzel font-bold text-xs sm:text-sm text-[var(--text-primary)]">
                Tirada de {roll.skillName}
              </span>
              {roll.dc && (
                <span className="text-[10px] font-cinzel font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-soft)] border border-[var(--user-border)] text-[var(--text-secondary)]">
                  CD {roll.dc}
                </span>
              )}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
              <span>Dado d{roll.sides || 20}</span>
              {isCrit && (
                <span className="text-amber-500 dark:text-amber-400 font-cinzel font-bold">
                  · ¡Éxito Crítico!
                </span>
              )}
              {isFumble && (
                <span className="text-red-500 dark:text-red-400 font-cinzel font-bold">
                  · ¡Fallo Crítico / Pifia!
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 bg-[var(--bg-color)]/70 px-3 py-1 rounded-lg border border-[var(--user-border)] shadow-inner">
          <span className="text-[10px] font-cinzel text-[var(--text-secondary)] uppercase tracking-wider">
            Natural
          </span>
          <span
            className={`text-base sm:text-lg font-cinzel font-bold ${textResultClass}`}
          >
            {roll.natural}
          </span>
        </div>
      </div>
    );
  }

  if (roll.type === "simple") {
    const isMax = roll.sides && roll.natural === roll.sides;
    const isMin = roll.natural === 1;

    let dieColor =
      "text-[var(--accent)] border-[var(--accent)]/40 bg-[var(--accent)]/10";
    if (roll.sides === 20)
      dieColor =
        "text-amber-600 dark:text-amber-400 border-amber-400/40 bg-amber-400/10";
    else if (roll.sides === 12)
      dieColor =
        "text-purple-600 dark:text-purple-400 border-purple-400/40 bg-purple-400/10";
    else if (roll.sides === 10)
      dieColor =
        "text-blue-600 dark:text-blue-400 border-blue-400/40 bg-blue-400/10";
    else if (roll.sides === 8)
      dieColor =
        "text-emerald-600 dark:text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
    else if (roll.sides === 6)
      dieColor =
        "text-rose-600 dark:text-rose-400 border-rose-400/40 bg-rose-400/10";
    else if (roll.sides === 4)
      dieColor =
        "text-orange-600 dark:text-orange-400 border-orange-400/40 bg-orange-400/10";
    else if (roll.sides === 100)
      dieColor =
        "text-cyan-600 dark:text-cyan-400 border-cyan-400/40 bg-cyan-400/10";

    return (
      <div className="my-1.5 p-2 sm:p-2.5 rounded-xl border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] shadow-xs flex items-center justify-between gap-2 max-w-sm">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border font-cinzel font-bold text-xs ${dieColor}`}
          >
            d{roll.sides}
          </div>
          <span className="font-cinzel text-xs font-semibold text-[var(--text-primary)]">
            Tirada de dado d{roll.sides}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg-color)]/70 px-2.5 py-0.5 rounded-md border border-[var(--user-border)] shadow-inner">
          <span
            className={`text-base font-cinzel font-black ${isMax ? "text-amber-500" : isMin ? "text-red-500" : "text-[var(--text-primary)]"}`}
          >
            {roll.natural}
          </span>
        </div>
      </div>
    );
  }

  if (roll.type === "oracle_query") {
    return (
      <div className="my-2 p-2.5 sm:p-3 rounded-xl border border-indigo-400/40 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-indigo-500/15 shadow-sm space-y-1.5 font-lora">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-cinzel font-bold text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            <span>Consulta al Oráculo</span>
          </div>
          <span className="text-[10px] font-cinzel px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-400/30">
            Probabilidad: {roll.probability}
          </span>
        </div>

        <div className="text-xs sm:text-sm text-[var(--text-primary)] italic">
          «{roll.question}»
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-indigo-300/20 text-[11px]">
          <span className="text-[var(--text-secondary)]">
            {roll.isDouble
              ? "✨ Tirada con dígitos repetidos (Giro dramático)"
              : "Resultado d100"}
          </span>
          <span className="font-cinzel font-bold text-sm text-indigo-700 dark:text-indigo-300 bg-[var(--bg-color)] px-2 py-0.5 rounded border border-indigo-400/30 shadow-inner">
            {roll.d100Result}
          </span>
        </div>
      </div>
    );
  }

  if (roll.type === "oracle_meaning") {
    return (
      <div className="my-2 p-2.5 sm:p-3 rounded-xl border border-teal-400/40 bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-teal-500/15 shadow-sm space-y-1 font-lora">
        <div className="flex items-center gap-1.5 text-xs font-cinzel font-bold text-teal-700 dark:text-teal-300">
          <Sparkles className="w-3.5 h-3.5 text-teal-500" />
          <span>Tablas de Significado del Oráculo</span>
        </div>
        <div className="text-xs text-[var(--text-secondary)]">
          Acción y Tema: d100 ={" "}
          <strong className="text-teal-700 dark:text-teal-300 font-cinzel">
            {roll.d100Pair?.[0]}
          </strong>{" "}
          y{" "}
          <strong className="text-teal-700 dark:text-teal-300 font-cinzel">
            {roll.d100Pair?.[1]}
          </strong>
        </div>
      </div>
    );
  }

  return null;
};
