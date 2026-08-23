import React, { useState, useMemo } from 'react';
import {
  PlayerCharacter,
  PlayerAttributes,
  PlayerCurrencies,
  CharacterSpell,
  CharacterTrait
} from '../types';
import { ensureValidPlayerCharacter } from '../utils/characterSheetParser';
import {
  DND_CLASSES_COMPENDIUM,
  DND_RACES_COMPENDIUM,
  DND_BACKGROUNDS_COMPENDIUM,
  DND_FEATS_COMPENDIUM,
  DND_SPELLS_COMPENDIUM,
  DND_COMPANIONS_TEMPLATES,
  applyClassTemplate,
  applyRaceTemplate,
  applyBackgroundTemplate,
  createCompanionFromTemplate,
  CompendiumSpell
} from '../data/dndCompendium';
import {
  Crown,
  Image,
  X,
  BookOpen,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Wand2,
  Star,
  Award,
  Zap
} from 'lucide-react';

interface CharacterEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: PlayerCharacter;
  onSave: (updated: PlayerCharacter) => Promise<void>;
  allImageFiles?: { id: string; name: string; content: string }[];
  onOpenPortraitPicker?: () => void;
}

export const CharacterEditModal: React.FC<CharacterEditModalProps> = ({
  isOpen,
  onClose,
  character,
  onSave,
  allImageFiles = [],
  onOpenPortraitPicker
}) => {
  const [draft, setDraft] = useState<PlayerCharacter>(() => ensureValidPlayerCharacter(character));
  const [activeModalTab, setActiveModalTab] = useState<
    'general' | 'spells' | 'traits' | 'stats' | 'roleplay' | 'technical'
  >('general');

  // Compendium Spell search & filters
  const [spellSearch, setSpellSearch] = useState('');
  const [selectedSpellClass, setSelectedSpellClass] = useState<string>('all');
  const [selectedSpellLevel, setSelectedSpellLevel] = useState<number | 'all'>('all');

  // Compendium Feats search
  const [featSearch, setFeatSearch] = useState('');
  const [newCustomSpell, setNewCustomSpell] = useState<Partial<CharacterSpell>>({
    name: '',
    level: 0,
    school: 'Evocación',
    castingTime: '1 acción',
    range: '30 pies',
    duration: 'Instantáneo',
    description: ''
  });
  const [isAddingCustomSpell, setIsAddingCustomSpell] = useState(false);

  // Custom trait adder
  const [newCustomTrait, setNewCustomTrait] = useState<Partial<CharacterTrait>>({
    name: '',
    type: 'class',
    source: 'Rasgo',
    description: ''
  });
  const [isAddingCustomTrait, setIsAddingCustomTrait] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const attributes = draft.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const currencies = draft.currencies || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const currentSpells = draft.spells || [];
  const currentTraits = draft.traits || [];

  const handleAttrChange = (key: keyof PlayerAttributes, val: number) => {
    setDraft({
      ...draft,
      attributes: {
        ...attributes,
        [key]: val
      }
    });
  };

  const handleCurrencyChange = (key: keyof PlayerCurrencies, val: number) => {
    setDraft({
      ...draft,
      currencies: {
        ...currencies,
        [key]: Math.max(0, val)
      }
    });
  };

  const [isSoloHeroicMode, setIsSoloHeroicMode] = useState<boolean>(false);

  // Preset Template Helpers (Offline compendium application)
  const handleSelectClassPreset = (className: string) => {
    const levelMatch = (draft.level || '1').match(/\d+/);
    const levelNum = levelMatch ? parseInt(levelMatch[0], 10) : 1;
    setDraft(prev => applyClassTemplate(prev, className, levelNum));
  };

  const handleSelectRacePreset = (raceName: string) => {
    setDraft(prev => applyRaceTemplate(prev, raceName));
  };

  const handleSelectBackgroundPreset = (bgName: string, append: boolean = false) => {
    setDraft(prev => applyBackgroundTemplate(prev, bgName, append));
  };

  const handleAddOriginFeat = (featName: string) => {
    const feat = DND_FEATS_COMPENDIUM.find(f => f.name.toLowerCase().includes(featName.toLowerCase())) ||
      DND_FEATS_COMPENDIUM.find(f => f.name.toLowerCase() === featName.toLowerCase());
    if (!feat) return;
    
    setDraft(prev => {
      const currentTraits = [...(prev.traits || [])];
      if (currentTraits.some(t => t.name.toLowerCase() === feat.name.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        traits: [
          ...currentTraits,
          {
            name: feat.name,
            type: 'feat',
            source: 'Dote de Origen (D&D 2024 / Modo Solitario)',
            description: feat.description
          }
        ]
      };
    });
  };

  const handleSelectCompanionPreset = (templateName: string) => {
    const newComp = createCompanionFromTemplate(templateName, draft.name);
    setDraft({
      ...newComp,
      portrait: draft.portrait || ''
    });
  };

  // Spell management
  const handleAddCompendiumSpell = (sp: CompendiumSpell) => {
    if (currentSpells.some(s => s.name.toLowerCase() === sp.name.toLowerCase())) return;
    const added: CharacterSpell = {
      name: sp.name,
      level: sp.level,
      school: sp.school,
      castingTime: sp.castingTime,
      range: sp.range,
      components: sp.components,
      duration: sp.duration,
      isRitual: sp.ritual,
      damageOrEffect: sp.damageOrEffect,
      description: sp.description,
      isPrepared: true
    };
    setDraft(prev => ({
      ...prev,
      spells: [...(prev.spells || []), added]
    }));
  };

  const handleRemoveSpell = (spellName: string) => {
    setDraft(prev => ({
      ...prev,
      spells: (prev.spells || []).filter(s => s.name.toLowerCase() !== spellName.toLowerCase())
    }));
  };

  const handleSaveCustomSpell = () => {
    if (!newCustomSpell.name?.trim()) return;
    const spell: CharacterSpell = {
      name: newCustomSpell.name.trim(),
      level: typeof newCustomSpell.level === 'number' ? newCustomSpell.level : 0,
      school: newCustomSpell.school || 'Universal',
      castingTime: newCustomSpell.castingTime || '1 acción',
      range: newCustomSpell.range || '30 pies',
      duration: newCustomSpell.duration || 'Instantáneo',
      description: newCustomSpell.description || '',
      damageOrEffect: newCustomSpell.damageOrEffect || undefined,
      isPrepared: true
    };
    setDraft(prev => ({
      ...prev,
      spells: [...(prev.spells || []), spell]
    }));
    setNewCustomSpell({
      name: '',
      level: 0,
      school: 'Evocación',
      castingTime: '1 acción',
      range: '30 pies',
      duration: 'Instantáneo',
      description: ''
    });
    setIsAddingCustomSpell(false);
  };

  // Feat & Trait management
  const handleAddCompendiumFeat = (feat: (typeof DND_FEATS_COMPENDIUM)[0]) => {
    if (currentTraits.some(t => t.name.toLowerCase() === feat.name.toLowerCase())) return;
    const newTrait: CharacterTrait = {
      name: feat.name,
      type: 'feat',
      source: 'Dote D&D 5e',
      description: feat.description
    };
    setDraft(prev => ({
      ...prev,
      traits: [...(prev.traits || []), newTrait]
    }));
  };

  const handleRemoveTrait = (traitName: string) => {
    setDraft(prev => ({
      ...prev,
      traits: (prev.traits || []).filter(t => t.name.toLowerCase() !== traitName.toLowerCase())
    }));
  };

  const handleSaveCustomTrait = () => {
    if (!newCustomTrait.name?.trim()) return;
    const trait: CharacterTrait = {
      name: newCustomTrait.name.trim(),
      type: newCustomTrait.type || 'other',
      source: newCustomTrait.source || 'Personalizado',
      description: newCustomTrait.description || ''
    };
    setDraft(prev => ({
      ...prev,
      traits: [...(prev.traits || []), trait]
    }));
    setNewCustomTrait({
      name: '',
      type: 'class',
      source: 'Rasgo',
      description: ''
    });
    setIsAddingCustomTrait(false);
  };

  // Filtered spells from Compendium
  const filteredCompendiumSpells = useMemo(() => {
    return DND_SPELLS_COMPENDIUM.filter(sp => {
      const matchesSearch =
        !spellSearch.trim() ||
        sp.name.toLowerCase().includes(spellSearch.toLowerCase()) ||
        (sp.englishName && sp.englishName.toLowerCase().includes(spellSearch.toLowerCase())) ||
        (sp.school && sp.school.toLowerCase().includes(spellSearch.toLowerCase())) ||
        (sp.description && sp.description.toLowerCase().includes(spellSearch.toLowerCase()));

      const matchesLevel = selectedSpellLevel === 'all' || sp.level === selectedSpellLevel;
      const matchesClass =
        selectedSpellClass === 'all' ||
        (sp.classes && sp.classes.some(c => c.toLowerCase() === selectedSpellClass.toLowerCase()));

      return matchesSearch && matchesLevel && matchesClass;
    });
  }, [spellSearch, selectedSpellLevel, selectedSpellClass]);

  // Filtered feats from Compendium
  const filteredCompendiumFeats = useMemo(() => {
    return DND_FEATS_COMPENDIUM.filter(f => {
      return (
        !featSearch.trim() ||
        f.name.toLowerCase().includes(featSearch.toLowerCase()) ||
        (f.prerequisite && f.prerequisite.toLowerCase().includes(featSearch.toLowerCase())) ||
        f.description.toLowerCase().includes(featSearch.toLowerCase())
      );
    });
  }, [featSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name?.trim()) return;
    await onSave(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)]/50 rounded-2xl shadow-2xl w-[820px] max-w-full font-lora max-h-[94vh] flex flex-col overflow-hidden animate-[fadeIn_0.15s_ease]">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-[var(--glass-border)] bg-[var(--surface-soft)]">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-cinzel text-base sm:text-lg font-bold text-[var(--accent)] m-0">
              {draft.name
                ? `${draft.characterType === 'companion' ? 'Familiar / Compañero' : 'Ficha D&D'}: ${draft.name}`
                : 'Crear Ficha D&D 5e'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Sub-tabs */}
        <div className="flex border-b border-[var(--glass-border)] px-4 bg-[var(--sidebar-bg)] gap-1.5 overflow-x-auto text-xs font-cinzel">
          {[
            { id: 'general', label: '1. Identidad & Plantillas' },
            { id: 'spells', label: `2. Hechizos (${currentSpells.length})` },
            { id: 'traits', label: `3. Dotes & Rasgos (${currentTraits.length})` },
            { id: 'stats', label: '4. Atributos & Oro' },
            { id: 'roleplay', label: '5. Trasfondo & Rol' },
            { id: 'technical', label: '6. Ficha Técnica' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveModalTab(tab.id as any)}
              className={`py-2.5 px-3 border-b-2 font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeModalTab === tab.id
                  ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]/40'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 text-xs">
          {/* TAB 1: IDENTIDAD Y PLANTILLAS DEL COMPENDIO */}
          {activeModalTab === 'general' && (
            <div className="flex flex-col gap-4">
              {/* Character Type Selector */}
              <div className="bg-[var(--surface-soft)] p-3 rounded-xl border border-[var(--user-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="font-cinzel font-bold text-[var(--accent)] block">Tipo de Personaje</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Distingue a tu protagonista de familiares, monturas y PNJ
                  </span>
                </div>
                <div className="flex gap-2">
                  {[
                    { id: 'pc', label: 'Protagonista (OC)' },
                    { id: 'companion', label: 'Familiar / Compañero' },
                    { id: 'npc', label: 'PNJ / Monstruo' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, characterType: t.id as any })}
                      className={`px-2.5 py-1 text-xs font-cinzel rounded-lg border transition-all cursor-pointer ${
                        (draft.characterType || 'pc') === t.id
                          ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold border-[var(--accent)]'
                          : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Companion Quick-Fill Templates if Companion */}
              {draft.characterType === 'companion' && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-cinzel font-bold text-xs">
                    <Sparkles className="w-4 h-4" /> Plantillas de Familiares y Compañeros del Compendio:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DND_COMPANIONS_TEMPLATES.map(tmpl => (
                      <button
                        key={tmpl.name}
                        type="button"
                        onClick={() => handleSelectCompanionPreset(tmpl.name)}
                        className="px-2.5 py-1 text-[11px] font-cinzel rounded-md bg-[var(--surface)] border border-amber-500/40 hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-all cursor-pointer font-semibold shadow-xs"
                      >
                        + {tmpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Name and Level */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    Nombre del Personaje / Criatura *
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.name || ''}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none focus:border-[var(--accent)] text-sm"
                    placeholder="Ej: Thorian Rompecadenas o Corvus el Familiar"
                  />
                </div>
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    Nivel / Rango
                  </label>
                  <input
                    type="text"
                    value={draft.level || ''}
                    onChange={e => setDraft({ ...draft, level: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none"
                    placeholder="Ej: Nivel 3"
                  />
                </div>
              </div>

              {/* Quick Preset Selector for D&D 5e Classes, Races, Backgrounds */}
              {draft.characterType !== 'companion' && (
                <div className="bg-[var(--surface-soft)] p-3.5 rounded-xl border border-[var(--user-border)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 text-xs sm:text-sm">
                      <BookOpen className="w-4 h-4" /> Asistente de Creación Rápida (D&D 5e & 5.5e / 2024)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSoloHeroicMode(!isSoloHeroicMode)}
                      className={`px-2.5 py-1 text-[11px] font-cinzel rounded-md border transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                        isSoloHeroicMode
                          ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-300'
                          : 'bg-[var(--surface)] border-[var(--user-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                      title="Activa reglas para partidas en solitario o D&D 2024: permite escoger 2 trasfondos combinados o 1 trasfondo + 1 dote de origen adicional"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {isSoloHeroicMode ? 'Modo Solitario / 2024 Activo (2 Trasfondos o +1 Dote)' : 'Activar Modo Solitario / 2024'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Class Preset */}
                    <div>
                      <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                        Plantilla de Clase (5e)
                      </label>
                      <select
                        onChange={e => e.target.value && handleSelectClassPreset(e.target.value)}
                        value=""
                        className="w-full p-1.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-md outline-none text-xs font-cinzel cursor-pointer"
                      >
                        <option value="">-- Cargar Clase D&D --</option>
                        {DND_CLASSES_COMPENDIUM.map(c => (
                          <option key={c.name} value={c.name}>
                            {c.name} (d{c.hitDice.replace('1d', '')})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Race Preset */}
                    <div>
                      <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                        Plantilla de Linaje / Raza (5e / Drow / Subrazas)
                      </label>
                      <select
                        onChange={e => e.target.value && handleSelectRacePreset(e.target.value)}
                        value=""
                        className="w-full p-1.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-md outline-none text-xs font-cinzel cursor-pointer"
                      >
                        <option value="">-- Cargar Linaje D&D --</option>
                        {DND_RACES_COMPENDIUM.map(r => (
                          <option key={r.name} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Background Preset */}
                    <div>
                      <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                        {isSoloHeroicMode ? '1er Trasfondo (5e / 2024 / Costa de la Espada)' : 'Plantilla de Trasfondo (5e / 2024)'}
                      </label>
                      <select
                        onChange={e => e.target.value && handleSelectBackgroundPreset(e.target.value, false)}
                        value=""
                        className="w-full p-1.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-md outline-none text-xs font-cinzel cursor-pointer"
                      >
                        <option value="">-- Cargar Trasfondo D&D --</option>
                        {DND_BACKGROUNDS_COMPENDIUM.map(b => (
                          <option key={b.name} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Solo / 2024 Bonus Origin Options */}
                  {isSoloHeroicMode && (
                    <div className="pt-2 border-t border-[var(--user-border)]/60 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between text-xs font-cinzel text-amber-700 dark:text-amber-300 font-semibold gap-2">
                        <span className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" /> Opciones de Solitario / D&D 2024:
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-normal">
                          Elige un 2º trasfondo O una dote de origen gratuita
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* 2nd Background Selector */}
                        <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--user-border)] space-y-1">
                          <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block font-bold">
                            + Añadir 2º Trasfondo (Combinado)
                          </label>
                          <select
                            onChange={e => e.target.value && handleSelectBackgroundPreset(e.target.value, true)}
                            value=""
                            className="w-full p-1 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded text-xs font-cinzel cursor-pointer outline-none"
                          >
                            <option value="">-- Seleccionar 2º Trasfondo adicional --</option>
                            {DND_BACKGROUNDS_COMPENDIUM.map(b => (
                              <option key={b.name} value={b.name}>
                                + {b.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Origin Feats Selector */}
                        <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--user-border)] space-y-1">
                          <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block font-bold">
                            + Añadir Dote de Origen Adicional
                          </label>
                          <select
                            onChange={e => e.target.value && handleAddOriginFeat(e.target.value)}
                            value=""
                            className="w-full p-1 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded text-xs font-cinzel cursor-pointer outline-none"
                          >
                            <option value="">-- Seleccionar Dote de Origen --</option>
                            {DND_FEATS_COMPENDIUM.map(f => (
                              <option key={f.name} value={f.name}>
                                + {f.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Race, Class, Subclass, Background */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    Raza / Linaje
                  </label>
                  <input
                    type="text"
                    value={draft.race || ''}
                    onChange={e => setDraft({ ...draft, race: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-sm"
                    placeholder="Ej: Drow / Semielfo"
                  />
                </div>
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">Clase</label>
                  <input
                    type="text"
                    value={draft.class || ''}
                    onChange={e => setDraft({ ...draft, class: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-sm"
                    placeholder="Ej: Mago / Pícaro"
                  />
                </div>
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    Subclase / Arquetipo
                  </label>
                  <input
                    type="text"
                    value={draft.subclass || ''}
                    onChange={e => setDraft({ ...draft, subclass: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-sm"
                    placeholder="Ej: Asesino / Evocación"
                  />
                </div>
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    Trasfondo(s)
                  </label>
                  <input
                    type="text"
                    value={draft.background || ''}
                    onChange={e => setDraft({ ...draft, background: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-sm"
                    placeholder="Ej: Peregrino + Viajero de Tierras Exóticas"
                  />
                </div>
              </div>

              {/* Vitals: HP, Max HP, AC, Speed, Initiative, Proficiency */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)]">
                <span className="font-cinzel font-bold text-[var(--accent)] block uppercase mb-3">
                  Estadísticas de Combate & Vitals
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div>
                    <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                      PG Actuales
                    </label>
                    <input
                      type="number"
                      value={draft.hp ?? 10}
                      onChange={e => setDraft({ ...draft, hp: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                      PG Máximos
                    </label>
                    <input
                      type="number"
                      value={draft.maxHp ?? 10}
                      onChange={e => setDraft({ ...draft, maxHp: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                      CA (Armadura)
                    </label>
                    <input
                      type="number"
                      value={draft.ac ?? 10}
                      onChange={e => setDraft({ ...draft, ac: parseInt(e.target.value) || 10 })}
                      className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                      Velocidad
                    </label>
                    <input
                      type="text"
                      value={draft.speed || '30 pies'}
                      onChange={e => setDraft({ ...draft, speed: e.target.value })}
                      className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                      Dados de Golpe
                    </label>
                    <input
                      type="text"
                      value={draft.hitDice || '1d8'}
                      onChange={e => setDraft({ ...draft, hitDice: e.target.value })}
                      className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-cinzel text-[10px] text-[var(--text-secondary)] block mb-1 font-bold">
                      Bono Competencia
                    </label>
                    <input
                      type="number"
                      value={draft.proficiencyBonus ?? 2}
                      onChange={e => setDraft({ ...draft, proficiencyBonus: parseInt(e.target.value) || 2 })}
                      className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Portrait Selection Box */}
              <div className="bg-[var(--surface-soft)] p-3 rounded-xl border border-[var(--user-border)] flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border-2 border-[var(--accent)] overflow-hidden bg-black/5 flex items-center justify-center shrink-0 shadow-xs">
                  {draft.portrait ? (
                    <img
                      src={draft.portrait}
                      alt="Retrato"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Crown className="w-6 h-6 text-[var(--accent)] opacity-40" />
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="font-cinzel font-bold text-[var(--text-primary)]">Retrato</span>
                  <div className="flex gap-2 flex-wrap">
                    {onOpenPortraitPicker && (
                      <button
                        type="button"
                        onClick={onOpenPortraitPicker}
                        className="px-2.5 py-1 text-xs font-cinzel bg-[var(--surface)] border border-[var(--glass-border)] rounded-md hover:bg-[var(--sidebar-bg)] transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Image className="w-3 h-3 text-[var(--accent)]" /> De la Galería
                      </button>
                    )}
                    {draft.portrait && (
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, portrait: '' })}
                        className="px-2 py-1 text-[11px] font-cinzel text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 transition-all cursor-pointer"
                      >
                        Quitar Retrato
                      </button>
                    )}
                  </div>
                  {allImageFiles.length > 0 && (
                    <select
                      value={draft.portrait || ''}
                      onChange={e => setDraft({ ...draft, portrait: e.target.value })}
                      className="w-full p-1.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-md outline-none text-xs"
                    >
                      <option value="">-- O selecciona de la lista de imágenes --</option>
                      {allImageFiles.map(img => (
                        <option key={img.id} value={img.content}>
                          {img.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIBRO DE CONJUROS (COMPENDIO D&D INTEGRADO) */}
          {activeModalTab === 'spells' && (
            <div className="flex flex-col gap-4">
              {/* Active Spells on Character */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4" /> Conjuros en la Ficha ({currentSpells.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomSpell(!isAddingCustomSpell)}
                    className="px-2.5 py-1 text-[11px] font-cinzel bg-[var(--surface)] border border-[var(--glass-border)] rounded-lg hover:border-[var(--accent)] transition-all cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" /> Crear Conjuro Personalizado
                  </button>
                </div>

                {isAddingCustomSpell && (
                  <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--accent)]/40 space-y-2.5 animate-in fade-in duration-150">
                    <span className="font-cinzel font-bold text-xs text-[var(--accent)] block">
                      Nuevo Conjuro Personalizado
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="Nombre del conjuro..."
                          value={newCustomSpell.name || ''}
                          onChange={e => setNewCustomSpell({ ...newCustomSpell, name: e.target.value })}
                          className="w-full p-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs outline-none"
                        />
                      </div>
                      <div>
                        <select
                          value={newCustomSpell.level ?? 0}
                          onChange={e => setNewCustomSpell({ ...newCustomSpell, level: parseInt(e.target.value) || 0 })}
                          className="w-full p-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs outline-none"
                        >
                          <option value={0}>Truco (Nivel 0)</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                            <option key={lvl} value={lvl}>
                              Nivel {lvl}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Escuela (Evocación...)"
                          value={newCustomSpell.school || ''}
                          onChange={e => setNewCustomSpell({ ...newCustomSpell, school: e.target.value })}
                          className="w-full p-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs outline-none"
                        />
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Descripción del efecto, daño y reglas..."
                      value={newCustomSpell.description || ''}
                      onChange={e => setNewCustomSpell({ ...newCustomSpell, description: e.target.value })}
                      className="w-full p-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs outline-none resize-none font-lora"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomSpell(false)}
                        className="px-2.5 py-1 text-xs font-cinzel text-[var(--text-secondary)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCustomSpell}
                        className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] font-bold rounded cursor-pointer"
                      >
                        Guardar Conjuro
                      </button>
                    </div>
                  </div>
                )}

                {currentSpells.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentSpells.map(sp => (
                      <div
                        key={sp.name}
                        className="p-2.5 bg-[var(--surface)] border border-[var(--glass-border)] rounded-xl flex items-start justify-between gap-2 shadow-2xs"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-cinzel font-bold text-xs text-[var(--text-primary)] truncate">
                              {sp.name}
                            </span>
                            <span className="text-[10px] font-cinzel font-semibold px-1.5 py-0.2 rounded bg-[var(--accent)]/15 text-[var(--accent)]">
                              {sp.level === 0 ? 'Truco' : `Nvl ${sp.level}`}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1 m-0 font-lora">
                            {sp.school} · {sp.castingTime} · {sp.range}
                          </p>
                          {sp.damageOrEffect && (
                            <span className="text-[10px] font-cinzel text-amber-700 dark:text-amber-300 font-bold block">
                              ⚔️ {sp.damageOrEffect}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpell(sp.name)}
                          title="Eliminar de la ficha"
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic m-0">
                    Aún no hay conjuros añadidos. Selecciona conjuros del compendio abajo con 1 clic.
                  </p>
                )}
              </div>

              {/* Compendium Spell Explorer */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
                  <span className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> Compendio de Conjuros D&D 5e ({filteredCompendiumSpells.length})
                  </span>
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o escuela..."
                      value={spellSearch}
                      onChange={e => setSpellSearch(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1 bg-[var(--surface)] border border-[var(--user-border)] rounded-md text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Level & Class Filters */}
                <div className="flex flex-wrap gap-1.5 items-center text-[11px] font-cinzel">
                  <span className="text-[var(--text-secondary)] font-bold">Nivel:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSpellLevel('all')}
                    className={`px-2 py-0.5 rounded border ${
                      selectedSpellLevel === 'all'
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                        : 'border-[var(--glass-border)]'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSpellLevel(0)}
                    className={`px-2 py-0.5 rounded border ${
                      selectedSpellLevel === 0
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                        : 'border-[var(--glass-border)]'
                    }`}
                  >
                    Trucos
                  </button>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSelectedSpellLevel(lvl)}
                      className={`px-2 py-0.5 rounded border ${
                        selectedSpellLevel === lvl
                          ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                          : 'border-[var(--glass-border)]'
                      }`}
                    >
                      {lvl}º
                    </button>
                  ))}
                </div>

                {/* Class Filters */}
                <div className="flex flex-wrap gap-1.5 items-center text-[11px] font-cinzel">
                  <span className="text-[var(--text-secondary)] font-bold">Clase:</span>
                  {['all', 'Mago', 'Brujo', 'Clérigo', 'Druida', 'Bardo', 'Hechicero', 'Paladín', 'Explorador'].map(
                    cls => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setSelectedSpellClass(cls)}
                        className={`px-2 py-0.5 rounded border ${
                          selectedSpellClass === cls
                            ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                            : 'border-[var(--glass-border)]'
                        }`}
                      >
                        {cls === 'all' ? 'Todas' : cls}
                      </button>
                    )
                  )}
                </div>

                {/* Compendium Spells Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {filteredCompendiumSpells.map(sp => {
                    const isAdded = currentSpells.some(s => s.name.toLowerCase() === sp.name.toLowerCase());
                    return (
                      <div
                        key={sp.name}
                        className={`p-2 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                          isAdded
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-[var(--surface)] border-[var(--glass-border)] hover:border-[var(--accent)]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-cinzel font-bold text-xs text-[var(--text-primary)] truncate">
                              {sp.name}
                            </span>
                            <span className="text-[10px] font-cinzel px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 font-semibold">
                              {sp.level === 0 ? 'Truco' : `Nivel ${sp.level}`}
                            </span>
                          </div>
                          <span className="text-[10px] font-cinzel text-[var(--text-secondary)] block">
                            {sp.school} · {sp.castingTime} · {sp.range}
                          </span>
                          <p className="text-[11px] text-[var(--text-primary)] line-clamp-2 leading-tight m-0 font-lora mt-1">
                            {sp.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[var(--glass-border)]">
                          {sp.damageOrEffect ? (
                            <span className="text-[10px] font-cinzel font-bold text-amber-700 dark:text-amber-300">
                              ⚔️ {sp.damageOrEffect}
                            </span>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={() => handleAddCompendiumSpell(sp)}
                            disabled={isAdded}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-cinzel font-bold transition-all cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-600 text-white cursor-default'
                                : 'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]'
                            }`}
                          >
                            {isAdded ? '✓ En Ficha' : '+ Añadir'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RASGOS, DOTES Y HABILIDADES (COMPENDIO D&D INTEGRADO) */}
          {activeModalTab === 'traits' && (
            <div className="flex flex-col gap-4">
              {/* Current Character Traits */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5">
                    <Star className="w-4 h-4" /> Rasgos y Dotes de la Ficha ({currentTraits.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomTrait(!isAddingCustomTrait)}
                    className="px-2.5 py-1 text-[11px] font-cinzel bg-[var(--surface)] border border-[var(--glass-border)] rounded-lg hover:border-[var(--accent)] transition-all cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" /> Crear Rasgo Personalizado
                  </button>
                </div>

                {isAddingCustomTrait && (
                  <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--accent)]/40 space-y-2.5 animate-in fade-in duration-150">
                    <span className="font-cinzel font-bold text-xs text-[var(--accent)] block">
                      Nuevo Rasgo o Aptitud
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="Nombre del rasgo..."
                          value={newCustomTrait.name || ''}
                          onChange={e => setNewCustomTrait({ ...newCustomTrait, name: e.target.value })}
                          className="w-full p-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs outline-none"
                        />
                      </div>
                      <div>
                        <select
                          value={newCustomTrait.type || 'class'}
                          onChange={e => setNewCustomTrait({ ...newCustomTrait, type: e.target.value as any })}
                          className="w-full p-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs outline-none font-cinzel"
                        >
                          <option value="class">Clase</option>
                          <option value="race">Raza / Linaje</option>
                          <option value="feat">Dote</option>
                          <option value="background">Trasfondo</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Efecto, reglas y beneficios del rasgo..."
                      value={newCustomTrait.description || ''}
                      onChange={e => setNewCustomTrait({ ...newCustomTrait, description: e.target.value })}
                      className="w-full p-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs outline-none resize-none font-lora"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomTrait(false)}
                        className="px-2.5 py-1 text-xs font-cinzel text-[var(--text-secondary)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCustomTrait}
                        className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] font-bold rounded cursor-pointer"
                      >
                        Guardar Rasgo
                      </button>
                    </div>
                  </div>
                )}

                {currentTraits.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentTraits.map(tr => (
                      <div
                        key={tr.name}
                        className="p-2.5 bg-[var(--surface)] border border-[var(--glass-border)] rounded-xl flex items-start justify-between gap-2 shadow-2xs"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-cinzel font-bold text-xs text-[var(--text-primary)] truncate">
                              {tr.name}
                            </span>
                            <span className="text-[9px] font-cinzel uppercase px-1.5 py-0.2 rounded bg-[var(--accent)]/15 text-[var(--accent)]">
                              {tr.type === 'feat' ? 'Dote' : tr.type === 'race' ? 'Raza' : 'Clase'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-tight m-0 font-lora">
                            {tr.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTrait(tr.name)}
                          title="Eliminar de la ficha"
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic m-0">
                    Aún no hay rasgos añadidos. Selecciona dotes del compendio abajo.
                  </p>
                )}
              </div>

              {/* Compendium Feats Explorer */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
                  <span className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> Dotes Oficiales D&D 5e ({filteredCompendiumFeats.length})
                  </span>
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      placeholder="Buscar dote..."
                      value={featSearch}
                      onChange={e => setFeatSearch(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1 bg-[var(--surface)] border border-[var(--user-border)] rounded-md text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {filteredCompendiumFeats.map(feat => {
                    const isAdded = currentTraits.some(t => t.name.toLowerCase() === feat.name.toLowerCase());
                    return (
                      <div
                        key={feat.name}
                        className={`p-2 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                          isAdded
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-[var(--surface)] border-[var(--glass-border)] hover:border-[var(--accent)]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-cinzel font-bold text-xs text-[var(--text-primary)] truncate">
                              {feat.name}
                            </span>
                            {feat.prerequisite && (
                              <span className="text-[9px] font-cinzel px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                Req: {feat.prerequisite}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-primary)] line-clamp-2 leading-tight m-0 font-lora mt-1">
                            {feat.description}
                          </p>
                        </div>
                        <div className="flex justify-end pt-1 border-t border-[var(--glass-border)]">
                          <button
                            type="button"
                            onClick={() => handleAddCompendiumFeat(feat)}
                            disabled={isAdded}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-cinzel font-bold transition-all cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-600 text-white cursor-default'
                                : 'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]'
                            }`}
                          >
                            {isAdded ? '✓ Añadida' : '+ Añadir Dote'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ATRIBUTOS Y MONEDERO */}
          {activeModalTab === 'stats' && (
            <div className="flex flex-col gap-4">
              {/* 6 Core D&D Attributes */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)]">
                <span className="font-cinzel font-bold text-[var(--accent)] block uppercase mb-3">
                  Puntuaciones de Característica D&D (1 - 30)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  {[
                    { key: 'str', label: 'Fuerza (FUE)' },
                    { key: 'dex', label: 'Destreza (DES)' },
                    { key: 'con', label: 'Constitución (CON)' },
                    { key: 'int', label: 'Inteligencia (INT)' },
                    { key: 'wis', label: 'Sabiduría (SAB)' },
                    { key: 'cha', label: 'Carisma (CAR)' }
                  ].map(stat => (
                    <div key={stat.key} className="flex flex-col items-center gap-1">
                      <label className="font-cinzel text-[10px] font-bold text-[var(--text-secondary)] text-center">
                        {stat.label}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={attributes[stat.key as keyof PlayerAttributes] ?? 10}
                        onChange={e =>
                          handleAttrChange(stat.key as keyof PlayerAttributes, parseInt(e.target.value) || 10)
                        }
                        className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-center font-bold text-base"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* D&D Currencies Box */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)]">
                <span className="font-cinzel font-bold text-[var(--accent)] block uppercase mb-3">
                  💰 Monedas en el Monedero
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[
                    { key: 'cp', label: 'Cobre (PC)' },
                    { key: 'sp', label: 'Plata (PP)' },
                    { key: 'ep', label: 'Electro (PE)' },
                    { key: 'gp', label: 'Oro (PO)' },
                    { key: 'pp', label: 'Platino (PT)' }
                  ].map(curr => (
                    <div key={curr.key} className="flex flex-col gap-1">
                      <label className="font-cinzel text-[10px] font-bold text-[var(--text-secondary)] text-center">
                        {curr.label}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={currencies[curr.key as keyof PlayerCurrencies] ?? 0}
                        onChange={e =>
                          handleCurrencyChange(curr.key as keyof PlayerCurrencies, parseInt(e.target.value) || 0)
                        }
                        className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none text-center font-bold"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TRASFONDO Y PERSONALIDAD */}
          {activeModalTab === 'roleplay' && (
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    🎭 Rasgos de Personalidad
                  </label>
                  <textarea
                    rows={2}
                    value={draft.personality || ''}
                    onChange={e => setDraft({ ...draft, personality: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none resize-none font-lora"
                    placeholder="Modales, actitud, cómo habla o reacciona..."
                  />
                </div>
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">🌟 Ideales</label>
                  <textarea
                    rows={2}
                    value={draft.ideals || ''}
                    onChange={e => setDraft({ ...draft, ideals: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none resize-none font-lora"
                    placeholder="Qué principio ético defiende por encima de todo..."
                  />
                </div>
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">🔗 Vínculos</label>
                  <textarea
                    rows={2}
                    value={draft.bonds || ''}
                    onChange={e => setDraft({ ...draft, bonds: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none resize-none font-lora"
                    placeholder="Personas, lugares o posesiones que daría la vida por proteger..."
                  />
                </div>
                <div>
                  <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    ⚡ Defectos y Miedos
                  </label>
                  <textarea
                    rows={2}
                    value={draft.flaws || ''}
                    onChange={e => setDraft({ ...draft, flaws: e.target.value })}
                    className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none resize-none font-lora"
                    placeholder="Vicios, debilidades, impulsos destructivos..."
                  />
                </div>
              </div>

              <div>
                <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  👁️ Apariencia Física y Señales Distintivas
                </label>
                <textarea
                  rows={2}
                  value={draft.appearance || ''}
                  onChange={e => setDraft({ ...draft, appearance: e.target.value })}
                  className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none resize-none font-lora"
                  placeholder="Cicatrices, vestimenta, mirada, complexión..."
                />
              </div>

              <div>
                <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  📜 Historia y Origen (Backstory)
                </label>
                <textarea
                  rows={3}
                  value={draft.backstory || ''}
                  onChange={e => setDraft({ ...draft, backstory: e.target.value })}
                  className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none resize-none font-lora"
                  placeholder="Familia, infancia, momento en que emprendió la aventura..."
                />
              </div>

              <div>
                <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  🗣️ Otras Competencias e Idiomas
                </label>
                <input
                  type="text"
                  value={draft.proficienciesAndLanguages || ''}
                  onChange={e => setDraft({ ...draft, proficienciesAndLanguages: e.target.value })}
                  className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none font-lora"
                  placeholder="Ej: Idiomas (Común, Élfico), Herramientas de Ladrón..."
                />
              </div>
            </div>
          )}

          {/* TAB 6: NOTAS Y FICHA TÉCNICA */}
          {activeModalTab === 'technical' && (
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  📝 Notas Secretas y Lore del Personaje
                </label>
                <textarea
                  rows={3}
                  value={draft.notes || ''}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })}
                  className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none resize-none font-lora"
                  placeholder="Objetos legendarios que busca, alianzas secretas, deudas..."
                />
              </div>

              <div>
                <label className="font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  📋 Ficha Técnica Completa (Bloque de Estadísticas en Texto)
                </label>
                <textarea
                  rows={6}
                  value={draft.sheetText || ''}
                  onChange={e => setDraft({ ...draft, sheetText: e.target.value })}
                  className="w-full p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg outline-none resize-none font-mono text-xs"
                  placeholder="Pega aquí el bloque de texto completo de D&D Beyond o tu PDF..."
                />
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--glass-border)] mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-cinzel border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!draft.name?.trim()}
              className="px-5 py-2 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] rounded-lg font-bold hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              Guardar Ficha D&D
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
