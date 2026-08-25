import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, NPC, Location, ProjectFile, TimelineEntry } from '../types';
import {
  obtenerInfoRelacion,
  CALENDARIO_FANTASTICO,
  aDiaAbsoluto,
  aDiaAbsolutoDesdeTexto,
  calendarioValido,
  desdeDiaAbsoluto,
  fechaInicial,
  fechaLegible
} from '../utils/campaignCalendar';
import { deduplicarListaNpcs } from '../utils/npcMatcher';
import { sanitizePlayerCharacter } from '../utils/sanitizers';
import { ImagePickerModal, ImagePickerTarget } from './ImagePickerModal';
import { NpcDossierModal } from './NpcDossierModal';
import { LocationDossierModal } from './LocationDossierModal';
import { DailyAgendaDiary } from './DailyAgendaDiary';

import {
  BookOpen,
  Calendar,
  CalendarClock,
  Camera,
  Castle,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  FileText,
  GitMerge,
  Heart,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Scroll,
  Shield,
  Sparkles,
  Trash2,
  User,
  Users
} from 'lucide-react';

export function getAtrInfo(val?: number) {
  const v = val !== undefined && val !== null ? Math.max(0, Math.min(20, Math.round(val))) : 0;
  let label = 'Frialdad / Distancia cortés';
  let corazones = 0;
  if (v >= 18) {
    label = 'Atracción desbordante / Pasión viva';
    corazones = 5;
  } else if (v >= 14) {
    label = 'Fascinación / Tensión romántica viva';
    corazones = 4;
  } else if (v >= 10) {
    label = 'Química mutua / Flirteo evidente';
    corazones = 3;
  } else if (v >= 6) {
    label = 'Chispa leve / Interés incipiente';
    corazones = 2;
  } else if (v >= 2) {
    label = 'Curiosidad / Trato formal con gracia';
    corazones = 1;
  }
  return {
    val: v,
    corazones,
    label,
    gradient: 'from-rose-500 via-pink-500 to-rose-600',
    border: 'border-rose-400/40',
    bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    hasScore: val !== undefined && val !== null
  };
}

export function getVinInfo(val?: number) {
  const v = val !== undefined && val !== null ? Math.max(0, Math.min(20, Math.round(val))) : 0;
  let label = 'Desconocidos / Sin lazo previo';
  let estrellas = 0;
  if (v >= 18) {
    label = 'Lazo indisoluble / Devoción leal';
    estrellas = 5;
  } else if (v >= 14) {
    label = 'Hermandad / Lealtad forjada';
    estrellas = 4;
  } else if (v >= 10) {
    label = 'Aliados firmes / Afecto sincero';
    estrellas = 3;
  } else if (v >= 6) {
    label = 'Camaradería incipiente de viaje';
    estrellas = 2;
  } else if (v >= 2) {
    label = 'Trato cordial';
    estrellas = 1;
  }
  return {
    val: v,
    estrellas,
    label,
    gradient: 'from-teal-500 via-emerald-500 to-cyan-600',
    border: 'border-cyan-400/40',
    bg: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    hasScore: val !== undefined && val !== null
  };
}

export function getConInfo(val?: number) {
  const v = val !== undefined && val !== null ? Math.max(0, Math.min(20, Math.round(val))) : 0;
  let label = 'Alerta / Cartas bien tapadas';
  let escudos = 0;
  if (v >= 18) {
    label = 'Confianza ciega y sincera';
    escudos = 5;
  } else if (v >= 14) {
    label = 'Guardia baja / Secretos vitales';
    escudos = 4;
  } else if (v >= 10) {
    label = 'Confidencia selectiva / Espaldas cubiertas';
    escudos = 3;
  } else if (v >= 6) {
    label = 'Cautela táctica profesional';
    escudos = 2;
  } else if (v >= 2) {
    label = 'Reserva prudente';
    escudos = 1;
  }
  return {
    val: v,
    escudos,
    label,
    gradient: 'from-amber-500 via-yellow-500 to-amber-600',
    border: 'border-amber-400/40',
    bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    hasScore: val !== undefined && val !== null
  };
}

export function tieneAfinidadActiva(npc: NPC): boolean {
  if (npc.recurrente) return true;
  if (npc.diasVistos && npc.diasVistos.length >= 3) return true;
  if (npc.atr !== undefined || npc.vin !== undefined || npc.con !== undefined) return true;
  if (npc.vinculo && npc.vinculo.trim().length > 0) return true;
  return false;
}

export type SeccionMemoria =
  | 'character'
  | 'diary'
  | 'npcs'
  | 'locs'
  | 'quests'
  | 'story'
  | 'status'
  | 'notes';

