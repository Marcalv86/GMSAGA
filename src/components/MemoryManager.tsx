import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, NPC, Quest, Location, ProjectFile, PlayerCharacter } from '../types';
import { classifyFileAuto } from '../utils/geminiHelper';
import { obtenerInfoRelacion } from '../utils/campaignCalendar';
import { CharacterSheetView } from './CharacterSheetView';
import { CharacterEditModal } from './CharacterEditModal';
import { ImagePickerModal, ImagePickerTarget } from './ImagePickerModal';
import { NpcDossierModal } from './NpcDossierModal';
import { LocationDossierModal } from './LocationDossierModal';

import {
  BookOpen,
  Camera,
  Castle,
  ChevronDown,
  ChevronUp,
  Crown,
  Eye,
  EyeOff,
  Heart,
  Image,
  Lock,
  Map,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Trash2,
  User
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
  'character' | 'npcs' | 'locs' | 'visual' | 'quests' | 'story' | 'status' | 'notes';

export const MemoryManager: React.FC<{
  project: Project;
  files: ProjectFile[];
  onUpdateMemory: (updater: (prevMem: Project['memory']) => Project['memory']) => Promise<void>;
  onTriggerAIUpdate: () => Promise<void>;
  onAnalyzeImageFile?: (file: ProjectFile) => Promise<void>;
  onUpdateFileAnalysis?: (fileId: string, analysis: string) => Promise<void>;
  onDeleteFileAnalysis?: (fileId: string) => Promise<void>;
  onOpenMap?: (file: ProjectFile) => void;
  onAutoClassifyAll?: () => Promise<void>;
  onUploadEntityImage?: (file: File, category?: any) => Promise<string>;
  isGenerating: boolean;
  hasChats: boolean;
  /** Qué secciones mostrar. Sin esto, se muestran todas. */
  secciones?: SeccionMemoria[];
}> = ({
  project,
  files,
  onUpdateMemory,
  onTriggerAIUpdate,
  onAnalyzeImageFile,
  onUpdateFileAnalysis,
  onDeleteFileAnalysis,
  onOpenMap,
  onAutoClassifyAll,
  onUploadEntityImage,
  isGenerating,
  hasChats,
  secciones
}) => {
  /**
   * Qué secciones se muestran. Sirve para partir esta vista en dos: las fichas
   * —quién es quién— viven en su pestaña, y lo narrativo —crónica, estado y
   * notas— se enseña dentro del Diario, que es donde se lee de corrido.
   */
  const seccionesVisibles: SeccionMemoria[] = secciones?.length
    ? secciones
    : ['character', 'npcs', 'locs', 'visual', 'quests', 'story', 'status', 'notes'];

  const [activeTab, setActiveTab] = useState<SeccionMemoria>(seccionesVisibles[0]);

  // Si cambia el reparto de secciones, la pestaña activa puede quedarse fuera.
  React.useEffect(() => {
    if (!seccionesVisibles.includes(activeTab)) setActiveTab(seccionesVisibles[0]);
  }, [secciones]);

  // Protagonist (OC) Form Modal state
  const [isPcModalOpen, setIsPcModalOpen] = useState(false);
  const [editingPc, setEditingPc] = useState<PlayerCharacter | null>(null);

  // File input refs for direct entity image uploads
  const pcDirectFileInputRef = useRef<HTMLInputElement>(null);

  // Story & Status Editing States
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');

  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');

  // Visual Analysis Editing Modal State
  const [editingVisualFile, setEditingVisualFile] = useState<ProjectFile | null>(null);
  const [visualDraft, setVisualDraft] = useState('');
  const [isVisualModalOpen, setIsVisualModalOpen] = useState(false);

  // Portrait Linker Modal state
  const [targetForPortraitPicker, setTargetForPortraitPicker] = useState<ImagePickerTarget | null>(null);

  // Dossier modals
  const [selectedNpcForDossier, setSelectedNpcForDossier] = useState<NPC | null>(null);

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

  // Quest Form Modal state
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [isQuestModalOpen, setIsQuestModalOpen] = useState(false);

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

  const isNpcOrPjPortrait = (f: ProjectFile) => {
    const cat = f.category && f.category !== 'other' ? f.category : classifyFileAuto(f, project.memory);
    return cat === 'portrait_npc' || cat === 'portrait_pj';
  };

  const allImageFiles = files.filter(f => f.isImage);
  const visualFiles = files.filter(f => f.isImage && !isNpcOrPjPortrait(f));
  const analyzedCount = visualFiles.filter(f => Boolean(f.analysis?.trim())).length;

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

  useEffect(() => {
    setStoryDraft(project.memory?.story || '');
    setStatusDraft(project.memory?.current_status || '');
    setLocalNotes(project.memory?.manual_notes || '');
  }, [project.id, project.memory]);

  // Protagonist (OC) Handlers
  const handleSavePc = async (pc: PlayerCharacter) => {
    await onUpdateMemory(mem => ({
      ...mem,
      player_character: pc
    }));
    setIsPcModalOpen(false);
    setEditingPc(null);
  };

  const handleClearPc = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Vaciar Ficha de Protagonista',
      message: '¿Estás seguro de que deseas vaciar los datos del protagonista de la memoria?',
      onConfirm: async () => {
        await onUpdateMemory(mem => ({
          ...mem,
          player_character: undefined
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSavePcPortrait = async (portraitDataUrl: string) => {
    await onUpdateMemory(mem => ({
      ...mem,
      player_character: {
        ...(mem.player_character || { name: 'Protagonista' }),
        portrait: portraitDataUrl
      }
    }));
    if (editingPc) {
      setEditingPc({ ...editingPc, portrait: portraitDataUrl });
    }
  };

  const handleDirectUploadForPcSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let url = '';
    if (onUploadEntityImage) {
      url = await onUploadEntityImage(file, 'portrait_pj');
    }
    if (url) {
      await handleSavePcPortrait(url);
    }
    e.target.value = '';
  };

  // Story Handlers
  const handleSaveStory = async () => {
    await onUpdateMemory(mem => ({ ...mem, story: storyDraft.trim() }));
    setIsEditingStory(false);
  };

  const handleClearStory = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Borrar Resumen de Crónica',
      message: '¿Estás seguro de que deseas vaciar el texto de la crónica acumulada?',
      onConfirm: async () => {
        setStoryDraft('');
        await onUpdateMemory(mem => ({ ...mem, story: '' }));
        setIsEditingStory(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Status Handlers
  const handleSaveStatus = async () => {
    await onUpdateMemory(mem => ({ ...mem, current_status: statusDraft.trim() }));
    setIsEditingStatus(false);
  };

  const handleClearStatus = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Borrar Estado Actual',
      message: '¿Deseas vaciar el estado actual de la compañía?',
      onConfirm: async () => {
        setStatusDraft('');
        await onUpdateMemory(mem => ({ ...mem, current_status: '' }));
        setIsEditingStatus(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

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

  // Visual Analysis Handlers
  const handleOpenEditVisual = (file: ProjectFile) => {
    setEditingVisualFile(file);
    setVisualDraft(file.analysis || '');
    setIsVisualModalOpen(true);
  };

  const handleSaveVisualAnalysis = async () => {
    if (!editingVisualFile) return;
    if (onUpdateFileAnalysis) {
      await onUpdateFileAnalysis(editingVisualFile.id, visualDraft.trim());
    }
    setIsVisualModalOpen(false);
    setEditingVisualFile(null);
  };

  const handleDeleteVisualAnalysis = (file: ProjectFile) => {
    setConfirmModal({
      isOpen: true,
      title: 'Borrar Análisis Visual',
      message: `¿Eliminar el análisis descriptivo de "${file.name}"? La imagen se conservará.`,
      onConfirm: async () => {
        if (onDeleteFileAnalysis) {
          await onDeleteFileAnalysis(file.id);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // NPC Handlers
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
      if (editingPc) {
        setEditingPc({ ...editingPc, portrait: imageContent });
      }
    } else if (type === 'npc') {
      await onUpdateMemory(mem => {
        const npcs = (mem.npcs || []).map(n => (n.id === id ? { ...n, portrait: imageContent } : n));
        return { ...mem, npcs };
      });
    } else if (type === 'location') {
      await onUpdateMemory(mem => {
        const locations = (mem.locations || []).map(l =>
          l.id === id ? { ...l, portrait: imageContent } : l
        );
        return { ...mem, locations };
      });
    }
    setTargetForPortraitPicker(null);
  };

  const handleDeleteNpc = async (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Personaje',
      message: `¿Eliminar al PNJ "${name}"de la memoria permanente?`,
      onConfirm: async () => {
        await onUpdateMemory(mem => ({
          ...mem,
          npcs: (mem.npcs || []).filter(n => n.id !== id)
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleClearAllNpcs = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Borrar Todos los PNJs',
      message: '¿Estás seguro de que deseas eliminar todos los personajes no jugadores de la memoria?',
      onConfirm: async () => {
        await onUpdateMemory(mem => ({ ...mem, npcs: [] }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Quest Handlers
  const handleSaveQuest = async (quest: Quest) => {
    if (!quest.title.trim()) return;
    await onUpdateMemory(mem => {
      const existing = mem.quests || [];
      const index = existing.findIndex(q => q.id === quest.id);
      if (index >= 0) {
        const updated = [...existing];
        updated[index] = quest;
        return { ...mem, quests: updated };
      } else {
        return { ...mem, quests: [...existing, quest] };
      }
    });
    setIsQuestModalOpen(false);
    setEditingQuest(null);
  };

  const handleDeleteQuest = async (id: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Trama',
      message: `¿Eliminar la misión "${title}"de la memoria?`,
      onConfirm: async () => {
        await onUpdateMemory(mem => ({
          ...mem,
          quests: (mem.quests || []).filter(q => q.id !== id)
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleClearAllQuests = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Borrar Todas las Tramas',
      message: '¿Estás seguro de que deseas eliminar todas las misiones registradas?',
      onConfirm: async () => {
        await onUpdateMemory(mem => ({ ...mem, quests: [] }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Location Handlers
  const handleDeleteLoc = async (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Lugar',
      message: `¿Eliminar el lugar "${name}"de la memoria?`,
      onConfirm: async () => {
        await onUpdateMemory(mem => ({
          ...mem,
          locations: (mem.locations || []).filter(l => l.id !== id)
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleClearAllLocs = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Borrar Todos los Lugares',
      message: '¿Estás seguro de que deseas eliminar todos los lugares registrados?',
      onConfirm: async () => {
        await onUpdateMemory(mem => ({ ...mem, locations: [] }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
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
        setStoryDraft('');
        setStatusDraft('');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-[5%] py-3 md:py-8 font-lora w-full max-w-full overflow-x-hidden">
      {/* Hidden file input for direct protagonist portrait upload */}
      <input
        type="file"
        ref={pcDirectFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleDirectUploadForPcSheet}
      />

      {/* Top Nav & AI Action Button */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 md:mb-6 border-b border-[var(--glass-border)] pb-3 md:pb-4 gap-3 md:gap-4 w-full">
        <div className="flex gap-1.5 sm:gap-2 md:gap-3 flex-wrap w-full lg:w-auto">
          {[
            { id: 'character', label: 'Protagonista (OC)', count: memory.player_character?.name ? '' : '' },
            { id: 'npcs', label: 'PNJs', count: memory.npcs?.length ? `(${memory.npcs.length})` : '' },
            {
              id: 'locs',
              label: 'Lugares',
              count: memory.locations?.length ? `(${memory.locations.length})` : ''
            },
            {
              id: 'visual',
              label: 'Mapas y Visual',
              count: visualFiles.length ? `(${analyzedCount}/${visualFiles.length})` : ''
            },
            {
              id: 'quests',
              label: 'Tramas',
              count: memory.quests?.length ? `(${memory.quests.length})` : ''
            },
            { id: 'story', label: 'Resumen', count: memory.story ? '' : '' },
            { id: 'status', label: 'Estado', count: memory.current_status ? '' : '' },
            { id: 'notes', label: 'Notas', count: memory.manual_notes ? '' : '' }
          ]
            .filter(tab => seccionesVisibles.includes(tab.id as SeccionMemoria))
            .map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`font-cinzel text-xs md:text-sm px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-sm'
                    : 'text-[var(--text-secondary)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] hover:bg-[var(--glass)] hover:text-[var(--accent)] border border-[var(--glass-border)]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count && <span className="text-[10px] opacity-80">{tab.count}</span>}
              </button>
            ))}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
          <button
            onClick={onTriggerAIUpdate}
            disabled={isGenerating || !hasChats}
            title={
              !hasChats
                ? 'Requiere que haya al menos un mensaje en la crónica para sincronizar'
                : 'Extraer y sincronizar la memoria analizando los capítulos jugados'
            }
            className="bg-[var(--sidebar-bg)] border border-[var(--glass-border)] px-3 py-1.5 md:py-2 rounded-md text-xs font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-all disabled:opacity-50 font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Sincronizar con IA (Manual)
          </button>
          <button
            onClick={handleWipeEntireMemory}
            disabled={isGenerating}
            title="Borrar todos los datos de memoria automática"
            className="text-xs text-red-700 hover:text-red-900 border border-red-200 bg-red-50/50 hover:bg-red-100 px-2.5 py-1.5 md:py-2 rounded-md font-cinzel transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Vaciar
          </button>
        </div>
      </div>

      {/* Tab: Protagonist (Ficha Canónica del Protagonista / OC) */}
      {activeTab === 'character' && (
        <div className="flex flex-col gap-4">
          {memory.player_character ? (
            <CharacterSheetView
              character={memory.player_character}
              onUpdateCharacter={async (updater) => {
                await onUpdateMemory(mem => ({
                  ...mem,
                  player_character: updater(mem.player_character || { name: 'Protagonista' })
                }));
              }}
              onClearCharacter={handleClearPc}
              onOpenPortraitPicker={() =>
                setTargetForPortraitPicker({
                  type: 'player',
                  id: 'pc',
                  name: memory.player_character?.name || 'Protagonista',
                  desc: [
                    memory.player_character?.race,
                    memory.player_character?.class,
                    memory.player_character?.gender,
                    memory.player_character?.appearance,
                    memory.player_character?.notes
                  ].filter(Boolean).join(' ')
                })
              }
              onOpenEditModal={() => {
                setEditingPc({ ...memory.player_character! });
                setIsPcModalOpen(true);
              }}
            />
          ) : (
            <div className="bg-[var(--surface-soft)] border-2 border-dashed border-[var(--accent)]/40 p-8 md:p-12 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
              <Crown className="w-12 h-12 text-[var(--accent)] opacity-50" strokeWidth={1.5} />
              <h3 className="font-cinzel font-bold text-xl text-[var(--accent)] m-0">
                Crea tu Ficha de Personaje (Dungeons & Dragons)
              </h3>
              <p className="text-xs md:text-sm text-[var(--text-secondary)] max-w-lg leading-relaxed m-0">
                Registra a tu protagonista para disponer de ficha interactiva, inventario con monedas y peso, tiradas de salvación y estadísticas de combate que el Narrador tendrá en cuenta en cada turno.
              </p>
              <button
                onClick={() => {
                  setEditingPc({
                    name: 'Protagonista',
                    race: 'Humano',
                    class: 'Guerrero',
                    level: 'Nivel 1',
                    hp: 25,
                    maxHp: 25,
                    ac: 14,
                    speed: '30 pies',
                    initiative: '+0',
                    proficiencyBonus: 2,
                    attributes: { str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
                    currencies: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 },
                    inventory: [
                      {
                        id: 'item_1',
                        name: 'Espada Larga',
                        category: 'weapon',
                        quantity: 1,
                        weight: 3,
                        equipped: true,
                        damageOrAc: '1d8+2 cortante (versátil 1d10)',
                        rarity: 'common',
                        description: 'Arma marcial de filo reluciente forjada en acero templado.'
                      },
                      {
                        id: 'item_2',
                        name: 'Cota de Malla',
                        category: 'armor',
                        quantity: 1,
                        weight: 55,
                        equipped: true,
                        damageOrAc: 'CA 16',
                        rarity: 'common',
                        description: 'Armadura pesada de anillas entrelazadas.'
                      },
                      {
                        id: 'item_3',
                        name: 'Poción de Curación',
                        category: 'potion',
                        quantity: 2,
                        weight: 0.5,
                        damageOrAc: 'Cura 2d4+2 PG',
                        rarity: 'common',
                        description: 'Frasco de cristal con líquido carmesí brillante que sana heridas al beberse.'
                      },
                      {
                        id: 'item_4',
                        name: 'Mochila de Aventurero',
                        category: 'equipment',
                        quantity: 1,
                        weight: 5,
                        rarity: 'common',
                        description: 'Contiene saco de dormir, yesquero, 10 antorchas y 5 días de raciones de viaje.'
                      }
                    ],
                    appearance: '',
                    backstory: '',
                    personality: '',
                    sheetText: '',
                    notes: '',
                    portrait: ''
                  });
                  setIsPcModalOpen(true);
                }}
                className="mt-3 bg-[var(--accent)] text-[var(--on-accent)] px-6 py-2.5 rounded-xl font-cinzel text-xs hover:bg-[var(--accent-hover)] transition-all cursor-pointer font-bold shadow-md flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> + Crear Ficha de Protagonista D&D
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Story (Crónica General) */}
      {activeTab === 'story' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
            <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
              Resumen Acumulado de la Historia (Leído por el Narrador para mantener coherencia):
            </span>
            <div className="flex gap-2">
              {!isEditingStory ? (
                <>
                  <button
                    onClick={() => {
                      setStoryDraft(memory.story || '');
                      setIsEditingStory(true);
                    }}
                    className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] rounded hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar Texto
                  </button>
                  {memory.story && (
                    <button
                      onClick={handleClearStory}
                      className="px-2.5 py-1 text-xs font-cinzel text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Vaciar
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleSaveStory}
                    className="px-3 py-1 text-xs font-cinzel bg-emerald-700 text-white rounded hover:bg-emerald-800 transition-all cursor-pointer font-bold"
                  >
                    <Save className="w-3.5 h-3.5" /> Guardar
                  </button>
                  <button
                    onClick={() => setIsEditingStory(false)}
                    className="px-3 py-1 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)] transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>

          {isEditingStory ? (
            <textarea
              value={storyDraft}
              onChange={e => setStoryDraft(e.target.value)}
              placeholder="Escribe o edita el resumen histórico de lo acontecido en la campaña..."
              className="w-full h-[400px] bg-[var(--surface)] border-2 border-[var(--accent)] p-4 rounded-lg text-base font-lora outline-none leading-relaxed shadow-inner"
            />
          ) : (
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-6 rounded-lg shadow-sm text-base md:text-lg leading-relaxed markdown-body min-h-[160px]">
              {memory.story ? (
                <ReactMarkdown>{memory.story}</ReactMarkdown>
              ) : (
                <span className="text-[var(--text-secondary)] italic">
                  La crónica está vacía. Haz clic en "Editar Texto"para redactar los acontecimientos o utiliza
                  "Sincronizar con IA"para generarla desde tus capítulos.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Status (Estado Actual) */}
      {activeTab === 'status' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
            <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
              Situación actual (dónde están, qué peligros enfrentan, con qué recursos):
            </span>
            <div className="flex gap-2">
              {!isEditingStatus ? (
                <>
                  <button
                    onClick={() => {
                      setStatusDraft(memory.current_status || '');
                      setIsEditingStatus(true);
                    }}
                    className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] rounded hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar Estado
                  </button>
                  {memory.current_status && (
                    <button
                      onClick={handleClearStatus}
                      className="px-2.5 py-1 text-xs font-cinzel text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Vaciar
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleSaveStatus}
                    className="px-3 py-1 text-xs font-cinzel bg-emerald-700 text-white rounded hover:bg-emerald-800 transition-all cursor-pointer font-bold"
                  >
                    <Save className="w-3.5 h-3.5" /> Guardar
                  </button>
                  <button
                    onClick={() => setIsEditingStatus(false)}
                    className="px-3 py-1 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)] transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>

          {isEditingStatus ? (
            <textarea
              value={statusDraft}
              onChange={e => setStatusDraft(e.target.value)}
              placeholder="Describe el estado de ánimo, heridas, ubicación actual o tensión del grupo..."
              className="w-full h-[300px] bg-[var(--surface)] border-2 border-[var(--accent)] p-4 rounded-lg text-base font-lora outline-none leading-relaxed shadow-inner"
            />
          ) : (
            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-6 rounded-lg shadow-sm text-base md:text-lg leading-relaxed markdown-body min-h-[140px]">
              {memory.current_status ? (
                <ReactMarkdown>{memory.current_status}</ReactMarkdown>
              ) : (
                <span className="text-[var(--text-secondary)] italic">
                  No hay estado actual registrado. Haz clic en "Editar Estado"para definirlo libremente.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Visual (Análisis de Mapas e Ilustraciones de Escenarios en Memoria) */}
      {activeTab === 'visual' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)] flex-wrap gap-2">
            <div>
              <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold block">
                Memoria Visual y Mapas de la Campaña ({visualFiles.length} mapas e ilustraciones,{' '}
                {analyzedCount} analizadas)
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] opacity-80">
                El Narrador consulta estas descripciones visuales para mantener coherencia geográfica,
                arquitectónica y táctica en mapas y escenas.
              </span>
            </div>
            {onAutoClassifyAll && (
              <button
                onClick={onAutoClassifyAll}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-cinzel text-xs font-bold hover:bg-amber-200 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                title="Sincroniza y vincula automáticamente mapas e ilustraciones con la memoria"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sincronizar Mapas y Escenarios
              </button>
            )}
          </div>

          {visualFiles.length === 0 ? (
            <div className="text-[var(--text-secondary)] italic py-8 px-6 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] max-w-2xl mx-auto shadow-2xs leading-relaxed text-xs md:text-sm">
              No hay mapas ni ilustraciones de escenarios en la Base de Conocimiento. Sube mapas o escenarios
              desde la pestaña "Archivos" para analizarlos y guardarlos en la memoria.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {visualFiles.map(file => {
                const linkedLoc = memory.locations?.find(
                  l =>
                    l.portrait === file.content ||
                    (l.name.length > 2 && file.name.toLowerCase().includes(l.name.toLowerCase()))
                );

                return (
                  <div
                    key={file.id}
                    className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 md:p-5 rounded-lg shadow-sm flex flex-col md:flex-row gap-5 hover:border-[var(--accent)] transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                      <div
                        className="w-full h-40 bg-black/5 rounded-lg overflow-hidden border border-[var(--glass-border)] cursor-pointer relative group flex items-center justify-center"
                        onClick={() => onOpenMap && onOpenMap(file)}
                        title="Clic para abrir como Mapa Táctico"
                      >
                        <img
                          src={file.content}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-cinzel font-bold">
                          <Map className="w-3.5 h-3.5" /> Ver Mapa
                        </div>
                      </div>
                      <div
                        className="text-xs font-cinzel font-bold text-[var(--text-primary)] truncate"
                        title={file.name}
                      >
                        {file.name}
                      </div>

                      {/* Linking Badges */}
                      {linkedLoc && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded font-cinzel font-bold truncate">
                            Lugar: {linkedLoc.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Analysis Content */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-[var(--glass-border)] flex-wrap gap-2">
                          <span className="text-xs font-cinzel font-bold text-[var(--accent)] uppercase tracking-wider">
                            {file.analysis ? 'Análisis Visual en Memoria' : 'Sin Análisis en Memoria'}
                          </span>
                          <div className="flex gap-1.5 flex-wrap">
                            {file.analysis ? (
                              <>
                                <button
                                  onClick={() => handleOpenEditVisual(file)}
                                  className="px-2.5 py-1 text-xs font-cinzel bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:bg-[var(--surface)] border border-[var(--user-border)] rounded text-[var(--accent)] transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Editar
                                </button>
                                {onAnalyzeImageFile && (
                                  <button
                                    onClick={() => onAnalyzeImageFile(file)}
                                    disabled={isGenerating}
                                    className="px-2.5 py-1 text-xs font-cinzel bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:bg-[var(--surface)] border border-[var(--user-border)] rounded text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-50"
                                    title="Re-analizar imagen con Gemini"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" /> Re-analizar
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteVisualAnalysis(file)}
                                  className="px-2.5 py-1 text-xs font-cinzel text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Borrar este análisis de la memoria"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Borrar
                                </button>
                              </>
                            ) : (
                              <>
                                {onAnalyzeImageFile && (
                                  <button
                                    onClick={() => onAnalyzeImageFile(file)}
                                    disabled={isGenerating}
                                    className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] rounded font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" /> Analizar con IA
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenEditVisual(file)}
                                  className="px-2.5 py-1 text-xs font-cinzel bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:bg-[var(--surface)] border border-[var(--user-border)] rounded text-[var(--text-secondary)] transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Escribir Manualmente
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {file.analysis ? (
                          <div className="text-sm text-[var(--text-primary)] leading-relaxed markdown-body max-h-48 overflow-y-auto pr-2">
                            <ReactMarkdown>{file.analysis}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-xs text-[var(--text-secondary)] italic my-3">
                            Este mapa o ilustración aún no tiene un análisis registrado en la memoria. Pulsa
                            "Analizar con IA"o "Escribir Manualmente"para que el Narrador reconozca sus
                            detalles geográficos durante la partida.
                          </p>
                        )}
                      </div>

                      {file.markers && file.markers.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-[var(--glass-border)] text-xs text-[var(--text-secondary)]">
                          <strong>
                            <MapPin className="w-3.5 h-3.5" /> Chinchetas Tácticas:
                          </strong>{' '}
                          {file.markers.length} puntos de interés marcados.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            <div className="flex gap-2">
              {memory.quests && memory.quests.length > 0 && (
                <button
                  onClick={handleClearAllQuests}
                  className="px-2.5 py-1 text-xs font-cinzel text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Borrar Todas
                </button>
              )}
              <button
                onClick={() => {
                  setEditingQuest({
                    id: 'quest_' + Date.now() + '_' + Math.random().toString(36).substring(7),
                    title: '',
                    type: 'Principal',
                    origin: '',
                    objective: '',
                    progress: '',
                    status: 'Activa'
                  });
                  setIsQuestModalOpen(true);
                }}
                className="bg-[var(--accent)] text-[var(--on-accent)] px-3 py-1.5 rounded font-cinzel text-xs hover:bg-[var(--accent-hover)] transition-all cursor-pointer font-bold shadow-xs"
              >
                + Nueva Trama
              </button>
            </div>
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

                    <div className="flex md:flex-col justify-end gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingQuest(q);
                          setIsQuestModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] rounded hover:bg-[var(--sidebar-bg)] font-cinzel cursor-pointer transition-all flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => handleDeleteQuest(q.id, q.title)}
                        className="px-3 py-1.5 text-xs text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 font-cinzel cursor-pointer transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Borrar
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-[var(--text-secondary)] italic py-8 px-6 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] max-w-2xl mx-auto shadow-2xs leading-relaxed text-xs md:text-sm">
                No hay tramas registradas. Puedes añadir misiones libremente con el botón "+ Nueva Trama".
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
              {memory.npcs && memory.npcs.length > 0 && (
                <button
                  onClick={handleClearAllNpcs}
                  className="px-2.5 py-1 text-xs font-cinzel text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Borrar Todos
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

                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleDeleteNpc(n.id, n.name)}
                          className="px-2 py-0.5 text-xs text-red-700 hover:text-red-900 border border-red-200 dark:border-red-900/40 rounded hover:bg-red-50 dark:hover:bg-red-950 font-cinzel cursor-pointer transition-all flex items-center gap-1"
                          title="Borrar PNJ"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-[var(--text-secondary)] italic py-8 px-6 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] max-w-2xl mx-auto shadow-2xs leading-relaxed text-xs md:text-sm">
                No hay PNJs registrados en la memoria activa. El Narrador los registrará conforme avance la aventura.
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
            <div className="flex gap-2 flex-wrap items-center">
              {memory.locations && memory.locations.length > 0 && (
                <button
                  onClick={handleClearAllLocs}
                  className="px-2.5 py-1 text-xs font-cinzel text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Borrar Todos
                </button>
              )}
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

                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleDeleteLoc(l.id, l.name)}
                          className="px-2.5 py-1 text-xs text-red-700 hover:text-red-900 border border-red-200 rounded hover:bg-red-50 font-cinzel cursor-pointer transition-all flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Borrar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-[var(--text-secondary)] italic py-8 px-6 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] max-w-2xl mx-auto shadow-2xs leading-relaxed text-xs md:text-sm">
                No hay lugares registrados en la memoria activa. El Narrador los registrará conforme descubras nuevas ubicaciones.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Analysis Edit Modal */}
      {isVisualModalOpen && editingVisualFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-color)] p-6 rounded-lg shadow-2xl border border-[var(--glass-border)] w-[580px] max-w-full font-lora flex flex-col max-h-[90vh]">
            <h4 className="font-cinzel text-lg text-[var(--accent)] mb-2 font-bold flex items-center gap-2">
              <Image className="w-3.5 h-3.5" /> Editar Análisis Visual: {editingVisualFile.name}
            </h4>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              Modifica la descripción del mapa o imagen que leerá el Narrador IA para mantener coherencia en
              las escenas.
            </p>
            <div className="flex-1 overflow-y-auto mb-4">
              <textarea
                value={visualDraft}
                onChange={e => setVisualDraft(e.target.value)}
                placeholder="Describe qué se ve en este mapa o ilustración (zonas, ríos, puertas, enemigos, ambiente)..."
                className="w-full h-64 bg-[var(--surface)] border border-[var(--user-border)] p-3 rounded-lg text-sm font-lora outline-none focus:border-[var(--accent)] leading-relaxed shadow-inner"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
              <button
                onClick={() => setIsVisualModalOpen(false)}
                className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveVisualAnalysis}
                className="px-4 py-1.5 text-xs font-cinzel bg-emerald-700 text-white rounded hover:bg-emerald-800 font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Guardar en Memoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quest Modal */}
      {isQuestModalOpen && editingQuest && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-color)] p-6 rounded-lg shadow-2xl border border-[var(--glass-border)] w-[480px] max-w-full font-lora">
            <h4 className="font-cinzel text-xl text-[var(--accent)] mb-4 font-bold">
              {editingQuest.title ? 'Editar Trama' : 'Nueva Trama'}
            </h4>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Título de la Misión
                </label>
                <input
                  type="text"
                  value={editingQuest.title}
                  onChange={e => setEditingQuest({ ...editingQuest, title: e.target.value })}
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded outline-none focus:border-[var(--accent)]"
                  placeholder="Título de la trama"
                />
              </div>
              <div className="flex gap-3">
                <div className="w-1/2">
                  <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    Tipo
                  </label>
                  <select
                    value={editingQuest.type}
                    onChange={e => setEditingQuest({ ...editingQuest, type: e.target.value })}
                    className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded outline-none"
                  >
                    <option value="Principal">Principal</option>
                    <option value="Secundaria">Secundaria</option>
                    <option value="Personal">Personal</option>
                    <option value="Rumor">Rumor</option>
                  </select>
                </div>
                <div className="w-1/2">
                  <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                    Estado
                  </label>
                  <select
                    value={editingQuest.status || 'Activa'}
                    onChange={e => setEditingQuest({ ...editingQuest, status: e.target.value })}
                    className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded outline-none"
                  >
                    <option value="Activa">Activa</option>
                    <option value="Completada">Completada</option>
                    <option value="En Pausa">En Pausa</option>
                    <option value="Fallida">Fallida</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Origen / Quién la dio
                </label>
                <input
                  type="text"
                  value={editingQuest.origin || ''}
                  onChange={e => setEditingQuest({ ...editingQuest, origin: e.target.value })}
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded outline-none focus:border-[var(--accent)]"
                  placeholder="Quién o qué la puso en marcha"
                />
              </div>
              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Objetivo
                </label>
                <textarea
                  value={editingQuest.objective}
                  onChange={e => setEditingQuest({ ...editingQuest, objective: e.target.value })}
                  rows={2}
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded outline-none focus:border-[var(--accent)] resize-none"
                  placeholder="Qué hay que conseguir"
                />
              </div>
              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Progreso / Pistas Actuales
                </label>
                <textarea
                  value={editingQuest.progress}
                  onChange={e => setEditingQuest({ ...editingQuest, progress: e.target.value })}
                  rows={2}
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded outline-none focus:border-[var(--accent)] resize-none"
                  placeholder="Por dónde va ahora mismo"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setIsQuestModalOpen(false)}
                className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)]"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveQuest(editingQuest)}
                disabled={!editingQuest.title.trim()}
                className="px-4 py-1.5 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 font-bold"
              >
                Guardar Trama
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Protagonist (OC) Modal */}
      {isPcModalOpen && editingPc && (
        <CharacterEditModal
          isOpen={isPcModalOpen}
          character={editingPc}
          onClose={() => {
            setIsPcModalOpen(false);
            setEditingPc(null);
          }}
          onSave={async (updated) => {
            await handleSavePc(updated);
          }}
          allImageFiles={allImageFiles}
          onOpenPortraitPicker={() =>
            setTargetForPortraitPicker({
              type: 'player',
              id: 'pc',
              name: editingPc.name || 'Protagonista',
              desc: [
                editingPc.race,
                editingPc.class,
                editingPc.gender,
                editingPc.appearance,
                editingPc.notes
              ].filter(Boolean).join(' ')
            })
          }
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
