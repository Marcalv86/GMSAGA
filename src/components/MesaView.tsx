import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BookmarkPlus,
  BookOpen,
  ImagePlus,
  Loader,
  MessageSquare,
  Send,
  Swords,
  Trash2,
  Users
} from 'lucide-react';
import { Chat, Project } from '../types';
import { describeApiError, ImagenDeMesa, preguntarAlDirectorOOC } from '../utils/geminiHelper';
import { YouTubePreview } from './YouTubePreview';
import { SpotifyPreview } from './SpotifyPreview';

export interface MensajeDeMesa {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
  /** Lo que el Director apuntó en la memoria en ese mensaje, para poder verlo. */
  memorias?: string[];
  /**
   * Miniaturas de lo que se adjuntó, en `data:` para poder repintarlas.
   *
   * Se guardan reducidas a propósito: la conversación vive en localStorage y
   * una foto de móvil a tamaño completo se come el sitio de la campaña entera.
   */
  adjuntos?: string[];
}

/** Ancho máximo al que se reduce una imagen antes de guardarla y enviarla. */
const ANCHO_MAX_ADJUNTO = 1024;

/**
 * Reduce y recomprime una imagen antes de mandarla.
 *
 * Una foto de móvil son varios megas y varios miles de tokens; a mil px de
 * ancho y calidad 0,8 se ve perfectamente para lo que hace falta aquí —mirar
 * una referencia, leer un mapa— y cuesta una fracción.
 */
async function prepararImagen(file: File): Promise<{ dataUrl: string; imagen: ImagenDeMesa }> {
  const dataUrlOriginal: string = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error('No se pudo leer la imagen.'));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = () => rej(new Error('No se pudo abrir la imagen.'));
    el.src = dataUrlOriginal;
  });

  const escala = Math.min(1, ANCHO_MAX_ADJUNTO / (img.naturalWidth || ANCHO_MAX_ADJUNTO));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.round((img.naturalWidth || ANCHO_MAX_ADJUNTO) * escala));
  lienzo.height = Math.max(1, Math.round((img.naturalHeight || ANCHO_MAX_ADJUNTO) * escala));
  lienzo.getContext('2d')?.drawImage(img, 0, 0, lienzo.width, lienzo.height);

  const dataUrl = lienzo.toDataURL('image/jpeg', 0.8);
  return { dataUrl, imagen: { data: dataUrl.split(',')[1], mimeType: 'image/jpeg' } };
}

const CLAVE_MESA = 'gmstudio_mesa_';
/**
 * Un tope generoso pero real. La conversación de mesa vive en localStorage
 * junto a todo lo demás, y una charla sin fin acabaría compitiendo por el sitio
 * con la campaña, que es lo que de verdad no se puede perder.
 */
const TOPE_MENSAJES = 200;

