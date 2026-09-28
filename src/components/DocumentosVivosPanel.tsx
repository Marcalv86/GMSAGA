import React, { useState } from 'react';
import { emojiDeSeccion, TarjetasDeBitacora, TarjetasDeDocumento } from './TarjetasDeDocumento';
import { Check, ChevronDown, ChevronRight, Pencil, Save, Undo2, X } from 'lucide-react';
import type { DocumentosVivos } from '../types';
import { partirEnSecciones, reemplazarSeccion } from '../utils/documentosVivos';

/*
 * 📚 La vista de los documentos vivos.
 *
 * Se leen como documento y se corrigen a mano con «Editar». Toda edición, a
 * mano o del volcado, guarda la versión anterior, así que «Deshacer» siempre
 * vuelve un paso atrás.
 */

const fechaCorta = (t?: number) =>
  t ? new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

const Documento: React.FC<{
  titulo: string;
  texto: string;
  versiones: number;
  ultimaVersion?: string;
  onGuardar: (texto: string) => Promise<void> | void;
  onDeshacer: () => Promise<void> | void;
}> = ({ titulo, texto, versiones, ultimaVersion, onGuardar, onDeshacer }) => {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(texto);
  const [confirmarDeshacer, setConfirmarDeshacer] = useState(false);
  /*
   * Una pestaña por sección («## …»), más «Todo». Se lee y se edita la
   * sección elegida; al guardar se vuelve a coser en el documento entero.
   */
  const { secciones } = partirEnSecciones(texto);
  const [pestana, setPestana] = useState<number>(-1);
  const elegida = pestana >= 0 && pestana < secciones.length ? pestana : -1;
  const visible = elegida >= 0 ? secciones[elegida].bloque : texto;

  const empezar = () => {
    setBorrador(visible);
    setEditando(true);
  };
  const guardar = async () => {
    await onGuardar(elegida >= 0 ? reemplazarSeccion(texto, elegida, borrador) : borrador);
    setEditando(false);
  };

  return (
    <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] shadow-xs overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-[var(--glass-border)] bg-[var(--surface-soft)]">
        <h3 className="font-cinzel font-bold text-sm text-[var(--accent)] m-0 truncate">{titulo}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {!editando && versiones > 0 && (
            confirmarDeshacer ? (
              <>
                <button
                  onClick={async () => {
                    await onDeshacer();
                    setConfirmarDeshacer(false);
                  }}
                  className="min-h-[36px] px-2.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-cinzel font-bold cursor-pointer"
                >
                  ↩️ ¿Seguro?
                </button>
                <button
                  onClick={() => setConfirmarDeshacer(false)}
                  className="min-h-[36px] px-2 rounded-lg text-[var(--text-secondary)] text-[11px] cursor-pointer"
                  aria-label="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmarDeshacer(true)}
                aria-label="Deshacer"
                title={`Vuelve a la versión anterior${ultimaVersion ? ` (${ultimaVersion})` : ''}. Quedan ${versiones} guardadas.`}
                className="min-h-[36px] min-w-[36px] px-2 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] flex items-center justify-center cursor-pointer"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )
          )}
          {editando ? (
            <>
              <button
                onClick={guardar}
                aria-label="Guardar"
                title="Guardar"
                className="min-h-[36px] min-w-[36px] px-2 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditando(false)}
                aria-label="Cancelar"
                title="Cancelar"
                className="min-h-[36px] min-w-[36px] px-2 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={empezar}
              aria-label="Editar"
              title={elegida >= 0 ? `Editar «${secciones[elegida].titulo}»` : 'Editar el documento entero'}
              className="min-h-[36px] min-w-[36px] px-2 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] flex items-center justify-center cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>
      {secciones.length > 1 && (
        <nav
          className="flex flex-wrap gap-1.5 px-3 sm:px-4 py-2 border-b border-[var(--glass-border)] bg-[var(--surface)]"
          aria-label="Secciones"
        >
          {[{ titulo: 'Todo', entradas: -1 }, ...secciones].map((sec, i) => {
            const idx = i - 1;
            const activa = idx === elegida;
            return (
              <button
                key={`${idx}-${sec.titulo}`}
                title={sec.titulo}
                aria-label={sec.titulo}
                onClick={() => {
                  if (editando) return;
                  setPestana(idx);
                }}
                disabled={editando && !activa}
                className={`min-h-[36px] min-w-[36px] px-2 rounded-lg text-[11px] font-cinzel font-bold whitespace-nowrap flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activa
                    ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                    : 'text-[var(--text-secondary)] border border-[var(--glass-border)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {i === 0 ? '📖' : emojiDeSeccion(sec.titulo)}
                </span>
                {activa && <span className="whitespace-normal text-left">{sec.titulo}</span>}
                {sec.entradas > 0 && (
                  <span
                    className={`text-[9px] leading-none px-1 py-0.5 rounded-full ${
                      activa ? 'bg-[var(--on-accent)]/20' : 'bg-[var(--glass)] opacity-80'
                    }`}
                  >
                    {sec.entradas}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
      {editando ? (
        <textarea
          value={borrador}
          onChange={e => setBorrador(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[60vh] p-3 sm:p-4 bg-[var(--bg-color)] text-[var(--text-primary)] font-mono text-xs sm:text-sm leading-relaxed outline-none resize-y"
        />
      ) : (
        <TarjetasDeDocumento texto={texto} seccion={elegida >= 0 ? elegida : undefined} />
      )}
    </section>
  );
};

const Bitacora: React.FC<{ docs: DocumentosVivos }> = ({ docs }) => {
  const entradas = [...docs.bitacora].reverse();
  const [abierta, setAbierta] = useState<string | null>(entradas[0]?.id || null);
  if (!entradas.length) {
    return (
      <section className="rounded-xl border border-dashed border-[var(--glass-border)] px-4 py-3 text-xs text-[var(--text-secondary)]">
        📖 <strong className="font-cinzel text-[var(--accent)]">Bitácora</strong> — todavía vacía. Se escribe sola al
        cerrar cada capítulo (o con «Volcar ahora»).
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] shadow-xs overflow-hidden">
      <header className="px-3 sm:px-4 py-2 border-b border-[var(--glass-border)] bg-[var(--surface-soft)]">
        <h3 className="font-cinzel font-bold text-sm text-[var(--accent)] m-0">📖 Bitácora</h3>
      </header>
      <ul className="m-0 p-0 list-none divide-y divide-[var(--glass-border)]">
        {entradas.map(e => {
          const abiertaEsta = abierta === e.id;
          return (
            <li key={e.id}>
              <button
                onClick={() => setAbierta(abiertaEsta ? null : e.id)}
                className="w-full min-h-[44px] px-3 sm:px-4 py-2 flex items-center gap-2 text-left cursor-pointer hover:bg-[var(--glass)]"
              >
                {abiertaEsta ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <span className="font-cinzel font-bold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                  {e.capitulo}
                  {e.parte ? ` · parte ${e.parte}` : ''}
                </span>
                <span className="ml-auto text-[10px] text-[var(--text-secondary)] shrink-0">{fechaCorta(e.fecha)}</span>
              </button>
              {abiertaEsta && (
                <TarjetasDeBitacora texto={e.texto} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export const DocumentosVivosPanel: React.FC<{
  docs: DocumentosVivos;
  cual: 'ficha' | 'cuaderno';
  onGuardar: (cual: 'ficha' | 'cuaderno', texto: string) => Promise<void> | void;
  onDeshacer: (cual: 'ficha' | 'cuaderno') => Promise<void> | void;
  onVolcarAhora?: () => void;
  onSembrarCuaderno?: () => void;
}> = ({ docs, cual, onGuardar, onDeshacer, onVolcarAhora, onSembrarCuaderno }) => {
  const [confirmarSembrar, setConfirmarSembrar] = useState(false);
  const versiones = docs.versiones?.[cual] || [];
  const ultima = versiones[versiones.length - 1];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)] px-1">
        <span title="Se pone al día sola al cerrar capítulo.">
          🕰️ {docs.actualizadoEl ? fechaCorta(docs.actualizadoEl) : 'Sin actualizar todavía'}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
        {cual === 'cuaderno' && onSembrarCuaderno && (
          confirmarSembrar ? (
            <button
              onClick={() => {
                setConfirmarSembrar(false);
                onSembrarCuaderno();
              }}
              onBlur={() => setConfirmarSembrar(false)}
              className="min-h-[36px] px-2.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-cinzel font-bold flex items-center gap-1 cursor-pointer"
              title="Lee tus compendios y llena SOLO las secciones vacías. Lo escrito no se toca."
            >
              🌱 ¿Sembrar?
            </button>
          ) : (
            <button
              onClick={() => setConfirmarSembrar(true)}
              aria-label="Sembrar desde los compendios"
              title="Sembrar desde los compendios: llena las secciones vacías con lo que dicen tus documentos (una llamada a la IA)."
              className="min-h-[36px] min-w-[36px] px-2 rounded-lg border border-[var(--glass-border)] hover:border-[var(--accent)] flex items-center justify-center cursor-pointer text-base leading-none"
            >
              🌱
            </button>
          )
        )}
        {onVolcarAhora && (
          <button
            onClick={onVolcarAhora}
            className="min-h-[36px] px-2.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] text-[11px] font-cinzel font-bold flex items-center gap-1 cursor-pointer shrink-0"
            title="Volcar ahora: pone al día los documentos con lo jugado en el capítulo actual, sin cerrarlo."
            aria-label="Volcar ahora"
          >
            <Save className="w-4 h-4" />
            Volcar
          </button>
        )}
        </span>
      </div>
      <Documento
        key={cual}
        titulo={cual === 'ficha' ? '🎒 Ficha viva' : '🕯️ Cuaderno del GM'}
        texto={docs[cual]}
        versiones={versiones.length}
        ultimaVersion={ultima ? `${ultima.motivo}, ${fechaCorta(ultima.fecha)}` : undefined}
        onGuardar={t => onGuardar(cual, t)}
        onDeshacer={() => onDeshacer(cual)}
      />
      {cual === 'ficha' && <Bitacora docs={docs} />}
    </div>
  );
};
