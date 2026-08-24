import React, { useState, useMemo } from "react";
import {
  PlayerCharacter,
  InventoryItem,
  CharacterSpell,
  CharacterTrait,
} from "../types";
import {
  ensureValidPlayerCharacter,
  DND_SKILL_DEFINITIONS,
  calculateModifier,
  formatModifier,
} from "../utils/characterSheetParser";
import {
  Shield,
  Swords,
  Heart,
  Sparkles,
  Star,
  Backpack,
  Coins,
  Eye,
  Scroll,
  Image,
  Zap,
  Wand2,
  Gem,
  FlaskConical,
  X,
  Clock,
  Feather,
  Search,
  Flame,
  Compass,
  AlertTriangle,
  Languages,
  Wrench,
  Pencil,
  Trash2,
} from "lucide-react";

interface CharacterSheetViewProps {
  character: PlayerCharacter;
  onUpdateCharacter?: (
    updater: (prevPc: PlayerCharacter) => PlayerCharacter,
  ) => Promise<void>;
  onClearCharacter?: () => void;
  onOpenPortraitPicker?: () => void;
  onOpenEditModal?: () => void;
}

export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  character: rawCharacter,
  onOpenPortraitPicker,
  onClearCharacter,
  onOpenEditModal,
}) => {
  const character = useMemo(
    () => ensureValidPlayerCharacter(rawCharacter),
    [rawCharacter],
  );
  const [activeTab, setActiveTab] = useState<
    "combat" | "magic" | "inventory" | "profile"
  >("combat");

  // Search & inspect state
  const [inventorySearch, setInventorySearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [inspectItem, setInspectItem] = useState<InventoryItem | null>(null);
  const [spellLevelFilter, setSpellLevelFilter] = useState<number | "all">(
    "all",
  );

  // Character core attributes & stats
  const attributes = character.attributes || {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  };
  const currencies = character.currencies || {
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0,
  };
  const inventory = character.inventory || [];
  const hp = character.hp ?? 10;
  const maxHp = character.maxHp ?? hp;
  const ac = character.ac ?? 10;
  const speed = character.speed || "30 pies";
  const initiative = character.initiative || "+0";
  const proficiencyBonus = character.proficiencyBonus ?? 2;
  const savingThrowProfs = character.savingThrowProficiencies || [];

  // Saving throw calculations
  const getSavingThrowBonus = (statKey: string, score: number) => {
    const isProf = savingThrowProfs.some(
      (p) => p.toUpperCase() === statKey.toUpperCase(),
    );
    const baseMod = calculateModifier(score);
    const total = isProf ? baseMod + proficiencyBonus : baseMod;
    return {
      isProf,
      bonus: formatModifier(total),
    };
  };

  // 6 Primary Attributes list
  const statList = [
    { key: "str", name: "Fuerza", short: "FUE", score: attributes.str || 10 },
    { key: "dex", name: "Destreza", short: "DES", score: attributes.dex || 10 },
    {
      key: "con",
      name: "Constitución",
      score: attributes.con || 10,
      short: "CON",
    },
    {
      key: "int",
      name: "Inteligencia",
      score: attributes.int || 10,
      short: "INT",
    },
    {
      key: "wis",
      name: "Sabiduría",
      score: attributes.wis || 10,
      short: "SAB",
    },
    { key: "cha", name: "Carisma", score: attributes.cha || 10, short: "CAR" },
  ];

  // Dynamic Skill calculations
  const computedSkills = useMemo(() => {
    const profSkillsLower = (character.skillProficiencies || []).map((s) =>
      s.toLowerCase().trim(),
    );

    return DND_SKILL_DEFINITIONS.map((def) => {
      const statScore = attributes[def.statKey] || 10;
      const baseMod = calculateModifier(statScore);

      const isExpert = profSkillsLower.some(
        (p) =>
          (p.includes("pericia") ||
            p.includes("experta") ||
            p.includes("expert")) &&
          def.aliases.some((alias) => p.includes(alias)),
      );

      const isProf =
        isExpert ||
        profSkillsLower.some((p) =>
          def.aliases.some((alias) => p.includes(alias)),
        );

      const totalBonus = isExpert
        ? baseMod + proficiencyBonus * 2
        : isProf
          ? baseMod + proficiencyBonus
          : baseMod;

      const bonusStr = formatModifier(totalBonus);
      const isPerception = def.name === "Percepción";
      const passivePerception = isPerception ? 10 + totalBonus : undefined;

      return {
        name: def.name,
        statShort: def.statShort,
        statKey: def.statKey,
        isProf,
        isExpert,
        bonusStr,
        passivePerception,
      };
    });
  }, [attributes, character.skillProficiencies, proficiencyBonus]);

  // Dynamic Traits & Feats Cards Extraction
  const resolvedTraits = useMemo<CharacterTrait[]>(() => {
    if (character.traits && character.traits.length > 0) {
      return character.traits;
    }

    const traits: CharacterTrait[] = [];
    const sourceText = [
      character.featuresAndTraits || "",
      character.notes || "",
    ].join("\n\n");

    if (!sourceText.trim()) return [];

    // Parse block headers like ### Rasgo or **Rasgo**: Desc
    const blocks = sourceText.split(/(?=\n###|\n\*\*|\n[•\-\*]\s+\*\*)/);
    for (const b of blocks) {
      const clean = b.trim();
      if (!clean) continue;

      const titleMatch = clean.match(
        /^(?:###\s*|\*\*\s*|[•\-\*]\s+\*\*)([^*:\n#]+)(?:\*\*|:)?\s*([\s\S]*)$/,
      );
      if (titleMatch) {
        const title = titleMatch[1].replace(/[*#]/g, "").trim();
        const desc = titleMatch[2].replace(/^[:\s-]+/, "").trim();
        if (title.length > 2) {
          const isFeat =
            /dote|feat/i.test(title) ||
            /afortunado|iniciado|alerta|tirador|robusto/i.test(title);
          traits.push({
            name: title,
            type: isFeat ? "feat" : "class",
            source: isFeat ? "Dote" : "Rasgo de Clase / Linaje",
            description: desc || clean,
          });
        }
      } else if (clean.length > 20) {
        traits.push({
          name: "Aptitud Especial",
          type: "other",
          source: "Crónica",
          description: clean,
        });
      }
    }

    return traits;
  }, [character.traits, character.featuresAndTraits, character.notes]);

  // Dynamic Spells Extraction
  const resolvedSpells = useMemo<CharacterSpell[]>(() => {
    if (character.spells && character.spells.length > 0) {
      return character.spells;
    }

    const spells: CharacterSpell[] = [];
    const sheetText = character.sheetText || character.notes || "";

    // Search for cantrips and spells in sheetText
    const spellMatches = sheetText.match(
      /(?:Trucos|Conjuros|Spells|Cantrips)[\s\S]*?(?:###|\n\n\n|$)/i,
    );
    if (spellMatches) {
      const lines = spellMatches[0].split("\n");
      let currentLevel = 0;
      for (const line of lines) {
        if (/truco|cantrip|nivel\s*0/i.test(line)) {
          currentLevel = 0;
        } else if (/nivel\s*1|1er\s*nivel/i.test(line)) {
          currentLevel = 1;
        } else if (/nivel\s*2|2º\s*nivel/i.test(line)) {
          currentLevel = 2;
        } else if (/nivel\s*3|3er\s*nivel/i.test(line)) {
          currentLevel = 3;
        }

        const itemMatch = line.match(
          /^[•\-\*]\s*([^(:\n]+)(?:\(([^)]+)\))?(?::\s*([^\n]+))?/,
        );
        if (itemMatch) {
          const name = itemMatch[1].replace(/[*_]/g, "").trim();
          if (name && !/trucos|conjuros|nivel/i.test(name)) {
            spells.push({
              name,
              level: currentLevel,
              castingTime: itemMatch[2]?.includes("acción")
                ? itemMatch[2]
                : "1 acción",
              range:
                itemMatch[2]?.includes("pies") ||
                itemMatch[2]?.includes("toque")
                  ? itemMatch[2]
                  : undefined,
              description:
                itemMatch[3] ||
                itemMatch[2] ||
                "Conjuro preparado según la crónica y trasfondo.",
              isRitual: /ritual/i.test(line),
            });
          }
        }
      }
    }

    return spells;
  }, [character.spells, character.sheetText, character.notes]);

  const hasSpellcasting = Boolean(
    resolvedSpells.length > 0 ||
    character.spellcasting?.ability ||
    character.spellcasting?.saveDc ||
    (character.class &&
      /druida|mago|brujo|cl[eé]rigo|hechicero|bardo|palad[ií]n|explorador|art[ií]fice|wizard|sorcerer|warlock|cleric|druid|bard|paladin|ranger/i.test(
        character.class,
      )),
  );

  // Inventory filtering & weight calculation
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      let matchCat = true;
      if (categoryFilter === "all") matchCat = true;
      else if (categoryFilter === "equipped") matchCat = !!item.equipped;
      else if (categoryFilter === "attuned") matchCat = !!item.attuned;
      else matchCat = item.category === categoryFilter;

      let matchSearch = true;
      if (inventorySearch.trim()) {
        const q = inventorySearch.toLowerCase();
        matchSearch =
          (item.name || "").toLowerCase().includes(q) ||
          (item.description || "").toLowerCase().includes(q) ||
          (item.damageOrAc || "").toLowerCase().includes(q);
      }
      return matchCat && matchSearch;
    });
  }, [inventory, categoryFilter, inventorySearch]);

  const totalWeight = useMemo(() => {
    return inventory.reduce(
      (sum, item) => sum + (item.weight || 0) * (item.quantity || 1),
      0,
    );
  }, [inventory]);

  const maxCarryWeight =
    character.maxCarryWeight || (attributes.str || 10) * 15;
  const carryPercent = Math.min(
    100,
    Math.round((totalWeight / Math.max(1, maxCarryWeight)) * 100),
  );

  const totalGoldValue = useMemo(() => {
    const gpVal =
      (currencies.cp || 0) / 100 +
      (currencies.sp || 0) / 10 +
      (currencies.ep || 0) / 2 +
      (currencies.gp || 0) +
      (currencies.pp || 0) * 10;
    return gpVal.toFixed(1);
  }, [currencies]);

  const hpPercent = Math.max(
    0,
    Math.min(100, Math.round((hp / Math.max(1, maxHp)) * 100)),
  );

  const getHpBarColor = () => {
    if (hp <= 0) return "bg-red-700";
    if (hpPercent <= 30) return "bg-rose-500";
    if (hpPercent <= 60) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getCategoryIcon = (cat?: string, name: string = "") => {
    if (/fionn|ogham|or[aá]culo|reliquia|foco|amulet/i.test(name)) {
      return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
    switch (cat) {
      case "weapon":
        return <Swords className="w-4 h-4 text-amber-500" />;
      case "armor":
        return <Shield className="w-4 h-4 text-blue-400" />;
      case "potion":
        return <FlaskConical className="w-4 h-4 text-emerald-400" />;
      case "scroll":
        return <Scroll className="w-4 h-4 text-amber-600" />;
      case "magic":
        return <Wand2 className="w-4 h-4 text-purple-400" />;
      case "treasure":
        return <Coins className="w-4 h-4 text-amber-400" />;
      default:
        return <Gem className="w-4 h-4 text-[var(--accent)]" />;
    }
  };

  const filteredSpells = useMemo(() => {
    if (spellLevelFilter === "all") return resolvedSpells;
    return resolvedSpells.filter((s) => s.level === spellLevelFilter);
  }, [resolvedSpells, spellLevelFilter]);

  // Languages & Proficiencies list
  const parsedLanguages = useMemo(() => {
    if (character.languages && character.languages.length > 0) {
      return character.languages;
    }
    const txt = `${character.proficienciesAndLanguages || ""} ${character.sheetText || ""}`;
    const found: string[] = [];
    [
      "Común",
      "Drúidico",
      "Silvano",
      "Élfico",
      "Enano",
      "Orco",
      "Gnómico",
      "Mediano",
      "Dracónico",
      "Infernal",
      "Abisal",
      "Celestial",
      "Primordial",
    ].forEach((lang) => {
      if (new RegExp(`\\b${lang}\\b`, "i").test(txt)) {
        found.push(lang);
      }
    });
    return found.length ? found : ["Común"];
  }, [
    character.languages,
    character.proficienciesAndLanguages,
    character.sheetText,
  ]);

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s_ease]">
      {/* HERO / STAT CARD */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-stone-900/90 to-black/95 text-amber-100 p-6 md:p-8 shadow-xl group/hero">
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/hero:opacity-100 transition-opacity z-10">
          {onOpenEditModal && (
            <button
              type="button"
              onClick={onOpenEditModal}
              className="p-1.5 rounded-md bg-black/60 border border-amber-500/50 text-amber-300/80 hover:text-amber-100 hover:border-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
              title="Editar Ficha Manualmente"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onClearCharacter && (
            <button
              type="button"
              onClick={onClearCharacter}
              className="p-1.5 rounded-md bg-black/60 border border-red-500/50 text-red-400 hover:text-red-200 hover:border-red-400 hover:bg-red-500/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
              title="Vaciar Ficha del Personaje"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-0">
          {/* Character Portrait */}
          <div className="relative shrink-0 group">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-lg bg-black/60 flex items-center justify-center relative">
              {character.portrait ? (
                <img
                  src={character.portrait}
                  alt={character.name || "Protagonista"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-3">
                  <Sparkles className="w-8 h-8 text-amber-400/60 mx-auto mb-1" />
                  <span className="font-cinzel text-[10px] text-amber-300/80 uppercase font-bold tracking-wider">
                    {character.name || "Protagonista"}
                  </span>
                </div>
              )}

              {onOpenPortraitPicker && (
                <button
                  type="button"
                  onClick={onOpenPortraitPicker}
                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-amber-200 text-xs font-cinzel font-bold gap-1 cursor-pointer"
                >
                  <Image className="w-5 h-5" />
                  <span>Cambiar</span>
                </button>
              )}
            </div>

            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 text-[10px] font-cinzel font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-300 shadow-md whitespace-nowrap">
              Protagonista
            </div>
          </div>

          {/* Character Identity */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <h1 className="font-cinzel text-3xl sm:text-4xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 m-0 break-words line-clamp-3">
                {character.name || "Protagonista"}
              </h1>
              {character.level && (
                <span className="text-xs font-cinzel font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {character.level.startsWith("Nivel")
                    ? character.level
                    : `Nivel ${character.level}`}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 text-xs sm:text-sm text-amber-200/80 font-cinzel">
              {character.race && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  <span>{character.race}</span>
                </span>
              )}
              {character.class && (
                <span className="flex items-center gap-1">
                  <span>·</span>
                  <span className="text-amber-100 font-semibold">
                    {character.class}{" "}
                    {character.subclass ? `(${character.subclass})` : ""}
                  </span>
                </span>
              )}
              {character.background && (
                <span className="flex items-center gap-1">
                  <span>·</span>
                  <span>{character.background}</span>
                </span>
              )}
              {character.alignment && (
                <span className="flex items-center gap-1">
                  <span>·</span>
                  <span className="italic opacity-80">
                    {character.alignment}
                  </span>
                </span>
              )}
            </div>

            {onOpenPortraitPicker && (
              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2">
                <button
                  type="button"
                  onClick={onOpenPortraitPicker}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-[11px] text-amber-200 font-cinzel transition-all cursor-pointer"
                >
                  <Image className="w-3 h-3" />
                  <span>Elegir Retrato</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* COMBAT VITALS ROW */}
        <div className="mt-6 pt-6 border-t border-amber-500/20 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* PG / HP */}
          <div className="col-span-2 sm:col-span-2 bg-black/40 rounded-2xl p-3.5 border border-amber-500/30 flex flex-col justify-between shadow-inner">
            <div className="flex justify-between items-center text-xs font-cinzel">
              <span className="font-bold text-amber-300 flex items-center gap-1.5 uppercase">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />{" "}
                Puntos de Golpe (PG)
              </span>
              <span className="font-bold text-amber-100 text-sm">
                {hp}{" "}
                <span className="text-amber-300/60 text-xs">
                  / {maxHp} {character.hitDice ? `(${character.hitDice})` : ""}
                </span>
              </span>
            </div>
            <div className="w-full bg-black/60 rounded-full h-2.5 border border-amber-500/20 overflow-hidden my-2">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getHpBarColor()}`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-amber-200/70 font-cinzel">
              <span>
                {hp <= 0
                  ? "💀 Inconsciente"
                  : hpPercent <= 30
                    ? "⚠️ Herido"
                    : "🛡️ Vitalidad activa"}
              </span>
              {character.conditions && character.conditions.length > 0 && (
                <span className="text-rose-400 font-bold">
                  {character.conditions.join(", ")}
                </span>
              )}
            </div>
          </div>

          {/* CA */}
          <div className="bg-black/40 rounded-2xl p-3 border border-amber-500/30 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-[10px] font-cinzel uppercase text-amber-300/80 font-bold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" /> Clase Armadura
            </span>
            <span className="font-cinzel text-2xl font-black text-amber-200 my-0.5">
              {ac}
            </span>
            <span className="text-[10px] text-amber-300/60 font-cinzel">
              CA Defensiva
            </span>
          </div>

          {/* Velocidad */}
          <div className="bg-black/40 rounded-2xl p-3 border border-amber-500/30 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-[10px] font-cinzel uppercase text-amber-300/80 font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Velocidad
            </span>
            <span className="font-cinzel text-lg font-bold text-amber-200 my-0.5">
              {speed}
            </span>
            <span className="text-[10px] text-amber-300/60 font-cinzel">
              Desplazamiento
            </span>
          </div>

          {/* Iniciativa & Bono Competencia */}
          <div className="bg-black/40 rounded-2xl p-3 border border-amber-500/30 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-[10px] font-cinzel uppercase text-amber-300/80 font-bold">
              Inic. / Comp.
            </span>
            <div className="flex items-center gap-2 my-0.5">
              <span className="font-cinzel text-lg font-bold text-amber-200">
                {initiative}
              </span>
              <span className="text-amber-500">·</span>
              <span className="font-cinzel text-lg font-bold text-amber-400">
                +{proficiencyBonus}
              </span>
            </div>
            <span className="text-[10px] text-amber-300/60 font-cinzel">
              Iniciativa · Bono
            </span>
          </div>
        </div>

        {/* 6 ATTRIBUTES RIBBON */}
        <div className="mt-4 pt-4 border-t border-amber-500/20">
          <div className="text-[11px] font-cinzel font-bold text-amber-300/90 mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Puntuaciones de Característica & Modificadores
            </span>
            {savingThrowProfs.length > 0 && (
              <span className="text-amber-400/90 text-[10px]">
                ★ Salvaciones con competencia: {savingThrowProfs.join(", ")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {statList.map((st) => {
              const { isProf, bonus } = getSavingThrowBonus(st.short, st.score);
              const mod = formatModifier(calculateModifier(st.score));
              return (
                <div
                  key={st.key}
                  className={`rounded-xl p-2.5 flex flex-col items-center justify-between text-center border transition-all ${
                    isProf
                      ? "bg-amber-950/60 border-amber-400/90 shadow-md ring-1 ring-amber-400/40"
                      : "bg-black/40 border-amber-500/20"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 w-full">
                    <span className="text-[11px] font-cinzel font-black uppercase text-amber-300">
                      {st.short}
                    </span>
                    {isProf && (
                      <span
                        className="text-[9px] text-amber-400 font-bold"
                        title="Competencia en Salvación"
                      >
                        ★
                      </span>
                    )}
                  </div>
                  <span className="font-cinzel text-xl font-black text-amber-100 my-0.5">
                    {st.score}{" "}
                    <span className="text-xs text-amber-400/90 font-bold">
                      ({mod})
                    </span>
                  </span>
                  <div className="text-[9px] font-cinzel text-amber-300/70 border-t border-amber-500/20 w-full pt-1 mt-0.5 flex items-center justify-center gap-1">
                    <span>Salv:</span>
                    <span
                      className={`font-bold ${isProf ? "text-amber-300" : "text-amber-200/60"}`}
                    >
                      {bonus}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center justify-center sm:justify-start border-b border-[var(--glass-border)] gap-2 flex-wrap pb-1">
        {[
          {
            id: "combat",
            label: "⚔️ Habilidades & Rasgos",
            count: resolvedTraits.length ? `(${resolvedTraits.length})` : "",
          },
          {
            id: "magic",
            label: "🔮 Magia & Conjuros",
            count: resolvedSpells.length
              ? `(${resolvedSpells.length})`
              : hasSpellcasting
                ? ""
                : "•",
          },
          {
            id: "inventory",
            label: "🎒 Inventario & Equipo",
            count: inventory.length ? `(${inventory.length})` : "",
          },
          { id: "profile", label: "🎭 Trasfondo & Vínculos", count: "" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`font-cinzel text-xs md:text-sm px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-t border-x ${
              activeTab === tab.id
                ? "bg-[var(--surface)] text-[var(--accent)] font-bold border-[var(--accent)] shadow-sm -mb-px"
                : "bg-transparent text-[var(--text-secondary)] border-transparent hover:text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--surface)_40%,transparent)]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count && (
              <span className="text-[11px] opacity-80">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: ⚔️ HABILIDADES & RASGOS */}
      {activeTab === "combat" && (
        <div className="space-y-6">
          {/* Habilidades Desglosadas Dinámicamente */}
          <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--glass-border)] pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-500" />
                <h3 className="font-cinzel text-base font-bold text-[var(--accent)] m-0">
                  Desglose de Habilidades (18 Competencias D&D)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-cinzel">
                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                  ★ Experta (Pericia x2)
                </span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                  ✓ Competente (+Comp)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {computedSkills.map((sk) => (
                <div
                  key={sk.name}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    sk.isExpert
                      ? "bg-purple-500/10 border-purple-500/40 text-[var(--text-primary)] ring-1 ring-purple-500/20"
                      : sk.isProf
                        ? "bg-amber-500/10 border-amber-500/40 text-[var(--text-primary)]"
                        : "bg-[var(--surface)] border-[var(--glass-border)] text-[var(--text-secondary)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-black/10 dark:bg-black/40 text-[var(--text-secondary)] font-bold">
                      {sk.statShort}
                    </span>
                    <span
                      className={`font-cinzel font-medium ${sk.isProf || sk.isExpert ? "font-bold text-[var(--text-primary)]" : ""}`}
                    >
                      {sk.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {sk.isExpert ? (
                      <span className="text-[10px] font-cinzel font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300">
                        Pericia
                      </span>
                    ) : sk.isProf ? (
                      <span className="text-[10px] font-cinzel font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Comp.
                      </span>
                    ) : null}
                    <span
                      className={`font-cinzel font-black text-sm ${sk.isExpert ? "text-purple-600 dark:text-purple-400 font-extrabold" : sk.isProf ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-secondary)]"}`}
                    >
                      {sk.bonusStr}
                      {sk.passivePerception
                        ? ` (Pasiva ${sk.passivePerception})`
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tarjetas Ricas de Rasgos & Dotes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-cinzel text-base font-bold text-[var(--accent)] flex items-center gap-2 m-0">
                <Flame className="w-5 h-5 text-orange-500" /> Rasgos de Clase,
                Dotes & Aptitudes
              </h3>
              <span className="text-xs font-cinzel text-[var(--text-secondary)]">
                {resolvedTraits.length} aptitudes registradas
              </span>
            </div>

            {resolvedTraits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {resolvedTraits.map((t, idx) => (
                  <div
                    key={`${t.name}_${idx}`}
                    className="p-4 rounded-2xl bg-[var(--surface-soft)] border border-[var(--user-border)] shadow-xs flex flex-col justify-between gap-2.5 hover:border-[var(--accent)] transition-all"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)] text-amber-500">
                            {t.type === "feat" ? (
                              <Star className="w-4 h-4" />
                            ) : (
                              <Flame className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-cinzel text-sm font-bold text-[var(--text-primary)] m-0 leading-tight">
                              {t.name}
                            </h4>
                            <span className="text-[10px] font-cinzel text-[var(--accent)] font-semibold">
                              {t.source ||
                                (t.type === "feat"
                                  ? "Dote Especial"
                                  : "Rasgo de Clase")}
                            </span>
                          </div>
                        </div>

                        {t.uses && (
                          <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-cinzel text-[10px] font-bold">
                            {t.uses.current}/{t.uses.max} usos
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-[var(--text-primary)] m-0 font-lora leading-relaxed whitespace-pre-wrap">
                        {t.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-[var(--surface-soft)] rounded-2xl border border-[var(--user-border)] text-center text-xs text-[var(--text-secondary)] font-lora">
                No se registraron rasgos de clase o dotes adicionales en el
                documento.
              </div>
            )}
          </div>

          {/* Idiomas & Competencias en Equipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 rounded-2xl shadow-sm space-y-3">
              <h4 className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 m-0 uppercase">
                <Languages className="w-4 h-4 text-emerald-500" /> Idiomas
                Conocidos
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {parsedLanguages.map((l) => (
                  <span
                    key={l}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)] text-xs font-cinzel font-semibold text-[var(--text-primary)]"
                  >
                    ✦ {l}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 rounded-2xl shadow-sm space-y-3">
              <h4 className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 m-0 uppercase">
                <Wrench className="w-4 h-4 text-amber-500" /> Competencias en
                Equipo & Herramientas
              </h4>
              <p className="text-xs text-[var(--text-primary)] m-0 font-lora leading-relaxed">
                {character.proficienciesAndLanguages ||
                  "Armaduras ligeras, bastones, lanzas, herramientas de herboristería y focos druídicos."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 🔮 MAGIA & CONJUROS */}
      {activeTab === "magic" && (
        <div className="space-y-6">
          {hasSpellcasting ? (
            <div className="space-y-6">
              {/* Aptitud Mágica Overview */}
              <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-purple-500" />
                    <h3 className="font-cinzel text-base font-bold text-[var(--accent)] m-0">
                      Aptitud Mágica & Estadísticas de Conjuro
                    </h3>
                  </div>
                  <span className="text-xs font-cinzel text-[var(--text-secondary)]">
                    {character.class || "Lanzador de Conjuros"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center font-cinzel">
                  <div className="p-3.5 bg-[var(--surface)] rounded-xl border border-[var(--glass-border)]">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase block">
                      Característica Mágica
                    </span>
                    <span className="text-base font-bold text-[var(--accent)]">
                      {character.spellcasting?.ability || "Sabiduría"}
                    </span>
                  </div>
                  <div className="p-3.5 bg-[var(--surface)] rounded-xl border border-[var(--glass-border)]">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase block">
                      CD Salvación Conjuros
                    </span>
                    <span className="text-xl font-black text-[var(--accent)]">
                      {character.spellcasting?.saveDc ||
                        8 +
                          proficiencyBonus +
                          calculateModifier(attributes.wis)}
                    </span>
                  </div>
                  <div className="p-3.5 bg-[var(--surface)] rounded-xl border border-[var(--glass-border)]">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase block">
                      Bono Ataque Conjuros
                    </span>
                    <span className="text-xl font-black text-[var(--accent)]">
                      {character.spellcasting?.attackBonus !== undefined
                        ? formatModifier(character.spellcasting.attackBonus)
                        : formatModifier(
                            proficiencyBonus +
                              calculateModifier(attributes.wis),
                          )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filtro por Nivel de Conjuro */}
              <div className="flex items-center justify-between gap-2 flex-wrap bg-[var(--sidebar-bg)] p-3 rounded-2xl border border-[var(--user-border)]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: "all", label: "Todos" },
                    { id: 0, label: "Trucos (Nvl 0)" },
                    { id: 1, label: "Nivel 1" },
                    { id: 2, label: "Nivel 2" },
                    { id: 3, label: "Nivel 3+" },
                  ].map((f) => (
                    <button
                      key={String(f.id)}
                      type="button"
                      onClick={() => setSpellLevelFilter(f.id as any)}
                      className={`text-xs font-cinzel px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                        spellLevelFilter === f.id
                          ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] font-bold shadow-xs"
                          : "border-[var(--user-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-cinzel text-[var(--text-secondary)]">
                  {filteredSpells.length} conjuros listados
                </span>
              </div>

              {/* Tarjetas de Conjuros */}
              {filteredSpells.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredSpells.map((sp, idx) => (
                    <div
                      key={`${sp.name}_${idx}`}
                      className="p-4 rounded-2xl bg-[var(--surface-soft)] border border-[var(--user-border)] shadow-xs flex flex-col justify-between gap-3 hover:border-purple-500/60 transition-all group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-cinzel text-sm font-bold text-[var(--text-primary)] m-0 leading-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {sp.name}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[10px] font-cinzel text-[var(--text-secondary)]">
                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                  {sp.level === 0
                                    ? "Truco"
                                    : `Nivel ${sp.level}`}
                                </span>
                                {sp.school && <span>· {sp.school}</span>}
                                {sp.isRitual && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                                    Ritual
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Metadatos de lanzamiento */}
                        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-cinzel bg-[var(--surface)] p-2 rounded-xl border border-[var(--glass-border)]">
                          <div>
                            <span className="text-[var(--text-secondary)] block">
                              Tiempo:
                            </span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {sp.castingTime || "1 acción"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[var(--text-secondary)] block">
                              Alcance:
                            </span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {sp.range || "Toque/30 pies"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[var(--text-secondary)] block">
                              Duración:
                            </span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {sp.duration || "Instantáneo"}
                            </span>
                          </div>
                        </div>

                        {sp.damageOrEffect && (
                          <div className="text-[11px] font-cinzel font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            ⚔️ Efecto / Daño: {sp.damageOrEffect}
                          </div>
                        )}

                        <p className="text-xs text-[var(--text-primary)] m-0 font-lora leading-relaxed">
                          {sp.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-[var(--surface-soft)] rounded-2xl border border-[var(--user-border)] text-center text-xs text-[var(--text-secondary)] font-lora">
                  No hay conjuros que coincidan con el filtro seleccionado.
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 px-6 text-center bg-[var(--surface-soft)] rounded-3xl border border-[var(--user-border)] space-y-3">
              <Shield className="w-12 h-12 text-amber-500/60 mx-auto" />
              <h3 className="font-cinzel text-base font-bold text-[var(--accent)] m-0">
                Personaje / Clase Marcial
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto font-lora m-0">
                Este personaje no posee aptitud mágica registrada ni ranuras de
                conjuro en su ficha. Su potencial reside en el combate marcial,
                habilidades físicas y técnicas tácticas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 🎒 INVENTARIO & EQUIPO */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {/* Monedero & Carga Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Monedero */}
            <div className="md:col-span-2 bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 rounded-2xl shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-500" /> Monedero de
                  Campaña
                </span>
                <span className="text-xs font-cinzel text-[var(--text-secondary)]">
                  Total estimado:{" "}
                  <strong className="text-[var(--text-primary)]">
                    {totalGoldValue} PO
                  </strong>
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2 text-center font-cinzel">
                <div className="bg-[var(--surface)] border border-amber-500/40 p-2 rounded-xl">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">
                    ORO (PO)
                  </span>
                  <span className="text-base font-black text-[var(--text-primary)]">
                    {currencies.gp ?? 0}
                  </span>
                </div>
                <div className="bg-[var(--surface)] border border-slate-400/40 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-500 dark:text-slate-300 font-bold block">
                    PLATA (PP)
                  </span>
                  <span className="text-base font-black text-[var(--text-primary)]">
                    {currencies.sp ?? 0}
                  </span>
                </div>
                <div className="bg-[var(--surface)] border border-orange-600/40 p-2 rounded-xl">
                  <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold block">
                    COBRE (PC)
                  </span>
                  <span className="text-base font-black text-[var(--text-primary)]">
                    {currencies.cp ?? 0}
                  </span>
                </div>
                <div className="bg-[var(--surface)] border border-cyan-600/40 p-2 rounded-xl">
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold block">
                    ELECTRO (PE)
                  </span>
                  <span className="text-base font-black text-[var(--text-primary)]">
                    {currencies.ep ?? 0}
                  </span>
                </div>
                <div className="bg-[var(--surface)] border border-purple-500/40 p-2 rounded-xl">
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block">
                    PLATINO (PT)
                  </span>
                  <span className="text-base font-black text-[var(--text-primary)]">
                    {currencies.pp ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Capacidad de Carga */}
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 rounded-2xl shadow-sm flex flex-col justify-between space-y-2">
              <div className="flex justify-between items-center text-xs font-cinzel">
                <span className="font-bold text-[var(--accent)] flex items-center gap-1">
                  <Backpack className="w-3.5 h-3.5" /> Peso & Mochila
                </span>
                <span className="font-bold text-[var(--text-primary)]">
                  {totalWeight.toFixed(1)} / {maxCarryWeight} lbs
                </span>
              </div>
              <div className="w-full bg-black/10 dark:bg-black/30 rounded-full h-2 overflow-hidden border border-[var(--user-border)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    carryPercent > 90
                      ? "bg-red-500"
                      : carryPercent > 70
                        ? "bg-amber-500"
                        : "bg-[var(--accent)]"
                  }`}
                  style={{ width: `${carryPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-tight italic">
                {carryPercent > 100
                  ? "⚠️ Sobrecargado"
                  : "Mochila equilibrada para marcha y combate."}
              </p>
            </div>
          </div>

          {/* Filtros & Barra de Búsqueda */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[var(--sidebar-bg)] p-3 rounded-2xl border border-[var(--user-border)]">
            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
              {[
                { id: "all", label: "Todos" },
                { id: "equipped", label: "⚔️ Equipados" },
                { id: "weapon", label: "Armas" },
                { id: "magic", label: "Mágicos & Oráculos" },
                { id: "potion", label: "Pociones" },
                { id: "armor", label: "Armaduras" },
                { id: "equipment", label: "Equipo" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`text-xs font-cinzel px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    categoryFilter === cat.id
                      ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] font-bold shadow-xs"
                      : "border-[var(--user-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Buscar objeto, arma u oráculo..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface)] border border-[var(--user-border)] focus:border-[var(--accent)] rounded-lg text-xs outline-none"
              />
            </div>
          </div>

          {/* Lista de Tarjetas de Objetos */}
          {filteredInventory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredInventory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setInspectItem(item)}
                  className={`group p-3.5 rounded-2xl border transition-all cursor-pointer bg-[var(--surface-soft)] hover:border-[var(--accent)] hover:shadow-md flex flex-col justify-between gap-2 relative overflow-hidden ${
                    item.equipped
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-[var(--user-border)]"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)] shrink-0">
                          {getCategoryIcon(item.category, item.name)}
                        </div>
                        <div>
                          <h4 className="font-cinzel text-sm font-bold text-[var(--text-primary)] m-0 leading-tight group-hover:text-[var(--accent)] transition-colors">
                            {item.name}
                          </h4>
                          {item.damageOrAc && (
                            <span className="text-[11px] text-[var(--accent)] font-semibold font-cinzel block">
                              {item.damageOrAc}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {item.quantity && item.quantity > 1 && (
                          <span className="text-[11px] font-cinzel font-bold px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
                            x{item.quantity}
                          </span>
                        )}
                        {item.equipped && (
                          <span className="text-[10px] font-cinzel font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-400">
                            Equipado
                          </span>
                        )}
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed m-0 font-lora">
                        {item.description}
                      </p>
                    )}

                    {item.durationNote && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-cinzel pt-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{item.durationNote}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)] text-[10px] text-[var(--text-secondary)] font-cinzel">
                    <span>
                      {item.weight ? `${item.weight} lbs` : "Peso ligero"}
                    </span>
                    <span className="text-[var(--accent)] group-hover:underline">
                      Ver detalles ❖
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center bg-[var(--surface-soft)] rounded-2xl border border-dashed border-[var(--user-border)] space-y-2">
              <Backpack className="w-10 h-10 text-[var(--text-secondary)] opacity-40 mx-auto" />
              <p className="text-xs font-cinzel text-[var(--text-secondary)] m-0">
                No hay objetos en el inventario que coincidan con la búsqueda.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: 🎭 TRASFONDO & VÍNCULOS (TARJETAS INDIVIDUALES) */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Apariencia Física */}
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-2xl shadow-sm space-y-2.5">
              <h4 className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 m-0 uppercase">
                <Eye className="w-4 h-4 text-amber-500" /> Apariencia Física &
                Porte
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-primary)] m-0 font-lora bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)]">
                {character.appearance ||
                  "Rasgos físicos, complexión, mirada y vestimenta descritos en la crónica del personaje."}
              </p>
            </div>

            {/* Personalidad */}
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-2xl shadow-sm space-y-2.5">
              <h4 className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 m-0 uppercase">
                <Sparkles className="w-4 h-4 text-purple-500" /> Personalidad &
                Actitud
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-primary)] m-0 font-lora bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)]">
                {character.personality ||
                  "Comportamiento habitual, serenidad, templanza o instinto ante el peligro."}
              </p>
            </div>

            {/* Ideales */}
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-2xl shadow-sm space-y-2.5">
              <h4 className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 m-0 uppercase">
                <Star className="w-4 h-4 text-amber-400" /> Ideales & Principios
                Éticos
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-primary)] m-0 font-lora bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)]">
                {character.ideals ||
                  "Principios que guían sus decisiones, respeto a la naturaleza y al equilibrio cósmico."}
              </p>
            </div>

            {/* Vínculos */}
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-2xl shadow-sm space-y-2.5">
              <h4 className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 m-0 uppercase">
                <Heart className="w-4 h-4 text-rose-500" /> Vínculos & Lealtades
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-primary)] m-0 font-lora bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)]">
                {character.bonds ||
                  "Lazos con su arboleda, compañeros, protectores del círculo o juramentos del pasado."}
              </p>
            </div>

            {/* Defectos */}
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-2xl shadow-sm space-y-2.5">
              <h4 className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 m-0 uppercase">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Defectos &
                Sombras
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-primary)] m-0 font-lora bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)]">
                {character.flaws ||
                  "Dudas, vulnerabilidades emocionales o secretos que acechan su sendero."}
              </p>
            </div>

            {/* Historia de Origen */}
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-2xl shadow-sm space-y-2.5">
              <h4 className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 m-0 uppercase">
                <Feather className="w-4 h-4 text-amber-500" /> Historia de
                Origen & Trasfondo
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-primary)] m-0 font-lora bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)]">
                {character.backstory ||
                  "El origen del protagonista, su linaje y las razones que lo llevaron al camino de la aventura."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / INSPECTOR DE OBJETO */}
      {inspectItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
          <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-2xl shadow-2xl w-full max-w-md font-lora overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--sidebar-bg)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  {getCategoryIcon(inspectItem.category, inspectItem.name)}
                </div>
                <div>
                  <h3 className="font-cinzel text-sm font-bold text-[var(--text-primary)] m-0">
                    {inspectItem.name}
                  </h3>
                  <span className="text-[10px] font-cinzel text-[var(--accent)]">
                    {inspectItem.category?.toUpperCase() || "EQUIPO"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px] font-cinzel">
                <div className="p-2 bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)]">
                  <span className="text-[var(--text-secondary)] block">
                    Cantidad:
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {inspectItem.quantity || 1}
                  </span>
                </div>
                <div className="p-2 bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)]">
                  <span className="text-[var(--text-secondary)] block">
                    Peso:
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {inspectItem.weight ? `${inspectItem.weight} lbs` : "—"}
                  </span>
                </div>
              </div>

              {inspectItem.damageOrAc && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 font-cinzel font-bold text-xs">
                  ⚔️ Daño / Propiedades: {inspectItem.damageOrAc}
                </div>
              )}

              {inspectItem.durationNote && (
                <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-800 dark:text-purple-300 font-cinzel text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Caducidad / Duración: {inspectItem.durationNote}</span>
                </div>
              )}

              <div className="space-y-1 pt-1">
                <span className="font-cinzel font-bold text-[var(--text-secondary)] text-[11px] block">
                  Descripción & Lore:
                </span>
                <p className="text-[var(--text-primary)] leading-relaxed m-0 font-lora bg-[var(--surface)] p-3 rounded-xl border border-[var(--user-border)]">
                  {inspectItem.description ||
                    "Objeto perteneciente al inventario del protagonista."}
                </p>
              </div>
            </div>

            <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--sidebar-bg)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] font-cinzel text-xs font-bold cursor-pointer hover:bg-[var(--accent-hover)] transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
