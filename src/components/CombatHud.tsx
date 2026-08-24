import React, { useState } from "react";
import { Project, PlayerCharacter } from "../types";
import {
  Shield,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Users,
  User,
  Sparkles,
} from "lucide-react";

export const CombatHud: React.FC<{
  project: Project;
  onOpenNovelReader?: () => void;
  /**
   * 'bar'     — franja plegable sobre la narración (se usa en pantallas estrechas).
   * 'sidebar' — columna vertical en la barra lateral, siempre visible, que no
   *             roba altura al texto (se usa en escritorio).
   */
  variant?: "bar" | "sidebar";
}> = ({ project, onOpenNovelReader, variant = "bar" }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const pc: PlayerCharacter = project.memory.player_character || {
    name: "Protagonista",
    race: "",
    class: "",
    level: "1",
    hp: 25,
    maxHp: 25,
    ac: 14,
    conditions: [],
  };

  const currentHp = pc.hp ?? 25;
  const maxHp = pc.maxHp ?? 25;
  const ac = pc.ac ?? 14;
  const conditions = (pc.conditions || []).filter(Boolean);
  const hpPercent = Math.max(
    0,
    Math.min(100, Math.round((currentHp / Math.max(1, maxHp)) * 100)),
  );

  // HP Color based on percentage
  const getHpColor = () => {
    if (currentHp <= 0) return "bg-red-700 text-white";
    if (hpPercent <= 30) return "bg-red-500 text-white";
    if (hpPercent <= 60) return "bg-amber-500 text-black";
    return "bg-emerald-600 text-white";
  };

  const npcs = project.memory.npcs || [];
  const activeNpcs = npcs.slice(0, 3); // top 3 companions

  if (variant === "sidebar") {
    return (
      <div className="px-3 py-3 border-t border-[var(--glass-border)] font-lora text-xs flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] overflow-hidden shrink-0 bg-black/5 flex items-center justify-center">
            {pc.portrait ? (
              <img
                src={pc.portrait}
                alt={pc.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Shield className="w-4 h-4 text-[var(--accent)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-cinzel font-bold text-[13px] text-[var(--accent)] truncate">
              {pc.name || "Protagonista"}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] truncate">
              Nv. {pc.level || "1"} {pc.class || "Sin clase"}
            </div>
          </div>
          <div
            className="bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] border border-[var(--user-border)] rounded px-1.5 py-1 text-center shrink-0"
            title="Lo lleva el Narrador. Si hay que corregirlo, edita la ficha en Memoria."
          >
            <div className="text-[9px] text-[var(--text-secondary)] font-cinzel flex items-center justify-center gap-0.5">
              <Shield className="w-2.5 h-2.5" /> CA
            </div>
            <div className="text-xs font-bold text-[var(--accent)]">{ac}</div>
          </div>
        </div>

        <div>
          <div className="bg-black/10 rounded-full h-3.5 border border-[var(--user-border)] overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${getHpColor()}`}
              style={{ width: `${hpPercent}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-md">
              {currentHp} / {maxHp} HP
            </span>
          </div>
          {conditions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {conditions.map((c) => (
                <span
                  key={c}
                  className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] text-[var(--text-secondary)] font-cinzel"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] text-[var(--text-secondary)] font-cinzel uppercase tracking-wider flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3" /> Estado actual
          </div>
          <p className="text-[11px] text-[var(--text-primary)] italic m-0 line-clamp-3">
            {project.memory.current_status || "Sin novedades en la escena."}
          </p>
        </div>

        {activeNpcs.length > 0 && (
          <div>
            <div className="text-[10px] text-[var(--text-secondary)] font-cinzel uppercase tracking-wider flex items-center gap-1 mb-1">
              <Users className="w-3 h-3" /> Compañeros
            </div>
            <div className="flex flex-col gap-1">
              {activeNpcs.map((npc) => (
                <div
                  key={npc.id}
                  className="flex items-center gap-1.5"
                  title={npc.relation || "PNJ"}
                >
                  <div className="w-4 h-4 rounded-full overflow-hidden bg-black/10 shrink-0 flex items-center justify-center">
                    {npc.portrait ? (
                      <img
                        src={npc.portrait}
                        alt={npc.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-3 h-3 text-[var(--text-secondary)]" />
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-primary)] truncate font-cinzel">
                    {npc.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#2d201c] text-[#f4ecd8] border-b border-[var(--light-gold)]/40 shadow-md font-lora text-xs shrink-0 z-20">
      {/* Top micro-bar toggle */}
      <div className="px-3 py-1.5 flex justify-between items-center bg-black/30 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 font-cinzel font-bold text-[var(--light-gold)] hover:text-white transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px] uppercase tracking-wider">
              Estado del personaje
            </span>
          </button>

          {/* Quick HP summary in collapsed mode */}
          {!isExpanded && (
            <div className="flex items-center gap-2 text-[11px] ml-2">
              <span className="text-white/80">{pc.name || "Héroe"}:</span>
              <span
                className={`px-1.5 py-0.2 rounded font-bold ${getHpColor()}`}
              >
                HP {currentHp}/{maxHp}
              </span>
              <span className="text-amber-300 font-cinzel flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-300 inline" /> CA {ac}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenNovelReader && (
            <button
              onClick={onOpenNovelReader}
              className="font-cinzel text-[11px] text-[var(--light-gold)] hover:text-white bg-[color-mix(in_srgb,var(--surface)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_20%,transparent)] px-2 py-0.5 rounded border border-[var(--light-gold)]/30 transition-all cursor-pointer flex items-center gap-1.5"
              title="Abrir el Modo Tomo Antiguo para leer la historia como un libro"
            >
              <BookOpen className="w-3.5 h-3.5 text-[var(--light-gold)]" />
              <span className="hidden sm:inline">Modo Novela</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded HUD Panel */}
      {isExpanded && (
        <div className="p-2.5 md:p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-gradient-to-r from-[#221612] via-[#2d201c] to-[#221612]">
          {/* Protagonist Stats */}
          <div className="flex items-center gap-3 bg-black/25 p-2 rounded-lg border border-[var(--light-gold)]/20">
            {/* Portrait */}
            <div className="w-11 h-11 rounded-full border-2 border-[var(--light-gold)] overflow-hidden shrink-0 bg-[#1c120e] flex items-center justify-center shadow-md">
              {pc.portrait ? (
                <img
                  src={pc.portrait}
                  alt={pc.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Shield className="w-5 h-5 text-[var(--light-gold)]" />
              )}
            </div>

            {/* Info & Health */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <span className="font-cinzel font-bold text-sm text-[var(--light-gold)] truncate">
                  {pc.name || "Protagonista"}
                </span>
                <span className="text-[10px] text-white/70">
                  Nv. {pc.level || "1"} {pc.class || "Sin clase"}
                </span>
              </div>

              {/* Health bar */}
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 bg-black/60 rounded-full h-3.5 border border-white/20 overflow-hidden relative shadow-inner">
                  <div
                    className={`h-full transition-all duration-300 ${getHpColor()}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-md">
                    {currentHp} / {maxHp} HP ({hpPercent}%)
                  </span>
                </div>
              </div>

              {conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {conditions.map((c) => (
                    <span
                      key={c}
                      className="text-[9px] px-1.5 py-0.5 rounded-full border border-[var(--light-gold)]/30 bg-black/25 text-[var(--light-gold)] font-cinzel"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Armor Class */}
            <div
              className="bg-amber-950/40 border border-[var(--light-gold)]/40 rounded px-2 py-1 text-center shrink-0"
              title="Lo lleva el Narrador. Si hay que corregirlo, edita la ficha en Memoria."
            >
              <div className="text-[9px] text-amber-300 font-cinzel flex items-center justify-center gap-0.5">
                <Shield className="w-2.5 h-2.5" /> CA
              </div>
              <div className="text-xs font-bold text-[var(--light-gold)]">
                {ac}
              </div>
            </div>
          </div>

          {/* Current Status & Quest summary */}
          <div className="bg-black/25 p-2 rounded-lg border border-[var(--light-gold)]/20 flex flex-col justify-between h-full">
            <div className="flex justify-between items-center text-[10px] text-amber-300/90 font-cinzel mb-0.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300 inline" /> ESTADO
                ACTUAL
              </span>
              <span className="text-white/60">Escena</span>
            </div>
            <p className="text-[11px] text-[#f4ecd8]/90 line-clamp-2 m-0 italic">
              "
              {project.memory.current_status ||
                "Explorando y atentos a los movimientos del entorno."}
              "
            </p>
          </div>

          {/* Key Companions & Harptos lore */}
          <div className="bg-black/25 p-2 rounded-lg border border-[var(--light-gold)]/20 flex flex-col justify-between h-full">
            <div className="flex justify-between items-center text-[10px] text-amber-300/90 font-cinzel mb-1">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-amber-300 inline" /> COMPAÑEROS &
                AFINIDAD
              </span>
              <span className="text-[9px] text-white/50">
                {activeNpcs.length} activos
              </span>
            </div>

            {activeNpcs.length === 0 ? (
              <div className="text-[10px] text-white/50 italic">
                Sin acompañantes registrados en memoria.
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {activeNpcs.map((npc) => (
                  <div
                    key={npc.id}
                    className="flex items-center gap-1.5 bg-[color-mix(in_srgb,var(--surface)_5%,transparent)] border border-white/10 rounded px-1.5 py-0.5 shrink-0"
                    title={`${npc.name} (${npc.relation || "PNJ"})${npc.atr !== undefined ? ` | ATR: ${npc.atr} VÍN: ${npc.vin ?? 0} CON: ${npc.con ?? 0}` : ""}`}
                  >
                    <div className="w-4 h-4 rounded-full overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                      {npc.portrait ? (
                        <img
                          src={npc.portrait}
                          alt={npc.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-3 h-3 text-white/60" />
                      )}
                    </div>
                    <span className="text-[10px] text-white/90 truncate max-w-[80px] font-cinzel">
                      {npc.name}
                    </span>
                    {(npc.atr !== undefined ||
                      npc.vin !== undefined ||
                      npc.con !== undefined) && (
                      <div className="flex items-center gap-1 text-[8px] font-mono font-bold pl-0.5 border-l border-white/15">
                        <span
                          className="text-rose-400"
                          title={`Atracción: ${npc.atr ?? 0}/10`}
                        >
                          ♥{npc.atr ?? 0}
                        </span>
                        <span
                          className="text-teal-400"
                          title={`Vínculo: ${npc.vin ?? 0}/10`}
                        >
                          ★{npc.vin ?? 0}
                        </span>
                        <span
                          className="text-amber-400"
                          title={`Confianza: ${npc.con ?? 0}/10`}
                        >
                          ♦{npc.con ?? 0}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
