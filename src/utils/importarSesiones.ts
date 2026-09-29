import type { Message } from '../types';

/*
 * 📥 IMPORTAR SESIONES JUGADAS EN CLAUDE COMO CAPÍTULOS.
 *
 * Dos vías:
 *
 * - La exportación de datos de Claude (Ajustes → Privacidad → Exportar datos):
 *   un .zip con `conversations.json`, donde cada mensaje dice quién lo
 *   escribió. Es la vía buena: nada que adivinar.
 * - Un chat pegado a mano, con etiquetas al principio de cada intervención
 *   («Tú: …» / «Claude: …»). Sin etiquetas no hay forma fiable de saber qué
 *   escribió cada cual, así que no se adivina.
 *
 * Se lee todo en el navegador, sin IA.
 */

export interface SesionDeChat {
  /** Id de la conversación de origen, si la hay (para no importarla dos veces). */
  origen?: string;
  nombre: string;
  /** Fecha de la conversación, en milisegundos. */
  fecha?: number;
  mensajes: Message[];
}

// ---------------------------------------------------------------- .zip

/** Saca un fichero de un .zip (sin ZIP64). Devuelve null si no está. */
async function leerDeZip(zip: ArrayBuffer, buscado: (nombre: string) => boolean): Promise<string | null> {
  const v = new DataView(zip);
  const bytes = new Uint8Array(zip);
  // Fin del directorio central: firma 0x06054b50, buscada desde el final.
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error('El archivo no parece un .zip válido.');
  const entradas = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const texto = new TextDecoder();
  for (let n = 0; n < entradas; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const tamComprimido = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const largoExtra = v.getUint16(p + 30, true);
    const largoComentario = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = texto.decode(bytes.subarray(p + 46, p + 46 + largoNombre));
    p += 46 + largoNombre + largoExtra + largoComentario;
    if (!buscado(nombre)) continue;
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const datos = bytes.slice(inicio, inicio + tamComprimido);
    if (metodo === 0) return texto.decode(datos);
    if (metodo !== 8) throw new Error(`«${nombre}» usa una compresión que no sé abrir.`);
    const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(flujo).text();
  }
  return null;
}

// ---------------------------------------------------------------- exportación de Claude

interface MensajeExportado {
  sender?: string;
  text?: string;
  content?: { type?: string; text?: string }[];
  created_at?: string;
}

interface ConversacionExportada {
  uuid?: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  chat_messages?: MensajeExportado[];
}

const textoDeMensaje = (m: MensajeExportado): string => {
  const bloques = (m.content || []).filter(c => c?.type === 'text' && typeof c.text === 'string').map(c => c.text!.trim());
  const t = bloques.length ? bloques.join('\n\n') : (m.text || '').trim();
  return t;
};

/** Las conversaciones de una exportación de Claude, de la más antigua a la más reciente. */
export function leerConversacionesDeClaude(json: unknown): SesionDeChat[] {
  const lista: ConversacionExportada[] = Array.isArray(json)
    ? (json as ConversacionExportada[])
    : Array.isArray((json as { conversations?: unknown })?.conversations)
      ? ((json as { conversations: ConversacionExportada[] }).conversations)
      : [];
  return lista
    .map(c => {
      const mensajes: Message[] = (c.chat_messages || [])
        .map(m => ({
          role: (/^(human|user)$/i.test(m.sender || '') ? 'user' : 'model') as Message['role'],
          content: textoDeMensaje(m),
          ...(m.created_at ? { timestamp: m.created_at } : {})
        }))
        .filter(m => m.content);
      const fecha = Date.parse(c.created_at || c.updated_at || '');
      return {
        origen: c.uuid,
        nombre: (c.name || '').trim() || 'Sesión sin título',
        ...(Number.isFinite(fecha) ? { fecha } : {}),
        mensajes
      };
    })
    .filter(s => s.mensajes.length > 0)
    .sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
}

/** Lee un .zip de exportación o un conversations.json suelto. */
export async function leerArchivoDeExportacion(archivo: File): Promise<SesionDeChat[]> {
  const buffer = await archivo.arrayBuffer();
  const esZip = new DataView(buffer).byteLength > 4 && new DataView(buffer).getUint32(0, true) === 0x04034b50;
  const crudo = esZip
    ? await leerDeZip(buffer, n => /(^|\/)conversations\.json$/i.test(n))
    : new TextDecoder().decode(buffer);
  if (!crudo) throw new Error('En el .zip no hay ningún conversations.json.');
  let json: unknown;
  try {
    json = JSON.parse(crudo);
  } catch {
    throw new Error('El archivo no tiene el formato de la exportación de Claude.');
  }
  const sesiones = leerConversacionesDeClaude(json);
  if (!sesiones.length) throw new Error('No he encontrado conversaciones con mensajes en el archivo.');
  return sesiones;
}

