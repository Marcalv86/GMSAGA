import React, { useState, useMemo, useEffect } from 'react';
import { interesPorLaProtagonista, NPC, ProjectFile, RecuerdoEpisodicoNPC } from '../types';
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
  VenetianMask,
  Languages,
  Brain,
  Pencil,
  Trash2,
  Plus,
  Quote
} from 'lucide-react';

interface NpcDossierModalProps {
  npc: NPC;
  allImageFiles: ProjectFile[];
  vinculosDestapados: Set<string>;
  onToggleDestaparVinculo: (npcId: string) => void;
  onChangePortrait: (npc: NPC) => void;
  onUpdateNpc?: (updatedNpc: NPC) => void;
  onClose: () => void;
}

export const NpcDossierModal: React.FC<NpcDossierModalProps> = ({
  npc: initialNpc,
  allImageFiles,
  vinculosDestapados,
  onToggleDestaparVinculo,
  onChangePortrait,
  onUpdateNpc,
  onClose
}) => {
  const [npc, setNpc] = useState<NPC>(initialNpc);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'sheet' | 'memories'>('overview');

  // Estado para gestión manual de Recuerdos y Promesas
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryType, setNewMemoryType] = useState<'promesa' | 'confidencia' | 'aprendizaje' | 'evolucion'>('promesa');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryText, setEditingMemoryText] = useState('');
  const [editingImpresion, setEditingImpresion] = useState(false);
  const [impresionDraft, setImpresionDraft] = useState(initialNpc.impresionActual || '');

  // Sincronizar si cambia initialNpc
  useEffect(() => {
    setNpc(initialNpc);
    setImpresionDraft(initialNpc.impresionActual || '');
  }, [initialNpc]);

  // Lista unificada de recuerdos y promesas
  const allMemories = useMemo(() => {
    const list: RecuerdoEpisodicoNPC[] = [];
    const registeredTexts = new Set<string>();

    (npc.recuerdosEpisodicos || []).forEach(r => {
      list.push(r);
      registeredTexts.add(r.texto.trim().toLowerCase());
    });

    (npc.promesas || []).forEach((p, i) => {
      if (!registeredTexts.has(p.trim().toLowerCase())) {
        list.push({ id: `promesa_leg_${i}`, tipo: 'promesa', texto: p });
        registeredTexts.add(p.trim().toLowerCase());
      }
    });

    (npc.confidencias || []).forEach((c, i) => {
      if (!registeredTexts.has(c.trim().toLowerCase())) {
        list.push({ id: `confidencia_leg_${i}`, tipo: 'confidencia', texto: c });
        registeredTexts.add(c.trim().toLowerCase());
      }
    });

    (npc.habilidadesAprendidas || []).forEach((h, i) => {
      if (!registeredTexts.has(h.trim().toLowerCase())) {
        list.push({ id: `aprendizaje_leg_${i}`, tipo: 'aprendizaje', texto: h });
        registeredTexts.add(h.trim().toLowerCase());
      }
    });

    return list;
  }, [npc.recuerdosEpisodicos, npc.promesas, npc.confidencias, npc.habilidadesAprendidas]);

  const handleSaveImpresion = () => {
    const text = impresionDraft.trim();
    const updatedNpc: NPC = {
      ...npc,
      impresionActual: text || undefined
    };
    setNpc(updatedNpc);
    onUpdateNpc?.(updatedNpc);
    setEditingImpresion(false);
  };

  const handleAddMemory = () => {
    if (!newMemoryText.trim()) return;
    const text = newMemoryText.trim();
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nuevoRecuerdo: RecuerdoEpisodicoNPC = {
      id,
      tipo: newMemoryType,
      texto: text
    };
    const updatedRecuerdos = [...(npc.recuerdosEpisodicos || []), nuevoRecuerdo];
    let updatedPromesas = [...(npc.promesas || [])];
    let updatedConfidencias = [...(npc.confidencias || [])];
    let updatedAprendizajes = [...(npc.habilidadesAprendidas || [])];

    if (newMemoryType === 'promesa' && !updatedPromesas.includes(text)) {
      updatedPromesas.push(text);
    } else if (newMemoryType === 'confidencia' && !updatedConfidencias.includes(text)) {
      updatedConfidencias.push(text);
    } else if (newMemoryType === 'aprendizaje' && !updatedAprendizajes.includes(text)) {
      updatedAprendizajes.push(text);
    }

    const updatedNpc: NPC = {
      ...npc,
      recuerdosEpisodicos: updatedRecuerdos,
      promesas: updatedPromesas,
      confidencias: updatedConfidencias,
      habilidadesAprendidas: updatedAprendizajes
    };

    setNpc(updatedNpc);
    onUpdateNpc?.(updatedNpc);
    setNewMemoryText('');
    setIsAddingMemory(false);
  };

  const handleDeleteMemory = (id: string, text: string) => {
    const updatedRecuerdos = (npc.recuerdosEpisodicos || []).filter(r => r.id !== id);
    const updatedPromesas = (npc.promesas || []).filter(p => p !== text);
    const updatedConfidencias = (npc.confidencias || []).filter(c => c !== text);
    const updatedAprendizajes = (npc.habilidadesAprendidas || []).filter(a => a !== text);

    const updatedNpc: NPC = {
      ...npc,
      recuerdosEpisodicos: updatedRecuerdos,
      promesas: updatedPromesas,
      confidencias: updatedConfidencias,
      habilidadesAprendidas: updatedAprendizajes
    };

    setNpc(updatedNpc);
    onUpdateNpc?.(updatedNpc);
    if (editingMemoryId === id) {
      setEditingMemoryId(null);
      setEditingMemoryText('');
    }
  };

  const handleSaveEditedMemory = (id: string, oldText: string) => {
    if (!editingMemoryText.trim()) return;
    const newText = editingMemoryText.trim();
    const updatedRecuerdos = (npc.recuerdosEpisodicos || []).map(r =>
      r.id === id ? { ...r, texto: newText } : r
    );
    const updatedPromesas = (npc.promesas || []).map(p => (p === oldText ? newText : p));
    const updatedConfidencias = (npc.confidencias || []).map(c => (c === oldText ? newText : c));
    const updatedAprendizajes = (npc.habilidadesAprendidas || []).map(a => (a === oldText ? newText : a));

    const updatedNpc: NPC = {
      ...npc,
      recuerdosEpisodicos: updatedRecuerdos,
      promesas: updatedPromesas,
      confidencias: updatedConfidencias,
      habilidadesAprendidas: updatedAprendizajes
    };

    setNpc(updatedNpc);
    onUpdateNpc?.(updatedNpc);
    setEditingMemoryId(null);
    setEditingMemoryText('');
  };

  // Match portrait file
  const matchingFile = npc.portrait
    ? allImageFiles.find(f => f.content === npc.portrait)
    : allImageFiles.find(
        f => npc.name.length > 2 && f.name.toLowerCase().includes(npc.name.toLowerCase())
      );
  const portraitSrc = npc.portrait || matchingFile?.content;

  // Helpers for affinity
  // La escala de atracción se retiró: el deseo es un interruptor, no una barra.

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

  /*
   * Dos cosas distintas que antes eran la misma.
   *
   * `sabidoEnJuego` es que el secreto SALIÓ en una escena: el personaje lo
   * averiguó y ya cuenta como conocido, también para el Narrador. `destapado`
   * es la jugadora abriendo el sobre para leerlo: no cambia nada de la partida
   * y es, literalmente, destriparse el giro. Mezclarlas hacía que leer una
   * ficha por curiosidad pareciera haber descubierto algo.
   */
  const sabidoEnJuego = !!npc.secretoRevelado;
  const destapado = vinculosDestapados.has(npc.id);
  const isSecretRevealed = sabidoEnJuego || destapado;
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

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer shrink-0"
              title="Cerrar ficha"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Páginas del Dossier) */}
        <div className="flex flex-wrap border-b border-[var(--glass-border)] bg-[var(--surface)] px-4 gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 text-xs sm:text-sm font-cinzel font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Scroll className="w-4 h-4" />
            <span>Perfil & Afinidad</span>
          </button>

          <button
            onClick={() => setActiveTab('memories')}
            className={`py-2.5 px-3 text-xs sm:text-sm font-cinzel font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'memories'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Brain className="w-4 h-4 text-purple-400" />
            <span>Recuerdos & Promesas</span>
            {allMemories.length > 0 && (
              <span className="text-[10px] bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded-full font-sans font-bold">
                {allMemories.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`py-2.5 px-3 text-xs sm:text-sm font-cinzel font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-all shrink-0 whitespace-nowrap ${
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
              className={`py-2.5 px-3 text-xs sm:text-sm font-cinzel font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-all shrink-0 whitespace-nowrap ${
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

              {/* Idiomas y nivel de dominio */}
              {npc.idiomas && (
                <div className="bg-[var(--surface-soft)] p-3.5 rounded-xl border border-[var(--user-border)] flex items-start gap-2.5 shadow-2xs">
                  <Languages className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider block mb-0.5">
                      Idiomas & Dominio Lingüístico
                    </span>
                    <p className="text-xs sm:text-sm text-[var(--text-primary)] m-0 leading-relaxed font-lora">
                      {npc.idiomas}
                    </p>
                  </div>
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

                {/*
                  EL DESEO: UN INTERRUPTOR, NO UNA BARRA.

                  Había aquí cinco corazones y una barra de progreso sobre un
                  0-20, y esa escala no la consumía nadie: ni una regla miraba
                  su magnitud. Peor, prometía una precisión que no existe —entre
                  un 11 y un 13 no hay ninguna escena distinta— y empujaba al
                  Narrador a promediar. Ahora se dice si la desea, y cómo se le
                  nota lo dice su ficha.
                */}
                {/*
                  EL DESEO SE MIRA, NO SE TOCA.

                  Aquí hubo un momento tres botones para corregirlo a mano, y
                  estaban de más: la afinidad es del Narrador, «de solo lectura
                  para el jugador» como dice su propio protocolo. Si se puede
                  poner a dedo deja de significar nada — es el mismo motivo por
                  el que las tiradas no se editan.

                  Cuando esté mal, se le dice al Director en la mesa y lo
                  corrige él. Eso sí queda registrado y sí tiene que
                  justificarse.
                */}
                {(() => {
                  const interes = interesPorLaProtagonista(npc);
                  if (!interes) return null;
                  const desea = interes === 'desea';
                  return (
                    <div
                      className={`space-y-1 p-3 rounded-lg border ${
                        desea ? 'border-rose-500/30 bg-rose-500/10' : 'border-amber-500/25 bg-amber-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-cinzel font-bold">
                        <Heart className={`w-4 h-4 ${desea ? 'fill-rose-500 text-rose-500' : 'text-amber-500'}`} />
                        <span className={desea ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}>
                          {desea ? 'La desea' : 'Interés'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] italic m-0 leading-snug">
                        {desea
                          ? 'Cómo se le nota es cosa de quién es él, no de una intensidad. Y desear no le da derecho a nada.'
                          : 'Hay algo y todavía no es deseo: la mira más de lo que haría falta, busca su conversación.'}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] m-0 pt-1 border-t border-[var(--glass-border)] leading-snug">
                        Lo lleva el Narrador. Si crees que está mal, díselo al Director en la Mesa y lo corrige él.
                      </p>
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
                          <Lock className="w-3.5 h-3.5" />
                          {sabidoEnJuego ? 'Lo que ocultaba (ya lo sabes):' : 'Lo que oculta (aún no lo sabes):'}
                        </span>
                        {sabidoEnJuego ? (
                          <span
                            className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-cinzel font-semibold shrink-0"
                            title="Salió a la luz jugando. El Narrador ya puede contar con ello."
                          >
                            Descubierto en juego
                          </span>
                        ) : destapado ? (
                          <span className="text-[10px] bg-rose-500/20 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded font-cinzel font-semibold shrink-0">
                            Sello Roto
                          </span>
                        ) : null}
                      </div>

                      {sabidoEnJuego && (
                        <p className="text-[11px] text-emerald-800 dark:text-emerald-300 m-0 leading-snug">
                          Se supo {npc.secretoRevelado?.fecha ? `el ${npc.secretoRevelado.fecha}` : 'jugando'}
                          {npc.secretoRevelado?.como ? `: ${npc.secretoRevelado.como}` : '.'}
                        </p>
                      )}

                      {isSecretRevealed ? (
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed italic m-0 whitespace-pre-wrap border-l-2 border-rose-500 pl-3">
                          {npc.oculta}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-[var(--text-secondary)] italic m-0">
                            Este personaje guarda algo que tu personaje <strong>todavía no sabe</strong>. El Narrador lo
                            tiene y no puede contarlo: sale jugando —preguntando, ganándote su confianza, atando cabos—
                            y entonces se marca solo.
                          </p>
                          <button
                            onClick={() => onToggleDestaparVinculo(npc.id)}
                            className="min-h-[40px] px-3 border border-rose-500/50 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white rounded-lg font-cinzel text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Solo lo lees tú. No cambia nada de la partida y te quedas sin la sorpresa."
                          >
                            <Lock className="w-3.5 h-3.5" /> Leerlo igualmente (te lo destripas)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Memoria Viva & Evolución */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--accent)]/30 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-purple-400" /> Recuerdos & Promesas con la Protagonista
                  </span>
                  <button
                    onClick={() => setActiveTab('memories')}
                    className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-cinzel font-semibold cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" /> Gestionar / Escribir
                  </button>
                </div>

                {npc.impresionActual && (
                  <div className="text-xs text-[var(--text-primary)] italic bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--glass-border)]">
                    <strong className="text-[var(--accent)] not-italic font-cinzel block mb-0.5">💭 Juicio / Impresión interna actual:</strong>
                    «{npc.impresionActual}»
                  </div>
                )}

                {npc.promesas && npc.promesas.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-cinzel font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      🤝 Promesas y pactos mutuos:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-[var(--text-secondary)] pl-1">
                      {npc.promesas.map((p, i) => (
                        <li key={i} className="leading-snug"><span className="text-[var(--text-primary)] font-medium">«{p}»</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {npc.confidencias && npc.confidencias.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-cinzel font-bold text-violet-700 dark:text-violet-400 flex items-center gap-1">
                      🤫 Confidencias íntimas compartidas:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-[var(--text-secondary)] pl-1">
                      {npc.confidencias.map((c, i) => (
                        <li key={i} className="leading-snug"><span className="text-[var(--text-primary)] font-medium">«{c}»</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {npc.habilidadesAprendidas && npc.habilidadesAprendidas.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-cinzel font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      🎓 Habilidades y saberes aprendidos de ella:
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {npc.habilidadesAprendidas.map((h, i) => (
                        <span key={i} className="text-[11px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-medium border border-emerald-500/30">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {allMemories.length === 0 && !npc.impresionActual && (
                  <p className="text-xs text-[var(--text-secondary)] italic m-0">
                    Aún no hay recuerdos o promesas fijadas. Puedes añadirlas con el botón «Gestionar / Escribir» o desde el botón «Recordar» en el chat.
                  </p>
                )}
              </div>

              {/* If no data yet */}
              {!npc.description && !npc.notes && !physicalDesc && (
                <div className="text-center py-8 text-xs text-[var(--text-secondary)] italic">
                  Este personaje aún no tiene descripción o notas ampliadas. Puedes añadirlas pulsando en «Editar Datos».
                </div>
              )}
            </div>
          )}

          {/* TAB: Recuerdos & Promesas con el Protagonista (Editable, sin diales) */}
          {activeTab === 'memories' && (
            <div className="space-y-4">
              {/* Encabezado explicativo con botón para añadir */}
              <div className="bg-[var(--surface-soft)] p-4 rounded-xl border border-[var(--accent)]/30 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-cinzel font-bold text-sm text-[var(--accent)] flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" /> Recuerdos y Promesas con el Protagonista
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                      Pactos, confidencias íntimas, habilidades compartidas y citas memorables fijadas en la memoria de este PNJ. No se diluyen ni se olvidan entre capítulos.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddingMemory(!isAddingMemory)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-cinzel font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer self-start sm:self-auto shrink-0 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingMemory ? 'Cerrar Formulario' : 'Añadir Recuerdo / Promesa'}</span>
                  </button>
                </div>

                {/* Formulario desplegable para añadir */}
                {isAddingMemory && (
                  <div className="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-3 bg-[var(--surface)] p-3 rounded-lg">
                    <span className="text-xs font-cinzel font-bold text-[var(--text-primary)] block">
                      Nuevo pacto, confidencia o momento especial:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { type: 'promesa', label: '🤝 Promesa / Juramento', color: 'border-amber-500/50 text-amber-600 dark:text-amber-400' },
                          { type: 'confidencia', label: '🤫 Confidencia Íntima', color: 'border-purple-500/50 text-purple-600 dark:text-purple-400' },
                          { type: 'aprendizaje', label: '🎓 Habilidad / Idioma', color: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' },
                          { type: 'evolucion', label: '📜 Momento Especial / Cita', color: 'border-blue-500/50 text-blue-600 dark:text-blue-400' }
                        ] as const
                      ).map(opt => (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => setNewMemoryType(opt.type)}
                          className={`px-2.5 py-1 text-xs rounded-md border font-cinzel transition-all cursor-pointer ${
                            newMemoryType === opt.type
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-bold shadow-xs'
                              : `bg-[var(--surface-soft)] ${opt.color} hover:bg-[var(--surface)] opacity-80`
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={newMemoryText}
                      onChange={e => setNewMemoryText(e.target.value)}
                      placeholder={
                        newMemoryType === 'promesa'
                          ? 'Ej: «Prometió no permitir que nadie tocase el violín ni revelar su secreto a la tripulación»...'
                          : newMemoryType === 'confidencia'
                          ? 'Ej: «Confesó en privado su temor a las represalias de su matrona en Menzoberranzan»...'
                          : newMemoryType === 'aprendizaje'
                          ? 'Ej: «Aryendell le enseñó palabras y códigos básicos en druídico durante la guardia»...'
                          : 'Ej: «Bajo el templo de Sune, intercambiaron miradas tras el duelo y se juraron lealtad...»'
                      }
                      className="w-full h-20 p-2.5 text-xs sm:text-sm rounded-lg bg-[var(--surface-soft)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsAddingMemory(false);
                          setNewMemoryText('');
                        }}
                        className="px-3 py-1 text-xs rounded bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddMemory}
                        disabled={!newMemoryText.trim()}
                        className="px-3.5 py-1 text-xs rounded bg-[var(--accent)] text-white font-cinzel font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
                      >
                        Guardar en su Memoria
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Juicio / Impresión Interior Actual */}
              <div className="bg-[var(--surface-soft)] p-3.5 rounded-xl border border-[var(--glass-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5">
                    💭 Juicio / Impresión Interior hacia la Protagonista
                  </span>
                  {!editingImpresion && (
                    <button
                      onClick={() => setEditingImpresion(true)}
                      className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] flex items-center gap-1 font-cinzel cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                  )}
                </div>

                {editingImpresion ? (
                  <div className="space-y-2">
                    <textarea
                      value={impresionDraft}
                      onChange={e => setImpresionDraft(e.target.value)}
                      placeholder="¿Cómo percibe internamente este PNJ a la protagonista ahora mismo? (Ej: «La mira con fascinación y respeto contenido tras verla tocar el violín...»)"
                      className="w-full h-16 p-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setImpresionDraft(npc.impresionActual || '');
                          setEditingImpresion(false);
                        }}
                        className="px-2.5 py-1 text-xs rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveImpresion}
                        className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-white font-cinzel font-semibold hover:opacity-90 cursor-pointer"
                      >
                        Guardar Impresión
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-[var(--text-primary)] italic m-0 p-2 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)]">
                    {npc.impresionActual ? `«${npc.impresionActual}»` : (
                      <span className="text-[var(--text-secondary)] not-italic">
                        Sin impresión interior registrada. Pulsa «Editar» para fijar cómo la percibe.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Lista de Recuerdos, Promesas y Confidencias */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Pactos y Momentos Registrados ({allMemories.length})
                  </span>
                </div>

                {allMemories.length === 0 ? (
                  <div className="text-center py-8 p-4 rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--surface)]/40 space-y-1">
                    <Quote className="w-6 h-6 mx-auto text-[var(--text-secondary)]/50" />
                    <p className="text-xs text-[var(--text-secondary)] italic m-0">
                      Aún no hay pactos ni recuerdos especiales registrados con {npc.name}.
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]/80 m-0">
                      Puedes añadir uno con el botón superior o usar el botón <strong className="text-[var(--accent)]">«Recordar»</strong> directamente en el texto del chat.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allMemories.map(recuerdo => {
                      const isEditing = editingMemoryId === recuerdo.id;
                      const badgeConfig =
                        recuerdo.tipo === 'promesa'
                          ? { label: '🤝 Promesa', bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' }
                          : recuerdo.tipo === 'confidencia'
                          ? { label: '🤫 Confidencia', bg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' }
                          : recuerdo.tipo === 'aprendizaje'
                          ? { label: '🎓 Aprendizaje', bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' }
                          : { label: '📜 Momento Especial', bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' };

                      return (
                        <div
                          key={recuerdo.id}
                          className="bg-[var(--surface-soft)] p-3 rounded-xl border border-[var(--glass-border)] space-y-2 hover:border-[var(--accent)]/40 transition-all shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-cinzel font-bold px-2 py-0.5 rounded border ${badgeConfig.bg}`}>
                                {badgeConfig.label}
                              </span>
                              {recuerdo.capitulo && (
                                <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                                  {recuerdo.capitulo}
                                </span>
                              )}
                              {recuerdo.fecha && (
                                <span className="text-[10px] text-[var(--text-secondary)]">
                                  • {recuerdo.fecha}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isEditing && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingMemoryId(recuerdo.id);
                                      setEditingMemoryText(recuerdo.texto);
                                    }}
                                    className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-all cursor-pointer"
                                    title="Editar este recuerdo con un clic"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMemory(recuerdo.id, recuerdo.texto)}
                                    className="p-1 rounded text-[var(--text-secondary)] hover:text-red-500 hover:bg-[var(--surface)] transition-all cursor-pointer"
                                    title="Eliminar este recuerdo con un clic"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                value={editingMemoryText}
                                onChange={e => setEditingMemoryText(e.target.value)}
                                className="w-full h-16 p-2 text-xs sm:text-sm rounded-lg bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingMemoryId(null);
                                    setEditingMemoryText('');
                                  }}
                                  className="px-2.5 py-1 text-xs rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleSaveEditedMemory(recuerdo.id, recuerdo.texto)}
                                  className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-white font-cinzel font-semibold hover:opacity-90 cursor-pointer"
                                >
                                  Guardar Cambios
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed m-0 whitespace-pre-wrap font-serif">
                              «{recuerdo.texto}»
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
              {/* Header Badges: CR, Class, Type */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)]">
                {(npc.cr || sheet.cr || sheet.level) && (
                  <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-cinzel font-bold border border-amber-500/40 text-xs">
                    ⚔️ Valor de Desafío (CR): {npc.cr || sheet.cr || sheet.level}
                  </span>
                )}
                {(sheet.class || sheet.title) && (
                  <span className="px-2.5 py-1 rounded bg-[var(--accent)]/15 text-[var(--accent)] font-cinzel font-semibold text-xs border border-[var(--accent)]/30">
                    📜 {sheet.class || sheet.title}
                  </span>
                )}
                {(npc.idiomas || (sheet.languages && sheet.languages.length > 0)) && (
                  <span className="px-2.5 py-1 rounded bg-teal-500/15 text-teal-800 dark:text-teal-300 font-cinzel text-xs flex items-center gap-1 border border-teal-500/30">
                    <Languages className="w-3.5 h-3.5" />
                    <span>{npc.idiomas || sheet.languages?.join(', ')}</span>
                  </span>
                )}
              </div>

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

              {/* Traits / Special Abilities */}
              {sheet.traits && sheet.traits.length > 0 && (
                <div className="bg-[var(--surface-soft)] p-3.5 rounded-xl border border-[var(--user-border)] space-y-2">
                  <span className="font-cinzel text-xs font-bold text-[var(--accent)] uppercase tracking-wider block">
                    Rasgos & Habilidades Especiales
                  </span>
                  <div className="space-y-2">
                    {sheet.traits.map((trait, i) => (
                      <div key={i} className="text-xs bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--user-border)]">
                        <strong className="font-cinzel text-[var(--accent)]">{trait.name}</strong>
                        <p className="text-[var(--text-secondary)] mt-1 m-0">{trait.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions and Attacks */}
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
