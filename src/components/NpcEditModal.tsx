import React, { useState } from 'react';
import { NPC, ProjectFile } from '../types';
import { X, User, Heart, Sparkles, Shield, Camera, Save, VenetianMask, Lock } from 'lucide-react';

interface NpcEditModalProps {
  isOpen: boolean;
  npc: Partial<NPC> | null;
  onClose: () => void;
  onSave: (npc: NPC) => Promise<void> | void;
  allImageFiles?: ProjectFile[];
  onOpenPortraitPicker?: () => void;
}

export const NpcEditModal: React.FC<NpcEditModalProps> = ({
  isOpen,
  npc,
  onClose,
  onSave,
  allImageFiles: _allImageFiles = [],
  onOpenPortraitPicker
}) => {
  const [name, setName] = useState(npc?.name || '');
  const [alias, setAlias] = useState(npc?.alias || '');
  const [trueIdentity, setTrueIdentity] = useState(npc?.trueIdentity || '');
  const [relation, setRelation] = useState(npc?.relation || 'Neutral');
  const [status, setStatus] = useState(npc?.status || 'Vivo');
  const [appearance, setAppearance] = useState(npc?.appearance || npc?.description || '');
  const [notes, setNotes] = useState(npc?.notes || '');
  const [aparenta, setAparenta] = useState(npc?.aparenta || '');
  const [oculta, setOculta] = useState(npc?.oculta || '');
  const [vinculo, setVinculo] = useState(npc?.vinculo || '');
  const [atr, setAtr] = useState<number>(npc?.atr ?? 0);
  const [vin, setVin] = useState<number>(npc?.vin ?? 0);
  const [con, setCon] = useState<number>(npc?.con ?? 0);
  const [portrait, setPortrait] = useState(npc?.portrait || '');

  React.useEffect(() => {
    if (npc) {
      setName(npc.name || '');
      setAlias(npc.alias || '');
      setTrueIdentity(npc.trueIdentity || '');
      setRelation(npc.relation || 'Neutral');
      setStatus(npc.status || 'Vivo');
      setAppearance(npc.appearance || npc.description || '');
      setNotes(npc.notes || '');
      setAparenta(npc.aparenta || '');
      setOculta(npc.oculta || '');
      setVinculo(npc.vinculo || '');
      setAtr(npc.atr ?? 0);
      setVin(npc.vin ?? 0);
      setCon(npc.con ?? 0);
      setPortrait(npc.portrait || '');
    }
  }, [npc]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedNpc: NPC = {
      id: npc?.id || `npc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: name.trim(),
      alias: alias.trim() || undefined,
      trueIdentity: trueIdentity.trim() || undefined,
      relation: relation.trim() || 'Neutral',
      status: status.trim() || 'Vivo',
      appearance: appearance.trim() || undefined,
      description: appearance.trim() || undefined,
      notes: notes.trim() || '',
      aparenta: aparenta.trim() || undefined,
      oculta: oculta.trim() || undefined,
      vinculo: vinculo.trim() || undefined,
      atr,
      vin,
      con,
      portrait: portrait || undefined,
      recurrente: npc?.recurrente || atr > 0 || vin > 0 || con > 0 || Boolean(vinculo.trim()),
      diasVistos: npc?.diasVistos || [],
      characterSheet: npc?.characterSheet
    };

    await onSave(updatedNpc);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-3 sm:p-5 backdrop-blur-2xs overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-color)] border border-[var(--glass-border)] w-[680px] max-w-full font-lora max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--surface-soft)] shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-cinzel font-bold text-base text-[var(--accent)] m-0">
              {npc?.id ? 'Editar Personaje No Jugador (PNJ)' : 'Nuevo Personaje No Jugador (PNJ)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Identidad y Retrato */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Retrato */}
            <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-start">
              <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-[var(--accent)]/40 bg-[var(--surface)] flex items-center justify-center relative group">
                {portrait ? (
                  <img
                    src={portrait}
                    alt={name || 'Retrato PNJ'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-10 h-10 text-[var(--text-secondary)] opacity-40" />
                )}
                {onOpenPortraitPicker && (
                  <button
                    type="button"
                    onClick={onOpenPortraitPicker}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-[11px] font-cinzel text-white transition-opacity cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Cambiar</span>
                  </button>
                )}
              </div>
              {onOpenPortraitPicker && (
                <button
                  type="button"
                  onClick={onOpenPortraitPicker}
                  className="text-xs font-cinzel text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{portrait ? 'Cambiar Retrato' : 'Añadir Retrato'}</span>
                </button>
              )}
            </div>

            {/* Campos de Nombre y Papel */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <div className="sm:col-span-2">
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Nombre Público o Conocido *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Capitana Sarah, El Encapuchado, Jarlaxle..."
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1 flex items-center gap-1">
                  <VenetianMask className="w-3.5 h-3.5 text-amber-500" />
                  <span>Alias / Apodo</span>
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={e => setAlias(e.target.value)}
                  placeholder="Ej: El Cuervo, Ojosverdes..."
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Verdadera Identidad (Secreto)
                </label>
                <input
                  type="text"
                  value={trueIdentity}
                  onChange={e => setTrueIdentity(e.target.value)}
                  placeholder="Si oculta su verdadero nombre..."
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Relación / Rol
                </label>
                <select
                  value={relation}
                  onChange={e => setRelation(e.target.value)}
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                >
                  <option value="Aliado">Aliado</option>
                  <option value="Compañero">Compañero / Grupo</option>
                  <option value="Amigo">Amigo / Confidente</option>
                  <option value="Interés Romántico">Interés Romántico</option>
                  <option value="Neutral">Neutral / Conocido</option>
                  <option value="Contacto">Contacto / Informante</option>
                  <option value="Rival">Rival / Competidor</option>
                  <option value="Enemigo">Enemigo / Antagonista</option>
                  <option value="Villano Principal">Villano Principal</option>
                  <option value="Criatura / Peligro">Criatura / Peligro</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  Estado Vital
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                >
                  <option value="Vivo">Vivo</option>
                  <option value="Activo">Activo</option>
                  <option value="Herido / Convaleciente">Herido / Convaleciente</option>
                  <option value="Prisionero">Prisionero / Cautivo</option>
                  <option value="Desaparecido">Desaparecido / En paradero desconocido</option>
                  <option value="Muerto">Muerto / Caído</option>
                  <option value="Desconocido">Desconocido</option>
                </select>
              </div>
            </div>
          </div>

          {/* Apariencia Física y Descripción */}
          <div>
            <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
              Descripción Física y Rasgos Distintivos
            </label>
            <textarea
              rows={3}
              value={appearance}
              onChange={e => setAppearance(e.target.value)}
              placeholder="Raza, complexión, vestimenta, ojos, cicatrices, armas que porta o actitud visible..."
              className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-xs leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
            />
          </div>

          {/* Vínculo y Máscara (Aparenta vs Oculta) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-[var(--surface-soft)] border border-[var(--glass-border)]">
            <div>
              <label className="text-xs font-cinzel font-bold text-teal-700 dark:text-teal-300 block mb-1">
                Lo que Aparenta (Fachada Pública)
              </label>
              <textarea
                rows={2}
                value={aparenta}
                onChange={e => setAparenta(e.target.value)}
                placeholder="Cómo trata en público al protagonista o qué imagen proyecta..."
                className="w-full p-2 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-cinzel font-bold text-amber-700 dark:text-amber-300 block mb-1">
                Lo que Oculta (Secretos o Motivos Ocultos)
              </label>
              <textarea
                rows={2}
                value={oculta}
                onChange={e => setOculta(e.target.value)}
                placeholder="Motivaciones secretas, debilidades, traiciones o lealtades ocultas..."
                className="w-full p-2 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                Estado del Vínculo (Etiqueta o resumen breve)
              </label>
              <input
                type="text"
                value={vinculo}
                onChange={e => setVinculo(e.target.value)}
                placeholder="Ej: Camaradas leales, Tensión romántica viva, Desconfianza mutua..."
                className="w-full p-2 bg-[var(--bg-color)] border border-[var(--user-border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Afinidad / Métricas de Relación (0-20) - Solo Lectura Autónoma */}
          <div className="p-3.5 rounded-lg bg-[var(--surface-soft)] border border-[var(--glass-border)] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-cinzel font-bold text-[var(--accent)] uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>Métricas de Afinidad & Sentimientos</span>
              </div>
              <span className="text-[10px] font-cinzel font-semibold px-2 py-0.5 rounded bg-stone-500/10 text-[var(--text-secondary)] border border-[var(--glass-border)] flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-500" />
                <span>Solo Lectura · Progresión Autónoma</span>
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] italic m-0">
              Los sentimientos y la atracción de los PNJs no son controlables manualmente; evolucionan de forma orgánica en cada turno según el roleplay, el trato y la química de la historia.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Atracción */}
              <div className="p-2.5 rounded border border-rose-500/30 bg-rose-500/5 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-cinzel font-bold text-rose-700 dark:text-rose-300">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                    <span>Atracción (ATR)</span>
                  </span>
                  <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300">
                    {atr} / 20
                  </span>
                </div>
                <div className="h-2 w-full bg-black/10 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-rose-500/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${Math.max(4, (atr / 20) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Vínculo */}
              <div className="p-2.5 rounded border border-teal-500/30 bg-teal-500/5 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-cinzel font-bold text-teal-700 dark:text-teal-300">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                    <span>Vínculo (VÍN)</span>
                  </span>
                  <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-700 dark:text-teal-300">
                    {vin} / 20
                  </span>
                </div>
                <div className="h-2 w-full bg-black/10 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-teal-500/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${Math.max(4, (vin / 20) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Confianza */}
              <div className="p-2.5 rounded border border-amber-500/30 bg-amber-500/5 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-cinzel font-bold text-amber-700 dark:text-amber-300">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-amber-500" />
                    <span>Confianza (CON)</span>
                  </span>
                  <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    {con} / 20
                  </span>
                </div>
                <div className="h-2 w-full bg-black/10 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-amber-500/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                    style={{ width: `${Math.max(4, (con / 20) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notas y Trasfondo Libre */}
          <div>
            <label className="text-xs font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
              Notas Generales, Trasfondo y Hechos de Campaña
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Información biográfica, promesas hechas, deudas, equipo notable o sucesos pasados..."
              className="w-full p-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded text-xs leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--glass-border)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)] text-[var(--text-secondary)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 text-xs font-cinzel font-bold bg-[var(--accent)] text-[var(--on-accent)] rounded hover:bg-[var(--accent-hover)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{npc?.id ? 'Guardar Cambios' : 'Crear PNJ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
