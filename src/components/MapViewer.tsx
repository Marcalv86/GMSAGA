import React, { useState } from 'react';
import { ProjectFile, MapMarker } from '../types';

import { MapPin, Trash2, X } from 'lucide-react';
export const MapViewer: React.FC<{
  file: ProjectFile;
  onClose: () => void;
  onUpdateMarkers: (fileId: string, markers: MapMarker[]) => Promise<void>;
}> = ({ file, onClose, onUpdateMarkers }) => {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newMarkerPos, setNewMarkerPos] = useState<{ x: number; y: number } | null>(null);
  const [newMarkerLabel, setNewMarkerLabel] = useState('');
  const [newMarkerDesc, setNewMarkerDesc] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAdding) {
          setIsAdding(false);
          setNewMarkerPos(null);
        } else if (selectedMarker) {
          setSelectedMarker(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdding, selectedMarker, onClose]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setNewMarkerPos({ x, y });
    setNewMarkerLabel('');
    setNewMarkerDesc('');
    setIsAdding(true);
  };

  const handleSaveMarker = async () => {
    if (!newMarkerPos || !newMarkerLabel.trim()) return;
    const marker: MapMarker = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      x: newMarkerPos.x,
      y: newMarkerPos.y,
      label: newMarkerLabel.trim(),
      description: newMarkerDesc.trim()
    };
    const updated = [...(file.markers || []), marker];
    await onUpdateMarkers(file.id, updated);
    setIsAdding(false);
    setNewMarkerPos(null);
  };

  const handleDeleteMarker = async (markerId: string) => {
    const updated = (file.markers || []).filter(m => m.id !== markerId);
    await onUpdateMarkers(file.id, updated);
    setSelectedMarker(null);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-[60] animate-[fadeIn_0.3s_ease]">
      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-cinzel text-lg m-0"> {file.name}</h3>
          <span className="text-white/60 text-xs hidden sm:inline">
            (Haz clic en cualquier punto del mapa para añadir un Punto de Interés)
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-white text-2xl hover:text-[var(--accent)] transition-colors px-2 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />{' '}
        </button>
      </div>

      <div className="flex-1 relative overflow-auto flex items-center justify-center p-4">
        <div
          className="relative max-w-full max-h-[85vh] shadow-2xl cursor-crosshair select-none"
          onClick={handleMapClick}
        >
          <img
            src={file.content}
            alt={file.name}
            className="max-w-full max-h-[80vh] object-contain rounded"
            referrerPolicy="no-referrer"
          />

          {/* Markers on map */}
          {file.markers?.map(m => (
            <div
              key={m.id}
              className="absolute w-7 h-7 -ml-3.5 -mt-3.5 bg-[var(--accent)] border-2 border-white rounded-full flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-lg group z-10"
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              onClick={e => {
                e.stopPropagation();
                setSelectedMarker(m);
              }}
            >
              <MapPin className="w-3.5 h-3.5 text-white" />
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-2.5 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 pointer-events-none">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Marker Dialog */}
      {isAdding && newMarkerPos && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-70 p-4">
          <div className="bg-[var(--bg-color)] p-5 rounded shadow-2xl border border-[var(--glass-border)] w-96 max-w-full font-lora">
            <h4 className="font-cinzel text-lg text-[var(--accent)] mb-3">
              <MapPin className="w-3.5 h-3.5" /> Nuevo Punto de Interés
            </h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Nombre / Título
                </label>
                <input
                  type="text"
                  placeholder="Nombre del punto"
                  value={newMarkerLabel}
                  onChange={e => setNewMarkerLabel(e.target.value)}
                  className="w-full bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] border border-[var(--user-border)] p-2 rounded text-sm outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Descripción / Notas
                </label>
                <textarea
                  placeholder="Secretos, rumores o detalles del lugar..."
                  value={newMarkerDesc}
                  onChange={e => setNewMarkerDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] border border-[var(--user-border)] p-2 rounded text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveMarker}
                  disabled={!newMarkerLabel.trim()}
                  className="px-4 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold rounded hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Guardar Marcador
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Marker Details */}
      {selectedMarker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-70 p-4">
          <div className="bg-[var(--bg-color)] p-5 rounded shadow-2xl border border-[var(--glass-border)] w-96 max-w-full font-lora">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-cinzel text-lg text-[var(--accent)] m-0"> {selectedMarker.label}</h4>
              <button
                onClick={() => setSelectedMarker(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />{' '}
              </button>
            </div>
            <p className="text-sm text-[var(--text-primary)] my-4 whitespace-pre-wrap">
              {selectedMarker.description || 'Sin descripción registrada.'}
            </p>
            <div className="flex justify-between items-center pt-2 border-t border-[var(--glass-border)]">
              <button
                onClick={() => handleDeleteMarker(selectedMarker.id)}
                className="text-xs text-red-700 hover:text-red-900 font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar marcador
              </button>
              <button
                onClick={() => setSelectedMarker(null)}
                className="px-3 py-1 bg-[var(--accent)] text-[var(--on-accent)] text-xs rounded hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
