import React, { useState, useEffect, useMemo } from 'react';
import {
  LogEntry,
  clearLogs,
  subscribeToLogs,
  exportLogsToTextFile,
  getLogsAsFormattedText
} from '../utils/logger';
import {
  AlertTriangle,
  Bug,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Info,
  MessageSquareWarning,
  Search,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

interface LoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoggerModal: React.FC<LoggerModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeToLogs(updatedLogs => {
      setLogs(updatedLogs);
    });
    return () => unsubscribe();
  }, [isOpen]);

  const errorCount = useMemo(() => logs.filter(l => l.level === 'error').length, [logs]);
  const warnCount = useMemo(() => logs.filter(l => l.level === 'warn').length, [logs]);
  const threadsCount = useMemo(() => logs.filter(l => l.category === 'threads').length, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      // Filtro por categoría
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Filtro por nivel
      if (selectedLevel !== 'all' && item.level !== selectedLevel) {
        return false;
      }
      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchMsg = item.message.toLowerCase().includes(q);
        const matchDetails = item.details?.toLowerCase().includes(q) || false;
        const matchModel = item.model?.toLowerCase().includes(q) || false;
        const matchProject = item.projectName?.toLowerCase().includes(q) || false;
        return matchTitle || matchMsg || matchDetails || matchModel || matchProject;
      }
      return true;
    });
  }, [logs, selectedCategory, selectedLevel, searchQuery]);

  const handleCopySingle = (item: LogEntry) => {
    const text = `[${item.formattedTime}] [${item.level.toUpperCase()}] [${item.category.toUpperCase()}]\nTítulo: ${item.title}\nMensaje: ${item.message}${item.details ? `\nDetalles:\n${item.details}` : ''}${item.stack ? `\nStack:\n${item.stack}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const text = getLogsAsFormattedText();
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExport = () => {
    const ok = exportLogsToTextFile();
    if (ok) {
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    }
  };

  const handleClear = () => {
    if (window.confirm('¿Estás seguro de que deseas vaciar todo el registro de errores y eventos de depuración?')) {
      clearLogs();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[160] p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[var(--text-primary)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="p-3.5 sm:p-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--sidebar-bg)] gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
              <Bug className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-[var(--accent)] m-0 truncate flex items-center gap-2">
                <span>Registro de Errores y Depuración</span>
                {errorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-sans font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    {errorCount} {errorCount === 1 ? 'error' : 'errores'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] m-0 truncate">
                Captura fallos en generación de hilos, streaming de narrativa y sincronización
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] cursor-pointer transition-colors shrink-0"
            title="Cerrar ventana"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Acciones y Estadísticas */}
        <div className="p-3 bg-[var(--glass)] border-b border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--text-secondary)] font-cinzel font-semibold mr-1">Filtro:</span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-cinzel transition-colors cursor-pointer border ${
                selectedCategory === 'all'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold border-[var(--accent)]'
                  : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--glass-border)]'
              }`}
            >
              Todos ({logs.length})
            </button>
            <button
              onClick={() => setSelectedCategory('threads')}
              className={`px-2.5 py-1 rounded-md text-xs font-cinzel transition-colors cursor-pointer border flex items-center gap-1 ${
                selectedCategory === 'threads'
                  ? 'bg-amber-600 text-white font-bold border-amber-600'
                  : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--glass-border)]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Hilos ({threadsCount})</span>
            </button>
            <button
              onClick={() => setSelectedCategory('gemini_stream')}
              className={`px-2.5 py-1 rounded-md text-xs font-cinzel transition-colors cursor-pointer border flex items-center gap-1 ${
                selectedCategory === 'gemini_stream'
                  ? 'bg-indigo-600 text-white font-bold border-indigo-600'
                  : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--glass-border)]'
              }`}
            >
              <MessageSquareWarning className="w-3 h-3" />
              <span>Streaming IA</span>
            </button>
            <button
              onClick={() => setSelectedCategory('calendar_timeline')}
              className={`px-2.5 py-1 rounded-md text-xs font-cinzel transition-colors cursor-pointer border ${
                selectedCategory === 'calendar_timeline'
                  ? 'bg-purple-600 text-white font-bold border-purple-600'
                  : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--glass-border)]'
              }`}
            >
              Cronología
            </button>
            <button
              onClick={() => setSelectedCategory('memory_sync')}
              className={`px-2.5 py-1 rounded-md text-xs font-cinzel transition-colors cursor-pointer border ${
                selectedCategory === 'memory_sync'
                  ? 'bg-emerald-600 text-white font-bold border-emerald-600'
                  : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--glass-border)]'
              }`}
            >
              Memoria
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={handleExport}
              disabled={logs.length === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${
                exportSuccess
                  ? 'bg-emerald-600 text-white border border-emerald-500'
                  : 'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]'
              }`}
              title="Descargar archivo .txt completo para depuración"
            >
              {exportSuccess ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{exportSuccess ? '¡Archivo Descargado!' : 'Exportar a TXT'}</span>
            </button>

            <button
              onClick={handleCopyAll}
              disabled={logs.length === 0}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-cinzel border border-[var(--user-border)] bg-[var(--surface-soft)] hover:border-[var(--accent)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Copiar texto completo al portapapeles"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedAll ? 'Copiado' : 'Copiar'}</span>
            </button>

            {logs.length > 0 && (
              <button
                onClick={handleClear}
                className="p-1.5 rounded-lg text-xs border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Vaciar historial de logs"
                aria-label="Limpiar registro"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Barra de Búsqueda y Filtro de Nivel */}
        <div className="p-2.5 bg-[var(--surface-soft)]/50 border-b border-[var(--glass-border)] flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar en mensajes, modelos, hilos o stack..."
              className="w-full pl-8 pr-7 py-1 text-xs bg-[var(--bg-color)] border border-[var(--user-border)] rounded-md text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setSelectedLevel('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-cinzel ${
                selectedLevel === 'all'
                  ? 'font-bold underline text-[var(--accent)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Todos los niveles
            </button>
            <span>·</span>
            <button
              onClick={() => setSelectedLevel('error')}
              className={`px-2 py-0.5 rounded text-[11px] font-cinzel flex items-center gap-1 ${
                selectedLevel === 'error'
                  ? 'font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 border border-rose-500/30'
                  : 'text-[var(--text-secondary)] hover:text-rose-600'
              }`}
            >
              Errores ({errorCount})
            </button>
            <span>·</span>
            <button
              onClick={() => setSelectedLevel('warn')}
              className={`px-2 py-0.5 rounded text-[11px] font-cinzel flex items-center gap-1 ${
                selectedLevel === 'warn'
                  ? 'font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30'
                  : 'text-[var(--text-secondary)] hover:text-amber-600'
              }`}
            >
              Avisos ({warnCount})
            </button>
          </div>
        </div>

        {/* Lista de Registros */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2 border border-dashed border-[var(--glass-border)] rounded-xl">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <h4 className="font-cinzel text-sm font-bold text-[var(--accent)] m-0">
                {logs.length === 0 ? 'Sin errores registrados' : 'No hay eventos con los filtros actuales'}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto m-0">
                {logs.length === 0
                  ? 'El sistema de generación de hilos y comunicación con Gemini está operando con normalidad.'
                  : 'Prueba a cambiar los términos de búsqueda o los filtros de categoría.'}
              </p>
            </div>
          ) : (
            filteredLogs.map(item => {
              const isExpanded = expandedLogId === item.id;
              const isCopied = copiedId === item.id;

              let levelBadge = {
                bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
                icon: AlertTriangle,
                label: 'ERROR'
              };
              if (item.level === 'warn') {
                levelBadge = {
                  bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
                  icon: MessageSquareWarning,
                  label: 'AVISO'
                };
              } else if (item.level === 'info') {
                levelBadge = {
                  bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
                  icon: Info,
                  label: 'INFO'
                };
              }

              let categoryLabel = 'GENERAL';
              if (item.category === 'threads') categoryLabel = 'HILOS NARRATIVOS';
              if (item.category === 'gemini_stream') categoryLabel = 'STREAMING IA';
              if (item.category === 'calendar_timeline') categoryLabel = 'CRONOLOGÍA';
              if (item.category === 'memory_sync') categoryLabel = 'MEMORIA';
              if (item.category === 'storage') categoryLabel = 'ALMACENAMIENTO';

              const LevelIcon = levelBadge.icon;

              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-3 transition-all ${
                    item.level === 'error'
                      ? 'bg-rose-950/10 border-rose-500/30'
                      : item.level === 'warn'
                        ? 'bg-amber-950/10 border-amber-500/30'
                        : 'bg-[var(--surface-soft)] border-[var(--glass-border)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold px-1.5 py-0.5 rounded border ${levelBadge.bg}`}
                        >
                          <LevelIcon className="w-3 h-3" />
                          <span>{levelBadge.label}</span>
                        </span>
                        <span className="font-cinzel font-semibold px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--accent)]">
                          {categoryLabel}
                        </span>
                        <span className="text-[var(--text-secondary)] font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{item.formattedTime}</span>
                        </span>
                        {item.model && (
                          <span className="font-mono text-purple-700 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            {item.model}
                          </span>
                        )}
                        {item.projectName && (
                          <span className="text-[var(--text-secondary)] truncate max-w-[150px]">
                            📖 {item.projectName}
                          </span>
                        )}
                      </div>

                      <h4 className="font-cinzel text-xs sm:text-sm font-bold text-[var(--text-primary)] m-0 leading-tight">
                        {item.title}
                      </h4>

                      <p className="text-xs text-[var(--text-primary)] leading-relaxed m-0 font-sans break-words">
                        {item.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopySingle(item)}
                        className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] rounded cursor-pointer transition-colors"
                        title="Copiar detalles de este evento"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {(item.details || item.stack) && (
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                          className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] rounded cursor-pointer transition-colors"
                          title={isExpanded ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos y stack'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detalles Técnicos / Stack Trace */}
                  {isExpanded && (item.details || item.stack) && (
                    <div className="mt-2.5 pt-2.5 border-t border-[var(--glass-border)] space-y-2 text-xs font-mono animate-in fade-in duration-150">
                      {item.details && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] font-cinzel block mb-1">
                            Detalles / Contexto:
                          </span>
                          <pre className="p-2.5 rounded bg-black/40 border border-[var(--glass-border)] text-[11px] text-[var(--text-primary)] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
                            {item.details}
                          </pre>
                        </div>
                      )}
                      {item.stack && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500/80 font-cinzel block mb-1">
                            Stack Trace:
                          </span>
                          <pre className="p-2.5 rounded bg-rose-950/30 border border-rose-500/30 text-[10px] text-rose-300 overflow-x-auto whitespace-pre-wrap leading-tight max-h-40">
                            {item.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pie */}
        <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--sidebar-bg)] flex items-center justify-between text-xs text-[var(--text-secondary)] shrink-0">
          <span className="font-cinzel text-[11px]">
            {filteredLogs.length} de {logs.length} eventos listados
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--surface-soft)] hover:bg-[var(--glass)] text-[var(--text-primary)] border border-[var(--user-border)] font-cinzel text-xs cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
