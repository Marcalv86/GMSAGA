import React, { useState } from 'react';
import {
  X,
  FastForward,
  Sun,
  Coffee,
  Moon,
  Compass,
  Calendar,
  Sparkles,
  Clock,
  Minus,
  Plus,
  Newspaper
} from 'lucide-react';

export interface SceneTransitionPreset {
  id: string;
  title: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  defaultPrompt: string;
  /**
   * En qué unidad se mide este salto.
   *
   * Los saltos de horas se resuelven solos; los de días no: «varios días» lo
   * decidía el Narrador de su cosecha, y por eso el calendario y el HUD acababan
   * discrepando. Los de escala «dias» piden el número exacto.
   */
  escala: 'horas' | 'dias';
  /** Días que se proponen por defecto, para no empezar en blanco. */
  diasPorDefecto?: number;
}

/** Lo que se decide en el modal además del texto de la instrucción. */
export interface OpcionesDeTransicion {
  /** Días exactos que pasan. 0 = el salto no se mide en días. */
  dias: number;
  /** Si hay que pedir noticias concretas del mundo para esos días. */
  noticias: boolean;
  /** Qué estuvo haciendo el personaje: convaleciente, de viaje, de compras… */
  motivo: string;
}

/** Tope de días de un salto en un solo paso. */
export const MAX_DIAS_DE_SALTO = 60;

