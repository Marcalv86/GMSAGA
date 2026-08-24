import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Chat, PlayerCharacter } from '../types';
import { YouTubePreview } from './YouTubePreview';
import { SpotifyPreview } from './SpotifyPreview';
import { CreativeStudioModal } from './CreativeStudioModal';
import { parseRollRequests, stripRollRequests, stripStateTag, RollRequest } from '../utils/rollRequests';
import { formatNarrativeText } from '../utils/textFormatter';
import { parseMessageRolls, RollBadgeCard } from './RollBadge';
import {
  PROBABILIDADES,
  PROBABILIDAD_POR_DEFECTO,
  Probabilidad,
  leerInvitaciones,
  limpiarInvitaciones
} from '../utils/oracle';

import {
  BookOpen,
  Dices,
  Sparkles,
  Library,
  Paperclip,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Scissors,
  Scroll,
  Search,
  Send,
  Square,
  Swords,
  Trash2,
  X,
  Zap,
  Mic,
  MicOff,
  Music,
  Wand2
} from 'lucide-react';
interface ChatMessageItemProps {
  m: { role: 'user' | 'model'; content: string };
  idx: number;
  isEditing: boolean;
  editDraft: string;
  setEditDraft: (v: string) => void;
  isLastMessage: boolean;
  isGenerating: boolean;
  hasOracle: boolean;
  isSearchHit: boolean;
  copiedIndex: number | null;
  handleCopyMessage: (idx: number, content: string) => void;
  handleStartEditing: (idx: number, content: string) => void;
  handleCancelEditing: () => void;
  handleSaveEditOnly: (idx: number) => void;
  handleSaveAndRegenerate: (idx: number) => void;
  onContinueNarrative: (fromIndex?: number) => void;
  onRegenerateMessage: (index: number, updatedUserPrompt?: string) => void;
  setDeleteModal: (v: { index: number; role: 'user' | 'model'; isLast: boolean } | null) => void;
  setPreguntaOraculo: (p: string) => void;
  setOraculoAbierto: (open: boolean) => void;
  handleRollRequestClick: (req: RollRequest) => void;
  onOpenStudio?: (tab: 'music' | 'image' | 'video' | 'voice', sceneText?: string) => void;
}

