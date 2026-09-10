import { useState, useEffect, useRef, Suspense } from 'react';
import {
  BookOpen,
  Check,
  FolderSync,
  Menu,
  Moon,
  Paperclip,
  BookCheck,
  Plus,
  Save,
  Scroll,
  ScrollText,
  Sliders,
  Smartphone,
  Sparkles,
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
  PlayerCharacter,
  ScheduledThread,
  TimelineEntry
} from './types';
import { ChatView } from './components/ChatView';
import { ContextUsageWidget } from './components/ContextUsageWidget';
import { Modals, PromptConfig, ConfirmConfig, AlertConfig, ApiKeyModal } from './components/Modals';

import { SimpleMemoryView } from './components/SimpleMemoryView';
import { FilesView } from './components/FilesView';
import { InstructionsView } from './components/InstructionsView';
import { NovelReaderView } from './components/NovelReaderView';
import { MesaView } from './components/MesaView';
import { OpcionesDeTransicion } from './components/SceneTransitionModal';
import { recargarConLaVersionNueva, vigilarVersion } from './utils/versionCheck';
import { MapViewer } from './components/MapViewer';
import { InstallAppModal } from './components/InstallAppModal';
import { LocalStorageModal } from './components/LocalStorageModal';
import { ImportCampaignModal } from './components/ImportCampaignModal';
import { Logger } from './components/Logger';
import { logError, logInfo, logWarn } from './utils/logger';
import { sanitizeProjectMemory } from './utils/sanitizers';
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
  limpiarParaMostrar,
  refrescarCatalogoEnSegundoPlano,
  TiempoReportado,
  analyzeUploadedImage,
  extractNpcsFromDocument,
  describeApiError,
  classifyApiError,
  destilarTablaOraculo,
  classifyFileAuto,
  getStoredApiKey,
  setStoredApiKey,
  setStoredApiKeys,
  hasConfiguredApiKey,
  AVAILABLE_MODELS,
  getStoredModel,
  setStoredModel,
  setStoredBackgroundModel,
  setStoredSafetyLevel,
  setStoredThinkingLevel,
  setStoredTemperature,
  setStoredTopP,
  setStoredAutoFailover,
  setStoredKeyRotationMode,
  syncFullCampaignFromChats,
  fusionarTimeline,
  consolidarCronicaAlCerrarCapitulo,
  AVISO_TOKENS_POR_MINUTO,
  estimarCargaDelTurno,
  generateClaudeProjectMemory,
  tramarLaCampana,
  extraerIdentidadDeDocumentos,
  fusionarTrama,
  isNarrativeIncomplete,
  novelizeUserMessage,
  generarNoticiasSaltoTemporal
} from './utils/geminiHelper';
import { backgroundHeartbeat } from './utils/backgroundHeartbeat';
import { DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE } from './utils/defaultDirectives';
import { RollRequest, rollDie } from './utils/rollRequests';
import { Probabilidad, formatoSignificado, nuevaConsulta } from './utils/oracle';
import {
  AvanceDeNivel,
  aDiaAbsoluto,
  avanzar,
  calendarioValido,
  DIAS_PARA_SER_RECURRENTE,
  desdeDiaAbsoluto,
  extraerMinutoDeTexto,
  fechaLegible,
  iconoDeHito,
  obtenerInfoRelacion,
  parsearFechaTexto
} from './utils/campaignCalendar';
import { actualizarAfinidadNpc } from './utils/affinityProgression';
import { coincidenNombresNpc, deduplicarListaNpcs } from './utils/npcMatcher';

const ViewLoader = () => (
  <div className="flex-1 flex items-center justify-center p-10 text-[var(--text-secondary)] font-cinzel text-sm italic gap-2">
    <span className="inline-block w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    Desplegando pergaminos...
  </div>
);

/**
 * El titular de una anotación del diario cuando el Narrador no ha dado ninguno:
 * la primera frase del resumen, recortada para que quepa en una celda.
 */
const primeraFrase = (texto?: string): string | undefined => {
  const limpio = (texto || '').trim();
  if (!limpio) return undefined;
  const corte = limpio.search(/[.;:!?]\s/);
  const frase = corte > 0 ? limpio.slice(0, corte) : limpio;
  return frase.length > 70 ? `${frase.slice(0, 67).trimEnd()}…` : frase;
};

