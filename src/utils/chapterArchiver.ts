import { Chat, Project, ProjectFile } from '../types';
import { stripStateTag } from './rollRequests';
import { limpiarEtiquetasDeTiempo } from './campaignCalendar';

/**
 * Limpia el texto de un mensaje para que sea pura narrativa y diálogo literario,
 * eliminando etiquetas mecánicas internas de sistema (HUD, inventario, agenda, tiradas, etc.)
 */
export function limpiarTextoNarrativoParaArchivo(texto: string): string {
  if (!texto) return '';

  let limpio = stripStateTag(limpiarEtiquetasDeTiempo(texto));

  // Eliminar etiquetas de sistema y mecánicas de mesa
  const tagsAEliminar = [
    /\[HUD:[^\]]*\]/gi,
    /\[AGENDA:[^\]]*\]/gi,
    /\[INVENTARIO:[^\]]*\]/gi,
    /\[APRENDIDO:[^\]]*\]/gi,
    /\[TIRADA[^\]]*\]/gi,
    /\[Petición de Tirada:[^\]]*\]/gi,
    /\[Petición de Salvación:[^\]]*\]/gi,
    /\[VÍNCULO:[^\]]*\]/gi,
    /\[VINCULO:[^\]]*\]/gi,
    /\[SECRETO:[^\]]*\]/gi,
    /\[BAMBALINAS:[^\]]*\]/gi,
    /\[RELOJ:[^\]]*\]/gi,
    /\[FACCIONES:[^\]]*\]/gi,
    /\[PREPARADO:[^\]]*\]/gi,
    /\[VIAJE:[^\]]*\]/gi,
    /\[NIVEL:[^\]]*\]/gi,
    /\[Avance:[^\]]*\]/gi,
    /\[ESTADO:[^\]]*\]/gi,
    /\[CLIMA:[^\]]*\]/gi,
    /\[CAMBIO:[^\]]*\]/gi,
    /\[CONOCIMIENTO:[^\]]*\]/gi,
    /\[ESTO SE JUEGA[^\]]*\]/gi,
    /\[DURACIÓN EXACTA[^\]]*\]/gi,
    /\[SISTEMA[^\]]*\]/gi,
    /\[Pregunta de Mesa:[^\]]*\]/gi
  ];

  for (const regex of tagsAEliminar) {
    limpio = limpio.replace(regex, '');
  }

  // Limpiar líneas vacías consecutivas excesivas
  limpio = limpio.replace(/\n{3,}/g, '\n\n').trim();

  return limpio;
}

/**
 * Extrae metadatos clave (personajes, lugares, fechas y temas) a partir del historial del capítulo
 */
