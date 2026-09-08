import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectFile, FileCategory } from '../types';
import { optimizeImageFile } from '../utils/fileStorage';
import {
  buildArtNouveauUnifiedPrompt,
  generateImageWithFailover
} from '../utils/geminiHelper';
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
  Sparkles,
  Wand2,
  Palette,
  RefreshCw,
  User,
  Mountain,
  AlertCircle
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
  initialTab?: 'ai' | 'gallery' | 'upload';
}

function computeTargetConfig(target: ImagePickerTarget) {
  const rawName = (target.name || '').trim();
  const name = rawName || (target.type === 'location' ? 'Lugar' : target.type === 'item' ? 'Objeto' : 'Personaje');

  if (target.type === 'location') {
    return {
      modalTitle: `Ilustración o Mapa: ${name}`,
      entityLabel: 'lugar o escenario',
      defaultCategory: 'map' as FileCategory,
      subtitle: `Crea con IA o asigna un arte para ${name}.`,
      defaultSubjectMode: 'location' as const
    };
  }

  if (target.type === 'item') {
    return {
      modalTitle: `Ilustración de Objeto: ${name}`,
      entityLabel: 'objeto o equipamiento',
      defaultCategory: 'scene' as FileCategory,
      subtitle: `Crea con IA o asigna un arte para ${name}.`,
      defaultSubjectMode: 'scene' as const
    };
  }

  // Characters (Protagonist / NPC)
  return {
    modalTitle: `Retrato del Personaje: ${name}`,
    entityLabel: target.type === 'player' ? 'protagonista' : 'PNJ',
    defaultCategory: (target.type === 'player' ? 'portrait_pj' : 'portrait_npc') as FileCategory,
    subtitle: `Genera un retrato Art Nouveau con IA o sube una imagen para ${name}.`,
    defaultSubjectMode: 'character' as const
  };
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  target,
  allImageFiles,
  onSelectImage,
  onUploadFile,
  onClose,
  initialTab = 'ai'
}) => {
  const config = useMemo(() => computeTargetConfig(target), [target]);
  const [activeTab, setActiveTab] = useState<'ai' | 'gallery' | 'upload'>(initialTab);
  const [filterCategory, setFilterCategory] = useState<'all' | 'map' | 'scene' | 'portrait'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Generation State
  const [aiSubjectMode, setAiSubjectMode] = useState<'character' | 'location' | 'scene'>(config.defaultSubjectMode);
  const [aiAspectRatio, setAiAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '16:9'>(
    target.type === 'location' ? '4:3' : target.type === 'item' ? '1:1' : '3:4'
  );
  const [extraDetails, setExtraDetails] = useState('');
  const [aiPrompt, setAiPrompt] = useState(() =>
    buildArtNouveauUnifiedPrompt({
      subjectType: config.defaultSubjectMode,
      name: target.name,
      description: target.desc || '',
      extraDetails: '',
      archetype: config.defaultSubjectMode === 'character' ? 'portrait' : config.defaultSubjectMode
    })
  );
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [generatedAiImage, setGeneratedAiImage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Update prompt when subject mode or extra details change
  const handleRegeneratePrompt = (newMode?: 'character' | 'location' | 'scene', newDetails?: string) => {
    const mode = newMode !== undefined ? newMode : aiSubjectMode;
    const details = newDetails !== undefined ? newDetails : extraDetails;
    const p = buildArtNouveauUnifiedPrompt({
      subjectType: mode,
      name: target.name,
      description: target.desc || '',
      extraDetails: details,
      archetype: mode === 'character' ? 'portrait' : mode
    });
    setAiPrompt(p);
  };

  const handleGenerateAiImage = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const dataUrl = await generateImageWithFailover({
        prompt: aiPrompt,
        aspectRatio: aiAspectRatio
      });
      setGeneratedAiImage(dataUrl);
      showToast('¡Ilustración Art Nouveau generada con éxito!', 'success');
    } catch (err: any) {
      console.error('Error generando ilustración con IA:', err);
      const msg = err?.message || 'Error al invocar el modelo de imagen. Revisa tu clave de API en Configuración.';
      setAiError(msg);
      showToast('Fallo al generar imagen. Comprueba la clave de API.', 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Assign the AI generated image and save it into campaign files
  const handleAssignGeneratedImage = async () => {
    if (!generatedAiImage) return;
    setIsProcessing(true);
    try {
      let finalUrl = generatedAiImage;
      if (onUploadFile) {
        try {
          const res = await fetch(generatedAiImage);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1] || 'jpg';
          const cleanName = (target.name || 'arte').replace(/[^a-zA-Z0-9_-]/g, '_');
          const file = new File([blob], `${cleanName}_art_nouveau_${Date.now()}.${ext}`, { type: blob.type });
          finalUrl = await onUploadFile(file, config.defaultCategory);
        } catch {
          // fallback to data url
        }
      }
      onSelectImage(finalUrl);
      showToast('¡Arte asignado a la ficha con éxito!', 'success');
      onClose();
    } catch (err) {
      console.error('Error assigning generated image:', err);
      onSelectImage(generatedAiImage);
      onClose();
    } finally {
      setIsProcessing(false);
    }
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
      <div className="bg-[var(--bg-color)] p-4 sm:p-6 rounded-2xl shadow-2xl border border-[var(--glass-border)] w-[720px] max-w-full font-lora max-h-[92vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 m-0">
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 mb-3 border-b border-[var(--user-border)] pb-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 rounded-lg font-cinzel text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>🎨 Generar con IA</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/25 text-amber-900 dark:text-amber-200 uppercase font-mono font-bold tracking-wider">
              Art Nouveau
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`px-3 py-1.5 rounded-lg font-cinzel text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'gallery'
                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Galería del Tomo ({allImageFiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg font-cinzel text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Subir / Pegar</span>
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

        {/* TAB 1: GENERACIÓN CON IA (ESTILO UNIFICADO ART NOUVEAU & ANIMACIÓN) */}
        {activeTab === 'ai' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-3.5">
            {/* Aesthetic Banner */}
            <div className="p-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-amber-500/10 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Estilo Visual Unificado de Campaña
                </span>
                <span className="text-[10px] font-cinzel font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                  Art Nouveau & Animación YA
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed m-0">
                Líneas sinuosas estilo Alphonse Mucha, planos de color estilizados de animación moderna para adultos (Arcane, Castlevania) y paleta cálida con tonos joya (oro bruñido, esmeralda, añil).
              </p>
            </div>

            {/* Subject Mode Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-cinzel font-bold text-[var(--text-primary)]">
                1. Tipo de Ilustración:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'character' as const, label: 'Retrato de Personaje', icon: User, ratio: '3:4' as const },
                  { id: 'location' as const, label: 'Lugar o Arquitectura', icon: Castle, ratio: '4:3' as const },
                  { id: 'scene' as const, label: 'Escenario Panorámico', icon: Mountain, ratio: '16:9' as const }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = aiSubjectMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setAiSubjectMode(item.id);
                        setAiAspectRatio(item.ratio);
                        handleRegeneratePrompt(item.id, extraDetails);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] ring-1 ring-[var(--accent)]'
                          : 'border-[var(--user-border)] bg-[var(--surface-soft)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-cinzel font-bold text-[var(--text-primary)]">
                        <Icon className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {item.id === 'character' ? 'Busto con orla Mucha' : item.id === 'location' ? 'Arcos y vitrales' : 'Composición cinemática'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-cinzel font-bold text-[var(--text-primary)]">
                2. Formato / Proporción:
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: '3:4' as const, label: '3:4 (Retrato Clásico)', desc: 'Ideal para personajes' },
                  { id: '1:1' as const, label: '1:1 (Cuadrado / Token)', desc: 'Fichas y avatares' },
                  { id: '4:3' as const, label: '4:3 (Lugar / Estancia)', desc: 'Edificios e interiores' },
                  { id: '16:9' as const, label: '16:9 (Panorámico)', desc: 'Vistas cinemáticas' }
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setAiAspectRatio(r.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-cinzel font-semibold border transition-all cursor-pointer ${
                      aiAspectRatio === r.id
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-2xs'
                        : 'border-[var(--user-border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title={r.desc}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra Details Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-cinzel font-bold text-[var(--text-primary)]">
                  3. Rasgos visuales o detalles específicos (opcional):
                </label>
                <button
                  type="button"
                  onClick={() => handleRegeneratePrompt(aiSubjectMode, extraDetails)}
                  className="text-[11px] font-cinzel text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Reconstruir Prompt
                </button>
              </div>
              <input
                type="text"
                value={extraDetails}
                onChange={e => {
                  setExtraDetails(e.target.value);
                  handleRegeneratePrompt(aiSubjectMode, e.target.value);
                }}
                placeholder="Ej: capa de terciopelo esmeralda, filigrana dorada, ojos plateados, luna llena..."
                className="w-full bg-[var(--surface-soft)] border border-[var(--user-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Prompt Editor */}
            <div className="space-y-1.5">
              <label className="block text-xs font-cinzel font-bold text-[var(--text-primary)]">
                4. Prompt Maestro Art Nouveau (editable):
              </label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                rows={3}
                className="w-full bg-[var(--surface-soft)] border border-[var(--user-border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono leading-relaxed"
              />
            </div>

            {/* Error banner if any */}
            {aiError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-cinzel font-bold">No se pudo completar la generación:</div>
                  <div className="leading-relaxed">{aiError}</div>
                  <div className="text-[11px] opacity-85">
                    Consejo: Abre la rueda de Configuración para verificar que tu clave de API de Gemini esté activa.
                  </div>
                </div>
              </div>
            )}

            {/* Generated Image Preview or Generate Trigger */}
            <div className="p-3 rounded-xl border border-[var(--user-border)] bg-[var(--surface)] space-y-3">
              {generatedAiImage ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative group rounded-xl overflow-hidden border-2 border-[var(--accent)] shadow-lg max-w-[180px] shrink-0 bg-black/10">
                      <img
                        src={generatedAiImage}
                        alt="Ilustración Art Nouveau generada"
                        className="w-full h-auto object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="space-y-2 text-center sm:text-left flex-1">
                      <div className="text-xs font-cinzel font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 justify-center sm:justify-start">
                        <Check className="w-4 h-4" /> Ilustración Art Nouveau Creada
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed m-0">
                        La obra conserva la unidad estética canónica de la campaña y está lista para vincularse a la ficha y archivarse en el tomo.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={handleAssignGeneratedImage}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] rounded-lg font-cinzel text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span>Asignar como Retrato / Imagen</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateAiImage}
                          disabled={isGeneratingAi}
                          className="px-3 py-2 bg-[var(--surface-soft)] hover:bg-[var(--sidebar-bg)] text-[var(--text-primary)] border border-[var(--user-border)] rounded-lg font-cinzel text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>Generar otra variante</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-[var(--text-secondary)]">
                    Pulsa para invocar el modelo de generación de imagen con la estética Art Nouveau & Animación YA.
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiImage}
                    disabled={isGeneratingAi || !aiPrompt.trim()}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--on-accent)] rounded-xl font-cinzel text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
                  >
                    {isGeneratingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Dibujando con IA...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>Generar con IA (Art Nouveau)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GALERÍA DEL TOMO */}
        {activeTab === 'gallery' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <div className="flex items-center justify-between mb-2 px-0.5 shrink-0">
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

            {/* Grid */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-[150px]">
              {filteredImages.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-[var(--text-secondary)] italic bg-[var(--surface-soft)] rounded-xl border border-[var(--user-border)] leading-relaxed">
                  No hay imágenes en esta categoría. Puedes generar una con IA en la pestaña anterior o subir un archivo local.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredImages.map(img => (
                    <div
                      key={img.id}
                      onClick={() => {
                        onSelectImage(img.content);
                        onClose();
                      }}
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
          </div>
        )}

        {/* TAB 3: SUBIR O PEGAR IMAGEN LOCAL / URL */}
        {activeTab === 'upload' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="p-4 bg-[var(--surface-soft)] border border-[var(--user-border)] rounded-xl space-y-3 shadow-2xs">
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
                    className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-50 rounded-lg font-cinzel text-xs font-bold cursor-pointer transition-all"
                  >
                    Asignar
                  </button>
                </form>
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
            className="px-3 py-1.5 text-xs font-cinzel text-red-700 dark:text-red-400 hover:text-red-900 border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-all"
          >
            Quitar Imagen
          </button>
          <button
            type="button"
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
