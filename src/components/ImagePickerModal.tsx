import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectFile, FileCategory } from '../types';
import { optimizeImageFile } from '../utils/fileStorage';
import {
  Castle,
  Check,
  ClipboardPaste,
  Drama,
  FileImage,
  Info,
  Link,
  Loader2,
  Shield,
  UploadCloud,
  X,
  Sparkles
} from 'lucide-react';

export interface ImagePickerTarget {
  type: 'player' | 'npc' | 'location' | 'item';
  id: string;
  name: string;
  desc?: string;
}

interface ImagePickerModalProps {
  target: ImagePickerTarget;
  allImageFiles: ProjectFile[];
  onSelectImage: (content: string) => void;
  onUploadFile?: (file: File, category?: FileCategory) => Promise<string>;
  onClose: () => void;
}

function computeTargetConfig(target: ImagePickerTarget) {
  const rawName = (target.name || '').trim();
  const name = rawName || (target.type === 'location' ? 'Lugar' : target.type === 'item' ? 'Objeto' : 'Personaje');

  if (target.type === 'location') {
    return {
      modalTitle: `Ilustración o Mapa: ${name}`,
      entityLabel: 'lugar o escenario',
      defaultCategory: 'map' as FileCategory,
      subtitle: `Sube una ilustración o mapa desde tu equipo para ${name}.`
    };
  }

  if (target.type === 'item') {
    return {
      modalTitle: `Ilustración de Objeto: ${name}`,
      entityLabel: 'objeto o equipamiento',
      defaultCategory: 'scene' as FileCategory,
      subtitle: `Sube una imagen o ilustración para ${name}.`
    };
  }

  // Characters (Protagonist / NPC)
  return {
    modalTitle: `Retrato del Personaje: ${name}`,
    entityLabel: target.type === 'player' ? 'protagonista' : 'PNJ',
    defaultCategory: (target.type === 'player' ? 'portrait_pj' : 'portrait_npc') as FileCategory,
    subtitle: `Sube un retrato o ilustración para ${name}.`
  };
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  target,
  allImageFiles,
  onSelectImage,
  onUploadFile,
  onClose
}) => {
  const config = useMemo(() => computeTargetConfig(target), [target]);
  const [filterCategory, setFilterCategory] = useState<'all' | 'map' | 'scene' | 'portrait'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Helper to ingest and assign a File (from paste, drag or local browse)
  const processAndAssignFile = async (file: File) => {
    setIsProcessing(true);
    try {
      let finalUrl = '';
      if (onUploadFile) {
        finalUrl = await onUploadFile(file, config.defaultCategory);
      } else {
        finalUrl = await optimizeImageFile(file);
      }

      if (finalUrl) {
        onSelectImage(finalUrl);
        showToast('¡Imagen importada y asignada correctamente!', 'success');
      } else {
        showToast('No se pudo procesar el archivo de imagen.', 'error');
      }
    } catch (err) {
      console.error('Error importing image:', err);
      showToast('Error al importar la imagen.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to process an Image URL
  const processAndAssignUrl = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    setIsProcessing(true);
    try {
      let fileToUpload: File | null = null;
      try {
        const res = await fetch(trimmed);
        if (res.ok) {
          const blob = await res.blob();
          const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
          const ext = mime.split('/')[1] || 'jpg';
          const cleanName = (target.name || 'imagen').replace(/[^a-zA-Z0-9_-]/g, '_');
          fileToUpload = new File([blob], `${cleanName}_${Date.now()}.${ext}`, { type: mime });
        }
      } catch {
        // Direct fetch blocked by CORS; we will use the URL directly
      }

      if (fileToUpload) {
        await processAndAssignFile(fileToUpload);
      } else {
        // Fallback: assign directly as URL
        onSelectImage(trimmed);
        showToast('¡Enlace de imagen asignado!', 'success');
      }
      setUrlInput('');
      setShowUrlInput(false);
    } catch (err) {
      console.error('Error processing URL:', err);
      showToast('Error al procesar la URL.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Clipboard Paste listener (captures Ctrl+V anywhere in the modal)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const targetElement = e.target as HTMLElement;
      const isInput = targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA');

      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
              const cleanName = (target.name || 'imagen').replace(/[^a-zA-Z0-9_-]/g, '_');
              const file = new File([blob], `${cleanName}_pasted_${Date.now()}.png`, { type: blob.type || 'image/png' });
              await processAndAssignFile(file);
              return;
            }
          }
        }
      }

      if (!isInput) {
        const text = e.clipboardData?.getData('text');
        if (text && /^https?:\/\//i.test(text.trim())) {
          e.preventDefault();
          await processAndAssignUrl(text.trim());
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [target, config.defaultCategory, onUploadFile]);

  // Read clipboard via Clipboard API
  const handlePasteFromClipboardBtn = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const cleanName = (target.name || 'imagen').replace(/[^a-zA-Z0-9_-]/g, '_');
              const file = new File([blob], `${cleanName}_pasted_${Date.now()}.png`, { type });
              await processAndAssignFile(file);
              return;
            }
          }
        }
      }

      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && /^https?:\/\//i.test(text.trim())) {
          await processAndAssignUrl(text.trim());
          return;
        }
      }
      showToast('No se encontró una imagen en el portapapeles. Copia una imagen y presiona Ctrl + V.', 'error');
    } catch {
      showToast('Presiona Ctrl + V para pegar la imagen copiada.', 'error');
    }
  };

  const filteredImages = useMemo(() => {
    if (filterCategory === 'all') return allImageFiles;
    if (filterCategory === 'map') return allImageFiles.filter(f => f.category === 'map');
    if (filterCategory === 'scene') return allImageFiles.filter(f => f.category === 'scene');
    if (filterCategory === 'portrait') {
      return allImageFiles.filter(f => f.category === 'portrait_pj' || f.category === 'portrait_npc' || f.category === 'portrait_companion');
    }
    return allImageFiles;
  }, [allImageFiles, filterCategory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/65 flex items-center justify-center z-[70] p-3 sm:p-4 backdrop-blur-2xs"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            await processAndAssignFile(file);
          }
        }
      }}
    >
      <div className="bg-[var(--bg-color)] p-4 sm:p-6 rounded-2xl shadow-2xl border border-[var(--glass-border)] w-[640px] max-w-full font-lora max-h-[92vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Dragging Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-[var(--accent)]/20 border-2 border-dashed border-[var(--accent)] z-50 flex flex-col items-center justify-center backdrop-blur-2xs gap-2">
            <UploadCloud className="w-12 h-12 text-[var(--accent)] animate-bounce" />
            <span className="font-cinzel text-base font-bold text-[var(--text-primary)]">
              Suelta la imagen aquí para importarla y asignarla
            </span>
          </div>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 z-40 flex flex-col items-center justify-center backdrop-blur-2xs gap-2 text-white font-cinzel">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
            <span className="text-sm font-semibold">Procesando y guardando imagen...</span>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-[var(--glass-border)]">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--user-border)] text-[var(--accent)] shrink-0 shadow-2xs">
              {target.type === 'location' ? (
                <Castle className="w-5 h-5" />
              ) : target.type === 'item' ? (
                <Shield className="w-5 h-5" />
              ) : (
                <Drama className="w-5 h-5" />
              )}
            </div>
            <div>
              <h4 className="font-cinzel text-base sm:text-lg text-[var(--accent)] font-bold m-0 leading-tight">
                {config.modalTitle}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1 m-0">
                {config.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert / Toast */}
        {feedbackMsg && (
          <div
            className={`mb-3 px-3.5 py-2 rounded-xl text-xs font-cinzel font-semibold flex items-center gap-2 border transition-all ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
            }`}
          >
            {feedbackMsg.type === 'success' ? <Check className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Manual Upload Section */}
        <div className="mb-4 p-4 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded-xl space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5 uppercase tracking-wider">
              <UploadCloud className="w-4 h-4" /> Subida Manual de Imagen
            </span>
            <span className="text-[10px] bg-[var(--surface)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--user-border)] font-cinzel">
              Arrastra o pega con <kbd className="font-mono font-bold text-[var(--text-primary)]">Ctrl + V</kbd>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] rounded-lg font-cinzel text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Subir archivo desde tu ordenador"
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>Subir Archivo Local</span>
            </button>

            <button
              type="button"
              onClick={handlePasteFromClipboardBtn}
              className="px-3 py-2 bg-[var(--surface)] hover:bg-[var(--sidebar-bg)] text-[var(--text-primary)] border border-[var(--user-border)] rounded-lg font-cinzel text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Pegar imagen copiada del portapapeles"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Pegar Portapapeles</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="px-3 py-2 bg-[var(--surface)] hover:bg-[var(--sidebar-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--user-border)] rounded-lg font-cinzel text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="Pegar enlace web directo"
            >
              <Link className="w-3.5 h-3.5" />
              <span>Pegar URL</span>
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  await processAndAssignFile(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {/* Collapsible URL input */}
          {showUrlInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                processAndAssignUrl(urlInput);
              }}
              className="flex gap-2 pt-2 border-t border-[var(--glass-border)]"
            >
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="flex-1 px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] transition-all"
                autoFocus
              />
              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-50 rounded-lg font-cinzel text-xs font-bold cursor-pointer transition-all"
              >
                Asignar
              </button>
            </form>
          )}
        </div>

        {/* Campaign Files Selector */}
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[var(--accent)]" /> Galería de la Campaña ({filteredImages.length})
          </span>
          <div className="flex gap-1 text-[11px] font-cinzel">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                filterCategory === 'all'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
              }`}
            >
              Todas
            </button>
            {target.type === 'location' ? (
              <>
                <button
                  type="button"
                  onClick={() => setFilterCategory('map')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                    filterCategory === 'map'
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                  }`}
                >
                  Mapas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('scene')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                    filterCategory === 'scene'
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                  }`}
                >
                  Escenas
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setFilterCategory('portrait')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                  filterCategory === 'portrait'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                }`}
              >
                Retratos
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 min-h-[150px]">
          {filteredImages.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-[var(--text-secondary)] italic bg-[var(--surface-soft)] rounded-xl border border-[var(--user-border)] leading-relaxed">
              No hay imágenes en esta categoría. Puedes subir un archivo local o arrastrar una imagen para asignarla.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => onSelectImage(img.content)}
                  className="group bg-[var(--surface)] rounded-xl border border-[var(--user-border)] overflow-hidden cursor-pointer hover:border-[var(--accent)] hover:shadow-md transition-all flex flex-col"
                >
                  <div className="h-28 bg-black/5 overflow-hidden flex items-center justify-center relative">
                    <img
                      src={img.content}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-cinzel font-bold gap-1">
                      <Check className="w-3.5 h-3.5" /> Seleccionar
                    </div>
                  </div>
                  <div
                    className="p-2 text-[11px] font-cinzel font-bold truncate text-[var(--text-primary)] bg-[var(--sidebar-bg)] border-t border-[var(--user-border)]"
                    title={img.name}
                  >
                    {img.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 mt-4 pt-3 border-t border-[var(--glass-border)]">
          <button
            onClick={() => onSelectImage('')}
            className="px-3.5 py-1.5 text-xs font-cinzel text-red-700 dark:text-red-400 hover:text-red-900 border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-all"
          >
            Quitar Imagen
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
