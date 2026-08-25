import { Project, Chat, Message } from '../types';
import { formatNarrativeText, stripInternalTagsAndHeaders } from './textFormatter';
import { stripRollRequests, stripStateTag } from './rollRequests';

export interface ExportNovelOptions {
  scope?: 'current' | 'all';
  showPlayerActions?: boolean;
  onProgress?: (text: string) => void;
}

/**
 * Normaliza y sanea caracteres especiales para garantizar compatibilidad total
 * con las fuentes estándar de jsPDF sin artefactos ni caracteres corruptos.
 */
function sanitizeTextForPdf(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2015]/g, '—') // em-dash
    .replace(/[\u2013]/g, '-') // en-dash
    .replace(/[\u201C\u201D]/g, '"') // comillas tipográficas
    .replace(/[\u2018\u2019]/g, "'") // comillas simples
    .replace(/[\u2026]/g, '...') // puntos suspensivos
    .replace(/[\u2022\u25CF\u25CB]/g, '•')
    .replace(/\t/g, '    ');
}

/**
 * Limpia el contenido de un mensaje eliminando tiradas mecánicas y etiquetas
 * para dejar únicamente la prosa narrativa.
 */
function cleanMessageForNovel(msg: Message): string {
  let text = msg.content || '';
  text = stripStateTag(text);
  text = stripRollRequests(text);
  text = stripInternalTagsAndHeaders(text);
  return formatNarrativeText(text);
}

/**
 * Exporta el relato o la campaña completa en formato PDF maquetado como un libro / novela.
 */
