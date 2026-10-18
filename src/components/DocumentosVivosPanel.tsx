import React, { useState } from 'react';
import { emojiDeSeccion, TarjetasDeBitacora, TarjetasDeDocumento } from './TarjetasDeDocumento';
import { Check, ChevronDown, ChevronRight, Pencil, Save, Undo2, X } from 'lucide-react';
import type { DocumentosVivos } from '../types';
import {
  importarDesdeClaude,
  partirEnSecciones,
  reemplazarSeccion
} from '../utils/documentosVivos';

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
  const { secciones } = partirEnSecciones(texto);
  const [abierta, setAbierta] = useState<number | null>(() => {
    const primeraConEntradas = secciones.findIndex(s => s.entradas > 0);
    return primeraConEntradas >= 0 ? primeraConEntradas : (secciones.length > 0 ? 0 : null);
  });

  const seccionActiva = abierta !== null && abierta >= 0 && abierta < secciones.length ? abierta : null;

  const empezar = (idx?: number) => {
    const target = typeof idx === 'number' ? idx : seccionActiva;
    if (typeof idx === 'number') setAbierta(idx);
    setBorrador(target !== null && target >= 0 && target < secciones.length ? secciones[target].bloque : texto);
    setEditando(true);
  };

  const guardar = async () => {
    await onGuardar(seccionActiva !== null ? reemplazarSeccion(texto, seccionActiva, borrador) : borrador);
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
              onClick={() => empezar()}
              aria-label="Editar"
              title={seccionActiva !== null ? `Editar «${secciones[seccionActiva].titulo}»` : 'Editar el documento entero'}
              className="min-h-[36px] min-w-[36px] px-2 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] flex items-center justify-center cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {editando ? (
        <textarea
          value={borrador}
          onChange={e => setBorrador(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[60vh] p-3 sm:p-4 bg-[var(--bg-color)] text-[var(--text-primary)] font-mono text-xs sm:text-sm leading-relaxed outline-none resize-y"
        />
      ) : secciones.length === 0 ? (
        <div className="p-4 text-xs text-[var(--text-secondary)] italic">Documento vacío.</div>
      ) : (
        <ul className="m-0 p-0 list-none divide-y divide-[var(--glass-border)]">
          {secciones.map((sec, idx) => {
            const abiertaEsta = abierta === idx;
            const tieneEntradas = sec.entradas > 0;
            return (
              <li key={`${idx}-${sec.titulo}`}>
                <button
                  type="button"
                  onClick={() => setAbierta(abiertaEsta ? null : idx)}
                  className="w-full min-h-[44px] px-3 sm:px-4 py-2.5 flex items-center gap-2 text-left cursor-pointer hover:bg-[var(--glass)] transition-colors"
                >
                  {abiertaEsta ? (
                    <ChevronDown className="w-4 h-4 shrink-0 text-[var(--accent)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
                  )}
                  <span className="text-base shrink-0 leading-none" aria-hidden>
                    {emojiDeSeccion(sec.titulo)}
                  </span>
                  <span className="font-cinzel font-bold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                    {sec.titulo}
                  </span>
                  {tieneEntradas ? (
                    <span className="ml-auto text-[10px] font-cinzel font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
                      {sec.entradas} {sec.entradas === 1 ? 'entrada' : 'entradas'}
                    </span>
                  ) : (
                    <span className="ml-auto text-[10px] text-[var(--text-secondary)] italic opacity-60 shrink-0">
                      (vacío)
                    </span>
                  )}
                </button>
                {abiertaEsta && (
                  <div className="px-3 sm:px-4 pb-3 pt-1 bg-[var(--surface-soft)]/40 border-t border-[var(--glass-border)]/50">
                    <TarjetasDeDocumento texto={texto} seccion={idx} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/*
 * 🏕️ Las entradas se agrupan en temporadas de diez capítulos: la última abierta
 * y las anteriores plegadas, para que la Bitácora no se vuelva un pergamino
 * interminable. Sin IA: es solo orden.
 */
const POR_TEMPORADA = 10;

const Bitacora: React.FC<{ docs: DocumentosVivos }> = ({ docs }) => {
  // Capítulos en orden de aparición (varias partes de un capítulo cuentan como uno).
  const capitulos: string[] = [];
  for (const e of docs.bitacora) if (!capitulos.includes(e.chatId)) capitulos.push(e.chatId);
  const temporadaDe = (chatId: string) => Math.floor(capitulos.indexOf(chatId) / POR_TEMPORADA) + 1;
  const ultimaTemporada = Math.max(1, temporadaDe(capitulos[capitulos.length - 1] || ''));
  const entradas = [...docs.bitacora].reverse();
  const [abierta, setAbierta] = useState<string | null>(entradas[0]?.id || null);
  const [temporadas, setTemporadas] = useState<Set<number>>(new Set([ultimaTemporada]));
  if (!entradas.length) {
    return (
      <section className="rounded-xl border border-dashed border-[var(--glass-border)] px-4 py-3 text-xs text-[var(--text-secondary)]">
        📖 <strong className="font-cinzel text-[var(--accent)]">Bitácora</strong> — todavía vacía. Se escribe sola al
        cerrar cada capítulo (o con «Volcar ahora»).
      </section>
    );
  }
  const grupos: { n: number; entradas: typeof entradas }[] = [];
  for (const e of entradas) {
    const n = temporadaDe(e.chatId);
    const g = grupos.find(x => x.n === n);
    if (g) g.entradas.push(e);
    else grupos.push({ n, entradas: [e] });
  }
  const conTemporadas = grupos.length > 1;
  const alternar = (n: number) =>
    setTemporadas(prev => {
      const s = new Set(prev);
      if (s.has(n)) s.delete(n);
      else s.add(n);
      return s;
    });

  const lista = (es: typeof entradas) => (
    <ul className="m-0 p-0 list-none divide-y divide-[var(--glass-border)]">
      {es.map(e => {
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
            {abiertaEsta && <TarjetasDeBitacora texto={e.texto} />}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] shadow-xs overflow-hidden">
      <header className="px-3 sm:px-4 py-2 border-b border-[var(--glass-border)] bg-[var(--surface-soft)]">
        <h3 className="font-cinzel font-bold text-sm text-[var(--accent)] m-0">📖 Bitácora</h3>
      </header>
      {conTemporadas
        ? grupos.map(g => {
            const desde = (g.n - 1) * POR_TEMPORADA + 1;
            const hasta = Math.min(g.n * POR_TEMPORADA, capitulos.length);
            const abiertaT = temporadas.has(g.n);
            return (
              <div key={g.n} className="border-b last:border-b-0 border-[var(--glass-border)]">
                <button
                  onClick={() => alternar(g.n)}
                  aria-expanded={abiertaT}
                  className="w-full min-h-[40px] px-3 sm:px-4 py-1.5 flex items-center gap-2 text-left cursor-pointer bg-[var(--surface-soft)]/60 hover:bg-[var(--glass)]"
                >
                  <span aria-hidden>🏕️</span>
                  <span className="font-cinzel font-bold text-[11px] sm:text-xs text-[var(--accent)]">Temporada {g.n}</span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    · capítulos {desde}–{hasta}
                  </span>
                  <span className="ml-auto shrink-0 text-[var(--text-secondary)]">
                    {abiertaT ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </button>
                {abiertaT && lista(g.entradas)}
              </div>
            );
          })
        : lista(entradas)}
    </section>
  );
};

/*
 * 📥 IMPORTAR DESDE CLAUDE. Dos cajas, el Cuaderno y la Bitácora del proyecto
 * de Claude, y un avance de lo que va a pasar antes de hacerlo. Sin IA.
 */
export const ImportarDesdeClaude: React.FC<{
  docs: DocumentosVivos;
  onImportar: (pegado: { cuaderno: string; bitacora: string; memoria: string }) => Promise<string[]> | string[];
  onCerrar: () => void;
  /** Dentro de otra ventana que ya lleva título. */
  sinTitulo?: boolean;
}> = ({ docs, onImportar, onCerrar, sinTitulo }) => {
  const [cuaderno, setCuaderno] = useState('');
  const [bitacora, setBitacora] = useState('');
  const [memoria, setMemoria] = useState('');
  const [hecho, setHecho] = useState<string[] | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const avance = [
    ...(cuaderno.trim() || bitacora.trim() ? importarDesdeClaude(docs, { cuaderno, bitacora }).resumen : []),
    ...(memoria.trim() ? [`🧭 Memoria del proyecto: ${memoria.trim().length.toLocaleString('es-ES')} caracteres`] : [])
  ];
  const caja =
    'w-full min-h-[120px] p-2.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-color)] text-[var(--text-primary)] font-mono text-[11px] sm:text-xs leading-relaxed outline-none focus:border-[var(--accent)] resize-y';

  if (hecho) {
    return (
      <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 sm:p-4 flex flex-col gap-2">
        <h3 className="m-0 font-cinzel font-bold text-sm text-emerald-700 dark:text-emerald-300">✅ Importado</h3>
        <ul className="m-0 pl-4 text-xs sm:text-sm text-[var(--text-primary)] flex flex-col gap-0.5">
          {hecho.map(h => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <p className="m-0 text-[11px] text-[var(--text-secondary)]">
          PNJs, tramas, lugares y giros ya se han puesto al día. Si algo no te cuadra, «Deshacer» en el Cuaderno o la Ficha
          vuelve atrás.
        </p>
        <button
          onClick={onCerrar}
          className="self-end min-h-[36px] px-3 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold cursor-pointer"
        >
          👍 Listo
        </button>
      </section>
    );
  }

  return (
    <section
      className={`flex flex-col gap-3 ${sinTitulo ? '' : 'rounded-xl border border-[var(--accent)]/40 bg-[var(--surface)] shadow-xs p-3 sm:p-4'}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          {!sinTitulo && <h3 className="m-0 font-cinzel font-bold text-sm text-[var(--accent)]">📥 Importar desde Claude</h3>}
          <p className="m-0 mt-1 text-[11px] sm:text-xs text-[var(--text-secondary)] leading-relaxed">
            Pega tus documentos y la memoria del proyecto de Claude (rellena solo lo que quieras). Mejor en Markdown (en el documento, exportar o descargar como .md);
            si pegas el texto tal cual, la app reconoce los títulos igualmente. El inventario y el estado del PJ del Cuaderno
            pasan solos a la Ficha viva, y la Bitácora se trocea en una entrada por sesión.
          </p>
        </div>
        {!sinTitulo && (
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          title="Cerrar"
          className="shrink-0 min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
        )}
      </header>
      <label className="flex flex-col gap-1">
        <span className="font-cinzel font-bold text-xs text-[var(--text-primary)]">🕯️ Cuaderno del GM</span>
        <textarea value={cuaderno} onChange={e => setCuaderno(e.target.value)} spellCheck={false} className={caja} placeholder="# Cuaderno GM…" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-cinzel font-bold text-xs text-[var(--text-primary)]">📖 Bitácora</span>
        <textarea value={bitacora} onChange={e => setBitacora(e.target.value)} spellCheck={false} className={caja} placeholder="# Bitácora…" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-cinzel font-bold text-xs text-[var(--text-primary)]">🧭 Memoria del proyecto</span>
        <textarea value={memoria} onChange={e => setMemoria(e.target.value)} spellCheck={false} className={caja} placeholder="Purpose & context…" />
      </label>
      {avance.length > 0 && (
        <div className="rounded-lg bg-[var(--surface-soft)] border border-[var(--glass-border)] px-3 py-2 text-[11px] sm:text-xs text-[var(--text-primary)]">
          <div className="font-cinzel font-bold text-[var(--accent)] mb-1">👀 Esto es lo que va a entrar</div>
          <ul className="m-0 pl-4 flex flex-col gap-0.5">
            {avance.map(a => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="m-0 mt-1.5 text-[var(--text-secondary)]">
            {cuaderno.trim() ? 'El Cuaderno actual se sustituye (con deshacer). ' : ''}
            {bitacora.trim() ? 'Las entradas que ya haya escrito la app se conservan. ' : ''}
            {memoria.trim() ? 'La memoria del proyecto se sustituye.' : ''}
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCerrar}
          className="min-h-[36px] px-3 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] text-xs font-cinzel font-bold cursor-pointer"
        >
          ✋ Cancelar
        </button>
        <button
          disabled={!avance.length || trabajando}
          onClick={async () => {
            setTrabajando(true);
            try {
              setHecho(await onImportar({ cuaderno, bitacora, memoria }));
            } finally {
              setTrabajando(false);
            }
          }}
          className="min-h-[36px] px-3 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          📥 Importar
        </button>
      </div>
    </section>
  );
};

export const DocumentosVivosPanel: React.FC<{
  docs: DocumentosVivos;
  cual: 'ficha' | 'cuaderno' | 'bitacora';
  onGuardar: (cual: 'ficha' | 'cuaderno', texto: string) => Promise<void> | void;
  onDeshacer: (cual: 'ficha' | 'cuaderno') => Promise<void> | void;
  onVolcarAhora?: () => void;
  onSembrarCuaderno?: () => void;
  onImportarDesdeClaude?: (pegado: { cuaderno: string; bitacora: string; memoria: string }) => Promise<string[]> | string[];
}> = ({ docs, cual, onGuardar, onDeshacer, onVolcarAhora, onSembrarCuaderno, onImportarDesdeClaude }) => {
  const [confirmarSembrar, setConfirmarSembrar] = useState(false);
  const [importando, setImportando] = useState(false);

  if (cual === 'bitacora') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)] px-1">
          <span title="Se pone al día sola al cerrar capítulo.">
            🕰️ {docs.actualizadoEl ? fechaCorta(docs.actualizadoEl) : 'Sin actualizar todavía'}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {onImportarDesdeClaude && (
              <button
                onClick={() => setImportando(v => !v)}
                aria-label="Importar desde Claude"
                aria-pressed={importando}
                title="Importar desde Claude: pega el Cuaderno y la Bitácora de tu proyecto de Claude (sin IA)."
                className={`min-h-[36px] min-w-[36px] px-2 rounded-lg border flex items-center justify-center cursor-pointer text-base leading-none ${
                  importando ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--glass-border)] hover:border-[var(--accent)]'
                }`}
              >
                📥
              </button>
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
        {importando && onImportarDesdeClaude && (
          <ImportarDesdeClaude docs={docs} onImportar={onImportarDesdeClaude} onCerrar={() => setImportando(false)} />
        )}
        <Bitacora docs={docs} />
      </div>
    );
  }

  const versiones = docs.versiones?.[cual] || [];
  const ultima = versiones[versiones.length - 1];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)] px-1">
        <span title="Se pone al día sola al cerrar capítulo.">
          🕰️ {docs.actualizadoEl ? fechaCorta(docs.actualizadoEl) : 'Sin actualizar todavía'}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
        {onImportarDesdeClaude && (
          <button
            onClick={() => setImportando(v => !v)}
            aria-label="Importar desde Claude"
            aria-pressed={importando}
            title="Importar desde Claude: pega el Cuaderno y la Bitácora de tu proyecto de Claude (sin IA)."
            className={`min-h-[36px] min-w-[36px] px-2 rounded-lg border flex items-center justify-center cursor-pointer text-base leading-none ${
              importando ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--glass-border)] hover:border-[var(--accent)]'
            }`}
          >
            📥
          </button>
        )}
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
      {importando && onImportarDesdeClaude && (
        <ImportarDesdeClaude docs={docs} onImportar={onImportarDesdeClaude} onCerrar={() => setImportando(false)} />
      )}
      <Documento
        key={cual}
        titulo={cual === 'ficha' ? '🎒 Ficha viva' : '🕯️ Cuaderno del GM'}
        texto={docs[cual]}
        versiones={versiones.length}
        ultimaVersion={ultima ? `${ultima.motivo}, ${fechaCorta(ultima.fecha)}` : undefined}
        onGuardar={t => onGuardar(cual as any, t)}
        onDeshacer={() => onDeshacer(cual as any)}
      />
      {cual === 'ficha' && <Bitacora docs={docs} />}
    </div>
  );
};
