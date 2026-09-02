import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, ProjectFile, Chat } from '../types';
import {
  Calendar,
  Compass,
  Hourglass,
  NotebookPen,
  Search,
  Eye,
  EyeOff,
  Check,
  Lock
} from 'lucide-react';
import {
  aDiaAbsoluto,
  calendarioValido,
  distanciaEnDias,
  fechaLegible
} from '../utils/campaignCalendar';

interface StatusViewProps {
  project: Project;
  files?: ProjectFile[];
  chats?: Chat[];
  onUpdate?: (fields: Partial<Project> | ((prev: Project) => Partial<Project>)) => Promise<void> | void;
  onUpdateMemory?: (updater: (prevMem: Project['memory']) => Project['memory']) => Promise<void>;
}

export const StatusView: React.FC<StatusViewProps> = ({
  project,
  onUpdateMemory
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
  const hoyAbs = cal && fecha ? aDiaAbsoluto(cal, fecha) : 0;

  // --- HILOS Y TRAMAS (SOLO LECTURA) ---
  const [filtroHilos, setFiltroHilos] = useState<'todos' | 'activos' | 'temporales' | 'completados'>('activos');
  const [busquedaHilos, setBusquedaHilos] = useState('');

  // --- NOTAS Y SECRETOS (SOLO LECTURA CON VISIBILIDAD TOGGLE) ---
  const [mostrarNotasNarrador, setMostrarNotasNarrador] = useState(false);

  const toggleQuest = (id: string) => {
    if (!onUpdateMemory) return;
    onUpdateMemory(prev => {
      const mem = prev || { story: '', quests: [], npcs: [], locations: [], current_status: '', manual_notes: '' };
      const quests = (mem.quests || []).map(q => {
        if (q.id !== id) return q;
        const isDone = q.status.toLowerCase().includes('complet') || q.status.toLowerCase().includes('resuelt');
        return {
          ...q,
          status: isDone ? 'Activa' : 'Completada'
        };
      });
      return { ...mem, quests };
    });
  };

  // Hilos programados en el tiempo
  const threads = project.threads || [];
  const hilosPendientes = threads.filter(h => h.status === 'pending' || !h.status);
  const hilosCumplidos = threads.filter(h => h.status === 'fired' || h.status === 'cancelled');

  // Misiones / Quests
  const quests = memory.quests || [];

  const questsFiltradas = quests.filter(q => {
    const isDone =
      q.status.toLowerCase().includes('complet') ||
      q.status.toLowerCase().includes('resuelt') ||
      q.status.toLowerCase().includes('fallid');

    if (filtroHilos === 'activos' && isDone) return false;
    if (filtroHilos === 'completados' && !isDone) return false;
    if (filtroHilos === 'temporales') {
      const threadId = `thread_${q.id}`;
      const hasThread = threads.some(t => t.id === threadId);
      if (!hasThread) return false;
    }

    if (busquedaHilos.trim()) {
      const term = busquedaHilos.toLowerCase();
      const matchTitle = (q.title || '').toLowerCase().includes(term);
      const matchObjective = (q.objective || '').toLowerCase().includes(term);
      const matchProgress = (q.progress || '').toLowerCase().includes(term);
      const matchOrigin = (q.origin || '').toLowerCase().includes(term);
      return matchTitle || matchObjective || matchProgress || matchOrigin;
    }

    return true;
  });

  const conteoActivos = quests.filter(
    q =>
      !q.status.toLowerCase().includes('complet') &&
      !q.status.toLowerCase().includes('resuelt') &&
      !q.status.toLowerCase().includes('fallid')
  ).length;

  const conteoCompletados = quests.filter(
    q =>
      q.status.toLowerCase().includes('complet') ||
      q.status.toLowerCase().includes('resuelt') ||
      q.status.toLowerCase().includes('fallid')
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-cinzel font-semibold bg-[var(--surface-soft)] text-[var(--text-secondary)] border border-[var(--glass-border)]">
              <Lock className="w-3 h-3 text-[var(--accent)]" />
              Solo Lectura
            </span>
            {calActivo && cal && fecha && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-cinzel bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <Calendar className="w-3 h-3" />
                {fechaLegible(cal, fecha)}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] m-0 mt-1">
            Situación presente de la compañía, consecuencias temporales y objetivos gestionados por la narración.
          </p>
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
        </div>

        {memory.current_status ? (
          <div className="markdown-body text-sm leading-relaxed p-3.5 rounded-lg bg-[var(--surface-soft)]/50 border border-[var(--glass-border)] select-text">
            <ReactMarkdown>{memory.current_status}</ReactMarkdown>
          </div>
        ) : (
          <div className="p-6 rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--surface-soft)]/20 text-center space-y-1">
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] m-0">
              No hay estado registrado aún. Aparecerá automáticamente según juegues o pulses «Sincronizar con IA».
            </p>
          </div>
        )}
      </section>

      {/* BLOQUE 2: HILOS EN MARCHA (CONSECUENCIAS EN EL TIEMPO) */}
      <section className="bg-[var(--bg-color)]/70 border border-[var(--glass-border)] rounded-xl p-4 sm:p-5 md:p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-[var(--glass-border)]">
          <div className="space-y-1">
            <h3 className="font-cinzel font-bold text-base sm:text-lg text-[var(--accent)] flex items-center gap-2 m-0">
              <Hourglass className="w-4 h-4 text-[var(--accent)]" />
              <span>HILOS EN MARCHA ({hilosPendientes.length})</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] m-0 leading-relaxed">
              Consecuencias con fecha prevista: el mundo actuando por su cuenta. El Narrador los escribe según
              juegas cuando queda algo pendiente en el tiempo.
            </p>
          </div>
        </div>

        {hilosPendientes.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-[var(--glass-border)] text-center">
            <p className="text-sm text-[var(--text-secondary)] italic m-0">
              Nada programado todavía. Aparecerán según juegues y se fijen plazos en la historia.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {hilosPendientes.map(h => {
              const faltan = h.dueAbsDay - hoyAbs;
              const urgente = faltan <= 1;
              return (
                <div
                  key={h.id}
                  className={`p-3.5 rounded-lg border bg-[var(--surface-soft)]/50 ${
                    urgente ? 'border-[var(--accent)]' : 'border-[var(--glass-border)]'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-cinzel font-bold text-sm text-[var(--text-primary)]">
                      {h.title}
                    </span>
                    <span
                      className={`text-xs font-cinzel ${
                        urgente ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {distanciaEnDias(faltan)} · {h.dueDate}
                    </span>
                  </div>
                  {!h.hidden && h.effect !== h.title && (
                    <p className="text-xs text-[var(--text-secondary)] m-0 mt-1 leading-relaxed">
                      {h.effect}
                    </p>
                  )}
                  {h.hidden && (
                    <p className="text-xs text-[var(--text-secondary)] italic m-0 mt-1">
                      Oculto: solo lo sabe el Narrador.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hilosCumplidos.length > 0 && (
          <details className="text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--glass-border)]">
            <summary className="cursor-pointer font-cinzel font-bold hover:text-[var(--accent)] select-none">
              Ya ocurrieron ({hilosCumplidos.length})
            </summary>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              {hilosCumplidos.map(h => (
                <li key={h.id}>
                  <strong>{h.title}</strong> — {h.dueDate} ({h.status === 'fired' ? 'Cumplido' : 'Cancelado'})
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* BLOQUE 3: MISIONES Y TRAMAS DE LA CAMPAÑA */}
      <section className="bg-[var(--bg-color)]/70 border border-[var(--glass-border)] rounded-xl p-4 sm:p-5 md:p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-[var(--glass-border)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-cinzel font-bold text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2">
                <Compass className="w-4 h-4 text-[var(--accent)]" />
                <span>MISIONES Y OBJETIVOS DE LA CAMPAÑA ({quests.length})</span>
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
              Misiones en curso y objetivos registrados por la narración del juego.
            </p>
          </div>
        </div>

        {/* Filtros y Búsqueda de Misiones */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 pb-1 sm:pb-0">
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
              placeholder="Buscar misiones..."
              className="w-full bg-[var(--surface-soft)] border border-[var(--glass-border)] rounded-lg pl-8 pr-3 py-1 text-xs font-lora outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Listado de Tarjetas de Misiones (Solo Lectura) */}
        {questsFiltradas.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-[var(--glass-border)] text-center space-y-2">
            <p className="text-sm text-[var(--text-secondary)] italic m-0">
              {quests.length === 0
                ? 'No hay tramas ni misiones registradas aún.'
                : 'No se encontraron objetivos con los filtros aplicados.'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] opacity-80 m-0">
              El Narrador las registrará y actualizará según se desarrollen las aventuras en el chat.
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
                      : 'bg-[var(--surface-soft)]/60 border-[var(--glass-border)] shadow-2xs'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Fila superior: Tipo y Estado */}
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

                        <button
                          onClick={() => toggleQuest(q.id)}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isDone ? 'text-emerald-600 hover:text-emerald-700' : 'text-[var(--text-secondary)] hover:text-emerald-600'
                          }`}
                          title={isDone ? 'Marcar como activa' : 'Marcar como completada'}
                        >
                          <Check className="w-4 h-4" />
                        </button>
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

                    {/* Aviso de Fecha de Vencimiento */}
                    {relatedThread && (
                      <div className="flex items-center gap-1.5 text-[11px] font-cinzel text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                        <Hourglass className="w-3 h-3 shrink-0" />
                        <span>Vence en la cronología: <strong>{relatedThread.dueDate}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BLOQUE 4: NOTAS Y SECRETOS DE LA CAMPAÑA (SOLO LECTURA CON TOGGLE REVELAR) */}
      <section className="bg-[var(--bg-color)]/70 border border-[var(--glass-border)] rounded-xl p-4 sm:p-5 md:p-6 space-y-3.5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-2.5 pb-2.5 border-b border-[var(--glass-border)]">
          <div className="space-y-0.5">
            <span className="font-cinzel font-bold text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2">
              <NotebookPen className="w-4 h-4 text-[var(--accent)]" />
              <span>NOTAS Y SECRETOS DE LA CAMPAÑA</span>
            </span>
            <p className="text-xs text-[var(--text-secondary)] m-0">
              Reglas de casa, secretos del máster y revelaciones futuras que el Narrador respeta estrictamente.
            </p>
          </div>

          {memory.manual_notes && (
            <div className="flex items-center gap-1.5 shrink-0">
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
            </div>
          )}
        </div>

        {memory.manual_notes ? (
          mostrarNotasNarrador ? (
            <div className="markdown-body text-sm leading-relaxed p-3.5 rounded-lg bg-[var(--surface-soft)]/50 border border-[var(--glass-border)] select-text">
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
          <div className="p-6 rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--surface-soft)]/20 text-center space-y-1">
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] m-0">
              Sin notas por ahora. El Narrador las irá registrando o sincronizando a partir de la historia.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
