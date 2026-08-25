import React, { useState, useMemo } from 'react';
import {
  Project,
  CalendarConfig,
  CampaignDate,
  ProjectFile,
  Chat,
  TimelineEntry
} from '../types';
import {
  CalendarioDeducido,
  deducirCalendario,
  describeApiError
} from '../utils/geminiHelper';
import {
  CALENDARIOS_PREDEFINIDOS,
  CALENDARIO_FANTASTICO,
  aDiaAbsoluto,
  aDiaAbsolutoDesdeTexto,
  avanzar,
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
  mesDelDia,
  obtenerInfoRelacion
} from '../utils/campaignCalendar';

import {
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  Loader,
  NotebookPen,
  PartyPopper,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Newspaper,
  Moon
} from 'lucide-react';
import { CreativeStudioModal } from './CreativeStudioModal';

/**
 * Vista unificada de Calendario y Diario de Campaña.
 * 
 * Cada día tiene su propio espacio exclusivo e independiente. El diario o resumen
 * del día vive DENTRO de la página del día que le corresponde, sin duplicidades
 * ni bloques externos.
 */
export const CalendarView: React.FC<{
  project: Project;
  files?: ProjectFile[];
  chats?: Chat[];
  onUpdate: (fields: Partial<Project> | ((prev: Project) => Partial<Project>)) => Promise<void> | void;
  onUpdateMemory?: (updater: (prevMem: Project['memory']) => Project['memory']) => Promise<void>;
  onTriggerAIUpdate?: () => Promise<void>;
  isGenerating?: boolean;
  hasChats?: boolean;
}> = ({
  project,
  files = [],
  chats = [],
  onUpdate,
  onUpdateMemory: _onUpdateMemory,
  onTriggerAIUpdate: _onTriggerAIUpdate,
  isGenerating: _isGenerating = false,
  hasChats: _hasChats = false
}) => {
  const cal = project.calendar;
  const fecha = project.currentDate;
  const activo = calendarioValido(cal) && Boolean(fecha);

  const [editandoCal, setEditandoCal] = useState(false);
  const [borrador, setBorrador] = useState<CalendarConfig | null>(null);
  const [anoInicial, setAnoInicial] = useState('1');

  const [propuesta, setPropuesta] = useState<CalendarioDeducido | null>(null);
  const [deduciendo, setDeduciendo] = useState(false);
  const [errorDeduccion, setErrorDeduccion] = useState('');

  const [corrigiendo, setCorrigiendo] = useState(false);
  const [mesVisto, setMesVisto] = useState<{ year: number; month: number } | null>(null);

  // Día seleccionado en la vista (por defecto el día actual de la campaña)
  const hoyAbs = calendarioValido(cal) && fecha ? aDiaAbsoluto(cal, fecha) : 0;
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);

  // Modo de visualización: 'dia' (solo el día seleccionado) o 'todos' (historial completo de la campaña)
  const [modoVisualizacion, setModoVisualizacion] = useState<'dia' | 'todos'>('dia');

  // Estado para creación/edición de entradas de la agenda
  const [creandoEntrada, setCreandoEntrada] = useState(false);
  const [nuevaEntradaTitulo, setNuevaEntradaTitulo] = useState('');
  const [nuevaEntradaResumen, setNuevaEntradaResumen] = useState('');
  const [nuevaEntradaLugar, setNuevaEntradaLugar] = useState('');
  const [nuevaEntradaClima, setNuevaEntradaClima] = useState('');
  const [nuevaEntradaHito, setNuevaEntradaHito] = useState('');
  const [nuevaEntradaMood, setNuevaEntradaMood] = useState('🌸');
  const [nuevaEntradaTipo, setNuevaEntradaTipo] = useState<'acontecimiento' | 'hito' | 'descubrimiento' | 'secreto' | 'noticia' | 'descanso'>('acontecimiento');

  const [editandoEntradaId, setEditandoEntradaId] = useState<string | null>(null);
  const [editEntradaDraft, setEditEntradaDraft] = useState<{
    title: string;
    summary: string;
    lugar: string;
    clima: string;
    hito: string;
    mood: string;
    tipo: 'acontecimiento' | 'hito' | 'descubrimiento' | 'secreto' | 'noticia' | 'descanso';
  }>({ title: '', summary: '', lugar: '', clima: '', hito: '', mood: '🌸', tipo: 'acontecimiento' });

  const [studioModal, setStudioModal] = useState<{
    isOpen: boolean;
    tab?: 'image' | 'video' | 'music' | 'diary';
    sceneText: string;
  } | null>(null);

  // Diálogo de confirmación para borrados
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Sincronización y reconstrucción de la cronología desde el Chat
  const [showLimpiezaMenu, setShowLimpiezaMenu] = useState(false);

  const handleVaciarTodaLaCronologia = () => {
    setShowLimpiezaMenu(false);
    setConfirmDialog({
      isOpen: true,
      title: 'Vaciar toda la cronología',
      message: '¿Estás seguro de que deseas eliminar TODAS las entradas de diario y acontecimientos registrados en la campaña? El calendario seguirá configurado pero el diario se quedará a cero.',
      onConfirm: async () => {
        await onUpdate({ timeline: [] });
        setConfirmDialog(null);
      }
    });
  };

  const handleReiniciarADia1 = () => {
    setShowLimpiezaMenu(false);
    setConfirmDialog({
      isOpen: true,
      title: 'Reiniciar calendario al Día 1',
      message: '¿Deseas reiniciar la fecha actual de la campaña al primer día del año y vaciar todas las entradas de la cronología para sincronizar o empezar desde 0?',
      onConfirm: async () => {
        if (!cal) return;
        const initD = fechaInicial(fecha?.year || 1);
        await onUpdate({
          currentDate: initD,
          timeline: [],
          threads: []
        });
        setDiaSeleccionado(aDiaAbsoluto(cal, initD));
        setConfirmDialog(null);
      }
    });
  };
  // ------------------------------------------------------------ activación

  const activar = async (preset: CalendarConfig) => {
    const ano = parseInt(anoInicial, 10);
    const conf = JSON.parse(JSON.stringify(preset));
    const initDate = fechaInicial(Number.isFinite(ano) && ano > 0 ? ano : 1);
    await onUpdate({
      calendar: conf,
      currentDate: initDate,
      timeline: project.timeline || [],
      threads: project.threads || []
    });
    setDiaSeleccionado(aDiaAbsoluto(conf, initDate));
  };

  const desactivar = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Desactivar calendario',
      message: '¿Seguro que quieres dejar de llevar el tiempo en esta campaña? No se borrarán los textos guardados, pero el Narrador dejará de avanzar días y registrar fechas automáticas.',
      onConfirm: async () => {
        await onUpdate({ calendar: undefined });
        setConfirmDialog(null);
      }
    });
  };

  const deducir = async () => {
    setDeduciendo(true);
    setErrorDeduccion('');
    setPropuesta(null);
    try {
      const r = await deducirCalendario({ project, files, chats });
      setPropuesta(r);
      if (!r.encontrado) setErrorDeduccion('');
    } catch (err) {
      setErrorDeduccion(describeApiError(err));
    } finally {
      setDeduciendo(false);
    }
  };

  const aplicarPropuesta = async () => {
    if (!propuesta?.calendario) return;
    const nuevo = propuesta.calendario;
    let dayOfYear = 1;
    if (propuesta.fecha) {
      const idx = nuevo.months.findIndex(
        m => m.name.toLowerCase().trim() === propuesta.fecha!.mes.toLowerCase().trim()
      );
      if (idx >= 0) {
        const previos = diasDelMes(nuevo, idx)[0]?.dayOfYear ?? 1;
        const enElMes = Math.min(propuesta.fecha.dia, nuevo.months[idx].days);
        dayOfYear = previos + enElMes - 1;
      }
    }
    const cDate: CampaignDate = {
      year: propuesta.fecha?.year ?? 1,
      dayOfYear: Math.min(Math.max(1, dayOfYear), diasPorAno(nuevo)),
      minute: (propuesta.fecha?.hora ?? 8) * 60
    };
    await onUpdate({
      calendar: nuevo,
      currentDate: cDate,
      timeline: project.timeline || [],
      threads: project.threads || []
    });
    setDiaSeleccionado(aDiaAbsoluto(nuevo, cDate));
    setPropuesta(null);
  };

  // ------------------------------------------------------------ reloj

  const mover = async (delta: { dias?: number; horas?: number; minutos?: number }) => {
    if (!calendarioValido(cal) || !fecha) return;
    const nFecha = avanzar(cal, fecha, delta);
    await onUpdate({ currentDate: nFecha });
    setDiaSeleccionado(aDiaAbsoluto(cal, nFecha));
  };

  const ponerHora = async (hhmm: string) => {
    if (!calendarioValido(cal) || !fecha) return;
    const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
    if (!Number.isFinite(h)) return;
    await onUpdate({ currentDate: { ...fecha, minute: h * 60 + (Number.isFinite(m) ? m : 0) } });
  };

  const ponerFecha = async (campo: 'year' | 'dayOfYear', valor: string) => {
    if (!calendarioValido(cal) || !fecha) return;
    const n = parseInt(valor, 10);
    if (!Number.isFinite(n) || n < 1) return;
    const max = campo === 'dayOfYear' ? diasPorAno(cal) : Number.MAX_SAFE_INTEGER;
    const nFecha: CampaignDate = { ...fecha, [campo]: Math.min(n, max) };
    await onUpdate({ currentDate: nFecha });
    setDiaSeleccionado(aDiaAbsoluto(cal, nFecha));
  };

  // ------------------------------------------------------------ entradas de timeline (agenda)

  const timeline = project.timeline || [];

  const borrarEntrada = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Borrar entrada del diario',
      message: '¿Deseas eliminar este acontecimiento registrado? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        await onUpdate(p => ({
          timeline: (p.timeline || []).filter(t => t.id !== id)
        }));
        setConfirmDialog(null);
      }
    });
  };

  const vaciarDiaCompleto = (absDay: number, fechaStr: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Vaciar día completo',
      message: `¿Eliminar todos los acontecimientos y notas registrados para el ${fechaStr}?`,
      onConfirm: async () => {
        await onUpdate(p => ({
          timeline: (p.timeline || []).filter(t => t.absDay !== absDay)
        }));
        setConfirmDialog(null);
      }
    });
  };

  const consolidarEntradasDia = (absDay: number, fechaStr: string) => {
    const entradas = (project.timeline || []).filter(t => t.absDay === absDay).sort((a, b) => (a.minute || 0) - (b.minute || 0));
    if (entradas.length <= 1) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Consolidar entradas del día',
      message: `¿Deseas fusionar las ${entradas.length} entradas repetidas/intermedias de este día en una única entrada consolidada?`,
      onConfirm: async () => {
        const ultima = entradas[entradas.length - 1];
        const primerLugar = entradas.find(e => e.lugar)?.lugar;
        const primerClima = entradas.find(e => e.clima)?.clima;
        const hitos = entradas.map(e => e.hito).filter(Boolean);
        const ultimoHito = hitos.length > 0 ? hitos[hitos.length - 1] : undefined;

        // Unir los fragmentos evitando frases idénticas duplicadas
        const uniqueSummaries: string[] = [];
        entradas.forEach(e => {
          const s = (e.summary || '').trim();
          if (s && !uniqueSummaries.some(prev => prev.toLowerCase() === s.toLowerCase() || prev.includes(s) || s.includes(prev))) {
            uniqueSummaries.push(s);
          }
        });

        const entradaConsolidada: TimelineEntry = {
          id: `consolidated_${absDay}_${Date.now()}`,
          absDay,
          date: fechaStr,
          summary: uniqueSummaries.length > 0 ? uniqueSummaries.join('. ') : (ultima.summary || ''),
          lugar: ultima.lugar || primerLugar,
          clima: ultima.clima || primerClima,
          hito: ultimoHito,
          minute: ultima.minute,
          tipo: ultima.tipo,
          chatId: ultima.chatId,
          msgId: ultima.msgId,
          msgIndex: ultima.msgIndex
        };

        await onUpdate(p => ({
          timeline: [
            ...(p.timeline || []).filter(t => t.absDay !== absDay),
            entradaConsolidada
          ]
        }));
        setConfirmDialog(null);
      }
    });
  };

  const iniciarEdicionEntrada = (e: TimelineEntry) => {
    setEditandoEntradaId(e.id);
    setEditEntradaDraft({
      title: e.title || '',
      summary: e.summary || '',
      lugar: e.lugar || '',
      clima: e.clima || '',
      hito: e.hito || '',
      mood: e.mood || '🌸',
      tipo: (e.tipo as any) || 'acontecimiento'
    });
  };

  const guardarEdicionEntrada = async (id: string) => {
    if (!editEntradaDraft.summary.trim()) return;
    await onUpdate(p => ({
      timeline: (p.timeline || []).map(t =>
        t.id === id
          ? {
              ...t,
              title: editEntradaDraft.title.trim() || undefined,
              summary: editEntradaDraft.summary.trim(),
              lugar: editEntradaDraft.lugar.trim() || undefined,
              clima: editEntradaDraft.clima.trim() || undefined,
              hito: editEntradaDraft.hito.trim() || undefined,
              mood: editEntradaDraft.mood || undefined,
              tipo: editEntradaDraft.tipo || 'acontecimiento'
            }
          : t
      )
    }));
    setEditandoEntradaId(null);
  };

  const crearEntradaManual = async (targetAbsDay: number) => {
    if (!calendarioValido(cal) || !nuevaEntradaResumen.trim()) return;
    const dateObj = desdeDiaAbsoluto(cal, targetAbsDay);
    const dateStr = fechaLegible(cal, dateObj);

    const nueva: TimelineEntry = {
      id: `manual_${targetAbsDay}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      absDay: targetAbsDay,
      date: dateStr,
      title: nuevaEntradaTitulo.trim() || undefined,
      summary: nuevaEntradaResumen.trim(),
      lugar: nuevaEntradaLugar.trim() || undefined,
      clima: nuevaEntradaClima.trim() || undefined,
      hito: nuevaEntradaHito.trim() || undefined,
      mood: nuevaEntradaMood || '🌸',
      tipo: nuevaEntradaTipo || 'acontecimiento',
      minute: fecha ? fecha.minute : 8 * 60
    };

    await onUpdate(p => ({
      timeline: [...(p.timeline || []), nueva]
    }));

    setNuevaEntradaTitulo('');
    setNuevaEntradaResumen('');
    setNuevaEntradaLugar('');
    setNuevaEntradaClima('');
    setNuevaEntradaHito('');
    setNuevaEntradaMood('🌸');
    setNuevaEntradaTipo('acontecimiento');
    setCreandoEntrada(false);
  };

  // ------------------------------------------------------------ rejilla mensual

  const anoVisto = mesVisto?.year ?? (fecha?.year || 1);
  const mesVistoIdx = mesVisto
    ? mesVisto.month
    : calendarioValido(cal) && fecha
      ? mesDelDia(cal, fecha.dayOfYear)
      : 0;

  const celdas = calendarioValido(cal) && cal.months[mesVistoIdx] ? diasDelMes(cal, mesVistoIdx) : [];

  const absDeCelda = (dayOfYear: number) =>
    calendarioValido(cal) ? aDiaAbsoluto(cal, { year: anoVisto, dayOfYear, minute: 0 }) : 0;

  const irAlMes = (delta: number) => {
    if (!calendarioValido(cal)) return;
    let m = mesVistoIdx + delta;
    let y = anoVisto;
    if (m < 0) {
      m = cal.months.length - 1;
      y -= 1;
    } else if (m >= cal.months.length) {
      m = 0;
      y += 1;
    }
    setMesVisto({ year: Math.max(1, y), month: m });
  };

  // ------------------------------------------------------------ agenda por días unificada
  // Integra tanto project.timeline como project.memory.player_character.events
  const pcEvents = project.memory?.player_character?.events || [];

  const { porDia } = useMemo(() => {
    const map: Record<number, { date: string; entradas: TimelineEntry[] }> = {};
    const unified: TimelineEntry[] = [];

    // 1. Agregar entradas del timeline deduciendo absDay si estuviera ausente o fuese 0
    timeline.forEach(e => {
      let abs = e.absDay;
      if (!Number.isFinite(abs) || abs === 0) {
        const parsed = cal && calendarioValido(cal) ? aDiaAbsolutoDesdeTexto(cal, e.date, fecha?.year || 1492) : null;
        if (parsed !== null) abs = parsed;
        else abs = hoyAbs;
      }
      const entryConAbs: TimelineEntry = { ...e, absDay: abs };
      const dateStr = e.date || (cal && calendarioValido(cal) ? fechaLegible(cal, desdeDiaAbsoluto(cal, abs)) : `Día ${abs}`);
      if (!map[abs]) {
        map[abs] = { date: dateStr, entradas: [] };
      }
      map[abs].entradas.push(entryConAbs);
      unified.push(entryConAbs);
    });

    // 2. Integrar acontecimientos e hitos del protagonista si no están ya en el timeline
    pcEvents.forEach((pce, idx) => {
      const alreadyInTimeline = unified.some(
        t => t.id === pce.id ||
             (t.summary && pce.description && t.summary.trim().toLowerCase() === pce.description.trim().toLowerCase()) ||
             (t.title && pce.title && t.title.trim().toLowerCase() === pce.title.trim().toLowerCase())
      );

      if (!alreadyInTimeline) {
        let abs = cal && calendarioValido(cal) ? aDiaAbsolutoDesdeTexto(cal, pce.dateOrTime, fecha?.year || 1492) : null;
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
          map[abs] = { date: dateStr, entradas: [] };
        }
        map[abs].entradas.push(virtualEntry);
        unified.push(virtualEntry);
      }
    });

    return { porDia: map, unifiedTimeline: unified };
  }, [timeline, pcEvents, cal, fecha?.year, hoyAbs]);

  const diasAgenda = useMemo(
    () =>
      Object.keys(porDia)
        .map(Number)
        .sort((a, b) => b - a),
    [porDia]
  );

  // El día actualmente visualizado (si no se ha seleccionado ninguno, es hoy)
  const diaActivo = diaSeleccionado !== null ? diaSeleccionado : hoyAbs;

  // ------------------------------------------------------------ sin calendario

  if (!activo) {
    return (
      <div className="flex-1 overflow-y-auto p-5 md:p-8 font-lora text-[var(--text-primary)]">
        <div className="max-w-2xl mx-auto space-y-5">
          <div>
            <h2 className="font-cinzel text-2xl text-[var(--accent)] font-bold m-0 flex items-center gap-2">
              <CalendarClock className="w-6 h-6" /> El tiempo de la campaña
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Con el calendario en marcha, el Narrador lleva la cuenta de los días y las horas, y puede dejar
              cosas programadas: una vigilancia que se estrecha, una caravana que llega, una herida que se
              infecta. Cuando llega el día, ocurren solas, aunque tú te hayas olvidado.
            </p>
          </div>

          <div className="rounded-lg border-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-cinzel font-bold text-sm text-[var(--accent)]">
                  Sacarlo de tu propio material
                </div>
                <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                  Lee tus documentos y las primeras escenas para averiguar en qué año y con qué calendario
                  vive tu campaña. Te lo propone; aplicarlo lo decides tú.
                </p>
              </div>
              <button
                onClick={deducir}
                disabled={deduciendo}
                className="flex items-center gap-1.5 rounded bg-[var(--accent)] px-3 py-1.5 font-cinzel text-xs font-bold text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
              >
                {deduciendo ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Deducir desde la campaña
              </button>
            </div>

            {errorDeduccion && (
              <p className="text-xs text-red-500 m-0 pt-1">{errorDeduccion}</p>
            )}

            {propuesta && (
              <div className="pt-3 border-t border-[var(--glass-border)] space-y-2">
                <div className="text-xs font-cinzel font-bold text-[var(--accent)]">
                  {propuesta.encontrado
                    ? `Propuesta (${propuesta.confianza === 'alta' ? 'confianza alta' : propuesta.confianza === 'media' ? 'confianza media' : 'propuesta orientativa'})`
                    : 'No se encontró mención expresa a un calendario'}
                </div>
                <p className="text-xs text-[var(--text-secondary)] italic m-0">
                  {propuesta.evidencia}
                </p>
                {propuesta.calendario && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="text-xs">
                      <strong>{propuesta.calendario.name}</strong>
                      {propuesta.fecha && (
                        <span className="text-[var(--text-secondary)] ml-2">
                          · Comienzo:{' '}
                          {propuesta.fecha.dia > 0
                            ? `${propuesta.fecha.dia} de ${propuesta.fecha.mes}`
                            : propuesta.fecha.mes}{' '}
                          de {propuesta.fecha.year}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={aplicarPropuesta}
                        className="flex items-center gap-1 rounded bg-[var(--accent)] px-3 py-1 text-xs font-cinzel font-bold text-[var(--on-accent)] cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Usar este calendario
                      </button>
                      <button
                        onClick={() => setPropuesta(null)}
                        className="rounded border border-[var(--user-border)] px-2.5 py-1 text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              O elige una plantilla
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CALENDARIOS_PREDEFINIDOS.map((p, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface-soft)] p-3 flex flex-col justify-between gap-3 hover:border-[var(--accent)] transition-colors"
                >
                  <div>
                    <div className="font-cinzel font-bold text-sm text-[var(--accent)]">{p.name}</div>
                    <div className="text-[11px] text-[var(--text-secondary)] opacity-75 mt-2">
                      {p.months.length} meses · {diasPorAno(p)} días al año
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--glass-border)]">
                    <label className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                      Año inicial
                      <input
                        value={anoInicial}
                        onChange={e => setAnoInicial(e.target.value.replace(/\D/g, ''))}
                        className="w-14 bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-1.5 py-0.5 text-xs text-center outline-none focus:border-[var(--accent)]"
                      />
                    </label>
                    <button
                      onClick={() => activar(p)}
                      className="rounded bg-[var(--accent)] px-3 py-1 text-xs font-cinzel font-bold text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer"
                    >
                      Comenzar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ con calendario activo

  const calSeguro = cal!;
  const fechaSegura = fecha!;
  const franja = franjaDelDia(fechaSegura.minute);
  const diaSemana = diaDeLaSemana(calSeguro, hoyAbs);
  const estacion = estacionDelDia(calSeguro, fechaSegura.dayOfYear);

  // Información del día activo seleccionado
  const fechaObjActivo = desdeDiaAbsoluto(calSeguro, diaActivo);
  const diaSemanaActivo = diaDeLaSemana(calSeguro, diaActivo);
  const estacionActivo = estacionDelDia(calSeguro, fechaObjActivo.dayOfYear);
  const nombreDiaActivo = fechaLegible(calSeguro, fechaObjActivo);
  const entradasDiaActivo = porDia[diaActivo]?.entradas || [];
  const esHoyActivo = diaActivo === hoyAbs;

  const irADiaRelativo = (delta: number) => {
    const nuevoDia = diaActivo + delta;
    setDiaSeleccionado(nuevoDia);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 font-lora text-[var(--text-primary)]">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Cabecera general de la fecha actual de la campaña */}
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-cinzel text-[var(--text-secondary)]">
                <span>{calSeguro.name}</span>
                <span>·</span>
                <span title={estacion.nombre}>
                  {estacion.icono} {estacion.nombre}
                </span>
                {diaSemana && (
                  <>
                    <span>·</span>
                    <span>{diaSemana}</span>
                  </>
                )}
              </div>
              <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-[var(--accent)] m-0 flex items-center gap-2">
                {fechaLegible(calSeguro, fechaSegura)}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  {horaLegible(fechaSegura.minute)}
                </span>
                <span>·</span>
                <span>{franja}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 relative">
              <button
                onClick={() => _onTriggerAIUpdate?.()}
                disabled={_isGenerating}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] px-2.5 sm:px-3 py-1.5 text-xs font-cinzel font-bold hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                title="Analiza todos los capítulos y mensajes del chat para reconstruir la cronología completa de días y sucesos"
                aria-label="Sincronizar con el Chat"
              >
                {_isGenerating ? (
                  <>
                    <Loader className="w-3.5 h-3.5 animate-spin" /> <span className="hidden sm:inline">Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sincronizar con el Chat</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setBorrador(JSON.parse(JSON.stringify(calSeguro)));
                  setEditandoCal(true);
                }}
                className="flex items-center gap-1 rounded-lg border border-[var(--user-border)] px-2 sm:px-2.5 py-1.5 text-xs font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer bg-[var(--surface)] transition-colors shrink-0"
                title="Editar nombres de meses, festividades y días"
                aria-label="Editar calendario"
              >
                <Settings2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Editar</span>
              </button>

              <div className="relative shrink-0">
                <button
                  onClick={() => setShowLimpiezaMenu(!showLimpiezaMenu)}
                  className="flex items-center gap-1 rounded-lg border border-[var(--user-border)] px-2 sm:px-2.5 py-1.5 text-xs font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer bg-[var(--surface)] transition-colors"
                  title="Opciones de limpieza y reinicio"
                  aria-label="Opciones de limpieza"
                >
                  <Trash2 className="w-3.5 h-3.5 text-stone-500" /> <span className="hidden sm:inline">Opciones</span>
                </button>

                {showLimpiezaMenu && (
                  <>
                    {/* Backdrop para cerrar en móvil al tocar fuera */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowLimpiezaMenu(false)}
                    />
                    <div className="absolute right-0 sm:left-0 top-full mt-2 w-64 max-w-[calc(100vw-2.5rem)] bg-[var(--surface)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-1.5 z-50 space-y-1 text-xs font-cinzel">
                      <button
                        onClick={() => {
                          setShowLimpiezaMenu(false);
                          handleVaciarTodaLaCronologia();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Vaciar toda la cronología (0 entradas)</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowLimpiezaMenu(false);
                          handleReiniciarADia1();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>Reiniciar al Día 1 (desde cero)</span>
                      </button>
                      <div className="h-px bg-[var(--glass-border)] my-1" />
                      <button
                        onClick={() => {
                          setShowLimpiezaMenu(false);
                          desactivar();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5 shrink-0" />
                        <span>Desactivar calendario</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {!corrigiendo && (
            <button
              onClick={() => setCorrigiendo(true)}
              className="mt-3 text-[11px] font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] underline cursor-pointer inline-flex items-center gap-1"
            >
              <CalendarClock className="w-3 h-3" /> ¿Se ha despistado el reloj? Ajustar fecha/hora
            </button>
          )}

          {corrigiendo && (
            <div className="mt-4 pt-4 border-t border-[var(--glass-border)] bg-[var(--sidebar-bg)]/40 p-3 rounded-lg">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-cinzel font-bold text-[var(--text-secondary)] flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5" /> Corregir hora o fecha de la campaña
                </span>
                <button
                  onClick={() => setCorrigiendo(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '+1 h', d: { horas: 1 } },
                  { label: '+8 h', d: { horas: 8 } },
                  { label: '+1 día', d: { dias: 1 } },
                  { label: '+1 semana', d: { dias: 7 } },
                  { label: '−1 h', d: { horas: -1 } },
                  { label: '−1 día', d: { dias: -1 } }
                ].map(b => (
                  <button
                    key={b.label}
                    onClick={() => mover(b.d)}
                    className="rounded border border-[var(--user-border)] px-2.5 py-1 text-xs font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 mt-3 text-xs">
                <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  Hora
                  <input
                    type="time"
                    value={horaLegible(fechaSegura.minute)}
                    onChange={e => ponerHora(e.target.value)}
                    className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  Día del año
                  <input
                    value={fechaSegura.dayOfYear}
                    onChange={e => ponerFecha('dayOfYear', e.target.value)}
                    className="w-16 bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                  <span className="text-[10px]">/ {diasPorAno(calSeguro)}</span>
                </label>
                <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  Año
                  <input
                    value={fechaSegura.year}
                    onChange={e => ponerFecha('year', e.target.value)}
                    className="w-20 bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Rejilla interactiva del mes */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-cinzel text-base md:text-lg font-bold text-[var(--accent)] m-0 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {calSeguro.months[mesVistoIdx]?.name || '—'} de {anoVisto}
              {calSeguro.yearSuffix ? ` ${calSeguro.yearSuffix}` : ''}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => irAlMes(-1)}
                className="rounded border border-[var(--user-border)] p-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setMesVisto(null);
                  setDiaSeleccionado(hoyAbs);
                }}
                className="rounded border border-[var(--user-border)] px-2.5 py-1 text-[11px] font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
                title="Volver a la fecha actual"
              >
                Hoy
              </button>
              <button
                onClick={() => irAlMes(1)}
                className="rounded border border-[var(--user-border)] p-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cabecera de días de la semana */}
          {(calSeguro.weekdays?.length || 0) > 0 && (
            <div
              className="grid gap-1 text-[10px] font-cinzel text-[var(--text-secondary)] text-center mb-1 font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: `repeat(${calSeguro.weekdays!.length}, minmax(0, 1fr))` }}
            >
              {calSeguro.weekdays!.map(d => (
                <div key={d} className="truncate" title={d}>
                  {d.slice(0, 3)}
                </div>
              ))}
            </div>
          )}

          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${calSeguro.weekdays?.length || 10}, minmax(0, 1fr))`
            }}
          >
            {/* Hueco inicial para alinear con el día de la semana */}
            {(calSeguro.weekdays?.length || 0) > 0 &&
              celdas.length > 0 &&
              Array.from({
                length:
                  ((absDeCelda(celdas[0].dayOfYear) % calSeguro.weekdays!.length) +
                    calSeguro.weekdays!.length) %
                  calSeguro.weekdays!.length
              }).map((_, i) => <div key={`hueco-${i}`} />)}

            {celdas
              .filter(c => !c.esFestival)
              .map(c => {
                const abs = absDeCelda(c.dayOfYear);
                const esHoy = abs === hoyAbs;
                const esSeleccionado = diaActivo === abs;
                const conAgenda = (porDia[abs]?.entradas.length || 0) > 0;
                const numEntradas = porDia[abs]?.entradas.length || 0;

                return (
                  <button
                    key={c.dayOfYear}
                    onClick={() => {
                      setDiaSeleccionado(abs);
                      setModoVisualizacion('dia');
                    }}
                    className={`relative min-h-[44px] py-1.5 px-1 rounded-lg border text-xs font-cinzel flex flex-col items-center justify-between transition-all cursor-pointer ${
                      esSeleccionado
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-bold text-[var(--accent)]'
                        : esHoy
                          ? 'border-[var(--accent)]/60 bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] text-[var(--accent)] font-semibold'
                          : 'border-[var(--glass-border)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-soft)] text-[var(--text-primary)]'
                    }`}
                    title={`${c.etiqueta} de ${calSeguro.months[mesVistoIdx]?.name}${esHoy ? ' (Hoy)' : ''}${numEntradas ? ` · ${numEntradas} entrada(s)` : ''}`}
                  >
                    <span className="flex items-center justify-center w-full">
                      {c.etiqueta}
                      {esHoy && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] ml-1" title="Día actual" />
                      )}
                    </span>
                    <span className="flex items-center gap-1 h-2">
                      {conAgenda && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                          title={`${numEntradas} acontecimiento(s) anotado(s)`}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Festivales intercalares */}
          {celdas.some(c => c.esFestival) && (
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-dashed border-[var(--glass-border)]">
              {celdas
                .filter(c => c.esFestival)
                .map(c => {
                  const abs = absDeCelda(c.dayOfYear);
                  const esHoy = abs === hoyAbs;
                  const esSeleccionado = diaActivo === abs;
                  const numEntradas = porDia[abs]?.entradas.length || 0;
                  return (
                    <button
                      key={c.dayOfYear}
                      onClick={() => {
                        setDiaSeleccionado(abs);
                        setModoVisualizacion('dia');
                      }}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-cinzel cursor-pointer transition-colors ${
                        esSeleccionado
                          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-bold text-[var(--accent)]'
                          : esHoy
                            ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-bold'
                            : 'border-[var(--glass-border)] hover:border-[var(--accent)]'
                      }`}
                    >
                      <PartyPopper className="w-3.5 h-3.5 text-amber-500" />
                      {c.etiqueta}
                      {numEntradas > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                      )}
                    </button>
                  );
                })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)] mt-3 pt-2 border-t border-[var(--glass-border)]">
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]" /> Hay acontecimientos escritos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Vence un hilo programado
              </span>
            </div>
            <div className="text-[11px] italic font-cinzel">
              Pulsa cualquier celda para ver y editar su espacio
            </div>
          </div>
        </div>

        {/* =========================================================================
            ESPACIO DEL DÍA / DIARIO INTEGRADO
            ========================================================================= */}
        <div className="pt-6 border-t border-[var(--glass-border)] space-y-4">
          
          {/* Barra superior de cambio de vista (Día seleccionado vs Historial completo) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModoVisualizacion('dia')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition-colors cursor-pointer ${
                  modoVisualizacion === 'dia'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                    : 'border border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Espacio del día
              </button>
              <button
                onClick={() => setModoVisualizacion('todos')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition-colors cursor-pointer ${
                  modoVisualizacion === 'todos'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                    : 'border border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Crónica completa ({diasAgenda.length} {diasAgenda.length === 1 ? 'día' : 'días'})
              </button>
            </div>

            {modoVisualizacion === 'dia' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => irADiaRelativo(-1)}
                  className="flex items-center gap-1 rounded border border-[var(--user-border)] px-2 py-1 text-[11px] font-cinzel hover:border-[var(--accent)] cursor-pointer"
                  title="Día anterior"
                >
                  <ChevronLeft className="w-3 h-3" /> Anterior
                </button>
                <button
                  onClick={() => setDiaSeleccionado(hoyAbs)}
                  className={`px-2 py-1 text-[11px] font-cinzel rounded border ${esHoyActivo ? 'border-[var(--accent)] text-[var(--accent)] font-bold' : 'border-[var(--user-border)] hover:border-[var(--accent)]'} cursor-pointer`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => irADiaRelativo(1)}
                  className="flex items-center gap-1 rounded border border-[var(--user-border)] px-2 py-1 text-[11px] font-cinzel hover:border-[var(--accent)] cursor-pointer"
                  title="Día siguiente"
                >
                  Siguiente <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* VISTA 1: ESPACIO DEL DÍA SELECCIONADO (DIARIO Y RESUMEN DE ESE DÍA) */}
          {modoVisualizacion === 'dia' && (
            <div className="bg-[var(--bg-color)]/70 border-2 border-[var(--glass-border)] rounded-xl p-4 sm:p-6 space-y-6 shadow-xs backdrop-blur-xs">
              {/* Cabecera del día seleccionado con ambientación y herramientas decorativas */}
              <div className="space-y-3 pb-4 border-b border-[var(--glass-border)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-cinzel font-bold text-[var(--accent)] tracking-wide flex items-center gap-1.5">
                        <span title={estacionActivo.nombre}>{estacionActivo.icono}</span> {nombreDiaActivo}
                      </span>
                      {diaSemanaActivo && (
                        <span className="text-xs font-cinzel text-[var(--text-secondary)] font-medium px-2 py-0.5 rounded bg-[var(--surface-soft)]">
                          {diaSemanaActivo}
                        </span>
                      )}
                      {esHoyActivo ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs">
                          HOY EN CAMPAÑA
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)] font-cinzel italic">
                          · {distanciaEnDias(diaActivo - hoyAbs)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setCreandoEntrada(prev => !prev)}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-cinzel font-bold text-[var(--on-accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Añadir acontecimiento
                    </button>
                    {entradasDiaActivo.length > 0 && (
                      <button
                        onClick={() => vaciarDiaCompleto(diaActivo, nombreDiaActivo)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--user-border)] px-2.5 py-1.5 text-xs font-cinzel text-red-500 hover:border-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                        title="Borrar todas las entradas de este día"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Vaciar día
                      </button>
                    )}
                  </div>
                </div>

                {/* Cinta decorativa y ambientación rápida del día */}
                <div className="p-2.5 rounded-lg bg-[var(--surface-soft)] border border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-cinzel font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                      ✨ Ambientación rápida:
                    </span>
                    {/* Clima rápido */}
                    {[
                      { icon: '☀️', name: 'Soleado' },
                      { icon: '🌧️', name: 'Lluvia' },
                      { icon: '❄️', name: 'Nieve' },
                      { icon: '🌫️', name: 'Niebla' },
                      { icon: '⛈️', name: 'Tormenta' },
                      { icon: '🌌', name: 'Noche estrellada' }
                    ].map(cl => (
                      <button
                        key={cl.name}
                        onClick={() => {
                          setNuevaEntradaClima(cl.name);
                          if (!creandoEntrada) setCreandoEntrada(true);
                        }}
                        className="px-2 py-0.5 rounded text-[11px] bg-[var(--surface)] hover:border-[var(--accent)] border border-[var(--glass-border)] transition-colors cursor-pointer flex items-center gap-1"
                        title={`Añadir apunte con clima ${cl.name}`}
                      >
                        <span>{cl.icon}</span> <span>{cl.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Botón directo de Taller Creativo para ilustrar el día */}
                  <button
                    onClick={() => {
                      const fullScene =
                        entradasDiaActivo.length > 0
                          ? entradasDiaActivo
                              .map(
                                e =>
                                  `${e.lugar ? `[${e.lugar}] ` : ''}${e.summary}${e.hito ? ` (${e.hito})` : ''}`
                              )
                              .join('. ')
                          : `Jornada del ${nombreDiaActivo} en Faerûn`;
                      setStudioModal({
                        isOpen: true,
                        tab: 'image',
                        sceneText: `Ilustración o portada del ${nombreDiaActivo}: ${fullScene}`
                      });
                    }}
                    className="text-[11px] font-cinzel font-bold text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 border border-amber-500/50 hover:bg-amber-200 dark:hover:bg-amber-900/70 px-2.5 py-1 rounded-md cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" /> Ilustrar esta jornada
                  </button>
                </div>
              </div>

              {/* Formulario para añadir nueva entrada manual a este día */}
              {creandoEntrada && (
                <div className="p-4 rounded-xl border border-[var(--accent)]/50 bg-[var(--surface-soft)] space-y-3 shadow-sm animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-2">
                    <span className="font-cinzel text-xs font-bold text-[var(--accent)] flex items-center gap-1.5">
                      <NotebookPen className="w-4 h-4" /> Nueva crónica o acontecimiento para {nombreDiaActivo}
                    </span>
                    <button
                      onClick={() => setCreandoEntrada(false)}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <input
                      value={nuevaEntradaTitulo}
                      onChange={e => setNuevaEntradaTitulo(e.target.value)}
                      placeholder="Título o nombre del acontecimiento (ej. El pacto de la taberna)"
                      className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md px-3 py-1.5 outline-none focus:border-[var(--accent)] font-cinzel font-semibold"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={nuevaEntradaTipo}
                        onChange={e => setNuevaEntradaTipo(e.target.value as any)}
                        className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--accent)] font-cinzel text-xs flex-1 cursor-pointer"
                      >
                        <option value="acontecimiento">📜 Acontecimiento / Crónica</option>
                        <option value="hito">⚔️ Hito Épico / Combate</option>
                        <option value="descubrimiento">💎 Descubrimiento / Hallazgo</option>
                        <option value="secreto">🕯️ Secreto / Introspección</option>
                        <option value="noticia">📰 Noticia / Rumor del Mundo</option>
                        <option value="descanso">🌸 Descanso / Intimidad</option>
                      </select>
                      <select
                        value={nuevaEntradaMood}
                        onChange={e => setNuevaEntradaMood(e.target.value)}
                        className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--accent)] text-sm cursor-pointer"
                        title="Tono / Ánimo"
                      >
                        <option value="🌸">🌸 Festivo</option>
                        <option value="⚔️">⚔️ Marcial</option>
                        <option value="🍷">🍷 Taberna</option>
                        <option value="👑">👑 Corte</option>
                        <option value="🎭">🎭 Sigilo</option>
                        <option value="🕯️">🕯️ Misterio</option>
                        <option value="💔">💔 Drama</option>
                        <option value="🌲">🌲 Viaje</option>
                        <option value="🐉">🐉 Peligro</option>
                        <option value="🌙">🌙 Secreto</option>
                        <option value="✨">✨ Magia</option>
                        <option value="😊">😊 Paz</option>
                      </select>
                    </div>
                  </div>

                  <textarea
                    value={nuevaEntradaResumen}
                    onChange={e => setNuevaEntradaResumen(e.target.value)}
                    rows={3}
                    placeholder="Describe los hechos, diálogos, descubrimientos o reflexiones que ocurrieron en este día..."
                    className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md p-2.5 text-sm font-lora outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <input
                      value={nuevaEntradaLugar}
                      onChange={e => setNuevaEntradaLugar(e.target.value)}
                      placeholder="📍 Lugar (ej. Portal Bostezante, Luskan...)"
                      className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      value={nuevaEntradaClima}
                      onChange={e => setNuevaEntradaClima(e.target.value)}
                      placeholder="⛅ Clima (ej. Lluvia fría, Niebla marina...)"
                      className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      value={nuevaEntradaHito}
                      onChange={e => setNuevaEntradaHito(e.target.value)}
                      placeholder="⚔️ Hito clave (ej. Encuentro con Jarlaxle)"
                      className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setCreandoEntrada(false)}
                      className="px-3 py-1.5 text-xs font-cinzel border border-[var(--user-border)] rounded-md hover:bg-[var(--surface)] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => crearEntradaManual(diaActivo)}
                      disabled={!nuevaEntradaResumen.trim()}
                      className="px-4 py-1.5 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" /> Guardar en este día
                    </button>
                  </div>
                </div>
              )}

              {/* Acontecimientos de este día */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Acontecimientos e hitos del día ({entradasDiaActivo.length})</span>
                  </div>
                  {entradasDiaActivo.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {entradasDiaActivo.length > 1 && (
                        <button
                          onClick={() => consolidarEntradasDia(diaActivo, nombreDiaActivo)}
                          className="text-[11px] font-cinzel font-semibold text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1"
                          title="Fusionar las entradas de este día en una sola"
                        >
                          <Sparkles className="w-3 h-3" /> Consolidar en 1 entrada
                        </button>
                      )}
                      <button
                        onClick={() => vaciarDiaCompleto(diaActivo, nombreDiaActivo)}
                        className="text-[11px] font-cinzel text-red-400 hover:text-red-500 hover:underline cursor-pointer flex items-center gap-1"
                        title="Eliminar todas las entradas de este día"
                      >
                        <Trash2 className="w-3 h-3" /> Vaciar día
                      </button>
                    </div>
                  )}
                </div>

                {entradasDiaActivo.length === 0 ? (
                  <div className="py-8 px-4 rounded-xl bg-[var(--surface-soft)]/40 border border-dashed border-[var(--glass-border)] text-center text-sm text-[var(--text-secondary)] space-y-2">
                    <CalendarClock className="w-8 h-8 mx-auto text-[var(--accent)] opacity-40" />
                    <p className="italic m-0 font-cinzel font-bold text-[var(--text-primary)]">
                      No hay acontecimientos registrados para el {nombreDiaActivo}.
                    </p>
                    <p className="text-xs opacity-75 m-0 max-w-md mx-auto leading-relaxed">
                      El Narrador anotará lo que ocurra durante las sesiones de juego, o puedes pulsar «Añadir acontecimiento» para escribir una crónica, hito o apunte a mano.
                    </p>
                    <button
                      onClick={() => setCreandoEntrada(true)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent)]/50 text-xs font-cinzel font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Escribir primera crónica
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entradasDiaActivo.map((entrada, idx) => {
                      const isEditing = editandoEntradaId === entrada.id;

                      if (isEditing) {
                        return (
                          <div
                            key={entrada.id}
                            className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--surface-soft)] space-y-3 shadow-xs"
                          >
                            <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-1.5">
                              <span className="font-cinzel text-xs font-bold text-[var(--accent)]">
                                Editar entrada #{idx + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                <select
                                  value={editEntradaDraft.tipo}
                                  onChange={e =>
                                    setEditEntradaDraft(prev => ({
                                      ...prev,
                                      tipo: e.target.value as any
                                    }))
                                  }
                                  className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2 py-1 outline-none text-xs font-cinzel"
                                >
                                  <option value="acontecimiento">📜 Acontecimiento</option>
                                  <option value="hito">⚔️ Hito</option>
                                  <option value="descubrimiento">💎 Descubrimiento</option>
                                  <option value="secreto">🕯️ Secreto</option>
                                  <option value="noticia">📰 Noticia</option>
                                  <option value="descanso">🌸 Descanso</option>
                                </select>
                                <select
                                  value={editEntradaDraft.mood}
                                  onChange={e =>
                                    setEditEntradaDraft(prev => ({
                                      ...prev,
                                      mood: e.target.value
                                    }))
                                  }
                                  className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2 py-1 outline-none text-xs"
                                >
                                  <option value="🌸">🌸</option>
                                  <option value="⚔️">⚔️</option>
                                  <option value="🍷">🍷</option>
                                  <option value="👑">👑</option>
                                  <option value="🎭">🎭</option>
                                  <option value="🕯️">🕯️</option>
                                  <option value="💔">💔</option>
                                  <option value="🌲">🌲</option>
                                  <option value="🐉">🐉</option>
                                  <option value="🌙">🌙</option>
                                  <option value="✨">✨</option>
                                  <option value="😊">😊</option>
                                </select>
                              </div>
                            </div>

                            <input
                              value={editEntradaDraft.title}
                              onChange={e =>
                                setEditEntradaDraft(prev => ({ ...prev, title: e.target.value }))
                              }
                              placeholder="Título (opcional)"
                              className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md px-2.5 py-1.5 text-xs font-cinzel font-semibold outline-none focus:border-[var(--accent)]"
                            />

                            <textarea
                              value={editEntradaDraft.summary}
                              onChange={e =>
                                setEditEntradaDraft(prev => ({ ...prev, summary: e.target.value }))
                              }
                              rows={3}
                              className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md p-2 text-sm font-lora outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <input
                                value={editEntradaDraft.lugar}
                                onChange={e =>
                                  setEditEntradaDraft(prev => ({ ...prev, lugar: e.target.value }))
                                }
                                placeholder="📍 Lugar"
                                className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2 py-1 outline-none"
                              />
                              <input
                                value={editEntradaDraft.clima}
                                onChange={e =>
                                  setEditEntradaDraft(prev => ({ ...prev, clima: e.target.value }))
                                }
                                placeholder="⛅ Clima"
                                className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2 py-1 outline-none"
                              />
                              <input
                                value={editEntradaDraft.hito}
                                onChange={e =>
                                  setEditEntradaDraft(prev => ({ ...prev, hito: e.target.value }))
                                }
                                placeholder="⚔️ Hito"
                                className="bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2 py-1 outline-none"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => setEditandoEntradaId(null)}
                                className="px-3 py-1 text-xs font-cinzel border border-[var(--user-border)] rounded cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => guardarEdicionEntrada(entrada.id)}
                                className="px-3.5 py-1 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded hover:bg-[var(--accent-hover)] cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <Save className="w-3.5 h-3.5" /> Guardar
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const isInconsciencia =
                        entrada.tipo === 'inconsciencia' ||
                        (entrada.timeSkipDays && entrada.timeSkipDays > 0) ||
                        (entrada.hito && /inconscien|coma|desmay|recuperaci[oó]n/i.test(entrada.hito));
                      const isNoticia =
                        entrada.tipo === 'noticia' ||
                        entrada.tipo === 'rumor' ||
                        (entrada.hito && /noticia|rumor|pregonero|tabl[oó]n|gaceta|bando/i.test(entrada.hito));

                      return (
                        <div
                          key={entrada.id}
                          className={`group relative p-4 rounded-xl border transition-all space-y-2 shadow-xs ${
                            isInconsciencia
                              ? 'border-indigo-500/40 bg-indigo-950/15 ring-1 ring-indigo-500/20'
                              : isNoticia
                                ? 'border-amber-500/40 bg-amber-950/15 ring-1 ring-amber-500/20'
                                : entrada.tipo === 'hito'
                                  ? 'border-amber-500/50 bg-[var(--surface)] hover:border-amber-500'
                                  : 'border-[var(--glass-border)] bg-[var(--surface)] hover:border-[var(--accent)]/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                              {entrada.mood && (
                                <span className="text-sm leading-none">{entrada.mood}</span>
                              )}
                              {isInconsciencia && (
                                <span className="inline-flex items-center gap-1 font-cinzel font-bold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/30">
                                  <Moon className="w-3 h-3 text-indigo-400" />
                                  Salto Temporal / Inconsciencia {entrada.timeSkipDays ? `(+${entrada.timeSkipDays} d)` : ''}
                                </span>
                              )}
                              {isNoticia && (
                                <span className="inline-flex items-center gap-1 font-cinzel font-bold text-amber-500 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/30">
                                  <Newspaper className="w-3 h-3 text-amber-400" />
                                  Noticia del Mundo / Pregoneros
                                </span>
                              )}
                              {entrada.minute !== undefined && (
                                <span className="font-cinzel font-semibold text-[var(--accent)]">
                                  {horaLegible(entrada.minute)} · {franjaDelDia(entrada.minute)}
                                </span>
                              )}
                              {entrada.lugar && (
                                <span className="px-1.5 py-0.5 rounded bg-[var(--surface-soft)] font-cinzel">
                                  📍 {entrada.lugar}
                                </span>
                              )}
                              {entrada.clima && (
                                <span className="px-1.5 py-0.5 rounded bg-[var(--surface-soft)]">
                                  {iconoDeClima(entrada.clima)} {entrada.clima}
                                </span>
                              )}
                            </div>

                            {/* Botones de acción por entrada (Crear contenido, Editar y Borrar) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  const sceneText = `${entrada.title ? `[Título: ${entrada.title}] ` : ''}${entrada.lugar ? `[Lugar: ${entrada.lugar}] ` : ''}${entrada.summary}${entrada.hito ? ` [Hito: ${entrada.hito}]` : ''}`;
                                  setStudioModal({
                                    isOpen: true,
                                    tab: 'image',
                                    sceneText
                                  });
                                }}
                                className="px-2 py-1 rounded-md text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 cursor-pointer flex items-center gap-1 text-[10px] font-cinzel font-bold shadow-2xs transition-colors"
                                title="Taller Creativo: Crear ilustración, música o cinemática para este acontecimiento"
                              >
                                <Wand2 className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                                <span className="hidden sm:inline">Ilustrar / Audio</span>
                              </button>
                              <button
                                onClick={() => iniciarEdicionEntrada(entrada)}
                                className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-soft)] cursor-pointer transition-colors"
                                title="Editar esta entrada"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => borrarEntrada(entrada.id)}
                                className="p-1.5 rounded-md text-red-500/70 hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                                title="Borrar esta entrada"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {entrada.title && (
                            <h4 className="font-cinzel font-bold text-sm text-[var(--text-primary)] m-0">
                              {entrada.title}
                            </h4>
                          )}

                          <p className="text-sm leading-relaxed text-[var(--text-primary)] m-0 font-lora">
                            {entrada.summary}
                          </p>

                          {entrada.hito && (
                            <div className="pt-1 flex flex-wrap items-center gap-1.5">
                              {(() => {
                                const icono = iconoDeHito(entrada.hito);
                                const esRelacion = /rivalidad|rival|amistad|amigo|romance|amor|cortej|declaraci|insinuaci|enemistad|enemigo|alianza|mentor/i.test(entrada.hito);
                                const esReloj = /reloj|semilla|hilo|plazo/i.test(entrada.hito);
                                const esConsecuencia = /consecuencia|repercusi|secuela|gremio|familia|zona/i.test(entrada.hito);

                                let styleClass = 'border-[var(--accent)]/40 bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]';
                                if (esRelacion) {
                                  styleClass = obtenerInfoRelacion(entrada.hito).badgeClass;
                                } else if (esReloj) {
                                  styleClass = 'border-amber-500/40 bg-amber-950/30 text-amber-300';
                                } else if (esConsecuencia) {
                                  styleClass = 'border-purple-500/40 bg-purple-950/30 text-purple-300';
                                }

                                return (
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-cinzel font-semibold px-2.5 py-0.5 rounded-md border shadow-2xs ${styleClass}`}>
                                    <span className="text-sm">{icono}</span>
                                    <span>{entrada.hito}</span>
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA 2: CRÓNICA COMPLETA DE TODOS LOS DÍAS */}
          {modoVisualizacion === 'todos' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[var(--surface-soft)] border border-[var(--glass-border)]">
                <div className="text-xs text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)] font-cinzel">{diasAgenda.length}</strong> {diasAgenda.length === 1 ? 'día con registros' : 'días con registros'} · <strong className="text-[var(--text-primary)] font-cinzel">{timeline.length}</strong> {timeline.length === 1 ? 'acontecimiento' : 'acontecimientos'} en total
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => _onTriggerAIUpdate?.()}
                    disabled={_isGenerating}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold hover:bg-[var(--accent-hover)] cursor-pointer disabled:opacity-50"
                    title="Sincronizar cronología"
                    aria-label="Sincronizar"
                  >
                    {_isGenerating ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Sincronizar</span>
                  </button>
                  {timeline.length > 0 && (
                    <button
                      onClick={handleVaciarTodaLaCronologia}
                      className="flex items-center gap-1 px-2.5 py-1 rounded border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-cinzel cursor-pointer"
                      title="Eliminar todas las entradas y dejar la cronología limpia"
                      aria-label="Vaciar diario"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Vaciar diario</span>
                    </button>
                  )}
                </div>
              </div>

              {diasAgenda.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-[var(--glass-border)] text-center space-y-3">
                  <p className="text-sm text-[var(--text-secondary)] italic m-0">
                    Aún no hay días registrados en la cronología.
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] m-0">
                    Puedes pulsar <strong>«Sincronizar cronología con el Chat ahora»</strong> para que el Narrador analice tus capítulos jugados y ordene todos los sucesos temporalmente.
                  </p>
                  <button
                    onClick={() => _onTriggerAIUpdate?.()}
                    disabled={_isGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold hover:bg-[var(--accent-hover)] cursor-pointer disabled:opacity-50"
                  >
                    {_isGenerating ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Sincronizar cronología con el Chat ahora</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {diasAgenda.map((dia, diaIdx) => {
                    const entradas = porDia[dia].entradas;
                    const fObj = desdeDiaAbsoluto(calSeguro, dia);
                    const est = estacionDelDia(calSeguro, fObj.dayOfYear);
                    const esHoy = dia === hoyAbs;

                    // Brecha de días transcurridos respecto al día anterior listado (diasAgenda viene ordenado descendente)
                    const prevDia = diaIdx > 0 ? diasAgenda[diaIdx - 1] : null;
                    const gap = prevDia !== null ? prevDia - dia : 0;

                    return (
                      <React.Fragment key={dia}>
                        {gap > 1 && (
                          <div className="flex items-center justify-center my-2">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-dashed border-[var(--glass-border)] text-xs font-cinzel text-[var(--text-secondary)]">
                              <Moon className="w-3.5 h-3.5 text-amber-500" />
                              <span>⏳ Salto de {gap - 1} {gap - 1 === 1 ? 'día' : 'días'} sin incidentes registrados</span>
                            </div>
                          </div>
                        )}

                        <div
                          className="bg-[var(--bg-color)]/60 border border-[var(--glass-border)] rounded-xl p-4 sm:p-5 space-y-3"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2 border-b border-[var(--glass-border)]">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setDiaSeleccionado(dia);
                                  setModoVisualizacion('dia');
                                }}
                                className="font-cinzel text-sm font-bold text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1.5"
                                title="Ver espacio exclusivo de este día"
                              >
                                <span>{est.icono}</span> {porDia[dia].date}
                              </button>
                              {esHoy && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)]">
                                  HOY
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setDiaSeleccionado(dia);
                                  setModoVisualizacion('dia');
                                }}
                                className="text-[11px] font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
                              >
                                Ver celda →
                              </button>
                              <button
                                onClick={() => vaciarDiaCompleto(dia, porDia[dia].date)}
                                className="text-[11px] font-cinzel text-red-500 hover:underline cursor-pointer flex items-center gap-0.5"
                                title="Vaciar este día"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {entradas.map(entrada => {
                              const isEditing = editandoEntradaId === entrada.id;

                              if (isEditing) {
                                return (
                                  <div
                                    key={entrada.id}
                                    className="p-3 rounded-lg border border-[var(--accent)] bg-[var(--surface-soft)] space-y-2"
                                  >
                                    <textarea
                                      value={editEntradaDraft.summary}
                                      onChange={e =>
                                        setEditEntradaDraft(prev => ({ ...prev, summary: e.target.value }))
                                      }
                                      rows={2}
                                      className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md p-2 text-sm font-lora outline-none focus:border-[var(--accent)] leading-relaxed"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => setEditandoEntradaId(null)}
                                        className="px-2 py-0.5 text-xs font-cinzel border border-[var(--user-border)] rounded cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        onClick={() => guardarEdicionEntrada(entrada.id)}
                                        className="px-3 py-0.5 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded cursor-pointer"
                                      >
                                        Guardar
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              const isInconsciencia =
                                entrada.tipo === 'inconsciencia' ||
                                (entrada.timeSkipDays && entrada.timeSkipDays > 0) ||
                                (entrada.hito && /inconscien|coma|desmay|recuperaci[oó]n/i.test(entrada.hito));
                              const isNoticia =
                                entrada.tipo === 'noticia' ||
                                entrada.tipo === 'rumor' ||
                                (entrada.hito && /noticia|rumor|pregonero|tabl[oó]n|gaceta|bando/i.test(entrada.hito));

                              return (
                                <div
                                  key={entrada.id}
                                  className={`flex items-start justify-between gap-3 text-sm p-2.5 rounded transition-colors ${
                                    isInconsciencia
                                      ? 'bg-indigo-950/20 border border-indigo-500/30'
                                      : isNoticia
                                        ? 'bg-amber-950/20 border border-amber-500/30'
                                        : 'hover:bg-[var(--surface-soft)]/50'
                                  }`}
                                >
                                  <div className="space-y-1 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                                      {entrada.mood && (
                                        <span className="text-sm leading-none">{entrada.mood}</span>
                                      )}
                                      {isInconsciencia && (
                                        <span className="inline-flex items-center gap-1 font-cinzel font-bold text-indigo-400 bg-indigo-950/50 px-1.5 py-0.2 rounded border border-indigo-500/30">
                                          <Moon className="w-3 h-3 text-indigo-400" />
                                          Salto / Convalecencia {entrada.timeSkipDays ? `(+${entrada.timeSkipDays} d)` : ''}
                                        </span>
                                      )}
                                      {isNoticia && (
                                        <span className="inline-flex items-center gap-1 font-cinzel font-bold text-amber-400 bg-amber-950/50 px-1.5 py-0.2 rounded border border-amber-500/30">
                                          <Newspaper className="w-3 h-3 text-amber-400" />
                                          Noticia / Pregonero
                                        </span>
                                      )}
                                      {entrada.minute !== undefined && (
                                        <span>{horaLegible(entrada.minute)}</span>
                                      )}
                                      {entrada.lugar && <span>📍 {entrada.lugar}</span>}
                                      {entrada.clima && (
                                        <span>
                                          {iconoDeClima(entrada.clima)} {entrada.clima}
                                        </span>
                                      )}
                                    </div>
                                    {entrada.title && (
                                      <h5 className="font-cinzel font-bold text-xs text-[var(--text-primary)] m-0">
                                        {entrada.title}
                                      </h5>
                                    )}
                                    <p className="m-0 text-[var(--text-primary)] leading-relaxed font-lora">{entrada.summary}</p>
                                    {entrada.hito && (
                                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                                        {(() => {
                                          const icono = iconoDeHito(entrada.hito);
                                          const esRelacion = /rivalidad|rival|amistad|amigo|romance|amor|cortej|declaraci|insinuaci|enemistad|enemigo|alianza|mentor/i.test(entrada.hito);
                                          const esReloj = /reloj|semilla|hilo|plazo/i.test(entrada.hito);
                                          const esConsecuencia = /consecuencia|repercusi|secuela|gremio|familia|zona/i.test(entrada.hito);

                                          let styleClass = 'border-[var(--accent)]/40 bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]';
                                          if (esRelacion) {
                                            styleClass = obtenerInfoRelacion(entrada.hito).badgeClass;
                                          } else if (esReloj) {
                                            styleClass = 'border-amber-500/40 bg-amber-950/30 text-amber-300';
                                          } else if (esConsecuencia) {
                                            styleClass = 'border-purple-500/40 bg-purple-950/30 text-purple-300';
                                          }

                                          return (
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-cinzel font-semibold px-2 py-0.5 rounded-md border shadow-2xs ${styleClass}`}>
                                              <span className="text-sm">{icono}</span>
                                              <span>{entrada.hito}</span>
                                            </span>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        const sceneText = `${entrada.lugar ? `[Lugar: ${entrada.lugar}] ` : ''}${entrada.summary}${entrada.hito ? ` [Hito: ${entrada.hito}]` : ''}`;
                                        setStudioModal({
                                          isOpen: true,
                                          tab: 'image',
                                          sceneText
                                        });
                                      }}
                                      className="px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 cursor-pointer flex items-center gap-1 text-[10px] font-cinzel font-semibold shadow-2xs"
                                      title="Taller Creativo: Crear contenido para este acontecimiento"
                                    >
                                      <Wand2 className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                                      <span className="hidden sm:inline">Crear</span>
                                    </button>
                                    <button
                                      onClick={() => iniciarEdicionEntrada(entrada)}
                                      className="text-[var(--text-secondary)] hover:text-[var(--accent)] p-1 cursor-pointer"
                                      title="Editar"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => borrarEntrada(entrada.id)}
                                      className="text-red-500/70 hover:text-red-500 p-1 cursor-pointer"
                                      title="Borrar"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* =========================================================================
            PIE / DESACTIVAR
            ========================================================================= */}
        <div className="pt-4 text-center border-t border-[var(--glass-border)]">
          <button
            onClick={desactivar}
            className="text-xs text-[var(--text-secondary)] hover:text-red-500 underline cursor-pointer"
          >
            Dejar de llevar el tiempo en esta campaña
          </button>
        </div>
      </div>

      {/* Editor del calendario */}
      {editandoCal && borrador && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
          <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-xl shadow-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--sidebar-bg)]">
              <h3 className="font-cinzel text-lg text-[var(--accent)] font-bold m-0">Editar calendario</h3>
              <button
                onClick={() => setEditandoCal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-sm">
              <label className="block text-xs font-cinzel font-bold text-[var(--text-secondary)]">
                Nombre
                <input
                  value={borrador.name}
                  onChange={e => setBorrador({ ...borrador, name: e.target.value })}
                  className="mt-1 w-full bg-[var(--surface-soft)] border border-[var(--user-border)] rounded px-2 py-1.5 font-lora text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-xs font-cinzel font-bold text-[var(--text-secondary)]">
                Sufijo del año (DR, ABY, d. C.…)
                <input
                  value={borrador.yearSuffix || ''}
                  onChange={e => setBorrador({ ...borrador, yearSuffix: e.target.value })}
                  className="mt-1 w-32 block bg-[var(--surface-soft)] border border-[var(--user-border)] rounded px-2 py-1.5 font-lora text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </label>

              <div>
                <div className="text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1.5">
                  Meses ({diasPorAno(borrador)} días al año)
                </div>
                <div className="space-y-1.5">
                  {borrador.months.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={m.name}
                        onChange={e => {
                          const months = [...borrador.months];
                          months[i] = { ...months[i], name: e.target.value };
                          setBorrador({ ...borrador, months });
                        }}
                        className="flex-1 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
                      />
                      <input
                        value={m.days}
                        onChange={e => {
                          const dias = parseInt(e.target.value.replace(/\D/g, ''), 10);
                          const months = [...borrador.months];
                          months[i] = { ...months[i], days: Number.isFinite(dias) ? dias : 0 };
                          setBorrador({ ...borrador, months });
                        }}
                        className="w-14 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded px-2 py-1 text-sm text-center outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        onClick={() =>
                          setBorrador({
                            ...borrador,
                            months: borrador.months.filter((_, j) => j !== i),
                            festivals: (borrador.festivals || [])
                              .filter(f => f.afterMonth !== i)
                              .map(f => (f.afterMonth > i ? { ...f, afterMonth: f.afterMonth - 1 } : f))
                          })
                        }
                        className="text-red-500 hover:opacity-70 cursor-pointer px-1"
                        title="Quitar mes"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setBorrador({
                      ...borrador,
                      months: [...borrador.months, { name: 'Mes nuevo', days: 30 }]
                    })
                  }
                  className="mt-2 text-xs font-cinzel text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Añadir mes
                </button>
              </div>

              <div>
                <div className="text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1.5">
                  Festivales intercalares (días sueltos que no pertenecen a ningún mes)
                </div>
                <div className="space-y-1.5">
                  {(borrador.festivals || []).map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={f.name}
                        onChange={e => {
                          const festivals = [...(borrador.festivals || [])];
                          festivals[i] = { ...festivals[i], name: e.target.value };
                          setBorrador({ ...borrador, festivals });
                        }}
                        className="flex-1 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
                      />
                      <select
                        value={f.afterMonth}
                        onChange={e => {
                          const festivals = [...(borrador.festivals || [])];
                          festivals[i] = { ...festivals[i], afterMonth: parseInt(e.target.value, 10) };
                          setBorrador({ ...borrador, festivals });
                        }}
                        className="bg-[var(--surface-soft)] border border-[var(--user-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)] max-w-[130px]"
                      >
                        {borrador.months.map((m, mi) => (
                          <option key={mi} value={mi}>
                            tras {m.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          setBorrador({
                            ...borrador,
                            festivals: (borrador.festivals || []).filter((_, j) => j !== i)
                          })
                        }
                        className="text-red-500 hover:opacity-70 cursor-pointer px-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setBorrador({
                      ...borrador,
                      festivals: [
                        ...(borrador.festivals || []),
                        { name: 'Festival', afterMonth: Math.max(0, borrador.months.length - 1) }
                      ]
                    })
                  }
                  className="mt-2 text-xs font-cinzel text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Añadir festival
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--glass-border)] bg-[var(--sidebar-bg)] flex justify-end gap-2">
              <button
                onClick={() => setEditandoCal(false)}
                className="px-4 py-2 rounded-lg font-cinzel text-xs border border-[var(--user-border)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!calendarioValido(borrador)) return;
                  const max = diasPorAno(borrador);
                  await onUpdate({
                    calendar: borrador,
                    currentDate: { ...fechaSegura, dayOfYear: Math.min(fechaSegura.dayOfYear, max) }
                  });
                  setEditandoCal(false);
                }}
                className="px-4 py-2 rounded-lg font-cinzel text-xs font-bold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo genérico de confirmación */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[160] p-4">
          <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-xl shadow-2xl w-[400px] max-w-full font-lora overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--sidebar-bg)]">
              <h4 className="font-cinzel text-base text-[var(--accent)] font-bold m-0">
                {confirmDialog.title}
              </h4>
            </div>
            <div className="p-4">
              <p className="text-sm mb-5 leading-relaxed text-[var(--text-primary)]">
                {confirmDialog.message}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-[var(--user-border)] text-xs font-cinzel hover:bg-[var(--surface-soft)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDialog.onConfirm()}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-cinzel font-bold cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal del Taller Creativo para acontecimientos del calendario */}
      {studioModal?.isOpen && (
        <CreativeStudioModal
          isOpen={studioModal.isOpen}
          initialTab={studioModal.tab || 'image'}
          sceneText={studioModal.sceneText}
          onClose={() => setStudioModal(null)}
          onInsertIntoChat={async text => {
            // Guardar en notas del narrador si se solicita
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

export { CALENDARIO_FANTASTICO };
