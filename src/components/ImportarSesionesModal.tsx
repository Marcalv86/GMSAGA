import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2, Upload, X } from 'lucide-react';
import {
  leerArchivoDeExportacion,
  fechaDeChat,
  tituloDeChat,
  trocearChatPegado,
  type SesionDeChat
} from '../utils/importarSesiones';

/*
 * 📥 IMPORTAR SESIONES COMO CAPÍTULOS.
 *
 * Sube los .md de tus chats (uno por sesión, los de un plugin de exportar),
 * la exportación de datos de Claude (.zip), o pega un chat. Se revisa la
 * lista —nombre, orden, cuántos mensajes de cada uno— y entran como capítulos
 * cerrados delante de los que ya haya, listos para releer en formato novela.
 */

interface Pendiente extends SesionDeChat {
  clave: string;
  elegida: boolean;
}

const fechaCorta = (t?: number) => (t ? new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// «Sesión 10» después de «Sesión 9».
const ordenNatural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

export const ImportarSesionesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onImportar: (sesiones: SesionDeChat[]) => Promise<void> | void;
}> = ({ isOpen, onClose, onImportar }) => {
  const [lista, setLista] = useState<Pendiente[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [pegado, setPegado] = useState('');
  const [nombrePegado, setNombrePegado] = useState('');
  const [filtro, setFiltro] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const añadir = (nuevas: SesionDeChat[], elegida: boolean) =>
    setLista(prev => {
      const ya = new Set(prev.map(p => p.origen).filter(Boolean));
      const suma = nuevas
        .filter(n => !n.origen || !ya.has(n.origen))
        .map((n, i) => ({ ...n, elegida, clave: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}` }));
      const todas = [...prev, ...suma];
      // Si todas tienen fecha, por fecha; si no, por nombre («Sesión 2» antes que «Sesión 10»).
      return todas.every(t => t.fecha) ? todas.sort((a, b) => a.fecha! - b.fecha!) : todas.sort((a, b) => ordenNatural(a.nombre, b.nombre));
    });

  const leerArchivos = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setTrabajando(true);
    const fallos: string[] = [];
    const sueltas: SesionDeChat[] = [];
    for (const f of Array.from(archivos)) {
      try {
        if (/\.(zip|json)$/i.test(f.name)) {
          // Una exportación trae TODAS tus conversaciones: se listan sin marcar para que elijas.
          añadir(await leerArchivoDeExportacion(f), false);
          continue;
        }
        const texto = await f.text();
        const mensajes = trocearChatPegado(texto);
        if (!mensajes.length) {
          fallos.push(`«${f.name}»: no encuentro quién habla en cada mensaje.`);
          continue;
        }
        const fecha = fechaDeChat(texto);
        sueltas.push({ nombre: tituloDeChat(texto) || f.name.replace(/\.[^.]+$/, ''), mensajes, ...(fecha ? { fecha } : {}) });
      } catch (err) {
        fallos.push(`«${f.name}»: ${err instanceof Error ? err.message : 'no se pudo leer'}`);
      }
    }
    if (sueltas.length) añadir(sueltas, true);
    setAvisos(fallos);
    setTrabajando(false);
    if (entrada.current) entrada.current.value = '';
  };

  const añadirPegado = () => {
    const mensajes = trocearChatPegado(pegado);
    if (!mensajes.length) {
      setAvisos(['En lo pegado no encuentro quién habla. Cada intervención tiene que empezar por «Tú:» / «Claude:», «## Prompt:» / «## Response:» o algo parecido.']);
      return;
    }
    añadir([{ nombre: nombrePegado.trim() || tituloDeChat(pegado) || 'Sesión importada', mensajes }], true);
    setPegado('');
    setNombrePegado('');
    setAvisos([]);
  };

  const mover = (i: number, d: -1 | 1) =>
    setLista(prev => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  const elegidas = lista.filter(s => s.elegida);
  const visibles = lista
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !filtro.trim() || s.nombre.toLowerCase().includes(filtro.trim().toLowerCase()));
  const boton =
    'min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer disabled:opacity-30';

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl border border-[var(--accent)]/50 bg-[var(--surface)] shadow-2xl overflow-hidden">
        <header className="flex items-start justify-between gap-2 px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--surface-soft)]">
          <div>
            <h2 className="m-0 font-cinzel font-bold text-base text-[var(--accent)]">📥 Importar sesiones</h2>
            <p className="m-0 mt-0.5 text-[11px] sm:text-xs text-[var(--text-secondary)] leading-relaxed">
              Cada sesión entra como un capítulo cerrado, delante de los que ya tengas, lista para releer en 📖 novela.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className={boton}>
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3">
          <button
            onClick={() => entrada.current?.click()}
            disabled={trabajando}
            className="w-full rounded-xl border-2 border-dashed border-[var(--accent)]/40 hover:border-[var(--accent)] bg-[var(--accent)]/5 p-4 flex flex-col items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-6 h-6 text-[var(--accent)]" />
            <span className="font-cinzel font-bold text-sm text-[var(--accent)]">
              {trabajando ? '⏳ Leyendo…' : 'Sube tus chats en .md (puedes elegir varios)'}
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              También vale la exportación de datos de Claude (.zip o conversations.json).
            </span>
          </button>
          <input
            ref={entrada}
            type="file"
            multiple
            accept=".md,.markdown,.txt,.json,.zip"
            className="hidden"
            onChange={e => void leerArchivos(e.target.files)}
          />

          <details className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface-soft)]">
            <summary className="cursor-pointer px-3 py-2 min-h-[40px] flex items-center font-cinzel font-bold text-xs text-[var(--text-primary)]">
              📋 O pega un chat
            </summary>
            <div className="p-3 pt-0 flex flex-col gap-2">
              <input
                value={nombrePegado}
                onChange={e => setNombrePegado(e.target.value)}
                placeholder="Nombre del capítulo (opcional)"
                className="w-full min-h-[36px] px-2.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-color)] text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)]"
              />
              <textarea
                value={pegado}
                onChange={e => setPegado(e.target.value)}
                placeholder={'## Prompt:\nMe asomo a la ventana.\n\n## Response:\nLa gaviota aletea…'}
                spellCheck={false}
                className="w-full min-h-[120px] p-2.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-color)] text-[var(--text-primary)] font-mono text-[11px] outline-none focus:border-[var(--accent)] resize-y"
              />
              <button
                onClick={añadirPegado}
                disabled={!pegado.trim()}
                className="self-end min-h-[36px] px-3 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold cursor-pointer disabled:opacity-40"
              >
                ➕ Añadir a la lista
              </button>
            </div>
          </details>

          {avisos.length > 0 && (
            <ul className="m-0 pl-4 text-[11px] text-rose-700 dark:text-rose-300 flex flex-col gap-0.5">
              {avisos.map(a => (
                <li key={a}>⚠️ {a}</li>
              ))}
            </ul>
          )}

          {lista.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 font-cinzel font-bold text-xs text-[var(--text-primary)]">
                  📚 {elegidas.length} de {lista.length} para importar
                </h3>
                {lista.length > 6 && (
                  <input
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                    placeholder="🔎 Filtrar por nombre"
                    className="min-h-[32px] w-40 sm:w-52 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-color)] text-[var(--text-primary)] text-[11px] outline-none focus:border-[var(--accent)]"
                  />
                )}
              </div>
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                {visibles.map(({ s, i }) => {
                  const suyos = s.mensajes.filter(m => m.role === 'user').length;
                  return (
                    <li
                      key={s.clave}
                      className={`rounded-lg border px-2 py-1.5 flex items-center gap-2 ${
                        s.elegida ? 'border-[var(--accent)]/50 bg-[var(--accent)]/5' : 'border-[var(--glass-border)] opacity-70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={s.elegida}
                        onChange={e => setLista(prev => prev.map(p => (p.clave === s.clave ? { ...p, elegida: e.target.checked } : p)))}
                        className="w-4 h-4 accent-[var(--accent)] shrink-0 cursor-pointer"
                        aria-label={`Importar ${s.nombre}`}
                      />
                      <div className="flex-1 min-w-0">
                        <input
                          value={s.nombre}
                          onChange={e => setLista(prev => prev.map(p => (p.clave === s.clave ? { ...p, nombre: e.target.value } : p)))}
                          className="w-full bg-transparent font-cinzel font-bold text-xs text-[var(--text-primary)] outline-none border-b border-transparent focus:border-[var(--accent)]"
                        />
                        <div className="text-[10px] text-[var(--text-secondary)]">
                          🧝 {suyos} · 🕯️ {s.mensajes.length - suyos}
                          {s.fecha ? ` · ${fechaCorta(s.fecha)}` : ''}
                        </div>
                      </div>
                      <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" title="Subir" className={boton}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label="Bajar" title="Bajar" className={boton}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setLista(prev => prev.filter(p => p.clave !== s.clave))}
                        aria-label="Quitar de la lista"
                        title="Quitar de la lista"
                        className={boton}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <footer className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--glass-border)] bg-[var(--surface-soft)]">
          <button
            onClick={onClose}
            className="min-h-[36px] px-3 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] text-xs font-cinzel font-bold cursor-pointer"
          >
            ✋ Cancelar
          </button>
          <button
            disabled={!elegidas.length || trabajando}
            onClick={async () => {
              setTrabajando(true);
              try {
                await onImportar(elegidas.map(({ clave: _c, elegida: _e, ...s }) => s));
                setLista([]);
                onClose();
              } finally {
                setTrabajando(false);
              }
            }}
            className="min-h-[36px] px-3 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📥 Importar {elegidas.length || ''} {elegidas.length === 1 ? 'capítulo' : 'capítulos'}
          </button>
        </footer>
      </div>
    </div>
  );
};
