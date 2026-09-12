import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, Memory, NPC, Location, ProjectFile, TimelineEntry, InventoryItem } from '../types';
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
import { extraerIdentidadDeDocumentos, fusionarTrama, tramarLaCampana } from '../utils/geminiHelper';
import { preparadoEnPie, relojesEnMarcha } from '../utils/cuadernoOculto';
import { deduplicarListaNpcs } from '../utils/npcMatcher';
import { sanitizePlayerCharacter, sanitizeProjectMemory } from '../utils/sanitizers';
import { ImagePickerModal, ImagePickerTarget } from './ImagePickerModal';
import { NpcDossierModal } from './NpcDossierModal';
import { LocationDossierModal } from './LocationDossierModal';
import { DailyAgendaDiary } from './DailyAgendaDiary';
import { StatusView } from './StatusView';

import {
  BookOpen,
  Calendar,
  CalendarClock,
  Camera,
  Castle,
  ChevronDown,
  ChevronUp,
  Compass,
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
  Backpack,
  Coins,
  PackageCheck,
  PackageX,
  Users,
  Footprints,
  Timer,
  Flag,
  Layers
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
  | 'inventario'
  | 'diary'
  | 'npcs'
  | 'locs'
  | 'quests'
  | 'story'
  | 'status'
  | 'giros'
  | 'bambalinas'
  | 'relojes'
  | 'facciones'
  | 'preparado';

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
    : ['character', 'inventario', 'diary', 'npcs', 'locs', 'quests', 'story', 'status'];

  const [activeTab, setActiveTab] = useState<SeccionMemoria>(seccionesVisibles[0]);

  // Si cambia el reparto de secciones, la pestaña activa puede quedarse fuera.
  React.useEffect(() => {
    if (!seccionesVisibles.includes(activeTab)) setActiveTab(seccionesVisibles[0]);
  }, [secciones]);

  // Protagonist (OC) State
  const [isSyncingAI, setIsSyncingAI] = useState(false);

  // Portrait Linker Modal state
  const [targetForPortraitPicker, setTargetForPortraitPicker] = useState<ImagePickerTarget | null>(null);

  // Character Events / Milestones state
  const [milestonesSearchQuery, setMilestonesSearchQuery] = useState('');
  const [milestonesSortOrder, setMilestonesSortOrder] = useState<'desc' | 'asc'>('desc');

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
  /** Giros que la jugadora ha decidido leerse. No se guarda: se destapa y ya. */
  const [secretosDestapados, setSecretosDestapados] = useState<Set<string>>(new Set());
  const [tramando, setTramando] = useState(false);
  const [leyendoFicha, setLeyendoFicha] = useState(false);
  const [verPremisa, setVerPremisa] = useState(false);

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
    visual_memory: []
  };

  const allImageFiles = files.filter(f => f.isImage);

  const onUpdateMemoryRef = useRef(onUpdateMemory);
  onUpdateMemoryRef.current = onUpdateMemory;


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

  /*
   * Los tres datos que el Narrador da por ciertos en cada turno.
   *
   * La raza no se veía ni se podía tocar en ninguna pantalla: vivía en un valor
   * cableado en el código («Elfa de la Luna») que se colaba en la ficha al
   * vaciar la memoria y viajaba al Narrador turno tras turno como un hecho. Si
   * un dato se le manda al Narrador como verdad, tiene que poder verse y
   * corregirse aquí.
   */
  /**
   * Quita de la lista a quien nunca ha pisado la partida.
   *
   * Extraer un compendio deja decenas de fichas de gente que no se ha conocido:
   * ocupan sitio en cada turno y, peor, convierten en lista de la compra a
   * personajes que deberían aparecer jugando. Esto borra solo a los que no han
   * salido nunca, no tienen retrato y no tienen afinidad: o sea, a nadie con
   * quien haya pasado nada.
   */
  const limpiarElencoNoConocido = async () => {
    const todos = memory.npcs || [];
    const conocido = (n: NPC) =>
      (n.diasVistos?.length || 0) >= 1 ||
      n.recurrente ||
      Boolean(n.portrait) ||
      typeof n.atr === 'number' ||
      typeof n.vin === 'number' ||
      typeof n.con === 'number';
    const sobran = todos.filter(n => !conocido(n));
    if (sobran.length === 0) {
      window.alert('No hay ninguna ficha de gente sin conocer: todas las de la lista han salido en la partida o tienen algo tuyo.');
      return;
    }
    const muestra = sobran.slice(0, 8).map(n => n.name).join(', ');
    if (
      !window.confirm(
        `Se van a quitar ${sobran.length} fichas de personajes que NO han salido nunca en la partida, no tienen retrato y no tienen afinidad:\n\n${muestra}${sobran.length > 8 ? `, y ${sobran.length - 8} más` : ''}\n\nSeguirán existiendo en tus documentos, y se ficharán solos cuando aparezcan en escena. ¿Los quito?`
      )
    )
      return;
    await onUpdateMemory(mem => ({ ...mem, npcs: (mem.npcs || []).filter(conocido) }));
  };

  const cambiarIdentidad = async (campo: 'race' | 'class' | 'languages' | 'appearance', valor: string) => {
    await onUpdateMemory(mem => ({
      ...mem,
      player_character: {
        ...(mem.player_character || { name: 'Protagonista' }),
        ...(campo === 'languages'
          ? { languages: valor.split(',').map(v => v.trim()).filter(Boolean) }
          : { [campo]: valor.trim() })
      }
    }));
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

  // Wipe Entire Memory Across All Tabs
  const handleWipeEntireMemory = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Restablecer Toda la Memoria',
      message:
        '¿Deseas vaciar y restablecer completamente toda la memoria de la campaña? Esta acción borrará los datos de todas las pestañas: el resumen e hitos del Protagonista, la cronología e hilos de la Agenda, la lista de PNJs y sus afinidades, los Lugares y mapas, las Tramas y misiones activas, el Resumen acumulado, el Estado de la compañía y las Notas del tomo.',
      onConfirm: async () => {
        setExpandedLocIds(new Set());
        setExpandedQuestIds(new Set());
        setSelectedNpcForDossier(null);
        setSelectedLocForDossier(null);
        setVinculosDestapados(new Set());

        const emptyMemory: Memory = {
          story: '',
          current_status: '',
          quests: [],
          npcs: [],
          companions: [],
          locations: [],
          visual_memory: [],
          player_character: {
            /*
             * Vaciar la memoria conserva QUIÉN eres, no inventa a otra.
             *
             * Aquí había «Elfa de la Luna» y «Druida / Maga» cableados: al
             * empezar de cero, la aplicación escribía esa raza en la ficha y se
             * la mandaba al Narrador en cada turno. Si tu personaje era una
             * drow, el Narrador recibía una contradicción y la resolvía a
             * medias. Lo que no consta se queda sin constar.
             */
            name: project.memory?.player_character?.name || '',
            title: 'Protagonista (OC)',
            race: project.memory?.player_character?.race || '',
            class: project.memory?.player_character?.class || '',
            languages: project.memory?.player_character?.languages || [],
            summary: '',
            events: [],
            notes: '',
            backstory: '',
            personality: '',
            appearance: '',
            portrait: project.memory?.player_character?.portrait
          }
        };

        if (onUpdateProject) {
          await onUpdateProject(() => ({
            timeline: [],
            threads: [],
            memory: sanitizeProjectMemory(emptyMemory)
          }));
        }
        await onUpdateMemory(() => emptyMemory);

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
              La IA actualiza y preserva giros, PNJs, lugares y tramas en cada respuesta sin consumir llamadas extra.
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
              id: 'inventario',
              label: 'Inventario',
              shortLabel: 'Mochila',
              icon: Backpack,
              count: (() => {
                const n = (memory.player_character?.inventory || []).filter(i => !i.resuelto).length;
                return n ? `(${n})` : '';
              })()
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
            {
              id: 'giros',
              label: 'Giros',
              shortLabel: 'Giros',
              icon: Lock,
              count: memory.gm_secrets?.length ? `(${memory.gm_secrets.filter(x => !x.revelado).length})` : ''
            },
            {
              id: 'bambalinas',
              label: 'Fuera de cámara',
              shortLabel: 'Bambalinas',
              icon: Footprints,
              count: memory.gm_bambalinas?.length ? `(${memory.gm_bambalinas.length})` : ''
            },
            {
              id: 'relojes',
              label: 'Relojes',
              shortLabel: 'Relojes',
              icon: Timer,
              count: relojesEnMarcha(memory.gm_relojes).length
                ? `(${relojesEnMarcha(memory.gm_relojes).length})`
                : ''
            },
            {
              id: 'facciones',
              label: 'Facciones',
              shortLabel: 'Facciones',
              icon: Flag,
              count: memory.gm_facciones?.length ? `(${memory.gm_facciones.length})` : ''
            },
            {
              id: 'preparado',
              label: 'Preparado',
              shortLabel: 'Preparado',
              icon: Layers,
              count: preparadoEnPie(memory.gm_preparado).length
                ? `(${preparadoEnPie(memory.gm_preparado).length})`
                : ''
            }
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
            title="Vaciar y restablecer toda la memoria viva de la campaña en todas las pestañas"
            aria-label="Restablecer toda la memoria"
            className="text-xs text-red-700 hover:text-red-900 border border-red-200 bg-red-50/70 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60 dark:hover:bg-red-900/50 px-2.5 sm:px-3 py-1.5 md:py-2 rounded-lg font-cinzel transition-all cursor-pointer flex items-center gap-1.5 font-bold shadow-xs disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Restablecer Toda la Memoria</span><span className="sm:hidden">Restablecer</span>
          </button>
        </div>
      </div>

      {/* Tab: Protagonist (OC) */}
      {activeTab === 'character' && (() => {
        const cleanPc = sanitizePlayerCharacter(memory.player_character);
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
                            name: cleanPc.name || 'Protagonista',
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
                          name: cleanPc.name || 'Protagonista',
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
                      {cleanPc.name || 'Protagonista'}
                    </h2>
                    {cleanPc.title && (
                      <p className="text-sm font-lora italic text-[var(--text-secondary)] mt-0.5 m-0">
                        {cleanPc.title}
                      </p>
                    )}
                    {/*
                      Que la ficha se quede con el nombre de relleno no es un
                      detalle cosmético: el Narrador recibe «Protagonista» como
                      el nombre del personaje, y el filtro que impide que el OC
                      acabe fichado como PNJ compara contra esa palabra en vez
                      de contra su nombre. Callado no se arregla nunca.
                    */}
                    {!(memory.player_character?.name || '').trim() ||
                    /^(protagonista|jugador|el jugador|personaje jugador|oc|pj)$/i.test(
                      (memory.player_character?.name || '').trim()
                    ) ? (
                      <p className="mt-1 text-[11px] leading-snug text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-lg px-2 py-1.5 m-0">
                        ⚠️ <strong>Tu personaje no tiene nombre en la ficha.</strong> El Narrador lo llama
                        «Protagonista» en cada turno, y sin nombre la aplicación no puede reconocerlo, así que acaba
                        creándole tarjeta de PNJ. Pulsa <strong>«Rellenar leyendo mi ficha subida»</strong> aquí abajo,
                        o escríbelo a mano.
                      </p>
                    ) : null}
                  </div>

                  {/*
                    Aquí había un segundo «Sincronizar con IA» que llamaba
                    EXACTAMENTE a la misma función que el de la barra de arriba.
                    Puesto junto a la ficha del protagonista parecía que
                    sincronizaba solo el personaje, y no: hacía lo mismo. Dos
                    botones iguales con distinto aspecto y sitio no son una
                    opción, son una duda. El que sí es del personaje —«Rellenar
                    leyendo mi ficha subida»— está justo debajo.
                  */}
                </div>

                {/*
                  Identidad: lo que el Narrador da por cierto en cada turno.

                  Va con la etiqueta a la vista y editable porque estos tres
                  campos no son decoración: viajan al prompt como hechos fijos.
                  La raza vacía es mejor que una inventada —el Narrador tiene
                  orden de preguntar en vez de deducirla— pero peor que la
                  correcta, así que conviene verla.
                */}
                {/*
                  Leer la identidad de la propia ficha subida.

                  Estos cuatro campos solo se podían rellenar a mano, aunque la
                  ficha del personaje estuviera subida en Archivos con todo
                  dentro. «Sincronizar con IA» existía y no los tocaba: llenaba
                  el resumen y los acontecimientos, y dejaba fuera justo los
                  cuatro datos que viajan al Narrador en cada turno como hechos
                  fijos. Copiar a mano lo que ya está escrito es trabajo que
                  debería hacer la aplicación.
                */}
                <button
                  onClick={async () => {
                    if (leyendoFicha) return;
                    setLeyendoFicha(true);
                    try {
                      const id = await extraerIdentidadDeDocumentos({ project, files });
                      const encontrado = [
                        id.name ? `Nombre: ${id.name}` : '',
                        id.race ? `Raza: ${id.race}` : '',
                        id.class ? `Clase: ${id.class}` : '',
                        id.languages?.length ? `Idiomas: ${id.languages.join(', ')}` : '',
                        id.appearance ? `Rasgos: ${id.appearance.slice(0, 240)}${id.appearance.length > 240 ? '…' : ''}` : '',
                        id.inventory?.length
                          ? `Lleva encima (${id.inventory.length}): ${id.inventory.map(i => i.name).join(', ').slice(0, 400)}`
                          : '',
                        id.currencies && Object.keys(id.currencies).length
                          ? `Dinero: ${Object.entries(id.currencies).map(([k, v]) => `${v} ${k.toUpperCase()}`).join(', ')}`
                          : ''
                      ].filter(Boolean);

                      if (encontrado.length === 0) {
                        window.alert('No he encontrado el nombre, la raza, la clase, los idiomas, la descripción física ni el equipo en tus documentos. Comprueba que la ficha del personaje esté subida en Archivos.');
                        return;
                      }
                      // Se enseña ANTES de escribir: son datos que el Narrador
                      // da por ciertos, y pisarlos sin avisar sería peor que no
                      // ofrecer el botón.
                      if (!window.confirm(`Esto es lo que he leído de tus documentos:\n\n${encontrado.join('\n\n')}\n\n¿Lo guardo en la ficha? Los datos de identidad se sustituyen; el equipo se AÑADE a la mochila sin tocar lo que ya hubiera, y el dinero solo se pone si la bolsa estaba a cero.`)) return;

                      await onUpdateMemory(mem => ({
                        ...mem,
                        player_character: {
                          ...(mem.player_character || { name: 'Protagonista' }),
                          ...(id.name ? { name: id.name } : {}),
                          ...(id.race ? { race: id.race } : {}),
                          ...(id.class ? { class: id.class } : {}),
                          ...(id.languages ? { languages: id.languages } : {}),
                          ...(id.appearance ? { appearance: id.appearance } : {}),
                          /*
                           * La mochila se FUNDE, no se pisa.
                           *
                           * Lo que ha ganado, perdido o le han requisado jugando
                           * es de hoy; la ficha es del primer día. Leerla otra
                           * vez tiene que añadir lo que faltaba —el cuaderno,
                           * las herramientas, el instrumento que nunca se
                           * apuntaron— sin resucitar lo que ya gastó ni borrar
                           * de quién es ahora lo que le quitaron.
                           */
                          ...(id.inventory?.length
                            ? {
                                inventory: (() => {
                                  const yaEstaba = mem.player_character?.inventory || [];
                                  const clave = (n: string) =>
                                    n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
                                  const conocidos = new Set(yaEstaba.map(i => clave(i.name || '')));
                                  return [...yaEstaba, ...id.inventory!.filter(i => !conocidos.has(clave(i.name || '')))];
                                })()
                              }
                            : {}),
                          // El dinero solo se pone si no había ninguno: el saldo lo lleva el juego.
                          ...(id.currencies &&
                          Object.keys(id.currencies).length &&
                          !Object.values(mem.player_character?.currencies || {}).some(v => v)
                            ? { currencies: id.currencies }
                            : {})
                        }
                      }));
                    } catch (err: any) {
                      window.alert(err?.message || 'No se ha podido leer la ficha. Inténtalo de nuevo.');
                    } finally {
                      setLeyendoFicha(false);
                    }
                  }}
                  disabled={leyendoFicha}
                  className="mt-2.5 w-full min-h-[40px] px-3 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] text-xs font-cinzel font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                  title="Lee el nombre, la raza, la clase, los idiomas, los rasgos físicos Y EL EQUIPO de la ficha que tienes subida en Archivos, para no tener que copiarlos a mano. El equipo se añade a la mochila, que es lo que el Narrador lee en cada turno."
                >
                  <Sparkles className={`w-3.5 h-3.5 ${leyendoFicha ? 'animate-spin' : ''}`} />
                  {leyendoFicha ? 'Leyendo tu ficha…' : 'Rellenar leyendo mi ficha subida'}
                </button>

                {/*
                  Los rasgos físicos, que no se podían escribir en ningún sitio.

                  Sin este campo, la línea de apariencia desaparecía del envío y
                  el Narrador rellenaba el hueco: donde ponía «ojos de
                  alejandrita» salía «un tinte fosforescente y cambiante». Y el
                  detalle podía estar en un documento, sí, pero enterrado entre
                  doscientas mil fichas; esto viaja pegado a la escena.
                */}
                <label className="mt-2.5 flex flex-col gap-1">
                  <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1">
                    Rasgos físicos — lo que ve quien la mira
                    {!cleanPc.appearance && (
                      <span className="text-amber-600 dark:text-amber-400" title="Sin rellenar. El Narrador tiene orden de no inventarse rasgos, pero tampoco podrá describirlos.">
                        ⚠
                      </span>
                    )}
                  </span>
                  <textarea
                    defaultValue={cleanPc.appearance || ''}
                    key={`${cleanPc.name}-appearance-${(cleanPc.appearance || '').length}`}
                    onBlur={e => {
                      if (e.target.value.trim() !== (cleanPc.appearance || '').trim()) {
                        cambiarIdentidad('appearance', e.target.value);
                      }
                    }}
                    rows={3}
                    placeholder="Ojos de alejandrita que cambian del verde al rojo según la luz; melena plateada; media luna de tinta clara en la frente…"
                    className={`w-full rounded-lg border bg-[var(--surface)] px-2.5 py-2 text-xs font-lora leading-relaxed text-[var(--text-primary)] outline-hidden focus:border-[var(--accent)] resize-y ${
                      cleanPc.appearance ? 'border-[var(--user-border)]' : 'border-amber-500/50'
                    }`}
                    title="Estos rasgos viajan al Narrador en cada turno y van pegados a la escena, así que los usa tal cual en vez de aproximarlos."
                  />
                </label>

                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { campo: 'race' as const, rotulo: 'Raza / especie', valor: cleanPc.race || '', ph: 'Drow, humana, tiefling…' },
                    { campo: 'class' as const, rotulo: 'Clase', valor: cleanPc.class || '', ph: 'Druida, pícara…' },
                    { campo: 'languages' as const, rotulo: 'Idiomas', valor: (cleanPc.languages || []).join(', '), ph: 'Común, élfico, drow…' }
                  ]).map(({ campo, rotulo, valor, ph }) => (
                    <label key={campo} className="flex flex-col gap-1 min-w-0">
                      <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1">
                        {rotulo}
                        {!valor && <span className="text-amber-600 dark:text-amber-400" title="Sin rellenar. El Narrador no lo dará por supuesto: preguntará.">⚠</span>}
                      </span>
                      <input
                        defaultValue={valor}
                        key={`${cleanPc.name}-${campo}-${valor}`}
                        onBlur={e => { if (e.target.value.trim() !== valor.trim()) cambiarIdentidad(campo, e.target.value); }}
                        placeholder={ph}
                        title={
                          campo === 'languages'
                            ? 'Separados por comas. El Narrador NO le traducirá ningún idioma que no esté aquí: los oirá como ruido.'
                            : campo === 'race'
                            ? 'Manda sobre lo que sugieran el nombre, un tatuaje o los documentos. Si se deja vacío, el Narrador preguntará en vez de deducirlo.'
                            : 'Clase y arquetipo del protagonista.'
                        }
                        className={`min-h-[40px] w-full rounded-lg border bg-[var(--surface)] px-2.5 text-xs font-lora text-[var(--text-primary)] outline-hidden focus:border-[var(--accent)] ${
                          valor ? 'border-[var(--user-border)]' : 'border-amber-500/50'
                        }`}
                      />
                    </label>
                  ))}
                </div>

                {/* Level & Progress Bar */}
                {(() => {
                  /*
                   * La misma barra inventada que había en el HUD, con otra
                   * fórmula: `eventos*15 + misiones*20`, con un suelo del 5%.
                   * Ni medía el avance por hitos ni coincidía con la del HUD,
                   * así que las dos pantallas daban porcentajes distintos del
                   * mismo personaje. Ahora las dos leen la cuenta real que
                   * anota el Narrador, y si no la hay, lo dicen.
                   */
                  const hitos = cleanPc.hitosActuales;
                  const paraSubir = cleanPc.hitosParaSubir;
                  const hayCuenta = typeof hitos === 'number' && typeof paraSubir === 'number' && paraSubir > 0;
                  const currentLevelProgress = hayCuenta
                    ? Math.max(0, Math.min(100, Math.round((hitos! / paraSubir!) * 100)))
                    : cleanPc.levelProgress ?? 0;

                  return (
                    <div className="mt-2.5 flex flex-col gap-1.5 bg-[var(--surface)] p-3 rounded-lg border border-[var(--glass-border)]">
                      <div className="flex justify-between items-center text-xs font-cinzel">
                        <span className="font-bold text-[var(--accent)] flex items-center gap-1.5">
                          <span>{cleanPc.level || 'Nivel 1'}</span>
                          {cleanPc.class && <span className="text-[var(--text-secondary)] font-normal">({cleanPc.class})</span>}
                        </span>
                        <span className="text-[var(--text-secondary)] font-semibold">
                          {hayCuenta
                            ? `${hitos} de ${paraSubir} hitos · ${currentLevelProgress}%`
                            : 'sin cuenta de hitos anotada'}
                        </span>
                      </div>
                      {hayCuenta ? (
                        <div className="w-full bg-[var(--surface-soft)] rounded-full h-2 overflow-hidden border border-[var(--glass-border)]">
                          <div
                            className="bg-[var(--accent)] h-full transition-all duration-300 rounded-full"
                            style={{ width: `${currentLevelProgress}%` }}
                          />
                        </div>
                      ) : (
                        <p className="m-0 text-[11px] text-[var(--text-secondary)] leading-snug">
                          El Narrador lleva la cuenta al cerrar sesión con una línea{' '}
                          <span className="font-mono">[Avance: 2/3 hacia Nivel 3]</span>, y al subir con{' '}
                          <span className="font-mono">[NIVEL: 3]</span>. En cuanto lo anote, aquí saldrá el
                          avance real.
                        </p>
                      )}
                    </div>
                  );
                })()}

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

          {/* Acontecimientos e Hitos de Memoria del Protagonista */}
          {(() => {
            const personalTimelineEvents = (project.timeline || []).filter(t => t.tipo === 'personal' || t.hito);
            const allPersonalEventsCount = (cleanPc.events?.length || 0) + personalTimelineEvents.length;

            return (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
                  <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Acontecimientos e Hitos Registrados del Protagonista ({allPersonalEventsCount}):
                  </span>
                </div>

                {/*
                  Aquí había un formulario para añadir hitos a mano. Fuera: un
                  hito lo registra quien lleva la crónica. Si falta uno, se le
                  cuenta al Director y lo apunta él.
                */}
                {/* Search & Sort Controls + Scrollable List */}
                <div className="flex flex-col gap-2.5">
                  {allPersonalEventsCount > 0 && (
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="text"
                        placeholder="🔍 Buscar en hitos y acontecimientos..."
                        value={milestonesSearchQuery}
                        onChange={e => setMilestonesSearchQuery(e.target.value)}
                        className="flex-1 bg-[var(--surface-soft)] border border-[var(--glass-border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-lora"
                      />
                      <button
                        onClick={() => setMilestonesSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="px-3 py-1.5 bg-[var(--surface-soft)] border border-[var(--glass-border)] hover:border-[var(--accent)] text-xs font-cinzel rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0"
                        title={milestonesSortOrder === 'desc' ? 'Orden: Más recientes primero (Haz clic para invertir)' : 'Orden: Más antiguos primero (Haz clic para invertir)'}
                      >
                        {milestonesSortOrder === 'desc' ? '🔽 Recientes' : '🔼 Antiguos'}
                      </button>
                    </div>
                  )}

                  {allPersonalEventsCount === 0 ? (
                    <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 rounded-lg text-center text-xs text-[var(--text-secondary)] font-lora italic">
                      No hay hitos registrados en la memoria aún. La IA registra automáticamente aquí los sucesos trascendentales y victorias del protagonista durante la aventura, o puedes añadir uno manualmente con el botón superior.
                    </div>
                  ) : (() => {
                    const pcEventsNormalized = (cleanPc.events || []).map((ev, index) => ({
                      id: ev.id || `pc_ev_${index}`,
                      title: ev.title,
                      description: ev.description || '',
                      date: ev.dateOrTime || 'Fecha reciente',
                      timestamp: ev.createdAt || index,
                      source: 'pc' as const,
                      mood: '⭐',
                      originalIndex: index
                    }));

                    const timelineEventsNormalized = personalTimelineEvents.map((t, index) => ({
                      id: t.id || `tl_ev_${index}`,
                      title: t.title,
                      description: t.summary || '',
                      date: t.date || 'Cronología',
                      timestamp: t.absDay || index,
                      source: 'timeline' as const,
                      mood: t.mood || '⭐',
                      originalItem: t
                    }));

                    const allUnifiedEvents = [...pcEventsNormalized, ...timelineEventsNormalized].sort((a, b) => {
                      const diff = (b.timestamp || 0) - (a.timestamp || 0);
                      return milestonesSortOrder === 'desc' ? diff : -diff;
                    });

                    const filteredEvents = allUnifiedEvents.filter(ev => 
                      milestonesSearchQuery.trim() === '' ||
                      (ev.title || '').toLowerCase().includes(milestonesSearchQuery.toLowerCase()) ||
                      (ev.description || '').toLowerCase().includes(milestonesSearchQuery.toLowerCase()) ||
                      (ev.date || '').toLowerCase().includes(milestonesSearchQuery.toLowerCase())
                    );

                    if (filteredEvents.length === 0) {
                      return (
                        <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 rounded-lg text-center text-xs text-[var(--text-secondary)] font-lora italic">
                          No se encontraron hitos que coincidan con la búsqueda "{milestonesSearchQuery}".
                        </div>
                      );
                    }

                    return (
                      <div className="max-h-[480px] overflow-y-auto pr-1 flex flex-col gap-2">
                        {filteredEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-3.5 rounded-lg flex flex-col gap-1 relative group hover:border-[var(--accent)]/40 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-cinzel font-bold text-xs sm:text-sm text-[var(--accent)] flex items-center gap-1.5">
                                  <span>{ev.mood}</span>
                                  <span>{ev.title}</span>
                                </span>
                                {ev.date && (
                                  <span className="text-[10px] font-cinzel text-[var(--text-secondary)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--glass-border)]">
                                    {ev.date}
                                  </span>
                                )}
                                {ev.source === 'timeline' && (
                                  <span className="text-[10px] font-cinzel text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    Hito de Campaña
                                  </span>
                                )}
                              </div>
                              {/*
                                Sin papelera: un hito es memoria de la campaña.
                                Si sobra uno —porque se rehizo la escena, o
                                porque nunca llegó a pasar— se le dice al
                                Director en el Chat con el GM y lo quita él.
                              */}
                            </div>
                            {ev.description && (
                              <p className="text-xs font-lora text-[var(--text-secondary)] leading-relaxed m-0 whitespace-pre-wrap">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

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

      {/* Tab: Status (Estado Actual y Preferencias de Arbitraje) */}
      {activeTab === 'status' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
              <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
                Situación actual de la compañía (dónde están, qué peligros enfrentan, recursos):
              </span>
            </div>

            <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-6 rounded-lg shadow-sm text-base md:text-lg leading-relaxed markdown-body min-h-[100px]">
              {memory.current_status ? (
                <ReactMarkdown>{memory.current_status}</ReactMarkdown>
              ) : (
                <span className="text-[var(--text-secondary)] italic">
                  El estado actual de la compañía se actualiza automáticamente con cada respuesta del Narrador.
                </span>
              )}
            </div>
          </div>

          <StatusView
            project={project}
            files={files}
            chats={project.chats}
            onUpdate={onUpdateProject ? (fields) => {
              if (typeof fields === 'function') {
                return onUpdateProject(fields);
              }
              return onUpdateProject(() => fields);
            } : undefined}
            onUpdateMemory={onUpdateMemory}
          />
        </div>
      )}

      {/* Pestaña: Giros de la campaña (lo que el Narrador guarda bajo llave) */}
      {activeTab === 'facciones' && (() => {
        const facciones = memory.gm_facciones || [];
        const COLOR: Record<string, string> = {
          aliada: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
          neutral: 'text-[var(--text-secondary)] bg-[var(--surface)] border-[var(--glass-border)]',
          recelosa: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25',
          enemiga: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25',
          'no la conoce': 'text-[var(--text-secondary)] bg-[var(--surface)] border-[var(--glass-border)]',
          rival: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25',
          guerra: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25'
        };
        const EMOJI: Record<string, string> = {
          aliada: '🤝', neutral: '➖', recelosa: '🤨', enemiga: '⚔️', 'no la conoce': '❔',
          rival: '🥊', guerra: '🔥'
        };
        return (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 sm:p-4 flex flex-col gap-1.5">
              <span className="text-sm font-cinzel font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                🏴 Facciones
              </span>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] m-0 leading-relaxed">
                Quién quiere qué, contra quién. Una facción no es la suma de su gente:{' '}
                <strong className="text-indigo-700 dark:text-indigo-300">su objetivo sigue vivo aunque muera quien lo llevaba</strong>. Dos bandos que se
                odian generan escenas sin que nadie haga nada.
              </p>
            </div>
            {facciones.length === 0 ? (
              <div className="text-[var(--text-secondary)] italic py-6 px-5 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] leading-relaxed text-xs flex flex-col gap-2">
                <span>Aún no hay ninguna. El Narrador las ficha cuando aparece un grupo con intereses propios.</span>
                <span className="not-italic font-cinzel text-[11px] text-indigo-700 dark:text-indigo-300">
                  También se las puedes pedir al GM en el Chat: «ficha a los Zhentarim y di cómo se llevan con
                  Bregan D'aerthe».
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {facciones.map(fa => (
                  <div
                    key={fa.id}
                    className="p-3.5 rounded-xl border bg-[var(--surface-soft)] border-indigo-500/25 flex flex-col gap-1.5 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-cinzel font-bold text-xs sm:text-sm break-words text-indigo-700 dark:text-indigo-300">
                        {fa.name}
                      </span>
                      {fa.conElla && (
                        <span className={`text-[10px] font-cinzel px-1.5 py-0.5 rounded border ${COLOR[fa.conElla]}`}>
                          {EMOJI[fa.conElla]} {fa.conElla}
                        </span>
                      )}
                      {fa.conocida === false && (
                        <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                          🔒 ni sabes que existe
                        </span>
                      )}
                    </div>
                    {fa.queEs && (
                      <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">{fa.queEs}</p>
                    )}
                    {fa.objetivo && (
                      <p className="text-xs font-lora text-[var(--text-primary)] m-0 leading-relaxed">
                        <strong className="font-cinzel text-[11px] text-indigo-700 dark:text-indigo-300">Va a por:</strong>{' '}
                        {fa.objetivo}
                      </p>
                    )}
                    {fa.recursos && (
                      <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">
                        💪 {fa.recursos}
                      </p>
                    )}
                    {fa.cabeza && (
                      <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">
                        👑 {fa.cabeza}
                      </p>
                    )}
                    {fa.relaciones?.length ? (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {fa.relaciones.map(r => (
                          <span
                            key={r.faccion}
                            className={`text-[10px] font-cinzel px-1.5 py-0.5 rounded border ${COLOR[r.postura]}`}
                          >
                            {EMOJI[r.postura]} {r.faccion}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {fa.oculto && (
                      <p className="text-[11px] font-lora text-rose-700 dark:text-rose-300 m-0 leading-relaxed pt-0.5 border-t border-[var(--user-border)] mt-0.5">
                        🔒 <strong className="font-cinzel text-[11px]">Lo que no sabes:</strong> {fa.oculto}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'preparado' && (() => {
        const todas = memory.gm_preparado || [];
        const enPie = todas.filter(c => !c.usada);
        const usadas = todas.filter(c => c.usada);
        const EMOJI_TIPO: Record<string, string> = {
          escena: '🎬', encuentro: '⚔️', complicacion: '🌩️', revelacion: '💡', pnj: '🎭', otro: '🎴'
        };
        const Carta: React.FC<{ c: (typeof todas)[number]; hecha?: boolean }> = ({ c, hecha }) => (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
              hecha
                ? 'bg-[var(--surface-soft)] border-[var(--user-border)] opacity-65'
                : 'bg-[var(--surface-soft)] border-teal-500/30 hover:shadow-md'
            }`}
          >
            <span
              aria-hidden
              className={`text-3xl leading-none shrink-0 self-stretch flex items-center pr-3 border-r border-[var(--user-border)] ${
                hecha ? 'opacity-40 grayscale' : ''
              }`}
            >
              {EMOJI_TIPO[c.tipo || 'otro']}
            </span>
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <span
                className={`font-cinzel font-bold text-xs sm:text-sm break-words ${
                  hecha ? 'text-[var(--text-secondary)] line-through' : 'text-teal-700 dark:text-teal-300'
                }`}
              >
                {c.titulo}
              </span>
              {c.cuando && (
                <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">
                  ⏳ Encaja {c.cuando}
                </p>
              )}
              {c.detalle && (
                <p className="text-[11px] font-lora text-[var(--text-primary)] m-0 leading-relaxed whitespace-pre-wrap">
                  {c.detalle}
                </p>
              )}
              {c.hilo && (
                <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 self-start">
                  🧵 {c.hilo}
                </span>
              )}
            </div>
          </div>
        );
        return (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3 sm:p-4 flex flex-col gap-1.5">
              <span className="text-sm font-cinzel font-bold text-teal-700 dark:text-teal-300 flex items-center gap-2">
                🎴 Preparado
              </span>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] m-0 leading-relaxed">
                Lo que el Narrador tiene listo para cuando toque: una escena montada, un encuentro, una complicación
                guardada en la manga.{' '}
                <strong className="text-teal-700 dark:text-teal-300">Es lo que evita improvisar en caliente</strong>, que es cuando salen las cosas
                genéricas.
              </p>
            </div>
            {enPie.length === 0 && usadas.length === 0 ? (
              <div className="text-[var(--text-secondary)] italic py-6 px-5 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] leading-relaxed text-xs">
                Nada guardado todavía. Se llena cuando al Narrador se le ocurre algo bueno que en ese momento no
                encaja, en vez de forzarlo o perderlo.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {enPie.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {enPie.map(c => <Carta key={c.id} c={c} />)}
                  </div>
                )}
                {usadas.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
                      Ya jugadas ({usadas.length})
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {usadas.map(c => <Carta key={c.id} c={c} hecha />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'bambalinas' && (() => {
        /*
          LO QUE PASA MIENTRAS ELLA NO MIRA.

          El cuaderno del Director guardaba los giros —lo que se va a revelar—
          y nada más. Pero un mundo vivo no es una lista de sorpresas en un
          cajón: es gente con planes que avanza mientras la protagonista duerme
          en otra ciudad. Esto es el registro diario de eso, y el Narrador lo
          recibe en cada turno para no tener que improvisar qué ha hecho nadie.
        */
        const movs = [...(memory.gm_bambalinas || [])].sort((a, b) => b.diaAbs - a.diaAbs);
        const porDia = new Map<number, typeof movs>();
        for (const m of movs) {
          if (!porDia.has(m.diaAbs)) porDia.set(m.diaAbs, []);
          porDia.get(m.diaAbs)!.push(m);
        }
        return (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 sm:p-4 flex flex-col gap-1.5">
              <span className="text-sm font-cinzel font-bold text-violet-700 dark:text-violet-300 flex items-center gap-2">
                🕯️ Fuera de cámara
              </span>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] m-0 leading-relaxed">
                Lo que han hecho los demás mientras tu personaje no estaba delante: a dónde fueron, con quién
                hablaron y qué sacaron. Lo escribe el Narrador según pasan los días, y lo tiene delante en cada
                turno. <strong className="text-violet-700 dark:text-violet-300">Tu personaje no sabe nada de esto</strong> hasta que se entere jugando.
              </p>
            </div>

            {movs.length === 0 ? (
              <div className="text-[var(--text-secondary)] italic py-6 px-5 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] leading-relaxed text-xs flex flex-col gap-2">
                <span>
                  Todavía no hay nada apuntado. Se llena cuando pasa tiempo en la partida —un descanso largo, un
                  viaje, un salto— y alguien con algo entre manos se mueve.
                </span>
                <span className="not-italic font-cinzel text-[11px] text-violet-700 dark:text-violet-300">
                  ¿Quieres saber qué ha hecho alguien estos días? Pregúntaselo al GM en el Chat: «¿qué ha estado
                  haciendo Braelin desde que se fue?». Lo escribe él y queda aquí.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {[...porDia.entries()].map(([dia, delDia]) => (
                  <div key={dia} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-cinzel font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/25">
                        📅 {delDia[0].fecha || `Día ${dia}`}
                      </span>
                      <span className="h-px flex-1 bg-[var(--user-border)]" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {delDia.map(m => (
                        <div
                          key={m.id}
                          className="p-3.5 rounded-lg border bg-[var(--surface-soft)] border-violet-500/25 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-cinzel font-bold text-xs sm:text-sm break-words text-violet-700 dark:text-violet-300">
                              🎭 {m.quien}
                            </span>
                            <span
                              className={`text-[10px] font-cinzel px-1.5 py-0.5 rounded border ${
                                m.loSupo
                                  ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20'
                                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--glass-border)]'
                              }`}
                            >
                              {m.loSupo ? '✅ ya lo sabes' : '🔒 no lo sabes'}
                            </span>
                          </div>
                          <p className="text-xs font-lora text-[var(--text-primary)] m-0 leading-relaxed">{m.que}</p>
                          {(m.donde || m.conQuien) && (
                            <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">
                              {m.donde ? `📍 ${m.donde}` : ''}
                              {m.donde && m.conQuien ? ' · ' : ''}
                              {m.conQuien ? `🗣️ con ${m.conQuien}` : ''}
                            </p>
                          )}
                          {m.resultado && (
                            <p className="text-[11px] font-lora text-[var(--text-primary)] m-0 leading-relaxed">
                              <strong className="font-cinzel text-[11px] text-violet-700 dark:text-violet-300">
                                → Saca:
                              </strong>{' '}
                              {m.resultado}
                            </p>
                          )}
                          {m.hilo && (
                            <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 self-start">
                              🧵 {m.hilo}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'relojes' && (() => {
        /*
          Los relojes: lo que corre por detrás.

          Lo que convierte una amenaza en amenaza es que avance sola. Un
          enemigo que solo actúa cuando la protagonista le da pie no es un
          enemigo, es un decorado que reacciona.
        */
        const todos = memory.gm_relojes || [];
        const enMarcha = todos.filter(r => r.llenos < r.segmentos);
        const cumplidos = todos.filter(r => r.llenos >= r.segmentos);
        const Reloj: React.FC<{ r: (typeof todos)[number]; hecho?: boolean }> = ({ r, hecho }) => (
          <div
            className={`p-3.5 rounded-lg border flex flex-col gap-2 ${
              hecho
                ? 'bg-[var(--surface-soft)] border-[var(--user-border)] opacity-70'
                : r.llenos >= r.segmentos - 1
                ? 'bg-rose-500/5 border-rose-500/40'
                : 'bg-[var(--surface-soft)] border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span
                className={`font-cinzel font-bold text-xs sm:text-sm break-words ${
                  hecho ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--accent)]'
                }`}
              >
                {hecho ? '💥' : r.llenos >= r.segmentos - 1 ? '⏰' : '⏳'} {r.nombre}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-sm tracking-widest text-amber-600 dark:text-amber-400">
                {'●'.repeat(Math.min(r.llenos, r.segmentos))}
                <span className="text-[var(--text-secondary)] opacity-50">
                  {'○'.repeat(Math.max(0, r.segmentos - r.llenos))}
                </span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                {r.llenos}/{r.segmentos}
              </span>
              {r.loIntuye && (
                <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                  👁️ lo intuyes
                </span>
              )}
            </div>
            {r.deQuien && (
              <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">
                🎭 Lo mueve: {r.deQuien}
              </p>
            )}
            {r.alLlenarse && (
              <p className="text-[11px] font-lora text-[var(--text-primary)] m-0 leading-relaxed">
                <strong className="font-cinzel text-[11px] text-[var(--accent)]">Al llenarse:</strong> {r.alLlenarse}
              </p>
            )}
          </div>
        );
        return (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:p-4 flex flex-col gap-1.5">
              <span className="text-sm font-cinzel font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                ⏳ Relojes
              </span>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] m-0 leading-relaxed">
                Los planes que corren por detrás. Avanzan aunque tu personaje no esté delante, y cuando se llenan,
                pasa lo que tenga que pasar. <strong className="text-amber-700 dark:text-amber-300">Tampoco los ves en la ficción</strong> salvo que algo te lo dé a entender.
              </p>
            </div>
            {enMarcha.length === 0 && cumplidos.length === 0 ? (
              <div className="text-[var(--text-secondary)] italic py-6 px-5 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] leading-relaxed text-xs">
                Sin relojes en marcha. Aparecen cuando alguien empieza a tramar algo con un plazo: una búsqueda, una
                amenaza, una investigación ajena.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {enMarcha.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {enMarcha.map(r => (
                      <Reloj key={r.id} r={r} />
                    ))}
                  </div>
                )}
                {cumplidos.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold">
                      Ya se llenaron ({cumplidos.length})
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {cumplidos.map(r => (
                        <Reloj key={r.id} r={r} hecho />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'giros' && (
        <div className="flex flex-col gap-3">
          {/*
            Los giros pendientes, en una lista y no en un párrafo de texto libre.

            Aquí hubo un cuaderno de notas en blanco: servía para pensar, pero no
            distinguía lo que ya había salido de lo que faltaba, y nada le decía al
            Narrador que fuera secreto. Estos sí: le llegan con candado, y pasan a
            abiertos solos cuando se descubren jugando.
          */}
          {(() => {
            const secretos = memory.gm_secrets || [];
            const enPie = secretos.filter(x => !x.revelado);
            const abiertos = secretos.filter(x => x.revelado);
            return (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 sm:p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-cinzel text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" /> Giros de la campaña
                    {secretos.length > 0 && (
                      <span className="font-normal opacity-80">
                        · {enPie.length} en pie{abiertos.length ? ` · ${abiertos.length} ya descubierto${abiertos.length === 1 ? '' : 's'}` : ''}
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={async () => {
                      if (tramando) return;
                      const ideas = (window.prompt(
                        secretos.length
                          ? '¿Alguna idea que quieras que la IA incorpore al trazar la historia? (opcional)\n\nLo ya plantado se respeta y se coloca en la capa que le toque.'
                          : '¿Alguna idea de por dónde quieres que vaya la historia? (opcional)\n\nLa IA trazará las capas: lo que parece que pasa, lo que pasa de verdad, quién está detrás y por qué.'
                      ) ?? null);
                      if (ideas === null) return;
                      setTramando(true);
                      try {
                        const trama = await tramarLaCampana({
                          project,
                          files,
                          chats: project.chats || [],
                          ideas: ideas.trim() || undefined,
                          modo: memory.plan_de_campana?.premisa ? 'revisar' : 'trazar'
                        });
                        await onUpdateMemory(mem => ({
                          ...mem,
                          // La misma fusión que usa el repaso automático: lo ya
                          // descubierto y lo que plantaste tú no se tocan.
                          gm_secrets: fusionarTrama(mem.gm_secrets || [], trama),
                          plan_de_campana: {
                            premisa: trama.premisa || mem.plan_de_campana?.premisa || '',
                            destino: trama.destino || mem.plan_de_campana?.destino,
                            trazadoEl: new Date().toISOString()
                          }
                        }));
                      } catch (err: any) {
                        window.alert(err?.message || 'No se pudo trazar la historia. Inténtalo de nuevo.');
                      } finally {
                        setTramando(false);
                      }
                    }}
                    disabled={tramando}
                    className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-[11px] font-cinzel font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 shadow-xs"
                    title="Esto se hace solo al empezar la campaña y en cada repaso de memoria. Aquí puedes forzarlo ahora, y sobre todo darle ideas de por dónde quieres que vaya."
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${tramando ? 'animate-spin' : ''}`} />
                    {tramando ? 'Tramando…' : 'Darle ideas y repasar ahora'}
                  </button>
                  <button
                    onClick={async () => {
                      const titulo = (window.prompt('Título corto del giro (ej. «Los dueños del barco»)') || '').trim();
                      if (!titulo) return;
                      const secreto = (window.prompt('¿Cuál es la verdad? Esto NO se narrará hasta que se descubra jugando.') || '').trim();
                      if (!secreto) return;
                      const comoSeDescubre = (window.prompt('¿Por dónde puede salir? (opcional)') || '').trim();
                      await onUpdateMemory(mem => ({
                        ...mem,
                        gm_secrets: [
                          ...(mem.gm_secrets || []),
                          { id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, titulo, secreto, comoSeDescubre: comoSeDescubre || undefined, origen: 'jugadora' as const }
                        ]
                      }));
                    }}
                    className="min-h-[36px] px-2.5 rounded-lg border border-rose-500/50 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white text-[11px] font-cinzel font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Plantar un giro
                  </button>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed m-0">
                  La estructura de la historia, por capas: lo que parece que pasa, lo que pasa de verdad, quién está
                  detrás, y <strong>quién puede traer cada pieza a una escena y qué lo dispara</strong>. <strong>La traza la IA sola</strong> al empezar la campaña y la repasa en cada revisión de
                  memoria, a la luz de lo que hayas jugado. Le llega al Narrador con candado en cada turno: siembra las
                  pistas y hace que todo cuadre, pero tiene prohibido contarlo. Cuando algo salga jugando, se marca
                  solo. Tú puedes darle ideas aquí o hablando con el GM en su pestaña.
                </p>

                {memory.plan_de_campana?.premisa && (
                  <div className="rounded-lg border border-rose-500/30 bg-[var(--surface)] p-2.5">
                    <button
                      onClick={() => setVerPremisa(v => !v)}
                      className="w-full text-left font-cinzel text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2 cursor-pointer min-h-[28px]"
                    >
                      <span>{verPremisa ? 'De qué va la historia de verdad' : 'La historia está trazada'}</span>
                      <span className="text-[10px] font-normal shrink-0">{verPremisa ? 'Tapar' : 'Ver (te lo destripas)'}</span>
                    </button>
                    {verPremisa && (
                      <>
                        <p className="text-xs text-[var(--text-primary)] italic m-0 mt-1.5 whitespace-pre-wrap">{memory.plan_de_campana.premisa}</p>
                        {memory.plan_de_campana.destino && (
                          <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-1">Hacia dónde va: {memory.plan_de_campana.destino}</p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {secretos.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-secondary)] italic m-0">
                    Todavía nada. La IA la trazará sola en cuanto empieces a jugar la campaña, leyendo tus documentos.
                    Si quieres adelantarlo o decirle por dónde tirar, dale a <strong>Darle ideas y repasar ahora</strong>.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {secretos.map((sec, iSec) => {
                      const abierto = !!sec.revelado;
                      const visible = abierto || secretosDestapados.has(sec.id);
                      const indiceVisible = iSec + 1;
                      return (
                        <div
                          key={sec.id}
                          className={`rounded-lg border p-2.5 ${abierto ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-[var(--user-border)] bg-[var(--surface)]'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            {/*
                              El título TAMBIÉN es el spoiler.

                              Tapaba el contenido y dejaba los títulos a la
                              vista: «El falso rescate», «La verdadera
                              naturaleza de los grilletes». Con leer la lista ya
                              sabes de qué va la campaña, que es exactamente lo
                              que esto existía para evitar. Un giro en pie es un
                              número y su capa; el nombre se ve al destaparlo.
                            */}
                            <span className="font-cinzel text-xs font-bold text-[var(--text-primary)] min-w-0">
                              {abierto || visible ? (
                                <>
                                  {abierto ? '🔓' : '🔒'} {sec.titulo}
                                </>
                              ) : (
                                <span className="text-[var(--text-secondary)] font-normal italic">
                                  🔒 Giro {indiceVisible} · sin destapar
                                </span>
                              )}
                              {sec.capa ? (
                                <span
                                  className="ml-1.5 font-normal text-[10px] text-[var(--text-secondary)]"
                                  title="A qué capa de la cebolla pertenece. Las de abajo no se destapan antes que las de arriba."
                                >
                                  capa {sec.capa}
                                </span>
                              ) : null}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {abierto ? (
                                <span className="text-[10px] font-cinzel font-semibold text-emerald-700 dark:text-emerald-300">
                                  Descubierto{sec.revelado?.fecha ? ` · ${sec.revelado.fecha}` : ''}
                                </span>
                              ) : (
                                <button
                                  onClick={() =>
                                    setSecretosDestapados(prev => {
                                      const n = new Set(prev);
                                      n.has(sec.id) ? n.delete(sec.id) : n.add(sec.id);
                                      return n;
                                    })
                                  }
                                  className="min-h-[28px] px-2 rounded border border-[var(--user-border)] text-[10px] font-cinzel text-[var(--text-secondary)] hover:text-rose-600 hover:border-rose-500 cursor-pointer transition-colors"
                                  title="Solo lo lees tú. No cambia nada de la partida."
                                >
                                  {visible ? 'Tapar' : 'Ver (te lo destripas)'}
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  await onUpdateMemory(mem => ({
                                    ...mem,
                                    gm_secrets: (mem.gm_secrets || []).filter(x => x.id !== sec.id)
                                  }));
                                }}
                                className="min-h-[28px] px-1.5 rounded border border-[var(--user-border)] text-[var(--text-secondary)] hover:text-red-600 hover:border-red-500 cursor-pointer transition-colors"
                                title="Quitar este giro"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {abierto && sec.revelado?.como && (
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 m-0 mt-1">Se supo: {sec.revelado.como}</p>
                          )}
                          {visible ? (
                            <>
                              <p className="text-xs text-[var(--text-primary)] italic m-0 mt-1.5 whitespace-pre-wrap">{sec.secreto}</p>
                              {sec.sembrar && (
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 m-0 mt-1">
                                  🌱 Se va sembrando con: {sec.sembrar}
                                </p>
                              )}
                              {sec.quienLoTrae && (
                                <p className="text-[11px] text-sky-700 dark:text-sky-400 m-0 mt-1">
                                  🚪 Puede traerlo a escena: {sec.quienLoTrae}
                                </p>
                              )}
                              {sec.conecta?.length ? (
                                <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-1">
                                  Engancha con: {sec.conecta.join(' · ')}
                                </p>
                              ) : null}
                              {sec.abreCon && (
                                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 m-0 mt-1">
                                  🗝️ Lo abre lo que ella sabe: {sec.abreCon}
                                </p>
                              )}
                              {sec.siLoImpiden && (
                                <p className="text-[11px] text-rose-800 dark:text-rose-300 m-0 mt-1">
                                  ♟️ Si se lo impiden: {sec.siLoImpiden}
                                </p>
                              )}
                              {sec.comoSeDescubre && (
                                <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-1">
                                  Puede salir por: {sec.comoSeDescubre}
                                </p>
                              )}
                              {/*
                                Lo que tiene que cumplirse para que este giro
                                pueda destaparse. Va con su propio color porque
                                no es una sugerencia: la aplicación lo comprueba
                                en cada turno y le dice al Narrador si está
                                abierto o cerrado.
                              */}
                              {sec.condicion && (
                                <p className="text-[11px] text-amber-800 dark:text-amber-300 m-0 mt-1">
                                  ⏳ No se abre hasta:{' '}
                                  {[
                                    sec.condicion.nivelMinimo ? `nivel ${sec.condicion.nivelMinimo}` : '',
                                    sec.condicion.trasSecreto ? `que se destape «${sec.condicion.trasSecreto}»` : '',
                                    sec.condicion.misionCompletada ? `cerrar «${sec.condicion.misionCompletada}»` : '',
                                    sec.condicion.conPnj ? `haber conocido a ${sec.condicion.conPnj}` : '',
                                    sec.condicion.afinidadMinima
                                      ? `${
                                          sec.condicion.afinidadMinima.eje === 'atr'
                                            ? 'atracción'
                                            : sec.condicion.afinidadMinima.eje === 'vin'
                                              ? 'vínculo'
                                              : 'confianza'
                                        } ${sec.condicion.afinidadMinima.valor} con ${sec.condicion.afinidadMinima.pnj}`
                                      : '',
                                    sec.condicion.diaAbsMinimo ? `el día ${sec.condicion.diaAbsMinimo} de campaña` : '',
                                    sec.condicion.nota || ''
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-[11px] text-[var(--text-secondary)] italic m-0 mt-1">
                              Aún en pie. El Narrador lo tiene y no puede contarlo.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

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
                Se fichan solos al aparecer en escena. Solo viajan al Narrador los que ya están en la partida:
                el resto vive en tus documentos y se consulta desde ahí.
              </span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {(() => {
                /*
                  Cuántos hay que no ha conocido.

                  Se enseña la cifra en el propio botón porque si no, no hay
                  forma de saber que la lista está llena de gente que llegó por
                  una extracción y no por la partida.
                */
                const sinConocer = (memory.npcs || []).filter(
                  n =>
                    (n.diasVistos?.length || 0) === 0 &&
                    !n.recurrente &&
                    !n.portrait &&
                    typeof n.atr !== 'number' &&
                    typeof n.vin !== 'number' &&
                    typeof n.con !== 'number'
                ).length;
                if (sinConocer === 0) return null;
                return (
                  <button
                    onClick={limpiarElencoNoConocido}
                    className="min-h-[32px] px-2.5 text-xs font-cinzel rounded border border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 transition-all cursor-pointer font-semibold flex items-center gap-1.5 shadow-xs"
                    title="Quita las fichas de quien no ha salido nunca en la partida. Siguen en tus documentos y se ficharán solos cuando aparezcan."
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar {sinConocer} sin conocer
                  </button>
                );
              })()}
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
                          {/*
                            La atracción solo se enseña si la hay.
                            Un «ATR 0/20» en la tarjeta de la jefa de puerta o
                            del centinela que la desprecia no informa de nada:
                            sugiere que ahí hay un romance midiéndose. El
                            vínculo y la confianza sí valen para todos.
                          */}
                          {/* Si la puerta está cerrada se dice, porque si no la
                              ausencia de barra de atracción parece un dato que
                              todavía no se ha movido en vez de una decisión. */}
                          {n.atrBloqueada && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-soft)] text-[var(--text-secondary)] border border-[var(--user-border)] text-[10px] font-cinzel"
                              title={n.orientacion ? `Orientación / disponibilidad: ${n.orientacion}` : 'No desarrolla atracción por ella.'}
                            >
                              🚫❤️ Sin romance{n.orientacion ? ` · ${n.orientacion}` : ''}
                            </span>
                          )}
                          {!n.atrBloqueada && n.orientacion && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-soft)] text-[var(--text-secondary)] border border-[var(--user-border)] text-[10px] font-cinzel"
                              title="Orientación / disponibilidad, tal y como consta. Viaja al Narrador en cada turno."
                            >
                              {n.orientacion}
                            </span>
                          )}
                          {!n.atrBloqueada && (n.atr ?? 0) > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-mono font-bold"
                              title={`Atracción: ${getAtrInfo(n.atr).label}`}
                            >
                              <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" /> ATR {n.atr}/20
                            </span>
                          )}
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
                          {n.oculta && n.secretoRevelado ? (
                            <span
                              className="text-[10px] text-emerald-600 dark:text-emerald-400 font-cinzel flex items-center gap-0.5"
                              title={`Su secreto salió a la luz jugando${n.secretoRevelado.fecha ? ` el ${n.secretoRevelado.fecha}` : ''}. El Narrador ya cuenta con ello.`}
                            >
                              <Lock className="w-2.5 h-2.5" /> Descubierto
                            </span>
                          ) : n.oculta && !vinculosDestapados.has(n.id) ? (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-cinzel flex items-center gap-0.5" title="Guarda algo que tu personaje aún no sabe. Sale jugando.">
                              <Lock className="w-2.5 h-2.5" /> Secreto
                            </span>
                          ) : null}
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

                      {/*
                        Aquí estaban «Sin atracción» y «Quitar del elenco».

                        Los dos tocaban el cuaderno del Director con las manos, y
                        eso ahora se pide hablando: «Beniago no va a sentir nada
                        por ella, está casado» o «Aryendell no es un PNJ, quítala
                        del elenco» en el Chat con el GM. Lo hace él, lo dice, y
                        puede preguntar antes si algo no le cuadra.
                      */}
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

      {/* Tab: Inventario (la mochila del OC) */}
      {activeTab === 'inventario' && (() => {
        const todo = memory.player_character?.inventory || [];
        const monedas = memory.player_character?.currencies;

        /*
         * La separación que pidió la jugadora, y que es la que de verdad
         * importa: su violín, su diario y sus pociones son SUYOS y están ahí;
         * una carta que entregar o un pergamino que traducir son una tarea con
         * forma de objeto. Mezclarlos escondía el hilo entre las pociones.
         */
        /*
         * Y la tercera pila, que faltaba: lo que le han quitado.
         *
         * Una requisa vaciaba la mochila y punto. Pero sus cosas no dejan de
         * ser suyas porque se las guarde otro: están en algún sitio, alguien
         * las está mirando, y volverán. Verlas aquí es lo que evita que se
         * olviden — a ella y al Narrador.
         */
        /*
          UN EMOJI POR OBJETO, ADIVINADO DEL NOMBRE.
          Sin pedirle nada a la IA ni un campo más que rellenar: se mira lo que
          pone y se escoge. Si no cuadra nada, un fardo genérico y ya.
        */
        /*
          Los plurales, que es donde fallaba: `\bvara\b` no caza «Varas» ni
          `\bpocion\b` caza «Pociones», porque el límite de palabra cae dentro.
          Se cierra cada raíz con un plural opcional en vez de a mano.
        */
        const ICONOS: [string[], string][] = [
          [['violin', 'viol[ií]n', 'lira', 'arpa', 'la[uú]d', 'flauta', 'tambor', 'instrumento', 'c[ií]tara'], '🎻'],
          [['diario', 'cuaderno', 'libreta', 'bit[aá]cora', 'libro', 'tomo', 'grimorio', 'c[oó]dice'], '📓'],
          [['carta', 'misiva', 'nota', 'mensaje', 'sobre', 'pergamino', 'rollo', 'manuscrito', 'documento'], '📜'],
          [['mapa', 'plano', 'derrotero', 'carta de navegaci[oó]n'], '🗺️'],
          [['espada', 'sable', 'estoque', 'hoja', 'acero', 'cimitarra', 'mandoble'], '⚔️'],
          [['daga', 'pu[ñn]al', 'cuchillo', 'estilete', 'navaja'], '🗡️'],
          [['arco', 'ballesta', 'flecha', 'virote', 'carcaj'], '🏹'],
          [['escudo', 'broquel', 'rodela'], '🛡️'],
          [['armadura', 'coraza', 'cota', 'peto', 'casco', 'yelmo'], '🥋'],
          [['capa', 'manto', 'piwafwi', 'tabardo', 'ropa', 'vestido', 't[uú]nica', 'bota', 'guante'], '🧥'],
          [['poci[oó]n', 'elixir', 'brebaje', 'ampolla', 'vial', 'frasco', 'ant[ií]?doto'], '🧪'],
          [['hierba', 'planta', 'flor', 'semilla', 'ra[ií]z', 'baya', 'hongo', 'seta', 'mu[eé]rdago'], '🌿'],
          [['anillo', 'sortija', 'colgante', 'amuleto', 'medall[oó]n', 'joya', 'gema', 'collar', 'broche', 'pendiente', 'talism[aá]n'], '💍'],
          [['llave', 'ganz[uú]a', 'cerradura'], '🗝️'],
          [['moneda', 'monedero', 'oro', 'plata', 'tesoro', 'bolsa de monedas'], '💰'],
          [['vara', 'bast[oó]n', 'cetro', 'b[aá]culo', 'runa', '[oó]gham', 'ogham', 'talla'], '🪄'],
          [['vela', 'farol', 'l[aá]mpara', 'antorcha', 'linterna'], '🕯️'],
          [['comida', 'raci[oó]n', 'pan', 'queso', 'carne', 'provisi[oó]n', 'v[ií]ver'], '🍞'],
          [['agua', 'odre', 'cantimplora', 'vino', 'cerveza', 'licor', 'petaca'], '🍶'],
          [['cuerda', 'soga', 'garfio', 'saco', 'mochila', 'zurr[oó]n', 'morral', 'petate'], '🎒'],
          [['m[aá]scara', 'disfraz', 'antifaz', 'peluca'], '🎭'],
          [['espejo', 'cristal', 'lente', 'catalejo', 'orbe', 'esfera'], '🔮'],
          [['hueso', 'cr[aá]neo', 'calavera', 'reliquia', 'urna'], '💀'],
          [['concha', 'caracola', 'perla', 'coral', 'red', 'ancla', 'remo'], '🐚'],
          [['pluma', 'tinta', 'tintero', 'papel', 'c[aá]lamo'], '🪶'],
          [['sello', 'lacre', 'insignia', 'emblema', 'estandarte', 'bandera'], '🏅'],
          [['pipa', 'tabaco', 'incienso', 'perfume', 'aceite'], '🫗'],
          [['piel', 'pelaje', 'cuero', 'foca', 'lobo', 'garra', 'colmillo'], '🐾']
        ];
        const PATRONES: [RegExp, string][] = ICONOS.map(([raices, emoji]) => [
          new RegExp(`\\b(?:${raices.join('|')})(?:e?s)?\\b`, 'i'),
          emoji
        ]);
        const iconoDe = (item: InventoryItem): string => {
          const donde = `${item.name || ''} ${item.description || ''}`;
          for (const [patron, emoji] of PATRONES) if (patron.test(donde)) return emoji;
          return item.deMision ? '📌' : '📦';
        };

        const aprendido = memory.player_character?.aprendido || [];
        const ETIQUETA_APRENDIZAJE: Record<string, string> = {
          conjuro: 'conjuro',
          rasgo: 'rasgo',
          competencia: 'competencia',
          mejora: 'mejora',
          otro: 'otro'
        };

        const requisados = todo.filter(i => i.enPoderDe);
        const enSusManos = todo.filter(i => !i.enPoderDe);
        const deMision = enSusManos.filter(i => i.deMision && !i.resuelto);
        const resueltos = enSusManos.filter(i => i.deMision && i.resuelto);
        const propios = enSusManos.filter(i => !i.deMision);

        const Tarjeta: React.FC<{ item: InventoryItem; tono: 'mision' | 'propio' | 'hecho' | 'requisado' }> = ({ item, tono }) => (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 group transition-all hover:shadow-md ${
              tono === 'mision'
                ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60'
                : tono === 'requisado'
                ? 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/60'
                : tono === 'hecho'
                ? 'bg-[var(--surface-soft)] border-[var(--user-border)] opacity-70'
                : 'bg-[var(--surface-soft)] border-[var(--user-border)] hover:border-[var(--accent)]/40'
            }`}
          >
            {/*
              El emoji manda en su propia columna, como en el boceto: grande, a
              la izquierda y separado por una línea, para que la tarjeta se lea
              de un vistazo sin tener que leerla.
            */}
            <span
              aria-hidden
              className={`text-3xl sm:text-4xl leading-none shrink-0 self-stretch flex items-center pr-3 border-r ${
                tono === 'hecho' ? 'opacity-40 grayscale border-[var(--user-border)]' : 'border-[var(--user-border)]'
              }`}
            >
              {iconoDe(item)}
            </span>
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className={`font-cinzel font-bold text-xs sm:text-sm break-words ${tono === 'hecho' ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--accent)]'}`}>
                  {item.name}
                </span>
                {(item.quantity ?? 0) > 1 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                    ×{item.quantity}
                  </span>
                )}
                {item.equipped && (
                  <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                    equipado
                  </span>
                )}
                {item.durationNote && (
                  <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                    ⏳ {item.durationNote}
                  </span>
                )}
                {item.enPoderDe && (
                  <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                    lo tiene {item.enPoderDe}
                  </span>
                )}
              </div>
            </div>

            {item.encargo && (
              <p className="text-xs font-lora text-[var(--text-primary)] m-0 leading-relaxed">
                <strong className="font-cinzel text-[11px] text-[var(--accent)]">Hay que:</strong> {item.encargo}
              </p>
            )}
            {item.origen && (
              <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">
                De: {item.origen}
              </p>
            )}
            {item.dondeEsta && (
              <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">
                Está en: {item.dondeEsta}
              </p>
            )}
            {item.description && (
              <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>
            )}

            {/*
              Sin botones de editar ni de borrar, a propósito.

              La mochila la lleva el juego: lo que hay dentro entró jugando, y
              si algo está mal se le dice al Director en el Chat con el GM —él
              lo quita, lo cambia de sitio o lo marca por cumplido, y encima
              puede preguntar antes si le chirría—. Poder tacharlo aquí
              convertía la lista en una sugerencia.
            */}
            {item.mision && (
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {item.mision}
                </span>
              </div>
            )}
            </div>
          </div>
        );

        return (
          <div className="flex flex-col gap-5">
            {/*
              El monedero, de SOLO LECTURA.

              Es dinero de partida: lo lleva el juego, no la jugadora. Poder
              teclear el saldo convierte la cuenta en una sugerencia —y entonces
              da igual que el Narrador apunte lo que cuesta cada cosa—. Sube y
              baja con lo que se gana y se gasta EN ESCENA, y punto.
            */}
            <div className="bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)] flex items-center justify-between gap-3 flex-wrap">
              <span
                className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold flex items-center gap-1.5"
                title="Lo que lleva encima. Sube y baja sola con lo que gana y gasta jugando: no se teclea a mano."
              >
                <Coins className="w-3.5 h-3.5 text-[var(--accent)]" /> Bolsa
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  ['pp', 'PP', 'text-slate-500', '⚪'],
                  ['gp', 'PO', 'text-amber-600', '🟡'],
                  ['ep', 'PE', 'text-cyan-600', '🔵'],
                  ['sp', 'PA', 'text-zinc-500', '⚫'],
                  ['cp', 'PC', 'text-orange-700', '🟤']
                ] as ['cp' | 'sp' | 'ep' | 'gp' | 'pp', string, string, string][])
                  .filter(([k]) => (monedas?.[k] ?? 0) > 0)
                  .map(([k, etiqueta, color, ficha]) => (
                    <span
                      key={k}
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--glass-border)] ${color}`}
                    >
                      <span aria-hidden className="mr-0.5">{ficha}</span>
                      {monedas?.[k]} {etiqueta}
                    </span>
                  ))}
                {!monedas || Object.values(monedas).every(v => !v) ? (
                  <span className="text-[11px] font-lora italic text-[var(--text-secondary)]">Sin blanca.</span>
                ) : null}
              </div>
            </div>

            {/*
              Aquí había un formulario para meter objetos a mano, y se ha
              quitado a propósito: al Director no se le abre el cuaderno. Si
              falta el violín en la lista, se le dice en el Chat con el GM y lo
              mete él, que además puede preguntar de dónde ha salido.
            */}
            {/* Objetos de misión */}
            <div className="flex flex-col gap-2.5">
              <div className="bg-[var(--sidebar-bg)] p-3 rounded-lg border border-amber-500/30">
                <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold flex items-center gap-1.5">
                  <Scroll className="w-3.5 h-3.5 text-amber-600" />
                  Lo que lleva por encargo ({deMision.length})
                </span>
                <p className="text-[11px] text-[var(--text-secondary)] opacity-80 m-0 mt-0.5 leading-relaxed">
                  Una carta que entregar, un pergamino que traducir, algo que ha tenido que robar. No es equipo: es
                  trama con forma de objeto, y por eso va aparte.
                </p>
              </div>
              {deMision.length === 0 ? (
                <div className="text-[var(--text-secondary)] italic py-5 px-5 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] leading-relaxed text-xs">
                  Ahora mismo no lleva nada por encargo de nadie.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {deMision.map(i => <Tarjeta key={i.id} item={i} tono="mision" />)}
                </div>
              )}
            </div>

            {/* Sus cosas */}
            <div className="flex flex-col gap-2.5">
              <div className="bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
                <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold flex items-center gap-1.5">
                  <Backpack className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Sus cosas ({propios.length})
                </span>
                <p className="text-[11px] text-[var(--text-secondary)] opacity-80 m-0 mt-0.5 leading-relaxed">
                  Su violín, su diario, las pociones, lo que ha comprado. Lo que es suyo y no le debe nada a nadie.
                </p>
              </div>
              {propios.length === 0 ? (
                <div className="text-[var(--text-secondary)] py-5 px-5 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] leading-relaxed text-xs flex flex-col gap-2">
                  {/*
                    Un vacío que explica por qué está vacío y qué hacer.
                    La lista se llena sola con lo que el Narrador vaya apuntando
                    en sus turnos, así que al estrenarla está vacía aunque la
                    campaña lleve meses — y sin decirlo parece que no funciona.
                  */}
                  <span className="italic">
                    Aquí aparece lo que gane, compre o le den <strong>jugando</strong>, según lo vaya apuntando el
                    Narrador. Si la campaña es anterior a esta pantalla, estará vacía hasta el próximo botín.
                  </span>
                  <span className="not-italic font-cinzel text-[11px] text-[var(--accent)]">
                    ¿Empiezas campaña? En la pestaña <strong>Personaje</strong>, el botón «Rellenar leyendo mi ficha
                    subida» saca de tu ficha lo que llevas encima y lo mete aquí de una vez. Es lo que el Narrador lee
                    en cada turno, así que conviene hacerlo antes de la primera escena.
                  </span>
                  <span className="not-italic font-lora text-[11px] text-[var(--text-secondary)]">
                    Y si falta algo suelto, pídeselo al GM en el Chat: «mete en mi mochila el violín del Filí y mi
                    diario, que ya los llevaba». Lo hace él.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {propios.map(i => <Tarjeta key={i.id} item={i} tono="propio" />)}
                </div>
              )}
            </div>

            {/*
              Lo aprendido jugando: el hueco más silencioso que tenía la app.

              La ficha se sube una vez y se queda congelada en el nivel de aquel
              día. La aplicación llevaba el NÚMERO de nivel y nada más, así que
              los conjuros, rasgos y competencias ganados subiendo no constaban
              en ningún sitio: un personaje de nivel 5 jugando con la lista del
              3 sin que nadie se entere.
            */}
            {aprendido.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="bg-[var(--sidebar-bg)] p-3 rounded-lg border border-sky-500/30">
                  <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                    Lo que ha aprendido jugando ({aprendido.length})
                  </span>
                  <p className="text-[11px] text-[var(--text-secondary)] opacity-80 m-0 mt-0.5 leading-relaxed">
                    Conjuros, rasgos, competencias y mejoras ganados desde que subiste la ficha. Tu ficha se quedó
                    congelada en el nivel que tuviera aquel día; esto es lo de después, y el Narrador lo tiene delante
                    en cada turno.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {aprendido.map(a => (
                    <div
                      key={a.id}
                      className="p-3.5 rounded-lg border bg-[var(--surface-soft)] border-sky-500/25 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-cinzel font-bold text-xs sm:text-sm break-words text-sky-700 dark:text-sky-300">
                          {a.name}
                        </span>
                        <span className="text-[10px] font-cinzel px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                          {ETIQUETA_APRENDIZAJE[a.tipo] || 'otro'}
                        </span>
                        {a.nivel && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                            nivel {a.nivel}
                          </span>
                        )}
                      </div>
                      {a.notas && (
                        <p className="text-[11px] font-lora text-[var(--text-secondary)] m-0 leading-relaxed">
                          {a.notas}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lo que le han quitado: sigue siendo suyo, y alguien lo tiene */}
            {requisados.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="bg-[var(--sidebar-bg)] p-3 rounded-lg border border-rose-500/30">
                  <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold flex items-center gap-1.5">
                    <PackageX className="w-3.5 h-3.5 text-rose-600" />
                    Lo que le han quitado ({requisados.length})
                  </span>
                  <p className="text-[11px] text-[var(--text-secondary)] opacity-80 m-0 mt-0.5 leading-relaxed">
                    Requisado, robado o dejado en prenda. Sigue siendo suyo: no está en su mochila, pero está en algún
                    sitio y alguien lo guarda. El Narrador lo ve y sabe quién lo tiene.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {requisados.map(i => <Tarjeta key={i.id} item={i} tono="requisado" />)}
                </div>
              </div>
            )}

            {/* Lo ya resuelto: no se borra, porque cuenta lo que pasó */}
            {resueltos.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="bg-[var(--sidebar-bg)] p-3 rounded-lg border border-[var(--user-border)]">
                  <span className="text-xs text-[var(--text-secondary)] font-cinzel font-semibold flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    Encargos cerrados ({resueltos.length})
                  </span>
                  <p className="text-[11px] text-[var(--text-secondary)] opacity-80 m-0 mt-0.5 leading-relaxed">
                    Ya entregado, traducido o devuelto. Se queda aquí porque sigue contando lo que pasó.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {resueltos.map(i => <Tarjeta key={i.id} item={i} tono="hecho" />)}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Confirmación de «esto no es un PNJ» */}

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