const ChatMessageItem = React.memo<ChatMessageItemProps>(({
  m,
  idx,
  isEditing,
  editDraft,
  setEditDraft,
  isLastMessage,
  isGenerating,
  hasOracle,
  isSearchHit,
  copiedIndex,
  handleCopyMessage,
  handleStartEditing,
  handleCancelEditing,
  handleSaveEditOnly,
  handleSaveAndRegenerate,
  onContinueNarrative,
  onRegenerateMessage,
  setDeleteModal,
  setPreguntaOraculo,
  setOraculoAbierto,
  handleRollRequestClick,
  onOpenStudio
}) => {
  const isModel = m.role === 'model';
  const rollRequests = isModel ? parseRollRequests(m.content) : [];
  const invitaciones = isModel && hasOracle ? leerInvitaciones(m.content) : [];
  const baseContent = isModel
    ? limpiarInvitaciones(
        stripStateTag(rollRequests.length ? stripRollRequests(m.content) : m.content)
      )
    : m.content;

  // Extraer tiradas estructuradas embebidas en el mensaje (ej: [Tirada de Sigilo: d20 natural = 18 | CD 15])
  const { narrativeText, rolls } = parseMessageRolls(baseContent);
  const bodyText = isModel ? formatNarrativeText(narrativeText) : narrativeText;

  // Detección de elementos técnicos sincronizados en segundo plano
  const hasSyncTags = isModel && (
    /\[\s*ESTADO\s*:/i.test(m.content) ||
    /\[\s*INVENTARIO\s*:/i.test(m.content) ||
    /\[\s*TIEMPO\s*:/i.test(m.content) ||
    /\[\s*AGENDA\s*:/i.test(m.content) ||
    /\[\s*HILO\s*:/i.test(m.content) ||
    /\[\s*PRESENTES\s*:/i.test(m.content) ||
    /\[\s*V[IÍ]NCULO\s*:/i.test(m.content) ||
    /\[\s*AFINIDAD\s*:/i.test(m.content)
  );

  // Detectar tipos específicos para tooltip informativo
  const syncItems: string[] = [];
  if (isModel) {
    if (/\[\s*ESTADO\s*:/i.test(m.content)) syncItems.push('Salud/CA');
    if (/\[\s*INVENTARIO\s*:/i.test(m.content)) syncItems.push('Inventario');
    if (/\[\s*TIEMPO\s*:/i.test(m.content)) syncItems.push('Tiempo');
    if (/\[\s*AGENDA\s*:/i.test(m.content)) syncItems.push('Diario');
    if (/\[\s*HILO\s*:/i.test(m.content)) syncItems.push('Hilos de Trama');
    if (/\[\s*V[IÍ]NCULO\s*:/i.test(m.content) || /\[\s*AFINIDAD\s*:/i.test(m.content)) syncItems.push('Afinidad PNJs');
    if (/\[\s*PRESENTES\s*:/i.test(m.content)) syncItems.push('PNJs en escena');
  }

  return (
    <div
      id={`msg-${idx}`}
      className={`flex flex-col group/msg ${
        m.role === 'user' ? 'items-end' : 'items-start'
      } animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out relative ${
        isSearchHit
          ? 'ring-2 ring-[var(--light-gold)] ring-offset-4 ring-offset-[var(--bg-color)] rounded-lg'
          : ''
      }`}
    >
      {/* Header / Sender label with actions */}
      <div
        className={`flex items-center gap-2 mb-1 text-xs font-cinzel font-bold tracking-wide ${
          m.role === 'user' ? 'text-[var(--accent)] mr-2' : 'text-[var(--text-secondary)]'
        }`}
      >
        <span className="flex items-center gap-1.5">
          {m.role === 'user' ? 'Tu Acción' : 'Narrador'}
          {hasSyncTags && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[9px] font-sans font-normal normal-case tracking-normal shadow-2xs hover:bg-amber-500/20 transition-colors cursor-help"
              title={`Sincronización en segundo plano completada: ${syncItems.join(', ')}`}
            >
              <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
              <span>Sincronizado</span>
            </span>
          )}
        </span>

        {/* Quick action buttons on hover / top bar */}
        {!isEditing && (
          <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 ml-2 bg-[var(--bg-color)]/90 px-1.5 py-0.5 rounded border border-[var(--user-border)] shadow-2xs">
            <button
              onClick={() => handleCopyMessage(idx, m.content)}
              className="hover:text-[var(--accent)] p-0.5 text-[11px] cursor-pointer transition-colors"
              title="Copiar texto al portapapeles"
            >
              {copiedIndex === idx ? 'Copiado' : 'Copiar'}
            </button>
            <span className="text-[var(--glass-border)]">•</span>
            <button
              onClick={() => handleStartEditing(idx, m.content)}
              disabled={isGenerating}
              className="hover:text-[var(--accent)] p-0.5 text-[11px] cursor-pointer transition-colors disabled:opacity-40"
              title="Editar este texto"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            {isModel && (
              <>
                <span className="text-[var(--glass-border)]">•</span>
                <button
                  onClick={() => onRegenerateMessage(idx)}
                  disabled={isGenerating}
                  className="hover:text-[var(--accent)] p-0.5 text-[11px] cursor-pointer transition-colors disabled:opacity-40"
                  title="Rehacer / Volver a generar la respuesta del Narrador"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Rehacer
                </button>
                {onOpenStudio && (
                  <>
                    <span className="text-[var(--glass-border)]">•</span>
                    <button
                      onClick={() => onOpenStudio('image', m.content)}
                      className="hover:text-[var(--accent)] p-0.5 text-[11px] cursor-pointer transition-colors"
                      title="Ilustrar esta escena con el taller creativo"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Ilustrar
                    </button>
                  </>
                )}
              </>
            )}
            <span className="text-[var(--glass-border)]">•</span>
            <button
              onClick={() =>
                setDeleteModal({
                  index: idx,
                  role: m.role,
                  isLast: isLastMessage
                })
              }
              disabled={isGenerating}
              className="text-red-700 hover:text-red-900 p-0.5 text-[11px] cursor-pointer transition-colors disabled:opacity-40"
              title="Borrar o rebobinar la historia desde este punto"
            >
              <Trash2 className="w-3.5 h-3.5" />{' '}
            </button>
          </div>
        )}
      </div>

      {/* Message Body or Inline Editor */}
      {isEditing ? (
        <div className="w-full max-w-[900px] bg-[var(--surface)] border-2 border-[var(--accent)] rounded-lg p-3 shadow-md">
          <div className="text-xs font-cinzel font-bold text-[var(--accent)] mb-2 flex justify-between items-center">
            <span>
              {' '}
              Editando{' '}
              {m.role === 'user' ? 'tu mensaje de acción' : 'la respuesta del Narrador'}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] font-normal">
              Pulsa Guardar o Guardar y Regenerar
            </span>
          </div>
          <textarea
            value={editDraft}
            onChange={e => setEditDraft(e.target.value)}
            rows={Math.min(10, Math.max(3, editDraft.split('\n').length + 1))}
            className="w-full bg-[var(--surface-soft)] border border-[var(--user-border)] p-3 rounded text-[var(--text-primary)] font-lora text-base leading-relaxed outline-none focus:border-[var(--accent)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-[var(--glass-border)]">
            <button
              onClick={handleCancelEditing}
              className="px-3 py-1 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-gray-100 cursor-pointer"
            >
              Cancelar
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveEditOnly(idx)}
                className="px-3 py-1 text-xs font-cinzel bg-[var(--surface)] border border-[var(--user-border)] text-[var(--text-primary)] rounded hover:bg-amber-50 cursor-pointer font-bold"
                title="Guarda los cambios de texto sin volver a tirar/generar la historia"
              >
                <Save className="w-3.5 h-3.5" /> Guardar texto
              </button>
              {m.role === 'user' ? (
                <button
                  onClick={() => handleSaveAndRegenerate(idx)}
                  className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] rounded hover:bg-[var(--accent-hover)] cursor-pointer font-bold shadow-xs"
                  title="Guarda esta acción modificada y genera una nueva respuesta del Narrador borrando lo posterior"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Guardar y Regenerar Trama
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleSaveEditOnly(idx);
                    onContinueNarrative(idx);
                  }}
                  className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)] text-[var(--on-accent)] rounded hover:bg-[var(--accent-hover)] cursor-pointer font-bold shadow-xs"
                  title="Guarda el texto y le pide a la IA que continúe narrando desde aquí"
                >
                  <Play className="w-3.5 h-3.5" /> Guardar y Continuar Relato
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={
            m.role === 'user'
              ? 'bg-[var(--msg-user)] border border-[var(--user-border)] py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl rounded-tr-sm text-[var(--text-primary)] max-w-[92%] sm:max-w-[85%] shadow-[2px_3px_8px_var(--glass-border)] mr-1 sm:mr-2 font-lora'
              : 'py-1 text-[var(--text-primary)] w-full max-w-[900px] font-lora text-left'
          }
        >
          {bodyText && (
            <div className="markdown-body narrative-body">
              <ReactMarkdown
                components={{
                  p: ({ children }) => {
                    const str = Array.isArray(children)
                      ? children.map(c => (typeof c === 'string' ? c : '')).join('')
                      : typeof children === 'string' ? children : '';
                    const isDialogue = isModel && /^[—–\-"«]/.test(str.trim());
                    return (
                      <p className={isDialogue ? 'narrative-dialogue' : undefined}>
                        {children}
                      </p>
                    );
                  },
                  strong: ({ children }) => <strong className="narrative-strong">{children}</strong>,
                  em: ({ children }) => <em className="narrative-em">{children}</em>,
                  blockquote: ({ children }) => <blockquote className="narrative-quote">{children}</blockquote>
                }}
              >
                {bodyText}
              </ReactMarkdown>
            </div>
          )}

          {/* Tarjetas estilizadas de tiradas embebidas */}
          {rolls.length > 0 && (
            <div className={`space-y-1.5 ${bodyText ? 'mt-2.5 pt-2 border-t border-[var(--glass-border)]/60' : ''}`}>
              {rolls.map((r, rIdx) => (
                <RollBadgeCard key={`${idx}-rollbadge-${rIdx}`} roll={r} />
              ))}
            </div>
          )}

          {invitaciones.length > 0 && isLastMessage && !isGenerating && (
            <div className="mt-4 flex flex-col gap-1.5">
              {invitaciones.map((pregunta, iIdx) => (
                <button
                  key={`${idx}-orac-${iIdx}`}
                  onClick={() => {
                    setPreguntaOraculo(pregunta);
                    setOraculoAbierto(true);
                  }}
                  className="group flex items-start gap-2 text-left text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  title="Fija la probabilidad y deja que el dado decida"
                >
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60 group-hover:opacity-100" />
                  <span className="italic border-b border-dashed border-current/40">
                    {pregunta}
                  </span>
                </button>
              ))}
            </div>
          )}

          {rollRequests.length > 0 && (
            <div className="mt-4 flex flex-col gap-2.5">
              {rollRequests.map((req, rIdx) => {
                let dcBadgeClass = 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300';
                let dcDifficulty = 'Moderada';
                if (req.dc) {
                  if (req.dc <= 10) {
                    dcBadgeClass = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300';
                    dcDifficulty = 'Fácil';
                  } else if (req.dc <= 15) {
                    dcBadgeClass = 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300';
                    dcDifficulty = 'Media';
                  } else if (req.dc <= 20) {
                    dcBadgeClass = 'bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300';
                    dcDifficulty = 'Difícil';
                  } else {
                    dcBadgeClass = 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300';
                    dcDifficulty = 'Muy difícil';
                  }
                }

                return (
                  <div
                    key={`${idx}-roll-${rIdx}`}
                    className="relative overflow-hidden rounded-xl border border-[var(--accent)]/40 bg-gradient-to-r from-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] via-[var(--surface)] to-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] p-3.5 sm:p-4 shadow-md shadow-amber-950/5 flex flex-wrap items-center justify-between gap-3 font-lora"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-[var(--on-accent)] flex items-center justify-center shrink-0 shadow-sm shadow-amber-900/30 border border-amber-300/40">
                        <Dices className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-cinzel font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1">
                          <span>Desafío de Acción</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-cinzel text-sm sm:text-base font-bold text-[var(--text-primary)]">
                            Tirada de {req.skill}
                          </span>
                          {req.dc && (
                            <span className={`text-[11px] font-cinzel font-bold px-2 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 ${dcBadgeClass}`}>
                              <span>CD {req.dc}</span>
                              <span className="opacity-70 text-[9px] font-normal">({dcDifficulty})</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isLastMessage && !isGenerating && (
                      <button
                        onClick={() => handleRollRequestClick(req)}
                        className="ml-auto px-4 py-2 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] hover:brightness-110 active:scale-95 text-[var(--on-accent)] rounded-lg font-cinzel text-xs font-bold shadow-md shadow-[var(--accent)]/20 border border-amber-200/40 flex items-center gap-2 transition-all cursor-pointer"
                        title="Tira un d20 con azar real y añade el resultado a tu mensaje."
                      >
                        <Dices className="w-4 h-4" />
                        <span>Tirar d20</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <YouTubePreview content={m.content} />
          <SpotifyPreview content={m.content} />

          {/* Bottom action toolbar for Model message */}
          {isModel && (
            <div className="mt-2 pt-1.5 flex flex-wrap items-center gap-2 text-xs font-cinzel border-t border-[var(--glass-border)]/50">
              <button
                onClick={() => onRegenerateMessage(idx)}
                disabled={isGenerating}
                className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] border border-[var(--user-border)] rounded text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1 shadow-2xs"
                title="Rehacer esta narración (Vuelve a tirar y genera una respuesta diferente)"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Rehacer
              </button>
              <button
                onClick={() => onContinueNarrative(idx)}
                disabled={isGenerating}
                className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] border border-[var(--user-border)] rounded text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1 shadow-2xs"
                title="Pedir al Narrador que continúe y profundice en esta escena"
              >
                <Play className="w-3.5 h-3.5" /> Continuar
              </button>
              {onOpenStudio && (
                <button
                  onClick={() => onOpenStudio('image', m.content)}
                  className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-[var(--user-border)] rounded text-[11px] text-[var(--accent)] hover:text-[var(--accent)] font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Generar ilustración de esta escena o retrato"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Ilustrar
                </button>
              )}
              <button
                onClick={() => handleStartEditing(idx, m.content)}
                disabled={isGenerating}
                className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:bg-amber-100 border border-[var(--user-border)] rounded text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                title="Editar texto manualmente"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                onClick={() => handleCopyMessage(idx, m.content)}
                className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:bg-amber-100 border border-[var(--user-border)] rounded text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                title="Copiar texto"
              >
                <span>{copiedIndex === idx ? '' : ''}</span>
                <span>{copiedIndex === idx ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          )}

          {/* Bottom action toolbar for User message (quick button) */}
          {m.role === 'user' && (
            <div className="mt-1.5 pt-1 flex items-center justify-end gap-2 text-[10px] font-cinzel opacity-80 group-hover/msg:opacity-100 transition-opacity">
              <button
                onClick={() => handleStartEditing(idx, m.content)}
                disabled={isGenerating}
                className="hover:underline text-[var(--accent)] cursor-pointer disabled:opacity-40"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar pregunta
              </button>
              <span>•</span>
              <button
                onClick={() => onRegenerateMessage(idx)}
                disabled={isGenerating}
                className="hover:underline text-[var(--accent)] cursor-pointer disabled:opacity-40"
                title="Re-ejecutar esta acción y generar nueva respuesta"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-tirar desde aquí
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const ChatView: React.FC<{
  chat?: Chat;
  chapterIndex: number;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  isGenerating: boolean;
  isStreaming?: boolean;
  /** Qué está pasando ahora mismo: reintentos, esperas, etc. */
  streamingStatus?: string;
  onStopGeneration?: () => void;
  onSendMessage: () => void;
  /** Devuelve el número sacado, para que la animación enseñe justo lo que se envía. */
  onRollDice: (sides: number) => number;
  /** Resuelve una petición de tirada del Narrador. Devuelve el d20 natural. */
  onRollRequest: (req: RollRequest) => number;
  /** Consulta al oráculo: la app tira, la jugadora fija la probabilidad. */
  onOracleAsk?: (pregunta: string, probabilidad: Probabilidad) => number;
  /** Dos tiradas para las tablas de significado. */
  onOracleMeaning?: () => void;
  /** Si no hay tablas subidas, el oráculo no tiene nada que consultar. */
  hasOracle?: boolean;
  onFileUpload: (files: File[]) => void;
  onExportPDF: () => void;
  onEditMessage: (index: number, newContent: string) => Promise<void> | void;
  onRegenerateMessage: (index: number, updatedUserPrompt?: string) => Promise<void> | void;
  onContinueNarrative: (fromIndex?: number) => Promise<void> | void;
  onDeleteMessage: (index: number, deleteSubsequent: boolean) => Promise<void> | void;
  onUpdatePlayerCharacter?: (pc: PlayerCharacter) => void;
  onOpenNovelReader?: () => void;
  isBackgroundSyncing?: boolean;
}> = ({
  chat,
  chapterIndex,
  inputText,
  setInputText,
  isGenerating,
  isStreaming,
  streamingStatus,
  onStopGeneration,
  onSendMessage,
  onRollDice,
  onRollRequest,
  onOracleAsk,
  onOracleMeaning,
  hasOracle,
  onFileUpload,
  onExportPDF,
  onEditMessage,
  onRegenerateMessage,
  onContinueNarrative,
  onDeleteMessage,
  onUpdatePlayerCharacter,
  onOpenNovelReader,
  isBackgroundSyncing
}) => {
  const [activeRoll, setActiveRoll] = useState<{ sides: number; result: number } | null>(null);
  const [oraculoAbierto, setOraculoAbierto] = useState(false);
  const [preguntaOraculo, setPreguntaOraculo] = useState('');
  const [probabilidad, setProbabilidad] = useState<Probabilidad>(PROBABILIDAD_POR_DEFECTO);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Buscador dentro del capítulo: a partir de cierto punto es imposible encontrar
  // qué dijo un PNJ sin recorrer cientos de mensajes a mano.
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [chronicleQuery, setChronicleQuery] = useState('');
  const [activeHit, setActiveHit] = useState(0);

  const normalise = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const hits = React.useMemo(() => {
    const q = normalise(chronicleQuery.trim());
    if (q.length < 2 || !chat?.messages) return [] as number[];
    return chat.messages.map((m, i) => (normalise(m.content || '').includes(q) ? i : -1)).filter(i => i >= 0);
  }, [chronicleQuery, chat?.messages]);

  React.useEffect(() => {
    setActiveHit(0);
  }, [chronicleQuery]);

  const goToHit = (next: number) => {
    if (!hits.length) return;
    const idx = (next + hits.length) % hits.length;
    setActiveHit(idx);
    const el = document.getElementById(`msg-${hits[idx]}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const [editDraft, setEditDraft] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    index: number;
    role: 'user' | 'model';
    isLast: boolean;
  } | null>(null);

  // Modal de Estudio Creativo (Bardo / Imagen / Video / Voz)
  const [studioModal, setStudioModal] = useState<{
    isOpen: boolean;
    tab: 'music' | 'image' | 'video' | 'voice';
    sceneText?: string;
  } | null>(null);

  // Reconocimiento y Dictado por Voz en tiempo real
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      alert('Tu navegador no soporta reconocimiento de voz nativo en esta ventana. Por favor prueba con Google Chrome, Edge o Safari.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'es-ES';

      let accumulated = '';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            accumulated += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInputText(prev => {
          const base = prev.trim();
          const spoken = (accumulated || interim).trim();
          if (!base) return spoken;
          if (base.endsWith(spoken)) return base;
          return `${base} ${spoken}`;
        });
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error/warning:', event.error);
        if (event.error === 'not-allowed') {
          alert('Permiso de micrófono denegado. Permite el acceso al micrófono en el navegador para dictar tus acciones de rol.');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setIsListening(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editingIndex === null) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat?.messages?.length, isGenerating]);

  // El resultado lo decide App.tsx y nos lo devuelve: antes se tiraba dos veces
  // (una para la animación y otra para el texto) y enseñaban números distintos.
  const showRoll = (sides: number, result: number) => {
    setActiveRoll({ sides, result });
    setTimeout(() => {
      setActiveRoll(null);
    }, 2500);
  };

  const handleDieClick = (sides: number) => {
    showRoll(sides, onRollDice(sides));
  };

  const handleRollRequestClick = (req: RollRequest) => {
    showRoll(20, onRollRequest(req));
  };

  const consultarOraculo = (pregunta: string) => {
    if (!onOracleAsk || !pregunta.trim()) return;
    showRoll(100, onOracleAsk(pregunta, probabilidad));
    setPreguntaOraculo('');
    setOraculoAbierto(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFileUpload(droppedFiles);
    }
  };

  const handleStartEditing = (idx: number, currentContent: string) => {
    setEditingIndex(idx);
    setEditDraft(currentContent);
  };

  const handleCancelEditing = () => {
    setEditingIndex(null);
    setEditDraft('');
  };

  const handleSaveEditOnly = async (idx: number) => {
    if (!editDraft.trim()) return;
    await onEditMessage(idx, editDraft.trim());
    setEditingIndex(null);
    setEditDraft('');
  };

  const handleSaveAndRegenerate = async (idx: number) => {
    if (!editDraft.trim()) return;
    const text = editDraft.trim();
    setEditingIndex(null);
    setEditDraft('');
    await onRegenerateMessage(idx, text);
  };

  const handleCopyMessage = async (idx: number, content: string) => {
    try {
      const cleanContent = formatNarrativeText(content);
      await navigator.clipboard.writeText(cleanContent || content);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-color)] relative font-lora"
    >
      {/* Visual overlay when dragging files onto chat */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-amber-900/60 backdrop-blur-xs z-50 flex flex-col items-center justify-center text-white border-4 border-dashed border-amber-300 pointer-events-none animate-[fadeIn_0.15s_ease]">
          <Library className="w-12 h-12 mb-3 opacity-40" strokeWidth={1.5} />
          <h3 className="font-cinzel text-xl md:text-2xl font-bold">
            ¡Suelta los archivos para añadirlos a la campaña!
          </h3>
          <p className="text-sm opacity-90">
            Se procesarán todos los archivos juntos y estarán disponibles para el Narrador.
          </p>
        </div>
      )}

      {/* Top Header Bar: misma altura, posición y diseño que la barra de la Novela */}
      <div className="bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] border-b border-[var(--glass-border)] px-3 sm:px-4 md:px-6 py-2.5 flex justify-between items-center gap-2 md:gap-3 shadow-2xs shrink-0 z-10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Selector de modo de lectura integrado: idéntico en Crónica y Novela */}
          <div className="inline-flex items-center rounded-lg border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-0.5 text-xs font-cinzel shadow-2xs shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs" title="Modo Crónica / Juego">
              <Swords className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Crónica</span>
            </span>
            {onOpenNovelReader && (
              <button
                onClick={onOpenNovelReader}
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] cursor-pointer transition-all"
                title="Cambiar a la vista de lectura inmersiva tipo Novela / Tomo Antiguo"
                aria-label="Modo Novela"
              >
                <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Novela</span>
              </button>
            )}
          </div>

          <span className="border-r border-[var(--glass-border)] h-4 hidden sm:inline shrink-0" />

          <h3
            className="font-cinzel text-xs sm:text-sm md:text-base font-bold text-[var(--accent)] m-0 truncate"
            title={chat?.name || `Capítulo ${chapterIndex + 1}`}
          >
            {chat?.name || `Capítulo ${chapterIndex + 1}`}
          </h3>
        </div>

        {/* Acciones de la Crónica alineadas a la derecha */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Buscador dentro del capítulo */}
          {isSearchOpen ? (
            <div className="flex items-center gap-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg px-2 py-1 shadow-2xs">
              <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
              <input
                autoFocus
                value={chronicleQuery}
                onChange={e => setChronicleQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') goToHit(e.shiftKey ? activeHit - 1 : activeHit + 1);
                  if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                    setChronicleQuery('');
                  }
                }}
                placeholder="Buscar..."
                className="bg-transparent outline-none text-xs font-lora w-24 sm:w-44 md:w-56"
              />
              {chronicleQuery.trim().length > 1 && (
                <span className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] tabular-nums shrink-0">
                  {hits.length ? `${activeHit + 1}/${hits.length}` : '0'}
                </span>
              )}
              <button
                onClick={() => goToHit(activeHit - 1)}
                disabled={!hits.length}
                className="px-1 text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-30 cursor-pointer"
                title="Anterior"
              >
                ↑
              </button>
              <button
                onClick={() => goToHit(activeHit + 1)}
                disabled={!hits.length}
                className="px-1 text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-30 cursor-pointer"
                title="Siguiente"
              >
                ↓
              </button>
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setChronicleQuery('');
                }}
                className="px-1 text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
                title="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] hover:bg-[var(--glass)] px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
              title="Buscar dentro de este capítulo"
              aria-label="Buscar"
            >
              <Search className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Buscar</span>
            </button>
          )}

          <button
            onClick={onExportPDF}
            disabled={isGenerating || !chat?.messages?.length}
            className="text-xs font-cinzel font-bold text-[var(--on-accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-2 sm:px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-30 transition-all flex items-center gap-1.5 shadow-2xs"
            title="Exportar este capítulo como libro ilustrado en PDF"
            aria-label="Exportar PDF"
          >
            <Scroll className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Exportar Tomo (PDF)</span>
          </button>
        </div>
      </div>

      {/* En pantallas estrechas no hay barra lateral visible, así que el estado del
          personaje se mantiene como franja plegable sobre la narración. */}
      {onUpdatePlayerCharacter && (
        <div className="md:hidden">
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-2 md:py-4 flex flex-col">
        {/* Columna de lectura: mismo ancho que la barra de escritura */}
        <div className="w-full max-w-[850px] mx-auto flex flex-col">
          {/* Chapter Header Ornamental */}
          <div className="text-center my-2 md:my-4 relative">
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent" />
            <div className="inline-block relative bg-[var(--bg-color)] px-4">
              <h2 className="font-cinzel text-base sm:text-lg md:text-xl text-[var(--accent)] font-bold tracking-wider m-0">
                {chat?.name || `Capítulo ${chapterIndex + 1}`}
              </h2>
              {isBackgroundSyncing && (
                <div className="mt-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-cinzel font-semibold animate-pulse shadow-2xs"
                    title="El Narrador está asimilando nuevos detalles para las fichas y el diario..."
                  >
                    <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando memoria...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Message List */}
          <div className="flex flex-col gap-6 md:gap-8 pb-4">
            {!chat?.messages || chat.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-6 sm:py-10 px-4 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full border border-[var(--accent)]/30 bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] flex items-center justify-center mb-3 shadow-2xs">
                  <Scroll className="w-6 h-6 text-[var(--accent)]" />
                </div>
                <h3 className="font-cinzel font-bold text-sm sm:text-base text-[var(--accent)] mb-1">
                  El pergamino aguarda
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] italic font-lora leading-relaxed">
                  Escribe la primera acción de tu personaje o lanza los dados para que el Narrador comience el relato.
                </p>
              </div>
            ) : (
              chat.messages.map((m, idx) => {
                const isEditing = editingIndex === idx;
                const isLastMessage = idx === chat.messages.length - 1;
                const isSearchHit = hits.length > 0 && hits[activeHit] === idx;

                return (
                  <ChatMessageItem
                    key={idx}
                    m={m}
                    idx={idx}
                    isEditing={isEditing}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    isLastMessage={isLastMessage}
                    isGenerating={isGenerating}
                    hasOracle={Boolean(hasOracle)}
                    isSearchHit={isSearchHit}
                    copiedIndex={copiedIndex}
                    handleCopyMessage={handleCopyMessage}
                    handleStartEditing={handleStartEditing}
                    handleCancelEditing={handleCancelEditing}
                    handleSaveEditOnly={handleSaveEditOnly}
                    handleSaveAndRegenerate={handleSaveAndRegenerate}
                    onContinueNarrative={onContinueNarrative}
                    onRegenerateMessage={onRegenerateMessage}
                    setDeleteModal={setDeleteModal}
                    setPreguntaOraculo={setPreguntaOraculo}
                    setOraculoAbierto={setOraculoAbierto}
                    handleRollRequestClick={handleRollRequestClick}
                    onOpenStudio={(tab, sceneText) =>
                      setStudioModal({ isOpen: true, tab, sceneText })
                    }
                  />
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="px-2.5 sm:px-4 md:px-8 pt-2.5 pb-4 md:py-5 border-t border-dashed border-[var(--glass-border)] bg-gradient-to-t from-[color-mix(in_srgb,var(--sidebar-bg)_95%,transparent)] to-transparent">
        {/* Mientras narra: aviso discreto y botón de detener, sin tapar el texto */}
        {isStreaming && (
          <div className="max-w-[900px] mx-auto mb-2 flex items-center justify-center gap-3">
            <span className="flex items-center gap-2 text-[11px] font-cinzel text-[var(--text-secondary)] italic text-center">
              <span className="inline-block w-3 h-3 shrink-0 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              {streamingStatus || 'El Narrador está escribiendo...'}
            </span>
            {onStopGeneration && (
              <button
                onClick={onStopGeneration}
                className="text-[11px] font-cinzel font-bold text-red-800 hover:text-white hover:bg-red-700 border border-red-300 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-3 py-1 rounded-full shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Detener la narración y conservar lo que lleva escrito"
              >
                <Square className="w-3 h-3" /> Detener
              </button>
            )}
          </div>
        )}

        {/* Quick Continue Prompt Bar if there are messages */}
        {chat?.messages && chat.messages.length > 0 && !isGenerating && (
          <div className="max-w-[900px] mx-auto mb-2 flex justify-end">
            <button
              onClick={() => onContinueNarrative()}
              className="text-xs font-cinzel font-bold text-[var(--accent)] hover:text-[var(--on-accent)] hover:bg-[var(--accent)] border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-3 py-1 rounded-full shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Pide al Narrador que continúe narrando la escena actual sin escribir un nuevo mensaje"
            >
              <Play className="w-3.5 h-3.5" /> Continuar Narración
            </button>
          </div>
        )}

        {/* Dice Bar & Roll Result */}
        <div className="max-w-[900px] mx-auto mb-2 flex flex-col items-center gap-2">
          {activeRoll && (
            <div className="animate-[bounce_1s_infinite] bg-gradient-to-r from-[var(--surface)] via-[var(--bg-color)] to-[var(--surface)] text-[var(--text-primary)] px-4 py-2 rounded-2xl shadow-xl shadow-black/25 border-2 border-[var(--accent)] flex items-center gap-3 z-30">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-cinzel font-bold text-xs sm:text-sm shadow-md border ${
                activeRoll.result === 20 && activeRoll.sides === 20
                  ? 'bg-gradient-to-br from-amber-400 to-amber-600 border-amber-300 text-amber-950 shadow-amber-500/40'
                  : activeRoll.result === 1 && activeRoll.sides === 20
                    ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-300 text-white shadow-red-500/40'
                    : 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] border-amber-300/40 text-[var(--on-accent)] shadow-amber-900/30'
              }`}>
                {activeRoll.sides === 20 ? 'd20' : `d${activeRoll.sides}`}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-cinzel text-xs font-semibold text-[var(--text-secondary)]">Resultado:</span>
                  <span className={`font-cinzel text-lg sm:text-xl font-black ${
                    activeRoll.result === 20 && activeRoll.sides === 20
                      ? 'text-amber-500 dark:text-amber-300 drop-shadow-sm'
                      : activeRoll.result === 1 && activeRoll.sides === 20
                        ? 'text-red-500 dark:text-red-400 drop-shadow-sm'
                        : 'text-[var(--accent)]'
                  }`}>
                    {activeRoll.result}
                  </span>
                  {activeRoll.result === 20 && activeRoll.sides === 20 && (
                    <span className="text-[10px] font-cinzel font-bold bg-amber-400/25 text-amber-600 dark:text-amber-300 border border-amber-400/50 px-2 py-0.5 rounded-full shadow-xs">
                      ¡Éxito Crítico!
                    </span>
                  )}
                  {activeRoll.result === 1 && activeRoll.sides === 20 && (
                    <span className="text-[10px] font-cinzel font-bold bg-red-400/25 text-red-600 dark:text-red-300 border border-red-400/50 px-2 py-0.5 rounded-full shadow-xs">
                      ¡Pifia!
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--text-secondary)] font-lora italic">Añadido automáticamente a tu mensaje</span>
              </div>
            </div>
          )}

          {/* Consulta al oráculo. La probabilidad la pones tú: si la pusiera el
              Narrador, elegiría la que le conviene y el oráculo sería decorado. */}
          {hasOracle && oraculoAbierto && (
            <div className="w-full max-w-[900px] rounded-xl border border-indigo-400/50 bg-gradient-to-b from-indigo-500/10 via-[var(--surface-soft)] to-[var(--surface-soft)] p-3.5 space-y-2.5 shadow-lg shadow-indigo-950/10">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-cinzel text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" /> Consulta al Oráculo
                </span>
                <button
                  onClick={() => setOraculoAbierto(false)}
                  className="text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer p-1 rounded hover:bg-indigo-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                value={preguntaOraculo}
                onChange={e => setPreguntaOraculo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') consultarOraculo(preguntaOraculo);
                }}
                autoFocus
                placeholder="Pregunta de sí o no. Ej: «¿El tabernero oculta un pasadizo secreto?»"
                className="w-full bg-[var(--bg-color)] border border-indigo-300/40 rounded-lg px-3 py-2 text-sm font-lora outline-none focus:border-indigo-500 shadow-inner"
              />

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={probabilidad}
                  onChange={e => setProbabilidad(e.target.value)}
                  className="bg-[var(--bg-color)] border border-indigo-300/40 rounded-lg px-2.5 py-1.5 text-xs font-cinzel outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
                  title="Cómo de probable te parece que la respuesta sea SÍ"
                >
                  {PROBABILIDADES.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => consultarOraculo(preguntaOraculo)}
                  disabled={!preguntaOraculo.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3.5 py-1.5 font-cinzel text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:brightness-110 disabled:opacity-40 cursor-pointer transition-all"
                >
                  <Dices className="w-3.5 h-3.5" /> Tirar d100 y Preguntar
                </button>

                {onOracleMeaning && (
                  <button
                    onClick={() => {
                      onOracleMeaning();
                      setOraculoAbierto(false);
                    }}
                    className="ml-auto rounded-lg border border-teal-400/40 bg-teal-500/10 px-3 py-1.5 font-cinzel text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 hover:border-teal-400 cursor-pointer transition-all shadow-xs"
                    title="Dos tiradas en tus tablas de significado, sin pregunta de sí o no"
                  >
                    Descubrir significado
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Barra de dados con estilizado temático por dado */}
          <div className="flex gap-1 sm:gap-1.5 md:gap-2 justify-center items-center flex-wrap">
            {hasOracle && (
              <button
                onClick={() => setOraculoAbierto(v => !v)}
                className={`rounded-lg px-2 sm:px-3 py-1 text-xs font-cinzel font-semibold border transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${
                  oraculoAbierto
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/30'
                    : 'bg-[var(--msg-user)] text-indigo-700 dark:text-indigo-300 border-indigo-300/40 hover:border-indigo-400 hover:bg-indigo-500/15 hover:scale-105 active:scale-95'
                }`}
                title="Consultar tus tablas de oráculo"
                aria-label="Oráculo"
              >
                <Sparkles className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Oráculo</span>
              </button>
            )}

            {[
              {
                sides: 20,
                label: 'd20',
                theme:
                  'border-amber-700/60 dark:border-amber-400/60 text-amber-950 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 shadow-amber-950/10'
              },
              {
                sides: 12,
                label: 'd12',
                theme:
                  'border-purple-700/60 dark:border-purple-400/60 text-purple-950 dark:text-purple-200 bg-purple-100/90 dark:bg-purple-950/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 shadow-purple-950/10'
              },
              {
                sides: 10,
                label: 'd10',
                theme:
                  'border-blue-700/60 dark:border-blue-400/60 text-blue-950 dark:text-blue-200 bg-blue-100/90 dark:bg-blue-950/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 shadow-blue-950/10'
              },
              {
                sides: 8,
                label: 'd8',
                theme:
                  'border-emerald-700/60 dark:border-emerald-400/60 text-emerald-950 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 shadow-emerald-950/10'
              },
              {
                sides: 6,
                label: 'd6',
                theme:
                  'border-rose-700/60 dark:border-rose-400/60 text-rose-950 dark:text-rose-200 bg-rose-100/90 dark:bg-rose-950/40 hover:bg-rose-200 dark:hover:bg-rose-900/60 shadow-rose-950/10'
              },
              {
                sides: 4,
                label: 'd4',
                theme:
                  'border-orange-700/60 dark:border-orange-400/60 text-orange-950 dark:text-orange-200 bg-orange-100/90 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 shadow-orange-950/10'
              },
              {
                sides: 100,
                label: 'd100',
                theme:
                  'border-teal-700/60 dark:border-teal-400/60 text-teal-950 dark:text-teal-200 bg-teal-100/90 dark:bg-teal-950/40 hover:bg-teal-200 dark:hover:bg-teal-900/60 shadow-teal-950/10'
              }
            ].map(d => (
              <button
                key={d.sides}
                onClick={() => handleDieClick(d.sides)}
                className={`rounded-lg px-2 sm:px-3 py-1 text-xs font-cinzel font-bold border transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95 ${d.theme}`}
                title={`Tirar dado de ${d.sides} caras y añadir al mensaje`}
                aria-label={d.label}
              >
                {d.label}
              </button>
            ))}

            {/* Separador de herramientas creativas */}
            <span className="hidden sm:inline border-r border-[var(--glass-border)] h-5 my-auto mx-1" />

            {/* Botón de Música & Bardo */}
            <button
              onClick={() => {
                const lastModelMsg = [...(chat?.messages || [])].reverse().find(m => m.role === 'model')?.content || '';
                setStudioModal({ isOpen: true, tab: 'music', sceneText: lastModelMsg });
              }}
              className="rounded-lg px-2 sm:px-3 py-1 text-xs font-cinzel font-bold border border-purple-700/60 dark:border-purple-400/60 bg-purple-100/90 dark:bg-purple-950/50 text-purple-950 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900/60 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              title="Música ambiental, sintetizador de laúd/taberna, canciones de YouTube y Spotify"
              aria-label="Bardo & Música"
            >
              <Music className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Bardo & Música</span>
            </button>

            {/* Botón de Taller Creativo (Imágenes, Cinemática y Escena) */}
            <button
              onClick={() => {
                const lastModelMsg = [...(chat?.messages || [])].reverse().find(m => m.role === 'model')?.content || '';
                setStudioModal({ isOpen: true, tab: 'image', sceneText: lastModelMsg });
              }}
              className="rounded-lg px-2 sm:px-3 py-1 text-xs font-cinzel font-bold border border-amber-700/60 dark:border-amber-400/60 bg-amber-100/90 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              title="Taller multimedia: Generar ilustraciones de escenas, retratos de personajes y videos cinemáticos a partir de la escena"
              aria-label="Taller Creativo"
            >
              <Wand2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Taller Creativo</span>
            </button>
          </div>
        </div>

        {/* Input Field & Attachments */}
        <div className="max-w-[900px] mx-auto bg-[var(--bg-color)] border border-[var(--user-border)] rounded-xl px-2.5 sm:px-3.5 md:px-4 py-1.5 md:py-2 flex items-center gap-1.5 sm:gap-2 md:gap-3 shadow-inner focus-within:border-[var(--accent)] focus-within:shadow-md transition-all">
          <input
            type="file"
            multiple
            accept=".txt,.md,.pdf,.json,image/*,audio/*"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                onFileUpload(Array.from(e.target.files));
              }
              e.target.value = '';
            }}
            className="hidden"
            id="chat-file-upload"
          />
          <label
            htmlFor="chat-file-upload"
            className="text-[var(--accent)] w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 hover:bg-[var(--glass)] active:scale-95 transition-all cursor-pointer text-base"
            title="Adjuntar múltiples documentos, imágenes o audios a la campaña"
          >
            <Paperclip className="w-4 h-4" />
          </label>

          {/* Botón de dictado por voz (Micrófono) */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isListening
                ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-500/40 ring-2 ring-red-400'
                : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] active:scale-95'
            }`}
            title={isListening ? 'Detener dictado por voz' : 'Dictar tu acción por voz (Micrófono en vivo)'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <textarea
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              // Auto-ajustar altura suavemente
              const target = e.target;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder={isListening ? '🎙️ Escuchando... habla con normalidad...' : '¿Qué hace tu personaje? (Escribe o pulsa el micrófono para dictar)'}
            className="flex-1 bg-transparent border-none text-[var(--text-primary)] text-sm sm:text-base md:text-lg outline-none resize-none min-h-[38px] max-h-[140px] md:max-h-[220px] py-2 px-1 font-lora leading-normal placeholder:text-[var(--text-secondary)] placeholder:opacity-60 overflow-y-auto"
            rows={1}
          />
          <button
            onClick={onSendMessage}
            disabled={isGenerating || !inputText.trim()}
            className="bg-[var(--accent)] text-[var(--on-accent)] w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#5a0000] flex items-center justify-center shrink-0 hover:bg-[var(--accent-hover)] active:scale-95 transition-all disabled:opacity-30 shadow-2xs cursor-pointer"
            title="Enviar acción"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete / Rollback Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-color)] p-6 rounded-lg shadow-2xl border border-[var(--glass-border)] max-w-md w-full font-lora">
            <h4 className="font-cinzel text-lg text-[var(--accent)] mb-2 font-bold flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" /> Opciones de Borrado
            </h4>
            <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
              ¿Cómo deseas eliminar este turno de la crónica?
            </p>

            <div className="flex flex-col gap-2.5 mb-5">
              <button
                onClick={async () => {
                  const idx = deleteModal.index;
                  setDeleteModal(null);
                  await onDeleteMessage(idx, false);
                }}
                className="w-full text-left p-3 rounded border border-[var(--user-border)] bg-[var(--surface)] hover:bg-amber-50 cursor-pointer transition-colors"
              >
                <div className="font-cinzel font-bold text-xs text-[var(--text-primary)] mb-0.5">
                  <Trash2 className="w-3.5 h-3.5" /> Borrar solo este mensaje
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Elimina exclusivamente este turno sin tocar los mensajes anteriores ni posteriores.
                </div>
              </button>

              {!deleteModal.isLast && (
                <button
                  onClick={async () => {
                    const idx = deleteModal.index;
                    setDeleteModal(null);
                    await onDeleteMessage(idx, true);
                  }}
                  className="w-full text-left p-3 rounded border border-red-300 bg-red-50/70 hover:bg-red-100/80 cursor-pointer transition-colors"
                >
                  <div className="font-cinzel font-bold text-xs text-red-800 mb-0.5 flex items-center gap-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5" />
                      Rebobinar historia desde aquí
                    </span>
                    <span className="text-[10px] bg-red-200 px-1.5 py-0.2 rounded font-bold">
                      Recomendado para roleo
                    </span>
                  </div>
                  <div className="text-[11px] text-red-700">
                    Borra este mensaje <strong>y todos los mensajes posteriores</strong>, permitiéndote
                    re-tomar la historia desde este punto exacto.
                  </div>
                </button>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creative Studio Modal (Bardo, Música, Imagen, Video, Voz) */}
      {studioModal?.isOpen && (
        <CreativeStudioModal
          isOpen={studioModal.isOpen}
          initialTab={studioModal.tab}
          sceneText={studioModal.sceneText}
          onClose={() => setStudioModal(null)}
          onInsertIntoChat={(text: string) => {
            setInputText(prev => (prev ? `${prev}\n\n${text}` : text));
          }}
        />
      )}
    </div>
  );
};
