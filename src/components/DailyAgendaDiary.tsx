import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Project,
  CalendarConfig,
  CampaignDate,
  ProjectFile,
  TimelineEntry,
  ScheduledThread
} from '../types';
import {
  CALENDARIO_FANTASTICO,
  aDiaAbsoluto,
  aDiaAbsolutoDesdeTexto,
  calendarioValido,
  desdeDiaAbsoluto,
  diaDeLaSemana,
  diasDelMes,
  diasPorAno,
  distanciaEnDias,
  estacionDelDia,
  fechaInicial,
  fechaLegible,
  franjaDelDia,
  horaLegible,
  iconoDeClima,
  iconoDeHito,
  mesDelDia
} from '../utils/campaignCalendar';
import {
  Calendar,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Wand2,
  Image as ImageIcon,
  Smile,
  Clock,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Volume2,
  History,
  Maximize2,
  Sun,
  PartyPopper,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { CreativeStudioModal } from './CreativeStudioModal';

export interface DailyAgendaDiaryProps {
  project: Project;
  files?: ProjectFile[];
  initialSelectedDay?: number;
  initialMode?: 'dia' | 'galeria' | 'todos' | 'relojes';
  onUpdate: (fields: Partial<Project> | ((prev: Project) => Partial<Project>)) => Promise<void> | void;
  onUpdateMemory?: (updater: (prevMem: Project['memory']) => Project['memory']) => Promise<void>;
  onTriggerAIUpdate?: () => Promise<void>;
  isGenerating?: boolean;
  hasChats?: boolean;
}

// Popular quick mood emojis for D&D and fantasy journaling
const QUICK_MOODS = [
  { emoji: '🌸', label: 'Festivo / Alegre' },
  { emoji: '⚔️', label: 'Combate / Tensión' },
  { emoji: '🍷', label: 'Taberna / Descanso' },
  { emoji: '👑', label: 'Corte / Nobleza' },
  { emoji: '🎭', label: 'Engaño / Sigilo' },
  { emoji: '🕯️', label: 'Misterio / Mazmorra' },
  { emoji: '💔', label: 'Pérdida / Tragedia' },
  { emoji: '🌲', label: 'Viaje / Naturaleza' },
  { emoji: '🐉', label: 'Peligro Épico' },
  { emoji: '🌙', label: 'Nocturno / Secreto' },
  { emoji: '✨', label: 'Magia / Revelación' },
  { emoji: '😊', label: 'Paz / Victoria' }
];

export const DailyAgendaDiary: React.FC<DailyAgendaDiaryProps> = ({
  project,
  files = [],
  initialSelectedDay,
  initialMode = 'dia',
  onUpdate,
  onUpdateMemory: _onUpdateMemory,
  onTriggerAIUpdate,
  isGenerating = false,
  hasChats = false
}) => {
  const cal: CalendarConfig = project.calendar || CALENDARIO_FANTASTICO;
  const fechaSegura: CampaignDate =
    project.currentDate && Number.isFinite(project.currentDate.year)
      ? project.currentDate
      : fechaInicial(1492);

  const hoyAbs = aDiaAbsoluto(cal, fechaSegura);

  // Selected Day (Absolute day)
  const [diaSeleccionado, setDiaSeleccionado] = useState<number>(() => {
    if (initialSelectedDay !== undefined && Number.isFinite(initialSelectedDay)) {
      return initialSelectedDay;
    }
    return hoyAbs;
  });

  // Current view mode
  const [viewMode, setViewMode] = useState<'dia' | 'galeria' | 'todos' | 'relojes'>(initialMode);

  // Month navigation in calendar selector: year & monthIndex
  const [mesNavegacion, setMesNavegacion] = useState<{ year: number; month: number }>(() => {
    const mesIdx = mesDelDia(cal, fechaSegura.dayOfYear);
    return {
      year: fechaSegura.year,
      month: Number.isFinite(mesIdx) ? mesIdx : 0
    };
  });

  // Selected day details
  const fechaActiva = useMemo(
    () => desdeDiaAbsoluto(cal, diaSeleccionado, fechaSegura.minute || 0),
    [cal, diaSeleccionado, fechaSegura.minute]
  );
  const nombreDiaActivo = useMemo(() => fechaLegible(cal, fechaActiva), [cal, fechaActiva]);
  const diaSemanaActivo = useMemo(() => diaDeLaSemana(cal, diaSeleccionado), [cal, diaSeleccionado]);
  const estacionActivo = useMemo(() => estacionDelDia(cal, fechaActiva.dayOfYear), [cal, fechaActiva.dayOfYear]);
  const esHoyActivo = diaSeleccionado === hoyAbs;

  // Timeline entries grouped by day (including player character events/milestones)
  const timeline = project.timeline || [];
  const pcEvents = useMemo(() => project.memory?.player_character?.events || [], [project.memory?.player_character?.events]);

  const { porDia, unifiedTimeline } = useMemo(() => {
    const map: Record<number, { entradas: TimelineEntry[]; fecha: string }> = {};
    const unified: TimelineEntry[] = [];

    timeline.forEach(e => {
      let abs = e.absDay;
      if (!Number.isFinite(abs) || abs === 0) {
        const parsed = cal && calendarioValido(cal) ? aDiaAbsolutoDesdeTexto(cal, e.date, fechaSegura.year || 1492) : null;
        if (parsed !== null) abs = parsed;
        else abs = hoyAbs;
      }
      const entryConAbs: TimelineEntry = { ...e, absDay: abs };
      const dateStr = e.date || (cal && calendarioValido(cal) ? fechaLegible(cal, desdeDiaAbsoluto(cal, abs)) : `Día ${abs}`);
      if (!map[abs]) {
        map[abs] = { entradas: [], fecha: dateStr };
      }
      map[abs].entradas.push(entryConAbs);
      unified.push(entryConAbs);
    });

    pcEvents.forEach((pce, idx) => {
      const alreadyInTimeline = unified.some(
        t => t.id === pce.id ||
             (t.summary && pce.description && t.summary.trim().toLowerCase() === pce.description.trim().toLowerCase()) ||
             (t.title && pce.title && t.title.trim().toLowerCase() === pce.title.trim().toLowerCase())
      );

      if (!alreadyInTimeline) {
        let abs = cal && calendarioValido(cal) ? aDiaAbsolutoDesdeTexto(cal, pce.dateOrTime, fechaSegura.year || 1492) : null;
        if (abs === null) {
          abs = hoyAbs;
        }

        const dateStr = pce.dateOrTime || (cal && calendarioValido(cal) ? fechaLegible(cal, desdeDiaAbsoluto(cal, abs)) : `Día ${abs}`);
        const virtualEntry: TimelineEntry = {
          id: pce.id || `pcevent_${idx}_${Date.now()}`,
          absDay: abs,
          date: dateStr,
          title: pce.title,
          summary: pce.description || pce.title,
          mood: '🌸',
          tipo: 'personal',
          hito: pce.title
        };

        if (!map[abs]) {
          map[abs] = { entradas: [], fecha: dateStr };
        }
        map[abs].entradas.push(virtualEntry);
        unified.push(virtualEntry);
      }
    });

    return { porDia: map, unifiedTimeline: unified };
  }, [timeline, pcEvents, cal, fechaSegura.year, hoyAbs]);

  const entradasDiaActivo = useMemo(() => {
    const directas = porDia[diaSeleccionado]?.entradas || [];
    const directIds = new Set(directas.map(e => e.id));

    // Normalizador de cadenas para comparación de fechas seguras
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const nombreActivoNorm = norm(nombreDiaActivo);

    const adicionales = unifiedTimeline.filter(e => {
      if (directIds.has(e.id)) return false;
      if (e.absDay === diaSeleccionado) return true;
      if (e.date && norm(e.date) === nombreActivoNorm) return true;
      return false;
    });

    return [...directas, ...adicionales];
  }, [porDia, diaSeleccionado, nombreDiaActivo, unifiedTimeline]);

  // Scheduled threads
  const allThreads = project.threads || [];
  const activeThreads = allThreads.filter(t => t.status === 'pending');
  const pastThreads = allThreads.filter(t => t.status === 'fired' || t.status === 'cancelled');
  const threadsDiaActivo = allThreads.filter(t => t.dueAbsDay === diaSeleccionado);

  // Media gallery items (collected from timeline entries with images or project image files)
  const mediaGalleryItems = useMemo(() => {
    const items: {
      id: string;
      url: string;
      title: string;
      date: string;
      absDay: number;
      mood?: string;
      source: 'entry' | 'file';
    }[] = [];

    // From unified timeline entries
    unifiedTimeline.forEach(entry => {
      if (entry.images && Array.isArray(entry.images)) {
        entry.images.forEach((imgUrl, imgIdx) => {
          items.push({
            id: `${entry.id}-img-${imgIdx}`,
            url: imgUrl,
            title: entry.title || entry.summary.slice(0, 40) || 'Ilustración del diario',
            date: entry.date,
            absDay: entry.absDay,
            mood: entry.mood,
            source: 'entry'
          });
        });
      }
    });

    // From visual files if not already included
    files.forEach(f => {
      if (f.type?.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp|gif|svg)$/i)) {
        const fileUrl = f.content || '';
        if (fileUrl && !items.some(it => it.url === fileUrl)) {
          items.push({
            id: f.id,
            url: fileUrl,
            title: f.name.replace(/\.[^/.]+$/, ''),
            date: 'Archivo de Campaña',
            absDay: hoyAbs,
            source: 'file'
          });
        }
      }
    });

    return items;
  }, [timeline, files, hoyAbs]);

  // Modal / popover states
  const [isEntryEditorOpen, setIsEntryEditorOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDraft, setEntryDraft] = useState<{
    title: string;
    summary: string;
    mood: string;
    images: string[];
    lugar: string;
    clima: string;
    hito: string;
    minute: number;
    audioDuration: string;
    isDraft: boolean;
    tipo: TimelineEntry['tipo'];
  }>({
    title: '',
    summary: '',
    mood: '🌸',
    images: [],
    lugar: '',
    clima: '',
    hito: '',
    minute: 720, // 12:00
    audioDuration: '',
    isDraft: false,
    tipo: 'diario'
  });

  const [showMoodPickerInModal, setShowMoodPickerInModal] = useState(false);
  const [showImagePickerInModal, setShowImagePickerInModal] = useState(false);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');

  // Image zoom preview modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; date?: string } | null>(null);

  // Creative Studio modal state
  const [studioModal, setStudioModal] = useState<{
    isOpen: boolean;
    tab?: 'image' | 'video' | 'music' | 'diary';
    sceneText: string;
  } | null>(null);

  // Thread creator modal state
  const [isThreadModalOpen, setIsThreadModalOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadEffect, setNewThreadEffect] = useState('');
  const [newThreadDays, setNewThreadDays] = useState(3);
  const [newThreadHidden, setNewThreadHidden] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Synchronize calendar navigation when diaSeleccionado changes externally
  useEffect(() => {
    const mesIdx = mesDelDia(cal, fechaActiva.dayOfYear);
    if (Number.isFinite(mesIdx)) {
      setMesNavegacion(prev => {
        if (prev.year !== fechaActiva.year || prev.month !== mesIdx) {
          return { year: fechaActiva.year, month: mesIdx };
        }
        return prev;
      });
    }
  }, [cal, diaSeleccionado, fechaActiva.dayOfYear, fechaActiva.year]);

  // Navigate calendar months
  const cambiarMes = (delta: number) => {
    setMesNavegacion(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      const numMeses = cal.months.length;
      if (numMeses === 0) return prev;
      while (m < 0) {
        m += numMeses;
        y -= 1;
      }
      while (m >= numMeses) {
        m -= numMeses;
        y += 1;
      }
      return { year: y, month: m };
    });
  };

  const irAHoy = () => {
    setDiaSeleccionado(hoyAbs);
    const mesIdx = mesDelDia(cal, fechaSegura.dayOfYear);
    if (Number.isFinite(mesIdx)) {
      setMesNavegacion({ year: fechaSegura.year, month: mesIdx });
    }
  };

  const irADiaRelativo = (delta: number) => {
    const nuevoAbs = Math.max(0, diaSeleccionado + delta);
    setDiaSeleccionado(nuevoAbs);
  };

  // Build the grid cells for the current navigation month
  const mesActualConfig = cal.months[mesNavegacion.month] || cal.months[0] || { name: 'Mes', days: 30 };
  const diasMesActual = diasDelMes(cal, mesNavegacion.month);
  const diasSemana = cal.weekdays && cal.weekdays.length > 0
    ? cal.weekdays
    : ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  // Calculate day-of-week offset for first day of month if weekdays exist
  const primerDiaDelMesInfo = diasMesActual[0];
  const primerDiaAbsolutoMes = primerDiaDelMesInfo
    ? (mesNavegacion.year - 1) * diasPorAno(cal) + (primerDiaDelMesInfo.dayOfYear - 1)
    : 0;
  const offsetInicioSemana = cal.weekdays && cal.weekdays.length > 0
    ? ((primerDiaAbsolutoMes % cal.weekdays.length) + cal.weekdays.length) % cal.weekdays.length
    : 0;

  // Handlers for Entry Editor
  const openNewEntryModal = (initialTipo: TimelineEntry['tipo'] = 'diario') => {
    setEditingEntryId(null);
    setEntryDraft({
      title: '',
      summary: '',
      mood: '🌸',
      images: [],
      lugar: '',
      clima: '',
      hito: '',
      minute: fechaSegura.minute || 720,
      audioDuration: '',
      isDraft: false,
      tipo: initialTipo || 'diario'
    });
    setIsEntryEditorOpen(true);
  };

  const openEditEntryModal = (entry: TimelineEntry) => {
    setEditingEntryId(entry.id);
    setEntryDraft({
      title: entry.title || '',
      summary: entry.summary || '',
      mood: entry.mood || '🌸',
      images: entry.images || [],
      lugar: entry.lugar || '',
      clima: entry.clima || '',
      hito: entry.hito || '',
      minute: entry.minute !== undefined ? entry.minute : 720,
      audioDuration: entry.audioDuration || '',
      isDraft: Boolean(entry.isDraft),
      tipo: entry.tipo || 'diario'
    });
    setIsEntryEditorOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!entryDraft.summary.trim() && !entryDraft.title.trim()) return;

    const summaryText = entryDraft.summary.trim() || entryDraft.title.trim();
    const currentTimeline = project.timeline || [];

    if (editingEntryId) {
      // Update existing entry
      const updated = currentTimeline.map(e => {
        if (e.id === editingEntryId) {
          return {
            ...e,
            title: entryDraft.title.trim() || undefined,
            summary: summaryText,
            mood: entryDraft.mood || undefined,
            images: entryDraft.images.length > 0 ? entryDraft.images : undefined,
            lugar: entryDraft.lugar.trim() || undefined,
            clima: entryDraft.clima.trim() || undefined,
            hito: entryDraft.hito.trim() || undefined,
            minute: entryDraft.minute,
            audioDuration: entryDraft.audioDuration.trim() || undefined,
            isDraft: entryDraft.isDraft,
            tipo: entryDraft.tipo
          };
        }
        return e;
      });
      await onUpdate({ timeline: updated });
    } else {
      // Create new entry for diaSeleccionado
      const newEntry: TimelineEntry = {
        id: `tl_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        absDay: diaSeleccionado,
        date: nombreDiaActivo,
        title: entryDraft.title.trim() || undefined,
        summary: summaryText,
        mood: entryDraft.mood || undefined,
        images: entryDraft.images.length > 0 ? entryDraft.images : undefined,
        lugar: entryDraft.lugar.trim() || undefined,
        clima: entryDraft.clima.trim() || undefined,
        hito: entryDraft.hito.trim() || undefined,
        minute: entryDraft.minute,
        audioDuration: entryDraft.audioDuration.trim() || undefined,
        isDraft: entryDraft.isDraft,
        tipo: entryDraft.tipo
      };

      const updated = [...currentTimeline, newEntry].sort((a, b) => {
        if (a.absDay !== b.absDay) return a.absDay - b.absDay;
        return (a.minute || 0) - (b.minute || 0);
      });
      await onUpdate({ timeline: updated });
    }

    setIsEntryEditorOpen(false);
  };

  const handleDeleteEntry = (entryId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar entrada de diario',
      message: '¿Estás seguro de que deseas eliminar este acontecimiento del diario?',
      onConfirm: async () => {
        const updated = (project.timeline || []).filter(e => e.id !== entryId);
        await onUpdate({ timeline: updated });
        setConfirmDialog(null);
      }
    });
  };

  const handleClearDay = (absDay: number) => {
    setConfirmDialog({
      isOpen: true,
      title: `Vaciar el ${nombreDiaActivo}`,
      message: `¿Deseas eliminar todos los acontecimientos registrados para el ${nombreDiaActivo}?`,
      onConfirm: async () => {
        const updated = (project.timeline || []).filter(e => e.absDay !== absDay);
        await onUpdate({ timeline: updated });
        setConfirmDialog(null);
      }
    });
  };

  // Add thread / clock handler
  const handleCreateThread = async () => {
    if (!newThreadTitle.trim()) return;
    const dias = Math.max(1, newThreadDays);
    const targetAbs = diaSeleccionado + dias;
    const targetDate = desdeDiaAbsoluto(cal, targetAbs, 720);
    const targetLegible = fechaLegible(cal, targetDate);

    const newThread: ScheduledThread = {
      id: `thread_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newThreadTitle.trim(),
      effect: newThreadEffect.trim(),
      dueAbsDay: targetAbs,
      dueDate: targetLegible,
      hidden: newThreadHidden,
      status: 'pending',
      origin: 'jugadora'
    };

    const updatedThreads = [...(project.threads || []), newThread];
    await onUpdate({ threads: updatedThreads });
    setIsThreadModalOpen(false);
    setNewThreadTitle('');
    setNewThreadEffect('');
  };

  const handleToggleThreadStatus = async (threadId: string, newStatus: ScheduledThread['status']) => {
    const updated = (project.threads || []).map(t =>
      t.id === threadId ? { ...t, status: newStatus } : t
    );
    await onUpdate({ threads: updated });
  };

  const handleDeleteThread = async (threadId: string) => {
    const updated = (project.threads || []).filter(t => t.id !== threadId);
    await onUpdate({ threads: updated });
  };

  return (
    <div className="flex flex-col gap-6 w-full font-lora text-[var(--text-primary)]">
      {/* =========================================================================
          CABECERA SUPERIOR Y SELECTOR DE VISTA
          ========================================================================= */}
      <div className="bg-[var(--sidebar-bg)] p-3.5 sm:p-5 rounded-2xl border border-[var(--user-border)] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-cinzel text-sm sm:text-base md:text-lg font-bold text-[var(--accent)] flex items-center gap-1.5 sm:gap-2">
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent)] shrink-0" />
              Diario & Agenda de Campaña
            </span>
            <span className="text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-[var(--surface-soft)] text-[var(--text-secondary)] border border-[var(--glass-border)] font-cinzel font-semibold flex items-center gap-1.5 flex-wrap">
              <span>{cal.name}</span>
              <span>·</span>
              <span className="text-[var(--accent)] font-bold">📅 {fechaLegible(cal, fechaSegura)}</span>
              <span>⏳ {horaLegible(fechaSegura.minute)}</span>
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] m-0">
            Agenda narrativa con vista de día, selección de calendario, crónica y galería de ilustraciones de cada jornada.
          </p>
        </div>

        {/* View Mode Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          {/* View Mode Switcher Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--glass-border)] shadow-2xs w-full sm:w-auto justify-start">
            <button
              onClick={() => setViewMode('dia')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'dia'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs scale-[1.02]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> <span>Día Vista</span>
            </button>
            <button
              onClick={() => setViewMode('galeria')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'galeria'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs scale-[1.02]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
              }`}
              title="Ver galería de fotos e ilustraciones organizadas por día"
            >
              <ImageIcon className="w-3.5 h-3.5" /> <span>Galería ({mediaGalleryItems.length})</span>
            </button>
            <button
              onClick={() => setViewMode('todos')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'todos'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs scale-[1.02]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
              }`}
            >
              <History className="w-3.5 h-3.5" /> <span>Crónica ({timeline.length})</span>
            </button>
            <button
              onClick={() => setViewMode('relojes')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'relojes'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs scale-[1.02]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> <span>Relojes ({activeThreads.length})</span>
            </button>
          </div>

          {/* AI Sync Button if applicable */}
          {onTriggerAIUpdate && (
            <button
              onClick={() => onTriggerAIUpdate()}
              disabled={isGenerating || !hasChats}
              className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer disabled:opacity-50 shadow-xs w-full sm:w-auto shrink-0"
              title="Extraer sucesos de la conversación actual e incorporarlos al diario"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analizando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sincronizar con Rol</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          CALENDARIO INTERACTIVO Y SELECTOR DE DÍA (Matching Screenshot 1)
          ========================================================================= */}
      <div className="bg-[var(--surface-soft)] p-3.5 sm:p-6 rounded-2xl border border-[var(--user-border)] shadow-sm flex flex-col gap-4">
        {/* Month Navigator Header: Responsive & aligned on mobile and desktop */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 flex-1 min-w-0">
            <button
              onClick={() => cambiarMes(-1)}
              className="p-1.5 sm:p-2 rounded-lg border border-[var(--user-border)] bg-[var(--surface)] hover:bg-[var(--glass)] hover:border-[var(--accent)] text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
              title="Mes anterior"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <h3 className="font-cinzel text-xs sm:text-base md:text-lg font-bold text-[var(--text-primary)] m-0 capitalize text-center flex-1 sm:flex-initial sm:min-w-[180px] truncate px-1">
              {mesActualConfig.name} {mesNavegacion.year}
              {cal.yearSuffix ? ` ${cal.yearSuffix}` : ''}
            </h3>

            <button
              onClick={() => cambiarMes(1)}
              className="p-1.5 sm:p-2 rounded-lg border border-[var(--user-border)] bg-[var(--surface)] hover:bg-[var(--glass)] hover:border-[var(--accent)] text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
              title="Mes siguiente"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              onClick={irAHoy}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold border transition-all cursor-pointer text-center ${
                diaSeleccionado === hoyAbs
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-xs'
                  : 'bg-[var(--surface)] border-[var(--user-border)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
            >
              HOY
            </button>
            <button
              onClick={() => openNewEntryModal('diario')}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> <span>+ Entrada</span>
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        {cal.weekdays && cal.weekdays.length > 0 && (
          <div className="grid grid-cols-7 gap-1 text-center">
            {diasSemana.map((d, i) => (
              <div
                key={i}
                className="text-[11px] font-cinzel font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-80 py-1"
              >
                {d.slice(0, 3)}
              </div>
            ))}
          </div>
        )}

        {/* Month Days Grid (Clean style with circles & markers matching Screenshot 1) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Empty offset padding cells */}
          {Array.from({ length: offsetInicioSemana }).map((_, i) => (
            <div key={`offset-${i}`} className="min-h-[44px] sm:min-h-[52px] opacity-20 pointer-events-none" />
          ))}

          {/* Actual Month Days */}
          {diasMesActual.map(celda => {
            const abs = (mesNavegacion.year - 1) * diasPorAno(cal) + (celda.dayOfYear - 1);
            const isSelected = abs === diaSeleccionado;
            const isToday = abs === hoyAbs;
            const dayEntries = porDia[abs]?.entradas || [];
            const dayThreads = allThreads.filter(t => t.dueAbsDay === abs && t.status === 'pending');
            const hasEntries = dayEntries.length > 0;
            const hasThreads = dayThreads.length > 0;

            // Representative mood emoji if day has entries with mood
            const dayMood = dayEntries.find(e => e.mood)?.mood;

            return (
              <button
                key={celda.dayOfYear}
                onClick={() => {
                  setDiaSeleccionado(abs);
                  if (viewMode !== 'dia') setViewMode('dia');
                }}
                className={`relative flex flex-col items-center justify-between p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer min-h-[48px] sm:min-h-[58px] border text-left group ${
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-md ring-2 ring-[var(--accent)]/40 scale-[1.03] z-10'
                    : isToday
                    ? 'bg-[var(--surface)] border-[var(--accent)] text-[var(--accent)] font-bold'
                    : hasEntries
                    ? 'bg-[var(--surface)] border-[var(--glass-border)] hover:border-[var(--accent)] text-[var(--text-primary)]'
                    : 'bg-transparent border-transparent hover:bg-[var(--surface)]/60 text-[var(--text-primary)] opacity-85'
                }`}
              >
                {/* Top indicator & day number */}
                <div className="w-full flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex items-center justify-center font-cinzel text-xs sm:text-sm font-semibold rounded-full w-6 h-6 ${
                      isSelected
                        ? 'bg-[var(--on-accent)] text-[var(--accent)] font-bold'
                        : isToday
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                        : ''
                    }`}
                  >
                    {celda.etiqueta.replace(/\D/g, '') || celda.dayOfYear}
                  </span>

                  {/* Sun / Star / Mood badge on top right like Screenshot 1 */}
                  {dayMood ? (
                    <span className="text-xs leading-none" title={`Ánimo: ${dayMood}`}>
                      {dayMood}
                    </span>
                  ) : hasEntries ? (
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        isSelected
                          ? 'bg-amber-400 text-stone-900'
                          : 'bg-amber-400/90 text-stone-900'
                      }`}
                      title={`${dayEntries.length} acontecimientos`}
                    >
                      <Sun className="w-2.5 h-2.5 text-stone-900 fill-stone-900" />
                    </span>
                  ) : null}
                </div>

                {/* Bottom indicators row: red dot for deadlines, images counter, dots */}
                <div className="w-full flex items-center justify-center gap-1 mt-1">
                  {hasThreads && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"
                      title="Vence un reloj / plazo"
                    />
                  )}
                  {dayEntries.some(e => e.images && e.images.length > 0) && (
                    <span
                      className={`text-[9px] ${isSelected ? 'text-[var(--on-accent)]' : 'text-[var(--accent)]'}`}
                      title="Contiene imágenes"
                    >
                      📷
                    </span>
                  )}
                  {hasEntries && dayEntries.length > 1 && (
                    <span
                      className={`text-[10px] font-cinzel font-bold ${
                        isSelected ? 'text-[var(--on-accent)]/80' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      +{dayEntries.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Festival Intercalares if present */}
        {diasMesActual.some(c => c.esFestival) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-[var(--glass-border)]">
            {diasMesActual
              .filter(c => c.esFestival)
              .map(c => {
                const abs = (mesNavegacion.year - 1) * diasPorAno(cal) + (c.dayOfYear - 1);
                const isSelected = abs === diaSeleccionado;
                return (
                  <button
                    key={c.dayOfYear}
                    onClick={() => {
                      setDiaSeleccionado(abs);
                      setViewMode('dia');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-cinzel cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs'
                        : 'bg-[var(--surface)] border-[var(--glass-border)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <PartyPopper className="w-3.5 h-3.5 text-amber-500" />
                    <span>{c.etiqueta}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Calendar Footer Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)] pt-2 border-t border-[var(--glass-border)]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Acontecimientos / Notas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Vence un plazo / reloj
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" /> Día de hoy
            </span>
          </div>
          <span className="italic font-cinzel text-[11px]">
            Haz clic en cualquier día para abrir su diario y agenda
          </span>
        </div>
      </div>

      {/* =========================================================================
          VISTA 1: DÍA VISTA (DAY VIEW / DIARIO & AGENDA) (Matching Screenshot 1)
          ========================================================================= */}
      {viewMode === 'dia' && (
        <div className="bg-[var(--surface-soft)] p-4 sm:p-6 rounded-2xl border border-[var(--user-border)] shadow-sm flex flex-col gap-6">
          {/* Day View Header (e.g. Wednesday, Jul 12, 2022) */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--glass-border)]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg sm:text-xl font-cinzel font-bold text-[var(--accent)] flex items-center gap-2">
                  <span title={estacionActivo.nombre}>{estacionActivo.icono}</span>
                  {nombreDiaActivo}
                </span>
                {diaSemanaActivo && (
                  <span className="text-sm font-cinzel text-[var(--text-secondary)]">
                    ({diaSemanaActivo})
                  </span>
                )}
                {esHoyActivo ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)]">
                    HOY
                  </span>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)] font-cinzel px-2 py-0.5 bg-[var(--surface)] rounded border border-[var(--glass-border)]">
                    {distanciaEnDias(diaSeleccionado - hoyAbs)}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] m-0">
                Acontecimientos, apuntes, ilustraciones y eventos que tuvieron lugar en esta jornada.
              </p>
            </div>

            {/* Quick Day Stepper & Actions */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="flex items-center border border-[var(--user-border)] rounded-lg bg-[var(--surface)] p-0.5 shrink-0">
                <button
                  onClick={() => irADiaRelativo(-1)}
                  className="px-2 sm:px-2.5 py-1 text-xs font-cinzel hover:text-[var(--accent)] hover:bg-[var(--surface-soft)] rounded transition-colors cursor-pointer flex items-center gap-1"
                  title="Día anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Anterior</span>
                </button>
                <button
                  onClick={() => irADiaRelativo(1)}
                  className="px-2 sm:px-2.5 py-1 text-xs font-cinzel hover:text-[var(--accent)] hover:bg-[var(--surface-soft)] rounded transition-colors cursor-pointer flex items-center gap-1"
                  title="Día siguiente"
                >
                  <span className="hidden xs:inline">Siguiente</span> <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => openNewEntryModal('diario')}
                className="px-3 py-1.5 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> <span>+ <span className="hidden sm:inline">Añadir </span>Acontecimiento</span>
              </button>

              {entradasDiaActivo.length > 0 && (
                <button
                  onClick={() => {
                    const fullScene = entradasDiaActivo
                      .map(
                        e =>
                          `${e.lugar ? `[${e.lugar}] ` : ''}${e.summary}${e.hito ? ` (${e.hito})` : ''}`
                      )
                      .join('. ');
                    setStudioModal({
                      isOpen: true,
                      tab: 'image',
                      sceneText: `Acontecimientos del ${nombreDiaActivo}: ${fullScene}`
                    });
                  }}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-cinzel font-bold text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40 border border-amber-500/50 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                  title="Taller Creativo: Generar ilustración o música para el día"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span className="hidden sm:inline">Taller Creativo</span>
                </button>
              )}

              {entradasDiaActivo.length > 0 && (
                <button
                  onClick={() => handleClearDay(diaSeleccionado)}
                  className="p-1.5 sm:p-2 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-500/30 shrink-0"
                  title="Vaciar todas las entradas de este día"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Relojes / Cuentas atrás que vencen en este día */}
          {threadsDiaActivo.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-xs font-cinzel font-bold text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Relojes o Plazos que vencen este día ({threadsDiaActivo.length}):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {threadsDiaActivo.map(t => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--user-border)] flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-cinzel font-bold text-[var(--text-primary)]">
                        {t.title}
                      </span>
                      {t.effect && (
                        <span className="text-[11px] text-[var(--text-secondary)] font-lora">
                          {t.effect}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {t.status === 'pending' && (
                        <button
                          onClick={() => handleToggleThreadStatus(t.id, 'fired')}
                          className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-cinzel font-bold hover:bg-emerald-200 cursor-pointer"
                          title="Marcar como cumplido"
                        >
                          Cumplir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List of Day Entries matching Screenshot 1 Cards */}
          {entradasDiaActivo.length === 0 ? (
            <div className="py-12 px-6 rounded-2xl bg-[var(--surface)]/40 border border-dashed border-[var(--glass-border)] text-center flex flex-col items-center justify-center gap-3">
              <BookOpen className="w-10 h-10 text-[var(--accent)] opacity-40" />
              <p className="font-cinzel text-base text-[var(--text-secondary)] m-0">
                No hay acontecimientos registrados para el {nombreDiaActivo}.
              </p>
              <p className="text-xs text-[var(--text-secondary)] font-lora italic m-0 max-w-md">
                A medida que juegues en el chat, el Narrador anotará los hechos clave de cada día, o puedes pulsar el botón de abajo para redactar una entrada de diario personalizada.
              </p>
              <button
                onClick={() => openNewEntryModal('diario')}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Escribir entrada en el diario de hoy
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {entradasDiaActivo.map((entrada, idx) => {
                const franja = entrada.minute !== undefined ? horaLegible(entrada.minute) : '12:00';
                const franjaNombre = entrada.minute !== undefined ? franjaDelDia(entrada.minute) : '';
                const iconoClima = iconoDeClima(entrada.clima);
                const iconoHitoVal = iconoDeHito(entrada.hito);

                return (
                  <div
                    key={entrada.id}
                    className="bg-[var(--surface)] border border-[var(--user-border)] hover:border-[var(--accent)]/50 rounded-2xl p-4 sm:p-5 shadow-2xs transition-all flex flex-col gap-3 group relative"
                  >
                    {/* Header Row: Time badge + Title + Mood badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Time badge e.g. 13:00 / Tarde */}
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-soft)] text-[var(--accent)] font-cinzel font-bold text-xs border border-[var(--glass-border)] flex items-center gap-1 shadow-2xs">
                          <Clock className="w-3 h-3" />
                          <span>{franja}</span>
                          {franjaNombre && (
                            <span className="text-[10px] text-[var(--text-secondary)] font-normal hidden sm:inline">
                              · {franjaNombre}
                            </span>
                          )}
                        </span>

                        {/* Title of the entry e.g. "Mi fiesta de cumpleaños" */}
                        <h4 className="font-cinzel text-base sm:text-lg font-bold text-[var(--text-primary)] m-0">
                          {entrada.title || `Acontecimiento #${idx + 1}`}
                        </h4>

                        {entrada.isDraft && (
                          <span className="text-[10px] font-cinzel px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 font-semibold">
                            Borrador
                          </span>
                        )}
                      </div>

                      {/* Mood / Sentiment icon on top right e.g. 🌸, ⚔️ */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {entrada.mood && (
                          <span
                            className="text-xl leading-none px-2 py-1 rounded-lg bg-[var(--surface-soft)] border border-[var(--glass-border)] shadow-2xs"
                            title={`Ánimo: ${entrada.mood}`}
                          >
                            {entrada.mood}
                          </span>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditEntryModal(entrada)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-soft)] rounded-lg transition-colors cursor-pointer"
                            title="Editar entrada"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setStudioModal({
                                isOpen: true,
                                tab: 'image',
                                sceneText: `${entrada.title ? `${entrada.title}: ` : ''}${entrada.summary}`
                              })
                            }
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Taller Creativo (Generar imagen/música)"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entrada.id)}
                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar entrada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Image Attachments Grid Preview (Matching Screenshot 1) */}
                    {entrada.images && entrada.images.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-1">
                        {entrada.images.slice(0, 4).map((imgUrl, imgIdx) => {
                          const isLastWithMore = imgIdx === 3 && entrada.images!.length > 4;
                          const moreCount = entrada.images!.length - 4;

                          return (
                            <div
                              key={imgIdx}
                              onClick={() =>
                                setPreviewImage({
                                  url: imgUrl,
                                  title: entrada.title || 'Ilustración del diario',
                                  date: entrada.date
                                })
                              }
                              className="relative aspect-video sm:aspect-square rounded-xl overflow-hidden border border-[var(--glass-border)] group/img cursor-pointer bg-black/20"
                            >
                              <img
                                src={imgUrl}
                                alt={`Adjunto ${imgIdx + 1}`}
                                className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                                referrerPolicy="no-referrer"
                              />
                              {isLastWithMore && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-cinzel font-bold text-sm sm:text-base backdrop-blur-xs">
                                  +{moreCount}
                                </div>
                              )}
                              <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <Maximize2 className="w-3 h-3" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Narrative Summary Body in Lora typography */}
                    <div className="text-sm sm:text-base leading-relaxed font-lora text-[var(--text-primary)] markdown-body py-0.5">
                      <ReactMarkdown>{entrada.summary}</ReactMarkdown>
                    </div>

                    {/* Footer Tags & Context Badges (Audio, Lugar, Clima, Hito) */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--glass-border)] text-xs text-[var(--text-secondary)]">
                      {entrada.audioDuration && (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 flex items-center gap-1 font-cinzel text-[11px] font-semibold">
                          <Volume2 className="w-3 h-3" /> {entrada.audioDuration}
                        </span>
                      )}

                      {entrada.lugar && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-soft)] border border-[var(--glass-border)] flex items-center gap-1 font-cinzel text-[11px]">
                          📍 {entrada.lugar}
                        </span>
                      )}

                      {entrada.clima && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-soft)] border border-[var(--glass-border)] flex items-center gap-1 font-cinzel text-[11px]">
                          {iconoClima} {entrada.clima}
                        </span>
                      )}

                      {entrada.hito && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/30 flex items-center gap-1 font-cinzel text-[11px] font-semibold">
                          {iconoHitoVal} {entrada.hito}
                        </span>
                      )}

                      {entrada.tipo && entrada.tipo !== 'diario' && (
                        <span className="px-2 py-0.5 rounded bg-[var(--surface-soft)] text-[10px] font-cinzel uppercase tracking-wider text-[var(--text-secondary)]">
                          {entrada.tipo}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VISTA 2: VISTA GALERÍA / MEDIA (Matching Screenshot 1 "Vista de archivos media")
          ========================================================================= */}
      {viewMode === 'galeria' && (
        <div className="bg-[var(--surface-soft)] p-4 sm:p-6 rounded-2xl border border-[var(--user-border)] shadow-sm flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-[var(--text-primary)] m-0">
                Galería de Ilustraciones y Crónica Visual ({mediaGalleryItems.length})
              </h3>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">
              Organizado cronológicamente a partir de las entradas del diario
            </span>
          </div>

          {mediaGalleryItems.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
              <ImageIcon className="w-12 h-12 text-[var(--accent)] opacity-40" />
              <p className="font-cinzel text-base m-0">No hay ilustraciones guardadas aún en el diario.</p>
              <p className="text-xs font-lora italic max-w-md m-0">
                Puedes generar escenas con el Taller Creativo o adjuntar imágenes a las entradas de diario para verlas en este muro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {mediaGalleryItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setPreviewImage({ url: item.url, title: item.title, date: item.date })}
                  className="group relative bg-[var(--surface)] border border-[var(--user-border)] hover:border-[var(--accent)] rounded-2xl overflow-hidden shadow-2xs transition-all cursor-pointer flex flex-col"
                >
                  <div className="aspect-square w-full overflow-hidden bg-black/20 relative">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    {item.mood && (
                      <span className="absolute top-2 right-2 text-base px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white">
                        {item.mood}
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1 justify-between flex-1">
                    <h5 className="font-cinzel font-bold text-xs sm:text-sm text-[var(--text-primary)] line-clamp-1 m-0">
                      {item.title}
                    </h5>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-cinzel">
                      <span>📅 {item.date}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDiaSeleccionado(item.absDay);
                          setViewMode('dia');
                        }}
                        className="text-[var(--accent)] hover:underline flex items-center gap-0.5"
                      >
                        Ver día →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VISTA 3: CRÓNICA COMPLETA (TODOS LOS DÍAS)
          ========================================================================= */}
      {viewMode === 'todos' && (
        <div className="bg-[var(--surface-soft)] p-4 sm:p-6 rounded-2xl border border-[var(--user-border)] shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-[var(--text-primary)] m-0">
                Crónica Completa de la Campaña ({unifiedTimeline.length} entradas)
              </h3>
            </div>
            <button
              onClick={() => openNewEntryModal('diario')}
              className="px-3 py-1.5 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded-lg hover:bg-[var(--accent-hover)] cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> + Nueva Entrada
            </button>
          </div>

          {unifiedTimeline.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-secondary)] font-cinzel">
              No hay entradas en la crónica todavía.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(porDia)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([absDayStr, data]) => {
                  const abs = Number(absDayStr);
                  const isCurrentDay = abs === hoyAbs;

                  return (
                    <div key={abs} className="flex flex-col gap-3">
                      <div className="flex items-center justify-between bg-[var(--surface)] px-4 py-2 rounded-xl border border-[var(--glass-border)]">
                        <div className="flex items-center gap-2">
                          <span className="font-cinzel font-bold text-sm text-[var(--accent)]">
                            📅 {data.fecha}
                          </span>
                          {isCurrentDay && (
                            <span className="text-[10px] font-cinzel px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-bold">
                              HOY
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setDiaSeleccionado(abs);
                            setViewMode('dia');
                          }}
                          className="text-xs font-cinzel text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          Abrir este día →
                        </button>
                      </div>

                      <div className="space-y-2.5 pl-2 sm:pl-4 border-l-2 border-[var(--glass-border)] ml-2">
                        {data.entradas.map(entry => (
                          <div
                            key={entry.id}
                            className="bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--user-border)] flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {entry.mood && <span className="text-base">{entry.mood}</span>}
                                <span className="font-cinzel font-bold text-sm text-[var(--text-primary)]">
                                  {entry.title || entry.summary.slice(0, 50)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEditEntryModal(entry)}
                                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-1 text-stone-400 hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="text-xs sm:text-sm font-lora text-[var(--text-primary)] markdown-body">
                              <ReactMarkdown>{entry.summary}</ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VISTA 4: RELOJES Y CUENTAS ATRÁS
          ========================================================================= */}
      {viewMode === 'relojes' && (
        <div className="bg-[var(--surface-soft)] p-4 sm:p-6 rounded-2xl border border-[var(--user-border)] shadow-sm flex flex-col gap-5">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-[var(--text-primary)] m-0">
                Relojes de Consecuencias y Cuentas Atrás ({activeThreads.length} activos)
              </h3>
            </div>
            <button
              onClick={() => setIsThreadModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded-lg hover:bg-[var(--accent-hover)] cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> + Nuevo Reloj
            </button>
          </div>

          {activeThreads.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-secondary)] font-cinzel flex flex-col items-center gap-2">
              <Clock className="w-10 h-10 opacity-40 text-[var(--accent)]" />
              <p className="m-0">No hay relojes activos en este momento.</p>
              <button
                onClick={() => setIsThreadModalOpen(true)}
                className="mt-2 text-xs text-[var(--accent)] hover:underline cursor-pointer"
              >
                Crear un plazo temporal o consecuencia
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeThreads.map(t => {
                const diasRestantes = t.dueAbsDay - hoyAbs;
                const esUrgente = diasRestantes <= 0;
                const esInminente = diasRestantes > 0 && diasRestantes <= 3;

                return (
                  <div
                    key={t.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-2xs ${
                      esUrgente
                        ? 'bg-red-500/10 border-red-500/40'
                        : esInminente
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-[var(--surface)] border-[var(--user-border)]'
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-xs font-cinzel font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                            esUrgente
                              ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300'
                              : esInminente
                              ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {diasRestantes === 0
                            ? '¡Vence hoy!'
                            : diasRestantes < 0
                            ? `Venció hace ${Math.abs(diasRestantes)}d`
                            : `Vence ${distanciaEnDias(diasRestantes)}`}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleThreadStatus(t.id, 'fired')}
                            className="p-1 text-xs rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer"
                            title="Marcar como cumplido"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteThread(t.id)}
                            className="p-1 text-stone-400 hover:text-red-500 cursor-pointer"
                            title="Eliminar reloj"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-cinzel font-bold text-sm sm:text-base text-[var(--text-primary)] m-0">
                        {t.title}
                      </h4>

                      {t.effect && (
                        <p className="text-xs font-lora text-[var(--text-secondary)] m-0 leading-relaxed bg-[var(--surface-soft)] p-2 rounded-lg border border-[var(--glass-border)]">
                          <strong>Consecuencia:</strong> {t.effect}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-cinzel pt-2 border-t border-[var(--glass-border)]">
                      <span>📅 Vence: {t.dueDate}</span>
                      <button
                        onClick={() => {
                          setDiaSeleccionado(t.dueAbsDay);
                          setViewMode('dia');
                        }}
                        className="text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        Ir al día en calendario →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Relojes pasados o cumplidos */}
          {pastThreads.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--glass-border)] space-y-2">
              <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)]">
                Relojes Cumplidos o Pasados ({pastThreads.length})
              </span>
              <div className="flex flex-col gap-2">
                {pastThreads.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] text-xs border border-[var(--glass-border)] opacity-80"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-cinzel font-semibold">{t.title}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">({t.dueDate || 'Fecha pasada'})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-cinzel ${
                          t.status === 'fired'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                        }`}
                      >
                        {t.status === 'fired' ? 'Cumplido' : 'Cancelado'}
                      </span>
                      <button
                        onClick={() => handleDeleteThread(t.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        title="Eliminar del historial"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL DE EDICIÓN / CREACIÓN DE ENTRADA DE DIARIO (Matching Screenshot 2)
          ========================================================================= */}
      {isEntryEditorOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[170] p-3 sm:p-4">
          <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-lora">
            {/* Modal Header with Toolbar: ✕, 📷, 😊, 🪄, GUARDAR */}
            <div className="p-3 sm:p-4 border-b border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2 bg-[var(--sidebar-bg)]">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setIsEntryEditorOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer shrink-0"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
                <span className="font-cinzel text-sm sm:text-base md:text-lg font-bold text-[var(--accent)] truncate">
                  {editingEntryId ? 'Editar Entrada de Diario' : 'Nueva Entrada de Diario'}
                </span>
              </div>

              {/* Action Icons & Save Button */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
                <button
                  onClick={() => setShowImagePickerInModal(prev => !prev)}
                  className="p-1.5 sm:p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
                  title="Adjuntar Imagen / Ilustración"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowMoodPickerInModal(prev => !prev)}
                  className="p-1.5 sm:p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
                  title="Cambiar Ánimo / Mood"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setStudioModal({
                      isOpen: true,
                      tab: 'image',
                      sceneText: `${entryDraft.title ? `${entryDraft.title}: ` : ''}${entryDraft.summary}`
                    })
                  }
                  className="p-1.5 sm:p-2 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 transition-colors cursor-pointer"
                  title="Taller Creativo (Generar con IA)"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveEntry}
                  disabled={!entryDraft.title.trim() && !entryDraft.summary.trim()}
                  className="px-3 sm:px-4 py-1.5 rounded-xl font-cinzel text-xs font-bold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> GUARDAR
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-sm flex-1">
              {/* Date selector header dropdown & mood: "12 Flamerule 1492 DR ▾" + mood */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--glass-border)] bg-[var(--surface-soft)] p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--accent)]" />
                  <span className="font-cinzel text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    {nombreDiaActivo}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] font-cinzel">
                    ({horaLegible(entryDraft.minute)})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowMoodPickerInModal(prev => !prev)}
                    className="text-xl px-2.5 py-1 rounded-xl bg-[var(--surface)] border border-[var(--user-border)] hover:border-[var(--accent)] cursor-pointer shadow-2xs flex items-center gap-1"
                    title="Seleccionar estado de ánimo"
                  >
                    <span>{entryDraft.mood || '🌸'}</span>
                    <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
                  </button>
                </div>
              </div>

              {/* Mood picker dropdown popover inside modal */}
              {showMoodPickerInModal && (
                <div className="p-3 bg-[var(--surface)] border border-[var(--accent)] rounded-xl shadow-lg flex flex-wrap gap-2 animate-in fade-in duration-100">
                  <span className="w-full text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                    Selecciona el ánimo o tono del acontecimiento:
                  </span>
                  {QUICK_MOODS.map(m => (
                    <button
                      key={m.emoji}
                      onClick={() => {
                        setEntryDraft(prev => ({ ...prev, mood: m.emoji }));
                        setShowMoodPickerInModal(false);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-cinzel cursor-pointer transition-colors ${
                        entryDraft.mood === m.emoji
                          ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold border-[var(--accent)]'
                          : 'bg-[var(--surface-soft)] border-[var(--glass-border)] hover:border-[var(--accent)]'
                      }`}
                    >
                      <span className="text-base">{m.emoji}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Title input field (Matching Screenshot 2) */}
              <div>
                <label className="block text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                  Título de la entrada / Acontecimiento
                </label>
                <input
                  type="text"
                  value={entryDraft.title}
                  onChange={e => setEntryDraft(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej. Mi fiesta de cumpleaños / Llegada a las Puertas de Luskan..."
                  className="w-full bg-[var(--surface)] border border-[var(--user-border)] rounded-xl px-3.5 py-2.5 font-cinzel text-base font-bold text-[var(--accent)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              {/* Narrative Content Textarea */}
              <div>
                <label className="block text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                  Relato narrativo o notas del día
                </label>
                <textarea
                  value={entryDraft.summary}
                  onChange={e => setEntryDraft(prev => ({ ...prev, summary: e.target.value }))}
                  rows={6}
                  placeholder="Escribe lo que aconteció en esta escena, los diálogos o las impresiones personales..."
                  className="w-full bg-[var(--surface)] border border-[var(--user-border)] rounded-xl p-3.5 font-lora text-sm sm:text-base outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] leading-relaxed resize-y"
                />
              </div>

              {/* Tags & Context Fields: Minute, Lugar, Clima, Hito */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                    📍 Lugar
                  </label>
                  <input
                    type="text"
                    value={entryDraft.lugar}
                    onChange={e => setEntryDraft(prev => ({ ...prev, lugar: e.target.value }))}
                    placeholder="Ej. Portal Bostezante"
                    className="w-full bg-[var(--surface)] border border-[var(--user-border)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                    ⛅ Clima
                  </label>
                  <input
                    type="text"
                    value={entryDraft.clima}
                    onChange={e => setEntryDraft(prev => ({ ...prev, clima: e.target.value }))}
                    placeholder="Ej. Lluvia fina y fría"
                    className="w-full bg-[var(--surface)] border border-[var(--user-border)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                    ⚔️ Hito o Suceso Clave
                  </label>
                  <input
                    type="text"
                    value={entryDraft.hito}
                    onChange={e => setEntryDraft(prev => ({ ...prev, hito: e.target.value }))}
                    placeholder="Ej. Encuentro secreto"
                    className="w-full bg-[var(--surface)] border border-[var(--user-border)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Image Attachments inside Modal */}
              <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Ilustraciones y Fotos Adjuntas ({entryDraft.images.length})
                  </span>
                  <button
                    onClick={() => setShowImagePickerInModal(prev => !prev)}
                    className="text-xs font-cinzel text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Añadir imagen
                  </button>
                </div>

                {showImagePickerInModal && (
                  <div className="p-3 bg-[var(--surface-soft)] rounded-xl border border-[var(--glass-border)] space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customImageUrlInput}
                        onChange={e => setCustomImageUrlInput(e.target.value)}
                        placeholder="Pegar URL o Base64 de imagen..."
                        className="flex-1 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        onClick={() => {
                          if (customImageUrlInput.trim()) {
                            setEntryDraft(prev => ({
                              ...prev,
                              images: [...prev.images, customImageUrlInput.trim()]
                            }));
                            setCustomImageUrlInput('');
                          }
                        }}
                        className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-bold hover:bg-[var(--accent-hover)] cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>

                    {/* Pick from campaign files */}
                    {files.filter(f => f.type?.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp|gif|svg)$/i)).length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-cinzel text-[var(--text-secondary)]">
                          O elegir de los archivos de campaña:
                        </span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {files
                            .filter(f => f.type?.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp|gif|svg)$/i))
                            .slice(0, 8)
                            .map(file => (
                              <button
                                key={file.id}
                                onClick={() => {
                                  if (file.content && !entryDraft.images.includes(file.content)) {
                                    setEntryDraft(prev => ({
                                      ...prev,
                                      images: [...prev.images, file.content!]
                                    }));
                                  }
                                }}
                                className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-[var(--glass-border)] hover:border-[var(--accent)] relative cursor-pointer group"
                                title={file.name}
                              >
                                <img
                                  src={file.content}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                                  <Plus className="w-4 h-4" />
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Thumbnails of attached images */}
                {entryDraft.images.length > 0 && (
                  <div className="flex flex-wrap gap-2.5">
                    {entryDraft.images.map((imgUrl, i) => (
                      <div
                        key={i}
                        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-[var(--user-border)] group"
                      >
                        <img
                          src={imgUrl}
                          alt={`Adjunto ${i + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          onClick={() =>
                            setEntryDraft(prev => ({
                              ...prev,
                              images: prev.images.filter((_, idx) => idx !== i)
                            }))
                          }
                          className="absolute top-1 right-1 p-1 rounded-full bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Eliminar imagen"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--glass-border)] bg-[var(--sidebar-bg)] flex justify-end gap-2">
              <button
                onClick={() => setIsEntryEditorOpen(false)}
                className="px-4 py-2 rounded-xl font-cinzel text-xs border border-[var(--user-border)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEntry}
                disabled={!entryDraft.title.trim() && !entryDraft.summary.trim()}
                className="px-5 py-2 rounded-xl font-cinzel text-xs font-bold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Guardar Entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DE NUEVO RELOJ / CUENTA ATRÁS
          ========================================================================= */}
      {isThreadModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[170] p-4">
          <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--sidebar-bg)]">
              <h3 className="font-cinzel text-base font-bold text-[var(--accent)] m-0 flex items-center gap-2">
                <CalendarClock className="w-4 h-4" /> Nuevo Reloj / Plazo Temporal
              </h3>
              <button
                onClick={() => setIsThreadModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-sm font-lora">
              <div>
                <label className="block text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                  Nombre del reloj o suceso
                </label>
                <input
                  type="text"
                  value={newThreadTitle}
                  onChange={e => setNewThreadTitle(e.target.value)}
                  placeholder="Ej. Incubación de veneno / Viaje a Luskan / Consejo noble..."
                  className="w-full bg-[var(--surface)] border border-[var(--user-border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)] font-cinzel"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                  Días de plazo hasta que venza (a partir del día seleccionado)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={newThreadDays}
                  onChange={e => setNewThreadDays(parseInt(e.target.value, 10) || 1)}
                  className="w-28 bg-[var(--surface)] border border-[var(--user-border)] rounded-xl px-3 py-2 text-sm text-center outline-none focus:border-[var(--accent)] font-cinzel font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1">
                  Consecuencia o qué ocurre al vencer
                </label>
                <textarea
                  value={newThreadEffect}
                  onChange={e => setNewThreadEffect(e.target.value)}
                  rows={2}
                  placeholder="Ej. El barco arriba a puerto o el personaje sufre un nivel de agotamiento..."
                  className="w-full bg-[var(--surface)] border border-[var(--user-border)] rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newThreadHiddenCheckbox"
                  checked={newThreadHidden}
                  onChange={e => setNewThreadHidden(e.target.checked)}
                  className="rounded border-[var(--user-border)] accent-[var(--accent)]"
                />
                <label htmlFor="newThreadHiddenCheckbox" className="text-xs text-[var(--text-secondary)] font-cinzel cursor-pointer">
                  Ocultar reloj de la vista del jugador (solo DM/Director)
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--glass-border)] bg-[var(--sidebar-bg)] flex justify-end gap-2">
              <button
                onClick={() => setIsThreadModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl font-cinzel text-xs border border-[var(--user-border)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateThread}
                disabled={!newThreadTitle.trim()}
                className="px-4 py-1.5 rounded-xl font-cinzel text-xs font-bold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer disabled:opacity-50"
              >
                Crear Reloj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[190] p-4 cursor-zoom-out"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="max-w-3xl w-full max-h-[90vh] flex flex-col items-center gap-3 bg-[var(--bg-color)] p-4 rounded-2xl border-2 border-[var(--accent)] shadow-2xl cursor-default"
          >
            <div className="w-full flex justify-between items-center pb-2 border-b border-[var(--glass-border)]">
              <h4 className="font-cinzel font-bold text-sm sm:text-base text-[var(--accent)] m-0">
                {previewImage.title}
              </h4>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-xl">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[70vh] w-auto object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            {previewImage.date && (
              <span className="text-xs font-cinzel text-[var(--text-secondary)]">
                📅 {previewImage.date}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[200] p-4">
          <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-2xl shadow-2xl w-[420px] max-w-full font-lora overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--sidebar-bg)]">
              <h4 className="font-cinzel text-base text-[var(--accent)] font-bold m-0">
                {confirmDialog.title}
              </h4>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-sm mb-5 leading-relaxed text-[var(--text-primary)]">
                {confirmDialog.message}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-[var(--user-border)] text-xs font-cinzel hover:bg-[var(--surface-soft)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDialog.onConfirm()}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-cinzel font-bold cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creative Studio Modal */}
      {studioModal?.isOpen && (
        <CreativeStudioModal
          isOpen={studioModal.isOpen}
          initialTab={studioModal.tab || 'image'}
          sceneText={studioModal.sceneText}
          onClose={() => setStudioModal(null)}
          onInsertIntoChat={async text => {
            if (onUpdate) {
              const prevNotes = project.memory?.manual_notes || '';
              await onUpdate({
                memory: {
                  ...project.memory,
                  story: project.memory?.story || '',
                  quests: project.memory?.quests || [],
                  npcs: project.memory?.npcs || [],
                  locations: project.memory?.locations || [],
                  current_status: project.memory?.current_status || '',
                  manual_notes: prevNotes ? `${prevNotes}\n\n${text}` : text
                }
              });
            }
          }}
        />
      )}
    </div>
  );
};
