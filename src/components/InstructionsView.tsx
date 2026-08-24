import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE } from '../utils/defaultDirectives';
import { analyzeNarrativeStyleFromDocument, describeApiError } from '../utils/geminiHelper';

import {
  Check,
  ChevronDown,
  ChevronUp,
  Dices,
  Heart,
  Hourglass,
  Info,
  Lock,
  Package,
  PenTool,
  RefreshCw,
  Save,
  Scroll,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Upload,
  UserCheck,
  X
} from 'lucide-react';

export const InstructionsView: React.FC<{
  project: Project;
  onUpdate: (fields: Partial<Pick<Project, 'instructions' | 'system' | 'style'>>) => Promise<void>;
  onRequestConfirm?: (message: string, onConfirm: () => void) => void;
}> = ({ project, onUpdate, onRequestConfirm }) => {
  const [instructions, setInstructions] = useState(project.instructions || '');
  const [system, setSystem] = useState(project.system || '');
  const [style, setStyle] = useState(project.style || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showProtocolsDetail, setShowProtocolsDetail] = useState(false);

  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [analyzingMessage, setAnalyzingMessage] = useState('');
  const [styleSuccessNotice, setStyleSuccessNotice] = useState<string | null>(null);
  const styleFileInputRef = useRef<HTMLInputElement | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ instructions: string; system: string; style: string } | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        void onUpdate(pending);
      }
    };
  }, [onUpdate]);

  useEffect(() => {
    setInstructions(project.instructions || '');
    setSystem(project.system || '');
    setStyle(project.style || '');
    setSaveStatus('saved');
  }, [project.id]);

  const saveChanges = async (newInst?: string, newSys?: string, newSty?: string) => {
    const payload = {
      instructions: newInst !== undefined ? newInst : instructions,
      system: newSys !== undefined ? newSys : system,
      style: newSty !== undefined ? newSty : style
    };

    setSaveStatus('saving');
    try {
      await onUpdate(payload);
      pendingRef.current = null;
      setSaveStatus('saved');
    } catch (e) {
      console.error('Error saving instructions:', e);
      setSaveStatus('unsaved');
    }
  };

  const scheduleDebouncedSave = (newInst?: string, newSys?: string, newSty?: string) => {
    setSaveStatus('unsaved');
    pendingRef.current = {
      instructions: newInst !== undefined ? newInst : instructions,
      system: newSys !== undefined ? newSys : system,
      style: newSty !== undefined ? newSty : style
    };
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveChanges(newInst, newSys, newSty);
    }, 1500);
  };

  const handleRestoreMasterInstructions = () => {
    const message = '¿Deseas restaurar las directivas narrativas y de lore por defecto para este Tomo?';
    const executeRestore = async () => {
      setInstructions(DEFAULT_DM_INSTRUCTIONS);
      setSystem(DEFAULT_SYSTEM);
      setStyle(DEFAULT_STYLE);
      await saveChanges(DEFAULT_DM_INSTRUCTIONS, DEFAULT_SYSTEM, DEFAULT_STYLE);
    };

    if (onRequestConfirm) {
      onRequestConfirm(message, executeRestore);
    } else if (window.confirm(message)) {
      executeRestore();
    }
  };

  const handleStyleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingStyle(true);
    setAnalyzingMessage(`Extrayendo texto y analizando la pluma de "${file.name}"...`);
    setStyleSuccessNotice(null);

    try {
      let fileText = '';
      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.markdown') ||
        file.name.endsWith('.json')
      ) {
        fileText = await file.text();
      } else {
        const reader = new FileReader();
        fileText = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (!fileText || fileText.trim().length < 50) {
        throw new Error('El archivo no contiene suficiente texto legible para analizar el estilo.');
      }

      setAnalyzingMessage(`Gemini está destilando la voz, ritmo y vocabulario de "${file.name}"...`);
      const analyzedDirective = await analyzeNarrativeStyleFromDocument(fileText, file.name);

      if (!analyzedDirective || analyzedDirective.trim().length === 0) {
        throw new Error('No se pudo generar la directiva de estilo del documento.');
      }

      setStyle(analyzedDirective);
      await saveChanges(undefined, undefined, analyzedDirective);
      setStyleSuccessNotice(`Estilo extraído con éxito desde "${file.name}" y guardado en Directivas.`);
    } catch (err: any) {
      console.error('Error analyzing style document:', err);
      alert(`No se pudo aprender el estilo: ${describeApiError(err)}`);
    } finally {
      setIsAnalyzingStyle(false);
      setAnalyzingMessage('');
      if (styleFileInputRef.current) {
        styleFileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-[5%] py-4 md:py-8 font-lora">
      {/* SECCIÓN PROTEGIDA: PROTOCOLOS DEL NÚCLEO Y DE LA INTERFAZ */}
      <div className="bg-amber-950/10 border border-amber-800/30 rounded-lg p-4 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-md bg-amber-900/20 text-[var(--accent)] shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-cinzel text-sm md:text-base font-bold text-[var(--accent)] m-0 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Protocolos del Núcleo y de la Interfaz (Protegidos / Inmutables)
                </h4>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-cinzel font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Siempre Activo
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed max-w-3xl">
                Las directivas técnicas de la aplicación (ejes de afinidad <strong>ATR: 14 | VÍN: 5 | CON: 2</strong>, tiradas interactivas de dados, actualización de inventario, sincronización de PG/CA, calendario y agenda) están blindadas e integradas por el sistema. <strong>Puedes editar, añadir o borrar con total libertad las directivas narrativas de abajo</strong> sin preocuparte por romper el funcionamiento de la interfaz.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowProtocolsDetail(!showProtocolsDetail)}
            className="text-xs font-cinzel font-bold text-[var(--accent)] hover:text-[var(--accent-hover)] px-2.5 py-1.5 rounded bg-[var(--sidebar-bg)] border border-[var(--user-border)] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            {showProtocolsDetail ? 'Ocultar detalles de sintaxis' : 'Ver etiquetas del motor'}
            {showProtocolsDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Acordeón con la guía de sintaxis del motor */}
        {showProtocolsDetail && (
          <div className="mt-4 pt-3 border-t border-amber-800/20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-[fadeIn_0.2s_ease]">
            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <UserCheck className="w-3.5 h-3.5" /> Vínculos y Afinidad de PNJs
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [VÍNCULO: Kieron | grado: ...] / [PRESENTES: ...]
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Sincroniza silenciosamente la afinidad en el HUD y la lista de personajes sin ensuciar el relato del chat.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Dices className="w-3.5 h-3.5" /> Petición de Tiradas de Dados
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [Petición de Tirada: Percepción | CD 15]
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Genera el panel interactivo de tirada de dados para el jugador.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5" /> Inventario y Monedas
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [INVENTARIO: +1 Capa élfica, -15 PO]
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Sincroniza automáticamente la bolsa y monedas de la ficha.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Heart className="w-3.5 h-3.5" /> Estado de Salud y PG
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [ESTADO: PG 24/38 | CA 16 | condiciones: ...]
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Actualiza los puntos de golpe y estados temporales.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Hourglass className="w-3.5 h-3.5" /> Tiempo y Calendario
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [TIEMPO: +4h] / [HILO: ... | vence en 10d]
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Avanza los relojes del mundo y el calendario de la campaña.
              </p>
            </div>

            <div className="bg-[var(--sidebar-bg)] p-3 rounded border border-[rgba(139,69,19,0.2)] text-xs">
              <div className="font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5 mb-1">
                <Scroll className="w-3.5 h-3.5" /> Diario y Agenda del Héroe
              </div>
              <code className="block bg-[var(--bg-color)] p-1.5 rounded font-mono text-[11px] text-[var(--text-primary)] border border-amber-900/10 mb-1">
                [AGENDA: resumen en 1ª persona | lugar: ...]
              </code>
              <p className="text-[11px] text-[var(--text-secondary)] m-0">
                Registra la crónica en la pestaña de Cronología / Agenda.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN EDITABLE: DIRECTIVAS DE CAMPAÑA, LORE, SISTEMA Y ESTILO */}
      <div className="bg-[var(--sidebar-bg)] border-l-4 border-[var(--accent)] p-4 md:p-6 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="font-cinzel text-lg md:text-xl m-0 text-[var(--accent)] flex items-center gap-2">
              <Scroll className="w-5 h-5" /> Directivas de Campaña (Personalizables)
            </h3>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              {saveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  Guardado en el Tomo
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold animate-pulse">
                  <Hourglass className="w-3.5 h-3.5" />
                  Guardando cambios...
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-[var(--accent)] font-semibold"> Cambios pendientes...</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => saveChanges()}
              disabled={saveStatus === 'saved'}
              className="bg-[var(--accent)] text-[var(--on-accent)] rounded px-3 py-1.5 text-xs font-cinzel font-semibold hover:bg-[var(--accent-hover)] transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              title="Guardar cambios manualmente"
            >
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
            <button
              onClick={handleRestoreMasterInstructions}
              className="bg-[var(--msg-user)] text-[var(--accent)] border border-[var(--user-border)] rounded px-3 py-1.5 text-xs font-cinzel font-semibold hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              title="Restaurar las directivas y reglas por defecto de la campaña"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restaurar directivas por defecto
            </button>
          </div>
        </div>

        {styleSuccessNotice && (
          <div className="mb-4 p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-xs flex justify-between items-center animate-[fadeIn_0.2s_ease]">
            <span className="font-cinzel font-bold flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-700" />
              {styleSuccessNotice}
            </span>
            <button
              onClick={() => setStyleSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="font-cinzel text-sm font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide flex justify-between items-center">
              <span className="inline-flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                Directivas del Master (Lore & Conducta)
              </span>
            </div>
            <textarea
              value={instructions}
              onChange={e => {
                const val = e.target.value;
                setInstructions(val);
                scheduleDebouncedSave(val, undefined, undefined);
              }}
              onBlur={() => saveChanges()}
              className="w-full h-[320px] md:h-[500px] bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.3)] p-3.5 rounded-lg text-xs md:text-sm font-mono outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-color)] leading-relaxed resize-y"
              placeholder="Escribe las directivas de lore, comportamiento del Narrador, reglas de mesa..."
            />
          </div>
          <div>
            <div className="font-cinzel text-sm font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" /> Motor y Sistema de Juego
            </div>
            <textarea
              value={system}
              onChange={e => {
                const val = e.target.value;
                setSystem(val);
                scheduleDebouncedSave(undefined, val, undefined);
              }}
              onBlur={() => saveChanges()}
              className="w-full h-[320px] md:h-[500px] bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.3)] p-3.5 rounded-lg text-xs md:text-sm font-lora outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-color)] leading-relaxed resize-y"
              placeholder="Sistema de juego: cómo se resuelven las tiradas, el combate y los recursos..."
            />
          </div>
          <div>
            <div className="font-cinzel text-sm font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide flex justify-between items-center gap-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5" /> Pluma y Estilo Narrativo
              </span>

              {/* Botón para subir un documento y extraer el estilo al vuelo */}
              <input
                ref={styleFileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.json,.text,text/*"
                className="hidden"
                onChange={handleStyleFileSelected}
              />
              <button
                type="button"
                onClick={() => styleFileInputRef.current?.click()}
                disabled={isAnalyzingStyle}
                className="inline-flex items-center gap-1 text-[10px] md:text-[11px] font-cinzel font-bold px-2 py-1 bg-amber-100/80 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Sube una muestra de texto o documento literario para que la IA aprenda su ritmo, voz y vocabulario y cree el prompt de estilo automáticamente"
              >
                {isAnalyzingStyle ? (
                  <>
                    <Hourglass className="w-3 h-3 animate-spin text-[var(--accent)]" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                    <Upload className="w-3 h-3 text-[var(--accent)]" />
                    <span>Aprender de archivo</span>
                  </>
                )}
              </button>
            </div>

            {isAnalyzingStyle && (
              <div className="mb-2 p-2 bg-amber-50/80 border border-amber-300 rounded text-xs text-amber-900 font-cinzel flex items-center gap-2 animate-pulse">
                <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="truncate">{analyzingMessage || 'Analizando estilo literario...'}</span>
              </div>
            )}

            <textarea
              value={style}
              onChange={e => {
                const val = e.target.value;
                setStyle(val);
                scheduleDebouncedSave(undefined, undefined, val);
              }}
              onBlur={() => saveChanges()}
              className="w-full h-[320px] md:h-[500px] bg-[var(--sidebar-bg)] border border-[rgba(139,69,19,0.3)] p-3.5 rounded-lg text-xs md:text-sm font-lora outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-color)] italic leading-relaxed resize-y"
              placeholder="Voz, ritmo y nivel de detalle que quieres en la narración (o pulsa «Aprender de archivo» para destilarlo desde un documento)..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
