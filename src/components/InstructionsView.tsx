import React, { useState, useEffect, useRef } from 'react';
import { Project, DiseaseConfig, DiseaseRuleSystem } from '../types';
import {
  DEFAULT_DM_INSTRUCTIONS,
  DEFAULT_SYSTEM,
  DEFAULT_STYLE,
  DND5E_CLASSIC_EXHAUSTION_RULES,
  DND2024_EXHAUSTION_RULES,
  DEFAULT_DISEASE_CUSTOM_RULES,
  GRIMDARK_SURVIVAL_DISEASE_RULES
} from '../utils/defaultDirectives';
import {
  getStoredSafetyLevel,
  setStoredSafetyLevel,
  SafetyThreshold
} from '../utils/geminiHelper';

import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Dices,
  Flame,
  HeartPulse,
  RefreshCw,
  Save,
  Scroll,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  X
} from 'lucide-react';

export const InstructionsView: React.FC<{
  project: Project;
  onUpdate: (fields: Partial<Project>) => Promise<void>;
  onRequestConfirm?: (message: string, onConfirm: () => void) => void;
}> = ({ project, onUpdate, onRequestConfirm }) => {
  const [instructions, setInstructions] = useState(project.instructions || '');
  const [safetyLevel, setSafetyLevel] = useState<SafetyThreshold>(() => getStoredSafetyLevel());
  const [diseaseSystem, setDiseaseSystem] = useState<DiseaseRuleSystem>(
    project.diseaseConfig?.system || 'dnd5e_2024'
  );
  const [autoPenalties, setAutoPenalties] = useState<boolean>(
    project.diseaseConfig?.autoPenalties !== undefined ? project.diseaseConfig.autoPenalties : true
  );
  const [exhaustionRules, setExhaustionRules] = useState<string>(
    project.diseaseConfig?.exhaustionRules || DND2024_EXHAUSTION_RULES
  );
  const [customDiseaseRules, setCustomDiseaseRules] = useState<string>(
    project.diseaseConfig?.customRules || DEFAULT_DISEASE_CUSTOM_RULES
  );

  const [manualDmRolls, setManualDmRolls] = useState<boolean>(project.manualDmRolls || false);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showDiseaseAdvanced, setShowDiseaseAdvanced] = useState(false);

  const [styleSuccessNotice, setStyleSuccessNotice] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{
    instructions: string;
    system: string;
    style: string;
    diseaseConfig: DiseaseConfig;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        void onUpdate(pending);
      }
    };
  }, [onUpdate]);

  useEffect(() => {
    setInstructions(project.instructions || '');
    setSafetyLevel(getStoredSafetyLevel());
    setDiseaseSystem(project.diseaseConfig?.system || 'dnd5e_2024');
    setAutoPenalties(
      project.diseaseConfig?.autoPenalties !== undefined ? project.diseaseConfig.autoPenalties : true
    );
    setExhaustionRules(project.diseaseConfig?.exhaustionRules || DND2024_EXHAUSTION_RULES);
    setCustomDiseaseRules(project.diseaseConfig?.customRules || DEFAULT_DISEASE_CUSTOM_RULES);
    setManualDmRolls(Boolean(project.manualDmRolls));
    setSaveStatus('saved');
  }, [project.id, project.instructions, project.manualDmRolls]);

  const handleSafetyChange = (newLevel: SafetyThreshold) => {
    setSafetyLevel(newLevel);
    setStoredSafetyLevel(newLevel);
  };

  const handleToggleManualDmRolls = async (nextVal: boolean) => {
    setManualDmRolls(nextVal);
    setSaveStatus('saving');
    try {
      await onUpdate({ manualDmRolls: nextVal });
      setSaveStatus('saved');
    } catch (err) {
      console.error('Error updating manualDmRolls:', err);
      setSaveStatus('unsaved');
    }
  };

  const saveChanges = async (
    newInst?: string,
    newDiseaseCfg?: Partial<DiseaseConfig>
  ) => {
    const activeDiseaseCfg: DiseaseConfig = {
      system: newDiseaseCfg?.system ?? diseaseSystem,
      autoPenalties: newDiseaseCfg?.autoPenalties ?? autoPenalties,
      exhaustionRules: newDiseaseCfg?.exhaustionRules ?? exhaustionRules,
      customRules: newDiseaseCfg?.customRules ?? customDiseaseRules
    };

    const payload: Partial<Project> = {
      instructions: newInst !== undefined ? newInst : instructions,
      diseaseConfig: activeDiseaseCfg,
      manualDmRolls: manualDmRolls
    };

    setSaveStatus('saving');
    try {
      await onUpdate(payload);
      pendingRef.current = null;
      setSaveStatus('saved');
    } catch (e) {
      console.error('Error saving instructions:', e);
      setSaveStatus('unsaved');
    }
  };

  const scheduleDebouncedSave = (
    newInst?: string,
    newDiseaseCfg?: Partial<DiseaseConfig>
  ) => {
    setSaveStatus('unsaved');
    const activeDiseaseCfg: DiseaseConfig = {
      system: newDiseaseCfg?.system ?? diseaseSystem,
      autoPenalties: newDiseaseCfg?.autoPenalties ?? autoPenalties,
      exhaustionRules: newDiseaseCfg?.exhaustionRules ?? exhaustionRules,
      customRules: newDiseaseCfg?.customRules ?? customDiseaseRules
    };

    pendingRef.current = {
      instructions: newInst !== undefined ? newInst : instructions,
      system: DEFAULT_SYSTEM,
      style: DEFAULT_STYLE,
      diseaseConfig: activeDiseaseCfg,
    };
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveChanges(newInst, newDiseaseCfg);
    }, 1500);
  };


  const handleApplyDiseasePreset = async (presetType: 'dnd5e_2024' | 'dnd5e' | 'grimdark' | 'narrative') => {
    if (presetType === 'dnd5e_2024') {
      setDiseaseSystem('dnd5e_2024');
      setExhaustionRules(DND2024_EXHAUSTION_RULES);
      setCustomDiseaseRules(DEFAULT_DISEASE_CUSTOM_RULES);
      await saveChanges(undefined, {
        system: 'dnd5e_2024',
        exhaustionRules: DND2024_EXHAUSTION_RULES,
        customRules: DEFAULT_DISEASE_CUSTOM_RULES
      });
    } else if (presetType === 'dnd5e') {
      setDiseaseSystem('dnd5e');
      setExhaustionRules(DND5E_CLASSIC_EXHAUSTION_RULES);
      setCustomDiseaseRules(DEFAULT_DISEASE_CUSTOM_RULES);
      await saveChanges(undefined, {
        system: 'dnd5e',
        exhaustionRules: DND5E_CLASSIC_EXHAUSTION_RULES,
        customRules: DEFAULT_DISEASE_CUSTOM_RULES
      });
    } else if (presetType === 'grimdark') {
      setDiseaseSystem('custom');
      setExhaustionRules(DND2024_EXHAUSTION_RULES);
      setCustomDiseaseRules(GRIMDARK_SURVIVAL_DISEASE_RULES);
      await saveChanges(undefined, {
        system: 'custom',
        exhaustionRules: DND2024_EXHAUSTION_RULES,
        customRules: GRIMDARK_SURVIVAL_DISEASE_RULES
      });
    } else if (presetType === 'narrative') {
      setDiseaseSystem('narrative_only');
      await saveChanges(undefined, {
        system: 'narrative_only'
      });
    }
  };

  const handleRestoreMasterInstructions = () => {
    const propio = (instructions?.length || 0);
    const hayTrabajoPropio = propio > 400;

    const message = hayTrabajoPropio
      ? `⚠️ ESTO BORRA LO QUE HAS ESCRITO TÚ.\n\n` +
        `Se sustituyen por los textos de fábrica: tus directivas de campaña y reglas de enfermedad. ` +
        `Son ${propio.toLocaleString('es-ES')} caracteres tuyos y NO se pueden recuperar.\n\n` +
        `Si solo querías ver las de fábrica para copiar alguna regla, cancela: esto no sirve para eso.\n\n` +
        `¿Seguro que quieres empezar de cero?`
      : '¿Deseas restaurar las directivas narrativas y de lore por defecto para este Tomo?';
    const executeRestore = async () => {
      setInstructions(DEFAULT_DM_INSTRUCTIONS);
      setDiseaseSystem('dnd5e_2024');
      setAutoPenalties(true);
      setExhaustionRules(DND2024_EXHAUSTION_RULES);
      setCustomDiseaseRules(DEFAULT_DISEASE_CUSTOM_RULES);
      await saveChanges(
        DEFAULT_DM_INSTRUCTIONS,
        {
          system: 'dnd5e_2024',
          autoPenalties: true,
          exhaustionRules: DND2024_EXHAUSTION_RULES,
          customRules: DEFAULT_DISEASE_CUSTOM_RULES
        }
      );
    };

    if (onRequestConfirm) {
      onRequestConfirm(message, executeRestore);
    } else if (window.confirm(message)) {
      executeRestore();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-[5%] py-4 md:py-8 font-lora">
      {/* SECCIÓN: SEGURIDAD DE CONTENIDO Y FILTROS (NSFW / DARK FANTASY) */}
      <div className="bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.25)] rounded-lg p-4 md:p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-rose-900/20 text-rose-700 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base md:text-lg m-0 text-[var(--accent)] flex items-center gap-2">
                Filtros de Contenido y Modo Adulto (NSFW / Dark Fantasy)
              </h3>
              <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                Controla el nivel de censura de la API de Gemini para permitir romance explícito, violencia cruda y temas maduros.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
            <span className={`text-[11px] font-cinzel font-bold px-2 py-0.5 rounded border ${
              safetyLevel === 'BLOCK_NONE' 
                ? 'bg-rose-100 text-rose-900 border-rose-300' 
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}>
              {safetyLevel === 'BLOCK_NONE'
                ? 'Sin Filtros (18+ / NSFW Libre)'
                : safetyLevel === 'BLOCK_ONLY_HIGH'
                ? 'Filtro Permisivo'
                : 'Filtro Estándar'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleSafetyChange('BLOCK_NONE')}
            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
              safetyLevel === 'BLOCK_NONE'
                ? 'bg-rose-900/15 border-rose-600/70 shadow-xs ring-1 ring-rose-500'
                : 'bg-[var(--bg-color)] border-[rgba(139,69,19,0.2)] hover:border-amber-700/50'
            }`}
          >
            <div className="font-cinzel font-bold text-xs text-rose-700 flex items-center justify-between mb-1">
              <span>Sin Filtros (BLOCK_NONE)</span>
              {safetyLevel === 'BLOCK_NONE' && <Check className="w-3.5 h-3.5 text-rose-700" />}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-tight">
              Sin censura de seguridad: permite combate visceral, lenguaje adulto, romance maduro y ambientaciones oscuras.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSafetyChange('BLOCK_ONLY_HIGH')}
            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
              safetyLevel === 'BLOCK_ONLY_HIGH'
                ? 'bg-amber-900/15 border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]'
                : 'bg-[var(--bg-color)] border-[rgba(139,69,19,0.2)] hover:border-amber-700/50'
            }`}
          >
            <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center justify-between mb-1">
              <span>Solo Bloquear Extremo</span>
              {safetyLevel === 'BLOCK_ONLY_HIGH' && <Check className="w-3.5 h-3.5 text-green-700" />}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-tight">
              Filtro suave: permite la mayoría de escenas adultas bloqueando únicamente contenido de riesgo extremo.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSafetyChange('BLOCK_MEDIUM_AND_ABOVE')}
            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
              safetyLevel === 'BLOCK_MEDIUM_AND_ABOVE'
                ? 'bg-amber-900/15 border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]'
                : 'bg-[var(--bg-color)] border-[rgba(139,69,19,0.2)] hover:border-amber-700/50'
            }`}
          >
            <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center justify-between mb-1">
              <span>Moderado / Estándar</span>
              {safetyLevel === 'BLOCK_MEDIUM_AND_ABOVE' && <Check className="w-3.5 h-3.5 text-green-700" />}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-tight">
              Protección habitual de Google AI Studio para historias aptas para todas las edades.
            </p>
          </button>
        </div>
      </div>



      {/* NUEVA SECCIÓN DE CONFIGURACIÓN: GESTIÓN DE ENFERMEDADES, AGOTAMIENTO Y SALUD */}
      <div className="bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.25)] rounded-lg p-4 md:p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-rose-900/20 text-rose-700 shrink-0">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base md:text-lg m-0 text-[var(--accent)] flex items-center gap-2">
                Gestión de Enfermedades, Agotamiento y Salud
              </h3>
              <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                Define el sistema de fatiga/enfermedad y el grado de autonomía del Narrador para penalizar tiradas según el estado físico y mental del personaje.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
            <span className="text-[11px] font-cinzel font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
              {diseaseSystem === 'dnd5e_2024'
                ? 'D&D 2024 (5.5e)'
                : diseaseSystem === 'dnd5e'
                ? 'D&D 5e Clásico'
                : diseaseSystem === 'custom'
                ? 'Personalizado'
                : 'Solo Narrativo'}
            </span>
          </div>
        </div>

        {/* Selector de Sistema */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
          <button
            type="button"
            onClick={() => {
              setDiseaseSystem('dnd5e_2024');
              scheduleDebouncedSave(undefined, { system: 'dnd5e_2024' });
            }}
            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
              diseaseSystem === 'dnd5e_2024'
                ? 'bg-amber-900/15 border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]'
                : 'bg-[var(--bg-color)] border-[rgba(139,69,19,0.2)] hover:border-amber-700/50'
            }`}
          >
            <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center justify-between mb-1">
              <span>D&D 2024 / 5.5e</span>
              {diseaseSystem === 'dnd5e_2024' && <Check className="w-3.5 h-3.5 text-green-700" />}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-tight">
              Agotamiento d20 acumulativo (-1 por nivel, 1-10) y penalización a la velocidad. Más fluido.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setDiseaseSystem('dnd5e');
              scheduleDebouncedSave(undefined, { system: 'dnd5e' });
            }}
            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
              diseaseSystem === 'dnd5e'
                ? 'bg-amber-900/15 border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]'
                : 'bg-[var(--bg-color)] border-[rgba(139,69,19,0.2)] hover:border-amber-700/50'
            }`}
          >
            <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center justify-between mb-1">
              <span>D&D 5e Clásico</span>
              {diseaseSystem === 'dnd5e' && <Check className="w-3.5 h-3.5 text-green-700" />}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-tight">
              Tabla clásica de 6 niveles con desventaja escalonada, mitad de velocidad y reducción de PG máx.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setDiseaseSystem('custom');
              scheduleDebouncedSave(undefined, { system: 'custom' });
            }}
            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
              diseaseSystem === 'custom'
                ? 'bg-amber-900/15 border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]'
                : 'bg-[var(--bg-color)] border-[rgba(139,69,19,0.2)] hover:border-amber-700/50'
            }`}
          >
            <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center justify-between mb-1">
              <span>Personalizado</span>
              {diseaseSystem === 'custom' && <Check className="w-3.5 h-3.5 text-green-700" />}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-tight">
              Reglas a medida para supervivencia extrema, infecciones, estrés mental o mecánicas propias.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setDiseaseSystem('narrative_only');
              scheduleDebouncedSave(undefined, { system: 'narrative_only' });
            }}
            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
              diseaseSystem === 'narrative_only'
                ? 'bg-amber-900/15 border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]'
                : 'bg-[var(--bg-color)] border-[rgba(139,69,19,0.2)] hover:border-amber-700/50'
            }`}
          >
            <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center justify-between mb-1">
              <span>Solo Narrativo</span>
              {diseaseSystem === 'narrative_only' && <Check className="w-3.5 h-3.5 text-green-700" />}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-tight">
              Sin penalizadores matemáticos estrictos; las enfermedades y el cansancio solo se rolean en la historia.
            </p>
          </button>
        </div>

        {/* Conmutador de Penalizadores Automáticos */}
        <div className="bg-[var(--bg-color)] p-3.5 rounded-lg border border-[rgba(139,69,19,0.2)] mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded bg-amber-900/15 text-[var(--accent)] mt-0.5">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="font-cinzel text-xs font-bold text-[var(--text-primary)]">
                Aplicar penalizadores automáticos según el estado de salud
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-0.5 leading-relaxed">
                Permite al Narrador arbitrar y aplicar de forma autónoma desventajas, penalizaciones numéricas a tiradas de d20 o aumentos de CD cuando el protagonista sufra fiebres, venenos, frío, heridas abiertas o fatiga acumulada.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={autoPenalties}
              onChange={e => {
                const checked = e.target.checked;
                setAutoPenalties(checked);
                scheduleDebouncedSave(undefined, { autoPenalties: checked });
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
          </label>
        </div>

        {/* Presets Rápidos y Desplegable de Reglas */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[rgba(139,69,19,0.15)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-cinzel font-bold uppercase text-[var(--text-secondary)] mr-1">
              Plantillas rápidas:
            </span>
            <button
              type="button"
              onClick={() => handleApplyDiseasePreset('dnd5e_2024')}
              className="text-[10px] font-cinzel font-semibold px-2 py-1 bg-amber-100/70 hover:bg-amber-200 text-amber-950 rounded border border-amber-300 transition-colors cursor-pointer"
            >
              Cargar D&D 2024 (Recomendado)
            </button>
            <button
              type="button"
              onClick={() => handleApplyDiseasePreset('dnd5e')}
              className="text-[10px] font-cinzel font-semibold px-2 py-1 bg-amber-100/70 hover:bg-amber-200 text-amber-950 rounded border border-amber-300 transition-colors cursor-pointer"
            >
              Cargar D&D 5e Clásico
            </button>
            <button
              type="button"
              onClick={() => handleApplyDiseasePreset('grimdark')}
              className="text-[10px] font-cinzel font-semibold px-2 py-1 bg-rose-100/70 hover:bg-rose-200 text-rose-950 rounded border border-rose-300 transition-colors cursor-pointer"
            >
              Supervivencia Grimdark
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDiseaseAdvanced(!showDiseaseAdvanced)}
            className="text-xs font-cinzel font-bold text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            {showDiseaseAdvanced ? 'Ocultar editor de reglas de salud' : 'Personalizar texto de reglas'}
            {showDiseaseAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Textareas para Reglas de Agotamiento y Enfermedad */}
        {showDiseaseAdvanced && (
          <div className="mt-4 pt-3 border-t border-[rgba(139,69,19,0.15)] grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.2s_ease]">
            <div>
              <div className="font-cinzel text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-700" /> Reglas de Agotamiento, Fatiga y Estrés
              </div>
              <textarea
                value={exhaustionRules}
                onChange={e => {
                  const val = e.target.value;
                  setExhaustionRules(val);
                  scheduleDebouncedSave(undefined, { exhaustionRules: val });
                }}
                onBlur={() => saveChanges()}
                rows={5}
                className="w-full bg-[var(--bg-color)] border border-[rgba(139,69,19,0.3)] p-2.5 rounded-lg text-xs font-mono outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
                placeholder="Describe cómo progresa el agotamiento y qué penalizaciones se aplican en cada nivel..."
              />
            </div>

            <div>
              <div className="font-cinzel text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-700" /> Reglas de Contagio, Enfermedades y Cura
              </div>
              <textarea
                value={customDiseaseRules}
                onChange={e => {
                  const val = e.target.value;
                  setCustomDiseaseRules(val);
                  scheduleDebouncedSave(undefined, { customRules: val });
                }}
                onBlur={() => saveChanges()}
                rows={5}
                className="w-full bg-[var(--bg-color)] border border-[rgba(139,69,19,0.3)] p-2.5 rounded-lg text-xs font-mono outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
                placeholder="Describe cómo se contraen las enfermedades, salvaciones periódicas y métodos de curación..."
              />
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN: ARBITRAJE DE TIRADAS Y DADOS DE PNJS (MANUAL VS AUTOMÁTICO) */}
      <div className="bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.25)] rounded-lg p-4 md:p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-amber-900/20 text-[var(--accent)] shrink-0">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base md:text-lg m-0 text-[var(--accent)] flex items-center gap-2">
                Arbitraje de Tiradas y Dados de PNJs
              </h3>
              <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                Configura si el Narrador resuelve en secreto las tiradas de los adversarios o si detiene la narración para que las tires tú manualmente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
            <span
              className={`text-[11px] font-cinzel font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                manualDmRolls
                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/50'
                  : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40'
              }`}
            >
              {manualDmRolls ? '🎲 Modo Manual Activo' : '⚡ Modo Automático (Por defecto)'}
            </span>
          </div>
        </div>

        {/* Toggle Box */}
        <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[rgba(139,69,19,0.2)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-cinzel font-bold text-xs sm:text-sm text-[var(--text-primary)] flex items-center gap-2">
              <span>Tiradas de PNJs y DM Manuales (Exigencia de Mesa)</span>
              {manualDmRolls && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold">
                  MANUAL
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-lora m-0 max-w-2xl leading-relaxed">
              {manualDmRolls
                ? 'Activado: La IA jamás resolverá tiradas de PNJs, guardias, trampas o engaños en secreto. Detendrá la narración en seco y te pedirá explícitamente que tires los dados tú mismo con total transparencia.'
                : 'Desactivado (Automático): La IA utiliza su reserva de dados reales en segundo plano para resolver la perspicacia, ataques y pruebas de los PNJs sin interrumpir el ritmo literario de la escena.'}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={manualDmRolls}
              onChange={e => handleToggleManualDmRolls(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6 bg-stone-300 dark:bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
          </label>
        </div>
      </div>

      {/* SECCIÓN EDITABLE: DIRECTIVAS DE CAMPAÑA, LORE, SISTEMA Y ESTILO */}
      <div className="bg-[var(--sidebar-bg)] border-l-4 border-[var(--accent)] p-4 md:p-6 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="font-cinzel text-lg md:text-xl m-0 text-[var(--accent)] flex items-center gap-2">
              <Scroll className="w-5 h-5" /> Directivas de Campaña (Personalizables)
            </h3>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              {saveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  Guardado en el Tomo
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  Guardando cambios...
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-[var(--accent)] font-semibold"> Cambios pendientes...</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => saveChanges()}
              disabled={saveStatus === 'saved'}
              className="bg-[var(--accent)] text-[var(--on-accent)] rounded p-2 sm:px-3 sm:py-1.5 text-xs font-cinzel font-semibold hover:bg-[var(--accent-hover)] transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              title="Guardar cambios manualmente"
              aria-label="Guardar"
            >
              <Save className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Guardar</span>
            </button>
            <button
              onClick={handleRestoreMasterInstructions}
              className="bg-[var(--msg-user)] text-[var(--accent)] border border-[var(--user-border)] rounded p-2 sm:px-3 sm:py-1.5 text-xs font-cinzel font-semibold hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              title="Restaurar las directivas y reglas por defecto de la campaña"
              aria-label="Restaurar directivas por defecto"
            >
              <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Restaurar directivas por defecto</span>
            </button>
          </div>
        </div>

        {styleSuccessNotice && (
          <div className="mb-4 p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-xs flex justify-between items-center animate-[fadeIn_0.2s_ease]">
            <span className="font-cinzel font-bold flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-700" />
              {styleSuccessNotice}
            </span>
            <button
              onClick={() => setStyleSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="w-full">
          <div className="font-cinzel text-sm font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide flex justify-between items-center">
            <span className="inline-flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              Directivas del Master (Lore & Conducta)
            </span>
          </div>
          {instructions.trim().length > 10 && (
            <div className="mb-2 text-[11px] leading-relaxed rounded-lg border border-amber-700/40 bg-amber-500/10 text-amber-950 dark:text-amber-100 px-2.5 py-2">
              ⚠️ <strong>Estas directivas SUSTITUYEN a las de por defecto</strong>, no se suman a ellas. Mientras
              haya texto aquí, las 142 reglas de conducta que trae la aplicación no viajan en el turno.
              <br />
              Los <strong>protocolos del motor</strong> (etiquetas, HUD, dados, calendario) sí van siempre, así
              que la interfaz no se rompe. Lo que se pierde son las pautas de narración: ritmo, tratamiento de
              los PNJs, manejo del tiempo y los viajes. Si quieres alguna, cópiala aquí.
            </div>
          )}
          <textarea
            value={instructions}
            onChange={e => {
              const val = e.target.value;
              setInstructions(val);
              scheduleDebouncedSave(val);
            }}
            onBlur={() => saveChanges()}
            className="w-full h-[400px] md:h-[600px] bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.3)] p-3.5 rounded-lg text-xs md:text-sm font-mono outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-color)] leading-relaxed resize-y"
            placeholder="Escribe las directivas de lore, comportamiento del Narrador, reglas de mesa..."
          />
        </div>
      </div>
    </div>
  );
};