export function leerMesa(projectId: string): MensajeDeMesa[] {
  try {
    const raw = localStorage.getItem(CLAVE_MESA + projectId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function guardarMesa(projectId: string, mensajes: MensajeDeMesa[]): void {
  try {
    localStorage.setItem(CLAVE_MESA + projectId, JSON.stringify(mensajes.slice(-TOPE_MENSAJES)));
  } catch {
    // Sin sitio: la charla de mesa no vale romper nada.
  }
}

export function borrarMesa(projectId: string): void {
  try {
    localStorage.removeItem(CLAVE_MESA + projectId);
  } catch {
    /* nada que hacer */
  }
}

/**
 * La mesa: hablar con el Director fuera de personaje.
 *
 * Vive aparte del capítulo a propósito. Lo que se dice aquí no es la partida:
 * no avanza el reloj, no entra en la crónica, no toca la ficha y no viaja como
 * contexto en los turnos de juego. Es la conversación que en una mesa de verdad
 * se tiene bajando la voz, con el tablero delante pero sin mover ninguna pieza.
 */
export const MesaView: React.FC<{
  project: Project;
  chats: Chat[];
  currentChatId?: string | null;
  onVolverAJugar?: () => void;
  onAbrirNovela?: () => void;
  /** Apunta en la memoria de la campaña lo que el Director haya pedido recordar. */
  onAnotarEnMemoria?: (notas: string[]) => void;
}> = ({ project, chats, currentChatId, onVolverAJugar, onAbrirNovela, onAnotarEnMemoria }) => {
  const [mensajes, setMensajes] = useState<MensajeDeMesa[]>(() => leerMesa(project.id));
  const [texto, setTexto] = useState('');
  const [adjuntos, setAdjuntos] = useState<{ dataUrl: string; imagen: ImagenDeMesa }[]>([]);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState('');
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMensajes(leerMesa(project.id));
    setError('');
  }, [project.id]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length, pensando]);

  const anadirImagenes = async (files: File[]) => {
    setError('');
    const soloImagenes = files.filter(f => f.type.startsWith('image/'));
    if (soloImagenes.length < files.length) {
      setError('Solo se pueden adjuntar imágenes. Para vídeos, pega el enlace de YouTube en el mensaje.');
    }
    try {
      const preparadas = await Promise.all(soloImagenes.slice(0, 4).map(prepararImagen));
      setAdjuntos(prev => [...prev, ...preparadas].slice(0, 4));
    } catch (err: any) {
      setError(err?.message || 'No se pudo preparar la imagen.');
    }
  };

  const enviar = async () => {
    const pregunta = texto.trim();
    if ((!pregunta && adjuntos.length === 0) || pensando) return;

    const conLaPregunta: MensajeDeMesa[] = [
      ...mensajes,
      {
        role: 'user',
        content: pregunta,
        adjuntos: adjuntos.length ? adjuntos.map(a => a.dataUrl) : undefined,
        timestamp: new Date().toISOString()
      }
    ];
    setMensajes(conLaPregunta);
    guardarMesa(project.id, conLaPregunta);
    setTexto('');
    setAdjuntos([]);
    setPensando(true);
    setError('');

    try {
      const respuesta = await preguntarAlDirectorOOC({
        project,
        chats,
        currentChatId,
        historial: mensajes,
        pregunta: pregunta || '(sin texto: mira la imagen adjunta)',
        imagenes: adjuntos.map(a => a.imagen)
      });
      const completo: MensajeDeMesa[] = [
        ...conLaPregunta,
        {
          role: 'model',
          content: respuesta.texto,
          memorias: respuesta.memorias.length ? respuesta.memorias : undefined,
          timestamp: new Date().toISOString()
        }
      ];
      setMensajes(completo);
      guardarMesa(project.id, completo);
      // Lo que haya pedido apuntar va a la memoria de la campaña, y se ve.
      if (respuesta.memorias.length && onAnotarEnMemoria) {
        onAnotarEnMemoria(respuesta.memorias);
      }
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setPensando(false);
    }
  };

  const limpiar = () => {
    borrarMesa(project.id);
    setMensajes([]);
    setError('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-color)]">
      {/* Cabecera, con el mismo alto que las otras vistas */}
      <div className="bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] border-b border-[var(--glass-border)] px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 flex justify-between items-center gap-2 shrink-0">
        {/* El mismo par que en Jugar, en el mismo sitio y con el mismo aspecto. */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="inline-flex items-center rounded-lg border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-0.5 text-xs font-cinzel shadow-2xs shrink-0">
            {onVolverAJugar && (
              <button
                onClick={onVolverAJugar}
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] cursor-pointer transition-all"
                title="Volver a jugar con el Narrador"
              >
                <Swords className="w-3.5 h-3.5" /> <span>Jugar</span>
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs">
              <Users className="w-3.5 h-3.5" /> <span>GM</span>
            </span>
          </div>
          <span className="hidden md:inline font-cinzel text-xs text-[var(--text-secondary)] truncate">
            fuera de personaje
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onAbrirNovela && (
            <button
              onClick={onAbrirNovela}
              className="text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] hover:bg-[var(--glass)] px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
              title="Leer la crónica en formato novela maquetada"
              aria-label="Modo novela"
            >
              <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Novela</span>
            </button>
          )}
          {mensajes.length > 0 && (
            <span
              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                mensajes.length >= TOPE_MENSAJES * 0.9
                  ? 'bg-amber-500/20 text-amber-950 dark:text-amber-100 border-amber-700/50'
                  : 'text-[var(--text-secondary)] border-[var(--glass-border)]'
              }`}
              title={`Esta conversación guarda como mucho ${TOPE_MENSAJES} mensajes. Al pasarse, los más antiguos se van.`}
            >
              {mensajes.length}/{TOPE_MENSAJES}
            </span>
          )}
        {mensajes.length > 0 && (
          <button
            onClick={limpiar}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-[var(--user-border)] px-2.5 py-1.5 text-[11px] font-cinzel text-[var(--text-secondary)] hover:border-red-500 hover:text-red-600 transition-colors cursor-pointer"
            title="Vaciar esta conversación de mesa. No afecta a la partida."
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vaciar</span>
          </button>
        )}
        </div>
      </div>

      {/*
        El aviso del tope.

        La conversación se recortaba sola al llegar a los doscientos mensajes y
        no se decía: se perdía el principio de la charla sin que nadie lo
        notara. Ahora se avisa antes de llegar, con la cuenta a la vista, para
        poder vaciarla a conciencia en vez de que se caiga por un lado.
      */}
      {mensajes.length >= TOPE_MENSAJES * 0.9 && (
        <div className="px-3 sm:px-4 md:px-6 pt-2 shrink-0">
          <div className="max-w-[900px] mx-auto rounded-lg border border-amber-700/50 bg-amber-500/15 px-2.5 py-2 text-[11px] leading-snug text-amber-950 dark:text-amber-100 flex items-center justify-between gap-2">
            <span>
              {mensajes.length >= TOPE_MENSAJES ? (
                <>
                  <strong>Conversación llena.</strong> A partir de aquí se van perdiendo los mensajes más
                  antiguos.
                </>
              ) : (
                <>
                  <strong>Casi llena</strong> ({mensajes.length} de {TOPE_MENSAJES}). Al pasarse, los más
                  antiguos se irán cayendo.
                </>
              )}{' '}
              Lo que se anotó en la memoria no se pierde: eso vive en Memoria.
            </span>
            <button
              onClick={limpiar}
              className="shrink-0 rounded-lg border border-amber-700/50 px-2.5 py-1 font-cinzel text-[10px] font-bold hover:bg-amber-600/10 cursor-pointer"
            >
              Vaciar
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4">
        <div className="max-w-[900px] mx-auto flex flex-col gap-3">
          {mensajes.length === 0 && !pensando && (
            <div className="text-center py-10 px-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full border border-[var(--user-border)] flex items-center justify-center text-[var(--accent)]">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-cinzel text-base font-bold text-[var(--accent)] m-0 mb-2">
                Habla con el GM
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed m-0">
                Dudas de reglas, aclaraciones de lo que ha pasado, ajustes de tono o de ritmo, decisiones
                de mesa. Aquí no se narra ni pasa el tiempo: nada de lo que se hable entra en la crónica
                ni toca la ficha.
              </p>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed mt-3 mb-0">
                Puedes adjuntar imágenes para que las mire —una referencia de un PNJ, un mapa, una
                ficha— y pegar enlaces de YouTube o Spotify, que se ven aquí mismo. Si le pides recordar
                algo, lo apunta en la memoria de la campaña y te lo enseña.
              </p>
            </div>
          )}

          {mensajes.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'self-end bg-[var(--msg-user)] border border-[var(--user-border)]'
                  : 'self-start bg-[var(--surface-soft)] border border-[var(--glass-border)] markdown-body'
              }`}
            >
              {m.adjuntos?.length ? (
                <div className="flex flex-wrap gap-2 mb-2">
                  {m.adjuntos.map((src, k) => (
                    <img
                      key={k}
                      src={src}
                      alt="Adjunto"
                      className="max-h-40 rounded-lg border border-[var(--glass-border)]"
                    />
                  ))}
                </div>
              ) : null}
              {m.content
                ? m.role === 'user'
                  ? m.content
                  : <ReactMarkdown>{m.content}</ReactMarkdown>
                : null}
              {/*
                Los enlaces se ven, como en el chat de juego. Aquí es donde se
                comparte una referencia visual o una pieza de música para una
                escena, y tener que salir de la app para verla rompe la
                conversación.
              */}
              <YouTubePreview content={m.content} />
              <SpotifyPreview content={m.content} />
              {/*
                Lo apuntado, siempre a la vista.

                Dejar que el Director escriba en la memoria es útil, pero si lo
                hace en silencio deja de saberse qué instrucciones lleva la
                campaña encima. Cada nota se enseña aquí y se puede quitar desde
                Memoria: puede escribir, nunca a escondidas.
              */}
              {m.memorias?.length ? (
                <div className="mt-2 pt-2 border-t border-[var(--glass-border)] flex flex-col gap-1">
                  {m.memorias.map((nota, k) => (
                    <span
                      key={k}
                      className="flex items-start gap-1.5 text-[11px] text-[var(--accent)] font-cinzel"
                      title="Anotado en la memoria de la campaña. Puedes quitarlo desde Memoria."
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span className="font-normal">{nota}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}

          {pensando && (
            <div className="self-start flex items-center gap-2 text-[var(--text-secondary)] text-sm px-3.5 py-2.5">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="font-cinzel text-xs">El Director lo está mirando…</span>
            </div>
          )}

          {error && (
            <div className="self-stretch rounded-xl border border-red-700/50 bg-red-600/10 px-3.5 py-2.5 text-xs text-red-950 dark:text-red-200 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <div ref={finRef} />
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6 pt-2.5 pb-4 border-t border-dashed border-[var(--glass-border)] shrink-0">
        <div className="max-w-[900px] mx-auto">
          {adjuntos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {adjuntos.map((a, k) => (
                <div key={k} className="relative">
                  <img
                    src={a.dataUrl}
                    alt="Adjunto"
                    className="h-16 w-16 object-cover rounded-lg border border-[var(--user-border)]"
                  />
                  <button
                    onClick={() => setAdjuntos(prev => prev.filter((_, i) => i !== k))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs flex items-center justify-center cursor-pointer shadow-md"
                    aria-label="Quitar imagen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="max-w-[900px] mx-auto flex items-end gap-2">
          <input
            ref={inputArchivo}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files?.length) anadirImagenes(Array.from(e.target.files));
              e.target.value = '';
            }}
          />
          <button
            onClick={() => inputArchivo.current?.click()}
            disabled={pensando || adjuntos.length >= 4}
            className="shrink-0 w-11 h-11 rounded-xl border border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer"
            title="Adjuntar una imagen (máximo 4). Para vídeo, pega el enlace de YouTube en el mensaje."
            aria-label="Adjuntar imagen"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            // El texto largo se partía en dos líneas y la segunda quedaba cortada
            // por el campo de una sola fila. La pista de YouTube vive ahora en la
            // pantalla de bienvenida, donde hay sitio para explicarla.
            placeholder="Pregúntale al Director…"
            disabled={pensando}
            className="flex-1 resize-none rounded-xl border border-[var(--user-border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-lora text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60 min-h-[44px] max-h-40"
          />
          <button
            onClick={enviar}
            disabled={pensando || (!texto.trim() && adjuntos.length === 0)}
            className="shrink-0 bg-[var(--accent)] text-[var(--on-accent)] w-11 h-11 rounded-xl flex items-center justify-center hover:bg-[var(--accent-hover)] active:scale-95 transition-all disabled:opacity-30 cursor-pointer"
            aria-label="Enviar al Director"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