// ---------------------------------------------------------------- chat pegado

/*
 * Quién habla, según las marcas que dejan los plugins de exportar chats y las
 * que se escriben a mano: «## Prompt:» / «## Response:», «## User» / «## Claude»,
 * «**You:**» / «**Claude:**», «Tú: …» / «Narrador: …». En un título («## …») los
 * dos puntos son opcionales; en una línea normal, obligatorios.
 */
const JUGADORA = '(?:t[uú]|yo|you|jugadora|jugador|human|humano|user|usuario|prompt|pregunta)';
const NARRADOR = '(?:claude|narrador|narradora|gm|dm|director|assistant|asistente|m[aá]ster|response|respuesta|ai|ia)';
const marca = (quien: string) =>
  new RegExp(
    `^(?:#{1,4}\\s*(?:\\*\\*)?${quien}(?:\\*\\*)?\\s*:?\\s*(?:\\*\\*)?\\s*$|(?:#{1,4}\\s*)?(?:\\*\\*)?${quien}(?:\\*\\*)?\\s*:\\s*(?:\\*\\*)?\\s*)`,
    'i'
  );
const ETIQUETA_JUGADORA = marca(JUGADORA);
const ETIQUETA_NARRADOR = marca(NARRADOR);

/** El título del chat: el primer «# …» del archivo, si lo hay. */
export const tituloDeChat = (texto: string): string | undefined =>
  (texto || '').match(/^#\s+(.+?)\s*$/m)?.[1]?.replace(/[*_]/g, '').trim() || undefined;

/**
 * Un chat en Markdown (el de un plugin de exportar) o pegado a mano, con cada
 * intervención marcada por quién habla. Sin marcas devuelve [].
 */
export function trocearChatPegado(texto: string): Message[] {
  const mensajes: Message[] = [];
  let actual: Message | null = null;
  for (const linea of (texto || '').replace(/\r\n?/g, '\n').split('\n')) {
    const j = linea.match(ETIQUETA_JUGADORA);
    const n = j ? null : linea.match(ETIQUETA_NARRADOR);
    if (j || n) {
      if (actual && actual.content.trim()) mensajes.push({ ...actual, content: actual.content.trim() });
      const resto = linea.slice((j || n)![0].length);
      actual = { role: j ? 'user' : 'model', content: resto ? `${resto}\n` : '' };
      continue;
    }
    if (actual) actual.content += `${linea}\n`;
  }
  if (actual && actual.content.trim()) mensajes.push({ ...actual, content: actual.content.trim() });
  return mensajes.map(limpiarMensajeExportado).filter(m => m.content);
}

/*
 * Lo que los plugins de exportar dejan alrededor de cada mensaje y no es
 * partida: la línea «> 9/23/2026 22:17:03» con la hora (que pasa a ser la del
 * mensaje) y, en las respuestas, el bloque «> Preparando… / - Make doc
 * changes / - Done» con lo que hizo Claude por dentro.
 */
const FECHA_US = /^>\s*(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/;

const fechaUS = (m: RegExpMatchArray) =>
  new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), Number(m[4]), Number(m[5]), Number(m[6] || 0));

function limpiarMensajeExportado(m: Message): Message {
  const lineas = m.content.split('\n');
  let timestamp = m.timestamp;
  let i = 0;
  const hora = lineas[0]?.trim().match(FECHA_US);
  if (hora) {
    timestamp = fechaUS(hora).toISOString();
    i = 1;
    while (i < lineas.length && !lineas[i].trim()) i++;
  }
  // Los adjuntos («> File: …») no son texto de la partida.
  while (i < lineas.length && /^>\s*(files?|archivos?|attachments?|adjuntos?)\s*:/i.test(lineas[i])) {
    i++;
    while (i < lineas.length && !lineas[i].trim()) i++;
  }
  // El bloque de actividad solo va en las respuestas, justo al principio.
  if (m.role === 'model' && lineas[i]?.startsWith('>')) {
    while (i < lineas.length && (lineas[i].startsWith('>') || (!lineas[i].trim() && lineas[i + 1]?.startsWith('>')))) i++;
    while (i < lineas.length && !lineas[i].trim()) i++;
  }
  return { ...m, content: lineas.slice(i).join('\n').trim(), ...(timestamp ? { timestamp } : {}) };
}

/** La fecha de creación que ponen los plugins («**Created:** 9/23/2026 22:17:01»). */
export function fechaDeChat(texto: string): number | undefined {
  const m = (texto || '').match(/\*\*(?:Created|Creado):\*\*\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  return m ? fechaUS(m).getTime() : undefined;
}
