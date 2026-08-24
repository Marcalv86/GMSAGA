import { Project, Chat, NPC, Quest, Location, PlayerCharacter, Memory } from '../types';
import { generateContentWithFailover } from './geminiHelper';
import { DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE } from './defaultDirectives';

export interface ExtractedCampaignResult {
  sourceType: 'pdf' | 'text' | 'markdown' | 'json' | 'notebooklm';
  rawTextLength: number;
  project: Project;
  chats: Chat[];
  summary: {
    title: string;
    protagonistName?: string;
    protagonistClass?: string;
    protagonistLevel?: string;
    chaptersCount: number;
    messagesCount: number;
    npcsCount: number;
    questsCount: number;
    locationsCount: number;
  };
}

/**
 * Lee el contenido en crudo de un archivo (PDF, JSON, TXT, MD).
 */
export async function readRawFileText(file: File): Promise<{ text: string; isPdf: boolean; isJson: boolean }> {
  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const { extractPdfText } = await import('./pdfText');
    const pdfText = await extractPdfText(arrayBuffer);
    return { text: pdfText, isPdf: true, isJson: false };
  }

  const text = await file.text();
  return { text, isPdf: false, isJson };
}

/**
 * Limpia y normaliza texto extraído de PDFs o transcripciones de chat de Gemini/NotebookLM.
 */
function cleanExtractedText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // caracteres de control no válidos
    .replace(/[ \t]{3,}/g, ' ')
    .trim();
}

/**
 * Parser inteligente mediante Gemini API para transformar transcripciones de chat de Gemini,
 * cuadernos de NotebookLM, resúmenes de sesión o PDFs de rol en una campaña viva completa de GM Studio.
 */
