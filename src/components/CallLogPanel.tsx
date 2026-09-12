import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Loader, Radio, Trash2, TriangleAlert, XCircle } from 'lucide-react';
import { versionEnUso } from '../utils/versionCheck';
import {
  LlamadaRegistrada,
  duracionLegible,
  entradaMostrable,
  getLlamadas,
  porcentajeDelTecho,
  porcentajeEnCache,
  limpiarLlamadas,
  llamadasComoTexto,
  resumenDeLlamadas,
  suscribirseALlamadas
} from '../utils/callLog';

const n = (v?: number) => (v === undefined ? '—' : v.toLocaleString('es-ES'));

const TONO: Record<string, { punto: string; texto: string; borde: string; icono: React.ReactNode }> = {
  ok: {
    punto: 'bg-emerald-500',
    texto: 'text-emerald-700 dark:text-emerald-300',
    borde: 'border-[var(--glass-border)]',
    icono: <Check className="w-3 h-3" />
  },
  fallo: {
    punto: 'bg-rose-500',
    texto: 'text-rose-700 dark:text-rose-300',
    borde: 'border-rose-500/40',
    icono: <XCircle className="w-3 h-3" />
  },
  cortada: {
    punto: 'bg-amber-500',
    texto: 'text-amber-800 dark:text-amber-300',
    borde: 'border-amber-500/40',
    icono: <TriangleAlert className="w-3 h-3" />
  },
  'en curso': {
    punto: 'bg-sky-500 animate-pulse',
    texto: 'text-sky-700 dark:text-sky-300',
    borde: 'border-sky-500/40',
    icono: <Loader className="w-3 h-3 animate-spin" />
  }
};

/**
 * El registro de llamadas.
 *
 * El de errores solo enseña lo que rompe, y eso deja fuera justo lo que hace
 * falta cuando algo va raro sin romperse: la pantalla decía «0 errores» con la
 * partida atascada. Aquí se ve TODO lo que se le pide a Google, con lo que
 * explica un turno lento: para qué era, a qué modelo, con qué clave, cuánto
 * tardó en arrancar y por qué se cerró.
 */
