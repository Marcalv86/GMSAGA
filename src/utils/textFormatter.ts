/**
 * Utilidad para embellecer y dar formato editorial a la prosa narrativa.
 * Convierte textos densos o bloques sin saltos de línea en párrafos limpios,
 * con cadencia novelesca, separando oraciones y diálogos con saltos dobles (\n\n).
 */

/**
 * Elimina todas las etiquetas técnicas internas del motor (inventario, estado, tiempo,
 * agenda, hilos, presentes, vínculos, afinidad, etc.) y cabeceras de metadatos ASCII
 * para que el chat muestre exclusivamente prosa narrativa limpia y novelesca.
 */
export function stripInternalTagsAndHeaders(raw: string | undefined | null): string {
  if (!raw) return '';

  let text = raw;

  // 1. Eliminar bloques de código que solo contenían cabeceras de metadatos (ej: ```text 📅 ... 👤 Nivel ... ```)
  text = text.replace(/```(?:text|md|markdown)?\s*[\r\n]*(?:📅|👤|🌟|⚜️|🖤)[^`]*?```/gi, '');

  // 2. Eliminar etiquetas de sincronización entre corchetes [TAG: ...]
  text = text
    .replace(/\[\s*ESTADO\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*INVENTARIO\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*TIEMPO\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*AGENDA\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*HILO\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*PRESENTES\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*V[IÍ]NCULO\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*AFINIDAD\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*CHAPTER\s*:[^\]]*\]/gi, '')
    .replace(/\[\s*Pregunta\s+de\s+Mesa\s*:[^\]]*\]/gi, '');

  // 3. Eliminar cabeceras de fecha / estadísticas / renombre / afinidad fuera del HUD
  text = text
    .replace(/^[ \t]*📅[^\n\r]*[|⏳][^\n\r]*$/gim, '')
    .replace(/^[ \t]*👤\s*Nivel:[^\n\r]*$/gim, '')
    .replace(/^[ \t]*🌟\s*Hito:[^\n\r]*$/gim, '')
    .replace(/^[ \t]*⚜️\s*Renombre:[^\n\r]*$/gim, '')
    .replace(/^[ \t]*(?:🖤|♥|❤️|🤍|💔|❤️‍🔥)[^\n\r]*?[-—]\s*ATR:[^\n\r]*$/gim, '')
    // Variaciones combinadas en una sola línea
    .replace(/^[ \t]*👤\s*Nivel:[^|\n\r]+\|\s*🌟\s*Hito:[^\n\r]*$/gim, '');

  // 4. Limpieza de saltos y espacios residuales
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

export function formatNarrativeText(raw: string | undefined | null): string {
  if (!raw) return '';

  const cleaned = stripInternalTagsAndHeaders(raw);
  if (!cleaned) return '';

  // 1. Limpiar signos de puntuación con espacios previos anómalos (ej: "palabra . Siguiente" -> "palabra. Siguiente")
  let text = cleaned
    .replace(/\s+([.,!?;:…»”"'])/g, '$1')
    .replace(/([¿¡])\s+/g, '$1')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // 2. Normalizar guiones de diálogo para que empiecen en nueva línea
  text = text.replace(/([.!?…»”"'])\s*([—–-]\s*[A-ZÁÉÍÓÚÑa-záéíóúñ])/g, '$1\n\n$2');
  text = text.replace(/\n\s*([—–-]\s*)/g, '\n\n$1');

  // 3. Separar por párrafos preexistentes (si ya hay \n\n)
  const rawParagraphs = text.split(/\n\s*\n/);
  const formattedParagraphs: string[] = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Si el párrafo ya tiene saltos simples (\n), convertirlos a dobles si separan oraciones completas
    if (trimmed.includes('\n')) {
      const subLines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of subLines) {
        processLongBlock(line, formattedParagraphs);
      }
    } else {
      processLongBlock(trimmed, formattedParagraphs);
    }
  }

  return formattedParagraphs.join('\n\n');
}

/**
 * Procesa un bloque de texto que podría ser un "muro de texto" continuo (>240 caracteres)
 * y lo divide armónicamente en párrafos de 2-3 oraciones como en un libro.
 */
function processLongBlock(block: string, outputList: string[]): void {
  if (block.length <= 260) {
    outputList.push(block);
    return;
  }

  // Expresión regular que detecta límites de oraciones (puntos, exclamaciones, interrogaciones, elipsis o comillas de cierre)
  // seguidos de un espacio y una letra mayúscula o guion de diálogo.
  const sentenceRegex = /([^.!?…]+[.!?…]+["'»”]?)(?:\s+|$)/g;
  const sentences: string[] = [];
  let match;
  let lastIndex = 0;

  while ((match = sentenceRegex.exec(block)) !== null) {
    const s = match[1].trim();
    if (s) {
      sentences.push(s);
    }
    lastIndex = sentenceRegex.lastIndex;
  }

  // Texto restante que no termine en puntuación estricta
  if (lastIndex < block.length) {
    const remainder = block.slice(lastIndex).trim();
    if (remainder) {
      if (sentences.length > 0) {
        sentences[sentences.length - 1] += ' ' + remainder;
      } else {
        sentences.push(remainder);
      }
    }
  }

  // Si no se detectaron oraciones claras o son muy pocas, conservar el bloque
  if (sentences.length < 2) {
    outputList.push(block);
    return;
  }

  // Agrupar oraciones en párrafos equilibrados (2 a 3 oraciones, ~200-380 caracteres)
  let currentGroup: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const isDialogue = /^[—–\-"«]/.test(s);

    // Si la oración es un diálogo y ya tenemos texto previo, cerrar el párrafo previo y empezar uno nuevo
    if (isDialogue && currentGroup.length > 0) {
      outputList.push(currentGroup.join(' '));
      currentGroup = [s];
      currentLength = s.length;
      continue;
    }

    currentGroup.push(s);
    currentLength += s.length;

    // Si ya acumulamos 2 o 3 oraciones y alcanzamos una longitud cómoda, cerramos el párrafo
    const isLastSentence = i === sentences.length - 1;
    if (!isLastSentence) {
      const remainingSentences = sentences.length - (i + 1);
      // Evitar dejar una sola oración huérfana al final si podemos incluirla
      if (currentGroup.length >= 2 && currentLength >= 220 && remainingSentences >= 2) {
        outputList.push(currentGroup.join(' '));
        currentGroup = [];
        currentLength = 0;
      } else if (currentGroup.length >= 3 && currentLength >= 280) {
        outputList.push(currentGroup.join(' '));
        currentGroup = [];
        currentLength = 0;
      }
    }
  }

  if (currentGroup.length > 0) {
    outputList.push(currentGroup.join(' '));
  }
}
