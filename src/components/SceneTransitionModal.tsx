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
      'Pasa la noche tranquilamente. El grupo recupera todos sus PG, dados de golpe y ranuras. La IA actualiza el HUD con la nueva fecha/hora y clima matutino.',
    defaultPrompt:
      '⏳ [Transición de Escena / Descanso Largo]: La escena previa concluye y el grupo completa un descanso largo de 8 horas sin sobresaltos. Se recuperan todos los puntos de golpe, dados de golpe y recursos gastados. Amanece un nuevo día: actualiza el encabezado de HUD (📍 lugar, fecha/hora matutina, 🌤 clima y 👥 presentes) y narra el despertar, el estado del campamento o la habitación y la primera situación que activa la jornada.'
  },
  {
    id: 'short_rest',
    title: 'Descanso Corto (1-2 horas)',
    tag: 'Descanso Corto · 1h',
    icon: Coffee,
    description:
      'Una pausa tranquila para tomar aliento, vendar heridas, gastar dados de golpe y charlar en calma antes de proseguir.',
    defaultPrompt:
      '⏳ [Transición de Escena / Descanso Corto]: Transcurre una hora de respiro tranquilo en el lugar. El grupo aprovecha para tomar aliento, vendar heridas y recuperar recursos breves. Concluye la pausa y describe qué ocurre inmediatamente después o cómo se reactiva el entorno.'
  },
  {
    id: 'time_skip_hours',
    title: 'Avanzar al Atardecer / Noche',
    tag: 'Salto Temporal · Horas',
    icon: Moon,
    description:
      'Pasan varias horas del día. La luz solar se extingue, cae la noche, se encienden antorchas y cambian las guardias o la atmósfera.',
    defaultPrompt:
      '⏳ [Transición de Escena / Salto Temporal]: Pasan varias horas de espera o actividad cotidiana. La luz diurna se extingue y cae la noche: actualiza el HUD con la hora vespertina/nocturna y sitúa la escena en la nueva situación bajo la oscuridad o las antorchas.'
  },
  {
    id: 'location_change',
    title: 'Viaje o Cambio de Ubicación',
    tag: 'Cambio de Escena · Viaje',
    icon: Compass,
    description:
      'Elipsis de desplazamiento hacia un nuevo destino o escenario. La IA narra brevemente el viaje y sitúa al grupo a su llegada con nuevo HUD.',
    defaultPrompt:
      '⏳ [Transición de Escena / Viaje]: La escena actual queda cerrada y se produce el desplazamiento o viaje hacia el siguiente destino relevante. Narra brevemente el trayecto y sitúa al grupo a su llegada con el nuevo encabezado de HUD (📍 nuevo lugar exacto, 🌤 clima y 👥 presentes) y el estímulo inicial del nuevo escenario.'
  },
  {
    id: 'downtime_days',
    title: 'Tiempo Muerto (Varios Días en la Zona)',
    tag: 'Tiempo Muerto · Días',
    icon: Calendar,
    description:
      'Varios días de relativa calma: forja, compras, lecturas o descanso en la posada. Rumores que llegan y el evento que rompe la monotonía.',
    defaultPrompt:
      '⏳ [Transición de Escena / Tiempo Muerto]: Transcurren varios días de calma relativa y vida cotidiana en la zona. Describe las rutinas que han seguido los personajes, rumores o noticias que hayan llegado de la Costa de la Espada o de Luskan, y el acontecimiento o visita que interrumpe la monotonía y arranca el siguiente conflicto.'
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
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" /> Detalle o Instrucción de la Transición
              </label>
              <span className="text-[10px] text-[var(--text-secondary)]">
                Puedes personalizar lo que ocurre durante el salto
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
