import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project } from '../types';
import { Eye, EyeOff, NotebookPen, Pencil, Save, Trash2, X } from 'lucide-react';
import { CreativeStudioModal } from './CreativeStudioModal';

/**
 * El diario del Narrador — crónica, estado y notas — como una sección más de
 * la Agenda, con el mismo lenguaje visual que Hilos en marcha: un título con
 * icono, una línea de descripción y el contenido debajo, separado por líneas
 * finas en vez de pestañas o de una tarjeta aparte.
 *
 * Este componente no dibuja su propia página: se inyecta como children
 * dentro del folio único de CalendarView, para que resumen y estado vivan
 * DENTRO de esa misma página, no en un bloque separado.
 */
export const DiaryView: React.FC<{
  project: Project;
  onUpdateMemory: (updater: (prevMem: Project['memory']) => Project['memory']) => Promise<void>;
  onTriggerAIUpdate?: () => Promise<void>;
  isGenerating?: boolean;
  hasChats?: boolean;
}> = ({ project, onUpdateMemory }) => {
  const memory = project.memory || {
    story: '',
    quests: [],
    npcs: [],
    locations: [],
    current_status: '',
    manual_notes: ''
  };

  type Seccion = 'story' | 'status' | 'notes';
  const [editing, setEditing] = useState<Seccion | null>(null);
  const [storyDraft, setStoryDraft] = useState(memory.story || '');
  const [statusDraft, setStatusDraft] = useState(memory.current_status || '');
  const [notesDraft, setNotesDraft] = useState(memory.manual_notes || '');
  const [showNotes, setShowNotes] = useState(false);
  const [confirmClear, setConfirmClear] = useState<Seccion | null>(null);
  const [studioModal, setStudioModal] = useState<{
    isOpen: boolean;
    tab?: 'image' | 'video' | 'music' | 'diary';
    sceneText: string;
  } | null>(null);

  useEffect(() => {
    setStoryDraft(memory.story || '');
    setStatusDraft(memory.current_status || '');
    setNotesDraft(memory.manual_notes || '');
  }, [project.id, memory.story, memory.current_status, memory.manual_notes]);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (editing && textAreaRef.current) {
      const el = textAreaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  const startEdit = (s: Seccion) => setEditing(s);
  const cancelEdit = () => {
    setStoryDraft(memory.story || '');
    setStatusDraft(memory.current_status || '');
    setNotesDraft(memory.manual_notes || '');
    setEditing(null);
  };

  const saveEdit = async (s: Seccion) => {
    if (s === 'story') await onUpdateMemory(mem => ({ ...mem, story: storyDraft.trim() }));
    else if (s === 'status') await onUpdateMemory(mem => ({ ...mem, current_status: statusDraft.trim() }));
    else await onUpdateMemory(mem => ({ ...mem, manual_notes: notesDraft.trim() }));
    setEditing(null);
  };

  const doClear = async (s: Seccion) => {
    if (s === 'story') {
      setStoryDraft('');
      await onUpdateMemory(mem => ({ ...mem, story: '' }));
    } else if (s === 'status') {
      setStatusDraft('');
      await onUpdateMemory(mem => ({ ...mem, current_status: '' }));
    } else {
      setNotesDraft('');
      await onUpdateMemory(mem => ({ ...mem, manual_notes: '' }));
    }
    setConfirmClear(null);
    setEditing(null);
  };

  const sections: {
    id: Seccion;
    label: string;
    hint: string;
    value: string;
    draft: string;
    setDraft: (v: string) => void;
    empty: string;
    placeholder: string;
    rows: number;
  }[] = [
    {
      id: 'story',
      label: 'Resumen de la crónica',
      hint: 'Lo acumulado hasta ahora, tal y como lo relee el Narrador para mantener la coherencia.',
      value: memory.story || '',
      draft: storyDraft,
      setDraft: setStoryDraft,
      empty: 'Aún no hay nada escrito. Pulsa el lápiz para redactarlo a tu gusto.',
      placeholder: 'Escribe la crónica como un resumen en primera o tercera persona: qué ha pasado hasta ahora...',
      rows: 12
    },
    {
      id: 'status',
      label: 'Estado actual',
      hint: 'Dónde están, qué peligros enfrentan, con qué recursos cuentan ahora mismo.',
      value: memory.current_status || '',
      draft: statusDraft,
      setDraft: setStatusDraft,
      empty: 'No hay estado actual registrado.',
      placeholder: 'Ubicación, heridas, tensión del grupo, recursos disponibles...',
      rows: 6
    },
    {
      id: 'notes',
      label: 'Notas manuales',
      hint: 'Secretos, reglas de casa y giros futuros. Prioridad máxima para la IA.',
      value: memory.manual_notes || '',
      draft: notesDraft,
      setDraft: setNotesDraft,
      empty: 'Sin notas por ahora.',
      placeholder: 'Secretos, reglas de casa, revelaciones futuras...',
      rows: 8
    }
  ];

  return (
    <>
      <div className="pt-8 border-t border-[var(--glass-border)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-cinzel text-lg font-bold text-[var(--accent)] m-0 flex items-center gap-2">
            <NotebookPen className="w-4 h-4" /> Diario o resumen del día
          </h3>
        </div>
        <p className="text-xs text-[var(--text-secondary)] m-0">
          La crónica, el estado y las notas que el Narrador relee antes de continuar la historia. Se leen y se
          corrigen aquí mismo, como una entrada más de la agenda.
        </p>

        <div className="space-y-5">
          {sections.map((s, idx) => (
            <div key={s.id} className={idx > 0 ? 'pt-5 border-t border-dashed border-[var(--glass-border)]' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-cinzel font-bold text-sm">{s.label}</span>
                  <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-0.5">{s.hint}</p>
                </div>

                {editing !== s.id && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.id === 'notes' && s.value && (
                      <button
                        onClick={() => setShowNotes(!showNotes)}
                        title={showNotes ? 'Ocultar notas para evitar spoilers' : 'Mostrar notas secretas (Modo Narrador)'}
                        className="flex items-center gap-1 rounded border border-[var(--user-border)] px-2 py-0.5 text-[11px] font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
                      >
                        {showNotes ? (
                          <>
                            <EyeOff className="w-3 h-3" /> Ocultar notas
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" /> Mostrar notas
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (s.id === 'notes') setShowNotes(true);
                        startEdit(s.id);
                      }}
                      title={`Editar ${s.label}`}
                      className="flex items-center gap-1 rounded border border-[var(--user-border)] px-2 py-0.5 text-[11px] font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                    {s.value && (
                      <button
                        onClick={() => setConfirmClear(s.id)}
                        title={`Vaciar ${s.label}`}
                        className="flex items-center gap-1 rounded border border-[var(--user-border)] px-2 py-0.5 text-[11px] font-cinzel text-red-500 hover:border-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {editing === s.id ? (
                <div className="flex flex-col gap-2 mt-2">
                  <textarea
                    ref={textAreaRef}
                    value={s.draft}
                    onChange={e => s.setDraft(e.target.value)}
                    rows={s.rows}
                    className="w-full bg-[var(--surface-soft)] border border-[var(--user-border)] focus:border-[var(--accent)] p-3 rounded-lg text-sm font-lora outline-none leading-relaxed resize-y"
                    placeholder={s.placeholder}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => saveEdit(s.id)}
                      className="flex items-center gap-1.5 rounded bg-[var(--accent)] px-3 py-1.5 font-cinzel text-[11px] font-bold text-[var(--on-accent)] hover:bg-[var(--accent-hover)] cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Guardar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 rounded border border-[var(--user-border)] px-3 py-1.5 font-cinzel text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : s.value ? (
                s.id === 'notes' && !showNotes ? (
                  <div
                    onClick={() => setShowNotes(true)}
                    className="p-3 mt-2 rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--surface-soft)]/20 hover:border-[var(--accent)] text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 py-3 group"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] group-hover:text-[var(--accent)] font-medium">
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Notas del Narrador ocultas (Modo Narrador)</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] m-0 opacity-80">
                      Ocultas para evitar spoilers involuntarios. Haz clic para revelar.
                    </p>
                  </div>
                ) : (
                  <div
                    className="markdown-body text-sm leading-relaxed mt-2 cursor-text"
                    onClick={() => startEdit(s.id)}
                  >
                    <ReactMarkdown>{s.value}</ReactMarkdown>
                  </div>
                )
              ) : (
                <p
                  className="text-sm text-[var(--text-secondary)] italic mt-2 cursor-text"
                  onClick={() => {
                    if (s.id === 'notes') setShowNotes(true);
                    startEdit(s.id);
                  }}
                >
                  {s.empty}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Confirmación de borrado */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
          <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-xl shadow-2xl w-[380px] max-w-full font-lora overflow-hidden">
            <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--sidebar-bg)]">
              <h4 className="font-cinzel text-base text-[var(--accent)] font-bold m-0">
                Vaciar {sections.find(s => s.id === confirmClear)?.label}
              </h4>
            </div>
            <div className="p-4">
              <p className="text-sm mb-5 leading-relaxed text-[var(--text-primary)]">
                ¿Seguro que quieres borrar este texto? No se puede deshacer.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmClear(null)}
                  className="px-3.5 py-1.5 text-xs font-cinzel border border-[var(--user-border)] rounded hover:border-[var(--accent)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => doClear(confirmClear)}
                  className="px-3.5 py-1.5 text-xs font-cinzel bg-red-600 hover:bg-red-700 text-white rounded font-bold cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal del Taller Creativo basado en la escena / sección del diario */}
      {studioModal?.isOpen && (
        <CreativeStudioModal
          isOpen={studioModal.isOpen}
          initialTab={studioModal.tab || 'image'}
          sceneText={studioModal.sceneText}
          onClose={() => setStudioModal(null)}
          onInsertIntoChat={async text => {
            // If user inserts into chat or memory
            if (onUpdateMemory) {
              await onUpdateMemory(mem => ({
                ...mem,
                manual_notes: mem.manual_notes ? `${mem.manual_notes}\n\n${text}` : text
              }));
            }
          }}
        />
      )}
    </>
  );
};