export const CallLogPanel: React.FC = () => {
  const [llamadas, setLlamadas] = useState<LlamadaRegistrada[]>(() => getLlamadas());
  const [filtro, setFiltro] = useState<'todas' | 'turnos' | 'fondo' | 'problemas'>('todas');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => suscribirseALlamadas(l => setLlamadas([...l].reverse())), []);

  const visibles = useMemo(() => {
    const esTurno = (l: LlamadaRegistrada) => l.proposito.startsWith('Turno narrado');
    if (filtro === 'turnos') return llamadas.filter(esTurno);
    if (filtro === 'fondo') return llamadas.filter(l => !esTurno(l));
    if (filtro === 'problemas') return llamadas.filter(l => l.estado === 'fallo' || l.estado === 'cortada');
    return llamadas;
  }, [llamadas, filtro]);

  const r = useMemo(() => resumenDeLlamadas(llamadas), [llamadas]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(llamadasComoTexto(visibles));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin portapapeles no se puede hacer más */
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Resumen: lo que contesta «¿cuánto llevo?» de un vistazo */}
      <div className="p-3 bg-[var(--glass)] border-b border-[var(--glass-border)] shrink-0 space-y-2.5">
        {/*
          Qué versión se está ejecutando. Sin esto no hay forma de saber si lo
          que corre en el móvil ya trae un arreglo o es de tres despliegues
          atrás, que es justo lo que despista cuando algo "sigue fallando".
        */}
        <div className="font-mono text-[10px] text-[var(--text-secondary)] text-center">
          versión {versionEnUso()}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
          {[
            { r: 'Llamadas', v: n(r.total) },
            { r: 'Fallidas', v: n(r.fallidas), alerta: r.fallidas > 0 },
            { r: 'Fichas enviadas', v: n(r.fichasEntrada) },
            { r: 'Duración media', v: duracionLegible(r.duracionMedia) }
          ].map(c => (
            <div key={c.r} className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-2 py-1.5">
              <div className={`font-mono text-sm font-bold ${c.alerta ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--text-primary)]'}`}>
                {c.v}
              </div>
              <div className="text-[10px] font-cinzel text-[var(--text-secondary)] leading-tight">{c.r}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ['todas', `Todas (${llamadas.length})`],
            ['turnos', 'Turnos'],
            ['fondo', 'De fondo'],
            ['problemas', `Problemas (${r.fallidas})`]
          ] as const).map(([id, rot]) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-cinzel border transition-colors cursor-pointer ${
                filtro === id
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold border-[var(--accent)]'
                  : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:text-[var(--text-primary)]'
              }`}
            >
              {rot}
            </button>
          ))}
          <div className="grow" />
          <button
            onClick={copiar}
            disabled={visibles.length === 0}
            className="min-h-[32px] px-2.5 rounded-lg border border-[var(--user-border)] text-[11px] font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
            title="Copiar el registro como texto, para pegarlo donde haga falta"
          >
            {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('¿Vaciar el registro de llamadas? No afecta a la partida.')) limpiarLlamadas();
            }}
            disabled={llamadas.length === 0}
            className="min-h-[32px] px-2.5 rounded-lg border border-[var(--user-border)] text-[11px] font-cinzel text-[var(--text-secondary)] hover:text-red-600 hover:border-red-500 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Vaciar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visibles.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)]">
              <Radio className="w-5 h-5" />
            </div>
            <p className="font-cinzel text-sm font-bold text-[var(--text-primary)] m-0 mb-1">
              {llamadas.length === 0 ? 'Todavía no hay llamadas' : 'Nada con ese filtro'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed m-0">
              {llamadas.length === 0
                ? 'Aquí se apunta cada petición que se le hace a Google —los turnos y las tareas de fondo— salga bien o mal. Juega un turno y aparecerá.'
                : 'Prueba con otro filtro.'}
            </p>
          </div>
        ) : (
          visibles.map(l => {
            const t = TONO[l.estado] || TONO.ok;
            return (
              <div key={l.id} className={`rounded-lg border ${t.borde} bg-[var(--surface)] px-2.5 py-2`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-cinzel text-xs font-bold text-[var(--text-primary)] min-w-0 flex items-start gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${t.punto}`} />
                    <span className="min-w-0">{l.proposito}</span>
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)] shrink-0">{l.horaLegible}</span>
                </div>

                <div className="mt-1 text-[11px] text-[var(--text-secondary)] leading-snug">
                  {l.modelo}
                  {l.claveN ? ` · clave ${l.claveN}${l.totalClaves ? `/${l.totalClaves}` : ''}` : ''}
                  {l.intento ? ` · intento ${l.intento + 1}` : ''}
                  {l.esRespaldo ? ' · respaldo' : ''}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px]">
                  <span className={`inline-flex items-center gap-1 font-bold ${t.texto}`}>
                    {t.icono} {l.estado}
                  </span>
                  <span className="text-[var(--text-secondary)]">{duracionLegible(l.duracionMs)}</span>
                  {l.primerTrozoMs !== undefined && (
                    <span className="text-[var(--text-secondary)]" title="Cuánto tardó en empezar a escribir. Es lo que separa «está pensando» de «se ha colgado».">
                      arranque {duracionLegible(l.primerTrozoMs)}
                    </span>
                  )}
                  {/*
                    La entrada, siempre en fichas y con su parte del techo.

                    Antes, si la llamada se cortaba antes de contestar, solo
                    quedaban los caracteres enviados —«698.390»—, que contra un
                    techo medido en fichas no dicen nada. Y es justo el caso en
                    que más falta hace saber cuánto se estaba mandando.
                  */}
                  {(() => {
                    const e = entradaMostrable(l);
                    if (e.fichas === undefined) return null;
                    const pct = porcentajeDelTecho(e.fichas);
                    const alto = (pct || 0) >= 70;
                    return (
                      <span
                        className={alto ? 'text-amber-800 dark:text-amber-300 font-bold' : 'text-[var(--text-secondary)]'}
                        title={
                          (e.estimada
                            ? `Estimado sobre ${n(l.caracteresEnviados)} caracteres enviados (la llamada no llegó a contestar).`
                            : 'Fichas de entrada según la propia API.') +
                          ' El techo de la capa gratuita son 250.000 fichas por minuto.'
                        }
                      >
                        ↓{e.estimada ? '≈' : ''}{n(e.fichas)}
                        {pct !== undefined ? ` (${pct}%)` : ''}
                      </span>
                    );
                  })()}
                  {l.fichasSalida !== undefined && (
                    <span className="text-[var(--text-secondary)]" title="Fichas de salida">↑{n(l.fichasSalida)}</span>
                  )}
                  {/*
                    Lo que gastó pensando. Es lo que contesta si el retraso del
                    arranque fue el envío o el razonamiento: las dos cosas pasan
                    en el mismo hueco y a ojo son iguales.
                  */}
                  {l.fichasDePensamiento ? (
                    <span
                      className="text-violet-700 dark:text-violet-300 font-bold"
                      title="Fichas gastadas razonando antes de escribir. Ocurre ANTES del primer trozo, así que es parte del arranque."
                    >
                      pensando {n(l.fichasDePensamiento)}
                    </span>
                  ) : null}
                  {l.fichasEnCache ? (
                    <span
                      className="text-emerald-700 dark:text-emerald-400 font-bold"
                      title="Fichas que Google sirvió de su caché en vez de volver a digerirlas. Es lo que explica que dos turnos del mismo tamaño tarden cosas muy distintas."
                    >
                      caché {(() => { const c = porcentajeEnCache(l); return c !== undefined ? `${c}%` : n(l.fichasEnCache); })()}
                    </span>
                  ) : null}
                  {l.motivoDeCierre && l.motivoDeCierre !== 'STOP' && (
                    <span
                      className="text-amber-800 dark:text-amber-300 font-bold"
                      title="Por qué paró de escribir. MAX_TOKENS = se quedó sin espacio de salida, y por eso el relato sale cortado."
                    >
                      {l.motivoDeCierre}
                    </span>
                  )}
                </div>

                {/*
                  QUÉ DOCUMENTOS VIAJARON, Y CÓMO.
                  Esto se registraba desde hacía tiempo, pero solo salía en la
                  exportación de texto: en pantalla no había manera de verlo, y
                  es justo el dato que decide si un documento de consulta está
                  aportando algo o se está quedando fuera de todos los turnos.
                  Sin esto, ajustar qué se marca de consulta es a ciegas.
                */}
                {(() => {
                  const d = l.documentos;
                  if (!d || (!d.enteros?.length && !d.fragmentos?.length && !d.sinUsar?.length)) return null;
                  return (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                      {d.enteros?.length ? (
                        <span
                          className="text-[var(--text-secondary)]"
                          title={`Viajaron con su texto completo:\n${d.enteros.join('\n')}`}
                        >
                          📄 enteros {d.enteros.length}
                        </span>
                      ) : null}
                      {d.fragmentos?.length ? (
                        <span
                          className="text-sky-700 dark:text-sky-300"
                          title={`De consulta, con fragmentos rescatados para esta escena:\n${d.fragmentos.join('\n')}`}
                        >
                          📖 fragmentos {d.fragmentos.length}
                        </span>
                      ) : null}
                      {d.sinUsar?.length ? (
                        <span
                          className="text-amber-800 dark:text-amber-300"
                          title={`De consulta, pero NO aportaron nada a este turno. Si uno vive aquí turno tras turno, o no hacía falta o la búsqueda no lo encuentra:\n${d.sinUsar.join('\n')}`}
                        >
                          🗄️ sin usar {d.sinUsar.length}
                        </span>
                      ) : null}
                    </div>
                  );
                })()}

                {l.detalle && (
                  <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300 m-0 leading-snug break-words">{l.detalle}</p>
                )}
                {l.capitulo && (
                  <p className="mt-0.5 text-[10px] text-[var(--text-secondary)] m-0 truncate">{l.capitulo}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