export async function importCampaignWithGemini(
  rawText: string,
  preferredTitle?: string
): Promise<ExtractedCampaignResult> {
  const cleaned = cleanExtractedText(rawText);
  if (!cleaned || cleaned.length < 20) {
    throw new Error('El texto proporcionado está vacío o es demasiado corto para extraer una campaña.');
  }

  // Limitamos el texto enviado a unos 120k caracteres si es masivo para respuesta óptima
  const truncatedText = cleaned.length > 130000 ? cleaned.slice(0, 130000) + '\n\n[...texto truncado por longitud...]' : cleaned;

  const prompt = `Eres el Arquitecto de Campañas y Tomos de Rol de GM Studio (D&D 5e).
Te proporciono una transcripción de chat (ej: exportada de Gemini), un cuaderno o guía de estudio de NotebookLM, o un documento de partida de rol.

Tu tarea es analizar minuciosamente el texto y convertirlo en una ESTRUCTURA COMPLETA DE CAMPAÑA para nuestra aplicación de rol.

TEXTO A ANALIZAR:
"""
${truncatedText}
"""

REQUISITOS DE EXTRACCIÓN:
1. **name**: Título de la campaña / aventura (ej: "${preferredTitle || 'El Asedio de Luskan'}"). Si no está explícito, inventa uno evocador basado en los acontecimientos.
2. **description**: Resumen de 2-3 frases de la ambientación, premisa y estado de la trama.
3. **character**: Ficha del personaje protagonista (si se menciona o juega como PJ).
   - name, race, class, level (ej: "5"), hp, maxHp, ac, background, alignment.
   - attributes: { str: 10-20, dex: 10-20, con: 10-20, int: 10-20, wis: 10-20, cha: 10-20 }.
   - personality, backstory, appearance, notes.
4. **chapters**: Lista de capítulos.
   - Si el texto es una transcripción de chat interactiva:
     - Divide los mensajes secuencialmente en capítulos lógicos (ej: "Capítulo I: El Encuentro en la Posada", "Capítulo II: Las Ruinas").
     - Para cada mensaje: role ('user' para intervenciones del jugador, 'model' para respuestas del Narrador/Gemini/DM), y content.
   - Si el texto es un cuaderno de NotebookLM o documento de lore:
     - Crea al menos un capítulo inicial "Capítulo I: El Comienzo" o "Prólogo" con un mensaje introductorio de ambientación (role: 'model') y la situación inicial.
5. **npcs**: Lista de personajes no jugadores (PNJs) nombrados o que han interactuado:
   - name: Nombre del personaje.
   - relation: Tipo de relación (ej: "Aliada", "Rival", "Mentor", "Captor", "Secundario").
   - status: "Vivo", "Desaparecido", "Muerto", etc.
   - notes: Quién es, qué quiere y qué rol desempeña.
   - aparenta: Cómo se muestra en público hacia el protagonista.
   - oculta: Qué intenciones secretas, sospechas o cartas ocultas guarda.
   - **REGLA DE AFINIDAD (atr, vin, con, vinculo):**
     - **SOLO** asigna campos de afinidad (atr: 0-20, vin: 0-20, con: 0-20, vinculo) si el PNJ tiene un **Nombre Propio real** (ej: Jarlaxle, Kieron, Valas, Braelin), es un personaje canónico o un acompañante principal con peso dramático.
     - Para **figurantes / extras anónimos** sin nombre propio (ej: 'Corsario del estoque', 'Guardia de la puerta', 'Ballestero', 'Tabernero'), **NO** incluyas 'atr', 'vin', 'con' ni 'vinculo' (deben quedar como simples figurantes sin barras).
     - Escala D20 (0 a 20): 0-1 Desconocido/Recelo, 2-5 Curiosidad/Trato formal, 6-9 Interés/Camaradería, 10-13 Química/Flirteo, 14-17 Fascinación/Lealtad, 18-20 Devoción/Amor. Progresión slow-burn estricta.
6. **quests**: Lista de misiones, contratos, misterios o encargos activos o resueltos:
   - title: Nombre de la misión.
   - origin: Quién la encomendó o dónde se originó.
   - objective: Qué debe lograrse.
   - progress: Qué se ha avanzado.
   - status: "active" | "completed" | "failed".
   - type: "principal" | "secundaria" | "personal".
7. **locations**: Lugares, ciudades, tabernas, mazmorras o regiones visitadas o clave:
   - name: Nombre del lugar.
   - desc: Qué clase de lugar es y su atmósfera.
   - notes: Detalles clave o quién lo controla.
8. **storySynopsis**: Resumen conciso de la historia transcurrida hasta ahora (para la memoria viva del Tomo).
9. **currentStatus**: Situación exacta donde quedó la escena o el último mensaje.
10. **directives**: Directivas narrativas o instrucciones de tono recomendadas para continuar jugando.

RESPONDE EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "name": "...",
  "description": "...",
  "character": {
    "name": "...",
    "race": "...",
    "class": "...",
    "level": "...",
    "hp": 25,
    "maxHp": 25,
    "ac": 14,
    "attributes": { "str": 10, "dex": 14, "con": 12, "int": 16, "wis": 12, "cha": 14 },
    "background": "...",
    "alignment": "...",
    "backstory": "...",
    "personality": "...",
    "appearance": "...",
    "notes": "..."
  },
  "chapters": [
    {
      "name": "Capítulo I: ...",
      "messages": [
        { "role": "user", "content": "..." },
        { "role": "model", "content": "..." }
      ]
    }
  ],
  "npcs": [
    {
      "name": "...",
      "relation": "...",
      "status": "Vivo",
      "notes": "...",
      "aparenta": "...",
      "oculta": "...",
      "vinculo": "...",
      "atr": 5,
      "vin": 4,
      "con": 3
    }
  ],
  "quests": [
    {
      "title": "...",
      "origin": "...",
      "objective": "...",
      "progress": "...",
      "status": "active",
      "type": "principal"
    }
  ],
  "locations": [
    {
      "name": "...",
      "desc": "...",
      "notes": "..."
    }
  ],
  "storySynopsis": "...",
  "currentStatus": "...",
  "manualNotes": "...",
  "directives": "..."
}`;

  const response = await generateContentWithFailover({
    contents: prompt,
    config: {
      temperature: 0.3,
      responseMimeType: 'application/json'
    }
  });

  const rawJsonText = response?.text || '';
  if (!rawJsonText) {
    throw new Error('El modelo no devolvió contenido.');
  }

  let parsed: any;
  try {
    const jsonClean = rawJsonText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    parsed = JSON.parse(jsonClean);
  } catch (err) {
    console.error('Error parseando JSON de Gemini:', err, rawJsonText);
    throw new Error('No se pudo estructurar el JSON de la campaña importada.');
  }

  return formatParsedDataToCampaign(parsed, cleaned, 'notebooklm');
}

/**
 * Parser offline / determinista de respaldo cuando no hay clave de API configurada o el usuario prefiere análisis local.
 */
