import React, { useState } from 'react';
import { NPC, ProjectFile } from '../types';
import {
  X,
  User,
  Heart,
  Sparkles,
  Shield,
  Lock,
  Eye,
  Camera,
  Swords,
  Scroll,
  Calendar,
  BookOpen,
  VenetianMask
} from 'lucide-react';

interface NpcDossierModalProps {
  npc: NPC;
  allImageFiles: ProjectFile[];
  vinculosDestapados: Set<string>;
  onToggleDestaparVinculo: (npcId: string) => void;
  onChangePortrait: (npc: NPC) => void;
  onClose: () => void;
}

export const NpcDossierModal: React.FC<NpcDossierModalProps> = ({
  npc,
  allImageFiles,
  vinculosDestapados,
  onToggleDestaparVinculo,
  onChangePortrait,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'sheet'>('overview');

  // Match portrait file
  const matchingFile = npc.portrait
    ? allImageFiles.find(f => f.content === npc.portrait)
    : allImageFiles.find(
        f => npc.name.length > 2 && f.name.toLowerCase().includes(npc.name.toLowerCase())
      );
  const portraitSrc = npc.portrait || matchingFile?.content;

  // Helpers for affinity
  const getAtrInfo = (val: number = 0) => {
    const clamped = Math.max(0, Math.min(20, val));
    if (clamped <= 3) return { label: 'Frialdad / Distancia cortés', corazones: 0, gradient: 'from-zinc-500 to-zinc-400' };
    if (clamped <= 7) return { label: 'Curiosidad / Chispa leve', corazones: 1, gradient: 'from-rose-400 to-pink-400' };
    if (clamped <= 12) return { label: 'Tensión evidente / Atracción mutua', corazones: 2, gradient: 'from-rose-500 to-pink-500' };
    if (clamped <= 16) return { label: 'Deseo confesado / Magnetismo intenso', corazones: 3, gradient: 'from-rose-600 to-red-500' };
    if (clamped <= 19) return { label: 'Pasión profunda / Devoción', corazones: 4, gradient: 'from-rose-600 to-purple-600' };
    return { label: 'Vínculo supremo / Amor inquebrantable', corazones: 5, gradient: 'from-purple-600 to-amber-500' };
  };

  const getVinInfo = (val: number = 0) => {
    const clamped = Math.max(0, Math.min(20, val));
    if (clamped <= 3) return { label: 'Desconocidos / Sin lazo previo', destellos: 0, gradient: 'from-zinc-500 to-zinc-400' };
    if (clamped <= 7) return { label: 'Compañerismo incipiente / Buen trato', destellos: 1, gradient: 'from-teal-400 to-emerald-400' };
    if (clamped <= 12) return { label: 'Camaradería sólida / Confidente de viaje', destellos: 2, gradient: 'from-teal-500 to-cyan-500' };
    if (clamped <= 16) return { label: 'Lealtad probada / Hermandad de armas', destellos: 3, gradient: 'from-teal-600 to-blue-600' };
    if (clamped <= 19) return { label: 'Lazo inquebrantable / Vida por vida', destellos: 4, gradient: 'from-blue-600 to-indigo-600' };
    return { label: 'Pacto de almas / Lealtad eterna', destellos: 5, gradient: 'from-indigo-600 to-purple-600' };
  };

  const getConInfo = (val: number = 0) => {
    const clamped = Math.max(0, Math.min(20, val));
    if (clamped <= 3) return { label: 'Alerta / Cartas bien tapadas', escudos: 0, gradient: 'from-zinc-500 to-zinc-400' };
    if (clamped <= 7) return { label: 'Respeto mutuo / Información justa', escudos: 1, gradient: 'from-amber-400 to-yellow-400' };
    if (clamped <= 12) return { label: 'Confianza tácita / Comparte planes', escudos: 2, gradient: 'from-amber-500 to-orange-500' };
    if (clamped <= 16) return { label: 'Confidente / Revela vulnerabilidades', escudos: 3, gradient: 'from-amber-600 to-rose-600' };
    if (clamped <= 19) return { label: 'Entrega total / Sin máscaras', escudos: 4, gradient: 'from-orange-600 to-red-600' };
    return { label: 'Confianza absoluta / Guarda tus secretos más oscuros', escudos: 5, gradient: 'from-rose-600 to-amber-500' };
  };

  const isSecretRevealed = vinculosDestapados.has(npc.id);
  const sheet = npc.characterSheet;

  // Physical appearance resolution
  const physicalDesc = npc.appearance || sheet?.appearance;

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-5 backdrop-blur-2xs"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-color)] border border-[var(--glass-border)] w-[820px] max-w-full font-lora max-h-[92vh] flex flex-col rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with portrait, aliases, and main badges */}
        <div className="bg-[var(--sidebar-bg)] p-4 sm:p-5 border-b border-[var(--user-border)] flex items-start justify-between gap-3 relative">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            {/* Portrait avatar */}
            <div className="relative group shrink-0 mt-0.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-[var(--accent)] overflow-hidden bg-black/10 flex items-center justify-center shadow-md">
                {portraitSrc ? (
                  <img
                    src={portraitSrc}
                    alt={npc.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-8 h-8 text-[var(--text-secondary)] opacity-60" />
                )}
              </div>
              <button
                onClick={() => onChangePortrait(npc)}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-cinzel font-bold gap-1 cursor-pointer"
                title="Cambiar retrato"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Name, Aliases and Tags */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2 mb-1">
                <h3 className="font-cinzel text-lg sm:text-2xl font-bold text-[var(--accent)] m-0 break-words leading-tight">
                  {npc.name}
                </h3>
              </div>

              {/* Alias / True Identity if present */}
              {(npc.alias || npc.trueIdentity) && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--accent)] mb-1.5 font-cinzel font-semibold flex-wrap">
                  {npc.alias && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px]">
                      <VenetianMask className="w-3 h-3 text-amber-600" /> Alias conocido: {npc.alias}
                    </span>
                  )}
                  {npc.trueIdentity && npc.trueIdentity !== npc.name && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30 text-[11px]">
                      ✨ Identidad Real: {npc.trueIdentity}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {npc.relation && (
                  <span className="text-[11px] font-cinzel font-bold px-2.5 py-0.5 rounded-full bg-[var(--surface)] text-[var(--accent)] border border-[var(--user-border)] shadow-2xs">
                    {npc.relation}
                  </span>
                )}
                {npc.status && (
                  <span className={`text-[11px] font-cinzel font-semibold px-2 py-0.5 rounded-full border ${
                    npc.status === 'Vivo'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : npc.status === 'Fallecido'
                      ? 'bg-red-500/15 border-red-500/30 text-red-800 dark:text-red-300'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300'
                  }`}>
                    {npc.status}
                  </span>
                )}
                {npc.recurrente && (
                  <span className="text-[10px] font-cinzel font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-800 dark:text-purple-300">
                    Personaje Habitual
                  </span>
                )}
                {npc.diasVistos && npc.diasVistos.length > 0 && (
                  <span className="text-[10px] font-cinzel text-[var(--text-secondary)] flex items-center gap-1 px-1.5 py-0.5">
                    <Calendar className="w-3 h-3 opacity-70" /> {npc.diasVistos.length} {npc.diasVistos.length === 1 ? 'encuentro' : 'encuentros'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer shrink-0"
            title="Cerrar ficha"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Páginas del Dossier) */}
        <div className="flex border-b border-[var(--glass-border)] bg-[var(--surface)] px-4 gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 text-xs sm:text-sm font-cinzel font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'overview'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Scroll className="w-4 h-4" />
            <span>Perfil & Afinidad</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`py-2.5 px-3 text-xs sm:text-sm font-cinzel font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'notes'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Notas & Trasfondo</span>
          </button>

          {sheet && (
            <button
              onClick={() => setActiveTab('sheet')}
              className={`py-2.5 px-3 text-xs sm:text-sm font-cinzel font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'sheet'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Swords className="w-4 h-4 text-amber-500" />
              <span>Estadísticas D&D</span>
            </button>
          )}
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: Overview, Physical Appearance & Affinity */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* 1. Physical Appearance Box (Destacada si existe) */}
              {(physicalDesc || matchingFile?.analysis) && (
                <div className="bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-4 rounded-xl border border-[var(--accent)]/30 space-y-1.5 shadow-2xs">
                  <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-[var(--accent)]" /> Apariencia Física & Rasgos Distintivos
                  </span>
                  {physicalDesc && (
                    <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed m-0 whitespace-pre-wrap">
                      {physicalDesc}
                    </p>
                  )}
                  {matchingFile?.analysis && matchingFile.analysis !== physicalDesc && (
                    <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed m-0 pt-1 border-t border-[var(--user-border)]">
                      <strong className="not-italic text-[var(--accent)]">Análisis de Retrato:</strong> {matchingFile.analysis}
                    </p>
                  )}
                </div>
              )}

              {/* 2. Main Description / Role */}
              {npc.description && (
                <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-1.5 shadow-2xs">
                  <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider block">
                    Rol en Escena & Comportamiento
                  </span>
                  <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed m-0 whitespace-pre-wrap">
                    {npc.description}
                  </p>
                </div>
              )}

              {/* 3. Three Affinity Meters (ATR, VÍN, CON) */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--accent)]/30 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--accent)]/20 pb-2">
                  <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" /> Ejes de Afinidad & Vínculo
                  </span>
                  {npc.vinculo && (
                    <span className="text-xs font-cinzel font-semibold text-[var(--accent)]">
                      Estado: {npc.vinculo}
                    </span>
                  )}
                </div>

                {/* 1. ATR */}
                {(() => {
                  const atrInfo = getAtrInfo(npc.atr);
                  const val = npc.atr ?? 0;
                  return (
                    <div className="space-y-1.5 bg-[var(--surface)] p-3 rounded-lg border border-[var(--user-border)]">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-cinzel font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                          <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                          <span>ATR (Atracción & Química)</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5 text-rose-500" title={`Rango de Atracción: ${atrInfo.corazones}/5`}>
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Heart
                                key={idx}
                                className={`w-3.5 h-3.5 ${
                                  idx < atrInfo.corazones
                                    ? 'fill-rose-500 text-rose-500 drop-shadow-xs'
                                    : 'text-rose-400/30'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            {val}/20
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] italic">
                        {atrInfo.label}
                      </div>
                      <div className="h-2.5 w-full bg-black/10 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-rose-500/20">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${atrInfo.gradient} transition-all duration-500`}
                          style={{ width: `${Math.max(4, (val / 20) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 2. VIN */}
                {(() => {
                  const vinInfo = getVinInfo(npc.vin);
                  const val = npc.vin ?? 0;
                  return (
                    <div className="space-y-1.5 bg-[var(--surface)] p-3 rounded-lg border border-[var(--user-border)]">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-cinzel font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-teal-500" />
                          <span>VÍN (Vínculo Afectivo & Lealtad)</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5 text-teal-500" title={`Rango de Vínculo: ${vinInfo.destellos}/5`}>
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Sparkles
                                key={idx}
                                className={`w-3.5 h-3.5 ${
                                  idx < vinInfo.destellos
                                    ? 'text-teal-500 fill-teal-500 drop-shadow-xs'
                                    : 'text-teal-400/30'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                            {val}/20
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] italic">
                        {vinInfo.label}
                      </div>
                      <div className="h-2.5 w-full bg-black/10 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-teal-500/20">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${vinInfo.gradient} transition-all duration-500`}
                          style={{ width: `${Math.max(4, (val / 20) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 3. CON */}
                {(() => {
                  const conInfo = getConInfo(npc.con);
                  const val = npc.con ?? 0;
                  return (
                    <div className="space-y-1.5 bg-[var(--surface)] p-3 rounded-lg border border-[var(--user-border)]">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-cinzel font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-amber-500" />
                          <span>CON (Confianza Táctica & Secretos)</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5 text-amber-500" title={`Rango de Confianza: ${conInfo.escudos}/5`}>
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Shield
                                key={idx}
                                className={`w-3.5 h-3.5 ${
                                  idx < conInfo.escudos
                                    ? 'text-amber-500 fill-amber-500 drop-shadow-xs'
                                    : 'text-amber-400/30'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            {val}/20
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] italic">
                        {conInfo.label}
                      </div>
                      <div className="h-2.5 w-full bg-black/10 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-amber-500/20">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${conInfo.gradient} transition-all duration-500`}
                          style={{ width: `${Math.max(4, (val / 20) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 4. Aparenta vs Oculta */}
              {(npc.aparenta || npc.oculta) && (
                <div className="grid grid-cols-1 gap-3">
                  {/* Aparenta */}
                  {npc.aparenta && (
                    <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-1">
                      <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> Lo que aparenta en público:
                      </span>
                      <p className="text-sm text-[var(--text-primary)] italic leading-relaxed m-0 whitespace-pre-wrap">
                        {npc.aparenta}
                      </p>
                    </div>
                  )}

                  {/* Oculta */}
                  {npc.oculta && (
                    <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-cinzel text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" /> Lo que oculta (Secreto de Trama):
                        </span>
                        {isSecretRevealed && (
                          <span className="text-[10px] bg-rose-500/20 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded font-cinzel font-semibold">
                            Sello Roto
                          </span>
                        )}
                      </div>

                      {isSecretRevealed ? (
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed italic m-0 whitespace-pre-wrap border-l-2 border-rose-500 pl-3">
                          {npc.oculta}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-[var(--text-secondary)] italic m-0">
                            Este personaje oculta intenciones o secretos que podrían alterar el curso de la campaña.
                          </p>
                          <button
                            onClick={() => onToggleDestaparVinculo(npc.id)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-cinzel text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <Lock className="w-3.5 h-3.5" /> Romper Sello y Revelar Secreto
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* If no data yet */}
              {!npc.description && !npc.notes && !physicalDesc && (
                <div className="text-center py-8 text-xs text-[var(--text-secondary)] italic">
                  Este personaje aún no tiene descripción o notas ampliadas. Puedes añadirlas pulsando en «Editar Datos».
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Notes & In-depth Story */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {npc.notes && (
                <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--user-border)] space-y-1.5 shadow-2xs">
                  <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider block">
                    Notas de Campaña & Evolución
                  </span>
                  <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed m-0 whitespace-pre-wrap">
                    {npc.notes}
                  </p>
                </div>
              )}

              {npc.disguise && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl space-y-1.5 shadow-2xs">
                  <span className="font-cinzel text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <VenetianMask className="w-4 h-4" /> Notas de Disfraz / Tapadera
                  </span>
                  <p className="text-sm text-[var(--text-primary)] italic leading-relaxed m-0 whitespace-pre-wrap">
                    {npc.disguise}
                  </p>
                </div>
              )}

              {(!npc.notes && !npc.disguise) && (
                <div className="text-center py-8 text-xs text-[var(--text-secondary)] italic">
                  No hay notas adicionales de campaña registradas para este PNJ.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: D&D Character Sheet */}
          {activeTab === 'sheet' && sheet && (
            <div className="space-y-4">
              {/* Combat core stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[var(--surface-soft)] p-2.5 rounded-lg border border-[var(--user-border)] text-center">
                  <span className="text-[10px] font-cinzel text-[var(--text-secondary)] block">Puntos de Golpe</span>
                  <span className="font-mono text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {sheet.hp ?? '—'} / {sheet.maxHp ?? '—'}
                  </span>
                </div>
                <div className="bg-[var(--surface-soft)] p-2.5 rounded-lg border border-[var(--user-border)] text-center">
                  <span className="text-[10px] font-cinzel text-[var(--text-secondary)] block">Clase de Armadura</span>
                  <span className="font-mono text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
                    {sheet.ac ?? '—'} CA
                  </span>
                </div>
                <div className="bg-[var(--surface-soft)] p-2.5 rounded-lg border border-[var(--user-border)] text-center">
                  <span className="text-[10px] font-cinzel text-[var(--text-secondary)] block">Velocidad</span>
                  <span className="font-mono text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    {sheet.speed ?? '30 pies'}
                  </span>
                </div>
                <div className="bg-[var(--surface-soft)] p-2.5 rounded-lg border border-[var(--user-border)] text-center">
                  <span className="text-[10px] font-cinzel text-[var(--text-secondary)] block">Iniciativa</span>
                  <span className="font-mono text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    {sheet.initiative ?? '+0'}
                  </span>
                </div>
              </div>

              {/* Attributes grid if available */}
              {sheet.attributes && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-[var(--surface-soft)] p-3 rounded-xl border border-[var(--user-border)]">
                  {Object.entries(sheet.attributes).map(([attr, score]) => {
                    const mod = Math.floor(((Number(score) || 10) - 10) / 2);
                    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                    const names: Record<string, string> = {
                      str: 'FUE',
                      dex: 'DES',
                      con: 'CON',
                      int: 'INT',
                      wis: 'SAB',
                      cha: 'CAR'
                    };
                    return (
                      <div key={attr} className="text-center p-1.5 rounded bg-[var(--surface)] border border-[var(--user-border)]">
                        <span className="text-[10px] font-cinzel font-bold text-[var(--text-secondary)] block">
                          {names[attr] || attr.toUpperCase()}
                        </span>
                        <span className="font-mono text-sm font-bold text-[var(--accent)] block">
                          {score}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)] block">
                          ({modStr})
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions and Traits */}
              {sheet.actions && sheet.actions.length > 0 && (
                <div className="bg-[var(--surface-soft)] p-3.5 rounded-xl border border-[var(--user-border)] space-y-2">
                  <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider block">
                    Acciones & Ataques
                  </span>
                  <div className="space-y-2">
                    {sheet.actions.map((act, i) => (
                      <div key={i} className="text-xs bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--user-border)]">
                        <strong className="font-cinzel text-[var(--accent)]">{act.name}</strong>
                        {act.damageOrEffect && <span className="text-amber-700 dark:text-amber-400 font-mono ml-2 font-semibold">({act.damageOrEffect})</span>}
                        <p className="text-[var(--text-secondary)] mt-1 m-0">{act.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-[var(--sidebar-bg)] p-3 sm:p-4 border-t border-[var(--user-border)] flex flex-wrap justify-between items-center gap-2">
          <button
            onClick={() => onChangePortrait(npc)}
            className="px-3.5 py-1.5 text-xs font-cinzel text-[var(--text-primary)] border border-[var(--glass-border)] bg-[var(--surface)] rounded-lg hover:bg-[var(--sidebar-bg)] cursor-pointer flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Cambiar Retrato</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface)] cursor-pointer transition-all"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
