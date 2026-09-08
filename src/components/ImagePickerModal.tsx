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
  initialTab?: 'upload' | 'gallery';
}

function computeTargetConfig(target: ImagePickerTarget) {
  const rawName = (target.name || '').trim();
  const name = rawName || (target.type === 'location' ? 'Lugar' : target.type === 'item' ? 'Objeto' : 'Personaje');

  if (target.type === 'location') {
    return {
      modalTitle: `Ilustración o Mapa: ${name}`,
      entityLabel: 'lugar o escenario',
      defaultCategory: 'map' as FileCategory,
      subtitle: `Sube o selecciona una imagen o mapa para ${name}.`
    };
  }

  if (target.type === 'item') {
    return {
      modalTitle: `Ilustración de Objeto: ${name}`,
      entityLabel: 'objeto o equipamiento',
      defaultCategory: 'scene' as FileCategory,
      subtitle: `Sube o selecciona una ilustración para ${name}.`
    };
  }

  // Characters (Protagonist / NPC)
  return {
    modalTitle: `Retrato del Personaje: ${name}`,
    entityLabel: target.type === 'player' ? 'protagonista' : 'PNJ',
    defaultCategory: (target.type === 'player' ? 'portrait_pj' : 'portrait_npc') as FileCategory,
    subtitle: `Sube una imagen o selecciona un retrato para ${name}.`
  };
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  target,
  allImageFiles,
  onSelectImage,
  onUploadFile,
  onClose,
  initialTab = 'upload'
}) => {
  const config = useMemo(() => computeTargetConfig(target), [target]);
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery'>(initialTab);
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
        onClose();
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
        // Direct fetch blocked by CORS
      }

      if (fileToUpload) {
        await processAndAssignFile(fileToUpload);
      } else {
        onSelectImage(trimmed);
        showToast('¡Enlace de imagen asignado!', 'success');
        onClose();
      }
      setUrlInput('');
      setShowUrlInput(false);
    } catch (err) {
      console.error('Error processing URL image:', err);
      showToast('No se pudo cargar la imagen desde el enlace.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Clipboard paste button handler
  const handlePasteFromClipboardBtn = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            if (blob) {
              const ext = imageType.split('/')[1] || 'png';
              const cleanName = (target.name || 'portapapeles').replace(/[^a-zA-Z0-9_-]/g, '_');
              const file = new File([blob], `${cleanName}_paste_${Date.now()}.${ext}`, { type: imageType });
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
      return allImageFiles.filter(
        f => f.category === 'portrait_pj' || f.category === 'portrait_npc' || f.category === 'portrait_companion'
      );
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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-3 sm:p-4 backdrop-blur-2xs"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onDragOver={e => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async e => {
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
      <div className="bg-[var(--bg-color)] p-4 sm:p-6 rounded-2xl shadow-2xl border border-[var(--glass-border)] w-[680px] max-w-full font-lora max-h-[92vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
            <span className="text-sm font-semibold">Guardando y asignando imagen a la campaña...</span>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start mb-3 pb-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--user-border)] text-[var(--accent)] shrink-0 shadow-2xs">
              {target.type === 'location' ? (
                <Castle className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : target.type === 'item' ? (
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Drama className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-cinzel text-sm sm:text-lg text-[var(--accent)] font-bold m-0 leading-tight truncate sm:whitespace-normal">
                {config.modalTitle}
              </h4>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5 m-0 line-clamp-1 sm:line-clamp-none">
                {config.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer shrink-0 ml-1"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-3.5 border-b border-[var(--user-border)] pb-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-1.5 rounded-lg font-cinzel text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'upload'
                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
            <span>Subir / Pegar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`px-3.5 py-1.5 rounded-lg font-cinzel text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'gallery'
                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Galería de la Campaña ({allImageFiles.length})</span>
          </button>
        </div>

        {/* Feedback Alert / Toast */}
        {feedbackMsg && (
          <div
            className={`mb-3 px-3.5 py-2 rounded-xl text-xs font-cinzel font-semibold flex items-center gap-2 border transition-all shrink-0 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
            }`}
          >
            {feedbackMsg.type === 'success' ? <Check className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* TAB 1: SUBIR O PEGAR IMAGEN LOCAL / URL */}
        {activeTab === 'upload' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {/* Drag and drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--user-border)] hover:border-[var(--accent)] bg-[var(--surface-soft)] hover:bg-[var(--surface)] p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group shadow-2xs"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--surface)] group-hover:bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-2.5 transition-colors border border-[var(--user-border)] group-hover:border-[var(--accent)]">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="font-cinzel text-sm sm:text-base font-bold text-[var(--text-primary)] mb-1">
                Pulsa aquí o arrastra un archivo de imagen
              </p>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm">
                Formatos compatibles: JPG, PNG, WebP o GIF. La imagen se optimizará automáticamente para la ficha.
              </p>
            </div>

            {/* Quick Actions (Browse, Paste, URL) */}
            <div className="p-3.5 sm:p-4 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded-xl space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5 uppercase tracking-wider">
                  <FileImage className="w-4 h-4 shrink-0" />
                  <span>Otras formas de asignación rápida</span>
                </span>
                <span className="text-[10px] bg-[var(--surface)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--user-border)] font-cinzel w-fit">
                  Pega directamente con <kbd className="font-mono font-bold text-[var(--text-primary)]">Ctrl + V</kbd>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-3.5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] rounded-lg font-cinzel text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Subir archivo desde tu ordenador"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>Explorar Archivos</span>
                </button>

                <button
                  type="button"
                  onClick={handlePasteFromClipboardBtn}
                  className="w-full sm:w-auto px-3 py-2 bg-[var(--surface)] hover:bg-[var(--sidebar-bg)] text-[var(--text-primary)] border border-[var(--user-border)] rounded-lg font-cinzel text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Pegar imagen copiada del portapapeles"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Pegar Portapapeles</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="w-full sm:w-auto px-3 py-2 bg-[var(--surface)] hover:bg-[var(--sidebar-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--user-border)] rounded-lg font-cinzel text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
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
                  onChange={async e => {
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
                  onSubmit={e => {
                    e.preventDefault();
                    processAndAssignUrl(urlInput);
                  }}
                  className="flex gap-2 pt-2 border-t border-[var(--glass-border)]"
                >
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    className="flex-1 px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] transition-all"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!urlInput.trim()}
                    className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-50 rounded-lg font-cinzel text-xs font-bold cursor-pointer transition-all whitespace-nowrap"
                  >
                    Asignar
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GALERÍA DE LA CAMPAÑA */}
        {activeTab === 'gallery' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2 px-0.5 shrink-0">
              <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                <span>Imágenes de Campaña ({filteredImages.length})</span>
              </span>
              <div className="flex flex-wrap items-center gap-1 text-[11px] font-cinzel">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-all whitespace-nowrap ${
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
                      className={`px-2.5 py-1 rounded-md cursor-pointer transition-all whitespace-nowrap ${
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
                      className={`px-2.5 py-1 rounded-md cursor-pointer transition-all whitespace-nowrap ${
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
                    className={`px-2.5 py-1 rounded-md cursor-pointer transition-all whitespace-nowrap ${
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

            {/* Grid */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-[160px]">
              {filteredImages.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-[var(--text-secondary)] italic bg-[var(--surface-soft)] rounded-xl border border-[var(--user-border)] leading-relaxed">
                  No hay imágenes guardadas en esta categoría. Puedes subir una imagen o arrastrarla desde la pestaña «Subir / Pegar».
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {filteredImages.map(img => (
                    <div
                      key={img.id}
                      onClick={() => {
                        onSelectImage(img.content);
                        onClose();
                      }}
                      className="group bg-[var(--surface)] rounded-xl border border-[var(--user-border)] overflow-hidden cursor-pointer hover:border-[var(--accent)] hover:shadow-md transition-all flex flex-col"
                    >
                      <div className="h-28 sm:h-32 bg-black/5 overflow-hidden flex items-center justify-center relative">
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
                        className="p-1.5 sm:p-2 text-[10px] sm:text-[11px] font-cinzel font-bold truncate text-[var(--text-primary)] bg-[var(--sidebar-bg)] border-t border-[var(--user-border)]"
                        title={img.name}
                      >
                        {img.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 mt-3 pt-3 border-t border-[var(--glass-border)] shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectImage('');
              onClose();
            }}
            className="px-3 py-1.5 text-xs font-cinzel text-red-700 dark:text-red-400 hover:text-red-900 border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-all whitespace-nowrap"
          >
            Quitar Imagen
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface)] cursor-pointer transition-all whitespace-nowrap"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