const LOCAL_PROJECTS_KEY = 'gmstudio_local_projects';
const LOCAL_CHATS_PREFIX = 'gmstudio_local_chats_';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentPId, setCurrentPId] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentChats, setCurrentChats] = useState<Chat[]>([]);
  const [currentFiles, setCurrentFiles] = useState<ProjectFile[]>([]);

  // Refs siempre sincronizados para garantizar persistencia síncrona al cerrar/ocultar el navegador
  const projectsRef = useRef(projects);
  const currentPIdRef = useRef(currentPId);
  const currentChatsRef = useRef(currentChats);
  const currentFilesRef = useRef(currentFiles);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  useEffect(() => {
    currentPIdRef.current = currentPId;
  }, [currentPId]);
  useEffect(() => {
    currentChatsRef.current = currentChats;
  }, [currentChats]);
  useEffect(() => {
    currentFilesRef.current = currentFiles;
  }, [currentFiles]);

  const [activeTab, setActiveTab] = useState<
    'chat' | 'files' | 'memory' | 'instructions' | 'novel' | 'mesa'
  >('chat');
  /*
   * Aviso de versión nueva.
   *
   * Los archivos llevan hash, así que lo único que se queda viejo es el
   * `index.html`; y una aplicación instalada guarda su propia copia del
   * arranque. El resultado era abrir la app y seguir viendo la de ayer sin que
   * nada lo dijera. Ahora se comprueba y se ofrece recargar de verdad.
   */
  const [hayActualizacion, setHayActualizacion] = useState(false);
  // Apartar el aviso lo silencia media hora; antes lo apagaba hasta reabrir.
  const apartarAvisoRef = useRef<(() => void) | null>(null);
  // Cuándo se intentó trazar la historia de cada campaña, para no reintentarlo
  // en cada turno si algo falla.
  const intentoDeTrazadoRef = useRef<Record<string, number>>({});
  useEffect(
    () =>
      vigilarVersion(
        () => setHayActualizacion(true),
        apartar => {
          apartarAvisoRef.current = apartar;
        }
      ),
    []
  );

  const [isGenerating, setIsGenerating] = useState(false);
  // Controlador de la generación en curso, para poder detenerla desde la interfaz.
  const generationAbortRef = useRef<AbortController | null>(null);
  const wakeLockRef = useRef<any>(null);
  // El texto que aún no se ha pintado, y el repintado ya pedido al navegador.
  const textoPendienteRef = useRef<string | null>(null);
  const repintadoPedidoRef = useRef<number | null>(null);
  const onVolverVisibleRef = useRef<(() => void) | null>(null);
  // Un turno de narración NO bloquea la pantalla: hay que poder leer cómo se
  // escribe. El velo se reserva para tareas que sí impiden seguir (subidas,
  // exportar a PDF).
  const [isStreamingTurn, setIsStreamingTurn] = useState(false);
  // Sincronización de memoria en segundo plano bajo petición manual
  const [isSyncingMemory, setIsSyncingMemory] = useState(false);
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
  const [currentActiveModel, setCurrentActiveModel] = useState<string>(() => getStoredModel());
  const [isLocalStorageModalOpen, setIsLocalStorageModalOpen] = useState(false);
  const [isImportCampaignModalOpen, setIsImportCampaignModalOpen] = useState(false);
  const [topProgress, setTopProgress] = useState<{
    active: boolean;
    percent?: number;
    label?: string;
    type?: 'upload' | 'sync' | 'analysis' | 'general';
  }>({ active: false });

  // Monitoreo de carga de tokens por capítulo para advertencias proactivas (tope 250k de Google)
  const [chatTokenLoads, setChatTokenLoads] = useState<Record<string, number>>({});

  // Protección del almacenamiento: sin esto el navegador puede borrar la campaña
  // por su cuenta cuando anda justo de espacio.
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [isManuallySaved, setIsManuallySaved] = useState(false);

  const handleManualSaveCampaign = async () => {
    try {
      if (projects.length > 0) {
        saveLocalProjects(projects);
      }
      if (currentPId) {
        saveLocalChats(currentPId, currentChats);
        await saveFilesToDB(currentPId, currentFiles);
      }
      if (currentProject) {
        await writeCampaignToDisk(currentProject, currentChats, currentFiles).catch(() => {});
      }
      setIsManuallySaved(true);
      setTimeout(() => {
        setIsManuallySaved(false);
      }, 2500);
    } catch (e) {
      console.error('Error al guardar manualmente la campaña:', e);
    }
  };


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

  // 0. Auto-flush inmediato en cierre de navegador, cambio de pestaña o background móvil
  useEffect(() => {
    const flushCurrentState = () => {
      const projs = projectsRef.current;
      const pId = currentPIdRef.current;
      const chs = currentChatsRef.current;
      if (projs && projs.length > 0) {
        try {
          const sanitized = sanitizeProjectsForLocalStorage(projs);
          localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(sanitized));
        } catch (e) {
          // ignore quota
        }
      }
      if (pId && chs && chs.length > 0) {
        try {
          localStorage.setItem(`${LOCAL_CHATS_PREFIX}${pId}`, JSON.stringify(chs));
        } catch (e) {
          // ignore quota
        }
        saveChatsToDB(pId, chs).catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushCurrentState();
      }
    };

    window.addEventListener('beforeunload', flushCurrentState);
    window.addEventListener('pagehide', flushCurrentState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', flushCurrentState);
      window.removeEventListener('pagehide', flushCurrentState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    // Preguntar a Google qué modelos admite la clave, como mucho una vez al día
    // y sin bloquear nada. Así la lista deja de envejecer en el código.
    refrescarCatalogoEnSegundoPlano();

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
                locations: (p.memory?.locations || []).filter(l => l.name !== 'La Posada del Cuervo Gris')
              }
            };
          }

          // Auto-deduplicación higiénica de PNJs (ej: fusionar "Jarlaxle" y "Jarlaxle Baenre" existentes)
          if (p.memory?.npcs && p.memory.npcs.length > 1) {
            const limpios = deduplicarListaNpcs(p.memory.npcs);
            if (limpios.length !== p.memory.npcs.length) {
              modified = true;
              p = {
                ...p,
                memory: {
                  ...p.memory,
                  npcs: limpios
                }
              };
            }
          }

          // Higienización de ficha de personaje (OC) y memoria viva contra textos corruptos
          const sanitizedMem = sanitizeProjectMemory(p.memory);
          if (JSON.stringify(sanitizedMem) !== JSON.stringify(p.memory)) {
            modified = true;
            p = {
              ...p,
              memory: sanitizedMem
            };
          }

          // Migración y actualización automática de directivas del DM si el proyecto tiene la versión previa
          if (
            !p.instructions ||
            (p.instructions.includes('# Instrucciones de Sistema') &&
              (!p.instructions.includes('8.1 Montaje Alterno') ||
                !p.instructions.includes('Principio de Progresión en Bambalinas') ||
                !p.instructions.includes('⭐ 00. CARGA DE CONTEXTO') ||
                !p.instructions.includes('Arraigo en el Mundo e Interconexión de Faerûn') ||
                !p.instructions.includes('8.2 Protocolo de Transición de Escena')))
          ) {
            modified = true;
            if (!p.instructions) {
              p = { ...p, instructions: DEFAULT_DM_INSTRUCTIONS };
            } else if (p.instructions.includes('### Directivas de la Campaña Importada')) {
              const customPart = p.instructions.split('### Directivas de la Campaña Importada')[1] || '';
              p = {
                ...p,
                instructions: `${DEFAULT_DM_INSTRUCTIONS}\n\n### Directivas de la Campaña Importada${customPart}`
              };
            } else {
              p = { ...p, instructions: DEFAULT_DM_INSTRUCTIONS };
            }
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
        return { memory: mem };
      }

      const hoyAbs = aDiaAbsoluto(cal, fecha);

      let threads: ScheduledThread[] = (p.threads || []).map(h =>
        h.status === 'pending' && h.dueAbsDay <= hoyAbs ? { ...h, status: 'fired' as const } : h
      );

      const porElReloj = t.minutos > 0 ? avanzar(cal, fecha, { minutos: t.minutos }) : fecha;

      /*
       * LA FECHA DEL CHAT MANDA SOBRE LA DEL CALENDARIO.
       *
       * El Narrador escribe la fecha en la cabecera de HUD de cada escena, y es
       * la que la jugadora está leyendo. Si esa fecha va por delante de la que
       * lleva la aplicación —porque se narró un salto de días y la etiqueta
       * [TIEMPO: +Xd] se quedó corta o no llegó—, el que está equivocado es el
       * calendario. Se adelanta hasta ahí y así el chat y el calendario dicen
       * el mismo día.
       *
       * Solo hacia delante y solo si el salto es plausible: una fecha absurda
       * no arrastra la campaña a ninguna parte, y retroceder rompería todo lo
       * ya anotado.
       */
      const nuevaFecha = (() => {
        if (!t.fechaHud) return porElReloj;
        const absReloj = aDiaAbsoluto(cal, porElReloj);
        for (const ano of [porElReloj.year, porElReloj.year + 1]) {
          const leida = parsearFechaTexto(cal, t.fechaHud, ano);
          if (!leida) continue;
          const absHud = aDiaAbsoluto(cal, { ...leida, year: ano });
          if (absHud > absReloj && absHud - absReloj <= 90) {
            const minutoHud = extraerMinutoDeTexto(t.momentoHud);
            return { year: ano, dayOfYear: leida.dayOfYear, minute: minutoHud ?? porElReloj.minute };
          }
        }
        return porElReloj;
      })();

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

      /*
       * Al re-tirar un turno, el Narrador vuelve a emitir sus [AGENDA:] y antes
       * se apuntaban OTRA VEZ encima de las de la versión anterior: la misma
       * escena, dos veces en el diario. Las entradas en vivo van clavadas a su
       * mensaje del chat, así que las de ese mensaje se reemplazan en bloque en
       * lugar de acumularse. Lo escrito a mano por la jugadora nunca se toca.
       */
      const anclaDeEsteMensaje = msgInfo?.msgIndex;
      const timelinePrevioSinEsteMensaje =
        anclaDeEsteMensaje === undefined
          ? p.timeline || []
          : (p.timeline || []).filter(
              e =>
                e.autoria === 'jugadora' ||
                e.tipo === 'diario' ||
                !!e.images?.length ||
                !(e.chatId === (currentChatId || undefined) && e.msgIndex === anclaDeEsteMensaje)
            );

      const timelineCompleto = [
        ...timelinePrevioSinEsteMensaje,
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

          let resolvedMinute = entrada.minute;
          if (resolvedMinute === undefined || resolvedMinute === null) {
            // El lugar queda fuera del rastreo: un nombre propio como «Posada del
            // Mediodía» no dice a qué hora ocurrió nada.
            const extracted = extraerMinutoDeTexto(`${entrada.resumen} ${entrada.hito || ''}`);
            if (extracted !== null) {
              resolvedMinute = extracted;
            } else {
              const baseMin =
                (entryAbsDay === nuevoAbs
                  ? nuevaFecha.minute
                  : entryAbsDay === hoyAbs
                  ? fecha.minute
                  : 540) || 540;
              resolvedMinute = Math.min(1439, baseMin + i * 90);
            }
          }

          return {
            id: `dia_${entryAbsDay}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            absDay: entryAbsDay,
            date: fechaLegible(cal, entryFecha),
            // Sin titular, la celda del calendario se queda muda y el diario
            // enseña el resumen entero. Si el Narrador no lo da, se toma la
            // primera frase del resumen, que es de donde saldría a mano.
            title: entrada.titulo || primeraFrase(entrada.resumen),
            summary: entrada.resumen,
            lugar: entrada.lugar,
            clima: entrada.clima,
            hito: entrada.hito,
            mood: entrada.mood || iconoDeHito(entrada.hito) || '📖',
            autoria: 'narrador' as const,
            minute: resolvedMinute,
            tipo: entrada.tipo,
            timeSkipDays: diasDeDiferencia >= 2 ? diasDeDiferencia : undefined,
            chatId: currentChatId || undefined,
            msgId: msgInfo?.msgId,
            msgIndex: msgInfo?.msgIndex
          };
        })
      ];

      /*
       * El diario tenía un tope de 500 entradas aplicado con `.slice(-500)`: al
       * pasarlo, las más viejas se caían sin avisar. En una campaña larga eso es
       * perder el principio de la crónica, y desde que existen las notas podía
       * llevarse por delante lo escrito a mano, que no se puede recuperar de
       * ningún sitio.
       *
       * El tope sigue existiendo —esto vive en el navegador y no puede crecer
       * sin fin— pero sube, y lo que escribió la jugadora nunca entra en el
       * sorteo: si hay que soltar lastre, se suelta de lo que el Narrador puede
       * volver a deducir de los chats.
       */
      const TOPE_DIARIO = 2000;
      let timeline = timelineCompleto;
      if (timelineCompleto.length > TOPE_DIARIO) {
        const esDeLaJugadora = (t: TimelineEntry) =>
          t.autoria === 'jugadora' || (!t.autoria && t.id.startsWith('manual_'));
        const notas = timelineCompleto.filter(esDeLaJugadora);
        const delNarrador = timelineCompleto.filter(t => !esDeLaJugadora(t));
        const sitioRestante = Math.max(0, TOPE_DIARIO - notas.length);
        timeline = [...notas, ...delNarrador.slice(-sitioRestante)].sort(
          (a, b) => a.absDay - b.absDay
        );
      }

      let mem = conVinculos(p, hoyAbs);
      mem = conAvanceDeNivel(mem, t.avanceDeNivel);

      return { currentDate: nuevaFecha, threads, timeline, memory: mem };
    });
  };

  /**
   * Guarda el avance por hitos que el Narrador ha anotado este turno.
   *
   * Las instrucciones del Director exigen desde siempre una línea
   * `[Avance: 2/3 hacia Nivel 3]` al cerrar sesión, con el argumento de que sin
   * ella el progreso se evapora y el personaje se queda congelado. Tenían razón
   * y pasaba exactamente eso: nadie la leía, así que la cuenta vivía en la
   * cabeza del modelo y se perdía al cambiar de capítulo.
   *
   * El porcentaje se calcula a partir de la fracción real, no se estima. Si el
   * Narrador anuncia la subida con `[NIVEL: 4]`, se cambia el nivel y la cuenta
   * de hitos vuelve a cero, que es lo que significa haber subido.
   */
  const conAvanceDeNivel = (mem: Project['memory'], avance?: AvanceDeNivel): Project['memory'] => {
    if (!avance || !mem) return mem;
    const pc = mem.player_character;
    if (!pc) return mem;

    const subeDeNivel = Boolean(avance.nivelAlcanzado);
    const hitos = subeDeNivel ? 0 : avance.hitos;
    const necesarios = avance.necesarios ?? pc.hitosParaSubir;

    const actualizado: PlayerCharacter = {
      ...pc,
      level: avance.nivelAlcanzado || pc.level,
      hitosActuales: hitos ?? pc.hitosActuales,
      hitosParaSubir: necesarios,
      levelProgress:
        hitos !== undefined && necesarios
          ? Math.max(0, Math.min(100, Math.round((hitos / necesarios) * 100)))
          : subeDeNivel
          ? 0
          : pc.levelProgress
    };

    if (subeDeNivel) {
      logInfo(
        'memory_sync',
        `Subida de nivel: ${avance.nivelAlcanzado}`,
        `El Narrador ha anunciado la subida a ${avance.nivelAlcanzado}. La cuenta de hitos vuelve a empezar.`
      );
    }

    return { ...mem, player_character: actualizado };
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
    if (
      !t ||
      (!t.presentes.length && !t.vinculos.length && !t.revelaciones.length && !t.secretos.length && !t.viaje)
    )
      return p.memory;

    const mem = p.memory || {
      story: '',
      quests: [],
      npcs: [],
      locations: [],
      current_status: '',
    };

    // Sin calendario no hay días, así que se cuenta por escenas narradas: da la
    // misma progresión —hace falta volver— sin depender de que lleves el tiempo.
    const marca = calendarioValido(p.calendar)
      ? diaActual
      : currentChats.reduce((a, c) => a + (c.messages || []).length, 0);

    const npcs = (mem.npcs || []).map(n => {
      let cambiado = n;
      const presenteHoy = t.presentes.some(nombre =>
        coincidenNombresNpc(nombre, n.name, undefined, { alias: n.alias, trueIdentity: n.trueIdentity })
      );
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

      const v = t.vinculos.find(x =>
        coincidenNombresNpc(x.nombre, n.name, undefined, { alias: n.alias, trueIdentity: n.trueIdentity })
      );
      if (v) {
        let newRelation = cambiado.relation;
        if (v.vinculo) {
          const relInfo = obtenerInfoRelacion(v.vinculo);
          // Si la relación actual es genérica o vacía, adoptar la inferida del vínculo
          if (!newRelation || /aliado|neutral|desconocido|contacto|conocido/i.test(newRelation)) {
            newRelation = `${relInfo.icono} ${relInfo.label}`;
          }
        }

        // Si el nombre reportado es más completo/específico (ej: "Jarlaxle Baenre" vs "Jarlaxle"), actualizarlo
        const nombreMasCompleto =
          v.nombre && v.nombre.length > cambiado.name.length && coincidenNombresNpc(v.nombre, cambiado.name)
            ? v.nombre
            : cambiado.name;

        // Lógica de progresión escalonada (1-20 / 5 corazones) con límite diario de subidas
        const afinidadActualizada = actualizarAfinidadNpc(cambiado, v, dias, marca);

        cambiado = {
          ...cambiado,
          name: nombreMasCompleto,
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

      /*
       * El secreto que ha salido a la luz en esta escena.
       *
       * A partir de aquí deja de ir con candado en el dosier del Narrador: es
       * algo que el protagonista sabe, con lo que se puede contar y que puede
       * tener consecuencias. Solo se marca una vez —la primera— para que
       * quede la fecha en que se supo y no la del último turno que lo mencione.
       */
      const rev = t.revelaciones.find(x =>
        coincidenNombresNpc(x.nombre, cambiado.name, undefined, {
          alias: cambiado.alias,
          trueIdentity: cambiado.trueIdentity
        })
      );
      if (rev && cambiado.oculta && !cambiado.secretoRevelado) {
        cambiado = {
          ...cambiado,
          secretoRevelado: {
            diaAbs: calendarioValido(p.calendar) ? diaActual : undefined,
            fecha:
              calendarioValido(p.calendar) && p.currentDate
                ? fechaLegible(p.calendar, p.currentDate)
                : undefined,
            como: rev.como
          }
        };
      }

      return cambiado;
    });

    /*
     * Los giros de la campaña: los que se plantan y los que se destapan.
     *
     * Van aparte de los PNJs porque no son de nadie. Una idea de la jugadora
     * —«los dueños del barco son Zhentarim»— antes no tenía dónde guardarse: o
     * se contaba de pasada en la prosa, o se perdía. Ahora queda registrada con
     * candado y solo se abre cuando sale en escena.
     */
    let secretosDeCampana = [...(mem.gm_secrets || [])];
    const claveSecreto = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

    t.secretos.forEach(nuevo => {
      const clave = claveSecreto(nuevo.titulo);
      const ya = secretosDeCampana.find(x => claveSecreto(x.titulo) === clave);
      if (ya) {
        // Replantar uno que ya existe solo puede AMPLIARLO, nunca reescribir el
        // giro original ni resucitar uno que ya se destapó.
        secretosDeCampana = secretosDeCampana.map(x =>
          x === ya
            ? { ...x, comoSeDescubre: x.comoSeDescubre || nuevo.comoSeDescubre, secreto: x.secreto || nuevo.secreto }
            : x
        );
        return;
      }
      secretosDeCampana.push({
        id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        titulo: nuevo.titulo,
        secreto: nuevo.secreto,
        comoSeDescubre: nuevo.comoSeDescubre,
        origen: 'narrador'
      });
    });

    t.revelaciones.forEach(rev => {
      const clave = claveSecreto(rev.nombre);
      secretosDeCampana = secretosDeCampana.map(sec =>
        claveSecreto(sec.titulo) === clave && !sec.revelado
          ? {
              ...sec,
              revelado: {
                diaAbs: calendarioValido(p.calendar) ? diaActual : undefined,
                fecha:
                  calendarioValido(p.calendar) && p.currentDate
                    ? fechaLegible(p.calendar, p.currentDate)
                    : undefined,
                como: rev.como
              }
            }
          : sec
      );
    });

    const nuevosNpcs: NPC[] = [];

    /*
     * Quien sale en escena queda fichado, aunque no pase nada entre ellos.
     *
     * Solo se creaba ficha con [VÍNCULO:], que el Narrador emite cuando la
     * relación avanza de verdad. Así que un personaje podía aparecer cinco
     * escenas seguidas —hablar, vender, vigilar— y no existir para la
     * aplicación. La alternativa que había era extraer los PNJs de un documento
     * a mano y por lotes, y eso deja cuarenta y dos fichas de gente que no se
     * ha conocido: una lista de nombres que se descubren leyendo la pantalla en
     * vez de jugando.
     *
     * Con esto el elenco se construye SOLO y en el orden correcto: entra quien
     * pisa la escena, cuando la pisa. Lo demás sigue en los documentos, que es
     * donde el Narrador puede consultarlo sin que nadie se destripe nada.
     */
    t.presentes.forEach(nombre => {
      const limpio = (nombre || '').trim();
      // Un nombre propio de verdad, no «el tabernero» ni «los guardias».
      if (limpio.length < 3 || limpio.length > 60) return;
      if (!/^[\p{Lu}]/u.test(limpio)) return;
      if (npcs.some(n => coincidenNombresNpc(n.name, limpio, { alias: n.alias, trueIdentity: n.trueIdentity }))) return;
      if (nuevosNpcs.some(n => coincidenNombresNpc(n.name, limpio))) return;
      if (t.vinculos.some(v => coincidenNombresNpc(v.nombre, limpio))) return; // ese lo crea el vínculo, con más datos
      if (coincidenNombresNpc(limpio, mem.player_character?.name || '')) return;

      nuevosNpcs.push({
        id: `npc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: limpio,
        relation: 'Neutral',
        status: 'Vivo',
        notes: 'Apareció en escena.',
        diasVistos: [marca]
      });
    });

    // Si hay un vínculo nuevo para un PNJ que aún no figuraba en la lista, registrarlo automáticamente
    t.vinculos.forEach(v => {
      if (
        v.nombre &&
        // El protagonista no es un PNJ. Esta guarda estaba en el camino de
        // [PRESENTES:] pero faltaba aquí, así que un [VÍNCULO:] con su nombre
        // le abría ficha propia.
        !coincidenNombresNpc(v.nombre, mem.player_character?.name || '') &&
        !npcs.some(n => coincidenNombresNpc(n.name, v.nombre, { alias: n.alias, trueIdentity: n.trueIdentity })) &&
        !nuevosNpcs.some(n => coincidenNombresNpc(n.name, v.nombre))
      ) {
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

    const npcsDeduplicados = deduplicarListaNpcs([...npcs, ...nuevosNpcs]);
    /*
     * El trayecto largo en marcha.
     *
     * Zarpar lo declara el Narrador con [VIAJE: destino | jornadas: N] y llegar
     * con [VIAJE: fin]. Entre medias, la aplicación cuenta los días y se lo
     * recuerda en cada turno. Sin esta cuenta, «de las Moonshae a Luskan hay
     * 8-12 días» era una frase en las directivas que la travesía entera se
     * saltó en una sola noche.
     */
    let viajeEnCurso = mem.viaje;
    if (t.viaje) {
      if (t.viaje.fin) {
        viajeEnCurso = undefined;
      } else if (t.viaje.destino && t.viaje.jornadas) {
        // Re-declarar el mismo destino no reinicia el contador: el día en que se
        // zarpó es el que manda, y si no, cada recordatorio alargaría el viaje.
        const mismoDestino =
          mem.viaje?.destino?.toLowerCase().trim() === t.viaje.destino.toLowerCase().trim();
        viajeEnCurso = mismoDestino
          ? { ...mem.viaje!, jornadas: t.viaje.jornadas }
          : { destino: t.viaje.destino, jornadas: t.viaje.jornadas, iniciadoAbs: diaActual };
      }
    }

    return {
      ...mem,
      npcs: npcsDeduplicados,
      gm_secrets: secretosDeCampana,
      viaje: viajeEnCurso
    };
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
      memory: sanitizeProjectMemory(
        updater(
          p.memory || {
            story: '',
            quests: [],
            npcs: [],
            locations: [],
            current_status: '',
          }
        )
      )
    }));
  };

  /**
   * Deja la crónica al día con el capítulo que se acaba de cerrar.
   *
   * Va en segundo plano a propósito: cerrar un capítulo tiene que ser
   * instantáneo. Si la consolidación fallara —sin clave, sin cuota, sin red— no
   * pasa nada grave: la crónica se queda como estaba y la sincronización
   * general la pondrá al día cuando toque. Por eso no interrumpe con un aviso;
   * se apunta en el registro y ya.
   */
  const consolidarCronicaEnSegundoPlano = async (pId: string, capitulo: Chat, proyecto: Project) => {
    if (!hasConfiguredApiKey()) return;
    setTopProgress({ active: true, label: 'Poniendo la crónica al día…', type: 'sync' });
    try {
      const cronica = await consolidarCronicaAlCerrarCapitulo({ project: proyecto, capitulo });
      if (!cronica) return;
      /*
       * Se actualiza por id y con el estado más reciente, no con el que hubiera
       * cuando arrancó la petición: entre que se pide y se responde, la jugadora
       * puede haber cambiado de campaña o seguido escribiendo.
       */
      setProjects(prev => {
        const actualizados = prev.map(p =>
          p.id === pId
            ? { ...p, memory: sanitizeProjectMemory({ ...(p.memory || {}), story: cronica }) }
            : p
        );
        saveLocalProjects(actualizados);
        return actualizados;
      });
      logInfo(
        'memory_sync',
        `Crónica actualizada al cerrar «${capitulo.name}»`,
        `La crónica de la campaña se ha reescrito incorporando el capítulo (${cronica.length} caracteres).`,
        { projectName: proyecto.name }
      );
    } catch (err) {
      logWarn(
        'memory_sync',
        'No se pudo poner la crónica al día al cerrar el capítulo',
        describeApiError(err)
      );
    } finally {
      setTopProgress({ active: false, label: '' });
    }
  };

  /**
   * Guarda lo que el Director haya apuntado desde la mesa.
   *
   * Van a `memory_edits`, que es donde viven las instrucciones de «recuerda
   * esto» y viajan en TODOS los turnos de partida marcadas como de
   * cumplimiento obligatorio. Por eso hay tope: cincuenta notas es de sobra
   * para llevar las manías de una campaña, y más que eso deja de ser memoria
   * para convertirse en un impuesto sobre cada petición. Al pasarse se sueltan
   * las más antiguas, que es el orden en que dejan de importar.
   *
   * Se marcan con `source: 'ai'` —un campo que ya existía sin usar— para poder
   * distinguir de un vistazo lo que apuntó el Director de lo que escribiste tú.
   */
  const TOPE_NOTAS_DE_MEMORIA = 50;

  /*
   * Un giro contado en el chat del GM se guarda como secreto, no como memoria.
   *
   * La memoria persistente viaja en cada turno y la lee la jugadora en su
   * pantalla: un giro ahí es un giro destripado. Los secretos van con candado,
   * solo al Narrador, y se abren cuando salgan jugando.
   */
  const plantarSecretosDesdeLaMesa = (nuevos: { titulo: string; secreto: string; comoSeDescubre?: string }[]) => {
    if (!nuevos.length) return;
    handleUpdateMemory(mem => {
      const clave = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      const previos = mem.gm_secrets || [];
      const añadir = nuevos
        .filter(n => !previos.some(p => clave(p.titulo) === clave(n.titulo)))
        .map(n => ({
          id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          titulo: n.titulo,
          secreto: n.secreto,
          comoSeDescubre: n.comoSeDescubre,
          origen: 'jugadora' as const
        }));
      return añadir.length ? { ...mem, gm_secrets: [...previos, ...añadir] } : mem;
    });
  };

  const anotarEnMemoriaDesdeLaMesa = (notas: string[]) => {
    if (!notas.length) return;
    handleUpdateMemory(mem => {
      const previas = mem.memory_edits || [];
      const yaEstan = new Set(previas.map(e => e.text.trim().toLowerCase()));
      const nuevas = notas
        .filter(n => !yaEstan.has(n.trim().toLowerCase()))
        .map((text, i) => ({
          id: `mesa_${Date.now()}_${i}`,
          text,
          createdAt: Date.now(),
          source: 'ai' as const
        }));
      if (!nuevas.length) return mem;
      return { ...mem, memory_edits: [...previas, ...nuevas].slice(-TOPE_NOTAS_DE_MEMORIA) };
    });
  };

  // Chapter / Chat Management
  const handleCreateChat = () => {
    if (!currentPId || !currentProject) return;

    /*
     * AL CERRAR CAPÍTULO YA NO SE PEGA NADA A LA MEMORIA.
     *
     * Aquí se cogían los seis últimos mensajes del Narrador, se juntaban y se
     * añadían al final de `memory.story` cortados a 1.500 caracteres. Tres
     * cosas iban mal, y la tercera es la que zanja el asunto:
     *
     * 1. No era un resumen. Eran los últimos párrafos en bruto, cortados a
     *    mitad de palabra. Guardaba el final del capítulo, no el capítulo.
     * 2. Crecía sin freno. `story` viaja en CADA turno, así que cada capítulo
     *    cerrado añadía unos cuatrocientos tokens permanentes a todos los
     *    turnos siguientes, para siempre.
     * 3. Y no servía de nada: `syncFullCampaignFromChats` REEMPLAZA `story`
     *    con su versión consolidada (`story: parsed.story || ...`). O sea que
     *    todo lo acumulado aquí desaparecía en la siguiente sincronización.
     *    Engordaba cada petición hasta que algo lo borraba en silencio.
     *
     * Lo que de verdad conserva la campaña ya existe y está mejor hecho: el
     * `story` que reescribe la sincronización, el diario día a día, y los PNJs,
     * tramas y lugares de la memoria viva. Un pegado que no sobrevive a la
     * primera sincronización no es memoria persistente; es lastre.
     *
     * (Consolidar de verdad al cerrar —resumen generado y `story` reescrita con
     * un tope— es trabajo aparte, y va con la revisión de la memoria.)
     */

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

    // Y con el capítulo ya cerrado detrás, se pone la crónica al día.
    const capituloCerrado = currentChat;
    if (capituloCerrado && (capituloCerrado.messages || []).length > 0) {
      void consolidarCronicaEnSegundoPlano(currentPId, capituloCerrado, currentProject);
    }
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

  const handleUpdateChatMessages = (chatId: string, updatedMessages: Message[]) => {
    if (!currentPId) return;
    const newChats = currentChats.map(c => (c.id === chatId ? { ...c, messages: updatedMessages } : c));
    setCurrentChats(newChats);
    saveLocalChats(currentPId, newChats);
  };

  // Messaging & Turn Generation
  const handleSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || !currentPId || !currentChatId || isGenerating) return;

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

  const handleRollDice = (sides: number) => {
    return rollDie(sides);
  };

  const handleRollRequest = (_req: RollRequest) => {
    return rollDie(20);
  };

  // El dado se tira aquí, no en el modelo. Lo único que hace el Narrador con esto
  // es leer la tabla de la jugadora e interpretar lo que salga.
  const handleOracleAsk = (pregunta: string, probabilidad: Probabilidad) => {
    const consulta = nuevaConsulta(pregunta, probabilidad);
    return consulta.resultado;
  };

  const handleOracleMeaning = () => {
    return formatoSignificado();
  };

  const triggerAIGeneration = async (
    userPrompt: string,
    baseMessages?: Message[],
    options?: {
      appendToMessageIndex?: number;
      initialPrefix?: string;
    }
  ) => {
    if (!currentProject || !currentChatId) return;

    if (!hasConfiguredApiKey()) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setIsStreamingTurn(true);
    setLoadingText('Consultando los archivos del tomo y tejiendo la trama...');

    const isAppending = options?.appendToMessageIndex !== undefined;

    const volcarPendiente = () => {
      const pendiente = textoPendienteRef.current;
      if (pendiente === null) return;
      textoPendienteRef.current = null;
      const visible = limpiarParaMostrar(pendiente);
      setCurrentChats(prev =>
        prev.map(c => {
          if (c.id !== currentChatId) return c;
          const msgs = [...c.messages];
          if (isAppending && options?.appendToMessageIndex !== undefined && msgs[options.appendToMessageIndex]) {
            if (msgs[options.appendToMessageIndex].content === visible) return c;
            msgs[options.appendToMessageIndex] = { ...msgs[options.appendToMessageIndex], content: visible };
          } else {
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'model') {
              if (last.content === visible) return c;
              msgs[msgs.length - 1] = { ...last, content: visible };
            } else {
              msgs.push({ role: 'model', content: visible });
            }
          }
          return { ...c, messages: msgs };
        })
      );
    };

    try {
      const targetChat = currentChats.find(c => c.id === currentChatId);
      if (!targetChat) return;

      const currentList = baseMessages || targetChat.messages;
      const placeholderChat = isAppending
        ? { ...targetChat, messages: currentList }
        : {
            ...targetChat,
            messages: [...currentList, { role: 'model' as const, content: 'Tirando dados...' }]
          };
      const chs = currentChats.map(c => (c.id === currentChatId ? placeholderChat : c));
      setCurrentChats(chs);
      saveLocalChats(currentProject.id, chs);

      const controller = new AbortController();
      generationAbortRef.current = controller;

      // Si el fotograma pendiente se quedó en cola por estar la pestaña
      // oculta o en segundo plano, el latido del Web Worker y los eventos de visibilidad
      // fuerzan su volcado inmediato para que el flujo nunca se pause.
      const pedirCandadoDePantalla = async () => {
        try {
          const wl = (navigator as any).wakeLock;
          if (!wl) return;
          const lock = await wl.request('screen');
          wakeLockRef.current = lock;
          lock.addEventListener('release', () => {
            if (wakeLockRef.current === lock) wakeLockRef.current = null;
          });
        } catch {
          // Denegado o sin soporte: no interrumpe la narración
        }
      };

      const onVolverVisible = () => {
        volcarPendiente();
        if (document.visibilityState === 'visible') {
          if (!wakeLockRef.current) pedirCandadoDePantalla();
        }
      };
      onVolverVisibleRef.current = onVolverVisible;
      document.addEventListener('visibilitychange', onVolverVisible);
      window.addEventListener('focus', onVolverVisible);
      window.addEventListener('pageshow', onVolverVisible);

      pedirCandadoDePantalla();

      // Iniciar el latido en segundo plano con Web Worker independiente
      backgroundHeartbeat.start(() => {
        volcarPendiente();
      });

      await generateStoryTurnStream({
        project: currentProject,
        currentChatId,
        chats: chs,
        files: currentFiles,
        userText: userPrompt,
        signal: controller.signal,
        initialPrefix: options?.initialPrefix,
        targetMessageIndex: options?.appendToMessageIndex,
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
        onTimeReported: t => {
          const modelMsgIdx =
            isAppending && options?.appendToMessageIndex !== undefined
              ? options.appendToMessageIndex
              : currentList.length;
          void handleTimeReported(t, { msgIndex: modelMsgIdx });
        },
        // Refresco de pantalla en CADA fragmento: se vuelca inmediatamente cuando
        // está en segundo plano y a través de rAF cuando la ventana está activa.
        onChunk: (fullText: string) => {
          textoPendienteRef.current = fullText;
          if (document.visibilityState === 'hidden') {
            volcarPendiente();
            return;
          }
          if (repintadoPedidoRef.current !== null) return;
          repintadoPedidoRef.current = requestAnimationFrame(() => {
            repintadoPedidoRef.current = null;
            volcarPendiente();
          });
        },
        setLoadingText,
        onUsageReported: usage => {
          /*
           * Contra la cuota cuentan los tokens de ENTRADA, no el total.
           *
           * Aquí se guardaba `usage.total`, que suma lo enviado y lo que el
           * Narrador responde. Pero el tope que corta es
           * `GenerateContentInputTokensPerModelPerMinute`: solo entrada. Meter
           * la respuesta en la cuenta inflaba la cifra y hacía saltar el aviso
           * antes de tiempo, además de no coincidir con la barra de la barra
           * lateral, que sí estima solo lo que se manda.
           */
          const tokensDeEntrada = usage.entrada || usage.total || 0;
          if (currentChatId && tokensDeEntrada > 0) {
            setChatTokenLoads(prev => ({ ...prev, [currentChatId]: tokensDeEntrada }));
          }

          /*
           * El aviso de cuota ya NO interrumpe con una ventana.
           *
           * Saltaba al terminar el turno, tapaba la partida y había que
           * cerrarla para seguir leyendo lo que el Narrador acababa de contar
           * —y volvía a saltar al turno siguiente, y al otro, porque la
           * condición se cumple a partir de ahí siempre—. La misma información
           * la da la barra que hay sobre el campo de escribir, que se ve
           * cuando toca mirarla y no reclama nada.
           */
        },
        onSaveMessage: (updatedChat: Chat) => {
          setCurrentChats(prev => {
            const updatedChs = prev.map(c => (c.id === currentChatId ? updatedChat : c));
            saveLocalChats(currentProject.id, updatedChs);
            return updatedChs;
          });
        }
      });

      // Novelización en segundo plano de la respuesta tras concluir con éxito la generación
      if (currentProject && currentChatId && userPrompt && !userPrompt.startsWith('[Continúa') && !userPrompt.startsWith('⏳ [')) {
        const targetChatId = currentChatId;
        const targetProj = currentProject;
        const targetPrompt = userPrompt;
        setTimeout(async () => {
          try {
            const chs = getLocalChats(targetProj.id);
            const chat = chs.find(c => c.id === targetChatId);
            if (!chat) return;
            const uIdx = chat.messages
              .map((m, i) => ({ m, i }))
              .reverse()
              .find(({ m }) => m.role === 'user' && m.content === targetPrompt && !m.novelContent)?.i;
            if (uIdx !== undefined && uIdx >= 0) {
              const prevModel = [...chat.messages.slice(0, uIdx)]
                .reverse()
                .find(m => m.role === 'model')?.content;
              const nextModel = chat.messages.slice(uIdx + 1).find(m => m.role === 'model')?.content;
              const novelText = await novelizeUserMessage({
                rawInput: targetPrompt,
                project: targetProj,
                previousNarrative: prevModel,
                nextNarrative: nextModel
              });
              if (novelText) {
                setCurrentChats(prev => {
                  const updated = prev.map(c => {
                    if (c.id !== targetChatId) return c;
                    const msgs = [...c.messages];
                    if (msgs[uIdx] && msgs[uIdx].role === 'user') {
                      msgs[uIdx] = { ...msgs[uIdx], novelContent: novelText };
                    }
                    return { ...c, messages: msgs };
                  });
                  saveLocalChats(targetProj.id, updated);
                  return updated;
                });
              }
            }
          } catch {
            // Silencioso en segundo plano
          }
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error generating AI story:', error);
      if (!isAppending) {
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
      }
      logError('gemini_stream', 'Error durante la generación del turno narrativo', error, {
        projectName: currentProject?.name,
        chatName: currentChat?.name
      });
      const fallo = classifyApiError(error);
      const isTokenLimit =
        fallo.isTokenQuotaLimit ||
        (fallo.isRateLimit &&
          /token|250000|quota exceeded for metric|input_token_count/i.test(
            String(error?.message || '') + ' ' + (fallo.detail || '')
          ));

      if (error?.message?.includes('GEMINI_API_KEY') || error?.message?.includes('API key')) {
        setIsApiKeyModalOpen(true);
      } else if (isTokenLimit) {
        setAlertConfig({
          isOpen: true,
          title: 'Tope de Tokens Alcanzado',
          message: describeApiError(error),
          actionButton: {
            label: '✨ Crear Nuevo Capítulo',
            onClick: () => {
              setAlertConfig(null);
              handleCreateChat();
            }
          }
        });
      } else {
        setAlertConfig({
          isOpen: true,
          title: 'Aviso del Narrador',
          message: describeApiError(error)
        });
      }
    } finally {
      backgroundHeartbeat.stop(volcarPendiente);

      // La copia en disco es red de seguridad: si hay carpeta configurada en Copias, se sincroniza en segundo plano.
      if (currentProject) {
        const latestChats = getLocalChats(currentProject.id);
        writeCampaignToDisk(
          currentProject,
          latestChats.length > 0 ? latestChats : currentChats,
          currentFiles
        ).catch(() => {});
      }
      // Actualización automática de memoria general estilo Claude/Gemini:
      // Se actualiza automáticamente una vez al día (24 horas) o si no existe memoria inicial.
      if (currentProject) {
        const latestChats = getLocalChats(currentProject.id);
        const effectiveChats = latestChats.length > 0 ? latestChats : currentChats;
        const lastSyncTime = currentProject.lastMemoryUpdate || 0;
        const msSinceLastSync = Date.now() - lastSyncTime;
        const needsInitialSync = !currentProject.memory?.raw_project_memory;
        const needsDailySync = msSinceLastSync > 24 * 60 * 60 * 1000; // 24 horas

        /*
         * La trama de la campaña se traza sola, al mismo ritmo que la memoria.
         *
         * Estaba detrás de un botón, y un botón que hay que acordarse de pulsar
         * es un botón que no se pulsa: la campaña arrancaba sin historia
         * decidida y el Narrador improvisaba desde el primer turno, que es
         * justo lo que no queremos. Ahora se traza en cuanto empieza la partida
         * y se repasa con cada revisión de memoria, a la luz de lo que de
         * verdad ha pasado jugando.
         */
        const sinTrama = !currentProject.memory?.plan_de_campana?.premisa;
        const hayConQueTramar =
          currentFiles.some(f => !f.isImage && !f.isAudio && (f.content || '').trim().length > 200) ||
          effectiveChats.some(c => (c.messages || []).length >= 2);

        if (needsInitialSync || needsDailySync) {
          setTimeout(async () => {
            try {
              const newRawMem = await generateClaudeProjectMemory({
                project: currentProject,
                chats: effectiveChats,
                files: currentFiles
              });
              if (newRawMem && newRawMem.trim().length > 0) {
                await handleUpdateProjectField(p => ({
                  lastMemoryUpdate: Date.now(),
                  memory: {
                    ...(p.memory || {}),
                    raw_project_memory: newRawMem
                  }
                }));
              }
            } catch (err) {
              console.warn('Auto-background memory synthesis skipped:', err);
            }
          }, 1500);
        }

        /*
         * EL TRAZADO DE LA HISTORIA TIENE SU PROPIO DISPARADOR.
         *
         * Estaba metido dentro del `if` de la memoria general, que solo salta
         * la primera vez y luego una vez cada 24 horas. Así que en una campaña
         * que ya tenía memoria sintetizada, el trazado NO SE EJECUTABA NUNCA
         * —ni al empezar a jugar ni después— y la pestaña de Giros se quedaba
         * en «Todavía nada» partida tras partida, que es justo lo contrario de
         * lo que se prometía ahí. Ahora: si no hay historia trazada y hay
         * material con el que trazarla, se traza; y una vez trazada, se repasa
         * al ritmo de la memoria.
         */
        const sinTrazarTodavia = sinTrama && hayConQueTramar;
        const desdeElUltimoIntento = Date.now() - (intentoDeTrazadoRef.current[currentProject.id] || 0);
        const puedeReintentar = desdeElUltimoIntento > 20 * 60 * 1000;

        if (hayConQueTramar && (sinTrazarTodavia || needsDailySync) && puedeReintentar) {
          intentoDeTrazadoRef.current[currentProject.id] = Date.now();
          setTimeout(async () => {
            try {
              const trama = await tramarLaCampana({
                project: currentProject,
                files: currentFiles,
                chats: effectiveChats,
                modo: sinTrama ? 'trazar' : 'revisar'
              });
              await handleUpdateProjectField(p => ({
                memory: {
                  ...(p.memory || {}),
                  gm_secrets: fusionarTrama(p.memory?.gm_secrets || [], trama),
                  plan_de_campana: {
                    premisa: trama.premisa || p.memory?.plan_de_campana?.premisa || '',
                    destino: trama.destino || p.memory?.plan_de_campana?.destino,
                    trazadoEl: new Date().toISOString()
                  }
                }
              }));
              logInfo(
                'threads',
                sinTrama ? 'Historia de la campaña trazada' : 'Historia de la campaña repasada',
                `${trama.secretos.length} piezas en ${new Set(trama.secretos.map(x => x.capa)).size} capas.`,
                { projectName: currentProject.name }
              );
            } catch (err) {
              // Que falle el trazado no puede estropear el turno ni la memoria,
              // pero tampoco puede fallar en silencio: si no, la pestaña de
              // Giros se queda vacía sin que nada explique por qué.
              logError(
                'threads',
                'No se pudo trazar la historia de la campaña',
                err,
                { projectName: currentProject.name }
              );
            }
          }, 1500);
        }
      }

      if (onVolverVisibleRef.current) {
        document.removeEventListener('visibilitychange', onVolverVisibleRef.current);
        window.removeEventListener('focus', onVolverVisibleRef.current);
        window.removeEventListener('pageshow', onVolverVisibleRef.current);
        onVolverVisibleRef.current = null;
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (repintadoPedidoRef.current !== null) {
        cancelAnimationFrame(repintadoPedidoRef.current);
        repintadoPedidoRef.current = null;
      }
      volcarPendiente();
      textoPendienteRef.current = null;
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
    const targetIdx = fromIndex !== undefined ? fromIndex : currentChat.messages.length - 1;
    const targetMsg = currentChat.messages[targetIdx];

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

    const isIncomplete = Boolean(
      targetMsg && targetMsg.role === 'model' && isNarrativeIncomplete(targetMsg.content)
    );

    let continuePrompt =
      '[Continúa la narración de forma fluida, profundizando en la escena, las reacciones del entorno y las consecuencias de lo ocurrido.]';

    let options: { appendToMessageIndex?: number; initialPrefix?: string } | undefined = undefined;

    // Si la narración quedó a medias o cortada por fallo de red o límite de tokens,
    // se reanuda fusionándose en el MISMO mensaje sin duplicar el chat.
    if (isIncomplete && targetMsg) {
      const anchor = targetMsg.content.trim().slice(-160).trim();
      continuePrompt = `[SISTEMA - REANUDACIÓN DE ESCENA]: El último fragmento del relato se interrumpió abruptamente antes de concluir. El último texto fue: "${anchor}". Continúa el relato EXACTAMENTE a partir de ese punto sin repetir nada previo, concluyendo las frases y la escena con fluidez y los registros correspondientes.`;
      options = {
        appendToMessageIndex: targetIdx,
        initialPrefix: targetMsg.content.trim()
      };
    }

    await triggerAIGeneration(continuePrompt, baseMessages, options);
  };

  const handleSceneTransition = async (
    transitionPrompt: string,
    opciones?: OpcionesDeTransicion
  ) => {
    if (!transitionPrompt.trim() || !currentPId || !currentChatId || isGenerating || !currentChat) return;
    let text = transitionPrompt.trim();

    /*
     * El número de días, dicho una sola vez.
     *
     * «Varios días» lo interpretaba el Narrador a ojo y el calendario y el HUD
     * acababan discrepando. Si la jugadora ha dicho cuántos, esa es la cifra y
     * viaja pegada a la instrucción para que el HUD la escriba tal cual.
     */
    /*
     * Un salto tiene que ENSEÑAR algo, no solo adelantar el reloj.
     *
     * Los presets ya lo piden, pero la jugadora puede escribir su propia
     * transición, y sin esto salía lo de siempre: tres párrafos en pasado
     * resumiendo una semana y ni una sola escena que se pudiera jugar. Se añade
     * solo si el texto no lo trae ya, para no decirlo dos veces.
     */
    if (!text.includes('ESTO SE JUEGA, NO SE RESUME')) {
      text +=
        '\n\n🎬 [ESTO SE JUEGA, NO SE RESUME]: De este intervalo, ELIGE UN MOMENTO y NÁRRALO COMO ESCENA —con su sitio, su hora, lo que se ve y se huele, y al menos un PNJ hablando con sus palabras—, no como un parte de lo ocurrido. Puede llevar un párrafo de resumen, pero tiene que llevar también una escena, y termina DENTRO de ella con algo delante a lo que responder.';
    }

    const dias = opciones?.dias || 0;
    if (dias > 0) {
      text += `\n\n📅 [DURACIÓN EXACTA DEL SALTO]: Pasan EXACTAMENTE ${dias} ${dias === 1 ? 'día' : 'días'}${opciones?.motivo ? `, con el protagonista ${opciones.motivo}` : ''}. Adelanta la fecha del HUD justo esos ${dias} ${dias === 1 ? 'día' : 'días'}, ni uno más ni uno menos, y escríbela completa. No digas «varios días»: di la fecha.`;
    }

    /*
     * Las noticias del mundo, concretas y fechadas.
     *
     * Se piden aparte al modelo de tareas de fondo (que tiene su propia cuota,
     * así que no cuesta turnos de partida) y se le entregan al Narrador ya
     * hechas. La alternativa era que se las inventara mientras narra, y salían
     * «llegaron rumores de la costa» sin nada dentro y sin fecha.
     *
     * Van al calendario por la vía de siempre —las etiquetas [AGENDA:] que el
     * Narrador escribe en el chat— y no escribiendo en la cronología por un
     * lado: así la siguiente sincronización las reconoce en vez de barrerlas.
     */
    if (opciones?.noticias && dias >= 2 && currentProject) {
      /*
       * El indicador se enciende ya: generar las noticias tarda unos segundos y
       * sin esto la pantalla se quedaba muerta después de pulsar, que es
       * exactamente cuando se vuelve a pulsar pensando que no ha ido.
       */
      setIsGenerating(true);
      setLoadingText('El mundo sigue girando: buscando qué ha pasado mientras tanto…');
      try {
        const noticias = await generarNoticiasSaltoTemporal({
          project: currentProject,
          dias,
          motivo: opciones.motivo || undefined,
          // Dónde se está: lo último que se apuntó en la cronología, que es lo
          // más fresco que hay sin volver a leerse el capítulo entero.
          lugar: [...(currentProject.timeline || [])].reverse().find(e => e.lugar)?.lugar
        });
        if (noticias.length > 0) {
          const lista = noticias
            .map(n => {
              const dia = Math.max(1, Math.min(dias, n.diaOffset || 1));
              const donde = n.lugar ? ` · ${n.lugar}` : '';
              const fuente = n.fuenteOClima ? ` · se sabe por: ${n.fuenteOClima}` : '';
              return `- Día +${dia}${donde}${fuente} — **${n.titulo}**: ${n.resumen}`;
            })
            .join('\n');
          text += `\n\n📰 [LO QUE HA PASADO EN EL MUNDO DURANTE ESTOS ${dias} DÍAS]:\n${lista}\n\nÚSALAS: no te inventes otras noticias distintas ni las sustituyas por «llegaron rumores». Cuenta cómo se entera el protagonista de las que le lleguen (pregoneros, tablón, taberna, un PNJ que las trae), y REGISTRA CADA UNA en su día con su etiqueta, en este formato exacto:\n\`[AGENDA: el resumen | dia: +N | tipo: noticia | lugar: donde pasó | titulo: el título]\`\nUna etiqueta por noticia, con el mismo «día +N» que tiene arriba. Las que el protagonista no llegue a oír se registran igual: el mundo pasa aunque nadie lo cuente.`;
        }
      } catch (err) {
        // Sin noticias se sigue jugando: el salto es lo importante, esto es el adorno.
        logWarn('threads', 'No se pudieron generar las noticias del salto temporal', String(err), {
          projectName: currentProject.name,
          details: { dias, motivo: opciones.motivo }
        });
      }
    }

    const updatedMessages: Message[] = [...currentChat.messages, { role: 'user' as const, content: text }];
    const updatedChat = { ...currentChat, messages: updatedMessages };
    const chs = currentChats.map(c => (c.id === currentChatId ? updatedChat : c));
    setCurrentChats(chs);
    saveLocalChats(currentPId, chs);
    await triggerAIGeneration(text, updatedMessages);
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
      }

      let updated = [...currentFiles, ...newFilesList];
      setCurrentFiles(updated);
      await saveFilesToDB(currentPId, updated);

      setAlertConfig({
        isOpen: true,
        title: 'Archivos Guardados',
        message: `Se han añadido ${newFilesList.length} documento(s) a los Archivos del Tomo.`
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

  /**
   * Rellenar la ficha del protagonista leyendo su documento, sin pedirlo.
   *
   * Marcar un archivo como «ficha del OC» ya es decir quién es: no tiene
   * sentido que además haya que pulsar un botón para que la aplicación lo lea.
   * Sin esto, la ficha se quedaba con el nombre de reserva y el resultado se
   * veía en la novela: «Protagonista abrió los ojos en la penumbra».
   *
   * ⛔ Solo rellena lo que está VACÍO. Lo que la jugadora haya escrito a mano
   * no se toca nunca, ni aunque el documento diga otra cosa: para eso está el
   * botón de leer la ficha, que sí avisa antes de sustituir.
   */
  const completarFichaDesdeDocumento = async (archivos: ProjectFile[]) => {
    if (!currentProject) return;
    const pc = currentProject.memory?.player_character;
    const nombreDeReserva = /^(protagonista|jugador|el jugador|personaje jugador|oc|pj)$/i;
    const faltaNombre = !(pc?.name || '').trim() || nombreDeReserva.test((pc?.name || '').trim());
    const faltaAlgo =
      faltaNombre || !pc?.race || !pc?.class || !pc?.languages?.length || !pc?.appearance;
    if (!faltaAlgo) return;

    try {
      const id = await extraerIdentidadDeDocumentos({ project: currentProject, files: archivos });
      const puestos: string[] = [];
      await handleUpdateMemory(mem => {
        const actual = mem.player_character;
        const nombreActual = (actual?.name || '').trim();
        const sinNombre = !nombreActual || nombreDeReserva.test(nombreActual);
        const nuevo = { ...(actual || { name: 'Protagonista' }) };
        if (id.name && sinNombre) { nuevo.name = id.name; puestos.push(`nombre: ${id.name}`); }
        if (id.race && !actual?.race) { nuevo.race = id.race; puestos.push(`raza: ${id.race}`); }
        if (id.class && !actual?.class) { nuevo.class = id.class; puestos.push(`clase: ${id.class}`); }
        if (id.languages?.length && !actual?.languages?.length) {
          nuevo.languages = id.languages;
          puestos.push(`idiomas: ${id.languages.join(', ')}`);
        }
        if (id.appearance && !actual?.appearance) { nuevo.appearance = id.appearance; puestos.push('rasgos físicos'); }
        return { ...mem, player_character: nuevo };
      });
      if (puestos.length) {
        logInfo('memory_sync', 'Ficha del protagonista completada desde su documento', puestos.join(' · '), {
          projectName: currentProject.name
        });
        setTopProgress({
          active: true,
          label: `Ficha del protagonista completada desde el documento (${puestos.join(', ')})`,
          type: 'sync'
        });
        setTimeout(() => setTopProgress(p => (p.type === 'sync' ? { active: false } : p)), 6000);
      }
    } catch (err) {
      // Que no se pueda leer no puede romper el marcar un archivo.
      logWarn('memory_sync', 'No se pudo leer la ficha del protagonista del documento', String(err), {
        projectName: currentProject.name
      });
    }
  };

  const handleUpdateFileCategory = async (fileId: string, category: FileCategory) => {
    if (!currentPId) return;
    const updated = currentFiles.map(f => (f.id === fileId ? { ...f, category } : f));
    setCurrentFiles(updated);
    await saveFilesToDB(currentPId, updated);
    // Marcar un documento como ficha del OC es decir quién es: se lee solo.
    if (category === 'sheet_pj') void completarFichaDesdeDocumento(updated);
  };

  const handleToggleOnDemand = async (fileId: string, onDemand: boolean) => {
    if (!currentPId) return;
    const updated = currentFiles.map(f => (f.id === fileId ? { ...f, onDemand } : f));
    setCurrentFiles(updated);
    // Invalidar caché de tokens medidos para reflejar el nuevo peso de la biblioteca
    setChatTokenLoads({});
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

  const handleTriggerMemorySyncWithAI = async () => {
    if (!currentProject || !currentChats || currentChats.length === 0) {
      setAlertConfig({
        isOpen: true,
        title: 'Sin Crónica',
        message: 'No hay mensajes en la crónica para analizar y sincronizar la partida con la IA.'
      });
      return;
    }
    setIsSyncingMemory(true);
    setTopProgress({
      active: true,
      label: 'Sincronizando memoria de campaña en segundo plano con la IA...',
      type: 'sync'
    });
    try {
      const syncResult = await syncFullCampaignFromChats(currentProject, currentChats, currentFiles);

      /*
       * La sincronización RELLENA HUECOS; no reescribe el diario.
       *
       * Antes se hacía `timeline: syncResult.timeline`, y eso es un reemplazo
       * completo: lo que la IA no volviera a deducir desaparecía. Lo primero en
       * caer eran las notas escritas a mano, que la IA no puede reconstruir
       * porque nunca estuvieron en ningún chat: son de la jugadora y de nadie
       * más. Perder eso por pulsar «sincronizar» es indefendible.
       *
       * Así que se conserva todo lo que ya había y solo se añaden jornadas de
       * las que no hubiera nada escrito. Quien quiera rehacer un día concreto
       * tiene «Vaciar día» al lado.
       */
      // El cálculo va aquí fuera a propósito. Hacerlo dentro del actualizador de
      // estado parecía natural y no lo es: React lo ejecuta cuando le conviene
      // —después de este punto, y a veces dos veces—, así que el aviso salía
      // diciendo «0 jornadas nuevas» aunque hubiera añadido unas cuantas.
      const previas =
        (getLocalProjects().find(p => p.id === currentPId)?.timeline) ??
        currentProject.timeline ??
        [];
      const notasConservadas = previas.filter(
        t => t.autoria === 'jugadora' || (!t.autoria && t.id.startsWith('manual_'))
      ).length;
      const { agregadas } = fusionarTimeline(previas, syncResult.timeline || []);
      const anotacionesNuevas = agregadas.length;
      const jornadasNuevas = new Set(
        agregadas.filter(t => !previas.some(p => p.absDay === t.absDay)).map(t => t.absDay)
      ).size;

      await handleUpdateProjectField(p => ({
        memory: sanitizeProjectMemory({
          ...(p.memory || {}),
          ...syncResult.memory
        }),
        timeline: fusionarTimeline(p.timeline || [], syncResult.timeline || []).timeline,
        currentDate: syncResult.currentDate || p.currentDate,
        threads: syncResult.threads || p.threads,
        calendar: p.calendar || syncResult.calendar
      }));

      /*
       * «Sincronizar con IA» también traza la historia.
       *
       * No lo hacía: el trazado colgaba únicamente del final de un turno de
       * narración, así que vaciar la memoria y pedir un repaso completo dejaba
       * la pestaña de Giros exactamente igual de vacía que estaba. Y es justo
       * lo que uno espera de un botón que dice sincronizar TODA la campaña:
       * la estructura de la historia es memoria de la campaña como las demás.
       */
      let girosTrazados = 0;
      try {
        const proyectoAlDia = getLocalProjects().find(p => p.id === currentProject.id) || currentProject;
        const sinTrama = !proyectoAlDia.memory?.plan_de_campana?.premisa;
        const trama = await tramarLaCampana({
          project: proyectoAlDia,
          files: currentFiles,
          chats: currentChats,
          modo: sinTrama ? 'trazar' : 'revisar'
        });
        girosTrazados = trama.secretos.length;
        if (currentPId) intentoDeTrazadoRef.current[currentPId] = Date.now();
        await handleUpdateProjectField(p => ({
          memory: {
            ...(p.memory || {}),
            gm_secrets: fusionarTrama(p.memory?.gm_secrets || [], trama),
            plan_de_campana: {
              premisa: trama.premisa || p.memory?.plan_de_campana?.premisa || '',
              destino: trama.destino || p.memory?.plan_de_campana?.destino,
              trazadoEl: new Date().toISOString()
            }
          }
        }));
      } catch (err) {
        // El repaso de memoria vale igual aunque el trazado falle.
        logError('threads', 'No se pudo trazar la historia durante la sincronización', err, {
          projectName: currentProject.name
        });
      }

      setAlertConfig({
        isOpen: true,
        title: '¡Sincronización Total con IA Completada!',
        message:
          `Se ha repasado toda la campaña a partir de las sesiones jugadas:\n\n` +
          `• ${anotacionesNuevas} ${anotacionesNuevas === 1 ? 'anotación nueva' : 'anotaciones nuevas'} en el diario, con sus horas deducidas` +
          (jornadasNuevas > 0
            ? ` (${jornadasNuevas} ${jornadasNuevas === 1 ? 'jornada' : 'jornadas'} que no tenían nada escrito).\n`
            : `.\n`) +
          `• ${syncResult.totalNpcs} PNJs con afinidad y notas.\n` +
          `• ${syncResult.totalQuests} tramas y misiones.\n` +
          `• ${syncResult.totalLocations} lugares registrados.\n` +
          `• Evolución del protagonista y consecuencias programadas.\n` +
          (girosTrazados > 0
            ? `• ${girosTrazados} ${girosTrazados === 1 ? 'giro' : 'giros'} en la estructura de la historia (pestaña Giros).\n\n`
            : `• La estructura de la historia no se ha podido trazar esta vez; mira el registro de errores.\n\n`) +
          `Lo que ya estaba escrito no se ha tocado` +
          (notasConservadas > 0
            ? `, incluidas tus ${notasConservadas} ${notasConservadas === 1 ? 'nota' : 'notas'}.`
            : '.')
      });
    } catch (err: any) {
      console.error('Error al sincronizar campaña con IA:', err);
      logError('memory_sync', 'Error al sincronizar campaña completa con IA', err, {
        projectName: currentProject.name
      });
      setAlertConfig({
        isOpen: true,
        title: 'Error de Sincronización',
        message: describeApiError(err) || 'No se pudo sincronizar la campaña.'
      });
    } finally {
      setIsSyncingMemory(false);
      setTopProgress({ active: false, label: '' });
    }
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
      /*
       * Un documento puede traer quince personajes, no uno.
       *
       * Esto devolvía un solo PNJ y encima leía únicamente los primeros 40.000
       * caracteres: de un compendio de doscientos mil salía UNA ficha y ningún
       * aviso de que faltaban catorce. Ahora se lee entero, por partes, y se
       * registran todos los que aparezcan.
       */
      const npcs = await extractNpcsFromDocument(file, (hechos, total) => {
        if (total > 1) {
          setTopProgress({
            active: true,
            percent: Math.round((hechos / total) * 100),
            label: `Leyendo "${file.name}" en busca de PNJs — parte ${Math.min(hechos + 1, total)} de ${total}...`,
            type: 'sync'
          });
        }
      });

      if (npcs.length === 0) {
        setTopProgress({
          active: true,
          label: `No se encontró ningún PNJ con ficha en "${file.name}"`,
          type: 'sync'
        });
        setTimeout(() => {
          setTopProgress(p => (p.label?.includes('ningún PNJ') ? { active: false } : p));
        }, 5000);
        return;
      }

      // Cada uno con su retrato, si hay una imagen que se llame como él.
      const refreshedFiles = await loadFilesFromDB(currentPId);
      for (const npc of npcs) {
        const matchingPortrait = refreshedFiles.find(f => {
          if (!f.isImage || !f.content) return false;
          const cleanName = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
          const cleanNpcName = npc.name.toLowerCase().trim();
          return cleanNpcName.length > 2 && (cleanName.includes(cleanNpcName) || cleanNpcName.includes(cleanName));
        });
        if (matchingPortrait && !npc.portrait) npc.portrait = matchingPortrait.content;
      }

      await handleUpdateFileCategory(file.id, 'sheet_npc');

      await handleUpdateMemory(mem => {
        const existing = mem.npcs || [];
        const nuevosPorNombre = new Set(npcs.map(n => n.name.toLowerCase().trim()));
        const filtered = existing.filter(n => !nuevosPorNombre.has(n.name.toLowerCase().trim()));
        return {
          ...mem,
          npcs: [...filtered, ...npcs]
        };
      });

      const resumen =
        npcs.length === 1
          ? `PNJ "${npcs[0].name}" registrado con éxito`
          : `${npcs.length} PNJs registrados: ${npcs.slice(0, 4).map(n => n.name).join(', ')}${npcs.length > 4 ? ` y ${npcs.length - 4} más` : ''}`;
      setTopProgress({ active: true, percent: 100, label: resumen, type: 'sync' });
      setTimeout(() => {
        setTopProgress(p => (p.label === resumen ? { active: false } : p));
      }, 6000);
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
            : importedProject.memory.story
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

  /*
   * Lo que pesa el turno, para el aviso de cuota.
   *
   * La estimación se hacía aquí a mano y sumaba solo el capítulo y los
   * documentos: se dejaba fuera las directivas y la memoria, que son unos
   * treinta y cinco mil tokens fijos en CADA turno. Por eso esta cifra y la de
   * la barra lateral nunca cuadraban. Ahora las dos salen del mismo cálculo.
   */
  const currentChatTokenCount = currentChatId ? chatTokenLoads[currentChatId] || 0 : 0;
  const cargaEstimada = currentProject
    ? estimarCargaDelTurno({
        project: currentProject,
        chats: currentChats,
        currentChatId,
        files: currentFiles
      })
    : null;
  const estimatedCurrentTokens = cargaEstimada?.tokens || 0;
  const effectiveChatTokens = currentChatTokenCount > 0 ? currentChatTokenCount : estimatedCurrentTokens;
  const isCurrentChatNearTokenLimit = effectiveChatTokens >= AVISO_TOKENS_POR_MINUTO;

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[var(--bg-color)] text-[var(--text-primary)] font-lora">
      {/* Sutil viñeteado para efecto de inmersión / iluminación central */}
      <div className="pointer-events-none fixed inset-0 z-50 shadow-[inset_0_0_120px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_150px_rgba(0,0,0,0.2)] mix-blend-multiply opacity-50" />
      {/*
        Barra de actualización.

        Va arriba del todo y ocupa una línea: es un aviso, no una interrupción.

        Aquí ponía que no se podía posponer, «porque seguir en la versión vieja
        es justamente el problema que resuelve». Estaba mal, y se vio en una
        tarde de diez despliegues: quien quería jugar acababa recargando cada
        quince minutos. Un aviso que no se puede callar deja de ser un aviso y
        pasa a ser una interrupción con otro nombre. Ahora se puede aparcar
        hasta la próxima vez que se abra la aplicación —la versión nueva sigue
        ahí, y se coge al terminar de jugar—.
      */}
      {hayActualizacion && (
        <div className="fixed top-0 left-0 right-0 z-[130] bg-[var(--accent)] text-[var(--on-accent)] px-3 py-1.5 flex items-center justify-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="font-cinzel text-[11px] sm:text-xs font-bold truncate">
            Hay una versión nueva de GM Studio
          </span>
          <button
            onClick={() => void recargarConLaVersionNueva()}
            className="shrink-0 min-h-[30px] rounded-lg bg-[var(--on-accent)] text-[var(--accent)] px-2.5 font-cinzel text-[11px] font-bold hover:brightness-95 active:scale-95 transition-all cursor-pointer"
          >
            Actualizar
          </button>
          <button
            onClick={() => {
              setHayActualizacion(false);
              apartarAvisoRef.current?.();
            }}
            className="shrink-0 min-h-[30px] rounded-lg border border-[var(--on-accent)]/50 px-2 font-cinzel text-[11px] hover:bg-[var(--on-accent)]/15 active:scale-95 transition-all cursor-pointer"
            title="Sigue jugando. La versión nueva te espera y se vuelve a avisar dentro de un rato."
          >
            Ahora no
          </button>
        </div>
      )}

      {/* Top Subtle Progress Bar during file uploads, analysis & background tasks */}
      {topProgress.active && (
        <div className="fixed top-0 left-0 right-0 z-[110] pointer-events-none transition-opacity duration-300">
          <div className="w-full h-[3px] bg-[var(--surface)]/40 relative overflow-hidden shadow-xs">
            {topProgress.percent !== undefined ? (
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
          {topProgress.label && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)]/95 border border-[var(--glass-border)] text-[var(--accent)] text-[11px] font-cinzel font-semibold shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span className="truncate max-w-[220px] sm:max-w-xs">
                {topProgress.label}
              </span>
              {topProgress.percent !== undefined && (
                <span className="text-[10px] opacity-75 font-mono">({topProgress.percent}%)</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
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
        currentModel={currentActiveModel}
        onSaveModel={model => {
          setStoredModel(model);
          setCurrentActiveModel(model);
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
        <div className="p-3 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass)] gap-2 min-w-0">
          <h1 className="font-cinzel text-base md:text-lg text-[var(--accent)] font-bold tracking-wider m-0 shrink-0 whitespace-nowrap">
            GM STUDIO
          </h1>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleManualSaveCampaign}
              className={`p-1.5 text-xs font-cinzel transition-all cursor-pointer flex items-center justify-center rounded-lg border ${
                isManuallySaved
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'text-[var(--accent)] hover:border-[var(--accent)] border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] shadow-xs hover:bg-[var(--glass)]'
              }`}
              title={isManuallySaved ? 'Campaña guardada' : 'Guardar manualmente el progreso de la campaña activa'}
              aria-label="Guardar campaña"
            >
              {isManuallySaved ? (
                <Check className="w-3.5 h-3.5 text-white shrink-0" />
              ) : (
                <Save className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
            </button>
            <button
              onClick={() => setIsImportCampaignModalOpen(true)}
              className="p-1.5 text-xs text-[var(--accent)] hover:border-[var(--accent)] font-cinzel transition-colors cursor-pointer flex items-center justify-center rounded-lg border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] shadow-xs hover:bg-[var(--glass)]"
              title="Importar campaña desde PDF, Gemini, NotebookLM o JSON"
              aria-label="Importar campaña"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </button>
            <button
              onClick={() => setIsLocalStorageModalOpen(true)}
              className="p-1.5 text-xs text-[var(--accent)] hover:border-[var(--accent)] font-cinzel transition-colors cursor-pointer flex items-center justify-center rounded-lg border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] shadow-xs hover:bg-[var(--glass)]"
              title="Copias de Seguridad y Almacenamiento Local"
              aria-label="Copias de seguridad"
            >
              <FolderSync className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </button>
            <Logger variant="compact" />
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden text-base text-[var(--text-secondary)] hover:text-[var(--accent)] p-1 cursor-pointer ml-0.5"
              title="Cerrar menú"
              aria-label="Cerrar menú"
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

          {currentChats.map((c, idx) => {
            const isSelected = c.id === currentChatId;
            /*
             * Un capítulo está cerrado cuando ya hay otro después: cerrar es
             * justamente abrir el siguiente. Se deduce de la posición en lugar
             * de guardar una marca nueva, para que los capítulos que ya
             * existían aparezcan sellados sin tener que tocar nada de lo
             * guardado.
             */
            const estaCerrado = idx < currentChats.length - 1;
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
                {estaCerrado && (
                  <BookCheck
                    className={`w-3.5 h-3.5 shrink-0 mr-1 ${isSelected ? 'opacity-80' : 'opacity-45'}`}
                    aria-label="Capítulo cerrado"
                  />
                )}
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
          </div>
        )}


        {/* Real-time Token & Context Capacity Widget */}
        <ContextUsageWidget
          project={currentProject ?? null}
          files={currentFiles}
          chats={currentChats}
          currentChatId={currentChatId}
          // La medida real del último turno, para que esta barra y la del chat
          // digan el mismo número en lugar de cada una el suyo.
          tokensMedidos={currentChatTokenCount || undefined}
        />

        {/* User & Install Footer */}
        <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--glass)] flex flex-col gap-2">
          <Logger variant="sidebar" />
          <button
            onClick={() => setIsInstallModalOpen(true)}
            className="w-full text-xs font-cinzel font-bold px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            title="Instalar GM Studio en este dispositivo (Web App PWA)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Instalar App</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-color)]">
        {/*
          El aviso de almacenamiento iba flotando con `fixed bottom-3`, y en el
          móvil aterrizaba justo encima del cajón de escribir y de la fila de
          dados: no se podía ni teclear hasta cerrarlo. Ahora va en el flujo,
          debajo de la barra: empuja la escena hacia abajo en vez de taparla.
        */}
        {storageWarning && (
          <div className="shrink-0 border-b border-amber-300 bg-amber-50 text-amber-950 px-3 py-2 flex items-start gap-2.5 text-xs font-lora">
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
        {/* Top Navbar */}
        <div className="h-11 md:h-14 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-color)_85%,transparent)] backdrop-blur-xs flex justify-between items-center px-2.5 md:px-4 shrink-0 shadow-xs gap-2">
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
              { id: 'files', label: 'Archivos', icon: Paperclip },
              { id: 'memory', label: 'Memoria', icon: ScrollText }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isCurrentActive =
                activeTab === tab.id ||
                (tab.id === 'chat' && (activeTab === 'novel' || activeTab === 'mesa'));
              return (
                <button
                  key={tab.id}
                  title={tab.label}
                  aria-label={tab.label}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`font-cinzel text-xs px-2.5 sm:px-2.5 md:px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 relative ${
                    isCurrentActive
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)]'
                  }`}
                >
                  <TabIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
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

            {/* Selector rápido del Modelo IA Activo */}
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] hover:border-[var(--accent)] text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs font-cinzel transition-all cursor-pointer shadow-xs max-w-[130px] sm:max-w-[200px]"
              title={`Modelo activo: ${currentActiveModel} — Clic para cambiar de modelo o configurar API Keys`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate font-semibold text-[11px] sm:text-xs hidden sm:inline">
                {AVAILABLE_MODELS.find(m => m.id === currentActiveModel)?.name || currentActiveModel}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Views */}
        <Suspense fallback={<ViewLoader />}>
          {activeTab === 'chat' && (
            <ChatView
              chat={currentChat}
              chapterIndex={currentChapterIndex >= 0 ? currentChapterIndex : 0}
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
              onSceneTransition={handleSceneTransition}
              onDeleteMessage={handleDeleteChatMessage}
              onOpenNovelReader={() => setActiveTab('novel')}
              isBackgroundSyncing={isSyncingMemory}
              project={currentProject || undefined}
              files={currentFiles}
              onUpdateProject={handleUpdateProjectField}
              onNavigateToDiary={() => setActiveTab('memory')}
              isNearTokenLimit={isCurrentChatNearTokenLimit}
              chatTokensCount={effectiveChatTokens}
              onCreateNewChat={handleCreateChat}
              onOpenMesa={() => setActiveTab('mesa')}
              estaCerrado={
                currentChats.length > 1 &&
                currentChats.findIndex(c => c.id === currentChatId) < currentChats.length - 1
              }
            />
          )}

          {activeTab === 'mesa' && currentProject && (
            <MesaView
              project={currentProject}
              chats={currentChats}
              currentChatId={currentChatId}
              onVolverAJugar={() => setActiveTab('chat')}
              onAbrirNovela={() => setActiveTab('novel')}
              onAnotarEnMemoria={anotarEnMemoriaDesdeLaMesa}
              onPlantarSecretos={plantarSecretosDesdeLaMesa}
            />
          )}

          {activeTab === 'novel' && (
            currentProject ? (
              <NovelReaderView
                project={currentProject}
                chats={currentChats}
                currentChatId={currentChatId}
                onSelectChat={id => setCurrentChatId(id)}
                onBackToChat={() => setActiveTab('chat')}
                onUpdateChatMessages={handleUpdateChatMessages}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--text-secondary)] font-cinzel gap-3">
                <BookOpen className="w-12 h-12 text-[var(--accent)] opacity-50" />
                <p>Selecciona un tomo o campaña para leer en formato novela.</p>
                <button
                  onClick={() => setActiveTab('chat')}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] font-bold text-xs shadow-md cursor-pointer hover:opacity-90"
                >
                  Volver a la Crónica
                </button>
              </div>
            )
          )}

          {activeTab === 'memory' && currentProject && (
            <SimpleMemoryView
              project={currentProject}
              chats={currentChats}
              files={currentFiles}
              onUpdateMemory={handleUpdateMemory}
              onUpdateProject={handleUpdateProjectField}
              onTriggerAIUpdate={handleTriggerMemorySyncWithAI}
              isGenerating={isSyncingMemory}
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
              onExtractNpc={handleExtractNpc}
              onCreateNpcFromImage={handleCreateNpcFromImage}
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
