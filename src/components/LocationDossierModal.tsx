import React from 'react';
import { Location, ProjectFile } from '../types';
import {
  X,
  Castle,
  MapPin,
  Camera,
  Eye
} from 'lucide-react';

interface LocationDossierModalProps {
  location: Location;
  allImageFiles: ProjectFile[];
  onChangeMap: (loc: Location) => void;
  onClose: () => void;
}

export const LocationDossierModal: React.FC<LocationDossierModalProps> = ({
  location,
  allImageFiles,
  onChangeMap,
  onClose
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const matchingMap = location.portrait
    ? allImageFiles.find(f => f.content === location.portrait)
    : allImageFiles.find(
        f => location.name.length > 2 && f.name.toLowerCase().includes(location.name.toLowerCase())
      );
  const mapSrc = location.portrait || matchingMap?.content;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-5 backdrop-blur-2xs"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-color)] border border-[var(--glass-border)] w-[760px] max-w-full font-lora max-h-[92vh] flex flex-col rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[var(--sidebar-bg)] p-4 sm:p-5 border-b border-[var(--user-border)] flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-[var(--glass-border)] overflow-hidden bg-black/10 flex items-center justify-center shadow-md shrink-0">
              {mapSrc ? (
                <img
                  src={mapSrc}
                  alt={location.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Castle className="w-7 h-7 text-[var(--accent)]" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-cinzel text-lg sm:text-2xl font-bold text-[var(--accent)] m-0 break-words leading-tight">
                {location.name}
              </h3>
              <span className="text-xs font-cinzel text-[var(--text-secondary)] flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" /> Lugar Clave de Campaña
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer shrink-0"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Map Preview Banner if available */}
          {mapSrc && (
            <div className="rounded-xl overflow-hidden border border-[var(--user-border)] shadow-md bg-black/5 max-h-64 flex items-center justify-center relative group">
              <img
                src={mapSrc}
                alt={location.name}
                className="w-full h-full object-contain max-h-64"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => onChangeMap(location)}
                className="absolute top-2 right-2 px-2.5 py-1 text-xs font-cinzel bg-black/70 hover:bg-black/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Cambiar Mapa
              </button>
            </div>
          )}

          {/* Description */}
          {location.desc && (
            <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-1.5 shadow-2xs">
              <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider block">
                Descripción del Entorno & Atmósfera
              </span>
              <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed m-0 whitespace-pre-wrap">
                {location.desc}
              </p>
            </div>
          )}

          {/* Secret / Tactical Notes */}
          {location.notes && (
            <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-1.5 shadow-2xs">
              <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider block">
                Detalles Tácticos & Secretos del Lugar
              </span>
              <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed m-0 whitespace-pre-wrap">
                {location.notes}
              </p>
            </div>
          )}

          {/* Visual Analysis from Map File if any */}
          {matchingMap?.analysis && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl space-y-1 shadow-2xs">
              <span className="font-cinzel text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Elementos Visuales Detectados en el Mapa:
              </span>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] italic leading-relaxed m-0 whitespace-pre-wrap">
                {matchingMap.analysis}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[var(--sidebar-bg)] p-3 sm:p-4 border-t border-[var(--user-border)] flex flex-wrap justify-between items-center gap-2">
          <button
            onClick={() => onChangeMap(location)}
            className="px-3.5 py-1.5 text-xs font-cinzel text-[var(--text-primary)] border border-[var(--glass-border)] bg-[var(--surface)] rounded-lg hover:bg-[var(--sidebar-bg)] cursor-pointer flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{mapSrc ? 'Cambiar Mapa' : 'Asignar Mapa'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface)] cursor-pointer transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
