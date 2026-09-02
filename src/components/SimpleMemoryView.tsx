import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, Memory, ProjectMemoryEdit, Chat, ProjectFile } from '../types';
import {
  ScrollText,
  Trash2,
  Edit2,
  Check,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Copy,
  Sliders,
  FileText
} from 'lucide-react';
import { generateClaudeProjectMemory } from '../utils/geminiHelper';

interface SimpleMemoryViewProps {
  project: Project;
  chats?: Chat[];
  files?: ProjectFile[];
  onUpdateMemory: (updater: (prev: Memory) => Memory) => Promise<void>;
  onUpdateProject?: (fields: Partial<Project> | ((prev: Project) => Partial<Project>)) => Promise<void>;
  onTriggerAIUpdate?: () => void;
  isGenerating?: boolean;
}

export const SimpleMemoryView: React.FC<SimpleMemoryViewProps> = ({
  project,
  chats = [],
  files = [],
  onUpdateMemory,
  isGenerating = false
}) => {
  const memory: Memory = project.memory || {
    story: '',
    current_status: '',
    manual_notes: '',
    quests: [],
    npcs: [],
    locations: []
  };

  // Sub-view: 'view' | 'edit' | 'manage_edits'
  const [memorySubView, setMemorySubView] = useState<'view' | 'edit' | 'manage_edits'>('view');
  
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [isCopiedRecently, setIsCopiedRecently] = useState(false);
  const [isLocalUpdating, setIsLocalUpdating] = useState(false);

  // Raw text editor state
  const rawMemoryText = memory.raw_project_memory || '';
  const [editableMemoryText, setEditableMemoryText] = useState(rawMemoryText);

  // Directive inputs ("Dile a la IA qué recordar u olvidar...")
  const [directiveInput, setDirectiveInput] = useState('');
  const [newManualEditInput, setNewManualEditInput] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditableMemoryText(memory.raw_project_memory || '');
  }, [memory.raw_project_memory]);

  const handleFieldChange = (field: keyof Memory, val: any) => {
    onUpdateMemory(prev => ({
      ...prev,
      [field]: val
    }));
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2000);
  };

  const handleSaveEditableMemory = () => {
    handleFieldChange('raw_project_memory', editableMemoryText);
    setMemorySubView('view');
  };

  const handleCopyToClipboard = async () => {
    if (!rawMemoryText) return;
    try {
      await navigator.clipboard.writeText(rawMemoryText);
      setIsCopiedRecently(true);
      setTimeout(() => setIsCopiedRecently(false), 2000);
    } catch (e) {
      console.error('Error al copiar memoria:', e);
    }
  };

  // Add directive from the bottom bar and automatically trigger memory synthesis
  const handleSubmitDirective = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = directiveInput.trim();
    if (!text || isLocalUpdating || isGenerating) return;

    const newEdit: ProjectMemoryEdit = {
      id: `edit_${Date.now()}`,
      text,
      createdAt: Date.now()
    };

    const updatedEdits = [...(memory.memory_edits || []), newEdit];
    setDirectiveInput('');
    setIsLocalUpdating(true);

    try {
      // First save the directive
      await onUpdateMemory(prev => ({
        ...prev,
        memory_edits: updatedEdits
      }));

      // Generate synthesized memory incorporating the new directive
      const effectiveChats = chats.length > 0 ? chats : project.chats || [];
      const effectiveFiles = files.length > 0 ? files : project.files || [];

      const newRawMem = await generateClaudeProjectMemory({
        project: {
          ...project,
          memory: {
            ...memory,
            memory_edits: updatedEdits
          }
        },
        chats: effectiveChats,
        files: effectiveFiles,
        newDirective: text
      });

      if (newRawMem && newRawMem.trim().length > 0) {
        await onUpdateMemory(prev => ({
          ...prev,
          raw_project_memory: newRawMem,
          memory_edits: updatedEdits
        }));
        setEditableMemoryText(newRawMem);
      }
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2000);
    } catch (err) {
      console.error('Error al actualizar memoria con directiva:', err);
    } finally {
      setIsLocalUpdating(false);
    }
  };

  const handleAddManualEditOnly = () => {
    const text = newManualEditInput.trim();
    if (!text) return;
    const newEdit: ProjectMemoryEdit = {
      id: `edit_${Date.now()}`,
      text,
      createdAt: Date.now()
    };
    const updatedEdits = [...(memory.memory_edits || []), newEdit];
    handleFieldChange('memory_edits', updatedEdits);
    setNewManualEditInput('');
  };

  const handleDeleteEdit = (id: string) => {
    const updated = (memory.memory_edits || []).filter(e => e.id !== id);
    handleFieldChange('memory_edits', updated);
  };

  const handleClearAllEdits = () => {
    handleFieldChange('memory_edits', []);
  };

  const handleRegenerateClaudeMemory = async () => {
    if (isLocalUpdating || isGenerating) return;
    setIsLocalUpdating(true);
    try {
      const effectiveChats = chats.length > 0 ? chats : project.chats || [];
      const effectiveFiles = files.length > 0 ? files : project.files || [];

      const newRawMem = await generateClaudeProjectMemory({
        project,
        chats: effectiveChats,
        files: effectiveFiles
      });

      if (newRawMem && newRawMem.trim().length > 0) {
        await onUpdateMemory(prev => ({
          ...prev,
          raw_project_memory: newRawMem
        }));
        setEditableMemoryText(newRawMem);
      }
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 2000);
    } catch (err) {
      console.error('Error al regenerar memoria:', err);
    } finally {
      setIsLocalUpdating(false);
    }
  };

  const memoryEditsCount = (memory.memory_edits || []).length;
  const isCurrentlyWorking = isGenerating || isLocalUpdating;
  const isMemoryEmpty = !rawMemoryText || rawMemoryText.trim().length === 0;

  return (
    <div id="simple-memory-container" className="flex-1 flex flex-col h-full bg-[var(--bg-color)] overflow-hidden">
      {/* Top Header Bar */}
      <div id="memory-header-bar" className="px-4 py-3 md:px-6 border-b border-[var(--glass-border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] shrink-0">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-cinzel text-base md:text-lg font-bold text-[var(--text-primary)] leading-tight">
                Memoria del Proyecto
              </h2>
              {isSavedRecently && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-cinzel font-semibold animate-pulse">
                  <Check className="w-3.5 h-3.5" /> Guardado
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-lora max-w-2xl hidden sm:block">
              Sintetizador inteligente de contexto persistente (Purpose & context, Current state, Tools & resources).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-synthesize-memory-top"
            onClick={handleRegenerateClaudeMemory}
            disabled={isCurrentlyWorking}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Sintetizar memoria leyendo todas las sesiones y documentos del proyecto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCurrentlyWorking ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isCurrentlyWorking ? 'Sintetizando...' : 'Sintetizar con IA'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 font-lora">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col min-h-0">
          {/* Memory Card Container */}
          <div className="flex-1 flex flex-col bg-[var(--surface)] border border-[var(--glass-border)] rounded-2xl shadow-sm overflow-hidden relative">
            
            {/* Subview: MANAGE EDITS */}
            {memorySubView === 'manage_edits' ? (
              <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
                  <button
                    id="btn-back-to-memory"
                    onClick={() => setMemorySubView('view')}
                    className="flex items-center gap-1.5 text-xs font-cinzel font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Volver a la memoria</span>
                  </button>

                  <button
                    id="btn-clear-edits"
                    onClick={handleClearAllEdits}
                    disabled={memoryEditsCount === 0}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-cinzel transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpiar directivas</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="font-cinzel text-base font-bold text-[var(--text-primary)]">
                    Directivas manuales de memoria
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Estas directivas fijan reglas, restricciones o cambios de trama que el Narrador respetará estrictamente al sintetizar y mantener la memoria.
                  </p>
                </div>

                {/* Add manual directive input */}
                <div className="flex gap-2">
                  <input
                    id="input-manual-edit"
                    type="text"
                    placeholder="Ej: Las instrucciones han cambiado, no usar el oráculo a partir de ahora..."
                    value={newManualEditInput}
                    onChange={e => setNewManualEditInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddManualEditOnly();
                    }}
                    className="flex-1 bg-[color-mix(in_srgb,var(--bg-color)_60%,transparent)] border border-[var(--glass-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    id="btn-add-manual-edit"
                    onClick={handleAddManualEditOnly}
                    disabled={!newManualEditInput.trim()}
                    className="px-4 py-2 bg-[var(--accent)] text-[var(--on-accent)] rounded-xl text-xs font-cinzel font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    Añadir
                  </button>
                </div>

                {/* List of active edits */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {memoryEditsCount === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--text-secondary)] font-cinzel italic">
                      No hay directivas manuales registradas.
                    </div>
                  ) : (
                    (memory.memory_edits || []).map(edit => (
                      <div
                        key={edit.id}
                        className="bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--glass-border)] rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs leading-relaxed text-[var(--text-primary)]"
                      >
                        <div className="flex-1 whitespace-pre-wrap">{edit.text}</div>
                        <button
                          onClick={() => handleDeleteEdit(edit.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer shrink-0 transition-colors"
                          title="Eliminar directiva"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer action to regenerate */}
                <div className="pt-3 border-t border-[var(--glass-border)] flex justify-end">
                  <button
                    id="btn-regenerate-with-directives"
                    onClick={handleRegenerateClaudeMemory}
                    disabled={isCurrentlyWorking}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCurrentlyWorking ? 'animate-spin' : ''}`} />
                    <span>Sintetizar memoria aplicando directivas</span>
                  </button>
                </div>
              </div>
            ) : memorySubView === 'edit' ? (
              /* Subview: RAW MARKDOWN EDITOR */
              <div className="flex-1 flex flex-col p-4 md:p-6 space-y-3 overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-2">
                  <span className="text-xs font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>Editor de Memoria (Markdown)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMemorySubView('view')}
                      className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass)] rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      id="btn-save-markdown-memory"
                      onClick={handleSaveEditableMemory}
                      className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-semibold rounded-lg hover:opacity-90 transition-all cursor-pointer shadow-xs"
                    >
                      Guardar cambios
                    </button>
                  </div>
                </div>

                <textarea
                  id="textarea-memory-markdown"
                  value={editableMemoryText}
                  onChange={e => setEditableMemoryText(e.target.value)}
                  placeholder="Redacta las secciones Purpose & context, Current state y Tools & resources..."
                  className="flex-1 w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--glass-border)] rounded-xl p-4 text-xs md:text-sm text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] resize-none leading-relaxed"
                />
              </div>
            ) : (
              /* Subview: NORMAL CLAUDE MEMORY VIEW */
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Loading overlay */}
                {isCurrentlyWorking && (
                  <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
                    <RefreshCw className="w-8 h-8 text-[var(--accent)] animate-spin" />
                    <span className="text-sm font-cinzel font-semibold text-[var(--text-primary)] tracking-wide">
                      Sintetizando memoria con IA...
                    </span>
                  </div>
                )}

                {/* Action toolbar inside card */}
                <div className="px-4 py-2.5 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-cinzel font-bold text-[var(--text-primary)]">
                      Estado de la Memoria
                    </span>
                    {isMemoryEmpty ? (
                      <span className="text-[10px] uppercase font-cinzel font-bold px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--text-secondary)_15%,transparent)] text-[var(--text-secondary)]">
                        Vacía
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-cinzel font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Sintetizada
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isMemoryEmpty && (
                      <button
                        id="btn-copy-memory"
                        onClick={handleCopyToClipboard}
                        className="px-2.5 py-1 text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass)] rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                        title="Copiar contenido de memoria"
                      >
                        {isCopiedRecently ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Copiar</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      id="btn-edit-memory"
                      onClick={() => {
                        setEditableMemoryText(rawMemoryText);
                        setMemorySubView('edit');
                      }}
                      className="px-2.5 py-1 text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      title="Editar memoria manualmente"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>

                    <button
                      id="btn-manage-directives-top"
                      onClick={() => setMemorySubView('manage_edits')}
                      className="px-2.5 py-1 text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Gestionar directivas manuales"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Directivas {memoryEditsCount > 0 ? `(${memoryEditsCount})` : ''}</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable Document or Empty State */}
                {isMemoryEmpty ? (
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] flex items-center justify-center shadow-inner">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <div className="max-w-md space-y-2">
                      <h3 className="font-cinzel text-base md:text-lg font-bold text-[var(--text-primary)]">
                        Memoria del Proyecto Vacía
                      </h3>
                      <p className="text-xs md:text-sm text-[var(--text-secondary)] font-lora leading-relaxed">
                        GM Studio genera la memoria persistente analizando todas tus sesiones jugadas, fichas de personaje, compendios cargados y directivas para mantener el contexto siempre fresco.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        id="btn-synthesize-empty-state"
                        onClick={handleRegenerateClaudeMemory}
                        disabled={isCurrentlyWorking}
                        className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-cinzel font-bold text-xs shadow-sm hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${isCurrentlyWorking ? 'animate-spin' : ''}`} />
                        <span>Sintetizar memoria ahora</span>
                      </button>
                      <button
                        id="btn-write-manual-empty-state"
                        onClick={() => {
                          setEditableMemoryText('');
                          setMemorySubView('edit');
                        }}
                        className="px-4 py-2.5 rounded-xl bg-[color-mix(in_srgb,var(--bg-color)_60%,transparent)] border border-[var(--glass-border)] text-[var(--text-primary)] font-cinzel text-xs hover:border-[var(--accent)] transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Escribir manualmente</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-5 md:p-8 space-y-4 text-sm text-[var(--text-primary)] leading-relaxed font-lora selection:bg-[var(--accent)] selection:text-[var(--on-accent)]"
                  >
                    <div className="prose prose-sm md:prose-base max-w-none space-y-4">
                      <ReactMarkdown
                        components={{
                          h3: ({ node, ...props }) => (
                            <h3 className="font-cinzel text-base md:text-lg font-bold text-[var(--accent)] mt-6 mb-3 border-b border-[var(--glass-border)] pb-1.5 first:mt-0" {...props} />
                          ),
                          p: ({ node, ...props }) => (
                            <p className="text-[13px] md:text-sm text-[var(--text-primary)] leading-relaxed mb-3" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 space-y-1.5 my-2 text-[13px] md:text-sm text-[var(--text-primary)]" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="leading-relaxed" {...props} />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong className="font-bold text-[var(--accent)]" {...props} />
                          )
                        }}
                      >
                        {rawMemoryText}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Bottom Input Pill: "Dile a la IA qué recordar u olvidar..." */}
                <div className="p-3 md:px-5 bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] border-t border-[var(--glass-border)] shrink-0">
                  <form onSubmit={handleSubmitDirective} className="relative flex items-center">
                    <input
                      id="input-directive-prompt"
                      type="text"
                      placeholder="Dile a GM Studio qué recordar u olvidar..."
                      value={directiveInput}
                      onChange={e => setDirectiveInput(e.target.value)}
                      disabled={isCurrentlyWorking}
                      className="w-full bg-[color-mix(in_srgb,var(--bg-color)_70%,transparent)] border border-[var(--glass-border)] rounded-full pl-4 pr-11 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 outline-none focus:border-[var(--accent)] transition-all shadow-inner"
                    />
                    <button
                      id="btn-submit-directive"
                      type="submit"
                      disabled={!directiveInput.trim() || isCurrentlyWorking}
                      className="absolute right-1.5 w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-30 flex items-center justify-center transition-all cursor-pointer shadow-xs"
                      title="Enviar directiva y sintetizar memoria"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Bottom Drawer Bar: "Gestionar directivas (N) >" */}
            {memorySubView === 'view' && !isMemoryEmpty && (
              <button
                id="btn-manage-edits-drawer"
                onClick={() => setMemorySubView('manage_edits')}
                className="w-full py-2.5 px-5 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] hover:bg-[var(--surface)] border-t border-[var(--glass-border)] text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-between transition-colors cursor-pointer shrink-0"
              >
                <span className="font-semibold">Gestionar directivas y reglas manuales</span>
                <div className="flex items-center gap-1.5">
                  {memoryEditsCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[11px] font-bold text-[var(--accent)] flex items-center justify-center">
                      {memoryEditsCount}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
