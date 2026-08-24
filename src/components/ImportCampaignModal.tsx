import React, { useState, useRef } from "react";
import {
  FileText,
  Upload,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Heart,
  Shield,
  Layers,
  Compass,
  FileCode,
  RefreshCw,
  FolderPlus,
} from "lucide-react";
import { Project } from "../types";
import {
  readRawFileText,
  importCampaignWithGemini,
  ExtractedCampaignResult,
} from "../utils/campaignImporter";
import { hasConfiguredApiKey } from "../utils/geminiHelper";

interface ImportCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: Project | null;
  onConfirmImport: (
    extracted: ExtractedCampaignResult,
    mode: "new" | "merge",
  ) => Promise<void>;
  onImportNativeFile?: (file: File) => Promise<void>;
}

export const ImportCampaignModal: React.FC<ImportCampaignModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  onConfirmImport,
  onImportNativeFile,
}) => {
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [pastedText, setPastedText] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] =
    useState<ExtractedCampaignResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edit fields in preview
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewCharName, setPreviewCharName] = useState("");
  const [previewCharClass, setPreviewCharClass] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessStep("Leyendo archivo y comprobando formato...");

    try {
      const { text, isPdf, isJson } = await readRawFileText(file);
      if (!text || text.trim().length < 15) {
        throw new Error(
          isPdf
            ? "No se pudo extraer texto del PDF (puede estar escaneado o protegido)."
            : "El archivo está vacío o no contiene texto legible.",
        );
      }

      // Comprobación inteligente de copia nativa de GM Studio
      if (isJson || file.name.toLowerCase().endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          if (
            (parsed.name &&
              (parsed.chats ||
                parsed.memory ||
                parsed.instructions !== undefined)) ||
            (parsed.version === "gmstudio_v2" && Array.isArray(parsed.projects))
          ) {
            if (onImportNativeFile) {
              await onImportNativeFile(file);
              onClose();
              return;
            }
          }
        } catch {
          // No es JSON nativo estricto, continuar con extracción asistida por IA
        }
      }

      setProcessStep("Extrayendo texto del documento...");
      await runExtraction(text, file.name.replace(/\.[^/.]+$/, ""));
    } catch (err: any) {
      console.error("Error procesando archivo:", err);
      setErrorMessage(err?.message || "Error al procesar el archivo.");
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
    }
  };

  const handleProcessPastedText = async () => {
    if (!pastedText.trim() || pastedText.trim().length < 20) {
      setErrorMessage(
        "Por favor, pega el texto de tu chat o cuaderno de NotebookLM.",
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessStep("Procesando texto ingresado...");

    try {
      await runExtraction(pastedText, pastedTitle.trim() || undefined);
    } catch (err: any) {
      console.error("Error procesando texto pegado:", err);
      setErrorMessage(err?.message || "Error al procesar el texto.");
    } finally {
      setIsProcessing(false);
      setProcessStep(null);
    }
  };

  const runExtraction = async (rawText: string, preferredTitle?: string) => {
    if (!hasConfiguredApiKey()) {
      throw new Error(
        "Para importar y reconstruir la campaña debes configurar tu clave de API de Gemini en Ajustes de Motor (icono de deslizadores).",
      );
    }
    setProcessStep(
      "Gemini IA analizando capítulos, protagonistas, PNJs, afinidad y misiones...",
    );
    const result = await importCampaignWithGemini(rawText, preferredTitle);

    setExtractedResult(result);
    setPreviewTitle(result.project.name);
    setPreviewCharName(
      result.project.memory.player_character?.name || "Protagonista",
    );
    setPreviewCharClass(
      result.project.memory.player_character?.class || "Aventurero",
    );
  };

  const handleConfirm = async (mode: "new" | "merge") => {
    if (!extractedResult) return;
    setIsSaving(true);
    try {
      // Apply any title or char edits made in preview
      const updatedProject = {
        ...extractedResult.project,
        name: previewTitle.trim() || extractedResult.project.name,
        memory: {
          ...extractedResult.project.memory,
          player_character: extractedResult.project.memory.player_character
            ? {
                ...extractedResult.project.memory.player_character,
                name:
                  previewCharName.trim() ||
                  extractedResult.project.memory.player_character.name,
                class:
                  previewCharClass.trim() ||
                  extractedResult.project.memory.player_character.class,
              }
            : undefined,
        },
      };

      const finalResult: ExtractedCampaignResult = {
        ...extractedResult,
        project: updatedProject,
      };

      await onConfirmImport(finalResult, mode);
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message || "No se pudo guardar la campaña importada.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[110] p-3 md:p-4 overflow-y-auto animate-[fadeIn_0.15s_ease]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--surface)] w-full max-w-3xl rounded-xl border border-[var(--accent)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Modal Header */}
        <div className="p-4 bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] border-b border-[var(--accent)]/30 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-base md:text-lg font-bold text-[var(--accent)] m-0 flex items-center gap-2">
                <span>Importar Campaña Externa</span>
                <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)]">
                  Gemini & NotebookLM
                </span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)] m-0 font-lora">
                Convierte PDFs de chats, cuadernos de NotebookLM o
                transcripciones en un Tomo vivo con ficha, PNJs y capítulos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--accent)] p-1 rounded cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 md:p-5 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1">
                <p className="font-bold font-cinzel m-0">
                  Error en la importación
                </p>
                <p className="m-0 mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {!extractedResult ? (
            <>
              {/* Tabs: Subir Archivo vs Pegar Texto */}
              <div className="flex border-b border-[var(--user-border)] gap-2">
                <button
                  onClick={() => setTab("upload")}
                  className={`pb-2 px-3 text-xs font-cinzel font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    tab === "upload"
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Subir PDF / Documento</span>
                </button>
                <button
                  onClick={() => setTab("paste")}
                  className={`pb-2 px-3 text-xs font-cinzel font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    tab === "paste"
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Pegar Texto de NotebookLM / Chat</span>
                </button>
              </div>

              {tab === "upload" ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      void handleProcessFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-[var(--accent)]/40 hover:border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_4%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
                >
                  <div className="p-3.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-cinzel text-sm font-bold text-[var(--accent)] m-0">
                      Haz clic o arrastra aquí tu archivo
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] m-0 mt-1 font-lora">
                      Soporta PDFs descargados de <strong>Gemini</strong>,
                      cuadernos de <strong>NotebookLM</strong>, archivos{" "}
                      <strong>.MD</strong>, <strong>.TXT</strong> o{" "}
                      <strong>.JSON</strong>.
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.txt,.md,.markdown,.json,.gmstudio.json,application/json,application/pdf,text/*,*/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        void handleProcessFile(e.target.files[0]);
                      }
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[10px] text-[var(--text-secondary)] font-mono">
                    <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--user-border)] rounded">
                      .PDF
                    </span>
                    <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--user-border)] rounded">
                      .MD / Markdown
                    </span>
                    <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--user-border)] rounded">
                      .TXT
                    </span>
                    <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--user-border)] rounded">
                      .JSON
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                      Título sugerido para la Campaña (Opcional)
                    </label>
                    <input
                      type="text"
                      value={pastedTitle}
                      onChange={(e) => setPastedTitle(e.target.value)}
                      placeholder="p. ej. Las Crónicas de Luskan, El Pozo de la Ruina..."
                      className="w-full p-2.5 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded-lg text-xs font-cinzel outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                      Texto del Chat de Gemini o Cuaderno de NotebookLM
                    </label>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      rows={10}
                      placeholder="Pega aquí la transcripción completa de tu partida de Gemini, notas de sesión, guía de estudio de NotebookLM o historia..."
                      className="w-full p-3 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded-lg text-xs font-mono outline-none focus:border-[var(--accent)] resize-y leading-relaxed"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleProcessPastedText}
                      disabled={isProcessing || !pastedText.trim()}
                      className="px-4 py-2 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg font-cinzel font-bold text-xs flex items-center gap-2 hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Analizar e Importar Texto</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Tarjeta de Pergamino con la Vista Previa de la Campaña Extraída */
            <div className="space-y-4 animate-[fadeIn_0.2s_ease]">
              <div className="bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] border-2 border-[var(--accent)]/50 rounded-xl p-4 md:p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-[var(--accent)]/30 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <h3 className="font-cinzel text-base font-bold text-[var(--accent)] m-0">
                        Campaña Reconstruida con Éxito
                      </h3>
                      <p className="text-[11px] text-[var(--text-secondary)] m-0 font-lora">
                        Revisa los datos extraídos antes de incorporar el Tomo a
                        tu biblioteca.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExtractedResult(null)}
                    className="text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Cambiar archivo</span>
                  </button>
                </div>

                {/* Campos editables principales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-cinzel font-bold text-[var(--text-secondary)] uppercase block mb-1">
                      Nombre del Tomo / Campaña
                    </label>
                    <input
                      type="text"
                      value={previewTitle}
                      onChange={(e) => setPreviewTitle(e.target.value)}
                      className="w-full p-2 bg-[var(--surface)] border border-[var(--accent)]/40 rounded text-xs font-cinzel font-bold text-[var(--accent)] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-cinzel font-bold text-[var(--text-secondary)] uppercase block mb-1">
                      Protagonista & Clase
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={previewCharName}
                        onChange={(e) => setPreviewCharName(e.target.value)}
                        placeholder="Nombre"
                        className="w-1/2 p-2 bg-[var(--surface)] border border-[var(--accent)]/40 rounded text-xs font-cinzel font-semibold outline-none"
                      />
                      <input
                        type="text"
                        value={previewCharClass}
                        onChange={(e) => setPreviewCharClass(e.target.value)}
                        placeholder="Clase"
                        className="w-1/2 p-2 bg-[var(--surface)] border border-[var(--accent)]/40 rounded text-xs font-cinzel outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Métricas y Contadores */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg">
                    <div className="font-mono font-bold text-base text-[var(--accent)]">
                      {extractedResult.summary.chaptersCount}
                    </div>
                    <div className="text-[10px] font-cinzel text-[var(--text-secondary)] flex items-center justify-center gap-1 mt-0.5">
                      <Layers className="w-3 h-3" />
                      <span>Capítulos</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg">
                    <div className="font-mono font-bold text-base text-[var(--accent)]">
                      {extractedResult.summary.messagesCount}
                    </div>
                    <div className="text-[10px] font-cinzel text-[var(--text-secondary)] flex items-center justify-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3" />
                      <span>Mensajes</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg">
                    <div className="font-mono font-bold text-base text-rose-600 dark:text-rose-400">
                      {extractedResult.summary.npcsCount}
                    </div>
                    <div className="text-[10px] font-cinzel text-[var(--text-secondary)] flex items-center justify-center gap-1 mt-0.5">
                      <Heart className="w-3 h-3 text-rose-500" />
                      <span>PNJs con Afinidad</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg">
                    <div className="font-mono font-bold text-base text-amber-600 dark:text-amber-400">
                      {extractedResult.summary.questsCount}
                    </div>
                    <div className="text-[10px] font-cinzel text-[var(--text-secondary)] flex items-center justify-center gap-1 mt-0.5">
                      <Compass className="w-3 h-3 text-amber-500" />
                      <span>Misiones</span>
                    </div>
                  </div>
                </div>

                {/* PNJs Detectados con Ejes de Afinidad */}
                {extractedResult.project.memory.npcs.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                      Personajes Clave Detectados (
                      {extractedResult.project.memory.npcs.length})
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {extractedResult.project.memory.npcs.map((npc) => (
                        <div
                          key={npc.id}
                          className="p-2 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg text-xs flex flex-col justify-between gap-1"
                        >
                          <div className="flex justify-between items-baseline">
                            <span className="font-cinzel font-bold text-[var(--accent)] truncate">
                              {npc.name}
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)] font-lora italic shrink-0">
                              {npc.relation || "PNJ"}
                            </span>
                          </div>
                          {(npc.atr !== undefined ||
                            npc.vin !== undefined ||
                            npc.con !== undefined) && (
                            <div className="flex items-center gap-2 text-[9px] font-mono font-bold pt-1 border-t border-[var(--user-border)]/50">
                              <span
                                className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5"
                                title="Atracción"
                              >
                                <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />{" "}
                                ATR: {npc.atr ?? 0}/20
                              </span>
                              <span
                                className="text-teal-600 dark:text-teal-400 flex items-center gap-0.5"
                                title="Vínculo"
                              >
                                <Sparkles className="w-2.5 h-2.5 text-teal-500" />{" "}
                                VÍN: {npc.vin ?? 0}/20
                              </span>
                              <span
                                className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5"
                                title="Confianza"
                              >
                                <Shield className="w-2.5 h-2.5 text-amber-500" />{" "}
                                CON: {npc.con ?? 0}/20
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumen de Trama */}
                {extractedResult.project.memory.story && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                      Sinopsis de la Memoria
                    </label>
                    <p className="text-xs text-[var(--text-primary)] bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--user-border)] italic leading-relaxed m-0 max-h-24 overflow-y-auto">
                      {extractedResult.project.memory.story}
                    </p>
                  </div>
                )}
              </div>

              {/* Botones de Confirmación */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--user-border)] rounded-lg font-cinzel text-xs cursor-pointer"
                >
                  Cancelar
                </button>

                {currentProject && (
                  <button
                    type="button"
                    onClick={() => handleConfirm("merge")}
                    disabled={isSaving}
                    className="px-4 py-2.5 bg-[color-mix(in_srgb,var(--accent)_15%,var(--surface))] text-[var(--accent)] border border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_25%,var(--surface))] rounded-lg font-cinzel font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Fusionar en Tomo Actual</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleConfirm("new")}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 rounded-lg font-cinzel font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Crear como Nuevo Tomo</span>
                </button>
              </div>
            </div>
          )}

          {/* Loader Overlay durante procesamiento */}
          {isProcessing && (
            <div className="p-8 text-center space-y-3 bg-[var(--surface)] rounded-xl border border-[var(--accent)]/40 shadow-inner">
              <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-cinzel text-sm font-bold text-[var(--accent)] m-0">
                {processStep || "Procesando campaña..."}
              </p>
              <p className="text-xs text-[var(--text-secondary)] font-lora m-0 max-w-md mx-auto">
                Extrayendo estructura narrativa, personajes, trasfondo y
                diálogos para dejarlos listos en tu biblioteca.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