export function importCampaignLocalFallback(
  rawText: string,
  preferredTitle?: string
): ExtractedCampaignResult {
  const cleaned = cleanExtractedText(rawText);
  if (!cleaned) {
    throw new Error('El archivo o texto está vacío.');
  }

  const lines = cleaned.split('\n');
  const campaignName = preferredTitle || extractTitleFromText(lines) || 'Campaña Importada';

  // 1. Extraer mensajes y turnos si se parece a un chat
  const { chapters, messagesCount } = extractChatsDeterministically(lines);

  // 3. Extraer PNJs básicos por viñetas
  const npcs = extractNpcsDeterministically(lines);

  // 4. Extraer misiones y lugares básicos
  const quests = extractQuestsDeterministically(lines);
  const locations = extractLocationsDeterministically(lines);

  const projectId = 'tomo_' + Date.now();
  const memory: Memory = {
    story: cleaned.slice(0, 1500),
    quests,
    npcs,
    locations,
    current_status: 'Continuación de partida importada.',
    manual_notes: `Texto original importado (${cleaned.length} caracteres).`,
    
  };

  const project: Project = {
    id: projectId,
    name: campaignName,
    instructions: DEFAULT_DM_INSTRUCTIONS,
    system: DEFAULT_SYSTEM,
    style: DEFAULT_STYLE,
    memory,
    files: [],
    chats: []
  };

  return {
    sourceType: 'text',
    rawTextLength: cleaned.length,
    project,
    chats: chapters,
    summary: {
      title: campaignName,
      protagonistName: "Desconocido",
      chaptersCount: chapters.length,
      messagesCount,
      npcsCount: npcs.length,
      questsCount: quests.length,
      locationsCount: locations.length
    }
  };
}

/**
 * Convierte el JSON generado por Gemini en la estructura de datos definitiva de GM Studio.
 */
