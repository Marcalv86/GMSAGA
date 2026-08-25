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
  analyzeNarrativeStyleFromDocument,
  describeApiError,
  getStoredSafetyLevel,
  setStoredSafetyLevel,
  SafetyThreshold
} from '../utils/geminiHelper';

import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Dices,
  Flame,
  HeartPulse,
  Hourglass,
  Info,
  Lock,
  PenTool,
  RefreshCw,
  Save,
  Scroll,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Swords,
  Upload,
  UserCheck,
  X
} from 'lucide-react';

export const InstructionsView: React.FC<{
  project: Project;
  onUpdate: (fields: Partial<Project>) => Promise<void>;
  onRequestConfirm?: (message: string, onConfirm: () => void) => void;
}> = ({ project, onUpdate, onRequestConfirm }) => {
  const [instructions, setInstructions] = useState(project.instructions || '');
  const [system, setSystem] = useState(project.system || '');
  const [style, setStyle] = useState(project.style || '');
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

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showProtocolsDetail, setShowProtocolsDetail] = useState(false);
  const [showDiseaseAdvanced, setShowDiseaseAdvanced] = useState(false);

  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [analyzingMessage, setAnalyzingMessage] = useState('');
  const [styleSuccessNotice, setStyleSuccessNotice] = useState<string | null>(null);
  const styleFileInputRef = useRef<HTMLInputElement | null>(null);

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
    setSystem(project.system || '');
    setStyle(project.style || '');
    setSafetyLevel(getStoredSafetyLevel());
    setDiseaseSystem(project.diseaseConfig?.system || 'dnd5e_2024');
    setAutoPenalties(
      project.diseaseConfig?.autoPenalties !== undefined ? project.diseaseConfig.autoPenalties : true
    );
    setExhaustionRules(project.diseaseConfig?.exhaustionRules || DND2024_EXHAUSTION_RULES);
    setCustomDiseaseRules(project.diseaseConfig?.customRules || DEFAULT_DISEASE_CUSTOM_RULES);
    setSaveStatus('saved');
  }, [project.id]);

  const handleSafetyChange = (newLevel: SafetyThreshold) => {
    setSafetyLevel(newLevel);
    setStoredSafetyLevel(newLevel);
  };

  const saveChanges = async (
    newInst?: string,
    newSys?: string,
    newSty?: string,
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
      system: newSys !== undefined ? newSys : system,
      style: newSty !== undefined ? newSty : style,
      diseaseConfig: activeDiseaseCfg
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
    newSys?: string,
    newSty?: string,
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
      system: newSys !== undefined ? newSys : system,
      style: newSty !== undefined ? newSty : style,
      diseaseConfig: activeDiseaseCfg
    };
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveChanges(newInst, newSys, newSty, newDiseaseCfg);
    }, 1500);
  };

  const handleApplyDiseasePreset = async (presetType: 'dnd5e_2024' | 'dnd5e' | 'grimdark' | 'narrative') => {
    if (presetType === 'dnd5e_2024') {
      setDiseaseSystem('dnd5e_2024');
      setExhaustionRules(DND2024_EXHAUSTION_RULES);
      setCustomDiseaseRules(DEFAULT_DISEASE_CUSTOM_RULES);
      await saveChanges(undefined, undefined, undefined, {
        system: 'dnd5e_2024',
        exhaustionRules: DND2024_EXHAUSTION_RULES,
        customRules: DEFAULT_DISEASE_CUSTOM_RULES
      });
    } else if (presetType === 'dnd5e') {
      setDiseaseSystem('dnd5e');
      setExhaustionRules(DND5E_CLASSIC_EXHAUSTION_RULES);
      setCustomDiseaseRules(DEFAULT_DISEASE_CUSTOM_RULES);
      await saveChanges(undefined, undefined, undefined, {
        system: 'dnd5e',
        exhaustionRules: DND5E_CLASSIC_EXHAUSTION_RULES,
        customRules: DEFAULT_DISEASE_CUSTOM_RULES
      });
    } else if (presetType === 'grimdark') {
      setDiseaseSystem('custom');
      setExhaustionRules(DND2024_EXHAUSTION_RULES);
      setCustomDiseaseRules(GRIMDARK_SURVIVAL_DISEASE_RULES);
      await saveChanges(undefined, undefined, undefined, {
        system: 'custom',
        exhaustionRules: DND2024_EXHAUSTION_RULES,
        customRules: GRIMDARK_SURVIVAL_DISEASE_RULES
      });
    } else if (presetType === 'narrative') {
      setDiseaseSystem('narrative_only');
      await saveChanges(undefined, undefined, undefined, {
        system: 'narrative_only'
      });
    }
  };

  const handleRestoreMasterInstructions = () => {
    const message = '¿Deseas restaurar las directivas narrativas y de lore por defecto para este Tomo?';
    const executeRestore = async () => {
      setInstructions(DEFAULT_DM_INSTRUCTIONS);
      setSystem(DEFAULT_SYSTEM);
      setStyle(DEFAULT_STYLE);
      setDiseaseSystem('dnd5e_2024');
      setAutoPenalties(true);
      setExhaustionRules(DND2024_EXHAUSTION_RULES);
      setCustomDiseaseRules(DEFAULT_DISEASE_CUSTOM_RULES);
      await saveChanges(DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE, {
        system: 'dnd5e_2024',
        autoPenalties: true,
        exhaustionRules: DND2024_EXHAUSTION_RULES,
        customRules: DEFAULT_DISEASE_CUSTOM_RULES
      });
    };

    if (onRequestConfirm) {
      onRequestConfirm(message, executeRestore);
    } else if (window.confirm(message)) {
      executeRestore();
    }
  };

  const handleStyleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingStyle(true);
    setAnalyzingMessage(`Extrayendo texto y analizando la pluma de "${file.name}"...`);
    setStyleSuccessNotice(null);

    try {
      let fileText = '';
      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.markdown') ||
        file.name.endsWith('.json')
      ) {
        fileText = await file.text();
      } else {
        const reader = new FileReader();
        fileText = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (!fileText || fileText.trim().length < 50) {
        throw new Error('El archivo no contiene suficiente texto legible para analizar el estilo.');
      }

      setAnalyzingMessage(`Gemini está destilando la voz, ritmo y vocabulario de "${file.name}"...`);
      const analyzedDirective = await analyzeNarrativeStyleFromDocument(fileText, file.name);

      if (!analyzedDirective || analyzedDirective.trim().length === 0) {
        throw new Error('No se pudo generar la directiva de estilo del documento.');
      }

      setStyle(analyzedDirective);
      await saveChanges(undefined, undefined, analyzedDirective);
      setStyleSuccessNotice(`Estilo extraído con éxito desde "${file.name}" y guardado en Directivas.`);
    } catch (err: any) {
      console.error('Error analyzing style document:', err);
      alert(`No se pudo aprender el estilo: ${describeApiError(err)}`);
    } finally {
      setIsAnalyzingStyle(false);
      setAnalyzingMessage('');
      if (styleFileInputRef.current) {
        styleFileInputRef.current.value = '';
      }
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

      {/* SECCIÓN PROTEGIDA: PROTOCOLOS DEL MOTOR INYECTADOS */}
      <div className="bg-amber-950/10 border border-amber-800/30 rounded-lg p-4 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-md bg-amber-900/20 text-[var(--accent)] shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-cinzel text-sm md:text-base font-bold text-[var(--accent)] m-0 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Protocolos del Sistema de Juego (Inyectados al Narrador)
                </h4>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-cinzel font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Siempre Activo
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed max-w-3xl">
                Las directivas de juego (tiradas interactivas de dados y afinidad de PNJs) se integran automáticamente en el prompt del GM sin consumir cuota extra. <strong>Las directivas personalizables de abajo definen el lore y estilo que prefieras.</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowProtocolsDetail(!showProtocolsDetail)}
            className="text-xs font-cinzel font-bold text-[var(--accent)] hover:text-[var(--accent-hover)] px-2.5 py-1.5 rounded bg-[var(--sidebar-bg)] border border-[var(--user-border)] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            {showProtocolsDetail ? 'Ocultar detalles' : 'Ver etiquetas'}
            {showProtocolsDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Acordeón con la guía de sintaxis del motor */}
        {showProtocolsDetail && (
          <div className="mt-4 pt-3 border-t border-amber-800/20 grid grid-cols-1 md:grid-cols-2 gap-3 animate-[fadeIn_0.2s_ease]">
            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <UserCheck className="w-3.5 h-3.5" /> Vínculos y Afinidad de PNJs
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [VÍNCULO: Kieron | grado: ...] / [PRESENTES: ...]
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Registra silenciosamente la afinidad de acompañantes sin ensuciar la narrativa.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Dices className="w-3.5 h-3.5" /> Petición de Tiradas de Dados
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [Petición de Tirada: Percepción | CD 15]
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Genera el panel interactivo de tirada de dados para el jugador.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Hourglass className="w-3.5 h-3.5" /> Travesías y Altamar (Anti-Fast Travel)
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [TIEMPO: +1d] · Mar de las Espadas (8-12 días a puerto)
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                El motor calcula millas marítimas reales desde el origen y avanza día a día.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Scroll className="w-3.5 h-3.5" /> Diarios y Pertenencias Íntimas
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                Consulta directa de contenido antes de registrar
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Si un PNJ abre diarios o cartas del PJ, pregunta a la jugadora antes de inventar el texto.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Flame className="w-3.5 h-3.5" /> Proximidad Física y Tensión Sexual
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                Anti-Retirada Cobarde · Sostener la cercanía y provocación
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Los PNJs seductores/bribones aprovechan la proximidad física (espadas al cuello, agarres, susurros) sin apartarse con miedo.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Swords className="w-3.5 h-3.5" /> Feminismo vs Paternalismo de Mesa
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                Anti-Sobreprotección · Robar besos y asumir riesgos
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Cero condescendencia con el PJ. Los PNJs bribones se atreven a robar besos y seducir sabiendo que Aryendell puede repelerlos con magia (<span className="italic">Onda Atronadora</span>) si quiere.
              </p>
            </div>
          </div>
        )}
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
              scheduleDebouncedSave(undefined, undefined, undefined, { system: 'dnd5e_2024' });
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
              scheduleDebouncedSave(undefined, undefined, undefined, { system: 'dnd5e' });
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
              scheduleDebouncedSave(undefined, undefined, undefined, { system: 'custom' });
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
              scheduleDebouncedSave(undefined, undefined, undefined, { system: 'narrative_only' });
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
                scheduleDebouncedSave(undefined, undefined, undefined, { autoPenalties: checked });
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
                  scheduleDebouncedSave(undefined, undefined, undefined, { exhaustionRules: val });
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
                  scheduleDebouncedSave(undefined, undefined, undefined, { customRules: val });
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
                  <Hourglass className="w-3.5 h-3.5" />
                  Guardando cambios...
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-[var(--accent)] font-semibold"> Cambios pendientes...</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => saveChanges()}
              disabled={saveStatus === 'saved'}
              className="bg-[var(--accent)] text-[var(--on-accent)] rounded px-3 py-1.5 text-xs font-cinzel font-semibold hover:bg-[var(--accent-hover)] transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              title="Guardar cambios manualmente"
            >
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
            <button
              onClick={handleRestoreMasterInstructions}
              className="bg-[var(--msg-user)] text-[var(--accent)] border border-[var(--user-border)] rounded px-3 py-1.5 text-xs font-cinzel font-semibold hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              title="Restaurar las directivas y reglas por defecto de la campaña"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restaurar directivas por defecto
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="font-cinzel text-sm font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide flex justify-between items-center">
              <span className="inline-flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                Directivas del Master (Lore & Conducta)
              </span>
            </div>
            <textarea
              value={instructions}
              onChange={e => {
                const val = e.target.value;
                setInstructions(val);
                scheduleDebouncedSave(val, undefined, undefined);
              }}
              onBlur={() => saveChanges()}
              className="w-full h-[320px] md:h-[500px] bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.3)] p-3.5 rounded-lg text-xs md:text-sm font-mono outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-color)] leading-relaxed resize-y"
              placeholder="Escribe las directivas de lore, comportamiento del Narrador, reglas de mesa..."
            />
          </div>
          <div>
            <div className="font-cinzel text-sm font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" /> Motor y Sistema de Juego
            </div>
            <textarea
              value={system}
              onChange={e => {
                const val = e.target.value;
                setSystem(val);
                scheduleDebouncedSave(undefined, val, undefined);
              }}
              onBlur={() => saveChanges()}
              className="w-full h-[320px] md:h-[500px] bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.3)] p-3.5 rounded-lg text-xs md:text-sm font-lora outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-color)] leading-relaxed resize-y"
              placeholder="Sistema de juego: cómo se resuelven las tiradas, el combate y los recursos..."
            />
          </div>
          <div>
            <div className="font-cinzel text-sm font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide flex justify-between items-center gap-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5" /> Pluma y Estilo Narrativo
              </span>

              {/* Botón para subir un documento y extraer el estilo al vuelo */}
              <input
                ref={styleFileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.json,.text,text/*"
                className="hidden"
                onChange={handleStyleFileSelected}
              />
              <button
                type="button"
                onClick={() => styleFileInputRef.current?.click()}
                disabled={isAnalyzingStyle}
                className="inline-flex items-center gap-1 text-[10px] md:text-[11px] font-cinzel font-bold px-2 py-1 bg-amber-100/80 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Sube una muestra de texto o documento literario para que la IA aprenda su ritmo, voz y vocabulario y cree el prompt de estilo automáticamente"
              >
                {isAnalyzingStyle ? (
                  <>
                    <Hourglass className="w-3 h-3 animate-spin text-[var(--accent)]" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                    <Upload className="w-3 h-3 text-[var(--accent)]" />
                    <span>Aprender de archivo</span>
                  </>
                )}
              </button>
            </div>

            {isAnalyzingStyle && (
              <div className="mb-2 p-2 bg-amber-50/80 border border-amber-300 rounded text-xs text-amber-900 font-cinzel flex items-center gap-2 animate-pulse">
                <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="truncate">{analyzingMessage || 'Analizando estilo literario...'}</span>
              </div>
            )}

            <textarea
              value={style}
              onChange={e => {
                const val = e.target.value;
                setStyle(val);
                scheduleDebouncedSave(undefined, undefined, val);
              }}
              onBlur={() => saveChanges()}
              className="w-full h-[320px] md:h-[500px] bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.3)] p-3.5 rounded-lg text-xs md:text-sm font-lora outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-color)] italic leading-relaxed resize-y"
              placeholder="Voz, ritmo y nivel de detalle que quieres en la narración (o pulsa «Aprender de archivo» para destilarlo desde un documento)..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