export async function exportNovelToPDF(
  project: Project,
  chats: Chat[],
  options: ExportNovelOptions = {}
): Promise<void> {
  const { scope = 'current', showPlayerActions = true, onProgress = () => {} } = options;

  onProgress('Iniciando motor de maquetación editorial...');
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 22;
  const marginRight = 22;
  const marginTop = 25;
  const marginBottom = 25;
  const contentWidth = pageWidth - marginLeft - marginRight; // 166mm
  const maxContentY = pageHeight - marginBottom; // 272mm

  const chaptersToExport = scope === 'all' ? chats : chats.slice(0, 1);
  if (chaptersToExport.length === 0) {
    throw new Error('No hay capítulos disponibles para exportar.');
  }

  // Contar palabras y estadísticas
  let totalWords = 0;
  chaptersToExport.forEach(c => {
    c.messages.forEach(m => {
      totalWords += (m.content || '').split(/\s+/).filter(Boolean).length;
    });
  });

  // ==========================================
  // 1. PÁGINA DE PORTADA (Cover Page)
  // ==========================================
  onProgress('Generando portada del tomo...');
  
  // Fondo suave apergaminado
  pdf.setFillColor(251, 248, 240);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Marco decorativo doble
  pdf.setDrawColor(180, 140, 80);
  pdf.setLineWidth(1.2);
  pdf.rect(12, 12, pageWidth - 24, pageHeight - 24);
  pdf.setLineWidth(0.4);
  pdf.rect(14, 14, pageWidth - 28, pageHeight - 28);

  // Elemento decorativo superior
  pdf.setFont('times', 'italic');
  pdf.setFontSize(12);
  pdf.setTextColor(140, 90, 40);
  pdf.text('— ✦ CRÓNICAS DE LOS REINOS OLVIDADOS ✦ —', pageWidth / 2, 60, { align: 'center' });

  // Título de la campaña
  pdf.setFont('times', 'bold');
  pdf.setFontSize(26);
  pdf.setTextColor(60, 25, 20);
  const titleLines = pdf.splitTextToSize(sanitizeTextForPdf(project.name.toUpperCase()), contentWidth);
  pdf.text(titleLines, pageWidth / 2, 85, { align: 'center' });

  // Subtítulo
  pdf.setFont('times', 'italic');
  pdf.setFontSize(13);
  pdf.setTextColor(110, 80, 60);
  const subtitle = 'Crónicas y novela de campaña interactiva en los Reinos Olvidados';
  const subtitleLines = pdf.splitTextToSize(subtitle, contentWidth - 20);
  pdf.text(subtitleLines, pageWidth / 2, 115, { align: 'center' });

  // Separador ornamental
  pdf.setDrawColor(180, 140, 80);
  pdf.setLineWidth(0.6);
  pdf.line(pageWidth / 2 - 35, 140, pageWidth / 2 + 35, 140);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(16);
  pdf.setTextColor(180, 140, 80);
  pdf.text('⚔', pageWidth / 2, 142, { align: 'center' });

  // Datos del libro
  pdf.setFont('times', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(100, 80, 70);
  const fechaStr = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const metadataY = 220;
  pdf.text(`Tomo: ${scope === 'all' ? 'Novela Completa' : (chaptersToExport[0]?.name || 'Capítulo')}`, pageWidth / 2, metadataY, { align: 'center' });
  pdf.text(`Extensión: ~${totalWords.toLocaleString('es-ES')} palabras (${chaptersToExport.length} capítulo${chaptersToExport.length > 1 ? 's' : ''})`, pageWidth / 2, metadataY + 8, { align: 'center' });
  pdf.text(`Fecha de Edición: ${fechaStr}`, pageWidth / 2, metadataY + 16, { align: 'center' });
  pdf.text('Generado por GM Studio', pageWidth / 2, metadataY + 24, { align: 'center' });

  // ==========================================
  // 2. MAQUETACIÓN DE CAPÍTULOS Y PROSA
  // ==========================================
  let currentY = marginTop;
  let pageNumber = 1; // Página 1 es la portada
  const chapterTitles: { [page: number]: string } = {};

  const startNewPage = (currentChapterName: string) => {
    pdf.addPage();
    pageNumber++;
    chapterTitles[pageNumber] = currentChapterName;
    currentY = marginTop;
  };

  const checkY = (neededSpace: number, currentChapterName: string) => {
    if (currentY + neededSpace > maxContentY) {
      startNewPage(currentChapterName);
    }
  };

  for (let cIdx = 0; cIdx < chaptersToExport.length; cIdx++) {
    const chapter = chaptersToExport[cIdx];
    const chapterTitle = sanitizeTextForPdf(chapter.name || `Capítulo ${cIdx + 1}`);
    onProgress(`Maquetando Capítulo ${cIdx + 1}: ${chapterTitle}...`);

    // Cada capítulo inicia en una página nueva
    startNewPage(chapterTitle);

    // Encabezado del Capítulo
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(150, 90, 40);
    pdf.text(`CAPÍTULO ${cIdx + 1}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    pdf.setFont('times', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(50, 25, 20);
    const chapTitleLines = pdf.splitTextToSize(chapterTitle.toUpperCase(), contentWidth);
    pdf.text(chapTitleLines, pageWidth / 2, currentY, { align: 'center' });
    currentY += chapTitleLines.length * 7 + 4;

    // Línea decorativa bajo el título de capítulo
    pdf.setDrawColor(190, 160, 120);
    pdf.setLineWidth(0.4);
    pdf.line(pageWidth / 2 - 25, currentY, pageWidth / 2 + 25, currentY);
    currentY += 10;

    // Mensajes del capítulo
    const visibleMessages = showPlayerActions
      ? chapter.messages
      : chapter.messages.filter(m => m.role === 'model');

    if (visibleMessages.length === 0) {
      pdf.setFont('times', 'italic');
      pdf.setFontSize(11);
      pdf.setTextColor(140, 130, 120);
      pdf.text('Este capítulo no contiene narración registrada.', pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;
      continue;
    }

    for (const msg of visibleMessages) {
      const isUser = msg.role === 'user';
      const cleanText = sanitizeTextForPdf(cleanMessageForNovel(msg));
      if (!cleanText.trim()) continue;

      if (isUser) {
        // Formato para turno del Jugador
        pdf.setFont('times', 'italic');
        pdf.setFontSize(10);
        pdf.setTextColor(90, 60, 50);

        const playerLines = pdf.splitTextToSize(`[Jugador] ${cleanText}`, contentWidth - 14);
        const blockHeight = playerLines.length * 4.8 + 6;

        checkY(blockHeight, chapterTitle);

        // Fondo y barra lateral para el turno del jugador
        pdf.setFillColor(245, 240, 230);
        pdf.roundedRect(marginLeft + 2, currentY - 3.5, contentWidth - 4, blockHeight, 1.5, 1.5, 'F');
        pdf.setDrawColor(180, 140, 100);
        pdf.setLineWidth(0.8);
        pdf.line(marginLeft + 2, currentY - 3.5, marginLeft + 2, currentY - 3.5 + blockHeight);

        pdf.text(playerLines, marginLeft + 6, currentY + 1.5);
        currentY += blockHeight + 4;
      } else {
        // Formato para prosa del Narrador (Novela)
        pdf.setFont('times', 'normal');
        pdf.setFontSize(10.8);
        pdf.setTextColor(30, 25, 25);

        const paragraphs = cleanText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

        for (const para of paragraphs) {
          const paraLines = pdf.splitTextToSize(para, contentWidth);
          const paraHeight = paraLines.length * 5.2;

          checkY(paraHeight + 3, chapterTitle);

          // Sangría en la primera línea del párrafo
          pdf.text(paraLines, marginLeft, currentY);
          currentY += paraHeight + 3.5;
        }

        // Espacio entre turnos narrativos
        currentY += 2;
      }
    }
  }

  // ==========================================
  // 3. CABECERAS Y PIES DE PÁGINA (Paginación)
  // ==========================================
  onProgress('Aplicando numeración y detalles editoriales...');
  const totalPages = pdf.getNumberOfPages();

  for (let p = 2; p <= totalPages; p++) {
    pdf.setPage(p);

    // Cabecera superior
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(140, 120, 100);
    pdf.text(sanitizeTextForPdf(project.name), marginLeft, 15);
    const currentChap = chapterTitles[p] || '';
    if (currentChap) {
      pdf.text(currentChap, pageWidth - marginRight, 15, { align: 'right' });
    }

    pdf.setDrawColor(220, 205, 180);
    pdf.setLineWidth(0.3);
    pdf.line(marginLeft, 18, pageWidth - marginRight, 18);

    // Pie de página
    pdf.setDrawColor(220, 205, 180);
    pdf.setLineWidth(0.3);
    pdf.line(marginLeft, pageHeight - 17, pageWidth - marginRight, pageHeight - 17);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(120, 100, 90);
    pdf.text(`— ${p} —`, pageWidth / 2, pageHeight - 12, { align: 'center' });
  }

  // Guardar archivo
  onProgress('Descargando archivo PDF...');
  const safeProj = project.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeScopeName = scope === 'all' ? 'Novela_Completa' : (chaptersToExport[0]?.name?.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Capitulo');
  pdf.save(`${safeProj}_${safeScopeName}.pdf`);
}

/**
 * Exporta el relato o la campaña en formato Markdown (.md) o Texto (.txt) limpio.
 */
export function exportNovelToMarkdown(
  project: Project,
  chats: Chat[],
  options: { scope?: 'current' | 'all'; showPlayerActions?: boolean; format?: 'md' | 'txt' } = {}
): void {
  const { scope = 'current', showPlayerActions = true, format = 'md' } = options;
  const chaptersToExport = scope === 'all' ? chats : chats.slice(0, 1);

  let output = '';

  if (format === 'md') {
    output += `# ${project.name}\n\n`;
    output += `*Crónica y Novela de Campaña - Forgotten Realms*\n\n`;
    output += `---\n\n`;
  } else {
    output += `${project.name.toUpperCase()}\n`;
    output += `Crónica y Novela de Campaña - Forgotten Realms\n`;
    output += `========================================\n\n`;
  }

  chaptersToExport.forEach((chap, idx) => {
    const chapTitle = chap.name || `Capítulo ${idx + 1}`;
    if (format === 'md') {
      output += `## Capítulo ${idx + 1}: ${chapTitle}\n\n`;
    } else {
      output += `\n--- CAPÍTULO ${idx + 1}: ${chapTitle.toUpperCase()} ---\n\n`;
    }

    const msgs = showPlayerActions ? chap.messages : chap.messages.filter(m => m.role === 'model');

    msgs.forEach(m => {
      const isUser = m.role === 'user';
      const cleanText = cleanMessageForNovel(m);
      if (!cleanText.trim()) return;

      if (isUser) {
        if (format === 'md') {
          output += `> **[Jugador]:** *${cleanText}*\n\n`;
        } else {
          output += `[JUGADOR]: ${cleanText}\n\n`;
        }
      } else {
        output += `${cleanText}\n\n`;
      }
    });

    output += `\n`;
  });

  const safeProj = project.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeScope = scope === 'all' ? 'Novela_Completa' : (chaptersToExport[0]?.name?.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Capitulo');
  const ext = format === 'md' ? 'md' : 'txt';
  const mime = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';

  const blob = new Blob([output], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeProj}_${safeScope}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Función puente de compatibilidad con App.tsx y ChatView.tsx
 */
export const exportChronicleToPDF = async (
  project: Project,
  chat: Chat,
  setLoadingText?: (text: string) => void
) => {
  await exportNovelToPDF(project, [chat], {
    scope: 'current',
    showPlayerActions: true,
    onProgress: setLoadingText || (() => {})
  });
};
