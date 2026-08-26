import React, { useState } from 'react';
import { Project, Memory, NPC, Location, Quest } from '../types';
import { ScrollText, User, MapPin, Compass, Plus, Trash2, Edit2, Check, RefreshCw, Sparkles, BookOpen } from 'lucide-react';

interface SimpleMemoryViewProps {
  project: Project;
  onUpdateMemory: (updater: (prev: Memory) => Memory) => Promise<void>;
  onUpdateProject: (fields: Partial<Project> | ((prev: Project) => Partial<Project>)) => Promise<void>;
  onTriggerAIUpdate?: () => void;
  isGenerating?: boolean;
}

export const SimpleMemoryView: React.FC<SimpleMemoryViewProps> = ({
  project,
  onUpdateMemory,
  onTriggerAIUpdate,
  isGenerating = false
}) => {
  const memory = project.memory || {
    story: '',
    current_status: '',
    manual_notes: '',
    quests: [],
    npcs: [],
    locations: []
  };

  const [activeSubTab, setActiveSubTab] = useState<'resumen' | 'personajes' | 'lugares' | 'misiones' | 'notas'>('resumen');
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  // Form states for adding quick items
  const [newNpcName, setNewNpcName] = useState('');
  const [newNpcRelation, setNewNpcRelation] = useState('');
  const [newNpcNotes, setNewNpcNotes] = useState('');
  const [isAddingNpc, setIsAddingNpc] = useState(false);

  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [isAddingLoc, setIsAddingLoc] = useState(false);

  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestObj, setNewQuestObj] = useState('');
  const [isAddingQuest, setIsAddingQuest] = useState(false);

  const handleFieldChange = (field: keyof Memory, val: any) => {
    onUpdateMemory(prev => ({
      ...prev,
      [field]: val
    }));
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2000);
  };

  const handleAddNpc = () => {
    if (!newNpcName.trim()) return;
    const newNpc: NPC = {
      id: 'npc_' + Date.now(),
      name: newNpcName.trim(),
      relation: newNpcRelation.trim() || 'Conocido',
      status: 'Vivo',
      notes: newNpcNotes.trim(),
      description: newNpcNotes.trim()
    };
    const updated = [...(memory.npcs || []), newNpc];
    handleFieldChange('npcs', updated);
    setNewNpcName('');
    setNewNpcRelation('');
    setNewNpcNotes('');
    setIsAddingNpc(false);
  };

  const handleDeleteNpc = (id: string) => {
    const updated = (memory.npcs || []).filter(n => n.id !== id);
    handleFieldChange('npcs', updated);
  };

  const handleAddLocation = () => {
    if (!newLocName.trim()) return;
    const newLoc: Location = {
      id: 'loc_' + Date.now(),
      name: newLocName.trim(),
      desc: newLocDesc.trim(),
      notes: newLocDesc.trim()
    };
    const updated = [...(memory.locations || []), newLoc];
    handleFieldChange('locations', updated);
    setNewLocName('');
    setNewLocDesc('');
    setIsAddingLoc(false);
  };

  const handleDeleteLocation = (id: string) => {
    const updated = (memory.locations || []).filter(l => l.id !== id);
    handleFieldChange('locations', updated);
  };

  const handleAddQuest = () => {
    if (!newQuestTitle.trim()) return;
    const newQuest: Quest = {
      id: 'quest_' + Date.now(),
      title: newQuestTitle.trim(),
      origin: 'Aventura',
      objective: newQuestObj.trim(),
      progress: 'En curso',
      status: 'active',
      type: 'principal'
    };
    const updated = [...(memory.quests || []), newQuest];
    handleFieldChange('quests', updated);
    setNewQuestTitle('');
    setNewQuestObj('');
    setIsAddingQuest(false);
  };

  const handleDeleteQuest = (id: string) => {
    const updated = (memory.quests || []).filter(q => q.id !== id);
    handleFieldChange('quests', updated);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-color)] overflow-hidden">
      {/* Header Bar */}
      <div className="p-3 md:px-6 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h2 className="font-cinzel text-base md:text-lg font-bold text-[var(--accent)] leading-tight">
              Memoria Persistente
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-lora">
              Resumen, personajes clave, localizaciones y notas directas para el Narrador.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSavedRecently && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-cinzel font-semibold animate-pulse">
              <Check className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
          {onTriggerAIUpdate && (
            <button
              onClick={onTriggerAIUpdate}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              title="Sincronizar memoria persistente con IA a partir de las sesiones jugadas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Sincronizando...' : 'Sincronizar con IA'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 md:px-6 pt-2 pb-2 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_30%,transparent)] shrink-0">
        {[
          { id: 'resumen', label: 'Resumen & Estado', icon: ScrollText },
          { id: 'personajes', label: `PNJs (${(memory.npcs || []).length})`, icon: User },
          { id: 'lugares', label: `Lugares (${(memory.locations || []).length})`, icon: MapPin },
          { id: 'misiones', label: `Misiones (${(memory.quests || []).length})`, icon: Compass },
          { id: 'notas', label: 'Notas Libres', icon: Edit2 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-cinzel transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--glass)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 font-lora">
        {/* RESUMEN & ESTADO */}
        {activeSubTab === 'resumen' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--glass-border)] shadow-xs">
              <label className="block text-xs font-cinzel font-bold text-[var(--accent)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Historia y Contexto General
              </label>
              <textarea
                value={memory.story || ''}
                onChange={e => handleFieldChange('story', e.target.value)}
                placeholder="Escribe el resumen de la trama actual, sucesos previos o contexto de la campaña..."
                rows={7}
                className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] rounded-lg p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none resize-y leading-relaxed font-lora"
              />
            </div>

            <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--glass-border)] shadow-xs">
              <label className="block text-xs font-cinzel font-bold text-[var(--accent)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Situación Inmediata / Estado Actual
              </label>
              <textarea
                value={memory.current_status || ''}
                onChange={e => handleFieldChange('current_status', e.target.value)}
                placeholder="¿Dónde se encuentran ahora mismo? ¿En qué escena o peligro inmediato?"
                rows={4}
                className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] rounded-lg p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none resize-y leading-relaxed font-lora"
              />
            </div>
          </div>
        )}

        {/* PERSONAJES (PNJs) */}
        {activeSubTab === 'personajes' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase">
                Personajes No Jugadores Conocidos
              </span>
              <button
                onClick={() => setIsAddingNpc(true)}
                className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-semibold flex items-center gap-1 hover:opacity-90 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir PNJ</span>
              </button>
            </div>

            {isAddingNpc && (
              <div className="p-4 bg-[var(--surface)] border border-[var(--accent)] rounded-xl space-y-3 shadow-sm">
                <h4 className="font-cinzel text-xs font-bold text-[var(--accent)]">Nuevo Personaje</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre del PNJ (ej: Jarlaxle Baenre)"
                    value={newNpcName}
                    onChange={e => setNewNpcName(e.target.value)}
                    className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] p-2 rounded-lg text-sm text-[var(--text-primary)] outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Relación / Rol (ej: Aliado cauteloso, Corsario)"
                    value={newNpcRelation}
                    onChange={e => setNewNpcRelation(e.target.value)}
                    className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] p-2 rounded-lg text-sm text-[var(--text-primary)] outline-none"
                  />
                </div>
                <textarea
                  placeholder="Detalles, apariencia o secretos..."
                  value={newNpcNotes}
                  onChange={e => setNewNpcNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] p-2 rounded-lg text-sm text-[var(--text-primary)] outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsAddingNpc(false)}
                    className="px-3 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--glass)]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddNpc}
                    className="px-3 py-1 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-semibold"
                  >
                    Guardar PNJ
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(memory.npcs || []).length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-[var(--text-secondary)] font-cinzel italic">
                  No hay personajes registrados todavía.
                </div>
              ) : (
                memory.npcs.map(npc => (
                  <div
                    key={npc.id}
                    className="bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)] shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-cinzel text-sm font-bold text-[var(--accent)]">
                          {npc.name}
                        </h4>
                        <button
                          onClick={() => handleDeleteNpc(npc.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          title="Eliminar PNJ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] font-semibold mb-2">
                        {npc.relation || 'Sin rol especificado'} • <span className="opacity-80">{npc.status || 'Activo'}</span>
                      </p>
                      {npc.notes && (
                        <p className="text-xs text-[var(--text-primary)] line-clamp-3 leading-relaxed">
                          {npc.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* LUGARES */}
        {activeSubTab === 'lugares' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase">
                Lugares & Ubicaciones
              </span>
              <button
                onClick={() => setIsAddingLoc(true)}
                className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-semibold flex items-center gap-1 hover:opacity-90 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Lugar</span>
              </button>
            </div>

            {isAddingLoc && (
              <div className="p-4 bg-[var(--surface)] border border-[var(--accent)] rounded-xl space-y-3 shadow-sm">
                <h4 className="font-cinzel text-xs font-bold text-[var(--accent)]">Nuevo Lugar</h4>
                <input
                  type="text"
                  placeholder="Nombre de la localización (ej: Bahía de Luskan)"
                  value={newLocName}
                  onChange={e => setNewLocName(e.target.value)}
                  className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] p-2 rounded-lg text-sm text-[var(--text-primary)] outline-none"
                />
                <textarea
                  placeholder="Descripción del entorno, atmósfera o peligros..."
                  value={newLocDesc}
                  onChange={e => setNewLocDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] p-2 rounded-lg text-sm text-[var(--text-primary)] outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsAddingLoc(false)}
                    className="px-3 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--glass)]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddLocation}
                    className="px-3 py-1 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-semibold"
                  >
                    Guardar Lugar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(memory.locations || []).length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-[var(--text-secondary)] font-cinzel italic">
                  No hay lugares registrados todavía.
                </div>
              ) : (
                memory.locations.map(loc => (
                  <div
                    key={loc.id}
                    className="bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)] shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-cinzel text-sm font-bold text-[var(--accent)] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {loc.name}
                        </h4>
                        <button
                          onClick={() => handleDeleteLocation(loc.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          title="Eliminar Lugar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {(loc.desc || loc.notes) && (
                        <p className="text-xs text-[var(--text-primary)] line-clamp-3 leading-relaxed mt-2">
                          {loc.desc || loc.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MISIONES */}
        {activeSubTab === 'misiones' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase">
                Misiones & Hilos de Aventura
              </span>
              <button
                onClick={() => setIsAddingQuest(true)}
                className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-semibold flex items-center gap-1 hover:opacity-90 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Misión</span>
              </button>
            </div>

            {isAddingQuest && (
              <div className="p-4 bg-[var(--surface)] border border-[var(--accent)] rounded-xl space-y-3 shadow-sm">
                <h4 className="font-cinzel text-xs font-bold text-[var(--accent)]">Nueva Misión</h4>
                <input
                  type="text"
                  placeholder="Título de la misión (ej: Infiltración en la Torre del Hada)"
                  value={newQuestTitle}
                  onChange={e => setNewQuestTitle(e.target.value)}
                  className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] p-2 rounded-lg text-sm text-[var(--text-primary)] outline-none"
                />
                <textarea
                  placeholder="Objetivo o recompensa..."
                  value={newQuestObj}
                  onChange={e => setNewQuestObj(e.target.value)}
                  rows={2}
                  className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] p-2 rounded-lg text-sm text-[var(--text-primary)] outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsAddingQuest(false)}
                    className="px-3 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--glass)]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddQuest}
                    className="px-3 py-1 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-semibold"
                  >
                    Guardar Misión
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {(memory.quests || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-secondary)] font-cinzel italic">
                  No hay misiones activas registradas.
                </div>
              ) : (
                memory.quests.map(q => (
                  <div
                    key={q.id}
                    className="bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--glass-border)] shadow-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <h4 className="font-cinzel text-sm font-bold text-[var(--accent)] flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 shrink-0" />
                        {q.title}
                      </h4>
                      {q.objective && (
                        <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                          {q.objective}
                        </p>
                      )}
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Estado: <span className="font-semibold text-[var(--accent)]">{q.progress || q.status || 'En curso'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteQuest(q.id)}
                      className="text-red-500 hover:text-red-700 p-1 cursor-pointer shrink-0"
                      title="Eliminar Misión"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* NOTAS LIBRES */}
        {activeSubTab === 'notas' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--glass-border)] shadow-xs">
              <label className="block text-xs font-cinzel font-bold text-[var(--accent)] uppercase tracking-wider mb-1.5">
                Apuntes Libres del Jugador / DM
              </label>
              <textarea
                value={memory.manual_notes || ''}
                onChange={e => handleFieldChange('manual_notes', e.target.value)}
                placeholder="Pistas, inventario personal, sospechas o recordatorios libres..."
                rows={12}
                className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--user-border)] rounded-lg p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none resize-y leading-relaxed font-lora"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
