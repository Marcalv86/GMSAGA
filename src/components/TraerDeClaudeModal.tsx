import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { DocumentosVivos } from '../types';
import type { SesionDeChat } from '../utils/importarSesiones';
import { ImportarDesdeClaude } from './DocumentosVivosPanel';
import { ImportarSesionesModal } from './ImportarSesionesModal';

/*
 * 📥 TRAER TU PARTIDA DE CLAUDE — la puerta de entrada, en un solo sitio.
 *
 * Dos pestañas: los documentos (Cuaderno, Bitácora y memoria del proyecto) y
 * las sesiones (los chats, como capítulos). Se abre desde la barra lateral y
 * desde el chat vacío de una campaña nueva, que es justo cuando hace falta.
 */
export const TraerDeClaudeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  docs?: DocumentosVivos | null;
  onImportarDocumentos: (pegado: { cuaderno: string; bitacora: string; memoria: string }) => Promise<string[]> | string[];
  onImportarSesiones: (sesiones: SesionDeChat[]) => Promise<void> | void;
}> = ({ isOpen, onClose, docs, onImportarDocumentos, onImportarSesiones }) => {
  const [pestana, setPestana] = useState<'documentos' | 'sesiones'>('documentos');
  if (!isOpen) return null;
  const tab = (id: typeof pestana, texto: string) => (
    <button
      onClick={() => setPestana(id)}
      aria-pressed={pestana === id}
      className={`flex-1 min-h-[40px] px-3 rounded-lg text-xs font-cinzel font-bold cursor-pointer transition-all ${
        pestana === id
          ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
          : 'text-[var(--text-secondary)] border border-[var(--glass-border)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
      }`}
    >
      {texto}
    </button>
  );
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl max-h-[94vh] flex flex-col rounded-xl border border-[var(--accent)]/50 bg-[var(--surface)] shadow-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--surface-soft)] flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="m-0 font-cinzel font-bold text-base text-[var(--accent)]">📥 Traer tu partida de Claude</h2>
              <p className="m-0 mt-0.5 text-[11px] sm:text-xs text-[var(--text-secondary)] leading-relaxed">
                Sin IA y con deshacer. Los compendios y la ficha van aparte, en 📎 Archivos.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              title="Cerrar"
              className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex gap-2">
            {tab('documentos', '📜 Cuaderno, Bitácora y memoria')}
            {tab('sesiones', '💬 Sesiones (chats)')}
          </nav>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {pestana === 'documentos' ? (
            docs ? (
              <div className="p-3 sm:p-4">
                <ImportarDesdeClaude docs={docs} onImportar={onImportarDocumentos} onCerrar={onClose} sinTitulo />
              </div>
            ) : (
              <p className="m-0 p-4 text-xs text-[var(--text-secondary)]">⏳ Preparando los documentos de la campaña…</p>
            )
          ) : (
            <ImportarSesionesModal isOpen incrustado onClose={onClose} onImportar={onImportarSesiones} />
          )}
        </div>
      </div>
    </div>
  );
};