export function extraerMetadatosDeCapitulo(chat: Chat, project: Project) {
  const mensajesValidos = (chat.messages || []).filter(
    m => m.content && m.content.trim() && m.content !== 'Pensando...' && m.content !== 'Tirando dados...'
  );

  const textoTotal = mensajesValidos.map(m => m.content).join(' ');

  // 1. Detectar PNJs mencionados
  const npcsProyecto = project.memory?.npcs || [];
  const npcsDetectados = npcsProyecto
    .filter(n => {
      const nombre = n.name.trim();
      if (nombre.length < 3) return false;
      const regex = new RegExp(`\\b${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(textoTotal);
    })
    .map(n => n.name);

  // 2. Detectar Lugares mencionados
  const lugaresProyecto = project.memory?.locations || [];
  const lugaresDetectados = lugaresProyecto
    .filter(l => {
      const nombre = l.name.trim();
      if (nombre.length < 3) return false;
      const regex = new RegExp(`\\b${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(textoTotal);
    })
    .map(l => l.name);

  // 3. Extraer fechas y encabezados HUD detectados en el chat
  const fechasDetectadas: string[] = [];
  const hudRegex = /📍\s*([^\n·—]+)(?:·|—)?([^\n]*)/g;
  let match;
  while ((match = hudRegex.exec(textoTotal)) !== null) {
    const lugarOFecha = (match[1] || '').trim();
    const resto = (match[2] || '').trim();
    const combo = [lugarOFecha, resto].filter(Boolean).join(' · ');
    if (combo && !fechasDetectadas.includes(combo) && fechasDetectadas.length < 5) {
      fechasDetectadas.push(combo);
    }
  }

  // 4. Nombre del protagonista
  const pcName = project.memory?.player_character?.name || 'Protagonista';

  return {
    mensajesCount: mensajesValidos.length,
    npcsDetectados: Array.from(new Set(npcsDetectados)),
    lugaresDetectados: Array.from(new Set(lugaresDetectados)),
    fechasDetectadas,
    pcName
  };
}

/**
 * Genera etiquetas de búsqueda optimizadas para BM25 / RAG a partir del capítulo
 */
export function generarEtiquetasDeCapitulo(
  chat: Chat,
  project: Project,
  meta: ReturnType<typeof extraerMetadatosDeCapitulo>
): string {
  const baseTags = [
    'crónica',
    'capítulo',
    'memoria',
    chat.name,
    project.name,
    meta.pcName,
    ...meta.npcsDetectados,
    ...meta.lugaresDetectados
  ];

  // Extraer palabras clave con mayúscula o términos relevantes
  const palabrasClave = Array.from(
    new Set(
      baseTags
        .map(t => t.trim().replace(/^['"`]+|['"`]+$/g, ''))
        .filter(t => t.length >= 3)
    )
  );

  return palabrasClave.slice(0, 20).join(', ');
}

/**
 * Construye el documento Markdown formateado del capítulo archivado
 */
export function construirDocumentoMarkdownDeCapitulo(
  chat: Chat,
  project: Project,
  resumenEjecutivo?: string
): string {
  const meta = extraerMetadatosDeCapitulo(chat, project);
  const mensajesValidos = (chat.messages || []).filter(
    m => m.content && m.content.trim() && m.content !== 'Pensando...' && m.content !== 'Tirando dados...'
  );

  const pcName = meta.pcName;

  let doc = `<!-- chapter_id: ${chat.id} -->\n# 📜 Crónica Archivada: ${chat.name}\n\n`;
  doc += `> **Tomo / Campaña:** ${project.name}\n`;
  doc += `> **Protagonista:** ${pcName}\n`;
  if (meta.fechasDetectadas.length > 0) {
    doc += `> **Entornos / Fechas:** ${meta.fechasDetectadas.join(' | ')}\n`;
  }
  if (meta.npcsDetectados.length > 0) {
    doc += `> **Personajes Involucrados:** ${meta.npcsDetectados.join(', ')}\n`;
  }
  if (meta.lugaresDetectados.length > 0) {
    doc += `> **Ubicaciones Clave:** ${meta.lugaresDetectados.join(', ')}\n`;
  }
  doc += `> **Turnos Totales:** ${meta.mensajesCount} mensajes registrados\n\n`;

  doc += `---\n\n`;

  if (resumenEjecutivo && resumenEjecutivo.trim()) {
    doc += `## 🧭 Resumen y Desenlace del Capítulo\n\n`;
    doc += `${resumenEjecutivo.trim()}\n\n`;
    doc += `---\n\n`;
  }

  doc += `## 📖 Registro Literario y Diálogos\n\n`;

  if (mensajesValidos.length === 0) {
    doc += `*(Este capítulo no contiene mensajes narrativos registrados.)*\n`;
  } else {
    mensajesValidos.forEach(msg => {
      const limpio = limpiarTextoNarrativoParaArchivo(msg.content);
      if (!limpio) return;

      if (msg.role === 'user') {
        doc += `### 🎭 ${pcName} (Acción / Diálogo):\n\n${limpio}\n\n`;
      } else {
        doc += `### 🎲 Narrador (Consecuencias y Entorno):\n\n${limpio}\n\n`;
      }
    });
  }

  return doc;
}

/**
 * Convierte un Chat completo en un ProjectFile listo para la biblioteca de consulta (onDemand: true)
 */
export function convertirChatAArchivoDeConsulta(
  chat: Chat,
  project: Project,
  resumenEjecutivo?: string
): ProjectFile {
  const meta = extraerMetadatosDeCapitulo(chat, project);
  const tags = generarEtiquetasDeCapitulo(chat, project, meta);
  const markdown = construirDocumentoMarkdownDeCapitulo(chat, project, resumenEjecutivo);

  // Nombre higienizado para el archivo
  const nombreArchivo = `Crónica — ${chat.name.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
  const fileId = `file_archive_cap_${chat.id}`;

  const projectFile: ProjectFile = {
    id: fileId,
    name: nombreArchivo,
    type: 'text/markdown',
    mime: 'text/markdown',
    content: markdown,
    category: 'document',
    // ⭐ Clave de rendimiento: onDemand true asegura que no sobrecargue el prompt activo en cada turno,
    // pero permanece en la biblioteca y se consulta dinámicamente mediante búsqueda semántica/BM25.
    onDemand: true,
    length: markdown.length,
    etiquetasBusqueda: tags,
    analysis: resumenEjecutivo ? `Resumen: ${resumenEjecutivo.slice(0, 300)}...` : undefined
  };

  return projectFile;
}

/**
 * Encuentra si un capítulo ya ha sido archivado previamente en la lista de archivos
 */
export function buscarArchivoDeCapitulo(files: ProjectFile[], chatId: string): ProjectFile | undefined {
  if (!files || !chatId) return undefined;
  const fileId = `file_archive_cap_${chatId}`;
  return files.find(
    f =>
      f.id === fileId ||
      (f.content && f.content.includes(`chapter_id: ${chatId}`)) ||
      (f.name.includes('Crónica — ') && f.content && f.content.includes(fileId))
  );
}