export const MemoryManager: React.FC<{
  project: Project;
  files: ProjectFile[];
  onUpdateMemory: (updater: (prevMem: Project['memory']) => Project['memory']) => Promise<void>;
  onUpdateProject?: (updater: (prev: Project) => Partial<Project>) => Promise<void>;
  onTriggerAIUpdate?: () => Promise<void>;
  onAutoClassifyAll?: () => Promise<void>;
  onUploadEntityImage?: (file: File, category?: any) => Promise<string>;
  isGenerating?: boolean;
  hasChats?: boolean;
  /** Qué secciones mostrar. Sin esto, se muestran todas. */
  secciones?: SeccionMemoria[];
}> = ({
  project,
  files,
  onUpdateMemory,
  onUpdateProject,
  onTriggerAIUpdate,
  onAutoClassifyAll,
  onUploadEntityImage,
  isGenerating = false,
  hasChats = false,
  secciones
}) => {
  /**
   * Qué secciones se muestran. Sirve para partir esta vista en dos: las fichas
   * —quién es quién— viven en su pestaña, y lo narrativo —crónica, estado y
   * notas— se enseña dentro del Diario, que es donde se lee de corrido.
   */
  const seccionesVisibles: SeccionMemoria[] = secciones?.length
    ? secciones
    : ['character', 'diary', 'npcs', 'locs', 'quests', 'story', 'status', 'notes'];

  const [activeTab, setActiveTab] = useState<SeccionMemoria>(seccionesVisibles[0]);

  // Si cambia el reparto de secciones, la pestaña activa puede quedarse fuera.
  React.useEffect(() => {
    if (!seccionesVisibles.includes(activeTab)) setActiveTab(seccionesVisibles[0]);
  }, [secciones]);

  // Protagonist (OC) State
  const [isSyncingAI, setIsSyncingAI] = useState(false);

  // Portrait Linker Modal state
  const [targetForPortraitPicker, setTargetForPortraitPicker] = useState<ImagePickerTarget | null>(null);

  // Dossier modals
  const [selectedNpcForDossier, setSelectedNpcForDossier] = useState<NPC | null>(null);

  // Auto-migración segura: consolidar acontecimientos del protagonista al Diario y Cronica de Campaña
  useEffect(() => {
    const pcEvs = project.memory?.player_character?.events;
    if (pcEvs && pcEvs.length > 0 && onUpdateProject) {
      const cal = project.calendar || CALENDARIO_FANTASTICO;
      const yr = project.currentDate?.year || 1492;
      const currentTimeline = project.timeline || [];
      const newEntries: TimelineEntry[] = [];

      pcEvs.forEach((ev, idx) => {
        const alreadyExists = currentTimeline.some(
          t => t.id === ev.id ||
               (t.title && ev.title && t.title.trim().toLowerCase() === ev.title.trim().toLowerCase()) ||
               (t.summary && ev.description && t.summary.trim().toLowerCase() === ev.description.trim().toLowerCase())
        );
        if (!alreadyExists) {
          let abs = aDiaAbsolutoDesdeTexto(cal, ev.dateOrTime, yr);
          if (abs === null) abs = aDiaAbsoluto(cal, project.currentDate || fechaInicial(yr));
          const dateStr = ev.dateOrTime || (calendarioValido(cal) ? fechaLegible(cal, desdeDiaAbsoluto(cal, abs)) : `Día ${abs}`);
          newEntries.push({
            id: ev.id || `migrated_${Date.now()}_${idx}`,
            absDay: abs,
            date: dateStr,
            title: ev.title,
            summary: ev.description || ev.title,
            mood: '🌸',
            tipo: 'personal',
            hito: ev.title
          });
        }
      });

      if (newEntries.length > 0) {
        onUpdateProject(prev => ({
          timeline: [...(prev.timeline || []), ...newEntries],
          memory: {
            ...(prev.memory || {}),
            player_character: {
              ...(prev.memory?.player_character || { name: 'Protagonista' }),
              events: []
            }
          }
        }));
      } else {
        onUpdateMemory(mem => ({
          ...mem,
          player_character: {
            ...(mem.player_character || { name: 'Protagonista' }),
            events: []
          }
        }));
      }
    }
  }, [project.memory?.player_character?.events, project.timeline, project.calendar, project.currentDate, onUpdateProject, onUpdateMemory]);

  const [expandedLocIds, setExpandedLocIds] = useState<Set<string>>(new Set());
  const [selectedLocForDossier, setSelectedLocForDossier] = useState<Location | null>(null);

  const [expandedQuestIds, setExpandedQuestIds] = useState<Set<string>>(new Set());

  const toggleExpandLoc = (id: string) => {
    setExpandedLocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandQuest = (id: string) => {
    setExpandedQuestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * Qué secretos ha decidido mirar la jugadora. Se olvida al salir de la vista a
   * propósito: destaparlo debe ser una decisión que se toma cada vez, no un
   * interruptor que se queda encendido y te va destripando la campaña.
   */
  const [vinculosDestapados, setVinculosDestapados] = useState<Set<string>>(new Set());

  // Confirmation state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const memory = project.memory || {
    story: '',
    quests: [],
    npcs: [],
    locations: [],
    current_status: '',
    manual_notes: '',
    visual_memory: []
  };

  const allImageFiles = files.filter(f => f.isImage);

  const [localNotes, setLocalNotes] = useState(memory.manual_notes || '');
  const [showNarratorNotes, setShowNarratorNotes] = useState(false);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNotesRef = useRef<string | null>(null);
  const onUpdateMemoryRef = useRef(onUpdateMemory);
  onUpdateMemoryRef.current = onUpdateMemory;

  // Flush pending notes if this view unmounts inside the debounce window.
  useEffect(() => {
    return () => {
      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current);
        notesTimerRef.current = null;
      }
      const pending = pendingNotesRef.current;
      if (pending !== null) {
        pendingNotesRef.current = null;
        void onUpdateMemoryRef.current(mem => ({ ...mem, manual_notes: pending }));
      }
    };
  }, []);

  // Notes Handlers
  const handleNotesChange = (val: string) => {
    setLocalNotes(val);
    pendingNotesRef.current = val;
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }
    notesTimerRef.current = setTimeout(() => {
      pendingNotesRef.current = null;
      onUpdateMemory(mem => ({ ...mem, manual_notes: val }));
    }, 1200);
  };

  const handleNotesBlur = () => {
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
      notesTimerRef.current = null;
    }
    pendingNotesRef.current = null;
    onUpdateMemory(mem => ({ ...mem, manual_notes: localNotes }));
  };

  // AI Sync Handler
  const handleSyncWithAI = async () => {
    if (!onTriggerAIUpdate || isSyncingAI) return;
    setIsSyncingAI(true);
    try {
      await onTriggerAIUpdate();
    } finally {
      setIsSyncingAI(false);
    }
  };

  // Protagonist (OC) Handlers
  const handleRemoveOcPortrait = async () => {
    await onUpdateMemory(mem => ({
      ...mem,
      player_character: {
        ...(mem.player_character || { name: 'Protagonista' }),
        portrait: undefined
      }
    }));
  };

  // NPC & Location Portrait Assignment Handlers
  const handleAssignPortraitDirectly = async (imageContent: string) => {
    if (!targetForPortraitPicker) return;
    const { type, id } = targetForPortraitPicker;
    if (type === 'player') {
      await onUpdateMemory(mem => ({
        ...mem,
        player_character: {
          ...(mem.player_character || { name: 'Protagonista' }),
          portrait: imageContent
        }
      }));
    } else if (type === 'npc') {
      await onUpdateMemory(mem => {
        const npcs = (mem.npcs || []).map(n => (n.id === id ? { ...n, portrait: imageContent } : n));
        return { ...mem, npcs };
      });
      setSelectedNpcForDossier(prev => (prev && prev.id === id ? { ...prev, portrait: imageContent } : prev));
    } else if (type === 'location') {
      await onUpdateMemory(mem => {
        const locations = (mem.locations || []).map(l =>
          l.id === id ? { ...l, portrait: imageContent } : l
        );
        return { ...mem, locations };
      });
      setSelectedLocForDossier(prev => (prev && prev.id === id ? { ...prev, portrait: imageContent } : prev));
    }
    setTargetForPortraitPicker(null);
  };

  const handleDeduplicateNpcs = async () => {
    if (!memory.npcs || memory.npcs.length <= 1) return;
    const antes = memory.npcs.length;
    const limpios = deduplicarListaNpcs(memory.npcs);
    const fusionados = antes - limpios.length;
    if (fusionados > 0) {
      await onUpdateMemory(mem => ({ ...mem, npcs: limpios }));
      setConfirmModal({
        isOpen: true,
        title: 'Fusión de Duplicados Completada',
        message: `¡Se han fusionado con éxito ${fusionados} registro(s) de personajes duplicados, preservando sus retratos, vínculos, notas y fichas!`,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Sin Duplicados',
        message: 'No se detectaron personajes duplicados en la lista. Todos los registros son únicos.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  // Wipe Entire Memory
  const handleWipeEntireMemory = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Restablecer Toda la Memoria',
      message:
        '¿Deseas vaciar completamente la memoria de la campaña (crónica, estado, misiones, PNJs, lugares y análisis visuales)? Las notas manuales se conservarán.',
      onConfirm: async () => {
        await onUpdateMemory(mem => ({
          ...mem,
          story: '',
          current_status: '',
          quests: [],
          npcs: [],
          locations: [],
          visual_memory: []
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-[5%] py-3 md:py-8 font-lora w-full max-w-full overflow-x-hidden">

      {/* Banner de Memoria Viva Autónoma / Modo Supervisión */}
      <div className="mb-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 p-3 sm:p-3.5 rounded-xl shadow-xs flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="font-cinzel font-bold text-indigo-900 dark:text-indigo-200 m-0">
              Memoria Viva Autónoma en Tiempo Real (Solo Lectura)
            </p>
            <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 m-0 truncate">
              La IA actualiza y preserva secretos, PNJs, lugares, tramas y notas en cada respuesta sin consumir llamadas extra.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-cinzel font-bold bg-indigo-200/80 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 shrink-0">
          ● En Vivo
        </span>
      </div>

      {/* Top Nav & AI Action Button */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 md:mb-6 border-b border-[var(--glass-border)] pb-3 md:pb-4 gap-3 md:gap-4 w-full">
        <div className="flex gap-1 sm:gap-2 md:gap-3 flex-wrap w-full lg:w-auto">
          {[
            {
              id: 'character',
              label: 'Protagonista (OC)',
              shortLabel: 'Protagonista',
              icon: User,
              count: memory.player_character?.name ? `(${memory.player_character.name})` : ''
            },
            {
              id: 'diary',
              label: 'Diario & Agenda',
              shortLabel: 'Diario',
              icon: CalendarClock,
              count: (project.threads || []).filter(t => t.status === 'pending').length
                ? `(${(project.threads || []).filter(t => t.status === 'pending').length})`
                : ''
            },
            { id: 'npcs', label: 'PNJs', shortLabel: 'PNJs', icon: Users, count: memory.npcs?.length ? `(${memory.npcs.length})` : '' },
            {
              id: 'locs',
              label: 'Lugares',
              shortLabel: 'Lugares',
              icon: MapPin,
              count: memory.locations?.length ? `(${memory.locations.length})` : ''
            },
            {
              id: 'quests',
              label: 'Tramas',
              shortLabel: 'Tramas',
              icon: Scroll,
              count: memory.quests?.length ? `(${memory.quests.length})` : ''
            },
            { id: 'story', label: 'Resumen', shortLabel: 'Resumen', icon: BookOpen, count: memory.story ? '' : '' },
            { id: 'status', label: 'Estado', shortLabel: 'Estado', icon: Compass, count: memory.current_status ? '' : '' },
            { id: 'notes', label: 'Notas', shortLabel: 'Notas', icon: FileText, count: memory.manual_notes ? '' : '' }
          ]
            .filter(tab => seccionesVisibles.includes(tab.id as SeccionMemoria))
            .map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  title={tab.label}
                  aria-label={tab.label}
                  className={`font-cinzel text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-sm'
                      : 'text-[var(--text-secondary)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] hover:bg-[var(--glass)] hover:text-[var(--accent)] border border-[var(--glass-border)]'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {tab.count && <span className="text-[10px] opacity-80">{tab.count}</span>}
                </button>
              );
            })}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
          {onTriggerAIUpdate && (
            <button
              onClick={handleSyncWithAI}
              disabled={isGenerating || isSyncingAI}
              title="Analizar todas las sesiones y capítulos para sincronizar la memoria viva, PNJs, tramas y lugares con la IA"
              aria-label="Sincronizar con IA"
              className="text-xs text-[var(--on-accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] px-3 sm:px-4 py-1.5 md:py-2 rounded-lg font-cinzel transition-all cursor-pointer flex items-center gap-1.5 font-bold shadow-sm disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSyncingAI ? 'animate-spin' : ''}`} />
              <span>{isSyncingAI ? 'Sincronizando...' : 'Sincronizar con IA'}</span>
            </button>
          )}

          <button
            onClick={handleWipeEntireMemory}
            disabled={isGenerating}
            title="Borrar todos los datos de memoria del tomo"
            aria-label="Vaciar memoria"
            className="text-xs text-red-700 hover:text-red-900 border border-red-200 bg-red-50/50 hover:bg-red-100 px-2 sm:px-2.5 py-1.5 md:py-2 rounded-md font-cinzel transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Vaciar Memoria</span>
          </button>
        </div>
      </div>

      {/* Tab: Protagonist (OC) */}
      {activeTab === 'character' && (() => {
        const cleanPc = sanitizePlayerCharacter(memory.player_character, 'Aryendell');
        return (
        <div className="flex flex-col gap-6">
          {/* Identity & Portrait Card */}
          <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 sm:p-6 rounded-xl shadow-sm flex flex-col md:flex-row gap-5 items-start">
            {/* Portrait Box */}
            <div className="flex flex-col items-center gap-2 shrink-0 self-center md:self-start">
              <div className="w-36 h-48 sm:w-40 sm:h-52 rounded-xl border-2 border-[var(--accent)]/40 shadow-md overflow-hidden relative group bg-[var(--surface)] flex items-center justify-center">
                {cleanPc.portrait ? (
                  <>
                    <img
                      src={cleanPc.portrait}
                      alt={cleanPc.name || 'Protagonista'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <button
                        onClick={() =>
                          setTargetForPortraitPicker({
                            type: 'player',
                            id: 'oc_portrait',
                            name: cleanPc.name || 'Aryendell',
                            desc: cleanPc.title || 'Personaje Jugador'
                          })
                        }
                        className="px-2.5 py-1 text-xs bg-[var(--accent)] text-[var(--on-accent)] font-cinzel rounded-md hover:scale-105 transition-transform flex items-center gap-1 cursor-pointer font-bold shadow"
                      >
                        <Camera className="w-3.5 h-3.5" /> Cambiar
                      </button>
                      <button
                        onClick={handleRemoveOcPortrait}
                        className="px-2.5 py-1 text-xs bg-red-800 text-white font-cinzel rounded-md hover:bg-red-700 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Quitar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-3 gap-2">
                    <User className="w-12 h-12 text-[var(--text-secondary)] opacity-50" />
                    <span className="text-[11px] text-[var(--text-secondary)] font-cinzel">Sin Retrato</span>
                    <button
                      onClick={() =>
                        setTargetForPortraitPicker({
                          type: 'player',
                          id: 'oc_portrait',
                          name: cleanPc.name || 'Aryendell',
                          desc: cleanPc.title || 'Personaje Jugador'
                        })
                      }
                      className="px-2.5 py-1 text-[11px] font-cinzel bg-[var(--accent)] text-[var(--on-accent)] rounded-md hover:scale-105 transition-all flex items-center gap-1 cursor-pointer font-bold shadow-xs mt-1"
                    >
                      <Plus className="w-3 h-3" /> Asignar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Identity & Header Info */}
            <div className="flex-1 flex flex-col justify-between w-full min-w-0">
              <div>
                <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                  <div>
                    <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-[var(--accent)] m-0 flex items-center gap-2">
                      {cleanPc.name || 'Aryendell'}
                    </h2>
                    {cleanPc.title && (
                      <p className="text-sm font-lora italic text-[var(--text-secondary)] mt-0.5 m-0">
                        {cleanPc.title}
                      </p>
                    )}
                  </div>

                  {onTriggerAIUpdate && (
                    <button
                      onClick={handleSyncWithAI}
                      disabled={isGenerating || isSyncingAI}
                      className="px-3 py-1 text-xs font-cinzel bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 border border-amber-500/50 rounded-md transition-all flex items-center gap-1.5 font-bold shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ${isSyncingAI ? 'animate-spin' : ''}`} />
                      <span>{isSyncingAI ? 'Sincronizando...' : 'Sincronizar con IA'}</span>
                    </button>
                  )}
                </div>

                <div className="mt-3 text-xs text-[var(--text-secondary)] bg-[var(--surface)]/70 p-3 rounded-lg border border-[var(--glass-border)] font-lora leading-relaxed">
                  Aquí se registran de forma automática los acontecimientos, evolución personal y hechos trascendentales que le van sucediendo a tu personaje. La IA actualiza la memoria viva en cada respuesta a partir de la crónica de juego.
                </div>
              </div>
            </div>
          </div>

          {/* Protagonist Narrative Summary */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
              <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
                Resumen de lo que le va sucediendo al Protagonista:
              </span>
            </div>

            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-5 rounded-lg shadow-sm text-base leading-relaxed markdown-body min-h-[100px]">
              {cleanPc.summary ? (
                <ReactMarkdown>{cleanPc.summary}</ReactMarkdown>
              ) : (
                <span className="text-[var(--text-secondary)] italic font-lora">
                  Aún no hay un resumen narrativo para el protagonista. Se generará automáticamente durante la partida a medida que avance la aventura.
                </span>
              )}
            </div>
          </div>

          {/* Acceso y sincronización con el Diario & Agenda de Campaña */}
          <div className="bg-[var(--sidebar-bg)] p-4 sm:p-5 rounded-xl border border-[var(--user-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-cinzel font-bold text-sm sm:text-base text-[var(--accent)] m-0">
                  Diario & Agenda de Campaña
                </h4>
                <p className="text-xs text-[var(--text-secondary)] font-lora m-0 mt-0.5">
                  Los acontecimientos, hitos, combates y la crónica detallada de campaña se registran y consultan en el Diario.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('diary')}
              className="px-4 py-2 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-2 shadow-xs shrink-0"
              title="Abrir la pestaña de Diario & Agenda"
            >
              <Calendar className="w-4 h-4" /> Abrir Diario & Agenda
            </button>
          </div>
        </div>
        );
      })()}

      {/* Tab: Diary & Agenda (Diario, Agenda con Día Vista, Selector de Calendario y Relojes) */}
      {activeTab === 'diary' && (
        <DailyAgendaDiary
          project={project}
          files={files}
          onUpdate={async fields => {
            if (onUpdateProject) {
              await onUpdateProject(typeof fields === 'function' ? fields : () => fields);
            }
          }}
          onUpdateMemory={onUpdateMemory}
          onTriggerAIUpdate={onTriggerAIUpdate}
          isGenerating={isGenerating}
          hasChats={hasChats}
        />
      )}

      {/* Tab: Story (Crónica General) */}
      {activeTab === 'story' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
            <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
              Resumen Acumulado de la Historia (Actualizado de forma continua por la IA):
            </span>
          </div>

          <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-6 rounded-lg shadow-sm text-base md:text-lg leading-relaxed markdown-body min-h-[160px]">
            {memory.story ? (
              <ReactMarkdown>{memory.story}</ReactMarkdown>
            ) : (
              <span className="text-[var(--text-secondary)] italic">
                La crónica acumulada se va nutriendo automáticamente a medida que se desarrollan las escenas de la campaña.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab: Status (Estado Actual) */}
      {activeTab === 'status' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
            <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
              Situación actual de la compañía (dónde están, qué peligros enfrentan, recursos):
            </span>
          </div>

          <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-6 rounded-lg shadow-sm text-base md:text-lg leading-relaxed markdown-body min-h-[140px]">
            {memory.current_status ? (
              <ReactMarkdown>{memory.current_status}</ReactMarkdown>
            ) : (
              <span className="text-[var(--text-secondary)] italic">
                El estado actual de la compañía se actualiza automáticamente con cada respuesta del Narrador.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab: Notes (Notas Privadas del Director / Modo Narrador) */}
      {activeTab === 'notes' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)] gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
                Notas Secretas del Maestro (La IA las consulta con máxima prioridad y se guardan automáticamente):
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNarratorNotes(!showNarratorNotes)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-cinzel rounded border border-[var(--user-border)] hover:border-[var(--accent)] hover:text-[var(--accent)] bg-[var(--surface-soft)] transition-all cursor-pointer"
                title={showNarratorNotes ? 'Ocultar notas para evitar spoilers' : 'Mostrar notas secretas (Modo Narrador)'}
              >
                {showNarratorNotes ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Ocultar notas
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Mostrar notas
                  </>
                )}
              </button>
              {localNotes && showNarratorNotes && (
                <button
                  onClick={() => {
                    setLocalNotes('');
                    onUpdateMemory(mem => ({ ...mem, manual_notes: '' }));
                  }}
                  className="px-2.5 py-1 text-xs font-cinzel text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar Notas
                </button>
              )}
            </div>
          </div>

          {showNarratorNotes ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={localNotes}
                onChange={e => handleNotesChange(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Escribe aquí secretos, reglas de casa, revelaciones futuras, giros argumentales o detalles que el Narrador deba tener en cuenta siempre..."
                className="w-full h-[380px] md:h-[480px] bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.3)] p-4 rounded-lg text-base font-lora outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-color)] leading-relaxed shadow-inner"
              />
            </div>
          ) : (
            <div
              onClick={() => setShowNarratorNotes(true)}
              className="w-full min-h-[260px] md:min-h-[320px] bg-[var(--sidebar-bg)] border-2 border-dashed border-[var(--user-border)] hover:border-[var(--accent)] rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
            >
              <div className="p-3.5 rounded-full bg-[var(--surface-soft)] text-[var(--text-secondary)] group-hover:text-[var(--accent)] group-hover:bg-[var(--accent)]/10 transition-colors mb-3">
                <EyeOff className="w-8 h-8" />
              </div>
              <h4 className="font-cinzel text-base font-bold text-[var(--text-primary)] mb-1">
                Modo Narrador: Notas y Secretos Ocultos
              </h4>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mb-4 leading-relaxed">
                El contenido está oculto de forma predeterminada para evitar spoilers involuntarios durante la partida. La IA conoce estas directrices y las respeta estrictamente.
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNarratorNotes(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-cinzel font-bold text-[var(--on-accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-md shadow-sm transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4" /> Mostrar notas del Narrador
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Quests (Tramas) */}
      {activeTab === 'quests' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
            <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
              Tramas y Misiones Activas ({memory.quests?.length || 0})
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {memory.quests && memory.quests.length > 0 ? (
              memory.quests.map((q, i) => {
                const isExpanded = expandedQuestIds.has(q.id);
                return (
                  <div
                    key={q.id || i}
                    className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 md:p-5 rounded-lg shadow-sm flex flex-col md:flex-row gap-4 justify-between hover:border-[var(--accent)] transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-cinzel font-bold text-[var(--accent)] text-lg">{q.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--glass-border)] text-[var(--text-secondary)] font-cinzel">
                          {q.type}
                        </span>
                        {q.status && (
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded font-cinzel font-bold ${
                              q.status === 'Activa'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : q.status === 'Completada'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {q.status}
                          </span>
                        )}
                      </div>
                      {q.origin && (
                        <div className="text-xs text-[var(--text-secondary)] mb-1">
                          <strong>Origen:</strong> {q.origin}
                        </div>
                      )}
                      <div className="text-sm mb-1.5 break-words">
                        <strong>Objetivo:</strong>{' '}
                        <span className={isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}>
                          {q.objective || 'Sin especificar'}
                        </span>
                      </div>
                      {q.progress && (
                        <div className="text-sm text-[var(--text-secondary)] italic break-words">
                          <strong>Progreso:</strong>{' '}
                          <span className={isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}>
                            {q.progress}
                          </span>
                        </div>
                      )}

                      {(q.objective || q.progress) && (
                        <button
                          type="button"
                          onClick={() => toggleExpandQuest(q.id)}
                          className="text-[11px] font-cinzel font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 mt-2 cursor-pointer py-0.5"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Plegar detalles
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> Desplegar detalles completos
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-[var(--text-secondary)] italic py-8 px-6 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] max-w-2xl mx-auto shadow-2xs leading-relaxed text-xs md:text-sm">
                No hay tramas registradas. Las misiones y objetivos se registran y actualizan automáticamente conforme avanza la historia.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: NPCs (Personajes) */}
      {activeTab === 'npcs' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)] flex-wrap gap-2">
            <div>
              <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold block">
                Personajes No Jugadores Registrados ({memory.npcs?.length || 0})
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] opacity-80">
                Los retratos vinculados proporcionan descripciones visuales automáticas al Narrador.
              </span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {memory.npcs && memory.npcs.length > 1 && (
                <button
                  onClick={handleDeduplicateNpcs}
                  className="px-2.5 py-1 text-xs font-cinzel bg-indigo-50 text-indigo-900 border border-indigo-200 rounded hover:bg-indigo-100 transition-all cursor-pointer font-semibold flex items-center gap-1 shadow-xs"
                  title="Detectar y fusionar personajes duplicados conservando sus datos completos"
                >
                  <GitMerge className="w-3.5 h-3.5 text-indigo-700" /> Fusionar Duplicados
                </button>
              )}
              {onAutoClassifyAll && (
                <button
                  onClick={onAutoClassifyAll}
                  disabled={isGenerating}
                  className="px-2.5 py-1 text-xs font-cinzel bg-amber-100 text-amber-900 border border-amber-300 rounded hover:bg-amber-200 transition-all cursor-pointer font-bold disabled:opacity-50 flex items-center gap-1"
                  title="Sincronizar y vincular retratos de archivos con la lista de PNJs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Vincular Retratos
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {memory.npcs && memory.npcs.length > 0 ? (
              memory.npcs.map((n, i) => {
                // Find matching image if not explicitly set
                const matchingFile = n.portrait
                  ? allImageFiles.find(f => f.content === n.portrait)
                  : allImageFiles.find(
                      f => n.name.length > 2 && f.name.toLowerCase().includes(n.name.toLowerCase())
                    );
                const portraitSrc = n.portrait || matchingFile?.content;

                return (
                  <div
                    key={n.id || i}
                    className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-3 rounded-lg shadow-sm flex flex-col justify-between hover:border-[var(--accent)] transition-all gap-2.5 w-full min-w-0 overflow-hidden"
                  >
                    <div className="flex gap-2.5 items-start min-w-0">
                      {/* Portrait Avatar */}
                      <div className="shrink-0 flex flex-col items-center">
                        <div
                          className="w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 border-[var(--accent)] overflow-hidden bg-black/5 flex items-center justify-center cursor-pointer group relative shadow-xs shrink-0"
                          onClick={() => setSelectedNpcForDossier(n)}
                          title="Clic para abrir el dossier y ficha completa"
                        >
                          {portraitSrc ? (
                            <img
                              src={portraitSrc}
                              alt={n.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-5 h-5 text-[var(--text-secondary)] opacity-60" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[8px] font-cinzel font-bold text-center p-0.5">
                            Ficha
                          </div>
                        </div>
                      </div>

                      {/* NPC Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-1 mb-0.5">
                          <h4
                            onClick={() => setSelectedNpcForDossier(n)}
                            className="font-cinzel font-bold text-[var(--accent)] text-sm sm:text-base m-0 break-words leading-tight hover:underline cursor-pointer flex items-center gap-1"
                            title="Clic para abrir la ficha completa"
                          >
                            <span>{n.name}</span>
                          </h4>
                          <div className="flex items-center gap-1 flex-wrap shrink-0">
                            {(() => {
                              const relInfo = obtenerInfoRelacion(n.vinculo || n.relation);
                              return (
                                <span
                                  className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-cinzel font-bold border flex items-center gap-0.5 shadow-2xs whitespace-nowrap ${relInfo.badgeClass}`}
                                  title={`Relación: ${n.relation || relInfo.label}`}
                                >
                                  <span>{relInfo.icono}</span>
                                  <span>{n.relation || relInfo.label}</span>
                                </span>
                              );
                            })()}
                            {n.status && (
                              <span className="text-[9px] bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.2 rounded font-cinzel font-semibold shrink-0">
                                {n.status}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Known Alias / Mask Tag */}
                        {n.alias && (
                          <div className="text-[10px] text-amber-800 dark:text-amber-300 font-cinzel font-semibold mb-1 flex items-center gap-1 truncate">
                            <span>🎭 Alias:</span> <span className="italic">{n.alias}</span>
                          </div>
                        )}

                        {/* Brief Snippet (1-2 lines) */}
                        {n.appearance ? (
                          <p className="text-xs text-[var(--text-secondary)] italic line-clamp-2 leading-relaxed m-0 break-words">
                            {n.appearance}
                          </p>
                        ) : n.description ? (
                          <p className="text-xs text-[var(--text-secondary)] italic line-clamp-2 leading-relaxed m-0 break-words">
                            {n.description}
                          </p>
                        ) : n.notes ? (
                          <p className="text-xs text-[var(--text-primary)] line-clamp-2 leading-relaxed m-0 break-words">
                            {n.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Compact Affinity Indicators Row */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-[var(--user-border)] text-xs">
                      {tieneAfinidadActiva(n) ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-mono font-bold"
                            title={`Atracción: ${getAtrInfo(n.atr).label}`}
                          >
                            <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" /> ATR {n.atr ?? 0}/20
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 text-[10px] font-mono font-bold"
                            title={`Vínculo: ${getVinInfo(n.vin).label}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-teal-500" /> VÍN {n.vin ?? 0}/20
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-mono font-bold"
                            title={`Confianza: ${getConInfo(n.con).label}`}
                          >
                            <Shield className="w-2.5 h-2.5 text-amber-500" /> CON {n.con ?? 0}/20
                          </span>
                          {n.oculta && !vinculosDestapados.has(n.id) && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-cinzel flex items-center gap-0.5" title="Tiene secretos ocultos que descubrir">
                              <Lock className="w-2.5 h-2.5" /> Secreto
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-[var(--text-secondary)] font-cinzel flex items-center gap-1">
                          <span>Figurante ({n.diasVistos?.length || 0}/3 encuentros)</span>
                        </div>
                      )}

                      {n.vinculo && (
                        <span className="text-[10px] font-cinzel text-[var(--accent)] font-semibold truncate max-w-[150px]">
                          {n.vinculo}
                        </span>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex flex-wrap justify-between items-center pt-1.5 border-t border-[var(--glass-border)] gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedNpcForDossier(n)}
                          className="px-2.5 py-1 text-xs font-cinzel font-bold text-[var(--on-accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                          title="Abrir dossier y ficha completa con apariencia, trasfondo y vínculos"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Abrir Ficha
                        </button>
                        <button
                          onClick={() =>
                            setTargetForPortraitPicker({
                              type: 'npc',
                              id: n.id,
                              name: n.name,
                              desc: [
                                n.characterSheet?.race,
                                n.characterSheet?.class,
                                n.characterSheet?.gender,
                                n.appearance,
                                n.characterSheet?.appearance,
                                n.description,
                                n.notes,
                                n.relation
                              ].filter(Boolean).join(' ')
                            })
                          }
                          className="text-[10px] sm:text-[11px] text-[var(--accent)] hover:underline font-cinzel cursor-pointer flex items-center gap-0.5 shrink-0"
                        >
                          <Camera className="w-3 h-3" /> {portraitSrc ? 'Retrato' : '+ Retrato'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-[var(--text-secondary)] italic py-8 px-6 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] max-w-2xl mx-auto shadow-2xs leading-relaxed text-xs md:text-sm">
                No hay PNJs registrados en la memoria. Los personajes con los que interactúes se añadirán automáticamente aquí.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Locations (Lugares) */}
      {activeTab === 'locs' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)] flex-wrap gap-2">
            <div>
              <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold block">
                Lugares Clave de la Campaña ({memory.locations?.length || 0})
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] opacity-80">
                Fortalezas, ciudades, tabernas y mazmorras con sus mapas asociados.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memory.locations && memory.locations.length > 0 ? (
              memory.locations.map((l, i) => {
                const matchingMap = l.portrait
                  ? allImageFiles.find(f => f.content === l.portrait)
                  : allImageFiles.find(
                      f => l.name.length > 2 && f.name.toLowerCase().includes(l.name.toLowerCase())
                    );
                const mapSrc = l.portrait || matchingMap?.content;
                const isExpanded = expandedLocIds.has(l.id);

                return (
                  <div
                    key={l.id || i}
                    className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 rounded-lg shadow-sm flex flex-col justify-between hover:border-[var(--accent)] transition-all gap-3"
                  >
                    <div className="flex gap-3">
                      {/* Location Image / Map Preview */}
                      <div className="shrink-0">
                        <div
                          className="w-16 h-16 md:w-20 md:h-20 rounded-lg border border-[var(--glass-border)] overflow-hidden bg-black/5 flex items-center justify-center cursor-pointer group relative shadow-inner"
                          onClick={() => setSelectedLocForDossier(l)}
                          title="Clic para ver la ficha completa de este lugar"
                        >
                          {mapSrc ? (
                            <img
                              src={mapSrc}
                              alt={l.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Castle className="w-5 h-5 text-[var(--accent)]" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-cinzel font-bold text-center p-1">
                            Ver Ficha
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4
                          onClick={() => setSelectedLocForDossier(l)}
                          className="font-cinzel font-bold text-[var(--accent)] text-base md:text-lg mb-1 m-0 break-words hover:underline cursor-pointer flex items-center gap-1.5"
                          title="Clic para ver ficha completa"
                        >
                          <span>{l.name}</span>
                        </h4>
                        <p className={`text-xs md:text-sm text-[var(--text-primary)] leading-relaxed break-words ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                          {l.desc}
                        </p>
                        {l.notes && (
                          <p className={`text-xs text-[var(--text-secondary)] italic mt-1 break-words ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                            {l.notes}
                          </p>
                        )}

                        {(l.desc || l.notes) && (
                          <button
                            type="button"
                            onClick={() => toggleExpandLoc(l.id)}
                            className="text-[11px] font-cinzel font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 mt-1 cursor-pointer py-0.5"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3" /> Plegar texto
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" /> Desplegar texto completo
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-center pt-2 border-t border-[var(--glass-border)] gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setSelectedLocForDossier(l)}
                          className="px-2.5 py-1 text-xs font-cinzel font-bold text-[var(--on-accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                          title="Abrir ficha detallada del lugar"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Abrir Ficha
                        </button>
                        <button
                          onClick={() =>
                            setTargetForPortraitPicker({ type: 'location', id: l.id, name: l.name, desc: l.desc })
                          }
                          className="text-[11px] text-[var(--accent)] hover:underline font-cinzel cursor-pointer flex items-center gap-1"
                        >
                          {mapSrc ? 'Cambiar Mapa' : '+ Asignar Mapa'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-[var(--text-secondary)] italic py-8 px-6 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] max-w-2xl mx-auto shadow-2xs leading-relaxed text-xs md:text-sm">
                No hay lugares registrados en la memoria. Las ciudades, asentamientos y ruinas se irán registrando conforme los descubras.
              </div>
            )}
          </div>
        </div>
      )}

      {/* NPC Full Dossier Modal ("Página que se abre") */}
      {selectedNpcForDossier && (
        <NpcDossierModal
          npc={selectedNpcForDossier}
          allImageFiles={allImageFiles}
          vinculosDestapados={vinculosDestapados}
          onToggleDestaparVinculo={npcId =>
            setVinculosDestapados(prev => new Set(prev).add(npcId))
          }
          onChangePortrait={n => {
            setTargetForPortraitPicker({
              type: 'npc',
              id: n.id,
              name: n.name,
              desc: [
                n.characterSheet?.race,
                n.characterSheet?.class,
                n.characterSheet?.gender,
                n.characterSheet?.appearance,
                n.description,
                n.notes,
                n.relation
              ].filter(Boolean).join(' ')
            });
          }}
          onClose={() => setSelectedNpcForDossier(null)}
        />
      )}

      {/* Location Full Dossier Modal ("Página que se abre") */}
      {selectedLocForDossier && (
        <LocationDossierModal
          location={selectedLocForDossier}
          allImageFiles={allImageFiles}
          onChangeMap={loc => {
            setTargetForPortraitPicker({
              type: 'location',
              id: loc.id,
              name: loc.name,
              desc: loc.desc
            });
          }}
          onClose={() => setSelectedLocForDossier(null)}
        />
      )}

      {/* Quick Portrait & Location/Map Linker Modal */}
      {targetForPortraitPicker && (
        <ImagePickerModal
          target={targetForPortraitPicker}
          allImageFiles={allImageFiles}
          onSelectImage={handleAssignPortraitDirectly}
          onUploadFile={onUploadEntityImage}
          onClose={() => setTargetForPortraitPicker(null)}
        />
      )}

      {/* Generic Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-color)] p-6 rounded-lg shadow-2xl border border-[var(--glass-border)] w-[400px] max-w-full font-lora">
            <h4 className="font-cinzel text-lg text-[var(--accent)] font-bold mb-2">{confirmModal.title}</h4>
            <p className="text-sm text-[var(--text-primary)] mb-5 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-3.5 py-1.5 text-xs font-cinzel bg-red-700 hover:bg-red-800 text-white rounded font-bold cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

