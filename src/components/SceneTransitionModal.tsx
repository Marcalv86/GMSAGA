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
  Clock
} from 'lucide-react';

export interface SceneTransitionPreset {
  id: string;
  title: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  defaultPrompt: string;
}

export const SCENE_TRANSITION_PRESETS: SceneTransitionPreset[] = [
  {
    id: 'long_rest',
    title: 'Amanecer y Nuevo Día (Descanso Largo)',
    tag: 'Descanso Largo · 8h',
    icon: Sun,
    description:
      'Pasa la noche. El grupo recupera PG, dados de golpe y ranuras. El mundo no se detiene: los PNJs vigilan o traman, facciones avanzan en bambalinas y amanece con un nuevo estímulo o acontecimiento.',
    defaultPrompt:
      '⏳ [Transición de Escena / Descanso Largo · 8 horas]: La escena anterior concluye y el grupo completa un descanso largo de 8 horas sin sobresaltos mayores. Se recuperan todos los puntos de golpe, dados de golpe y recursos de clase.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: Actualiza el encabezado de HUD (📍 nuevo momento/lugar, fecha Harptos y hora matutina, 🌤 clima y visibilidad, 👥 presentes). El paso de la noche afecta a los PNJs y al entorno: narra qué han estado haciendo los acompañantes durante las guardias o el reposo, cómo amanece la situación (ánimos, preparativos) y qué movimientos han ocurrido en bambalinas con las facciones o enemigos cercanos. Abre la jornada con un estímulo activo o novedad inmediata que rompa la quietud.'
  },
  {
    id: 'short_rest',
    title: 'Descanso Corto (1-2 horas)',
    tag: 'Descanso Corto · 1-2h',
    icon: Coffee,
    description:
      'Pausa para vendar heridas, gastar dados de golpe y charlar. El entorno circundante sigue en marcha: cambios de guardia, ruidos y ajustes de tensión.',
    defaultPrompt:
      '⏳ [Transición de Escena / Descanso Corto · 1-2 horas]: Transcurre un receso de una a dos horas de calma. El grupo toma aliento, venda heridas, gasta dados de golpe y recupera recursos breves.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: El entorno no se detiene; describe cómo reaccionan los PNJs presentes tras la pausa, qué cambios se perciben en el entorno tras este intervalo (patrullas, rumores, ruidos que se aproximan o cambios de viento) y presenta el estímulo activo que encara el grupo al levantarse.'
  },
  {
    id: 'time_skip_hours',
    title: 'Avanzar al Atardecer / Noche',
    tag: 'Salto Temporal · Horas',
    icon: Moon,
    description:
      'Pasan varias horas del día. Cae el sol, se encienden antorchas, rotan turnos y las facciones o criaturas nocturnas mueven ficha.',
    defaultPrompt:
      '⏳ [Transición de Escena / Salto Temporal de Varias Horas]: Transcurren varias horas de espera o camino. La luz solar se extingue y cae la noche: actualiza el encabezado de HUD con la nueva hora vespertina/nocturna y visibilidad reducida.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: Durante estas horas, los PNJs presentes y lejanos han seguido sus rutinas o planes en bambalinas. Narra la atmósfera nocturna, los cambios de guardia y ánimos, y el acontecimiento o rumor que surge con la llegada de la oscuridad.'
  },
  {
    id: 'location_change',
    title: 'Viaje o Cambio de Ubicación',
    tag: 'Cambio de Escena · Viaje',
    icon: Compass,
    description:
      'Elipsis de desplazamiento hacia un nuevo destino. Se narran los hitos de la ruta y se sitúa al grupo a su llegada con nuevo HUD y una situación viva.',
    defaultPrompt:
      '⏳ [Transición de Escena / Viaje y Desplazamiento]: Se cierra la escena previa y el grupo emprende el viaje hacia el siguiente destino relevante.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: Narra de forma concisa el trayecto y la dinámica entre los viajeros durante el camino. Sitúa al grupo a su llegada con un nuevo encabezado de HUD (📍 nuevo lugar exacto, 🌤 clima y 👥 presentes) y un acontecimiento, encuentro o complicación que recibe al grupo en el nuevo escenario.'
  },
  {
    id: 'downtime_days',
    title: 'Tiempo Muerto (Varios Días en la Zona)',
    tag: 'Tiempo Muerto · Días',
    icon: Calendar,
    description:
      'Varios días de actividad cotidiana, compras, forja o convalecencia. Noticias que llegan de la Costa de la Espada o Luskan y un suceso que rompe la monotonía.',
    defaultPrompt:
      '⏳ [Transición de Escena / Tiempo Muerto · Varios Días]: Transcurren varios días de calma relativa y vida cotidiana en la zona.\n\n🌍 [Afectación al Mundo, Eventos y PNJs]: Durante este tiempo, el mundo de Faerûn ha seguido girando: actualiza la fecha en el HUD. Detalla qué han estado haciendo los personajes, qué noticias, rumores o intrigas han cruzado los caminos (desde Luskan, Aguasprofundas o la región), y cuál es el acontecimiento, visita o ruptura de la calma que arranca el nuevo conflicto.'
  }
];

interface SceneTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteTransition: (promptText: string) => void;
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

  if (!isOpen) return null;

  const handleSelectPreset = (preset: SceneTransitionPreset) => {
    setSelectedPresetId(preset.id);
    setCustomPrompt(preset.defaultPrompt);
  };

  const handleExecute = () => {
    if (!customPrompt.trim() || isGenerating) return;
    onExecuteTransition(customPrompt.trim());
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
