import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, Quest, ScheduledThread, ProjectFile, Chat } from '../types';
import {
  Calendar,
  Check,
  Compass,
  Eye,
  EyeOff,
  GitMerge,
  Hourglass,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X
} from 'lucide-react';
import { CreativeStudioModal } from './CreativeStudioModal';
import {
  aDiaAbsoluto,
  calendarioValido,
  desdeDiaAbsoluto,
  fechaLegible
} from '../utils/campaignCalendar';

interface StatusViewProps {
  project: Project;
  files?: ProjectFile[];
  chats?: Chat[];
  onUpdate: (fields: Partial<Project> | ((prev: Project) => Partial<Project>)) => Promise<void> | void;
  onUpdateMemory: (updater: (prevMem: Project['memory']) => Project['memory']) => Promise<void>;
  onTriggerAIUpdate: () => Promise<void>;
  isGenerating?: boolean;
  hasChats?: boolean;
}

export const StatusView: React.FC<StatusViewProps> = ({
  project,
  files: _files = [],
  chats: _chats = [],
  onUpdate,
  onUpdateMemory,
  onTriggerAIUpdate,
  isGenerating = false,
  hasChats = false
}) => {
  const memory = project.memory || {
    story: '',
    quests: [],
    npcs: [],
    locations: [],
    current_status: '',
    manual_notes: ''
  };

  const cal = project.calendar;
  const fecha = project.currentDate;
  const calActivo = calendarioValido(cal) && Boolean(fecha);

  // --- ESTADO ACTUAL DE LA PARTIDA ---
  const [editandoEstado, setEditandoEstado] = useState(false);
  const [draftEstado, setDraftEstado] = useState(memory.current_status || '');
  const estadoTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // --- NOTAS Y SECRETOS ---
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [draftNotas, setDraftNotas] = useState(memory.manual_notes || '');
  const [mostrarNotasNarrador, setMostrarNotasNarrador] = useState(false);
  const notasTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // --- HILOS Y TRAMAS (QUESTS) ---
  const [filtroHilos, setFiltroHilos] = useState<'todos' | 'activos' | 'temporales' | 'completados'>('activos');
  const [busquedaHilos, setBusquedaHilos] = useState('');
  const [modalQuest, setModalQuest] = useState<{
    isOpen: boolean;
    quest: Quest | null;
    isNew: boolean;
    dueDayOffset?: number; // Para programar vencimiento en calendario
    dueDayEnabled?: boolean;
  }>({
    isOpen: false,
    quest: null,
    isNew: false,
    dueDayOffset: 7,
    dueDayEnabled: false
  });

  const [questForm, setQuestForm] = useState<{
    title: string;
    type: string;
    status: string;
    origin: string;
    objective: string;
    progress: string;
    dueDayOffset: number;
    dueDayEnabled: boolean;
  }>({
    title: '',
    type: 'Principal',
    status: 'Activa',
    origin: '',
    objective: '',
    progress: '',
    dueDayOffset: 5,
    dueDayEnabled: false
  });

  // --- MODAL TALLER CREATIVO ---
  const [studioModal, setStudioModal] = useState<{
    isOpen: boolean;
    tab?: 'image' | 'video' | 'music' | 'diary';
    sceneText: string;
  } | null>(null);

  // --- MODAL DE CONFIRMACIÓN ---
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

  useEffect(() => {
    setDraftEstado(project.memory?.current_status || '');
    setDraftNotas(project.memory?.manual_notes || '');
  }, [project.id, project.memory]);

  // Guardar Estado
  const guardarEstadoActual = async () => {
    await onUpdateMemory(mem => ({
      ...mem,
      current_status: draftEstado.trim()
    }));
    setEditandoEstado(false);
  };

  const vaciarEstadoActual = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Vaciar Estado Actual',
      message: '¿Estás seguro de que deseas vaciar el texto del estado actual de la partida?',
      onConfirm: async () => {
        setDraftEstado('');
        await onUpdateMemory(mem => ({ ...mem, current_status: '' }));
        setEditandoEstado(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Guardar Notas
  const guardarNotasManuales = async () => {
    await onUpdateMemory(mem => ({
      ...mem,
      manual_notes: draftNotas.trim()
    }));
    setEditandoNotas(false);
  };

  const vaciarNotasManuales = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Vaciar Notas y Secretos',
      message: '¿Estás seguro de que deseas vaciar las notas del máster de la campaña?',
      onConfirm: async () => {
        setDraftNotas('');
        await onUpdateMemory(mem => ({ ...mem, manual_notes: '' }));
        setEditandoNotas(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // --- GESTIÓN DE HILOS / MISIONES ---
  const quests = memory.quests || [];
  const threads = project.threads || [];

  const abrirCrearQuest = () => {
    setQuestForm({
      title: '',
      type: 'Principal',
      status: 'Activa',
      origin: '',
      objective: '',
      progress: '',
      dueDayOffset: 5,
      dueDayEnabled: false
    });
    setModalQuest({
      isOpen: true,
      quest: null,
      isNew: true,
      dueDayOffset: 5,
      dueDayEnabled: false
    });
  };

  const abrirEditarQuest = (q: Quest) => {
    // Buscar si tiene un hilo programado en calendario
    const relatedThread = threads.find(t => t.id === `thread_${q.id}` || t.title.toLowerCase() === q.title.toLowerCase());
    const hasDue = Boolean(relatedThread);
    let offset = 5;
    if (relatedThread && calActivo && fecha && cal) {
      const hoyAbs = aDiaAbsoluto(cal, fecha);
      offset = Math.max(1, relatedThread.dueAbsDay - hoyAbs);
    }

    setQuestForm({
      title: q.title || '',
      type: q.type || 'Principal',
      status: q.status || 'Activa',
      origin: q.origin || '',
      objective: q.objective || '',
      progress: q.progress || '',
      dueDayOffset: offset,
      dueDayEnabled: hasDue
    });

    setModalQuest({
      isOpen: true,
      quest: q,
      isNew: false,
      dueDayOffset: offset,
      dueDayEnabled: hasDue
    });
  };

  const guardarQuest = async () => {
    if (!questForm.title.trim()) return;

    const questId = modalQuest.quest?.id || `quest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newQuest: Quest = {
      id: questId,
      title: questForm.title.trim(),
      type: questForm.type.trim() || 'Principal',
      status: questForm.status.trim() || 'Activa',
      origin: questForm.origin.trim(),
      objective: questForm.objective.trim(),
      progress: questForm.progress.trim()
    };

    // Actualizar quests en memoria
    await onUpdateMemory(mem => {
      const prev = mem.quests || [];
      const index = prev.findIndex(q => q.id === questId);
      let updated: Quest[];
      if (index >= 0) {
        updated = [...prev];
        updated[index] = newQuest;
      } else {
        updated = [newQuest, ...prev];
      }
      return { ...mem, quests: updated };
    });

    // Si tiene fecha de vencimiento programada en el calendario, sincronizar ScheduledThread
    if (calActivo && cal && fecha) {
      const threadId = `thread_${questId}`;
      if (questForm.dueDayEnabled && questForm.dueDayOffset > 0) {
        const hoyAbs = aDiaAbsoluto(cal, fecha);
        const targetAbs = hoyAbs + questForm.dueDayOffset;
        const targetDateObj = desdeDiaAbsoluto(cal, targetAbs);
        const targetDateStr = fechaLegible(cal, targetDateObj);

        const newThread: ScheduledThread = {
          id: threadId,
          title: `Resolución / Vencimiento: ${newQuest.title}`,
          effect: newQuest.objective || `Vence el plazo o se resuelve el hilo: ${newQuest.title}`,
          dueAbsDay: targetAbs,
          dueDate: targetDateStr,
          hidden: false,
          status: newQuest.status.toLowerCase().includes('complet') || newQuest.status.toLowerCase().includes('resuelt') ? 'fired' : 'pending',
          origin: 'jugadora'
        };

        await onUpdate(prev => {
          const prevThreads = prev.threads || [];
          const tIdx = prevThreads.findIndex(t => t.id === threadId);
          let updatedThreads: ScheduledThread[];
          if (tIdx >= 0) {
            updatedThreads = [...prevThreads];
            updatedThreads[tIdx] = newThread;
          } else {
            updatedThreads = [...prevThreads, newThread];
          }
          return { threads: updatedThreads };
        });
      } else {
        // Eliminar thread si se desmarcó
        await onUpdate(prev => ({
          threads: (prev.threads || []).filter(t => t.id !== threadId)
        }));
      }
    }

    setModalQuest({ isOpen: false, quest: null, isNew: false });
  };

  const toggleCompletarQuest = async (q: Quest) => {
    const isCompleted = q.status.toLowerCase().includes('complet') || q.status.toLowerCase().includes('resuelt');
    const newStatus = isCompleted ? 'Activa' : 'Completada';

    await onUpdateMemory(mem => ({
      ...mem,
      quests: (mem.quests || []).map(item =>
        item.id === q.id ? { ...item, status: newStatus } : item
      )
    }));

    // Actualizar thread si existe
    const threadId = `thread_${q.id}`;
    if (project.threads?.some(t => t.id === threadId)) {
      await onUpdate(prev => ({
        threads: (prev.threads || []).map(t =>
          t.id === threadId ? { ...t, status: isCompleted ? 'pending' : 'fired' } : t
        )
      }));
    }
  };

  const borrarQuest = (q: Quest) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Hilo de la Trama',
      message: `¿Estás seguro de que deseas eliminar el hilo «${q.title}»?`,
      onConfirm: async () => {
        await onUpdateMemory(mem => ({
          ...mem,
          quests: (mem.quests || []).filter(item => item.id !== q.id)
        }));
        const threadId = `thread_${q.id}`;
        await onUpdate(prev => ({
          threads: (prev.threads || []).filter(t => t.id !== threadId)
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Filtrado de Quests
  const questsFiltradas = quests.filter(q => {
    const matchesSearch =
      busquedaHilos === '' ||
      q.title.toLowerCase().includes(busquedaHilos.toLowerCase()) ||
      (q.objective && q.objective.toLowerCase().includes(busquedaHilos.toLowerCase())) ||
      (q.progress && q.progress.toLowerCase().includes(busquedaHilos.toLowerCase())) ||
      (q.origin && q.origin.toLowerCase().includes(busquedaHilos.toLowerCase()));

    if (!matchesSearch) return false;

    const isDone = q.status.toLowerCase().includes('complet') || q.status.toLowerCase().includes('resuelt') || q.status.toLowerCase().includes('fallid');
    const threadId = `thread_${q.id}`;
    const hasThread = threads.some(t => t.id === threadId || t.title.toLowerCase().includes(q.title.toLowerCase()));

    if (filtroHilos === 'activos') return !isDone;
    if (filtroHilos === 'completados') return isDone;
    if (filtroHilos === 'temporales') return hasThread;
    return true;
  });

  const conteoActivos = quests.filter(
    q => !q.status.toLowerCase().includes('complet') && !q.status.toLowerCase().includes('resuelt') && !q.status.toLowerCase().includes('fallid')
  ).length;

  const conteoCompletados = quests.filter(
    q => q.status.toLowerCase().includes('complet') || q.status.toLowerCase().includes('resuelt')
  ).length;

  const conteoTemporales = quests.filter(q => {
    const threadId = `thread_${q.id}`;
    return threads.some(t => t.id === threadId);
  }).length;

  return (
    <div className="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-[6%] py-4 md:py-8 font-lora w-full max-w-full space-y-6 md:space-y-8">
      {/* Cabecera de la Vista de Estado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 md:pb-4 border-b border-[var(--glass-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-cinzel text-base sm:text-lg md:text-xl font-bold text-[var(--accent)] flex items-center gap-2 m-0">
              <Compass className="w-5 h-5 text-[var(--accent)]" />
              <span>Estado de la Partida e Hilos de Campaña</span>
            </h2>
            {calActivo && cal && fecha && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-cinzel bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <Calendar className="w-3 h-3" />
                {fechaLegible(cal, fecha)}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] m-0 mt-1">
            Situación presente de la compañía, objetivos en curso y directrices del Narrador.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onTriggerAIUpdate}
            disabled={isGenerating || !hasChats}
            title={
              !hasChats
                ? 'Requiere al menos un mensaje en los capítulos para sincronizar con IA'
                : 'Extraer y actualizar estado actual, tramas y notas analizando las sesiones de juego'
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Sincronizar con IA</span>
          </button>
        </div>
      </div>

      {/* BLOQUE 1: ESTADO ACTUAL DE LA PARTIDA */}
      <section className="bg-[var(--bg-color)]/70 border border-[var(--glass-border)] rounded-xl p-4 sm:p-5 md:p-6 space-y-3.5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-2.5 pb-2.5 border-b border-[var(--glass-border)]">
          <div className="space-y-0.5">
            <span className="font-cinzel font-bold text-sm sm:text-base text-[var(--accent)] flex items-center gap-2">
              <NotebookPen className="w-4 h-4 text-[var(--accent)]" />
              <span>ESTADO ACTUAL DE LA PARTIDA</span>
            </span>
            <p className="text-xs text-[var(--text-secondary)] m-0">
              Dónde están ahora mismo, qué peligros inmediatos enfrentan y con qué recursos cuentan.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {memory.current_status && (
              <button
                onClick={() =>
                  setStudioModal({
                    isOpen: true,
                    tab: 'image',
                    sceneText: `Estado actual: ${memory.current_status}`
                  })
                }
                title="Taller Creativo: Ilustrar o musicalizar la situación actual"
                className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-cinzel font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer shadow-2xs transition-colors"
              >
                <Wand2 className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                <span>Crear contenido</span>
              </button>
            )}
            {!editandoEstado && (
              <>
                <button
                  onClick={() => setEditandoEstado(true)}
                  className="flex items-center gap-1 rounded border border-[var(--user-border)] px-2.5 py-1 text-xs font-cinzel text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Editar</span>
                </button>
                {memory.current_status && (
                  <button
                    onClick={vaciarEstadoActual}
                    className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 cursor-pointer transition-colors"
                    title="Vaciar estado actual"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {editandoEstado ? (
          <div className="flex flex-col gap-2.5 pt-1">
            <textarea
              ref={estadoTextAreaRef}
              value={draftEstado}
              onChange={e => setDraftEstado(e.target.value)}
              rows={4}
              placeholder="Ubicación exacta, estado físico y anímico, amenazas inmediatas, pistas recientes y recursos disponibles..."
              className="w-full bg-[var(--surface-soft)] border border-[var(--user-border)] focus:border-[var(--accent)] p-3 rounded-lg text-sm font-lora outline-none leading-relaxed resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDraftEstado(memory.current_status || '');
                  setEditandoEstado(false);
                }}
                className="px-3 py-1.5 rounded border border-[var(--user-border)] text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEstadoActual}
                className="px-3.5 py-1.5 rounded bg-[var(--accent)] text-xs font-cinzel font-bold text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" /> Guardar Estado
              </button>
            </div>
          </div>
        ) : memory.current_status ? (
          <div
            className="markdown-body text-sm leading-relaxed p-3.5 rounded-lg bg-[var(--surface-soft)]/50 border border-[var(--glass-border)] cursor-text hover:border-[var(--accent)]/40 transition-colors"
            onClick={() => setEditandoEstado(true)}
            title="Haz clic para editar el estado"
          >
            <ReactMarkdown>{memory.current_status}</ReactMarkdown>
          </div>
        ) : (
          <div
            onClick={() => setEditandoEstado(true)}
            className="p-6 rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--surface-soft)]/20 hover:border-[var(--accent)] text-center cursor-pointer transition-all space-y-1 group"
          >
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] group-hover:text-[var(--accent)] m-0">
              No hay estado registrado aún. Haz clic para redactar la situación actual o pulsa «Sincronizar con IA».
            </p>
          </div>
        )}
      </section>

      {/* BLOQUE 2: HILOS DE LA TRAMA Y MISIONES */}
      <section className="bg-[var(--bg-color)]/70 border border-[var(--glass-border)] rounded-xl p-4 sm:p-5 md:p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-[var(--glass-border)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-cinzel font-bold text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-[var(--accent)]" />
                <span>HILOS Y TRAMAS DE LA CAMPAÑA ({quests.length})</span>
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
              Misiones en curso, misterios abiertos y consecuencias programadas en el tiempo.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={abrirCrearQuest}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold hover:bg-[var(--accent-hover)] cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Hilo / Misión</span>
            </button>
          </div>
        </div>

        {/* Filtros y Búsqueda de Hilos */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'activos', label: 'Activas', count: conteoActivos },
              { id: 'temporales', label: 'Con Fecha / Plazo', count: conteoTemporales },
              { id: 'completados', label: 'Completadas', count: conteoCompletados },
              { id: 'todos', label: 'Todas', count: quests.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFiltroHilos(tab.id as any)}
                className={`text-xs font-cinzel px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  filtroHilos === tab.id
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-2xs'
                    : 'text-[var(--text-secondary)] bg-[var(--surface-soft)] hover:text-[var(--text-primary)] border border-[var(--glass-border)]'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-80">({tab.count})</span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[160px] sm:w-56">
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busquedaHilos}
              onChange={e => setBusquedaHilos(e.target.value)}
              placeholder="Buscar hilos o tramas..."
              className="w-full bg-[var(--surface-soft)] border border-[var(--glass-border)] rounded-lg pl-8 pr-3 py-1 text-xs font-lora outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Listado de Tarjetas de Hilos / Misiones */}
        {questsFiltradas.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-[var(--glass-border)] text-center space-y-2">
            <p className="text-sm text-[var(--text-secondary)] italic m-0">
              {quests.length === 0
                ? 'No hay tramas ni misiones registradas aún.'
                : 'No se encontraron hilos con los filtros aplicados.'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] opacity-80 m-0">
              Crea un hilo manualmente con «Nuevo Hilo / Misión» o pulsa «Sincronizar con IA» para que el Narrador extraiga los objetivos del chat.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {questsFiltradas.map(q => {
              const isDone =
                q.status.toLowerCase().includes('complet') ||
                q.status.toLowerCase().includes('resuelt') ||
                q.status.toLowerCase().includes('fallid');
              const threadId = `thread_${q.id}`;
              const relatedThread = threads.find(t => t.id === threadId);

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border transition-all space-y-2.5 flex flex-col justify-between ${
                    isDone
                      ? 'bg-[var(--surface-soft)]/30 border-[var(--glass-border)] opacity-75'
                      : 'bg-[var(--surface-soft)]/60 border-[var(--glass-border)] hover:border-[var(--accent)]/50 shadow-2xs'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Fila superior: Tipo, Estado y Botones */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[10px] font-cinzel font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            q.type.toLowerCase().includes('princip')
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                              : q.type.toLowerCase().includes('person')
                              ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {q.type || 'Misión'}
                        </span>
                        <span
                          className={`text-[10px] font-cinzel px-2 py-0.5 rounded-full ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30'
                          }`}
                        >
                          {q.status || 'Activa'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            setStudioModal({
                              isOpen: true,
                              tab: 'image',
                              sceneText: `Hilo de aventura: ${q.title}. Objetivo: ${q.objective || ''}. Progreso: ${q.progress || ''}`
                            })
                          }
                          className="p-1 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                          title="Taller Creativo: Ilustrar o crear música para esta trama"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => abrirEditarQuest(q)}
                          className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-color)] cursor-pointer"
                          title="Editar hilo"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => borrarQuest(q)}
                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-500/10 cursor-pointer"
                          title="Eliminar hilo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Título */}
                    <h3 className={`font-cinzel font-bold text-sm sm:text-base m-0 ${isDone ? 'line-through opacity-80' : 'text-[var(--text-primary)]'}`}>
                      {q.title}
                    </h3>

                    {/* Origen / Encomendado por */}
                    {q.origin && (
                      <div className="text-[11px] text-[var(--text-secondary)] italic">
                        Origen: <span className="font-semibold">{q.origin}</span>
                      </div>
                    )}

                    {/* Objetivo */}
                    {q.objective && (
                      <div className="text-xs text-[var(--text-primary)] leading-relaxed">
                        <strong className="font-cinzel text-[11px] text-[var(--accent)]">Objetivo: </strong>
                        {q.objective}
                      </div>
                    )}

                    {/* Progreso */}
                    {q.progress && (
                      <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-color)]/50 p-2 rounded-md border border-[var(--glass-border)] leading-relaxed">
                        <strong className="font-cinzel text-[10px] text-[var(--text-primary)]">Avances: </strong>
                        {q.progress}
                      </div>
                    )}

                    {/* Aviso de Fecha de Vencimiento / Agenda en Calendario */}
                    {relatedThread && (
                      <div className="flex items-center gap-1.5 text-[11px] font-cinzel text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                        <Hourglass className="w-3 h-3 shrink-0" />
                        <span>Agendado en el Diario: <strong>{relatedThread.dueDate}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Botón de Resolver / Reactivar */}
                  <div className="pt-2 border-t border-[var(--glass-border)] flex justify-end">
                    <button
                      onClick={() => toggleCompletarQuest(q)}
                      className={`text-xs font-cinzel px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        isDone
                          ? 'border border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isDone ? 'Reabrir Hilo' : 'Marcar como Cumplida'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BLOQUE 3: NOTAS Y SECRETOS DE LA CAMPAÑA */}
      <section className="bg-[var(--bg-color)]/70 border border-[var(--glass-border)] rounded-xl p-4 sm:p-5 md:p-6 space-y-3.5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-2.5 pb-2.5 border-b border-[var(--glass-border)]">
          <div className="space-y-0.5">
            <span className="font-cinzel font-bold text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[var(--accent)]" />
              <span>NOTAS Y SECRETOS DE LA CAMPAÑA</span>
            </span>
            <p className="text-xs text-[var(--text-secondary)] m-0">
              Reglas de casa, secretos del máster y revelaciones futuras que el Narrador respetará estrictamente.
            </p>
          </div>

          {!editandoNotas && (
            <div className="flex items-center gap-1.5 shrink-0">
              {memory.manual_notes && (
                <>
                  <button
                    onClick={() =>
                      setStudioModal({
                        isOpen: true,
                        tab: 'image',
                        sceneText: `Notas y secretos: ${memory.manual_notes}`
                      })
                    }
                    title="Taller Creativo: Crear contenido para estas notas"
                    className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-cinzel font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer shadow-2xs"
                  >
                    <Wand2 className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                    <span>Crear contenido</span>
                  </button>
                  <button
                    onClick={() => setMostrarNotasNarrador(!mostrarNotasNarrador)}
                    className="flex items-center gap-1 rounded border border-[var(--user-border)] px-2.5 py-1 text-xs font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                    title={mostrarNotasNarrador ? 'Ocultar notas para evitar spoilers' : 'Mostrar notas secretas (Modo Narrador)'}
                  >
                    {mostrarNotasNarrador ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Ocultar notas</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Mostrar notas</span>
                      </>
                    )}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setMostrarNotasNarrador(true);
                  setEditandoNotas(true);
                }}
                className="flex items-center gap-1 rounded border border-[var(--user-border)] px-2.5 py-1 text-xs font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer transition-colors"
              >
                <Pencil className="w-3 h-3" />
                <span>Editar</span>
              </button>
              {memory.manual_notes && (
                <button
                  onClick={vaciarNotasManuales}
                  className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-500/10 cursor-pointer transition-colors"
                  title="Vaciar notas secretas"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {editandoNotas ? (
          <div className="flex flex-col gap-2.5 pt-1">
            <textarea
              ref={notasTextAreaRef}
              value={draftNotas}
              onChange={e => setDraftNotas(e.target.value)}
              rows={4}
              placeholder="Secretos de la trama, reglas caseras, futuros giros de guión, revelaciones que el Narrador debe considerar..."
              className="w-full bg-[var(--surface-soft)] border border-[var(--user-border)] focus:border-[var(--accent)] p-3 rounded-lg text-sm font-lora outline-none leading-relaxed resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDraftNotas(memory.manual_notes || '');
                  setEditandoNotas(false);
                }}
                className="px-3 py-1.5 rounded border border-[var(--user-border)] text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={guardarNotasManuales}
                className="px-3.5 py-1.5 rounded bg-[var(--accent)] text-xs font-cinzel font-bold text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" /> Guardar Notas
              </button>
            </div>
          </div>
        ) : memory.manual_notes ? (
          mostrarNotasNarrador ? (
            <div
              className="markdown-body text-sm leading-relaxed p-3.5 rounded-lg bg-[var(--surface-soft)]/50 border border-[var(--glass-border)] cursor-text hover:border-[var(--accent)]/40 transition-colors"
              onClick={() => setEditandoNotas(true)}
              title="Haz clic para editar las notas"
            >
              <ReactMarkdown>{memory.manual_notes}</ReactMarkdown>
            </div>
          ) : (
            <div
              onClick={() => setMostrarNotasNarrador(true)}
              className="p-6 rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--surface-soft)]/20 hover:border-[var(--accent)] text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="flex items-center gap-2 text-xs font-cinzel text-[var(--text-secondary)] group-hover:text-[var(--accent)] font-semibold">
                <EyeOff className="w-4 h-4" />
                <span>Notas y secretos ocultos (Modo Narrador)</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] opacity-80 m-0">
                Ocultos para evitar spoilers durante la sesión de juego. Haz clic para revelar.
              </p>
            </div>
          )
        ) : (
          <div
            onClick={() => {
              setMostrarNotasNarrador(true);
              setEditandoNotas(true);
            }}
            className="p-6 rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--surface-soft)]/20 hover:border-[var(--accent)] text-center cursor-pointer transition-all space-y-1 group"
          >
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] group-hover:text-[var(--accent)] m-0">
              Sin notas por ahora. Haz clic para añadir secretos, revelaciones o reglas de casa para el Narrador.
            </p>
          </div>
        )}
      </section>

      {/* MODAL CREAR / EDITAR QUEST */}
      {modalQuest.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--glass-border)] rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-4 font-lora">
            <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
              <h3 className="font-cinzel font-bold text-base sm:text-lg text-[var(--accent)] flex items-center gap-2 m-0">
                <GitMerge className="w-4 h-4" />
                <span>{modalQuest.isNew ? 'Nuevo Hilo de Aventura' : 'Editar Hilo de Aventura'}</span>
              </h3>
              <button
                onClick={() => setModalQuest({ isOpen: false, quest: null, isNew: false })}
                className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="font-cinzel text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Título del Hilo o Misión *
                </label>
                <input
                  type="text"
                  value={questForm.title}
                  onChange={e => setQuestForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Investigar la desaparición del mensajero élfico"
                  className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-cinzel text-xs font-bold text-[var(--text-secondary)] block mb-1">
                    Tipo de Trama
                  </label>
                  <select
                    value={questForm.type}
                    onChange={e => setQuestForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)] font-cinzel text-xs"
                  >
                    <option value="Principal">Trama Principal</option>
                    <option value="Secundaria">Misión Secundaria</option>
                    <option value="Personal">Arco Personal / Vínculo</option>
                    <option value="Consecuencia">Consecuencia del Mundo</option>
                    <option value="Rumor">Rumor / Pista</option>
                  </select>
                </div>

                <div>
                  <label className="font-cinzel text-xs font-bold text-[var(--text-secondary)] block mb-1">
                    Estado
                  </label>
                  <select
                    value={questForm.status}
                    onChange={e => setQuestForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)] font-cinzel text-xs"
                  >
                    <option value="Activa">Activa / En curso</option>
                    <option value="En pausa">En pausa / Pendiente</option>
                    <option value="Completada">Completada / Resuelta</option>
                    <option value="Fallida">Fallida / Expirada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-cinzel text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Origen / Encomendado por
                </label>
                <input
                  type="text"
                  value={questForm.origin}
                  onChange={e => setQuestForm(prev => ({ ...prev, origin: e.target.value }))}
                  placeholder="Ej: Capitana Althea en la taberna del Dragón Ciego"
                  className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="font-cinzel text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Objetivo
                </label>
                <textarea
                  value={questForm.objective}
                  onChange={e => setQuestForm(prev => ({ ...prev, objective: e.target.value }))}
                  rows={2}
                  placeholder="¿Qué debe conseguirse o resolverse para avanzar?"
                  className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg p-2.5 outline-none focus:border-[var(--accent)] resize-y leading-relaxed"
                />
              </div>

              <div>
                <label className="font-cinzel text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Progreso Actual / Pistas descubiertas
                </label>
                <textarea
                  value={questForm.progress}
                  onChange={e => setQuestForm(prev => ({ ...prev, progress: e.target.value }))}
                  rows={2}
                  placeholder="Pasos completados, pistas conseguidas..."
                  className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg p-2.5 outline-none focus:border-[var(--accent)] resize-y leading-relaxed"
                />
              </div>

              {/* Opción de agendar fecha límite en el calendario */}
              {calActivo && (
                <div className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-color)]/50 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-cinzel text-xs font-semibold text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={questForm.dueDayEnabled}
                      onChange={e =>
                        setQuestForm(prev => ({ ...prev, dueDayEnabled: e.target.checked }))
                      }
                      className="rounded text-[var(--accent)]"
                    />
                    <span>Agendar fecha de vencimiento / resolución en el Calendario</span>
                  </label>
                  {questForm.dueDayEnabled && (
                    <div className="pl-5 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span>Plazo: En</span>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={questForm.dueDayOffset}
                          onChange={e =>
                            setQuestForm(prev => ({
                              ...prev,
                              dueDayOffset: Math.max(1, parseInt(e.target.value, 10) || 1)
                            }))
                          }
                          className="w-16 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded px-2 py-0.5 text-center"
                        />
                        <span>días a partir de hoy.</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] italic m-0">
                        Aparecerá en la página del día correspondiente en el Diario y Calendario de Campaña.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
              <button
                onClick={() => setModalQuest({ isOpen: false, quest: null, isNew: false })}
                className="px-3 py-1.5 text-xs font-cinzel border border-[var(--user-border)] rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={guardarQuest}
                disabled={!questForm.title.trim()}
                className="px-4 py-1.5 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Hilo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TALLER CREATIVO */}
      {studioModal?.isOpen && (
        <CreativeStudioModal
          isOpen={studioModal.isOpen}
          initialTab={studioModal.tab || 'image'}
          sceneText={studioModal.sceneText}
          onClose={() => setStudioModal(null)}
          onInsertIntoChat={async text => {
            await onUpdateMemory(mem => ({
              ...mem,
              manual_notes: mem.manual_notes ? `${mem.manual_notes}\n\n${text}` : text
            }));
          }}
        />
      )}

      {/* MODAL CONFIRMAR */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--glass-border)] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <h3 className="font-cinzel font-bold text-base text-[var(--accent)] m-0">
              {confirmModal.title}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-lora m-0">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 text-xs font-cinzel border border-[var(--user-border)] rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-3.5 py-1.5 text-xs font-cinzel font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
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
