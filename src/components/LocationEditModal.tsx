import React, { useState } from 'react';
import { Location, ProjectFile } from '../types';
import { X, Castle, MapPin, Camera, Save } from 'lucide-react';

interface LocationEditModalProps {
  isOpen: boolean;
  location: Partial<Location> | null;
  onClose: () => void;
  onSave: (loc: Location) => Promise<void> | void;
  allImageFiles?: ProjectFile[];
  onOpenPortraitPicker?: () => void;
}

export const LocationEditModal: React.FC<LocationEditModalProps> = ({
  isOpen,
  location,
  onClose,
  onSave,
  allImageFiles: _allImageFiles = [],
  onOpenPortraitPicker
}) => {
  const [name, setName] = useState(location?.name || '');
  const [desc, setDesc] = useState(location?.desc || '');
  const [notes, setNotes] = useState(location?.notes || '');
  const [portrait, setPortrait] = useState(location?.portrait || '');

  React.useEffect(() => {
    if (location) {
      setName(location.name || '');
      setDesc(location.desc || '');
      setNotes(location.notes || '');
      setPortrait(location.portrait || '');
    }
  }, [location]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedLoc: Location = {
      id: location?.id || `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: name.trim(),
      desc: desc.trim(),
      notes: notes.trim(),
      portrait: portrait || undefined,
      markers: location?.markers || []
    };

    await onSave(updatedLoc);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-3 sm:p-5 backdrop-blur-2xs overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-color)] border border-[var(--glass-border)] w-[620px] max-w-full font-lora max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--surface-soft)] shrink-0">
          <div className="flex items-center gap-2">
            <Castle className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-cinzel font-bold text-base text-[var(--accent)] m-0">
              {location?.id ? 'Editar Lugar o Asentamiento' : 'Nuevo Lugar o Asentamiento'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Identidad y Retrato / Mapa */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Imagen o Mapa */}
            <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-start">
              <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-[var(--accent)]/40 bg-[var(--surface)] flex items-center justify-center relative group">
                {portrait ? (
                  <img
                    src={portrait}
                    alt={name || 'Imagen Lugar'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <MapPin className="w-10 h-10 text-[var(--text-secondary)] opacity-40" />
                )}
                {onOpenPortraitPicker && (
                  <button
                    type="button"
                    onClick={onOpenPortraitPicker}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-[11px] font-cinzel text-white transition-opacity cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Cambiar</span>
                  </button>
                )}
              </div>
              {onOpenPortraitPicker && (
                <button
                  type="button"
                  onClick={onOpenPortraitPicker}
                  className="text-xs font-cinzel text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{portrait ? 'Cambiar Imagen' : 'Vincular Mapa'}</span>
                </button>
              )}
            </div>

            {/* Nombre del Lugar */}
            <div className="flex-1 space-y-3 w-full">
              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Nombre del Lugar *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Posada del Dragón Verde, Ciudad de Athkatla, Bosque Umbrío..."
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Descripción Breve / Atmósfera
                </label>
                <input
                  type="text"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Qué clase de sitio es, ubicación, ambiente o gobernantes..."
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* Notas Detalladas, PNJ Clave y Secretos */}
          <div>
            <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
              Notas Extensas, Distritos, PNJs Residentes o Secretos
            </label>
            <textarea
              rows={5}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalles sobre defensas, comercios, peligros, rumores locales o descubrimientos hechos por la compañía..."
              className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-xs leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--glass-border)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)] text-[var(--text-secondary)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{location?.id ? 'Guardar Cambios' : 'Crear Lugar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