export const SCENE_TRANSITION_PRESETS: SceneTransitionPreset[] = [
  {
    id: 'long_rest',
    title: 'Amanecer y Nuevo Día (Descanso Largo)',
    tag: 'Descanso Largo · 8h',
    icon: Sun,
    description:
      'Pasa la noche. El grupo recupera PG, dados de golpe y ranuras. El mundo no se detiene: los PNJs vigilan o traman, facciones avanzan en bambalinas y amanece con un nuevo estímulo o acontecimiento.',
    defaultPrompt:
      '⏳ [Transición de Escena / Descanso Largo · 8 horas]: La escena anterior concluye y el grupo completa un descanso largo de 8 horas sin sobresaltos mayores. Se recuperan todos los puntos de golpe, dados de golpe y recursos de clase.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: Actualiza el encabezado de HUD (📍 nuevo momento/lugar, fecha Harptos y hora matutina, 🌤 clima y visibilidad, 👥 presentes). El paso de la noche afecta a los PNJs y al entorno: narra qué han estado haciendo los acompañantes durante las guardias o el reposo, cómo amanece la situación (ánimos, preparativos) y qué movimientos han ocurrido en bambalinas con las facciones o enemigos cercanos. Abre la jornada con un estímulo activo o novedad inmediata que rompa la quietud.\n\n🎬 [ESTO SE JUEGA, NO SE RESUME]: De todo este intervalo, ELIGE UN MOMENTO y NÁRRALO COMO ESCENA —con su sitio, su hora, lo que se ve y se huele, y al menos un PNJ hablando en voz alta con sus palabras—, no como un parte de lo ocurrido. Un salto contado entero en pasado y en tercera persona es tiempo que la jugadora no ha vivido: puede llevar un párrafo de resumen, pero tiene que llevar también una escena. Y termina DENTRO de esa escena, con algo delante a lo que responder, no con un «y así pasaron los días».',
    escala: 'horas'
  },
  {
    id: 'short_rest',
    title: 'Descanso Corto (1-2 horas)',
    tag: 'Descanso Corto · 1-2h',
    icon: Coffee,
    description:
      'Pausa para vendar heridas, gastar dados de golpe y charlar. El entorno circundante sigue en marcha: cambios de guardia, ruidos y ajustes de tensión.',
    defaultPrompt:
      '⏳ [Transición de Escena / Descanso Corto · 1-2 horas]: Transcurre un receso de una a dos horas de calma. El grupo toma aliento, venda heridas, gasta dados de golpe y recupera recursos breves.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: El entorno no se detiene; describe cómo reaccionan los PNJs presentes tras la pausa, qué cambios se perciben en el entorno tras este intervalo (patrullas, rumores, ruidos que se aproximan o cambios de viento) y presenta el estímulo activo que encara el grupo al levantarse.\n\n🎬 [ESTO SE JUEGA, NO SE RESUME]: De todo este intervalo, ELIGE UN MOMENTO y NÁRRALO COMO ESCENA —con su sitio, su hora, lo que se ve y se huele, y al menos un PNJ hablando en voz alta con sus palabras—, no como un parte de lo ocurrido. Un salto contado entero en pasado y en tercera persona es tiempo que la jugadora no ha vivido: puede llevar un párrafo de resumen, pero tiene que llevar también una escena. Y termina DENTRO de esa escena, con algo delante a lo que responder, no con un «y así pasaron los días».',
    escala: 'horas'
  },
  {
    id: 'time_skip_hours',
    title: 'Avanzar al Atardecer / Noche',
    tag: 'Salto Temporal · Horas',
    icon: Moon,
    description:
      'Pasan varias horas del día. Cae el sol, se encienden antorchas, rotan turnos y las facciones o criaturas nocturnas mueven ficha.',
    defaultPrompt:
      '⏳ [Transición de Escena / Salto Temporal de Varias Horas]: Transcurren varias horas de espera o camino. La luz solar se extingue y cae la noche: actualiza el encabezado de HUD con la nueva hora vespertina/nocturna y visibilidad reducida.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: Durante estas horas, los PNJs presentes y lejanos han seguido sus rutinas o planes en bambalinas. Narra la atmósfera nocturna, los cambios de guardia y ánimos, y el acontecimiento o rumor que surge con la llegada de la oscuridad.\n\n🎬 [ESTO SE JUEGA, NO SE RESUME]: De todo este intervalo, ELIGE UN MOMENTO y NÁRRALO COMO ESCENA —con su sitio, su hora, lo que se ve y se huele, y al menos un PNJ hablando en voz alta con sus palabras—, no como un parte de lo ocurrido. Un salto contado entero en pasado y en tercera persona es tiempo que la jugadora no ha vivido: puede llevar un párrafo de resumen, pero tiene que llevar también una escena. Y termina DENTRO de esa escena, con algo delante a lo que responder, no con un «y así pasaron los días».',
    escala: 'horas'
  },
  {
    id: 'location_change',
    title: 'Viaje o Cambio de Ubicación',
    tag: 'Cambio de Escena · Viaje',
    icon: Compass,
    description:
      'Elipsis de desplazamiento hacia un nuevo destino. Se narran los hitos de la ruta y se sitúa al grupo a su llegada con nuevo HUD y una situación viva.',
    defaultPrompt:
      '⏳ [Transición de Escena / Viaje y Desplazamiento]: Se cierra la escena previa y el grupo se pone en camino hacia el siguiente destino.\n\n🧭 [ANTES DE NADA, ABRE EL TRAYECTO]: Calcula cuántas JORNADAS cuesta llegar según la distancia real del mundo —no según lo que le convenga a la escena— y declara \\`[VIAJE: destino | jornadas: N]\\`. ⛔ Si son más de las que pasan en este salto, NO SE LLEGA en este turno: ni puerto, ni murallas a la vista, ni «al cabo de unos días llegaron». Narra la salida y el primer tramo, y deja el resto de camino por delante. Solo cuando de verdad se pise el destino, cierra con \\`[VIAJE: fin]\\`.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: El camino no es tiempo perdido: es donde la gente se conoce. Actualiza el encabezado de HUD (📍 dónde se está AHORA, 🌤 clima y 👥 presentes) y saca lo que da de sí la ruta —quién viaja al lado, qué se habla cuando no hay nada que hacer, qué se cruza en el camino.\n\n🎬 [ESTO SE JUEGA, NO SE RESUME]: De todo este intervalo, ELIGE UN MOMENTO y NÁRRALO COMO ESCENA —con su sitio, su hora, lo que se ve y se huele, y al menos un PNJ hablando en voz alta con sus palabras—, no como un parte de lo ocurrido. Un salto contado entero en pasado y en tercera persona es tiempo que la jugadora no ha vivido: puede llevar un párrafo de resumen, pero tiene que llevar también una escena. Y termina DENTRO de esa escena, con algo delante a lo que responder, no con un «y así pasaron los días».',
    escala: 'dias',
    diasPorDefecto: 3
  },
  {
    id: 'downtime_days',
    title: 'Tiempo Muerto (Varios Días en la Zona)',
    tag: 'Tiempo Muerto · Días',
    icon: Calendar,
    description:
      'Varios días de actividad cotidiana, compras, forja o convalecencia. Noticias que llegan de la Costa de la Espada o Luskan y un suceso que rompe la monotonía.',
    defaultPrompt:
      '⏳ [Transición de Escena / Tiempo Muerto · Varios Días]: Transcurren varios días de calma relativa y vida cotidiana en la zona.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: El mundo ha seguido girando: actualiza la fecha en el HUD, y cuenta qué noticias, rumores o intrigas han cruzado los caminos y qué han estado haciendo los PNJs mientras tanto.\n\n🎬 [ESTO SE JUEGA, NO SE RESUME]: De todo este intervalo, ELIGE UN MOMENTO y NÁRRALO COMO ESCENA —con su sitio, su hora, lo que se ve y se huele, y al menos un PNJ hablando en voz alta con sus palabras—, no como un parte de lo ocurrido. Un salto contado entero en pasado y en tercera persona es tiempo que la jugadora no ha vivido: puede llevar un párrafo de resumen, pero tiene que llevar también una escena. Y termina DENTRO de esa escena, con algo delante a lo que responder, no con un «y así pasaron los días».',
    escala: 'dias',
    diasPorDefecto: 7
  }
];

