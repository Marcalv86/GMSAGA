import React, { useState, useEffect } from 'react';
import { Bug, AlertTriangle } from 'lucide-react';
import { subscribeToLogs, LogEntry } from '../utils/logger';
import { LoggerModal } from './LoggerModal';

export interface LoggerProps {
  variant?: 'button' | 'compact' | 'sidebar';
  className?: string;
}

/**
 * Componente Logger con indicador en tiempo real de errores y botón de acceso al visor.
 */
export const Logger: React.FC<LoggerProps> = ({ variant = 'button', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToLogs(updatedLogs => {
      setLogs(updatedLogs);
    });
    return () => unsubscribe();
  }, []);

  const errorCount = logs.filter(l => l.level === 'error').length;

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center relative ${
            errorCount > 0
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25'
              : 'border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--glass)]'
          } ${className}`}
          title={
            errorCount > 0
              ? `Registro de depuración (${errorCount} ${errorCount === 1 ? 'error' : 'errores'})`
              : 'Registro de eventos y depuración (Logger)'
          }
          aria-label="Registro de errores"
        >
          {errorCount > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-rose-500" />
          ) : (
            <Bug className="w-3.5 h-3.5 opacity-80" />
          )}

          {errorCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-600 text-white text-[9px] font-mono font-bold flex items-center justify-center border border-white dark:border-black">
              {errorCount > 99 ? '99+' : errorCount}
            </span>
          )}
        </button>

        <LoggerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
    );
  }

  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`w-full text-xs font-cinzel transition-all cursor-pointer px-2.5 py-1.5 flex items-center justify-between rounded-lg border shadow-2xs ${
            errorCount > 0
              ? 'bg-rose-950/20 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-950/30'
              : 'border-[var(--glass-border)] bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
          } ${className}`}
          title="Abrir Registro de Errores y Generación de Hilos"
        >
          <div className="flex items-center gap-1.5 truncate">
            {errorCount > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            ) : (
              <Bug className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span className="truncate font-semibold">Registro & Logger</span>
          </div>

          {errorCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white">
              {errorCount} {errorCount === 1 ? 'err' : 'errs'}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">OK</span>
          )}
        </button>

        <LoggerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`text-xs font-cinzel transition-all cursor-pointer px-2.5 py-1 flex items-center gap-1.5 rounded-lg border ${
          errorCount > 0
            ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 shadow-xs'
            : 'border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
        } ${className}`}
        title="Abrir panel de registro de errores y depuración"
      >
        {errorCount > 0 ? (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />
        ) : (
          <Bug className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
        <span>Registro</span>
        {errorCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white">
            {errorCount}
          </span>
        )}
      </button>

      <LoggerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export { LoggerModal };
