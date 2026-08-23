import { useState, useEffect, useRef, Suspense } from 'react';
import {
  BookOpen,
  FolderSync,
  Menu,
  Moon,
  Paperclip,
  Plus,
  Scroll,
  ScrollText,
  Sliders,
  Smartphone,
  Sun,
  Swords,
  Trash2,
  TriangleAlert,
  Upload,
  X
} from 'lucide-react';
import {
  Project,
  Chat,
  Message,
  ProjectFile,
  FileCategory,
  MapMarker,
  VisualMemoryItem,
  NPC,
  ScheduledThread
} from './types';
import { ChatView } from './components/ChatView';
import { ContextUsageWidget } from './components/ContextUsageWidget';
import { CombatHud } from './components/CombatHud';
import { Modals, PromptConfig, ConfirmConfig, AlertConfig, ApiKeyModal } from './components/Modals';

import { MemoryManager } from './components/MemoryManager';
import { FilesView } from './components/FilesView';
import { InstructionsView } from './components/InstructionsView';
import { NovelReaderView } from './components/NovelReaderView';
import { MapViewer } from './components/MapViewer';
import { CalendarView } from './components/CalendarView';
import { InstallAppModal } from './components/InstallAppModal';
import { LocalStorageModal } from './components/LocalStorageModal';
import { ImportCampaignModal } from './components/ImportCampaignModal';
import { ExtractedCampaignResult } from './utils/campaignImporter';
import { writeCampaignToDisk } from './utils/diskBackup';
import {
  saveFilesToDB,
  loadFilesFromDB,
  deleteProjectFilesFromDB,
  saveProjectsToDB,
  loadProjectsFromDB,
  saveChatsToDB,
  loadChatsFromDB,
  cleanupLocalStorageQuota,
  sanitizeProjectsForLocalStorage,
  optimizeImageFile,
  requestPersistentStorage,
  getStorageEstimate
} from './utils/fileStorage';
import {
  generateStoryTurnStream,
  TiempoReportado,
  syncMemoryFromChats,
  syncMemoryDeltaIncremental,
  analyzeUploadedImage,
  extractPlayerCharacterFromDocument,
  extractCompanionFromDocument,
  extractNpcFromDocument,
  describeApiError,
  destilarTablaOraculo,
  looksLikePlayerSheet,
  looksLikeCompanionSheet,
  looksLikeNpcSheet,
  classifyFileAuto,
  getStoredApiKey,
  setStoredApiKey,
  setStoredApiKeys,
  hasConfiguredApiKey,
  getStoredModel,
  setStoredModel,
  setStoredBackgroundModel,
  setStoredSafetyLevel,
  setStoredThinkingLevel,
  setStoredTemperature,
  setStoredTopP,
  setStoredAutoFailover,
  setStoredKeyRotationMode,
  getStoredMemorySyncGranularity,
  setStoredMemorySyncGranularity
} from './utils/geminiHelper';
import { applyInventoryReport, expireTemporaryItems } from './utils/inventoryParser';
import { DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE } from './utils/defaultDirectives';
import { RollRequest, rollDie, formatRollResult } from './utils/rollRequests';
import { Probabilidad, formatoConsulta, formatoSignificado, nuevaConsulta } from './utils/oracle';
import {
  aDiaAbsoluto,
  avanzar,
  calendarioValido,
  DIAS_PARA_SER_RECURRENTE,
  desdeDiaAbsoluto,
  fechaCompleta,
  fechaLegible,
  obtenerInfoRelacion
} from './utils/campaignCalendar';
import { actualizarAfinidadNpc } from './utils/affinityProgression';

const ViewLoader = () => (
  <div className="flex-1 flex items-center justify-center p-10 text-[var(--text-secondary)] font-cinzel text-sm italic gap-2">
    <span className="inline-block w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    Desplegando pergaminos...
  </div>
);