interface SceneTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteTransition: (promptText: string, opciones: OpcionesDeTransicion) => void;
  isGenerating?: boolean;
}

export const SceneTransitionModal: React.FC<SceneTransitionModalProps> = ({
  isOpen,
  onClose,
  onExecuteTransition,
  isGenerating = false
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('long_rest');
  const [customPrompt, setCustomPrompt] = useState<string>(
    SCENE_TRANSITION_PRESETS[0].defaultPrompt
  );
  const [dias, setDias] = useState<number>(0);
  const [noticias, setNoticias] = useState<boolean>(true);
  const [motivo, setMotivo] = useState<string>('');

  if (!isOpen) return null;

  const preset =
    SCENE_TRANSITION_PRESETS.find(pr => pr.id === selectedPresetId) || SCENE_TRANSITION_PRESETS[0];
  const enDias = preset.escala === 'dias';

  const handleSelectPreset = (p: SceneTransitionPreset) => {
    setSelectedPresetId(p.id);
    setCustomPrompt(p.defaultPrompt);
    setDias(p.escala === 'dias' ? p.diasPorDefecto || 1 : 0);
    setMotivo('');
  };

  const ajustarDias = (delta: number) =>
    setDias(d => Math.max(1, Math.min(MAX_DIAS_DE_SALTO, d + delta)));

  const handleExecute = () => {
    if (!customPrompt.trim() || isGenerating) return;
    onExecuteTransition(customPrompt.trim(), {
      dias: enDias ? dias : 0,
      // Pedir noticias de un solo día es gastar una llamada para nada: en un día
      // el mundo no se mueve lo bastante como para que llegue una gaceta.
      noticias: enDias && noticias && dias >= 2,
      motivo: motivo.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-[fadeIn_0.15s_ease-out]">
      <div
        className="bg-[var(--bg-color)] border border-[var(--glass-border)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col font-lora overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[var(--user-border)] flex items-center justify-between bg-[var(--surface)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shadow-xs">
              <FastForward className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-[var(--text-primary)] leading-tight">
                Salto de Tiempo y Transición de Escena
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Concluye la escena actual y avanza el tiempo, un descanso o cambia de lugar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Living World Banner */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-cinzel font-bold text-amber-800 dark:text-amber-300 block text-xs">
                Causalidad Viva y Progresión de Faerûn
              </span>
              <p className="text-[11px] leading-relaxed">
                El tiempo no es un decorado inerte: al saltar horas o días, los PNJs y facciones presentes y lejanas continúan sus planes en bambalinas. La IA actualizará el encabezado de HUD y abrirá la nueva escena con consecuencias orgánicas y un estímulo vivo inmediato.
              </p>
            </div>
          </div>

          {/* Quick Presets Grid */}
          <div>
            <label className="block font-cinzel text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--accent)]" /> Opciones de Transición Rápida
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SCENE_TRANSITION_PRESETS.map(preset => {
                const Icon = preset.icon;
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-xs ring-1 ring-[var(--accent)]/30'
                        : 'border-[var(--user-border)] bg-[var(--surface)] hover:bg-amber-500/5 hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-cinzel text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                        {preset.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-cinzel font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)] w-fit mb-1.5 border border-[var(--accent)]/20">
                      {preset.tag}
                    </span>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/*
            Cuántos días, exactamente.

            «Varios días» lo decidía el Narrador de su cosecha, y de ahí salían
            calendarios y HUD que no cuadraban. Aquí se dice el número y viaja
            en la instrucción, así que solo hay una versión de cuánto ha pasado.
          */}
          {enDias && (
            <div className="rounded-lg border border-[var(--user-border)] bg-[var(--surface)] p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-cinzel text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" /> ¿Cuántos días pasan?
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => ajustarDias(-1)}
                    disabled={dias <= 1}
                    className="w-10 h-10 shrink-0 rounded-lg border border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
                    aria-label="Un día menos"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_DIAS_DE_SALTO}
                    value={dias}
                    onChange={e => {
                      const n = parseInt(e.target.value, 10);
                      setDias(Number.isFinite(n) ? Math.max(1, Math.min(MAX_DIAS_DE_SALTO, n)) : 1);
                    }}
                    className="w-16 h-10 rounded-lg border border-[var(--user-border)] bg-[var(--bg-color)] text-center font-cinzel text-sm font-bold text-[var(--text-primary)] outline-hidden focus:border-[var(--accent)]"
                    aria-label="Días que pasan"
                  />
                  <button
                    type="button"
                    onClick={() => ajustarDias(1)}
                    disabled={dias >= MAX_DIAS_DE_SALTO}
                    className="w-10 h-10 shrink-0 rounded-lg border border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
                    aria-label="Un día más"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="¿Haciendo qué? Convaleciente, forjando, de viaje a Luskan…"
                className="w-full h-10 px-3 rounded-lg border border-[var(--user-border)] bg-[var(--bg-color)] text-xs font-lora text-[var(--text-primary)] outline-hidden focus:border-[var(--accent)]"
              />

              {/*
                Las noticias del mundo.

                Se piden aparte, al modelo de tareas de fondo, para que salgan
                concretas y fechadas —«el día 3 Thay atacó Puerta de Baldur»— en
                vez de un «llegaron rumores» de relleno. Van al Narrador para
                que las use y las registre en el calendario con su día exacto.
              */}
              <label
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                  dias >= 2 ? 'cursor-pointer border-[var(--user-border)] hover:border-[var(--accent)]/50' : 'border-[var(--user-border)] opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={noticias && dias >= 2}
                  disabled={dias < 2}
                  onChange={e => setNoticias(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--accent)] cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="min-w-0">
                  <span className="font-cinzel text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Newspaper className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" /> Noticias del mundo
                  </span>
                  <span className="block text-[11px] leading-relaxed text-[var(--text-secondary)] mt-0.5">
                    {dias < 2
                      ? 'A partir de dos días. En uno solo no da tiempo a que llegue nada.'
                      : `Genera qué pasó en Faerûn durante esos ${dias} días —guerras, bandos, robos, intrigas— con su día exacto, y se apunta en el calendario. No gasta de tus turnos de partida: sale del modelo de tareas de fondo.`}
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Prompt customization */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="scene-transition-textarea"
                className="block font-cinzel text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5"
              >
                <FastForward className="w-3.5 h-3.5 text-[var(--accent)]" /> Instrucción Narrativa para el Narrador
              </label>
              <span className="text-[10px] text-[var(--text-secondary)]">
                Instrucción interna: se envía en segundo plano al Narrador (no aparece en la crónica)
              </span>
            </div>
            <textarea
              id="scene-transition-textarea"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              rows={4}
              placeholder="Escribe cómo deseas que avance la escena o qué ocurre durante este tiempo..."
              className="w-full p-3 text-xs text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--user-border)] rounded-lg focus:outline-hidden focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] resize-none font-lora leading-relaxed shadow-inner"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--user-border)] bg-[var(--surface)] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-cinzel font-semibold border border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isGenerating || !customPrompt.trim()}
            className="px-5 py-2 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FastForward className="w-4 h-4" /> Avanzar Tiempo y Escena
          </button>
        </div>
      </div>
    </div>
  );
};
