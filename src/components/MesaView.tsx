import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpen, Loader, MessageSquare, Send, Swords, Trash2, Users } from 'lucide-react';
import { Chat, Project } from '../types';
import { describeApiError, preguntarAlDirectorOOC } from '../utils/geminiHelper';

export interface MensajeDeMesa {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
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
}> = ({ project, chats, currentChatId, onVolverAJugar, onAbrirNovela }) => {
  const [mensajes, setMensajes] = useState<MensajeDeMesa[]>(() => leerMesa(project.id));
  const [texto, setTexto] = useState('');
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

  const enviar = async () => {
    const pregunta = texto.trim();
    if (!pregunta || pensando) return;

    const conLaPregunta: MensajeDeMesa[] = [
      ...mensajes,
      { role: 'user', content: pregunta, timestamp: new Date().toISOString() }
    ];
    setMensajes(conLaPregunta);
    guardarMesa(project.id, conLaPregunta);
    setTexto('');
    setPensando(true);
    setError('');

    try {
      const respuesta = await preguntarAlDirectorOOC({
        project,
        chats,
        currentChatId,
        historial: mensajes,
        pregunta
      });
      const completo: MensajeDeMesa[] = [
        ...conLaPregunta,
        { role: 'model', content: respuesta, timestamp: new Date().toISOString() }
      ];
      setMensajes(completo);
      guardarMesa(project.id, completo);
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
        {/*
          El mismo selector que en Jugar y en Novela, para poder volver.
          Sin él se entra en la mesa y no hay salida evidente: la partida se
          queda al otro lado de una pestaña que ya no se ve.
        */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="inline-flex items-center rounded-lg border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-0.5 text-xs font-cinzel shadow-2xs shrink-0">
            {onVolverAJugar && (
              <button
                onClick={onVolverAJugar}
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] cursor-pointer transition-all"
                title="Volver a jugar"
              >
                <Swords className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Jugar</span>
              </button>
            )}
            {onAbrirNovela && (
              <button
                onClick={onAbrirNovela}
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)] cursor-pointer transition-all"
                title="Leer la crónica en formato novela"
              >
                <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Novela</span>
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs">
              <Users className="w-3.5 h-3.5" /> <span>Mesa</span>
            </span>
          </div>
          <span className="hidden md:inline font-cinzel text-xs text-[var(--text-secondary)] truncate">
            fuera de personaje
          </span>
        </div>
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

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4">
        <div className="max-w-[900px] mx-auto flex flex-col gap-3">
          {mensajes.length === 0 && !pensando && (
            <div className="text-center py-10 px-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full border border-[var(--user-border)] flex items-center justify-center text-[var(--accent)]">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-cinzel text-base font-bold text-[var(--accent)] m-0 mb-2">
                Habla con el Director
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed m-0">
                Dudas de reglas, aclaraciones de lo que ha pasado, ajustes de tono o de ritmo, decisiones
                de mesa. Aquí no se narra ni pasa el tiempo: nada de lo que se hable entra en la crónica
                ni toca la ficha.
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
              {m.role === 'user' ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
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
        <div className="max-w-[900px] mx-auto flex items-end gap-2">
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
            placeholder="Pregúntale al Director…"
            disabled={pensando}
            className="flex-1 resize-none rounded-xl border border-[var(--user-border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-lora text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60 min-h-[44px] max-h-40"
          />
          <button
            onClick={enviar}
            disabled={pensando || !texto.trim()}
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
