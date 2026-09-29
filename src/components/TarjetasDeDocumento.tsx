import React from 'react';
import ReactMarkdown from 'react-markdown';
import { partirEnSecciones } from '../utils/documentosVivos';

/*
 * 🃏 Los documentos vivos, en tarjetas.
 *
 * El texto sigue siendo Markdown (así lo escribe el volcado y así se edita),
 * pero se enseña como lo que es: secciones con entradas. Cada entrada
 * «**Nombre** — lo que sea» es una tarjeta con el nombre arriba; los vínculos
 * llevan sus ejes en chapitas y los relojes, sus segmentos en puntos.
 */

type Bloque =
  | { tipo: 'entrada'; nombre?: string; texto: string; clase?: string }
  | { tipo: 'grupo'; titulo: string; lineas: string[] }
  | { tipo: 'parrafo'; texto: string };

/*
 * 🎨 Un emoji por sección, por su nombre. Si el nombre no suena a ninguno,
 * se queda con una vela: el cuaderno es cosa del Director.
 */
const EMOJIS: [RegExp, string][] = [
  [/estado general|ahora/i, '🧭'],
  [/reloj/i, '⏳'],
  [/verdad oculta|tramas?/i, '🎭'],
  [/actores|facciones/i, '♟️'],
  [/fuera de c[aá]mara|bambalinas/i, '🕯️'],
  [/lugares/i, '🗺️'],
  [/tono|l[ií]mites/i, '🎚️'],
  [/pnjs? menores|secundari/i, '👥'],
  [/v[ií]nculo|relaciones/i, '💞'],
  [/secreto/i, '🔒'],
  [/hilo/i, '🧵'],
  [/estado del pj|nivel|salud|pg\b/i, '❤️‍🩹'],
  [/canon/i, '📜'],
  [/semilla|preparad/i, '🌱'],
  [/consecuencia/i, '⚖️'],
  [/reputaci|rumor/i, '📣'],
  [/arranque|corte/i, '🎬'],
  [/dinero|monedas/i, '💰'],
  [/lleva encima/i, '🧥'],
  [/mochila|contenedor|inventario/i, '🎒'],
  [/guardado/i, '🏠'],
  [/requisad|manos ajenas/i, '⛓️'],
  [/encargo/i, '📦'],
  [/compras/i, '🛒'],
  [/vida cotidiana/i, '🍲'],
  [/modo de escritura/i, '✍️'],
  [/hechos|decisiones/i, '📜'],
  [/progresi|avance/i, '⭐'],
  [/cambios de canon/i, '✨']
];

export const emojiDeSeccion = (titulo: string): string =>
  EMOJIS.find(([re]) => re.test(titulo))?.[1] || '🕯️';

const EMOJI_DE_ETIQUETA: Record<string, string> = { vínculo: '💞', vinculo: '💞', secreto: '🔒', hilo: '🧵' };

const esVacio = (t: string) => /^\(vac[ií]o\)$/i.test(t.trim());

/** Separa «**Nombre** — resto» (o «Nombre — resto») en nombre y texto. */
function partirEntrada(t: string): { nombre?: string; texto: string; clase?: string } {
  // Etiquetas del cuaderno: «[VÍNCULO: Nombre | … ]», «[SECRETO: título | … ]», «[HILO: … ]».
  const etiqueta = t.match(/^\[\s*([A-ZÁÉÍÓÚÑ]+)\s*:\s*([^|\]]+?)\s*(?:\|\s*(.*?))?\]?\s*$/s);
  if (etiqueta) {
    return {
      clase: etiqueta[1].charAt(0) + etiqueta[1].slice(1).toLowerCase(),
      nombre: etiqueta[2].trim(),
      texto: (etiqueta[3] || '').replace(/\s*\|\s*/g, ' · ').trim()
    };
  }
  const negrita = t.match(/^\*\*(.+?)\*\*\s*(?:[—:–-]\s*)?(.*)$/s);
  if (negrita) return { nombre: negrita[1].trim(), texto: negrita[2].trim() };
  const raya = t.match(/^([^—:]{2,50}?)\s+—\s+(.*)$/s);
  if (raya && raya[1].split(' ').length <= 6) return { nombre: raya[1].trim(), texto: raya[2].trim() };
  return { texto: t.trim() };
}