const LOCAL_PROJECTS_KEY = 'gmstudio_local_projects';
const LOCAL_CHATS_PREFIX = 'gmstudio_local_chats_';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentPId, setCurrentPId] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentChats, setCurrentChats] = useState<Chat[]>([]);
  const [currentFiles, setCurrentFiles] = useState<ProjectFile[]>([]);

  const [activeTab, setActiveTab] = useState<
    'chat' | 'novel' | 'instructions' | 'files' | 'memory' | 'calendar'
  >('chat');
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  // Controlador de la generación en curso, para poder detenerla desde la interfaz.
  const generationAbortRef = useRef<AbortController | null>(null);
  // Un turno de narración NO bloquea la pantalla: hay que poder leer cómo se
  // escribe. El velo se reserva para tareas que sí impiden seguir (subidas,
  // sincronización de memoria, exportar a PDF).
  const [isStreamingTurn, setIsStreamingTurn] = useState(false);
  // Indicador sutil de sincronización de memoria en segundo plano sin congelar la app
  const [isBackgroundSyncingMemory, setIsBackgroundSyncingMemory] = useState(false);
  // IDs de archivos que están siendo procesados / extraídos en segundo plano
  const [extractingFileIds, setExtractingFileIds] = useState<string[]>([]);

  // Tema. Se aplica en <html> para que las variables de color valgan para todo.
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('gmstudio_theme') as 'light' | 'dark') || 'light'
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('gmstudio_theme', theme);
  }, [theme]);
  const [loadingText, setLoadingText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedMapFile, setSelectedMapFile] = useState<ProjectFile | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Modals state
  const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isLocalStorageModalOpen, setIsLocalStorageModalOpen] = useState(false);
  const [isImportCampaignModalOpen, setIsImportCampaignModalOpen] = useState(false);
  const [topProgress, setTopProgress] = useState<{
    active: boolean;
    percent?: number;
    label?: string;
    type?: 'upload' | 'sync' | 'analysis' | 'general';
  }>({ active: false });
  const turnsSinceSyncRef = useRef<number>(0);

  // Protección del almacenamiento: sin esto el navegador puede borrar la campaña
  // por su cuenta cuando anda justo de espacio.
  const [storageWarning, setStorageWarning] = useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { persisted, supported } = await requestPersistentStorage();
      const estimate = await getStorageEstimate();
      if (cancelled) return;

      const nearlyFull = estimate && estimate.quota > 0 && estimate.usage / estimate.quota > 0.8;
      if (nearlyFull) {
        setStorageWarning(
          'Te queda poco espacio de almacenamiento en el navegador. Exporta la campaña a JSON desde el menú lateral antes de seguir subiendo imágenes.'
        );
      } else if (supported && !persisted) {
        setStorageWarning(
          'El navegador no ha garantizado el almacenamiento de esta app, así que podría borrar la campaña si se queda sin espacio. Instálala como aplicación, o exporta tu campaña a JSON de vez en cuando.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // PWA Install Event Listener & Responsive Initializer
  useEffect(() => {
    // Auto-close sidebar on mobile initially
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Local storage & IndexedDB helpers
  const getLocalProjects = (): Project[] => {
    try {
      const data = localStorage.getItem(LOCAL_PROJECTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  };

  const saveLocalProjects = (projs: Project[]) => {
    // 1. Always save full project data (including all fields) to IndexedDB
    saveProjectsToDB(projs).catch(err =>
      console.error('No se pudieron guardar los tomos en IndexedDB:', err)
    );

    // 2. Save lightweight sanitized version to localStorage
    try {
      const sanitized = sanitizeProjectsForLocalStorage(projs);
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('LocalStorage quota warning (saved safely in IndexedDB):', e);
      // In case of quota limit, purge any obsolete cache keys
      cleanupLocalStorageQuota();
    }
  };

  const getLocalChats = (pId: string): Chat[] => {
    try {
      const data = localStorage.getItem(`${LOCAL_CHATS_PREFIX}${pId}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  };

  const saveLocalChats = (pId: string, chs: Chat[]) => {
    // 1. Save to IndexedDB
    saveChatsToDB(pId, chs).catch(err =>
      console.error('No se pudieron guardar los capítulos en IndexedDB:', err)
    );

    // 2. Save to localStorage
    try {
      localStorage.setItem(`${LOCAL_CHATS_PREFIX}${pId}`, JSON.stringify(chs));
    } catch (e) {
      console.warn('LocalStorage quota warning for chats (saved in IndexedDB):', e);
      cleanupLocalStorageQuota();
    }
  };

  // 1. Initial Load of Projects on Mount (IndexedDB + localStorage fallback)
  useEffect(() => {
    cleanupLocalStorageQuota();

    const initProjects = async () => {
      // Try loading from IndexedDB first
      let dbProjects = await loadProjectsFromDB();
      let projs = dbProjects && dbProjects.length > 0 ? dbProjects : getLocalProjects();

      if (!projs || projs.length === 0) {
        const defaultProjId = 'tomo_' + Date.now();
        const starterProject: Project = {
          id: defaultProjId,
          name: 'Nueva Campaña',
          instructions: DEFAULT_DM_INSTRUCTIONS,
          system: DEFAULT_SYSTEM,
          style: DEFAULT_STYLE,
          memory: {
            story: '',
            quests: [],
            npcs: [],
            locations: [],
            current_status: '',
            manual_notes: ''
          },
          chats: [],
          files: []
        };

        projs = [starterProject];
        saveLocalProjects(projs);

        const defaultChatId = 'cap_' + Date.now();
        const starterChat: Chat = {
          id: defaultChatId,
          name: 'Capítulo I: El Comienzo',
          messages: []
        };
        saveLocalChats(defaultProjId, [starterChat]);
      } else {
        // Sanitize legacy starter placeholder content if detected from previous versions
        let modified = false;
        projs = projs.map(p => {
          const hasLegacyDummy =
            p.name === 'Crónica del Destino' ||
            p.memory?.npcs?.some(n => n.name === 'Eldrin el Sabio') ||
            p.memory?.locations?.some(l => l.name === 'La Posada del Cuervo Gris') ||
            p.memory?.quests?.some(q => q.title === 'El Misterio del Tomo Ancestral');

          if (hasLegacyDummy) {
            modified = true;
            // Clean legacy dummy chats for this project as well
            const existingChats = getLocalChats(p.id);
            const cleanedChats = existingChats.map(c => ({
              ...c,
              messages: c.messages.filter(
                m => !m.content.includes('Posada del Cuervo Gris') && !m.content.includes('Eldrin el Sabio')
              )
            }));
            saveLocalChats(p.id, cleanedChats);

            return {
              ...p,
              name: p.name === 'Crónica del Destino' ? 'Nueva Campaña' : p.name,
              memory: {
                ...p.memory,
                story: p.memory?.story?.includes('Posada del Cuervo Gris') ? '' : p.memory?.story || '',
                current_status: p.memory?.current_status?.includes('Posada')
                  ? ''
                  : p.memory?.current_status || '',
                quests: (p.memory?.quests || []).filter(q => q.title !== 'El Misterio del Tomo Ancestral'),
                npcs: (p.memory?.npcs || []).filter(n => n.name !== 'Eldrin el Sabio'),
                locations: (p.memory?.locations || []).filter(l => l.name !== 'La Posada del Cuervo Gris'),
                manual_notes: p.memory?.manual_notes?.includes('Posada') ? '' : p.memory?.manual_notes || ''
              }
            };
          }
          return p;
        });

        if (modified) {
          saveLocalProjects(projs);
        }
      }

      setProjects(projs);
      if (projs.length > 0) {
        setCurrentPId(projs[0].id);
      }
    };

    initProjects();
  }, []);

  // 2. Load Chats whenever currentPId changes (IndexedDB + localStorage)
  useEffect(() => {
    if (!currentPId) {
      setCurrentChats([]);
      setCurrentChatId(null);
      return;
    }

    let isCancelled = false;
    const fetchChats = async () => {
      const dbChats = await loadChatsFromDB(currentPId);
      let chs = dbChats && dbChats.length > 0 ? dbChats : getLocalChats(currentPId);

      if (chs.length === 0) {
        const defaultChatId = 'cap_' + Date.now();
        chs = [
          {
            id: defaultChatId,
            name: 'Capítulo I: El Comienzo',
            messages: []
          }
        ];
        saveLocalChats(currentPId, chs);
      }

      if (!isCancelled) {
        chs.sort((a, b) => a.id.localeCompare(b.id));
        setCurrentChats(chs);
        if (chs.length > 0 && (!currentChatId || !chs.some(c => c.id === currentChatId))) {
          setCurrentChatId(chs[0].id);
        }
      }
    };

    fetchChats();
    return () => {
      isCancelled = true;
    };
  }, [currentPId]);

  // 3. Load Files whenever currentPId changes
  useEffect(() => {
    if (!currentPId) {
      setCurrentFiles([]);
      return;
    }
    let isCancelled = false;
    loadFilesFromDB(currentPId).then(fls => {
      if (!isCancelled) {
        setCurrentFiles(fls);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [currentPId]);

  const currentProject = projects.find(p => p.id === currentPId);
  const currentChat = currentChats.find(c => c.id === currentChatId);

  // Sync selectedMapFile with live data
  useEffect(() => {
    if (selectedMapFile) {
      const updated = currentFiles.find(f => f.id === selectedMapFile.id);
      if (updated) setSelectedMapFile(updated);
    }
  }, [currentFiles]);

  // Project Management
  const handleCreateProject = () => {
    setPromptValue('');
    setPromptConfig({
      isOpen: true,
      title: 'Nuevo Tomo / Campaña',
      defaultValue: '',
      onConfirm: name => {
        if (!name.trim()) return;
        const newProjId = 'tomo_' + Date.now();
        const newProj: Project = {
          id: newProjId,
          name: name.trim(),
          instructions: DEFAULT_DM_INSTRUCTIONS,
          system: DEFAULT_SYSTEM,
          style: DEFAULT_STYLE,
          memory: {
            story: '',
            quests: [],
            npcs: [],
            locations: [],
            current_status: '',
            manual_notes: ''
          },
          chats: [],
          files: []
        };

        const updated = [...projects, newProj];
        setProjects(updated);
        saveLocalProjects(updated);

        const firstChatId = 'cap_' + Date.now();
        const firstChat: Chat = {
          id: firstChatId,
          name: 'Capítulo I: El Comienzo',
          messages: []
        };
        saveLocalChats(newProjId, [firstChat]);
        setCurrentPId(newProjId);
        setCurrentChatId(firstChatId);
      }
    });
  };

  const handleDeleteProject = (projectId: string) => {
    setConfirmConfig({
      isOpen: true,
      message: '¿Estás seguro de que deseas eliminar este Tomo y todos sus capítulos y archivos?',
      onConfirm: async () => {
        const remaining = projects.filter(p => p.id !== projectId);
        setProjects(remaining);
        saveLocalProjects(remaining);
        localStorage.removeItem(`${LOCAL_CHATS_PREFIX}${projectId}`);
        await deleteProjectFilesFromDB(projectId);

        if (currentPId === projectId) {
          if (remaining.length > 0) {
            setCurrentPId(remaining[0].id);
          } else {
            setCurrentPId(null);
            setCurrentChatId(null);
          }
        }
      }
    });
  };

  /**
   * El Narrador acaba de decir cuánto tiempo ha pasado y qué queda en marcha.
   *
   * El orden importa. Primero se dan por servidos los hilos que ya viajaban en el
   * prompt de ESTE turno —si se marcaran antes de generar y la petición fallase,
   * se perderían sin haber ocurrido—; luego avanza el reloj; y solo entonces se
   * programan los hilos nuevos, cuyo plazo cuenta desde la hora nueva, no la vieja.
   */
  // El reporte del turno, accesible desde el actualizador sin tener que pasarlo
  // por parámetro a través de dos capas.
  const reporteActual = useRef<TiempoReportado | null>(null);

  const handleTimeReported = async (t: TiempoReportado, msgInfo?: { msgId?: string; msgIndex?: number }) => {
    reporteActual.current = t;
    await handleUpdateProjectField(p => {
      const cal = p.calendar;
      const fecha = p.currentDate;

      // Los vínculos no dependen del calendario: quien vuelve, vuelve, se lleve
      // la cuenta de los días o no. Se actualizan aunque el reloj esté apagado.
      if (!calendarioValido(cal) || !fecha) {
        let mem = conVinculos(p, 0);
        if (t.minutos > 0 && mem?.player_character?.inventory?.length) {
          const { updatedInventory } = expireTemporaryItems(mem.player_character.inventory, t.minutos);
          mem = {
            ...mem,
            player_character: {
              ...mem.player_character,
              inventory: updatedInventory
            }
          };
        }
        return { memory: mem };
      }

      const hoyAbs = aDiaAbsoluto(cal, fecha);

      let threads: ScheduledThread[] = (p.threads || []).map(h =>
        h.status === 'pending' && h.dueAbsDay <= hoyAbs ? { ...h, status: 'fired' as const } : h
      );

      const nuevaFecha = t.minutos > 0 ? avanzar(cal, fecha, { minutos: t.minutos }) : fecha;
      const nuevoAbs = aDiaAbsoluto(cal, nuevaFecha);
      const diasDeDiferencia = nuevoAbs - hoyAbs;

      if (t.hilos.length) {
        threads = [
          ...threads,
          ...t.hilos.map((h, i) => {
            const vence = nuevoAbs + h.dueInDays;
            return {
              id: `hilo_${nuevoAbs}_${threads.length + i}_${Math.random().toString(36).slice(2, 7)}`,
              title: h.title,
              effect: h.effect,
              dueAbsDay: vence,
              dueDate: fechaLegible(cal, desdeDiaAbsoluto(cal, vence)),
              hidden: h.hidden,
              status: 'pending' as const,
              origin: 'narrador' as const
            };
          })
        ];
      }

      const timeline = [
        ...(p.timeline || []),
        ...t.agenda.map((entrada, i) => {
          const entryAbsDay =
            entrada.diaOffset !== undefined
              ? Math.max(hoyAbs, Math.min(nuevoAbs, hoyAbs + entrada.diaOffset))
              : hoyAbs;
          const entryFecha =
            entryAbsDay === hoyAbs
              ? fecha
              : entryAbsDay === nuevoAbs
              ? nuevaFecha
              : desdeDiaAbsoluto(cal, entryAbsDay);

          return {
            id: `dia_${entryAbsDay}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            absDay: entryAbsDay,
            date: fechaLegible(cal, entryFecha),
            summary: entrada.resumen,
            lugar: entrada.lugar,
            clima: entrada.clima,
            hito: entrada.hito,
            minute: entryAbsDay === hoyAbs ? fecha.minute : 720,
            tipo: entrada.tipo,
            timeSkipDays: diasDeDiferencia >= 2 ? diasDeDiferencia : undefined,
            chatId: currentChatId || undefined,
            msgId: msgInfo?.msgId,
            msgIndex: msgInfo?.msgIndex
          };
        })
      ].slice(-500);

      let mem = conVinculos(p, hoyAbs);
      if (t.minutos > 0 && mem?.player_character?.inventory?.length) {
        const { updatedInventory } = expireTemporaryItems(mem.player_character.inventory, t.minutos);
        mem = {
          ...mem,
          player_character: {
            ...mem.player_character,
            inventory: updatedInventory
          }
        };
      }

      return { currentDate: nuevaFecha, threads, timeline, memory: mem };
    });
  };

  /**
   * Apunta quién ha estado en escena y actualiza los vínculos.
   *
   * El ascenso de figurante a personaje con ficha no lo decide cuánto habla
   * alguien, sino cuántas veces vuelve: se guardan los días distintos en que se
   * le ha visto y al tercero deja de ser un extra. Es lo que separa al tabernero
   * de turno de alguien con quien te tomas una copa cada tarde.
   */
  const conVinculos = (p: Project, diaActual: number): Project['memory'] => {
    const t = reporteActual.current;
    if (!t || (!t.presentes.length && !t.vinculos.length)) return p.memory;

    const mem = p.memory || {
      story: '',
      quests: [],
      npcs: [],
      locations: [],
      current_status: '',
      manual_notes: ''
    };

    // Sin calendario no hay días, así que se cuenta por escenas narradas: da la
    // misma progresión —hace falta volver— sin depender de que lleves el tiempo.
    const marca = calendarioValido(p.calendar)
      ? diaActual
      : currentChats.reduce((a, c) => a + (c.messages || []).length, 0);

    const igual = (a: string, b: string) =>
      a.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() ===
      b.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

    const npcs = (mem.npcs || []).map(n => {
      let cambiado = n;
      const presenteHoy = t.presentes.some(nombre => igual(nombre, n.name));
      const dias = presenteHoy
        ? [...new Set([...(n.diasVistos || []), marca])]
        : (n.diasVistos || []);

      if (presenteHoy) {
        cambiado = {
          ...cambiado,
          diasVistos: dias.slice(-40),
          recurrente: n.recurrente || dias.length >= DIAS_PARA_SER_RECURRENTE
        };
      }

      const v = t.vinculos.find(x => igual(x.nombre, n.name));
      if (v) {
        let newRelation = cambiado.relation;
        if (v.vinculo) {
          const relInfo = obtenerInfoRelacion(v.vinculo);
          // Si la relación actual es genérica o vacía, adoptar la inferida del vínculo
          if (!newRelation || /aliado|neutral|desconocido|contacto/i.test(newRelation)) {
            newRelation = `${relInfo.icono} ${relInfo.label}`;
          }
        }

        // Lógica de progresión escalonada (1-20 / 5 corazones) con límite diario de subidas
        const afinidadActualizada = actualizarAfinidadNpc(cambiado, v, dias, marca);

        cambiado = {
          ...cambiado,
          relation: newRelation,
          aparenta: v.aparenta ?? cambiado.aparenta,
          oculta: v.oculta ?? cambiado.oculta,
          vinculo: v.vinculo ?? cambiado.vinculo,
          ...afinidadActualizada,
          // Que el Narrador se moleste en escribir un vínculo ya dice que este
          // personaje cuenta, aunque la cuenta de días aún no haya llegado.
          recurrente: true
        };
      }

      return cambiado;
    });

    // Si hay un vínculo nuevo para un PNJ que aún no figuraba en la lista, registrarlo automáticamente
    const nuevosNpcs: NPC[] = [];
    t.vinculos.forEach(v => {
      if (v.nombre && !npcs.some(n => igual(n.name, v.nombre)) && !nuevosNpcs.some(n => igual(n.name, v.nombre))) {
        const relInfo = obtenerInfoRelacion(v.vinculo || '');
        const atrInicial = v.atr !== undefined ? Math.max(0, Math.min(20, Math.round(v.atr))) : undefined;
        const vinInicial = v.vin !== undefined ? Math.max(0, Math.min(20, Math.round(v.vin))) : undefined;
        const conInicial = v.con !== undefined ? Math.max(0, Math.min(20, Math.round(v.con))) : undefined;

        nuevosNpcs.push({
          id: `npc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: v.nombre,
          relation: `${relInfo.icono} ${relInfo.label}`,
          status: 'Vivo',
          description: v.aparenta ? `Aparenta: ${v.aparenta}` : undefined,
          notes: v.oculta ? `Oculta: ${v.oculta}` : 'Vínculo establecido durante la narración.',
          aparenta: v.aparenta,
          oculta: v.oculta,
          vinculo: v.vinculo,
          atr: atrInicial,
          vin: vinInicial,
          con: conInicial,
          ultimoDiaSubida: {
            atr: atrInicial !== undefined ? marca : undefined,
            vin: vinInicial !== undefined ? marca : undefined,
            con: conInicial !== undefined ? marca : undefined
          },
          recurrente: true,
          diasVistos: [marca]
        });
      }
    });

    return { ...mem, npcs: [...npcs, ...nuevosNpcs] };
  };

  const handleUpdateProjectField = async (
    fields: Partial<Project> | ((prev: Project) => Partial<Project>)
  ) => {
    if (!currentPId) return;
    setProjects(prev => {
      const updated = prev.map(p =>
        p.id === currentPId ? { ...p, ...(typeof fields === 'function' ? fields(p) : fields) } : p
      );
      saveLocalProjects(updated);
      return updated;
    });
  };

  const handleUpdateMemory = async (updater: (prev: Project['memory']) => Project['memory']) => {
    if (!currentProject || !currentPId) return;
    await handleUpdateProjectField(p => ({
      memory: updater(
        p.memory || {
          story: '',
          quests: [],
          npcs: [],
          locations: [],
          current_status: '',
          manual_notes: ''
        }
      )
    }));
  };

  // Chapter / Chat Management
  const handleCreateChat = () => {
    if (!currentPId) return;
    const newChatId = 'cap_' + Date.now();
    const newChat: Chat = {
      id: newChatId,
      name: `Capítulo ${currentChats.length + 1}`,
      messages: []
    };

    const updated = [...currentChats, newChat];
    setCurrentChats(updated);
    saveLocalChats(currentPId, updated);
    setCurrentChatId(newChatId);
    setActiveTab('chat');
  };

  const handleDeleteChat = (chatId: string) => {
    if (!currentPId) return;
    setConfirmConfig({
      isOpen: true,
      message: '¿Estás seguro de que quieres borrar este capítulo?',
      onConfirm: async () => {
        const remaining = currentChats.filter(c => c.id !== chatId);
        setCurrentChats(remaining);
        saveLocalChats(currentPId, remaining);

        // Limpiar también las entradas de la agenda/cronología asociadas a esta sesión
        await handleUpdateProjectField(p => ({
          timeline: (p.timeline || []).filter(t => t.chatId !== chatId)
        }));

        if (currentChatId === chatId) {
          setCurrentChatId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    });
  };

  // Messaging & Turn Generation
  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentPId || !currentChatId || isGenerating) return;
    const text = inputText.trim();
    setInputText('');

    if (currentChat) {
      const updatedMessages = [...currentChat.messages, { role: 'user' as const, content: text }];
      const updatedChat = { ...currentChat, messages: updatedMessages };
      const chs = currentChats.map(c => (c.id === currentChatId ? updatedChat : c));
      setCurrentChats(chs);
      saveLocalChats(currentPId, chs);
      await triggerAIGeneration(text, updatedMessages);
    } else {
      await triggerAIGeneration(text);
    }
  };

  const appendToInput = (fragment: string) => {
    setInputText(prev => {
      const clean = prev.trim();
      return clean ? `${clean} ${fragment} ` : `${fragment} `;
    });
  };

  const handleRollDice = (sides: number) => {
    const roll = rollDie(sides);
    appendToInput(`[Tirada d${sides}: ${roll}]`);
    return roll;
  };

  const handleRollRequest = (req: RollRequest) => {
    const natural = rollDie(20);
    appendToInput(formatRollResult(req, natural));
    return natural;
  };

  // El dado se tira aquí, no en el modelo. Lo único que hace el Narrador con esto
  // es leer la tabla de la jugadora e interpretar lo que salga.
  const handleOracleAsk = (pregunta: string, probabilidad: Probabilidad) => {
    const consulta = nuevaConsulta(pregunta, probabilidad);
    appendToInput(formatoConsulta(consulta));
    return consulta.resultado;
  };

  const handleOracleMeaning = () => {
    appendToInput(formatoSignificado());
  };

  const triggerAIGeneration = async (userPrompt: string, baseMessages?: Message[]) => {
    if (!currentProject || !currentChatId) return;

    if (!hasConfiguredApiKey()) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setIsStreamingTurn(true);
    setLoadingText('Consultando los archivos del tomo y tejiendo la trama...');

    try {
      const targetChat = currentChats.find(c => c.id === currentChatId);
      if (!targetChat) return;

      const currentList = baseMessages || targetChat.messages;
      const placeholderChat = {
        ...targetChat,
        messages: [...currentList, { role: 'model' as const, content: 'Tirando dados...' }]
      };
      const chs = currentChats.map(c => (c.id === currentChatId ? placeholderChat : c));
      setCurrentChats(chs);
      saveLocalChats(currentProject.id, chs);

      const controller = new AbortController();
      generationAbortRef.current = controller;

      let lastStoryResponse = '';

      await generateStoryTurnStream({
        project: currentProject,
        currentChatId,
        chats: chs,
        files: currentFiles,
        userText: userPrompt,
        signal: controller.signal,
        // El estado del protagonista lo lleva el Narrador, no el jugador.
        onStateReported: state => {
          void handleUpdateMemory(mem => ({
            ...mem,
            player_character: {
              ...(mem.player_character || { name: 'Protagonista' }),
              ...(state.hp !== undefined ? { hp: state.hp } : {}),
              ...(state.maxHp !== undefined ? { maxHp: state.maxHp } : {}),
              ...(state.ac !== undefined ? { ac: state.ac } : {}),
              ...(state.conditions !== undefined ? { conditions: state.conditions } : {})
            }
          }));
        },
        // El inventario y dinero los administra exclusivamente el Narrador a través del roleplay.
        onInventoryReported: invReport => {
          void handleUpdateMemory(mem => ({
            ...mem,
            player_character: applyInventoryReport(mem?.player_character || { name: 'Protagonista' }, invReport)
          }));
        },
        onTimeReported: t => {
          const modelMsgIdx = currentList.length; // index of the model message being added
          void handleTimeReported(t, { msgIndex: modelMsgIdx });
        },
        // Refresco de pantalla en CADA fragmento: es solo estado en memoria y es lo
        // que hace que la narración se escriba ante ti en vez de aparecer a saltos.
        // El guardado en disco sigue limitado dentro de geminiHelper.
        onChunk: (fullText: string) => {
          lastStoryResponse = fullText;
          setCurrentChats(prev =>
            prev.map(c => {
              if (c.id !== currentChatId) return c;
              const msgs = [...c.messages];
              const last = msgs[msgs.length - 1];
              if (last && last.role === 'model') {
                msgs[msgs.length - 1] = { ...last, content: fullText };
              } else {
                msgs.push({ role: 'model', content: fullText });
              }
              return { ...c, messages: msgs };
            })
          );
        },
        setLoadingText,
        onSaveMessage: (updatedChat: Chat) => {
          setCurrentChats(prev => {
            const updatedChs = prev.map(c => (c.id === currentChatId ? updatedChat : c));
            saveLocalChats(currentProject.id, updatedChs);
            return updatedChs;
          });
        }
      });

      // Sincronización inteligente de memoria en segundo plano optimizada por cuota
      const syncGranularity = getStoredMemorySyncGranularity();
      if (hasConfiguredApiKey() && lastStoryResponse && syncGranularity !== 'off') {
        let shouldRunSync = true;
        if (syncGranularity === 'batch') {
          turnsSinceSyncRef.current += 1;
          if (turnsSinceSyncRef.current < 3) {
            shouldRunSync = false;
          } else {
            turnsSinceSyncRef.current = 0;
          }
        }

        if (shouldRunSync) {
          setTimeout(async () => {
            try {
              setIsBackgroundSyncingMemory(true);
              const deltaMem = await syncMemoryDeltaIncremental({
                project: currentProject,
                lastUserAction: userPrompt,
                lastModelResponse: lastStoryResponse,
                granularity: syncGranularity
              });
              if (deltaMem) {
                await handleUpdateMemory(prev => ({
                  ...prev,
                  ...deltaMem
                }));
              }
            } catch (err) {
              console.warn('Silent background memory sync error:', err);
            } finally {
              setIsBackgroundSyncingMemory(false);
            }
          }, 300);
        }
      }
    } catch (error: any) {
      console.error('Error generating AI story:', error);
      // Limpiar el mensaje de placeholder "Tirando dados..." si falló la llamada
      setCurrentChats(prev =>
        prev.map(c => {
          if (c.id !== currentChatId) return c;
          const msgs = [...c.messages];
          if (msgs.length > 0 && msgs[msgs.length - 1].content === 'Tirando dados...') {
            msgs.pop();
          }
          return { ...c, messages: msgs };
        })
      );
      if (error?.message?.includes('GEMINI_API_KEY') || error?.message?.includes('API key')) {
        setIsApiKeyModalOpen(true);
      } else {
        setAlertConfig({
          isOpen: true,
          title: 'Aviso del Narrador',
          message: describeApiError(error)
        });
      }
    } finally {
      // La copia en disco es red de seguridad: si hay carpeta configurada en Copias, se sincroniza en segundo plano.
      if (currentProject) {
        const latestChats = getLocalChats(currentProject.id);
        writeCampaignToDisk(
          currentProject,
          latestChats.length > 0 ? latestChats : currentChats,
          currentFiles
        ).catch(() => {});
      }
      generationAbortRef.current = null;
      setIsStreamingTurn(false);
      setIsGenerating(false);
      setLoadingText('');
    }
  };

  const handleStopGeneration = () => {
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    setLoadingText('Deteniendo al Narrador...');
  };

  const handleEditChatMessage = async (index: number, newContent: string) => {
    if (!currentPId || !currentChatId || !currentChat) return;
    const updatedMessages = currentChat.messages.map((m, i) =>
      i === index ? { ...m, content: newContent } : m
    );
    const updatedChat = { ...currentChat, messages: updatedMessages };
    const chs = currentChats.map(c => (c.id === currentChatId ? updatedChat : c));
    setCurrentChats(chs);
    saveLocalChats(currentPId, chs);
  };

  const handleRegenerateChatMessage = async (index: number, updatedUserPrompt?: string) => {
    if (!currentPId || !currentChatId || !currentChat || isGenerating) return;

    const targetMsg = currentChat.messages[index];
    if (!targetMsg) return;

    // Sincronizar diario/timeline eliminando entradas asociadas a los mensajes truncados
    await handleUpdateProjectField(p => {
      if (!p.timeline || p.timeline.length === 0) return {};
      const updatedTimeline = p.timeline.filter(e => {
        if (e.chatId !== currentChatId) return true;
        if (e.msgIndex !== undefined && e.msgIndex >= index) return false;
        return true;
      });
      return { timeline: updatedTimeline };
    });

    if (targetMsg.role === 'model') {
      // 1. Truncate from this model message
      const priorMessages = currentChat.messages.slice(0, index);
      // Find previous user prompt
      const lastUserMsg = [...priorMessages].reverse().find(m => m.role === 'user');
      const promptToUse = lastUserMsg ? lastUserMsg.content : 'Continúa con el relato de la escena.';

      const updatedChat = { ...currentChat, messages: priorMessages };
      const chs = currentChats.map(c => (c.id === currentChatId ? updatedChat : c));
      setCurrentChats(chs);
      saveLocalChats(currentPId, chs);

      await triggerAIGeneration(promptToUse, priorMessages);
    } else {
      // 2. User message regeneration
      const promptToUse = updatedUserPrompt !== undefined ? updatedUserPrompt : targetMsg.content;
      const priorMessages = currentChat.messages.slice(0, index);
      const updatedUserMsgList: Message[] = [...priorMessages, { role: 'user', content: promptToUse }];

      const updatedChat = { ...currentChat, messages: updatedUserMsgList };
      const chs = currentChats.map(c => (c.id === currentChatId ? updatedChat : c));
      setCurrentChats(chs);
      saveLocalChats(currentPId, chs);

      await triggerAIGeneration(promptToUse, updatedUserMsgList);
    }
  };

  const handleContinueNarrative = async (fromIndex?: number) => {
    if (!currentPId || !currentChatId || !currentChat || isGenerating) return;

    let baseMessages = currentChat.messages;
    if (fromIndex !== undefined && fromIndex < currentChat.messages.length - 1) {
      baseMessages = currentChat.messages.slice(0, fromIndex + 1);
      const updatedChat = { ...currentChat, messages: baseMessages };
      const chs = currentChats.map(c => (c.id === currentChatId ? updatedChat : c));
      setCurrentChats(chs);
      saveLocalChats(currentPId, chs);

      // Sincronizar diario/timeline si se retrocede a un punto previo
      await handleUpdateProjectField(p => {
        if (!p.timeline || p.timeline.length === 0) return {};
        const updatedTimeline = p.timeline.filter(e => {
          if (e.chatId !== currentChatId) return true;
          if (e.msgIndex !== undefined && e.msgIndex > fromIndex) return false;
          return true;
        });
        return { timeline: updatedTimeline };
      });
    }

    const continuePrompt =
      '[Continúa la narración de forma fluida, profundizando en la escena, las reacciones del entorno y las consecuencias de lo ocurrido.]';
    await triggerAIGeneration(continuePrompt, baseMessages);
  };

  const handleDeleteChatMessage = async (index: number, deleteSubsequent: boolean) => {
    if (!currentPId || !currentChatId || !currentChat) return;

    let updatedMessages: Message[];
    if (deleteSubsequent) {
      // Rollback history from this index onwards
      updatedMessages = currentChat.messages.slice(0, index);
    } else {
      // Delete just this single message
      updatedMessages = currentChat.messages.filter((_, i) => i !== index);
    }

    const updatedChat = { ...currentChat, messages: updatedMessages };
    const chs = currentChats.map(c => (c.id === currentChatId ? updatedChat : c));
    setCurrentChats(chs);
    saveLocalChats(currentPId, chs);

    // Sincronización quirúrgica del diario y cronología (timeline)
    await handleUpdateProjectField(p => {
      if (!p.timeline || p.timeline.length === 0) return {};
      const updatedTimeline = p.timeline
        .filter(entry => {
          if (entry.chatId !== currentChatId) return true;
          if (entry.msgIndex === undefined) {
            // Si no tiene msgIndex explícito, solo se descarta si borramos todos los mensajes del chat
            return updatedMessages.length > 0;
          }
          if (deleteSubsequent) {
            return entry.msgIndex < index;
          } else {
            return entry.msgIndex !== index;
          }
        })
        .map(entry => {
          // Reindexar msgIndex si se borró un único mensaje previo
          if (entry.chatId === currentChatId && entry.msgIndex !== undefined && !deleteSubsequent && entry.msgIndex > index) {
            return { ...entry, msgIndex: entry.msgIndex - 1 };
          }
          return entry;
        });

      return { timeline: updatedTimeline };
    });
  };

  // Files & Knowledge Base
  const handleFilesUpload = async (files: File[]) => {
    if (!currentPId || files.length === 0) return;
    setIsGenerating(true);
    setLoadingText(`Preparando la subida de ${files.length} archivo(s)...`);
    setTopProgress({
      active: true,
      percent: 5,
      label: `Cargando ${files.length} archivo${files.length > 1 ? 's' : ''}...`,
      type: 'upload'
    });

    try {
      const newFilesList: ProjectFile[] = [];
      const imagesToAnalyze: { file: ProjectFile; dataUrl: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const stepPercent = Math.round(5 + (i / files.length) * 50);
        setLoadingText(`Procesando archivo ${i + 1} de ${files.length}: ${file.name}...`);
        setTopProgress({
          active: true,
          percent: stepPercent,
          label: `Leyendo ${i + 1}/${files.length}: ${file.name}`,
          type: 'upload'
        });

        let text = '';
        const isImage = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');
        let contentUrlOrText = '';

        if (isImage) {
          contentUrlOrText = await optimizeImageFile(file);
        } else if (isAudio) {
          const reader = new FileReader();
          contentUrlOrText = await new Promise<string>(resolve => {
            reader.onload = () => resolve(reader.result as string);
            // Without an error handler a failed read leaves the promise pending
            // forever and the upload spinner never goes away.
            reader.onerror = () => {
              console.error('No se pudo leer el audio:', file.name, reader.error);
              resolve('');
            };
            reader.readAsDataURL(file);
          });
        } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const { extractPdfText } = await import('./utils/pdfText');
            text = await extractPdfText(await file.arrayBuffer());
          } catch (err) {
            console.error('Error reading PDF:', err);
            text = await file.text().catch(() => '');
          }
          contentUrlOrText = text;
        } else {
          contentUrlOrText = await file.text();
        }

        const newFile: ProjectFile = {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(7),
          name: file.name,
          type: file.type || 'application/octet-stream',
          content: contentUrlOrText,
          mime: file.type,
          category: 'other',
          isImage,
          isAudio,
          length: isImage || isAudio ? file.size : contentUrlOrText.length,
          markers: []
        };

        // Auto classify immediately using memory context
        newFile.category = classifyFileAuto(newFile, currentProject?.memory);

        newFilesList.push(newFile);

        if (isImage && contentUrlOrText) {
          imagesToAnalyze.push({ file: newFile, dataUrl: contentUrlOrText });
        }
      }

      let updated = [...currentFiles, ...newFilesList];
      setCurrentFiles(updated);
      await saveFilesToDB(currentPId, updated);

      // Perform background image recognition if there are images, storing directly in Memory & File
      if (imagesToAnalyze.length > 0 && hasConfiguredApiKey()) {
        (async () => {
          const newVisualMemories: VisualMemoryItem[] = [];
          for (let imgIdx = 0; imgIdx < imagesToAnalyze.length; imgIdx++) {
            const item = imagesToAnalyze[imgIdx];
            try {
              const analysis = await analyzeUploadedImage(item.file, item.dataUrl);
              if (analysis) {
                const refreshedFiles = await loadFilesFromDB(currentPId);
                const fileUpdated = refreshedFiles.map(f => (f.id === item.file.id ? { ...f, analysis } : f));
                setCurrentFiles(fileUpdated);
                await saveFilesToDB(currentPId, fileUpdated);

                newVisualMemories.push({
                  id: 'vmem_' + item.file.id,
                  fileId: item.file.id,
                  fileName: item.file.name,
                  thumbnail: item.dataUrl,
                  analysis
                });
              }
            } catch (analysisErr) {
              console.error('Error in background image analysis:', analysisErr);
            }
          }

          if (newVisualMemories.length > 0) {
            await handleUpdateMemory(mem => {
              const existingVisual = mem.visual_memory || [];
              const merged = [
                ...existingVisual.filter(ev => !newVisualMemories.some(nvm => nvm.fileId === ev.fileId)),
                ...newVisualMemories
              ];
              return { ...mem, visual_memory: merged };
            });
          }
        })();
      }

      // Si entre lo subido hay una ficha del protagonista, registrarla en segundo plano
      let autoSheetMsg = '';
      const sheetFile = updated.find(f => newFilesList.some(nf => nf.id === f.id) && looksLikePlayerSheet(f));

      if (sheetFile && hasConfiguredApiKey()) {
        const existingPc = currentProject?.memory?.player_character;
        if (!existingPc?.name) {
          // Extraer en segundo plano inmediatamente sin congelar la app
          void handleExtractPlayerCharacter(sheetFile);
          autoSheetMsg = ` He detectado la ficha del protagonista ("${sheetFile.name}") y la estoy extrayendo en segundo plano. ¡Ya puedes empezar a jugar!`;
        } else {
          autoSheetMsg = ` He detectado lo que parece una ficha ("${sheetFile.name}"). Ya tienes a "${existingPc.name}" como protagonista; puedes actualizar la ficha desde la pestaña Fichas si lo deseas.`;
        }
      }

      // Detect companion or NPC sheet uploaded
      const companionFile = updated.find(f => newFilesList.some(nf => nf.id === f.id) && looksLikeCompanionSheet(f));
      const npcSheetFile = updated.find(f => newFilesList.some(nf => nf.id === f.id) && looksLikeNpcSheet(f));

      if (companionFile && hasConfiguredApiKey()) {
        autoSheetMsg += ` He detectado la ficha de un compañero ("${companionFile.name}"). Puedes extraerla desde la pestaña Archivos o Memoria.`;
      }
      if (npcSheetFile && hasConfiguredApiKey()) {
        autoSheetMsg += ` He detectado la ficha de un PNJ ("${npcSheetFile.name}"). Puedes registrarlo desde la pestaña Archivos o Memoria.`;
      }

      setAlertConfig({
        isOpen: true,
        title: 'Archivos Guardados',
        message: `Se han añadido ${newFilesList.length} documento(s) a la Base de Conocimiento.${
          imagesToAnalyze.length > 0 ? ` ${imagesToAnalyze.length} imagen(es) se están analizando en segundo plano.` : ''
        }${autoSheetMsg}`
      });
    } catch (error) {
      console.error('Error handling files upload:', error);
      setAlertConfig({ isOpen: true, title: 'Error', message: 'Hubo un problema al procesar los archivos.' });
    } finally {
      setIsGenerating(false);
      setLoadingText('');
      setTopProgress({ active: false });
    }
  };

  const handleAnalyzeImageFile = async (file: ProjectFile) => {
    if (!currentPId || !file.content) return;
    if (!hasConfiguredApiKey()) {
      setIsApiKeyModalOpen(true);
      return;
    }
    if (extractingFileIds.includes(file.id)) return;

    setExtractingFileIds(prev => [...prev, file.id]);
    setTopProgress({
      active: true,
      label: `Analizando visualmente "${file.name}" en 2º plano...`,
      type: 'analysis'
    });
    try {
      const analysis = await analyzeUploadedImage(file, file.content);
      if (analysis) {
        const refreshedFiles = await loadFilesFromDB(currentPId);
        const updated = refreshedFiles.map(f => (f.id === file.id ? { ...f, analysis } : f));
        setCurrentFiles(updated);
        await saveFilesToDB(currentPId, updated);

        const visualItem: VisualMemoryItem = {
          id: 'vmem_' + file.id,
          fileId: file.id,
          fileName: file.name,
          thumbnail: file.content,
          analysis
        };

        if (currentProject) {
          const existingVisual = currentProject.memory?.visual_memory || [];
          const filtered = existingVisual.filter(v => v.fileId !== file.id);
          await handleUpdateMemory(mem => ({
            ...mem,
            visual_memory: [...filtered, visualItem]
          }));
        }

        setTopProgress({
          active: true,
          percent: 100,
          label: `Análisis visual de "${file.name}" guardado`,
          type: 'analysis'
        });
        setTimeout(() => {
          setTopProgress(p => (p.label?.includes(file.name) ? { active: false } : p));
        }, 3500);
      }
    } catch (err: any) {
      console.error('Error analyzing image file:', err);
      setTopProgress({
        active: true,
        label: `Error análisis visual: ${err.message || 'Fallo de procesamiento'}`,
        type: 'analysis'
      });
      setTimeout(() => {
        setTopProgress(p => (p.label?.includes('Error análisis') ? { active: false } : p));
      }, 4000);
    } finally {
      setExtractingFileIds(prev => prev.filter(id => id !== file.id));
    }
  };

  const handleUpdateFileAnalysis = async (fileId: string, analysis: string) => {
    if (!currentPId) return;
    const updated = currentFiles.map(f => (f.id === fileId ? { ...f, analysis } : f));
    setCurrentFiles(updated);
    await saveFilesToDB(currentPId, updated);

    // El registro visual es para imágenes. Un documento cuyo análisis es su
    // destilado no pinta nada ahí: acabaría viajando dos veces, una en su propia
    // sección y otra dentro de la memoria, y con el doble de coste.
    const targetFile = currentFiles.find(f => f.id === fileId);
    if (currentProject && targetFile && targetFile.isImage) {
      const existingVisual = currentProject.memory?.visual_memory || [];
      const filtered = existingVisual.filter(v => v.fileId !== fileId);
      const visualItem: VisualMemoryItem = {
        id: 'vmem_' + fileId,
        fileId: fileId,
        fileName: targetFile.name,
        thumbnail: targetFile.content,
        analysis
      };
      await handleUpdateMemory(mem => ({
        ...mem,
        visual_memory: [...filtered, visualItem]
      }));
    }
  };

  const handleDeleteFileAnalysis = async (fileId: string) => {
    if (!currentPId) return;
    const updated = currentFiles.map(f => (f.id === fileId ? { ...f, analysis: undefined } : f));
    setCurrentFiles(updated);
    await saveFilesToDB(currentPId, updated);

    if (currentProject) {
      await handleUpdateMemory(mem => ({
        ...mem,
        visual_memory: (mem.visual_memory || []).filter(v => v.fileId !== fileId)
      }));
    }
  };

  const handleDeleteFile = async (file: ProjectFile) => {
    if (!currentPId) return;
    setConfirmConfig({
      isOpen: true,
      message: `¿Eliminar "${file.name}"de la base de conocimiento?`,
      onConfirm: async () => {
        const updated = currentFiles.filter(f => f.id !== file.id);
        setCurrentFiles(updated);
        await saveFilesToDB(currentPId, updated);

        if (file.isImage && currentProject) {
          await handleUpdateMemory(mem => ({
            ...mem,
            visual_memory: (mem.visual_memory || []).filter(v => v.fileId !== file.id)
          }));
        }
      }
    });
  };

  const handleUpdateMapMarkers = async (fileId: string, markers: MapMarker[]) => {
    if (!currentPId) return;
    const updated = currentFiles.map(f => (f.id === fileId ? { ...f, markers } : f));
    setCurrentFiles(updated);
    await saveFilesToDB(currentPId, updated);
  };

  const handleUpdateFileCategory = async (fileId: string, category: FileCategory) => {
    if (!currentPId) return;
    const updated = currentFiles.map(f => (f.id === fileId ? { ...f, category } : f));
    setCurrentFiles(updated);
    await saveFilesToDB(currentPId, updated);
  };

  const handleToggleOnDemand = async (fileId: string, onDemand: boolean) => {
    if (!currentPId) return;
    const updated = currentFiles.map(f => (f.id === fileId ? { ...f, onDemand } : f));
    setCurrentFiles(updated);
    await saveFilesToDB(currentPId, updated);
  };

  /**
   * Destila una hoja de oráculo. El resultado se guarda como análisis del
   * archivo, que es lo que a partir de entonces viaja al Narrador: el documento
   * original se conserva intacto por si el destilado sale mal y hay que rehacerlo.
   */
  const handleDistillOracle = async (file: ProjectFile) => {
    if (!currentPId) return;
    if (extractingFileIds.includes(file.id)) return;

    setExtractingFileIds(prev => [...prev, file.id]);
    setTopProgress({
      active: true,
      label: `Destilando tablas de oráculo desde "${file.name}" en 2º plano...`,
      type: 'general'
    });
    try {
      const destilado = await destilarTablaOraculo(file);
      const refreshedFiles = await loadFilesFromDB(currentPId);
      const updated = refreshedFiles.map(f => (f.id === file.id ? { ...f, analysis: destilado } : f));
      setCurrentFiles(updated);
      await saveFilesToDB(currentPId, updated);

      const antes = (file.content || '').length;
      const ahora = destilado.length;
      setAlertConfig({
        isOpen: true,
        title: 'Tabla destilada con éxito',
        message: `De ${antes.toLocaleString('es-ES')} caracteres a ${ahora.toLocaleString('es-ES')}: un ${Math.round((1 - ahora / Math.max(1, antes)) * 100)}% menos en cada turno.\n\nEs lo que viajará al Narrador a partir de ahora. Puedes comprobarla o editarla en cualquier momento desde Archivos.`
      });
    } catch (err) {
      setAlertConfig({
        isOpen: true,
        title: 'No se ha podido destilar',
        message: describeApiError(err)
      });
    } finally {
      setExtractingFileIds(prev => prev.filter(id => id !== file.id));
      setTopProgress({ active: false });
    }
  };

  const handleAutoClassifyAll = async () => {
    if (!currentProject || !currentPId) return;
    setTopProgress({
      active: true,
      label: 'Reclasificando archivos y sincronizando memoria en 2º plano...',
      type: 'sync'
    });
    try {
      let filesModified = false;
      const refreshedFiles = await loadFilesFromDB(currentPId);
      const updatedFiles = refreshedFiles.map(file => {
        const autoCat = classifyFileAuto(file, currentProject.memory);
        if (autoCat !== file.category) {
          filesModified = true;
          return { ...file, category: autoCat };
        }
        return file;
      });

      if (filesModified) {
        setCurrentFiles(updatedFiles);
        await saveFilesToDB(currentPId, updatedFiles);
      }

      // Also auto-assign portraits to PC, NPCs and Locations if names match and portrait is missing
      let memoryModified = false;
      const currentNpcs = currentProject.memory?.npcs || [];
      const currentLocs = currentProject.memory?.locations || [];
      let updatedPc = currentProject.memory?.player_character;

      const pcNameClean = (updatedPc?.name || '').trim().toLowerCase();

      if (updatedPc && !updatedPc.portrait) {
        const matchingPcFile = updatedFiles.find(f => {
          if (!f.isImage || !f.content) return false;
          const cleanName = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
          return (
            f.category === 'portrait_pj' ||
            (pcNameClean.length > 2 && (cleanName.includes(pcNameClean) || pcNameClean.includes(cleanName)))
          );
        });
        if (matchingPcFile) {
          memoryModified = true;
          updatedPc = { ...updatedPc, portrait: matchingPcFile.content };
        }
      }

      const updatedNpcs = currentNpcs
        .filter(npc => {
          const npcNameClean = npc.name.trim().toLowerCase();
          if (
            ['protagonista', 'jugador', 'el jugador', 'personaje jugador', 'oc', 'pj'].includes(npcNameClean)
          )
            return false;
          if (
            pcNameClean &&
            pcNameClean.length > 2 &&
            (npcNameClean === pcNameClean || npcNameClean.includes(pcNameClean))
          )
            return false;
          return true;
        })
        .map(npc => {
          if (npc.portrait) return npc;
          const matchingFile = updatedFiles.find(f => {
            if (!f.isImage || !f.content) return false;
            const cleanName = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
            const cleanNpcName = npc.name.toLowerCase().trim();
            return (
              cleanNpcName.length > 2 &&
              (cleanName.includes(cleanNpcName) || cleanNpcName.includes(cleanName))
            );
          });
          if (matchingFile) {
            memoryModified = true;
            return { ...npc, portrait: matchingFile.content };
          }
          return npc;
        });

      const updatedLocs = currentLocs.map(loc => {
        if (loc.portrait) return loc;
        const matchingFile = updatedFiles.find(f => {
          if (!f.isImage || !f.content) return false;
          const cleanName = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
          const cleanLocName = loc.name.toLowerCase().trim();
          return (
            cleanLocName.length > 2 && (cleanName.includes(cleanLocName) || cleanLocName.includes(cleanName))
          );
        });
        if (matchingFile) {
          memoryModified = true;
          return { ...loc, portrait: matchingFile.content };
        }
        return loc;
      });

      if (memoryModified) {
        await handleUpdateMemory(mem => ({
          ...mem,
          player_character: updatedPc,
          npcs: updatedNpcs,
          locations: updatedLocs
        }));
      }

      setAlertConfig({
        isOpen: true,
        title: 'Sincronización Completada',
        message: `Se han clasificado los archivos y sincronizado retratos con la Memoria de la campaña.`
      });
    } catch (err) {
      console.error('Error during auto-classification:', err);
      setAlertConfig({
        isOpen: true,
        title: 'Error',
        message: 'Ocurrió un error al reclasificar los archivos.'
      });
    } finally {
      setTopProgress({ active: false });
    }
  };

  const handleUsePortraitAsPc = async (file: ProjectFile) => {
    if (!currentProject || !currentPId) return;
    await handleUpdateMemory(mem => ({
      ...mem,
      player_character: {
        ...(mem.player_character || { name: 'Protagonista' }),
        portrait: file.content
      }
    }));
    setAlertConfig({
      isOpen: true,
      title: 'Retrato asignado',
      message: `"${file.name}" es ahora el retrato del protagonista.`
    });
  };

  const handleCreateNpcFromImage = async (file: ProjectFile) => {
    if (!currentProject || !currentPId) return;
    const rawName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .trim();
    const formattedName = rawName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const newNpc: NPC = {
      id: 'npc_' + Date.now(),
      name: formattedName,
      relation: 'Neutral',
      status: 'Vivo',
      description: file.analysis ? file.analysis.slice(0, 180) + '...' : '',
      notes: file.analysis
        ? `Detectado a partir de ${file.name}.\n${file.analysis}`
        : `Creado desde imagen ${file.name}`,
      portrait: file.content
    };

    await handleUpdateMemory(mem => ({
      ...mem,
      npcs: [...(mem.npcs || []), newNpc]
    }));

    setAlertConfig({
      isOpen: true,
      title: 'PNJ Creado en Memoria',
      message: `Se ha creado el personaje "${formattedName}"con su retrato vinculado automáticamente en la pestaña de PNJs de la Memoria.`
    });
  };

  const handleUploadEntityImage = async (
    file: File,
    category: FileCategory = 'portrait_npc'
  ): Promise<string> => {
    if (!currentPId) return '';
    try {
      const contentUrl = await optimizeImageFile(file);
      const newFile: ProjectFile = {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(7),
        name: file.name,
        type: file.type,
        mime: file.type,
        category,
        content: contentUrl,
        isImage: true,
        length: file.size
      };
      const updatedFiles = [...currentFiles, newFile];
      setCurrentFiles(updatedFiles);
      await saveFilesToDB(currentPId, updatedFiles);

      // Background AI visual analysis if API key is configured
      if (hasConfiguredApiKey()) {
        analyzeUploadedImage(newFile, contentUrl)
          .then(async analysis => {
            if (analysis) {
              const fileWithAnalysis = { ...newFile, analysis };
              const refreshed = (await loadFilesFromDB(currentPId)).map(f =>
                f.id === newFile.id ? fileWithAnalysis : f
              );
              setCurrentFiles(refreshed);
              await saveFilesToDB(currentPId, refreshed);
            }
          })
          .catch(err => console.error('Error in background entity image analysis:', err));
      }

      return contentUrl;
    } catch (err) {
      console.error('Error uploading entity image:', err);
      return '';
    }
  };

  const handleExtractPlayerCharacter = async (file: ProjectFile) => {
    if (!currentProject || !currentPId) return;
    if (extractingFileIds.includes(file.id)) return;

    setExtractingFileIds(prev => [...prev, file.id]);
    setTopProgress({
      active: true,
      label: `Extrayendo ficha de protagonista (${file.name}) en 2º plano...`,
      type: 'sync'
    });
    try {
      const pc = await extractPlayerCharacterFromDocument(file);

      // Search for any matching image in files as portrait
      const refreshedFiles = await loadFilesFromDB(currentPId);
      const matchingPortrait = refreshedFiles.find(f => {
        if (!f.isImage || !f.content) return false;
        const cleanName = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
        const cleanPcName = pc.name.toLowerCase().trim();
        return (
          f.category === 'portrait_pj' ||
          (cleanPcName.length > 2 && (cleanName.includes(cleanPcName) || cleanPcName.includes(cleanName)))
        );
      });

      if (matchingPortrait && !pc.portrait) {
        pc.portrait = matchingPortrait.content;
      }

      // Update file category to sheet_pj
      await handleUpdateFileCategory(file.id, 'sheet_pj');

      // Update memory
      await handleUpdateMemory(mem => ({
        ...mem,
        player_character: {
          ...pc,
          portrait: pc.portrait || mem.player_character?.portrait
        }
      }));

      setTopProgress({
        active: true,
        percent: 100,
        label: `Ficha de "${pc.name}" registrada con éxito`,
        type: 'sync'
      });
      setTimeout(() => {
        setTopProgress(p => (p.label?.includes(pc.name) ? { active: false } : p));
      }, 4000);
    } catch (error) {
      console.error('Error extracting player character:', error);
      setTopProgress({
        active: true,
        label: `Error al leer la ficha de "${file.name}"`,
        type: 'sync'
      });
      setTimeout(() => {
        setTopProgress(p => (p.label?.includes('Error al leer') ? { active: false } : p));
      }, 4000);
    } finally {
      setExtractingFileIds(prev => prev.filter(id => id !== file.id));
    }
  };

  const handleExtractCompanion = async (file: ProjectFile) => {
    if (!currentProject || !currentPId) return;
    if (extractingFileIds.includes(file.id)) return;

    setExtractingFileIds(prev => [...prev, file.id]);
    setTopProgress({
      active: true,
      label: `Extrayendo ficha de compañero (${file.name}) en 2º plano...`,
      type: 'sync'
    });
    try {
      const companion = await extractCompanionFromDocument(file);

      // Search for any matching image in files as portrait
      const refreshedFiles = await loadFilesFromDB(currentPId);
      const matchingPortrait = refreshedFiles.find(f => {
        if (!f.isImage || !f.content) return false;
        const cleanName = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
        const cleanCompName = companion.name.toLowerCase().trim();
        return (
          f.category === 'portrait_npc' ||
          (cleanCompName.length > 2 && (cleanName.includes(cleanCompName) || cleanCompName.includes(cleanName)))
        );
      });

      if (matchingPortrait && !companion.portrait) {
        companion.portrait = matchingPortrait.content;
      }

      await handleUpdateFileCategory(file.id, 'sheet_companion');

      await handleUpdateMemory(mem => {
        const existing = mem.companions || [];
        const filtered = existing.filter(c => c.name.toLowerCase() !== companion.name.toLowerCase());
        return {
          ...mem,
          companions: [...filtered, companion]
        };
      });

      setTopProgress({
        active: true,
        percent: 100,
        label: `Compañero "${companion.name}" registrado con éxito`,
        type: 'sync'
      });
      setTimeout(() => {
        setTopProgress(p => (p.label?.includes(companion.name) ? { active: false } : p));
      }, 4000);
    } catch (error) {
      console.error('Error extracting companion:', error);
      setTopProgress({
        active: true,
        label: `Error al leer la ficha de compañero de "${file.name}"`,
        type: 'sync'
      });
      setTimeout(() => {
        setTopProgress(p => (p.label?.includes('Error al leer') ? { active: false } : p));
      }, 4000);
    } finally {
      setExtractingFileIds(prev => prev.filter(id => id !== file.id));
    }
  };

  const handleExtractNpc = async (file: ProjectFile) => {
    if (!currentProject || !currentPId) return;
    if (extractingFileIds.includes(file.id)) return;

    setExtractingFileIds(prev => [...prev, file.id]);
    setTopProgress({
      active: true,
      label: `Extrayendo ficha de PNJ (${file.name}) en 2º plano...`,
      type: 'sync'
    });
    try {
      const npc = await extractNpcFromDocument(file);

      const refreshedFiles = await loadFilesFromDB(currentPId);
      const matchingPortrait = refreshedFiles.find(f => {
        if (!f.isImage || !f.content) return false;
        const cleanName = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
        const cleanNpcName = npc.name.toLowerCase().trim();
        return (
          f.category === 'portrait_npc' ||
          (cleanNpcName.length > 2 && (cleanName.includes(cleanNpcName) || cleanNpcName.includes(cleanName)))
        );
      });

      if (matchingPortrait && !npc.portrait) {
        npc.portrait = matchingPortrait.content;
      }

      await handleUpdateFileCategory(file.id, 'sheet_npc');

      await handleUpdateMemory(mem => {
        const existing = mem.npcs || [];
        const filtered = existing.filter(n => n.name.toLowerCase() !== npc.name.toLowerCase());
        return {
          ...mem,
          npcs: [...filtered, npc]
        };
      });

      setTopProgress({
        active: true,
        percent: 100,
        label: `PNJ "${npc.name}" registrado con éxito`,
        type: 'sync'
      });
      setTimeout(() => {
        setTopProgress(p => (p.label?.includes(npc.name) ? { active: false } : p));
      }, 4000);
    } catch (error) {
      console.error('Error extracting NPC:', error);
      setTopProgress({
        active: true,
        label: `Error al leer la ficha de PNJ de "${file.name}"`,
        type: 'sync'
      });
      setTimeout(() => {
        setTopProgress(p => (p.label?.includes('Error al leer') ? { active: false } : p));
      }, 4000);
    } finally {
      setExtractingFileIds(prev => prev.filter(id => id !== file.id));
    }
  };

  const handleTriggerAISyncMemory = async () => {
    if (!currentProject || !currentPId) return;

    if (!hasConfiguredApiKey()) {
      setIsApiKeyModalOpen(true);
      return;
    }

    const hasAnyMessages = currentChats.some(c =>
      (c.messages || []).some(
        m =>
          m.content &&
          m.content.trim().length > 0 &&
          m.content !== 'Pensando...' &&
          m.content !== 'Tirando dados...'
      )
    );

    if (!hasAnyMessages) {
      setAlertConfig({
        isOpen: true,
        title: 'Crónica Vacía',
        message:
          'Aún no hay mensajes ni eventos registrados en la crónica. Juega al menos un turno o introduce la primera escena para que el Narrador pueda analizar y sincronizar la memoria viva.'
      });
      return;
    }

    setIsGenerating(true);
    setLoadingText('Sincronizando memoria viva desde todas las sesiones...');
    setTopProgress({
      active: true,
      label: 'Sincronizando memoria viva de toda la crónica...',
      type: 'sync'
    });
    try {
      const updatedMem = await syncMemoryFromChats(currentProject, currentChats);
      await handleUpdateMemory(prev => ({
        ...prev,
        ...updatedMem
      }));
      setAlertConfig({
        isOpen: true,
        title: 'Memoria Sincronizada',
        message:
          'La crónica, estado actual, tramas, PNJs y lugares se han actualizado con éxito a partir de tus partidas.'
      });
    } catch (error: any) {
      console.error('Error syncing memory:', error);
      const errMsg = error?.message || 'No se pudo sincronizar la memoria. Inténtalo de nuevo.';
      if (errMsg.includes('GEMINI_API_KEY') || errMsg.includes('API key') || errMsg.includes('clave')) {
        setIsApiKeyModalOpen(true);
      }
      setAlertConfig({
        isOpen: true,
        title: 'Sincronización de Memoria',
        message: errMsg
      });
    } finally {
      setIsGenerating(false);
      setLoadingText('');
      setTopProgress({ active: false });
    }
  };

  const handleExportPDF = async () => {
    if (!currentProject || !currentChat) return;
    setIsGenerating(true);
    try {
      const { exportChronicleToPDF } = await import('./utils/pdfExport');
      await exportChronicleToPDF(currentProject, currentChat, setLoadingText);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      setAlertConfig({
        isOpen: true,
        title: 'Error de Exportación',
        message: error?.message || 'No se pudo exportar el tomo.'
      });
    } finally {
      setIsGenerating(false);
      setLoadingText('');
    }
  };

  const processImportFile = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.readAsText(file, 'UTF-8');
      fileReader.onload = async event => {
        try {
          const imported = JSON.parse(event.target?.result as string);

          // Restauración automática de API Keys y configuración del motor de IA si vienen en el archivo
          if (Array.isArray(imported.apiKeys) && imported.apiKeys.length > 0) {
            setStoredApiKeys(imported.apiKeys);
          } else if (typeof imported.apiKey === 'string' && imported.apiKey.trim()) {
            setStoredApiKeys([imported.apiKey.trim()]);
          }
          if (imported.keyRotationMode) {
            setStoredKeyRotationMode(imported.keyRotationMode);
          }
          const aiConfig = imported.geminiSettings || imported.settings;
          if (aiConfig) {
            if (aiConfig.model) setStoredModel(aiConfig.model);
            if (aiConfig.backgroundModel) setStoredBackgroundModel(aiConfig.backgroundModel);
            if (aiConfig.safetyLevel) setStoredSafetyLevel(aiConfig.safetyLevel);
            if (aiConfig.thinkingLevel) setStoredThinkingLevel(aiConfig.thinkingLevel);
            if (typeof aiConfig.temperature === 'number') setStoredTemperature(aiConfig.temperature);
            if (typeof aiConfig.topP === 'number') setStoredTopP(aiConfig.topP);
            if (typeof aiConfig.autoFailover === 'boolean') setStoredAutoFailover(aiConfig.autoFailover);
            if (aiConfig.memorySyncGranularity) setStoredMemorySyncGranularity(aiConfig.memorySyncGranularity);
          }

          // Soporte para copias completas de todas las campañas
          if (imported.version === 'gmstudio_v2' && Array.isArray(imported.projects)) {
            const allProjects: Project[] = imported.projects;
            if (allProjects.length === 0) {
              setAlertConfig({
                isOpen: true,
                title: 'Copia Vacía',
                message: 'El archivo de copia no contiene campañas guardadas.'
              });
              resolve();
              return;
            }

            setProjects(allProjects);
            saveLocalProjects(allProjects);
            for (const p of allProjects) {
              if (p.chats && p.chats.length > 0) {
                saveLocalChats(p.id, p.chats);
              }
              if (p.files && p.files.length > 0) {
                await saveFilesToDB(p.id, p.files);
              }
            }
            if (allProjects.length > 0) {
              setCurrentPId(allProjects[0].id);
            }
            setAlertConfig({
              isOpen: true,
              title: 'Copia Global Restaurada',
              message: `Se han importado y restaurado con éxito ${allProjects.length} campaña(s) en tu almacenamiento local.`
            });
            resolve();
            return;
          }

          if (!imported.name) {
            setAlertConfig({
              isOpen: true,
              title: 'Archivo no reconocido',
              message:
                'El archivo se ha leído pero no contiene una campaña de GM Studio (falta el campo "name").'
            });
            resolve();
            return;
          }

          const chatsImportados: Chat[] = Array.isArray(imported.chats)
            ? imported.chats.map((ch: any, i: number) => ({
                id: ch.id || `cap_${i}_${Math.random().toString(36).substring(7)}`,
                name: ch.name || 'Capítulo',
                messages: ch.messages || [],
                autoTitled: ch.autoTitled
              }))
            : [{ id: 'cap_inicial', name: 'Capítulo I: El Comienzo', messages: [] }];

          const archivosImportados: ProjectFile[] = Array.isArray(imported.files) ? imported.files : [];

          const camposDeLaCampana = (id: string, nombre: string): Project => ({
            ...(imported as Project),
            id,
            name: nombre,
            memory: imported.memory || {
              story: '',
              quests: [],
              npcs: [],
              locations: [],
              current_status: '',
              manual_notes: ''
            },
            chats: [],
            files: []
          });

          const guardar = async (proj: Project, reemplazando: boolean) => {
            const updated = reemplazando
              ? projects.map(p => (p.id === proj.id ? proj : p))
              : [...projects, proj];
            setProjects(updated);
            saveLocalProjects(updated);
            saveLocalChats(proj.id, chatsImportados);
            if (archivosImportados.length) await saveFilesToDB(proj.id, archivosImportados);
            setCurrentPId(proj.id);

            const mensajes = chatsImportados.reduce((a, c) => a + (c.messages || []).length, 0);
            setAlertConfig({
              isOpen: true,
              title: reemplazando ? 'Campaña reemplazada' : 'Campaña importada',
              message: `${proj.name}\n${chatsImportados.length} capítulos · ${mensajes} mensajes${
                imported.calendar ? '\nCalendario, agenda e hilos incluidos.' : ''
              }`
            });
            resolve();
          };

          const limpiar = (n: string) =>
            n
              .replace(/\s*\(Importado\)\s*$/i, '')
              .trim()
              .toLowerCase();
          const gemela = projects.find(p => limpiar(p.name) === limpiar(imported.name));

          if (!gemela) {
            await guardar(camposDeLaCampana('tomo_' + Date.now(), imported.name), false);
            return;
          }

          const mensajesAqui = getLocalChats(gemela.id).reduce((a, c) => a + (c.messages || []).length, 0);
          const mensajesFuera = chatsImportados.reduce((a, c) => a + (c.messages || []).length, 0);
          const cuando = imported.exportadaEl
            ? new Date(imported.exportadaEl).toLocaleString('es-ES')
            : 'fecha desconocida';

          setConfirmConfig({
            isOpen: true,
            danger: false,
            confirmLabel: 'Reemplazar la mía',
            cancelLabel: 'Guardar las dos',
            message: `Ya tienes una campaña llamada «${gemela.name}».\n\nLa de aquí: ${mensajesAqui} mensajes.\nLa del archivo: ${mensajesFuera} mensajes (exportada el ${cuando}).\n\nReemplazar borra la de aquí y se queda con la del archivo. Guardar las dos deja una copia aparte, sin tocar nada.`,
            onConfirm: () => {
              void guardar(camposDeLaCampana(gemela.id, gemela.name), true);
            },
            onCancel: () => {
              void guardar(camposDeLaCampana('tomo_' + Date.now(), imported.name + ' (Importado)'), false);
            }
          });
        } catch (err) {
          console.error('Error importing JSON:', err);
          setAlertConfig({
            isOpen: true,
            title: 'Error de Importación',
            message: 'El archivo JSON no tiene un formato válido.'
          });
          reject(err);
        }
      };
    });
  };

  const handleConfirmImportCampaign = async (extracted: ExtractedCampaignResult, mode: 'new' | 'merge') => {
    const { project: importedProject, chats: importedChats } = extracted;

    if (mode === 'merge' && currentProject) {
      // 1. Fusionar Capítulos
      const existingChatIds = new Set(currentChats.map(c => c.id));
      const mergedChats = [...currentChats];
      for (const ch of importedChats) {
        if (!existingChatIds.has(ch.id)) {
          mergedChats.push(ch);
        }
      }

      // 2. Fusionar PNJs respetando afinidad (ATR, VÍN, CON)
      const existingNpcNames = new Set(currentProject.memory.npcs.map(n => n.name.toLowerCase().trim()));
      const mergedNpcs = [...currentProject.memory.npcs];
      for (const npc of importedProject.memory.npcs) {
        if (!existingNpcNames.has(npc.name.toLowerCase().trim())) {
          mergedNpcs.push(npc);
        }
      }

      // 3. Fusionar Quests & Locations
      const existingQuestTitles = new Set(currentProject.memory.quests.map(q => q.title.toLowerCase().trim()));
      const mergedQuests = [...currentProject.memory.quests];
      for (const q of importedProject.memory.quests) {
        if (!existingQuestTitles.has(q.title.toLowerCase().trim())) {
          mergedQuests.push(q);
        }
      }

      const existingLocNames = new Set(currentProject.memory.locations.map(l => l.name.toLowerCase().trim()));
      const mergedLocs = [...currentProject.memory.locations];
      for (const loc of importedProject.memory.locations) {
        if (!existingLocNames.has(loc.name.toLowerCase().trim())) {
          mergedLocs.push(loc);
        }
      }

      const updatedCurrentProject: Project = {
        ...currentProject,
        memory: {
          ...currentProject.memory,
          npcs: mergedNpcs,
          quests: mergedQuests,
          locations: mergedLocs,
          story: currentProject.memory.story
            ? `${currentProject.memory.story}\n\n[Continuación de material importado]:\n${importedProject.memory.story}`
            : importedProject.memory.story,
          player_character: currentProject.memory.player_character || importedProject.memory.player_character
        }
      };

      const updatedProjects = projects.map(p => (p.id === currentProject.id ? updatedCurrentProject : p));
      setProjects(updatedProjects);
      saveLocalProjects(updatedProjects);
      saveLocalChats(currentProject.id, mergedChats);
      setCurrentChats(mergedChats);

      setAlertConfig({
        isOpen: true,
        title: 'Tomo Fusionado',
        message: `Se han añadido ${importedChats.length} capítulos, ${importedProject.memory.npcs.length} PNJs y las misiones/lugares de la importación a «${currentProject.name}».`
      });
      return;
    }

    // Modo 'new' (Nuevo Tomo)
    const updatedProjects = [...projects, importedProject];
    setProjects(updatedProjects);
    saveLocalProjects(updatedProjects);
    saveLocalChats(importedProject.id, importedChats);
    setCurrentPId(importedProject.id);
    setCurrentChats(importedChats);
    if (importedChats.length > 0) {
      setCurrentChatId(importedChats[0].id);
    }

    setAlertConfig({
      isOpen: true,
      title: 'Nuevo Tomo Creado',
      message: `¡Campaña «${importedProject.name}» importada con éxito!\nSe han estructurado ${importedChats.length} capítulos con ${extracted.summary.messagesCount} mensajes, ${importedProject.memory.npcs.length} PNJs con afinidad y ficha de personaje lista para jugar.`
    });
  };

  const currentChapterIndex = currentChats.findIndex(c => c.id === currentChatId);

  // La fecha va en la propia pestaña: saber en qué día vives no debería costar un
  // clic, y la cabecera es lo único que se ve siempre.
  const llevaElTiempo = Boolean(currentProject?.currentDate) && calendarioValido(currentProject?.calendar);
  const fechaBoton = 'Diario';
  const tituloFecha =
    llevaElTiempo && currentProject?.calendar && currentProject.currentDate
      ? fechaCompleta(currentProject.calendar, currentProject.currentDate)
      : 'Llevar el tiempo de la campaña';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-color)] text-[var(--text-primary)] font-lora relative">
      {/* Sutil viñeteado para efecto de inmersión / iluminación central */}
      <div className="pointer-events-none fixed inset-0 z-50 shadow-[inset_0_0_120px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_150px_rgba(0,0,0,0.2)] mix-blend-multiply opacity-50" />
      {/* Top Subtle Progress Bar during file uploads, analysis & heavy memory sync */}
      {(topProgress.active || isBackgroundSyncingMemory) && (
        <div className="fixed top-0 left-0 right-0 z-[110] pointer-events-none transition-opacity duration-300">
          <div className="w-full h-[3px] bg-[var(--surface)]/40 relative overflow-hidden shadow-xs">
            {topProgress.active && topProgress.percent !== undefined ? (
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-emerald-400 dark:from-amber-400 dark:via-amber-300 dark:to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(245,158,11,0.8)]"
                style={{ width: `${Math.max(5, Math.min(100, topProgress.percent))}%` }}
              />
            ) : (
              <div className="h-full w-full bg-[var(--glass-border)] relative overflow-hidden">
                <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-top-progress shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
              </div>
            )}
          </div>

          {/* Floating Subtle Feedback Pill */}
          {(topProgress.active
            ? topProgress.label
            : isBackgroundSyncingMemory
            ? 'Sincronizando memoria viva...'
            : null) && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)]/95 border border-[var(--glass-border)] text-[var(--accent)] text-[11px] font-cinzel font-semibold shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span className="truncate max-w-[220px] sm:max-w-xs">
                {topProgress.active ? topProgress.label : 'Sincronizando memoria viva...'}
              </span>
              {topProgress.active && topProgress.percent !== undefined && (
                <span className="text-[10px] opacity-75 font-mono">({topProgress.percent}%)</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {storageWarning && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[120] max-w-[560px] w-[calc(100%-1.5rem)] bg-amber-50 border border-amber-300 text-amber-950 rounded-lg shadow-lg px-3.5 py-2.5 flex items-start gap-2.5 text-xs font-lora">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          <span className="flex-1">{storageWarning}</span>
          <button
            onClick={() => setStorageWarning(null)}
            className="shrink-0 text-amber-800 hover:text-amber-950 cursor-pointer"
            title="Entendido"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isGenerating && !isStreamingTurn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[100] animate-[fadeIn_0.2s_ease]">
          <div className="bg-[var(--surface)] px-6 py-5 rounded-xl shadow-2xl border-2 border-[var(--accent)] flex items-center gap-4 max-w-lg mx-4">
            <div className="w-6 h-6 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="font-cinzel text-xs md:text-sm text-[var(--accent)] font-bold flex-1 tracking-wide">
              {loadingText || 'Procesando...'}
            </span>
            <button
              onClick={() => {
                setIsGenerating(false);
                setLoadingText('');
              }}
              className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] cursor-pointer transition-colors"
              title="Cancelar o cerrar espera"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Map Viewer Modal */}
      {selectedMapFile && (
        <Suspense fallback={null}>
          <MapViewer
            file={selectedMapFile}
            onClose={() => setSelectedMapFile(null)}
            onUpdateMarkers={handleUpdateMapMarkers}
          />
        </Suspense>
      )}

      {/* General Modals (Prompt, Confirm, Alert, API Key & Model, Install App PWA) */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        currentKey={getStoredApiKey()}
        onSaveKey={key => {
          setStoredApiKey(key);
        }}
        currentModel={getStoredModel()}
        onSaveModel={model => {
          setStoredModel(model);
        }}
      />

      {isInstallModalOpen && (
        <Suspense fallback={null}>
          <InstallAppModal
            isOpen={isInstallModalOpen}
            onClose={() => setIsInstallModalOpen(false)}
            deferredPrompt={deferredPrompt}
          />
        </Suspense>
      )}

      <LocalStorageModal
        isOpen={isLocalStorageModalOpen}
        onClose={() => setIsLocalStorageModalOpen(false)}
        projects={projects}
        currentProject={currentProject || null}
        currentChats={currentChats}
        currentFiles={currentFiles}
        onImportCampaignFile={processImportFile}
      />

      <ImportCampaignModal
        isOpen={isImportCampaignModalOpen}
        onClose={() => setIsImportCampaignModalOpen(false)}
        currentProject={currentProject || null}
        onConfirmImport={handleConfirmImportCampaign}
        onImportNativeFile={processImportFile}
      />

      <Modals
        promptConfig={promptConfig}
        setPromptConfig={setPromptConfig}
        confirmConfig={confirmConfig}
        setConfirmConfig={setConfirmConfig}
        alertConfig={alertConfig}
        setAlertConfig={setAlertConfig}
        promptValue={promptValue}
        setPromptValue={setPromptValue}
      />

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-35 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen
            ? 'w-[85vw] max-w-xs sm:w-80 md:w-88 translate-x-0'
            : 'w-0 -translate-x-full md:translate-x-0 md:w-0'
        } fixed md:relative inset-y-0 left-0 z-40 md:z-30 transition-all duration-300 ease-in-out bg-[var(--sidebar-bg)] border-r border-[var(--glass-border)] flex flex-col shrink-0 overflow-hidden shadow-2xl md:shadow-lg`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 md:p-4 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass)]">
          <h1 className="font-cinzel text-lg md:text-xl text-[var(--accent)] font-bold tracking-wider m-0">
            GM STUDIO
          </h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsImportCampaignModalOpen(true)}
              className="text-xs text-[var(--accent)] hover:underline font-cinzel transition-colors cursor-pointer px-2 py-1 flex items-center gap-1.5 rounded border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)]"
              title="Importar campaña desde PDF, Gemini, NotebookLM o JSON"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Importar</span>
            </button>
            <button
              onClick={() => setIsLocalStorageModalOpen(true)}
              className="text-xs text-[var(--accent)] hover:underline font-cinzel transition-colors cursor-pointer px-2 py-1 flex items-center gap-1.5 rounded border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)]"
              title="Copias de Seguridad y Almacenamiento Local"
            >
              <FolderSync className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Copias</span>
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden text-base text-[var(--text-secondary)] hover:text-[var(--accent)] p-1 cursor-pointer"
              title="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Campaign / Project Selector */}
        <div className="p-3 border-b border-[var(--glass-border)] flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-cinzel font-bold text-[var(--text-secondary)]">
            <span>TOMO ACTIVO</span>
            <button
              onClick={handleCreateProject}
              className="hover:text-[var(--accent)] cursor-pointer text-[11px] flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              <span>Nuevo</span>
            </button>
          </div>

          <div className="flex gap-1.5 items-center w-full min-w-0">
            <select
              value={currentPId || ''}
              onChange={e => {
                setCurrentPId(e.target.value);
                setCurrentChatId(null);
              }}
              className="flex-1 min-w-0 bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] border border-[var(--user-border)] p-2 rounded text-xs md:text-sm font-cinzel font-semibold text-[var(--accent)] outline-none cursor-pointer truncate"
            >
              {projects.length === 0 && <option value="">Sin Tomos</option>}
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {currentPId && (
              <button
                type="button"
                onClick={() => handleDeleteProject(currentPId)}
                className="p-2 shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10 border border-[var(--user-border)] hover:border-red-500/40 rounded transition-colors cursor-pointer flex items-center justify-center bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] shadow-xs"
                title="Eliminar campaña activa"
                aria-label="Eliminar campaña activa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Submenú de Campaña: Directivas, Archivos y Ajustes */}
        {currentProject && (
          <div className="p-3 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_25%,transparent)]">
            <div className="text-[10px] font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Campaña</span>
              <span className="text-[9px] opacity-70">Ajustes & Recursos</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  setActiveTab('instructions');
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-lg text-[11px] font-cinzel transition-all duration-200 cursor-pointer border active:scale-95 ${
                  activeTab === 'instructions'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold border-transparent shadow-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
                    : 'bg-[var(--glass)] border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                }`}
                title="Directivas de campaña: Sistema de rol, estilo de narración e instrucciones de juego"
              >
                <Scroll className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-[10px]">Directivas</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('files');
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-lg text-[11px] font-cinzel transition-all duration-200 cursor-pointer border active:scale-95 ${
                  activeTab === 'files'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold border-transparent shadow-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
                    : 'bg-[var(--glass)] border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                }`}
                title="Archivos y mapas de campaña"
              >
                <Paperclip className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-[10px]">Archivos ({currentFiles.length})</span>
              </button>

              <button
                onClick={() => {
                  setIsApiKeyModalOpen(true);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                className="flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-lg text-[11px] font-cinzel transition-all duration-200 cursor-pointer border bg-[var(--glass)] border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] active:scale-95 relative"
                title="Ajustes de Motor IA, Modelo, Filtros NSFW, Razonamiento y API Key"
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-[10px]">Ajustes</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full absolute top-1 right-1 ${hasConfiguredApiKey() ? 'bg-emerald-500' : 'bg-red-500'}`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Chapters / Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-cinzel font-bold text-[var(--text-secondary)] px-1 mb-1">
            <span>CAPÍTULOS ({currentChats.length})</span>
            <button
              onClick={handleCreateChat}
              disabled={!currentPId}
              className="hover:text-[var(--accent)] disabled:opacity-40 cursor-pointer text-[11px] flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              <span>Nuevo Capítulo</span>
            </button>
          </div>

          {currentChats.map(c => {
            const isSelected = c.id === currentChatId;
            return (
              <div
                key={c.id}
                onClick={() => {
                  setCurrentChatId(c.id);
                  setActiveTab('chat');
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={`group flex justify-between items-center px-3 py-2.5 rounded-lg text-xs md:text-sm transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold shadow-sm'
                    : 'text-[var(--text-primary)] hover:bg-[var(--glass)]'
                }`}
              >
                <span className="truncate flex-1 font-cinzel flex items-center gap-1.5" title={c.name}>
                  <Scroll className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{c.name}</span>
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteChat(c.id);
                  }}
                  className={`opacity-70 md:opacity-0 group-hover:opacity-100 p-1 text-xs hover:scale-110 transition-all cursor-pointer ${
                    isSelected ? 'text-white/80 hover:text-white' : 'text-red-600 hover:text-red-700'
                  }`}
                  title="Borrar sesión"
                  aria-label="Borrar sesión"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Estado del personaje: en escritorio vive aquí, en el hueco libre de la
            barra lateral, para no robarle altura a la narración. */}
        {currentProject && (
          <div className="hidden md:block">
            <CombatHud project={currentProject} variant="sidebar" />
          </div>
        )}


        {/* Real-time Token & Context Capacity Widget */}
        <ContextUsageWidget
          project={currentProject ?? null}
          files={currentFiles}
          chats={currentChats}
          currentChatId={currentChatId}
        />

        {/* User & Install Footer */}
        <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--glass)] flex items-center gap-2">
          <button
            onClick={() => setIsInstallModalOpen(true)}
            className="flex-1 text-xs font-cinzel font-bold px-2.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            title="Instalar GM Studio en este dispositivo (Web App PWA)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Instalar App</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-color)]">
        {/* Top Navbar */}
        <div className="h-13 md:h-14 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-color)_85%,transparent)] backdrop-blur-xs flex justify-between items-center px-2.5 md:px-4 shrink-0 shadow-xs gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded hover:bg-[var(--glass)] text-[var(--accent)] font-cinzel text-lg transition-colors cursor-pointer shrink-0"
              title="Mostrar/Ocultar Menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-cinzel text-xs sm:text-sm md:text-base text-[var(--accent)] font-bold truncate max-w-[110px] sm:max-w-[180px] md:max-w-[280px] m-0">
              {currentProject?.name || 'Selecciona un Tomo'}
            </h2>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {[
              { id: 'chat', label: 'Crónica', icon: Swords },
              { id: 'memory', label: 'Fichas', icon: ScrollText },
              {
                id: 'calendar',
                label: fechaBoton,
                icon: BookOpen,
                title: tituloFecha
              }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isCurrentActive =
                activeTab === tab.id || (tab.id === 'chat' && activeTab === 'novel');
              return (
                <button
                  key={tab.id}
                  title={(tab as { title?: string }).title || tab.label}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`font-cinzel text-xs px-2 sm:px-2.5 md:px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 relative ${
                    isCurrentActive
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)]'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.id === 'memory' && isBackgroundSyncingMemory && (
                    <span
                      className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5"
                      title="Actualizando memoria viva en segundo plano..."
                    />
                  )}
                </button>
              );
            })}

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-1 text-xs font-cinzel border border-[var(--user-border)] p-1.5 sm:px-2 rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] shadow-xs"
              title={theme === 'dark' ? 'Volver al tema de día' : 'Cambiar al tema de noche'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Tab Views */}
        <Suspense fallback={<ViewLoader />}>
          {activeTab === 'chat' && (
            <ChatView
              project={
                currentProject || {
                  id: '',
                  name: '',
                  instructions: '',
                  system: '',
                  style: '',
                  memory: {
                    story: '',
                    quests: [],
                    npcs: [],
                    locations: [],
                    current_status: '',
                    manual_notes: ''
                  },
                  chats: [],
                  files: []
                }
              }
              chat={currentChat}
              chapterIndex={currentChapterIndex >= 0 ? currentChapterIndex : 0}
              inputText={inputText}
              setInputText={setInputText}
              isGenerating={isGenerating}
              isStreaming={isStreamingTurn}
              streamingStatus={loadingText}
              onStopGeneration={handleStopGeneration}
              onSendMessage={handleSendMessage}
              onRollDice={handleRollDice}
              onRollRequest={handleRollRequest}
              onOracleAsk={handleOracleAsk}
              onOracleMeaning={handleOracleMeaning}
              hasOracle={currentFiles.some(f => f.category === 'oracle')}
              onFileUpload={handleFilesUpload}
              onExportPDF={handleExportPDF}
              onEditMessage={handleEditChatMessage}
              onRegenerateMessage={handleRegenerateChatMessage}
              onContinueNarrative={handleContinueNarrative}
              onDeleteMessage={handleDeleteChatMessage}
              onOpenNovelReader={() => setActiveTab('novel')}
              isBackgroundSyncing={isBackgroundSyncingMemory}
            />
          )}

          {activeTab === 'novel' && currentProject && (
            <NovelReaderView
              project={currentProject}
              chats={currentChats}
              currentChatId={currentChatId}
              onSelectChat={id => setCurrentChatId(id)}
              onBackToChat={() => setActiveTab('chat')}
            />
          )}

          {activeTab === 'memory' && currentProject && (
            <MemoryManager
              secciones={['character', 'npcs', 'locs', 'visual', 'quests']}
              project={currentProject}
              files={currentFiles}
              onUpdateMemory={handleUpdateMemory}
              onTriggerAIUpdate={handleTriggerAISyncMemory}
              onAnalyzeImageFile={handleAnalyzeImageFile}
              onUpdateFileAnalysis={handleUpdateFileAnalysis}
              onDeleteFileAnalysis={handleDeleteFileAnalysis}
              onOpenMap={file => setSelectedMapFile(file)}
              onAutoClassifyAll={handleAutoClassifyAll}
              onUploadEntityImage={handleUploadEntityImage}
              isGenerating={isGenerating}
              hasChats={currentChats.some(c =>
                (c.messages || []).some(
                  m =>
                    m.content &&
                    m.content.trim().length > 0 &&
                    m.content !== 'Pensando...' &&
                    m.content !== 'Tirando dados...'
                )
              )}
            />
          )}

          {activeTab === 'calendar' && currentProject && (
            <CalendarView
              project={currentProject}
              files={currentFiles}
              chats={currentChats}
              onUpdate={handleUpdateProjectField}
              onUpdateMemory={handleUpdateMemory}
              onTriggerAIUpdate={handleTriggerAISyncMemory}
              isGenerating={isGenerating}
              hasChats={currentChats.some(c =>
                (c.messages || []).some(
                  m =>
                    m.content &&
                    m.content.trim().length > 0 &&
                    m.content !== 'Pensando...' &&
                    m.content !== 'Tirando dados...'
                )
              )}
            />
          )}

          {activeTab === 'files' && currentProject && (
            <FilesView
              project={currentProject}
              files={currentFiles}
              onUpload={handleFilesUpload}
              onDeleteFile={handleDeleteFile}
              onOpenMap={file => setSelectedMapFile(file)}
              onAnalyzeImageFile={handleAnalyzeImageFile}
              onUpdateFileAnalysis={handleUpdateFileAnalysis}
              onDeleteFileAnalysis={handleDeleteFileAnalysis}
              onUpdateFileCategory={handleUpdateFileCategory}
              onToggleOnDemand={handleToggleOnDemand}
              onDistillOracle={handleDistillOracle}
              onAutoClassifyAll={handleAutoClassifyAll}
              onExtractPlayerCharacter={handleExtractPlayerCharacter}
              onExtractCompanion={handleExtractCompanion}
              onExtractNpc={handleExtractNpc}
              onCreateNpcFromImage={handleCreateNpcFromImage}
              onUsePortraitAsPc={handleUsePortraitAsPc}
              isGenerating={isGenerating}
              extractingFileIds={extractingFileIds}
            />
          )}

          {activeTab === 'instructions' && currentProject && (
            <InstructionsView
              project={currentProject}
              onUpdate={handleUpdateProjectField}
              onRequestConfirm={(message, onConfirm) => {
                setConfirmConfig({
                  isOpen: true,
                  message,
                  onConfirm
                });
              }}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
