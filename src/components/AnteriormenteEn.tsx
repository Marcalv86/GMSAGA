import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EntradaDeBitacora } from '../types';
import { leerApartadosDeBitacora } from '../utils/documentosVivos';

/*
 * 📜 «ANTERIORMENTE EN…».
 *
 * Al abrir un capítulo, una tarjeta con dónde se quedó el anterior, sacada de
 * su entrada de la Bitácora: sin llamar a la IA y sin nada que ella no sepa
 * (la Bitácora es suya, el Cuaderno no sale de aquí).
 *
 * Abierta mientras el capítulo no ha empezado; después se pliega en una línea
 * para no estorbar, y se puede volver a abrir.
 */

const APARTADOS: { busca: RegExp; emoji: string; titulo: string; max: number }[] = [
  { busca: /arranque/i, emoji: '🎬', titulo: 'Dónde lo dejamos', max: 6 },
  { busca: /hechos|decisiones/i, emoji: '⚔️', titulo: 'Lo último que pasó', max: 4 },
  { busca: /hilos/i, emoji: '🧵', titulo: 'Cabos sueltos', max: 4 },
  { busca: /salud|recursos|secuelas/i, emoji: '🩸', titulo: 'Cómo sigue ella', max: 3 }
];

const sinMarcas = (t: string) => t.replace(/\*\*|__/g, '').replace(/`/g, '');

export const AnteriormenteEn: React.FC<{ entrada: EntradaDeBitacora; empezado: boolean }> = ({ entrada, empezado }) => {
  const [abierta, setAbierta] = useState(!empezado);
  const apartados = leerApartadosDeBitacora(entrada.texto);
  const bloques = APARTADOS.map(a => {
    const ap = apartados.find(x => a.busca.test(x.titulo));
    // Lo último que pasó: las últimas viñetas, que son las más cercanas al corte.
    const lineas = ap ? (/hechos/i.test(a.titulo + ap.titulo) ? ap.lineas.slice(-a.max) : ap.lineas.slice(0, a.max)) : [];
    return { ...a, lineas };
  }).filter(b => b.lineas.length);
  if (!bloques.length) return null;

  return (
    <section className="max-w-[900px] w-full mx-auto mb-3 rounded-xl border border-[var(--accent)]/30 bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierta(v => !v)}
        className="w-full min-h-[44px] px-3 sm:px-4 py-2 flex items-center gap-2 text-left cursor-pointer hover:bg-[var(--glass)]"
        aria-expanded={abierta}
      >
        <span className="text-lg leading-none" aria-hidden>
          📜
        </span>
        <span className="font-cinzel font-bold text-xs sm:text-sm text-[var(--accent)] truncate">
          Anteriormente, en {entrada.capitulo}
          {entrada.parte ? ` · parte ${entrada.parte}` : ''}…
        </span>
        <span className="ml-auto shrink-0 text-[var(--text-secondary)]">
          {abierta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>
      {abierta && (
        <div className="px-3 sm:px-4 pb-3 grid gap-2.5 sm:grid-cols-2">
          {bloques.map(b => (
            <div
              key={b.titulo}
              className={`rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] p-2.5 sm:p-3 ${
                /arranque/i.test(b.titulo + b.busca.source) ? 'sm:col-span-2' : ''
              }`}
            >
              <h4 className="m-0 mb-1.5 font-cinzel font-bold text-[11px] sm:text-xs text-[var(--accent)] flex items-center gap-1.5">
                <span aria-hidden>{b.emoji}</span>
                {b.titulo}
              </h4>
              <ul className="m-0 pl-4 list-disc marker:text-[var(--accent)]/60 flex flex-col gap-1">
                {b.lineas.map((l, i) => (
                  <li key={i} className="font-lora text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
                    {sinMarcas(l)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