function formatParsedDataToCampaign(
  parsed: any,
  rawText: string,
  sourceType: ExtractedCampaignResult['sourceType']
): ExtractedCampaignResult {
  const projectId = 'tomo_' + Date.now();
  const name = (parsed.name || 'Campaña de Gemini / NotebookLM').trim();

  // Ficha de Protagonista
  const rawChar = parsed.character || {};
  const playerCharacter: PlayerCharacter = {
    name: rawChar.name || 'Protagonista',
    race: rawChar.race || 'Humano',
    class: rawChar.class || 'Aventurero',
    level: String(rawChar.level || '1'),
    hp: typeof rawChar.hp === 'number' ? rawChar.hp : 25,
    maxHp: typeof rawChar.maxHp === 'number' ? rawChar.maxHp : 25,
    ac: typeof rawChar.ac === 'number' ? rawChar.ac : 14,
    attributes: rawChar.attributes || { str: 10, dex: 12, con: 12, int: 14, wis: 12, cha: 12 },
    background: rawChar.background || '',
    alignment: rawChar.alignment || 'Neutral Bueno',
    backstory: rawChar.backstory || '',
    personality: rawChar.personality || '',
    appearance: rawChar.appearance || '',
    notes: rawChar.notes || '',
    inventory: Array.isArray(rawChar.inventory) ? rawChar.inventory : [],
    currencies: rawChar.currencies || { cp: 0, sp: 0, ep: 0, gp: 25, pp: 0 }
  };

  // Capítulos y Mensajes
  const rawChapters = Array.isArray(parsed.chapters) && parsed.chapters.length > 0 ? parsed.chapters : [];
  let totalMessages = 0;

  const chats: Chat[] = rawChapters.map((ch: any, idx: number) => {
    const rawMsgs = Array.isArray(ch.messages) ? ch.messages : [];
    const messages = rawMsgs.map((m: any) => {
      totalMessages++;
      const isUser =
        m.role === 'user' ||
        m.role === 'human' ||
        m.role === 'player' ||
        /^(jugador|tú|usuario|player)/i.test(m.speaker || '');
      return {
        role: (isUser ? 'user' : 'model') as 'user' | 'model',
        content: String(m.content || m.text || ''),
        timestamp: m.timestamp || new Date().toISOString()
      };
    });

    return {
      id: `cap_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
      name: ch.name || `Capítulo ${idx + 1}`,
      messages: messages.length > 0 ? messages : [
        {
          role: 'model',
          content: `*Inicio del ${ch.name || 'Capítulo'}*`,
          timestamp: new Date().toISOString()
        }
      ],
      autoTitled: true
    };
  });

  if (chats.length === 0) {
    chats.push({
      id: `cap_1_${Math.random().toString(36).substring(2, 7)}`,
      name: 'Capítulo I: El Comienzo',
      messages: [
        {
          role: 'model',
          content: parsed.currentStatus || parsed.storySynopsis || rawText.slice(0, 1000),
          timestamp: new Date().toISOString()
        }
      ],
      autoTitled: true
    });
    totalMessages = 1;
  }

  // PNJs con Ejes de Afinidad
  const npcs: NPC[] = Array.isArray(parsed.npcs)
    ? parsed.npcs.map((n: any, i: number) => ({
        id: `npc_${i}_${Math.random().toString(36).substring(2, 7)}`,
        name: n.name || 'Personaje',
        relation: n.relation || 'Conocido',
        status: n.status || 'Vivo',
        notes: n.notes || '',
        description: n.description || '',
        aparenta: n.aparenta || '',
        oculta: n.oculta || '',
        vinculo: n.vinculo || '',
        atr: typeof n.atr === 'number' ? Math.max(0, Math.min(20, Math.round(n.atr))) : undefined,
        vin: typeof n.vin === 'number' ? Math.max(0, Math.min(20, Math.round(n.vin))) : undefined,
        con: typeof n.con === 'number' ? Math.max(0, Math.min(20, Math.round(n.con))) : undefined,
        recurrente: Boolean(n.vinculo || n.aparenta || n.oculta || (n.vin !== undefined && n.vin >= 4))
      }))
    : [];

  // Quests
  const quests: Quest[] = Array.isArray(parsed.quests)
    ? parsed.quests.map((q: any, i: number) => ({
        id: `quest_${i}_${Math.random().toString(36).substring(2, 7)}`,
        title: q.title || 'Misión',
        origin: q.origin || 'Encuentro',
        objective: q.objective || '',
        progress: q.progress || 'En curso',
        status: q.status || 'active',
        type: q.type || 'principal'
      }))
    : [];

  // Locations
  const locations: Location[] = Array.isArray(parsed.locations)
    ? parsed.locations.map((loc: any, i: number) => ({
        id: `loc_${i}_${Math.random().toString(36).substring(2, 7)}`,
        name: loc.name || 'Lugar',
        desc: loc.desc || '',
        notes: loc.notes || ''
      }))
    : [];

  const memory: Memory = {
    story: parsed.storySynopsis || '',
    quests,
    npcs,
    locations,
    current_status: parsed.currentStatus || 'En curso',
    manual_notes: parsed.manualNotes || `Documento importado (${rawText.length} caracteres).`,
    player_character: playerCharacter
  };

  const project: Project = {
    id: projectId,
    name,
    instructions: parsed.directives ? `${DEFAULT_DM_INSTRUCTIONS}\n\n### Directivas de la Campaña Importada\n${parsed.directives}` : DEFAULT_DM_INSTRUCTIONS,
    system: DEFAULT_SYSTEM,
    style: DEFAULT_STYLE,
    memory,
    files: [],
    chats: []
  };

  return {
    sourceType,
    rawTextLength: rawText.length,
    project,
    chats,
    summary: {
      title: name,
      protagonistName: playerCharacter.name,
      chaptersCount: chats.length,
      messagesCount: totalMessages,
      npcsCount: npcs.length,
      questsCount: quests.length,
      locationsCount: locations.length
    }
  };
}

// Helpers locales para extracción determinista sin IA
function extractTitleFromText(lines: string[]): string | null {
  for (const line of lines.slice(0, 15)) {
    const trimmed = line.trim();
    if (/^#\s+([^#\n]+)/.test(trimmed)) {
      return trimmed.replace(/^#\s+/, '').trim();
    }
    if (/^(campaña|tomo|aventura|crónica|partida)\s*:\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/^(campaña|tomo|aventura|crónica|partida)\s*:\s*(.+)/i);
      if (match && match[2]) return match[2].trim();
    }
  }
  return null;
}

function extractChatsDeterministically(lines: string[]): { chapters: Chat[]; messagesCount: number } {
  const chapters: Chat[] = [];
  let currentMessages: { role: 'user' | 'model'; content: string; timestamp?: string }[] = [];
  let currentChapterName = 'Capítulo I: Inicio de Sesión';
  let totalCount = 0;

  let currentRole: 'user' | 'model' | null = null;
  let currentBuffer: string[] = [];

  const flushMessage = () => {
    if (currentRole && currentBuffer.length > 0) {
      const content = currentBuffer.join('\n').trim();
      if (content) {
        currentMessages.push({
          role: currentRole,
          content,
          timestamp: new Date().toISOString()
        });
        totalCount++;
      }
      currentBuffer = [];
    }
  };

  const flushChapter = () => {
    flushMessage();
    if (currentMessages.length > 0) {
      chapters.push({
        id: `cap_${chapters.length + 1}_${Math.random().toString(36).substring(2, 7)}`,
        name: currentChapterName,
        messages: currentMessages,
        autoTitled: true
      });
      currentMessages = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Detección de salto de capítulo
    if (/^#+\s+(Capítulo|Sesión|Parte|Chapter|Acto)\s+/i.test(trimmed) || /^===\s+(.+)\s+===/.test(trimmed)) {
      flushChapter();
      currentChapterName = trimmed.replace(/^[#=\s]+/, '').replace(/[#=\s]+$/, '').trim();
      continue;
    }

    // Detección de cambio de turno en chats exportados de Gemini, NotebookLM o transcripciones
    const userMatch = trimmed.match(/^(Tú|User|Usuario|Jugador|Player|Prompt)\s*:\s*(.*)/i);
    const modelMatch = trimmed.match(/^(Gemini|Model|Narrador|DM|GM|Master|Assistant|IA|Respuesta)\s*:\s*(.*)/i);

    if (userMatch) {
      flushMessage();
      currentRole = 'user';
      if (userMatch[2]) currentBuffer.push(userMatch[2]);
    } else if (modelMatch) {
      flushMessage();
      currentRole = 'model';
      if (modelMatch[2]) currentBuffer.push(modelMatch[2]);
    } else {
      if (!currentRole) {
        currentRole = 'model';
      }
      currentBuffer.push(line);
    }
  }

  flushChapter();

  if (chapters.length === 0) {
    chapters.push({
      id: `cap_1_${Math.random().toString(36).substring(2, 7)}`,
      name: 'Capítulo I: El Comienzo',
      messages: [
        {
          role: 'model',
          content: lines.slice(0, 100).join('\n').trim() || 'Comienzo de la partida.',
          timestamp: new Date().toISOString()
        }
      ],
      autoTitled: true
    });
    totalCount = 1;
  }

  return { chapters, messagesCount: totalCount };
}

function extractNpcsDeterministically(lines: string[]): NPC[] {
  const npcs: NPC[] = [];
  const npcRegex = /^[*-]\s+\*\*([^*]+)\*\*\s*[:—–-]\s*(.+)/;

  for (const line of lines) {
    const m = line.trim().match(npcRegex);
    if (m) {
      const name = m[1].trim();
      const desc = m[2].trim();
      if (name.length > 1 && name.length < 40 && !npcs.some(n => n.name.toLowerCase() === name.toLowerCase())) {
        npcs.push({
          id: `npc_${npcs.length}_${Math.random().toString(36).substring(2, 7)}`,
          name,
          relation: 'Conocido',
          status: 'Vivo',
          notes: desc,
          vinculo: 'Trato cordial',
          recurrente: true,
          atr: 3,
          vin: 3,
          con: 3
        });
      }
    }
  }
  return npcs.slice(0, 15);
}

function extractQuestsDeterministically(lines: string[]): Quest[] {
  const quests: Quest[] = [];
  for (const line of lines) {
    const m = line.trim().match(/^[*-]\s+\[?\s*(?:Misión|Quest|Encargo|Objetivo)\s*\]?\s*[:—–-]?\s*\*\*?([^*]+)\*\*?\s*[:—–-]?\s*(.*)/i);
    if (m) {
      quests.push({
        id: `quest_${quests.length}_${Math.random().toString(36).substring(2, 7)}`,
        title: m[1].trim(),
        origin: 'Campamento / Cuaderno',
        objective: m[2].trim() || m[1].trim(),
        progress: 'En curso',
        status: 'active',
        type: 'principal'
      });
    }
  }
  return quests.slice(0, 10);
}

function extractLocationsDeterministically(lines: string[]): Location[] {
  const locs: Location[] = [];
  for (const line of lines) {
    const m = line.trim().match(/^[*-]\s+\[?\s*(?:Lugar|Ubicación|Location|Ciudad|Posada|Región)\s*\]?\s*[:—–-]?\s*\*\*?([^*]+)\*\*?\s*[:—–-]?\s*(.*)/i);
    if (m) {
      locs.push({
        id: `loc_${locs.length}_${Math.random().toString(36).substring(2, 7)}`,
        name: m[1].trim(),
        desc: m[2].trim() || 'Lugar descubierto en la campaña.',
        notes: ''
      });
    }
  }
  return locs.slice(0, 10);
}