/** Las líneas de una sección, agrupadas en entradas, subsecciones y párrafos. */
function leerBloques(lineas: string[]): Bloque[] {
  const fuera: Bloque[] = [];
  let grupo: { tipo: 'grupo'; titulo: string; lineas: string[] } | null = null;
  for (const bruta of lineas) {
    const l = bruta.trimEnd();
    if (!l.trim()) continue;
    const h3 = l.match(/^#{3,}\s+(.+)$/);
    if (h3) {
      grupo = { tipo: 'grupo', titulo: h3[1].replace(/^TRAMA\s*:\s*/i, '').trim(), lineas: [] };
      fuera.push(grupo);
      continue;
    }
    if (grupo) {
      grupo.lineas.push(l.replace(/^\s*[-*]\s+/, ''));
      continue;
    }
    const vineta = l.match(/^\s*[-*]\s+(.*)$/);
    if (vineta) {
      if (esVacio(vineta[1])) continue;
      fuera.push({ tipo: 'entrada', ...partirEntrada(vineta[1]) });
    } else if (!l.startsWith('>')) {
      fuera.push({ tipo: 'parrafo', texto: l.trim() });
    }
  }
  return fuera;
}

/** ATR/VÍN/CON y relojes «n/m» en chapitas, si la entrada los lleva. */
function Marcadores({ texto }: { texto: string }) {
  const ejes = [
    { k: 'ATR', m: texto.match(/\bATR\s*[:=]?\s*(\d+|desea|inter[eé]s)/i) },
    { k: 'VÍN', m: texto.match(/\bV[IÍ]N\s*[:=]?\s*(\d+)/i) },
    { k: 'CON', m: texto.match(/\bCON\s*[:=]?\s*(\d+)/i) }
  ].filter(e => e.m);
  // Bolitas solo para relojes de verdad («reloj» o «Nombre — 3/6»), no para «PG 27/27» o «ranuras 4/4».
  const esReloj = /\breloj/i.test(texto) || /—\s*\d{1,2}\s*\/\s*\d{1,2}(?:\s|$|·)/.test(texto);
  const reloj = esReloj ? texto.match(/(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$|·)/) : null;
  if (!ejes.length && !reloj) return null;
  const EJE: Record<string, { emoji: string; nombre: string; barra: string }> = {
    ATR: { emoji: '🔥', nombre: 'Atracción', barra: 'bg-rose-500 dark:bg-rose-400' },
    VÍN: { emoji: '🤝', nombre: 'Vínculo', barra: 'bg-amber-500 dark:bg-amber-400' },
    CON: { emoji: '🛡️', nombre: 'Confianza', barra: 'bg-emerald-600 dark:bg-emerald-400' }
  };
  return (
    <div className="flex flex-col gap-1.5 mb-2">
      {ejes.length > 0 && (
        <div className="grid gap-1">
          {ejes.map(e => {
            const v = e.m![1];
            const n = Number(v);
            const eje = EJE[e.k];
            // Sin número (ATR «desea» / «interés»): una chapita en lugar de la barra.
            if (!Number.isFinite(n)) {
              return (
                <div key={e.k} className="flex items-center gap-1.5 text-[10px] font-cinzel font-bold text-[var(--text-secondary)]">
                  <span aria-hidden>{eje.emoji}</span>
                  <span className="w-[62px] shrink-0">{eje.nombre}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    {/desea/i.test(v) ? '💘 la desea' : '💫 interés'}
                  </span>
                </div>
              );
            }
            // La escala es de 0 a 10; si viene sobre 20 (fichas antiguas), se lleva a 10.
            const sobre = n > 10 ? 20 : 10;
            const pct = Math.max(0, Math.min(100, (n / sobre) * 100));
            return (
              <div
                key={e.k}
                className="flex items-center gap-1.5 text-[10px] font-cinzel font-bold text-[var(--text-secondary)]"
                title={`${eje.nombre}: ${n} de ${sobre}`}
              >
                <span aria-hidden>{eje.emoji}</span>
                <span className="w-[62px] shrink-0">{eje.nombre}</span>
                <span className="flex-1 h-1.5 rounded-full bg-[var(--glass-border)] overflow-hidden">
                  <span className={`block h-full rounded-full ${eje.barra}`} style={{ width: `${pct}%` }} />
                </span>
                <span className="w-5 text-right tabular-nums text-[var(--text-primary)]">{n}</span>
              </div>
            );
          })}
        </div>
      )}
      {reloj && Number(reloj[2]) <= 12 && Number(reloj[1]) <= Number(reloj[2]) && (
        <span className="inline-flex items-center gap-0.5" title={`${reloj[1]} de ${reloj[2]}`}>
          {Array.from({ length: Number(reloj[2]) }).map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full border ${
                i < Number(reloj[1])
                  ? 'bg-[var(--accent)] border-[var(--accent)]'
                  : 'border-[var(--text-secondary)]/50'
              }`}
            />
          ))}
        </span>
      )}
    </div>
  );
}

/** Quita del texto el «ATR n · VÍN n · CON n» que ya enseñan las barras. */
const sinEjes = (t: string) =>
  t
    .replace(/^\s*(?:atr:\s*[+-]?\d+\s*→\s*)?ATR\s*[:=]?\s*(?:\d+|desea|inter[eé]s)\s*·\s*V[IÍ]N\s*[:=]?\s*\d+\s*·\s*CON\s*[:=]?\s*\d+\s*[—·.:-]?\s*/i, '')
    .trim() || t;

const Texto = ({ children }: { children: string }) => (
  <div className="markdown-body text-[var(--text-primary)] text-xs sm:text-[13px] leading-relaxed font-lora break-words [&_p]:m-0 [&_p+p]:mt-1.5">
    <ReactMarkdown>{children}</ReactMarkdown>
  </div>
);

function Bloques({ bloques, columnas }: { bloques: Bloque[]; columnas: boolean }) {
  if (!bloques.length) {
    return <p className="m-0 text-[11px] italic text-[var(--text-secondary)] opacity-70">🍃 Nada todavía.</p>;
  }
  return (
    <div className={`grid gap-2 ${columnas ? 'md:grid-cols-2' : ''}`}>
      {bloques.map((b, i) => {
        if (b.tipo === 'parrafo') {
          return (
            <div key={i} className={columnas ? 'md:col-span-2' : ''}>
              <Texto>{b.texto}</Texto>
            </div>
          );
        }
        if (b.tipo === 'grupo') {
          return (
            <div key={i} className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface-soft)] p-3 shadow-xs">
              <div className="font-cinzel font-bold text-[13px] text-[var(--accent)] mb-1.5">
                {emojiDeSeccion(b.titulo)} {b.titulo}
              </div>
              <div className="flex flex-col gap-1">
                {b.lineas.filter(l => !esVacio(l)).map((l, j) => (
                  <Texto key={j}>{l}</Texto>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={i} className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface-soft)] p-3 shadow-xs">
            {(b.nombre || b.clase) && (
              <div className="flex items-start justify-between gap-2 mb-1">
                {b.nombre ? (
                  <div className="font-cinzel font-bold text-[13px] text-[var(--accent)]">
                    <ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>{b.nombre}</ReactMarkdown>
                  </div>
                ) : (
                  <span />
                )}
                {b.clase && (
                  <span className="shrink-0 text-[9px] font-cinzel font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                    {EMOJI_DE_ETIQUETA[b.clase.toLowerCase()] || '🏷️'} {b.clase}
                  </span>
                )}
              </div>
            )}
            <Marcadores texto={`${b.nombre || ''} ${b.texto}`} />
            {b.texto && <Texto>{sinEjes(b.texto)}</Texto>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Un documento en tarjetas. Con `seccion` enseña solo esa sección con sus
 * entradas a lo ancho; sin ella, una tarjeta por sección.
 */
export const TarjetasDeDocumento: React.FC<{ texto: string; seccion?: number }> = ({ texto, seccion }) => {
  const { preambulo, secciones } = partirEnSecciones(texto);
  const nota = preambulo
    .split('\n')
    .filter(l => l.trim() && !/^#\s/.test(l))
    .map(l => l.replace(/^>\s?/, ''))
    .join(' ')
    .trim();

  if (!secciones.length) {
    return (
      <div className="p-3 sm:p-4">
        <Texto>{texto}</Texto>
      </div>
    );
  }

  const unaSola = typeof seccion === 'number' && seccion >= 0 && seccion < secciones.length;
  const mostrar = unaSola ? [secciones[seccion!]] : secciones;

  return (
    <div className="p-3 sm:p-4 flex flex-col gap-3">
      {!unaSola && nota && <p className="m-0 text-[11px] text-[var(--text-secondary)] italic">{nota}</p>}
      <div className={`grid gap-3 ${unaSola ? '' : 'lg:grid-cols-2'}`}>
        {mostrar.map(sec => {
          const lineas = sec.bloque.split('\n').slice(1);
          return (
            <section
              key={sec.titulo}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] shadow-sm overflow-hidden"
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))]">
                <h4 className="m-0 font-cinzel font-bold text-sm text-[var(--accent)]">
                  <span className="mr-1.5">{emojiDeSeccion(sec.titulo)}</span>
                  {sec.titulo}
                </h4>
                {sec.entradas > 0 && (
                  <span className="text-[10px] font-cinzel font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                    {sec.entradas}
                  </span>
                )}
              </header>
              <div className="p-3">
                <Bloques bloques={leerBloques(lineas)} columnas={unaSola} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

/** Una entrada de bitácora (con sus «### …») en tarjetas. */
export const TarjetasDeBitacora: React.FC<{ texto: string }> = ({ texto }) => {
  const lineas = texto.split('\n');
  const bloques = leerBloques(lineas);
  // Las viñetas sueltas dentro de un «### …» ya van en su grupo; si no hay
  // grupos, se enseñan como entradas.
  return (
    <div className="px-3 sm:px-4 pb-3">
      <Bloques bloques={bloques} columnas />
    </div>
  );
};
