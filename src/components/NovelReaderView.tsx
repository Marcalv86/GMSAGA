import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, Chat, Message } from '../types';
import { stripRollRequests, stripStateTag } from '../utils/rollRequests';
import { formatNarrativeText } from '../utils/textFormatter';
import { exportNovelToPDF, exportNovelToMarkdown } from '../utils/pdfExport';
import { novelizeUserMessage, batchNovelizeMessages } from '../utils/geminiHelper';
import {
  AlertCircle,
  Swords,
  Shield,
  FileDown,
  BookOpen,
  FileText,
  Check,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  Edit3,
  RefreshCw,
  X
} from 'lucide-react';

type ReaderTheme = 'parchment' | 'dark' | 'sepia' | 'light';
export type PlayerActionsMode = 'novelized' | 'original' | 'hidden';

export interface NovelReaderViewProps {
  project: Project;
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onBackToChat: () => void;
  onUpdateChatMessages?: (chatId: string, messages: Message[]) => void;
}

export const NovelReaderView: React.FC<NovelReaderViewProps> = ({
  project,
  chats = [],
  currentChatId,
  onSelectChat,
  onBackToChat,
  onUpdateChatMessages
}) => {
  const [selectedScope, setSelectedScope] = useState<'current' | 'all'>('current');
  const [theme, setTheme] = useState<ReaderTheme>('parchment');
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [playerActionsMode, setPlayerActionsMode] = useState<PlayerActionsMode>('novelized');
  const [isExporting, setIsExporting] = useState(false);

  // Estados interactivos para novelización y edición
  const [novelizingIdx, setNovelizingIdx] = useState<string | null>(null);
  const [isBatchNovelizing, setIsBatchNovelizing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [editingIdx, setEditingIdx] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [expandedOriginals, setExpandedOriginals] = useState<Record<string, boolean>>({});

  const safeChats = Array.isArray(chats) ? chats : [];
  const activeChat = safeChats.find(c => c.id === currentChatId) || safeChats[0];

  // Definiciones de paletas para los temas de lectura
  const themeStyles = {
    parchment: {
      bg: 'bg-[#f4ecd8]',
      pageBg: 'bg-[#fdfaf3]',
      border: 'border-[#c5a059]/40',
      text: 'text-[#2d201c]',
      accent: 'text-[#8b0000]',
      subtext: 'text-[#5e473c]',
      headerBg: 'bg-[#e8dcc4]',
      badgeBg: 'bg-[#c5a059]/20 text-[#2d201c]'
    },
    dark: {
      bg: 'bg-[#181210]',
      pageBg: 'bg-[#221815]',
      border: 'border-[#c5a059]/30',
      text: 'text-[#e6dbcf]',
      accent: 'text-[#e5a855]',
      subtext: 'text-[#a89587]',
      headerBg: 'bg-[#140e0c]',
      badgeBg: 'bg-[#e5a855]/20 text-[#e5a855]'
    },
    sepia: {
      bg: 'bg-[#ebdec9]',
      pageBg: 'bg-[#f5ede0]',
      border: 'border-[#8b5a2b]/30',
      text: 'text-[#362415]',
      accent: 'text-[#702910]',
      subtext: 'text-[#614532]',
      headerBg: 'bg-[#decaad]',
      badgeBg: 'bg-[#8b5a2b]/20 text-[#362415]'
    },
    light: {
      bg: 'bg-[#f7f7f9]',
      pageBg: 'bg-[#ffffff]',
      border: 'border-[#d0d0d8]',
      text: 'text-[#242426]',
      accent: 'text-[#6b1d1d]',
      subtext: 'text-[#666670]',
      headerBg: 'bg-[#ebebee]',
      badgeBg: 'bg-[#e0e0e5] text-[#242426]'
    }
  };

  const currentTheme = themeStyles[theme];

  const fontSizeClasses = {
    sm: 'text-[15px] leading-relaxed',
    md: 'text-[17px] leading-[1.75]',
    lg: 'text-[19px] leading-[1.8]',
    xl: 'text-[22px] leading-[1.85]'
  };

  // Preparar capítulos a renderizar
  const chaptersToRender = selectedScope === 'all' ? safeChats : activeChat ? [activeChat] : [];

  // Calcular número total de palabras
  const totalWords = chaptersToRender.reduce((acc, ch) => {
    return (
      acc +
      (ch?.messages || []).reduce(
        (mAcc, m) =>
          mAcc +
          (playerActionsMode === 'novelized' && m.novelContent ? m.novelContent : m?.content || '')
            .split(/\s+/)
            .filter(Boolean).length,
        0
      )
    );
  }, 0);
  const readingTimeMin = Math.max(1, Math.round(totalWords / 200));

  // Conteo de respuestas del jugador pendientes de novelar
  const pendingCount = chaptersToRender.reduce((acc, ch) => {
    return acc + (ch?.messages || []).filter(m => m.role === 'user' && !m.novelContent).length;
  }, 0);

  const pcName = project.memory?.player_character?.name || 'la protagonista';

  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<'pdf' | 'md' | null>(null);
  const [novelError, setNovelError] = useState<string | null>(null);

  const toggleOriginal = (key: string) => {
    setExpandedOriginals(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNovelizeSingle = async (chapter: Chat, msgIndex: number) => {
    const key = `${chapter.id}_${msgIndex}`;
    setNovelizingIdx(key);
    try {
      const rawMsg = chapter.messages[msgIndex];
      if (!rawMsg || rawMsg.role !== 'user') return;

      const prevModel = [...chapter.messages.slice(0, msgIndex)]
        .reverse()
        .find(m => m.role === 'model')?.content;
      const nextModel = chapter.messages.slice(msgIndex + 1).find(m => m.role === 'model')?.content;

      const novelText = await novelizeUserMessage({
        rawInput: rawMsg.content,
        project,
        previousNarrative: prevModel,
        nextNarrative: nextModel
      });

      if (novelText && onUpdateChatMessages) {
        const updatedMessages = [...chapter.messages];
        updatedMessages[msgIndex] = {
          ...rawMsg,
          novelContent: novelText
        };
        onUpdateChatMessages(chapter.id, updatedMessages);
      }
    } catch (err: any) {
      console.error('Error al novelar mensaje:', err);
      setNovelError('No se pudo generar la prosa novelada: ' + (err?.message || 'Error de conexión'));
      setTimeout(() => setNovelError(null), 5000);
    } finally {
      setNovelizingIdx(null);
    }
  };

  const handleBatchNovelize = async (forceAll: boolean = false) => {
    if (chaptersToRender.length === 0 || isBatchNovelizing) return;
    setIsBatchNovelizing(true);
    try {
      for (const chapter of chaptersToRender) {
        const userMsgsToProcess = chapter.messages.filter(m => m.role === 'user' && (forceAll || !m.novelContent));
        if (userMsgsToProcess.length === 0) continue;

        const updatedMessages = await batchNovelizeMessages({
          messages: chapter.messages,
          project,
          forceAll,
          onProgress: (curr, tot) => {
            setBatchProgress({ current: curr, total: tot });
          }
        });

        if (onUpdateChatMessages) {
          onUpdateChatMessages(chapter.id, updatedMessages);
        }
      }
    } catch (err: any) {
      console.error('Error en novelización por lote:', err);
    } finally {
      setIsBatchNovelizing(false);
      setBatchProgress(null);
    }
  };

  const handleStartEdit = (
    chapterId: string,
    msgIndex: number,
    currentNovelContent?: string,
    rawContent?: string
  ) => {
    setEditingIdx(`${chapterId}_${msgIndex}`);
    setEditDraft(currentNovelContent || rawContent || '');
  };

  const handleSaveEdit = (chapter: Chat, msgIndex: number) => {
    if (!onUpdateChatMessages) return;
    const updatedMessages = [...chapter.messages];
    updatedMessages[msgIndex] = {
      ...updatedMessages[msgIndex],
      novelContent: editDraft.trim()
    };
    onUpdateChatMessages(chapter.id, updatedMessages);
    setEditingIdx(null);
    setEditDraft('');
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditDraft('');
  };

  const handleExportPDF = async () => {
    if (chaptersToRender.length === 0) return;
    setIsExporting(true);
    setExportProgress('Iniciando maquetación de PDF...');
    try {
      await exportNovelToPDF(project, chaptersToRender, {
        scope: selectedScope,
        showPlayerActions: playerActionsMode !== 'hidden',
        playerActionsMode,
        onProgress: msg => setExportProgress(msg)
      });
      setExportSuccess('pdf');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error exporting PDF:', err);
      setExportProgress('Error al exportar: ' + (err?.message || 'Error desconocido'));
      setTimeout(() => setExportProgress(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMarkdown = () => {
    if (chaptersToRender.length === 0) return;
    try {
      exportNovelToMarkdown(project, chaptersToRender, {
        scope: selectedScope,
        showPlayerActions: playerActionsMode !== 'hidden',
        playerActionsMode,
        format: 'md'
      });
      setExportSuccess('md');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error exporting Markdown:', err);
      setNovelError('Error al exportar el texto: ' + (err?.message || 'Error desconocido'));
      setTimeout(() => setNovelError(null), 5000);
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden ${currentTheme.bg} font-lora transition-colors duration-200`}
    >
      {/* Top Reader Controls Bar: Misma barra, altura y alineación que en el Modo Crónica */}
      <div
        className={`${currentTheme.headerBg} border-b ${currentTheme.border} px-3 sm:px-4 md:px-6 py-2.5 flex justify-between items-center flex-wrap gap-2 md:gap-3 shadow-2xs shrink-0 z-10`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Selector de modo de lectura integrado: idéntico en Crónica y Novela */}
          <div className="inline-flex items-center rounded-lg border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-0.5 text-xs font-cinzel shadow-2xs shrink-0">
            <button
              onClick={onBackToChat}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] cursor-pointer transition-all"
              title="Volver al modo de juego interactivo"
              aria-label="Volver al juego"
            >
              <Swords className="w-3.5 h-3.5" /> <span>Jugar</span>
            </button>
            <span
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs"
              title="Modo lectura de novela activo"
            >
              <BookOpen className="w-3.5 h-3.5" /> <span>Novela</span>
            </span>
          </div>

          <span className="border-r border-[var(--glass-border)] h-4 hidden sm:inline shrink-0" />

          <h3
            className={`font-cinzel text-xs sm:text-sm md:text-base font-bold ${currentTheme.accent} m-0 truncate max-w-[130px] sm:max-w-[180px] md:max-w-[280px]`}
            title={project.name}
          >
            {project.name}
          </h3>
        </div>

        {/* Customization Toolbar */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-wrap">
          {/* Scope Selector: Single Chapter vs All Chapters */}
          <div className="flex bg-black/10 rounded-lg p-0.5 border border-black/10 text-xs font-cinzel">
            <button
              onClick={() => setSelectedScope('current')}
              className={`px-2 sm:px-2.5 py-1 rounded transition-all cursor-pointer ${
                selectedScope === 'current'
                  ? `${currentTheme.pageBg} ${currentTheme.text} font-bold shadow-xs`
                  : `${currentTheme.subtext} hover:opacity-100`
              }`}
              title="Ver solo el capítulo actual"
            >
              <span className="hidden sm:inline">Capítulo</span>
              <span className="sm:hidden">Cap</span>
            </button>
            <button
              onClick={() => setSelectedScope('all')}
              className={`px-2 sm:px-2.5 py-1 rounded transition-all cursor-pointer ${
                selectedScope === 'all'
                  ? `${currentTheme.pageBg} ${currentTheme.text} font-bold shadow-xs`
                  : `${currentTheme.subtext} hover:opacity-100`
              }`}
              title="Ver toda la novela"
            >
              <span className="hidden sm:inline">Toda la Novela</span>
              <span className="sm:hidden">Todo</span>
            </button>
          </div>

          {/* Chapter dropdown when in single mode */}
          {selectedScope === 'current' && (
            <select
              value={currentChatId || ''}
              onChange={e => onSelectChat(e.target.value)}
              className={`text-xs font-cinzel p-1.5 rounded border ${currentTheme.border} ${currentTheme.pageBg} ${currentTheme.text} outline-none cursor-pointer max-w-[110px] sm:max-w-[150px] truncate`}
            >
              {chats.map((c, i) => (
                <option key={c.id} value={c.id}>
                  Cap. {i + 1}: {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Mode Selector for Player Actions */}
          <div className="flex bg-black/10 rounded-lg p-0.5 border border-black/10 text-xs font-cinzel">
            <button
              onClick={() => setPlayerActionsMode('novelized')}
              className={`px-2 sm:px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                playerActionsMode === 'novelized'
                  ? `${currentTheme.pageBg} ${currentTheme.text} font-bold shadow-xs`
                  : `${currentTheme.subtext} hover:opacity-100`
              }`}
              title="Prosa Novelada: transforma las respuestas de la jugadora en literatura bella y fluida"
            >
              <Sparkles className="w-3 h-3 text-[var(--accent)]" />
              <span className="hidden md:inline">Prosa Novelada</span>
              <span className="md:hidden">Novela</span>
            </button>
            <button
              onClick={() => setPlayerActionsMode('original')}
              className={`px-2 sm:px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                playerActionsMode === 'original'
                  ? `${currentTheme.pageBg} ${currentTheme.text} font-bold shadow-xs`
                  : `${currentTheme.subtext} hover:opacity-100`
              }`}
              title="Originales: ver las respuestas en bruto escritas en el chat"
            >
              <Shield className="w-3 h-3" />
              <span className="hidden md:inline">Originales</span>
              <span className="md:hidden">Bruto</span>
            </button>
            <button
              onClick={() => setPlayerActionsMode('hidden')}
              className={`px-2 sm:px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                playerActionsMode === 'hidden'
                  ? `${currentTheme.pageBg} ${currentTheme.text} font-bold shadow-xs`
                  : `${currentTheme.subtext} hover:opacity-100`
              }`}
              title="Ocultar: omitir los turnos de la jugadora y leer solo la narración continua"
            >
              <EyeOff className="w-3 h-3" />
              <span className="hidden md:inline">Ocultar</span>
              <span className="md:hidden">Off</span>
            </button>
          </div>

          {/* Batch Novelize button if there are pending raw responses */}
          {playerActionsMode === 'novelized' && pendingCount > 0 && (
            <button
              onClick={() => handleBatchNovelize(false)}
              disabled={isBatchNovelizing}
              className="text-xs font-cinzel font-bold px-2 sm:px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title={`Transformar ${pendingCount} respuestas del jugador en prosa literaria con IA`}
            >
              {isBatchNovelizing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              <span>
                {isBatchNovelizing
                  ? `Novelando (${batchProgress?.current || 1}/${batchProgress?.total || pendingCount})...`
                  : `Novelar (${pendingCount})`}
              </span>
            </button>
          )}

          {/* Font Size Selector */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-black/10 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFontSize('sm')}
              className={`w-6 h-6 rounded flex items-center justify-center font-bold cursor-pointer ${
                fontSize === 'sm' ? `${currentTheme.pageBg} ${currentTheme.text} shadow-xs` : `${currentTheme.subtext}`
              }`}
              title="Texto Pequeño"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize('md')}
              className={`w-6 h-6 rounded flex items-center justify-center font-bold cursor-pointer ${
                fontSize === 'md' ? `${currentTheme.pageBg} ${currentTheme.text} shadow-xs` : `${currentTheme.subtext}`
              }`}
              title="Texto Mediano"
            >
              A
            </button>
            <button
              onClick={() => setFontSize('lg')}
              className={`w-6 h-6 rounded flex items-center justify-center font-bold cursor-pointer ${
                fontSize === 'lg' ? `${currentTheme.pageBg} ${currentTheme.text} shadow-xs` : `${currentTheme.subtext}`
              }`}
              title="Texto Grande"
            >
              A+
            </button>
          </div>

          {/* Theme Palette Swatches */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme('parchment')}
              className={`w-5 h-5 rounded-full bg-[#f4ecd8] border-2 cursor-pointer ${
                theme === 'parchment' ? 'border-[var(--accent)] scale-110' : 'border-black/20'
              }`}
              title="Pergamino Clásico"
              aria-label="Tema Pergamino"
            />
            <button
              onClick={() => setTheme('sepia')}
              className={`w-5 h-5 rounded-full bg-[#ebdec9] border-2 cursor-pointer ${
                theme === 'sepia' ? 'border-[var(--accent)] scale-110' : 'border-black/20'
              }`}
              title="Papel Sepia"
              aria-label="Tema Sepia"
            />
            <button
              onClick={() => setTheme('dark')}
              className={`w-5 h-5 rounded-full bg-[#1e1715] border-2 cursor-pointer ${
                theme === 'dark' ? 'border-[#e5a855] scale-110' : 'border-black/20'
              }`}
              title="Modo Nocturno"
              aria-label="Tema Nocturno"
            />
            <button
              onClick={() => setTheme('light')}
              className={`w-5 h-5 rounded-full bg-[#ffffff] border-2 cursor-pointer ${
                theme === 'light' ? 'border-[var(--accent)] scale-110' : 'border-black/20'
              }`}
              title="Lino Claro"
              aria-label="Tema Claro"
            />
          </div>

          {/* Export to Markdown / Text */}
          <button
            onClick={handleExportMarkdown}
            disabled={isExporting}
            className={`text-xs font-cinzel font-bold px-2 sm:px-2.5 py-1 rounded border ${currentTheme.border} ${currentTheme.pageBg} ${currentTheme.text} hover:opacity-100 transition-all cursor-pointer flex items-center gap-1 shadow-xs`}
            title={`Descargar ${selectedScope === 'all' ? 'toda la novela' : 'este capítulo'} en formato texto / Markdown (.md)`}
            aria-label="Descargar Texto"
          >
            {exportSuccess === 'md' ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{exportSuccess === 'md' ? '¡Descargado!' : 'Texto (.md)'}</span>
          </button>

          {/* Export / Print PDF */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className={`text-xs font-cinzel font-bold px-2 sm:px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1 shadow-xs`}
            title={`Exportar ${selectedScope === 'all' ? 'la novela completa' : 'el capítulo actual'} como libro maquetado en PDF`}
            aria-label="Exportar PDF"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : exportSuccess === 'pdf' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isExporting ? 'Maquetando...' : exportSuccess === 'pdf' ? '¡PDF Creado!' : 'PDF'}
            </span>
          </button>
        </div>
      </div>

      {/* Floating Export Progress Notification */}
      {exportProgress && (
        <div className="bg-amber-900/90 text-amber-100 px-4 py-2 text-xs font-cinzel flex items-center justify-center gap-2 shadow-md border-b border-amber-700/60 z-20">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
          <span>{exportProgress}</span>
        </div>
      )}

      {/* Novel Action Error Notification */}
      {novelError && (
        <div className="bg-red-950/90 text-red-200 px-4 py-2 text-xs font-cinzel flex items-center justify-between gap-2 shadow-md border-b border-red-800/60 z-20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>{novelError}</span>
          </div>
          <button
            onClick={() => setNovelError(null)}
            className="text-red-300 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Book Reading Canvas */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-6 md:py-10">
        <div
          className={`w-full max-w-[850px] mx-auto ${currentTheme.pageBg} ${currentTheme.text} ${currentTheme.border} border p-6 sm:p-10 md:p-14 rounded-xl shadow-xl flex flex-col gap-10 relative mb-20`}
        >
          {/* Ornate Novel Cover / Header */}
          <div className="text-center pb-8 border-b border-dashed border-current/20">
            <div className="flex justify-center mb-3">
              <Swords className={`w-10 h-10 ${currentTheme.accent}`} />
            </div>
            <h1
              className={`font-cinzel text-2xl md:text-4xl font-bold ${currentTheme.accent} tracking-widest uppercase mb-2`}
            >
              {project.name}
            </h1>
            <p className={`font-cinzel text-xs md:text-sm tracking-wider uppercase ${currentTheme.subtext}`}>
              Una crónica de tu campaña en los Reinos Olvidados
            </p>
            <div className="flex justify-center items-center gap-4 text-xs mt-4 opacity-75 font-lora">
              <span>{totalWords.toLocaleString('es-ES')} palabras</span>
              <span>•</span>
              <span>~{readingTimeMin} min de lectura</span>
              <span>•</span>
              <span>
                {chaptersToRender.length} capítulo{chaptersToRender.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Chapters Content */}
          {chaptersToRender.map((chapter, cIdx) => {
            // Filtrar mensajes según preferencia
            const visibleMessages =
              playerActionsMode === 'hidden'
                ? chapter.messages.filter(m => m.role === 'model')
                : chapter.messages;

            return (
              <div key={chapter.id} className="flex flex-col gap-6">
                {/* Chapter Title */}
                <div className="text-center pt-6 pb-2">
                  <div className="inline-block relative px-6 py-2">
                    <span
                      className={`font-cinzel text-xs tracking-widest uppercase ${currentTheme.subtext} block mb-1`}
                    >
                      Capítulo {cIdx + 1}
                    </span>
                    <h2
                      className={`font-cinzel text-xl md:text-2xl font-bold ${currentTheme.accent} tracking-wider m-0`}
                    >
                      {chapter.name}
                    </h2>
                    <div className="w-16 h-[2px] bg-current/30 mx-auto mt-3" />
                  </div>
                </div>

                {/* Chapter Body Messages */}
                <div className="flex flex-col gap-5">
                  {visibleMessages.length === 0 ? (
                    <p className="text-center italic opacity-60 py-6">
                      Este capítulo aún no contiene narración registrada.
                    </p>
                  ) : (
                    visibleMessages.map((msg, mIdx) => {
                      const isUser = msg.role === 'user';
                      const msgKey = `${chapter.id}_${mIdx}`;
                      const isEditing = editingIdx === msgKey;
                      const isThisNovelizing = novelizingIdx === msgKey;
                      const isExpanded = Boolean(expandedOriginals[msgKey]);

                      if (isUser) {
                        // MODO 1: Prosa Novelada con IA
                        if (playerActionsMode === 'novelized') {
                          if (msg.novelContent) {
                            return (
                              <div
                                key={mIdx}
                                className="relative my-3 pl-4 pr-3 py-2 rounded-r-lg border-l-2 border-[var(--accent)]/50 bg-black/[0.03] group transition-all"
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5 opacity-70 group-hover:opacity-100 transition-opacity flex-wrap">
                                  <div className="flex items-center gap-1.5 text-[11px] font-cinzel font-semibold tracking-wider text-[var(--accent)]">
                                    <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                                    <span>{pcName ? `Réplica de ${pcName}` : 'Acción Novelada'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => toggleOriginal(msgKey)}
                                      className="text-[11px] px-2 py-0.5 rounded hover:bg-black/10 transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Ver u ocultar el texto original en bruto que enviaste en la partida"
                                    >
                                      {isExpanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                      <span>{isExpanded ? 'Ocultar original' : 'Ver original'}</span>
                                    </button>
                                    <button
                                      onClick={() => handleStartEdit(chapter.id, mIdx, msg.novelContent, msg.content)}
                                      className="text-[11px] px-2 py-0.5 rounded hover:bg-black/10 transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Editar esta prosa manualmente"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      onClick={() => handleNovelizeSingle(chapter, mIdx)}
                                      disabled={isThisNovelizing}
                                      className="text-[11px] px-2 py-0.5 rounded hover:bg-black/10 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      title="Pedirle a la IA que reescriba esta acción con mejor prosa"
                                    >
                                      <RefreshCw className={`w-3 h-3 ${isThisNovelizing ? 'animate-spin' : ''}`} />
                                      <span>Reescribir</span>
                                    </button>
                                  </div>
                                </div>

                                {isEditing ? (
                                  <div className="space-y-2 mt-2">
                                    <textarea
                                      value={editDraft}
                                      onChange={e => setEditDraft(e.target.value)}
                                      rows={3}
                                      className="w-full p-2.5 rounded border border-current/30 bg-white/60 dark:bg-black/40 text-sm font-lora outline-none focus:border-[var(--accent)]"
                                      placeholder="Escribe la versión literaria de esta acción..."
                                    />
                                    <div className="flex justify-end gap-2 text-xs font-cinzel">
                                      <button
                                        onClick={handleCancelEdit}
                                        className="px-2.5 py-1 rounded border border-current/30 hover:bg-black/10 cursor-pointer flex items-center gap-1"
                                      >
                                        <X className="w-3 h-3" /> Cancelar
                                      </button>
                                      <button
                                        onClick={() => handleSaveEdit(chapter, mIdx)}
                                        className="px-3 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-bold cursor-pointer flex items-center gap-1"
                                      >
                                        <Check className="w-3 h-3" /> Guardar Prosa
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`${fontSizeClasses[fontSize]} text-left sm:text-justify`}>
                                    <div className="markdown-body narrative-body space-y-2">
                                      <ReactMarkdown
                                        components={{
                                          p: ({ children }) => {
                                            const str = Array.isArray(children)
                                              ? children.map(c => (typeof c === 'string' ? c : '')).join('')
                                              : typeof children === 'string'
                                              ? children
                                              : '';
                                            const isDialogue = /^[—–\-"«]/.test(str.trim());
                                            return (
                                              <p className={isDialogue ? 'narrative-dialogue font-medium' : undefined}>
                                                {children}
                                              </p>
                                            );
                                          }
                                        }}
                                      >
                                        {formatNarrativeText(stripStateTag(stripRollRequests(msg.novelContent)))}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}

                                {isExpanded && (
                                  <div className="mt-2.5 pt-2 border-t border-dashed border-current/20 text-xs italic opacity-75 font-lora">
                                    <span className="font-cinzel not-italic font-bold tracking-wider mr-1 text-[10px] uppercase">
                                      Original en partida:
                                    </span>
                                    «{msg.content}»
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Si aún no está novelado, mostrar tarjeta con botón directo para embellecer
                          return (
                            <div
                              key={mIdx}
                              className="my-2.5 p-3.5 rounded-lg border border-dashed border-amber-600/40 bg-amber-50/60 dark:bg-amber-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <Shield className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                                <div>
                                  <div className="text-[11px] font-cinzel tracking-wider text-amber-700 dark:text-amber-400 font-bold mb-0.5">
                                    Respuesta en bruto de la partida
                                  </div>
                                  <div className="italic leading-relaxed font-lora opacity-90">
                                    «{msg.content}»
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <button
                                  onClick={() => handleStartEdit(chapter.id, mIdx, '', msg.content)}
                                  className="text-xs px-2.5 py-1 rounded border border-current/30 hover:bg-black/10 transition-colors font-cinzel cursor-pointer"
                                  title="Escribir la versión novelada manualmente"
                                >
                                  Redactar
                                </button>
                                <button
                                  onClick={() => handleNovelizeSingle(chapter, mIdx)}
                                  disabled={isThisNovelizing}
                                  className="text-xs px-3 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-cinzel font-bold shadow-xs hover:brightness-110 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                  title="Transformar esta respuesta en prosa de novela con IA"
                                >
                                  {isThisNovelizing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isThisNovelizing ? 'Novelando...' : 'Novelar con IA'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // MODO 2: Originales en bruto
                        return (
                          <div
                            key={mIdx}
                            className={`my-2 p-3.5 rounded-lg border border-dashed border-current/25 bg-black/5 flex items-start gap-2.5 text-sm`}
                          >
                            <Shield className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                            <div className="flex-1 italic leading-relaxed font-lora">
                              <span className="font-cinzel not-italic font-bold text-[11px] uppercase mr-2 opacity-75">
                                [Jugador]
                              </span>
                              {msg.content}
                            </div>
                          </div>
                        );
                      }

                      // Turno del Narrador / Modelo
                      return (
                        <div key={mIdx} className={`${fontSizeClasses[fontSize]} text-left sm:text-justify`}>
                          <div className="markdown-body narrative-body space-y-4">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => {
                                  const str = Array.isArray(children)
                                    ? children.map(c => (typeof c === 'string' ? c : '')).join('')
                                    : typeof children === 'string'
                                    ? children
                                    : '';
                                  const isDialogue = /^[—–\-"«]/.test(str.trim());
                                  return (
                                    <p className={isDialogue ? 'narrative-dialogue' : undefined}>{children}</p>
                                  );
                                },
                                strong: ({ children }) => <strong className="narrative-strong">{children}</strong>,
                                em: ({ children }) => <em className="narrative-em">{children}</em>,
                                blockquote: ({ children }) => (
                                  <blockquote className="narrative-quote">{children}</blockquote>
                                )
                              }}
                            >
                              {formatNarrativeText(stripStateTag(stripRollRequests(msg.content)))}
                            </ReactMarkdown>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chapter End Ornament */}
                {cIdx < chaptersToRender.length - 1 && (
                  <div className="text-center my-6 text-xl opacity-30 select-none">——— ◆ ———</div>
                )}
              </div>
            );
          })}

          {/* Book Epilogue Footer */}
          <div className="text-center pt-10 mt-auto border-t border-dashed border-current/20 text-xs opacity-60 font-cinzel tracking-wider">
            Fin de la Crónica Registrada • Forgotten Realms GM Studio
          </div>
        </div>
      </div>
    </div>
  );
};
