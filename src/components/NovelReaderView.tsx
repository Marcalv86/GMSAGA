import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, Chat } from '../types';
import { stripRollRequests, stripStateTag } from '../utils/rollRequests';
import { formatNarrativeText } from '../utils/textFormatter';
import { exportNovelToPDF, exportNovelToMarkdown } from '../utils/pdfExport';
import { Swords, Shield, FileDown, BookOpen, FileText, Check, Loader2 } from 'lucide-react';

type ReaderTheme = 'parchment' | 'dark' | 'sepia' | 'light';

export const NovelReaderView: React.FC<{
  project: Project;
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onBackToChat: () => void;
}> = ({ project, chats, currentChatId, onSelectChat, onBackToChat }) => {
  const [selectedScope, setSelectedScope] = useState<'current' | 'all'>('current');
  const [theme, setTheme] = useState<ReaderTheme>('parchment');
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [showPlayerActions, setShowPlayerActions] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const activeChat = chats.find(c => c.id === currentChatId) || chats[0];

  // Theme styling definitions
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

  // Prepare chapters to render
  const chaptersToRender = selectedScope === 'all' ? chats : activeChat ? [activeChat] : [];

  // Compute total word count
  const totalWords = chaptersToRender.reduce((acc, ch) => {
    return acc + ch.messages.reduce((mAcc, m) => mAcc + m.content.split(/\s+/).length, 0);
  }, 0);
  const readingTimeMin = Math.max(1, Math.round(totalWords / 200));

  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<'pdf' | 'md' | null>(null);

  const handleExportPDF = async () => {
    if (chaptersToRender.length === 0) return;
    setIsExporting(true);
    setExportProgress('Iniciando maquetación de PDF...');
    try {
      await exportNovelToPDF(project, chaptersToRender, {
        scope: selectedScope,
        showPlayerActions,
        onProgress: msg => setExportProgress(msg)
      });
      setExportSuccess('pdf');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error exporting PDF:', err);
      alert('Error al exportar la novela a PDF: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportMarkdown = () => {
    if (chaptersToRender.length === 0) return;
    try {
      exportNovelToMarkdown(project, chaptersToRender, {
        scope: selectedScope,
        showPlayerActions,
        format: 'md'
      });
      setExportSuccess('md');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error exporting Markdown:', err);
      alert('Error al exportar el texto: ' + (err?.message || 'Error desconocido'));
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
              title="Volver a la vista de Crónica / Chat interactivo"
              aria-label="Volver a Crónica"
            >
              <Swords className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Crónica</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs" title="Modo Novela">
              <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Novela</span>
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

          {/* Font Size Selector */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-black/10 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFontSize('sm')}
              className={`w-6 h-6 rounded flex items-center justify-center font-bold cursor-pointer ${
                fontSize === 'sm'
                  ? `${currentTheme.pageBg} ${currentTheme.text} shadow-xs`
                  : `${currentTheme.subtext}`
              }`}
              title="Texto Pequeño"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize('md')}
              className={`w-6 h-6 rounded flex items-center justify-center font-bold cursor-pointer ${
                fontSize === 'md'
                  ? `${currentTheme.pageBg} ${currentTheme.text} shadow-xs`
                  : `${currentTheme.subtext}`
              }`}
              title="Texto Mediano"
            >
              A
            </button>
            <button
              onClick={() => setFontSize('lg')}
              className={`w-6 h-6 rounded flex items-center justify-center font-bold cursor-pointer ${
                fontSize === 'lg'
                  ? `${currentTheme.pageBg} ${currentTheme.text} shadow-xs`
                  : `${currentTheme.subtext}`
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

          {/* Toggle player dialogs */}
          <button
            onClick={() => setShowPlayerActions(!showPlayerActions)}
            className={`text-xs px-2 sm:px-2.5 py-1 rounded border ${currentTheme.border} ${
              showPlayerActions ? currentTheme.badgeBg : 'opacity-60'
            } transition-all cursor-pointer font-cinzel flex items-center gap-1.5`}
            title="Mostrar u ocultar los turnos de acción del jugador"
            aria-label="Acciones de jugador"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showPlayerActions ? 'Acciones: ON' : 'Acciones: OFF'}</span>
          </button>

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
              Una crónica de tu campaña
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
            // Filter messages based on player actions preference
            const visibleMessages = showPlayerActions
              ? chapter.messages
              : chapter.messages.filter(m => m.role === 'model');

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
                      Este capítulo aún no tiene relato escrito.
                    </p>
                  ) : (
                    visibleMessages.map((msg, mIdx) => {
                      const isUser = msg.role === 'user';

                      if (isUser) {
                        return (
                          <div
                            key={mIdx}
                            className={`my-2 p-3.5 rounded-lg border border-dashed border-current/25 bg-black/5 flex items-start gap-2.5 text-sm`}
                          >
                            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="flex-1 italic leading-relaxed font-lora">{msg.content}</div>
                          </div>
                        );
                      }

                      return (
                        <div key={mIdx} className={`${fontSizeClasses[fontSize]} text-left sm:text-justify`}>
                          <div className="markdown-body narrative-body space-y-4">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => {
                                  const str = Array.isArray(children)
                                    ? children.map(c => (typeof c === 'string' ? c : '')).join('')
                                    : typeof children === 'string' ? children : '';
                                  const isDialogue = /^[—–\-"«]/.test(str.trim());
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
            Fin de la Crónica Registrada • GM Studio
          </div>
        </div>
      </div>
    </div>
  );
};
