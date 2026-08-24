import React, { useState, useEffect } from 'react';
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_BACKGROUND_MODEL_ID,
  getStoredSafetyLevel,
  setStoredSafetyLevel,
  getStoredThinkingLevel,
  setStoredThinkingLevel,
  getStoredTemperature,
  setStoredTemperature,
  getStoredTopP,
  setStoredTopP,
  getStoredAutoFailover,
  setStoredAutoFailover,
  getStoredBackgroundModel,
  setStoredBackgroundModel,
  getStoredApiKeys,
  setStoredApiKeys,
  getStoredAutoSyncMemory,
  setStoredAutoSyncMemory,
  getStoredMemorySyncGranularity,
  setStoredMemorySyncGranularity,
  getStoredKeyRotationMode,
  setStoredKeyRotationMode,
  KeyRotationMode,
  MemorySyncGranularity,
  SafetyThreshold,
  ThinkingLevelSetting,
  describeApiError,
  esModeloAbierto,
  hasConfiguredApiKey,
  listarModelosDeLaClave
} from '../utils/geminiHelper';
import { ResumenUso, borrarUso, resumirUso } from '../utils/usageStats';

import {
  Brain,
  Check,
  Dices,
  Gauge,
  Loader,
  RefreshCw,
  KeyRound,
  Lightbulb,
  Pencil,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
  Plus,
  Trash2,
  Layers,
  FileText,
  Upload,
  Download,
  ClipboardList
} from 'lucide-react';
export interface PromptConfig {
  isOpen: boolean;
  title: string;
  defaultValue: string;
  onConfirm: (val: string) => void;
}

export interface ConfirmConfig {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  /**
   * Este diálogo nació para borrar cosas y tenía los botones «Cancelar» y
   * «Eliminar» escritos a fuego. Sirve igual para una decisión que no destruye
   * nada, pero entonces esas palabras asustan sin motivo, así que se pueden
   * cambiar. Y a veces la salida tampoco es «no hacer nada»: al importar una
   * campaña repetida, cancelar significa guardar las dos.
   */
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  /** Si es `false`, el botón principal deja de ser rojo de peligro. */
  danger?: boolean;
}

export interface AlertConfig {
  isOpen: boolean;
  title: string;
  message: string;
}

export const ApiKeyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentKey: string;
  onSaveKey: (key: string) => void;
  currentModel: string;
  onSaveModel: (model: string) => void;
}> = ({ isOpen, onClose, currentKey, onSaveKey, currentModel, onSaveModel }) => {
  const [keyInput, setKeyInput] = useState(currentKey);
  const [selectedModel, setSelectedModel] = useState(currentModel || DEFAULT_MODEL_ID);
  const [selectedBackgroundModel, setSelectedBackgroundModel] = useState(
    getStoredBackgroundModel() || DEFAULT_BACKGROUND_MODEL_ID
  );
  const [modelosDeLaClave, setModelosDeLaClave] = useState<
    { id: string; nombre: string; entrada: number; salida: number }[] | null
  >(null);
  const [consultandoModelos, setConsultandoModelos] = useState(false);
  // El gasto medido se lee al abrir el panel: entre medias no cambia.
  const [uso, setUso] = useState<ResumenUso[]>([]);
  /**
   * El gasto de un modelo puede estar repartido en varias entradas —una por
   * configuración, como «con búsqueda»—. Bajo cada modelo se suman todas; el
   * desglose se ve en el cuadro comparativo de abajo, que es donde se compara.
   */
  const usoDe = (id: string) => {
    const partes = uso.filter(u => u.modelo === id || u.modelo.startsWith(`${id} · `));
    if (!partes.length) return undefined;
    const turnos = partes.reduce((a, p) => a + p.turnos, 0);
    const media = (campo: keyof ResumenUso) =>
      Math.round(partes.reduce((a, p) => a + (p[campo] as number) * p.turnos, 0) / turnos);
    return {
      turnos,
      mediaEntrada: media('mediaEntrada'),
      mediaSalida: media('mediaSalida'),
      mediaTotal: media('mediaTotal'),
      porcentajeCache: media('porcentajeCache')
    };
  };
  const [errorModelos, setErrorModelos] = useState('');

  const consultarModelos = async () => {
    setConsultandoModelos(true);
    setErrorModelos('');
    try {
      setModelosDeLaClave(await listarModelosDeLaClave());
    } catch (err) {
      setErrorModelos(describeApiError(err));
    } finally {
      setConsultandoModelos(false);
    }
  };
  const [safetyLevel, setSafetyLevel] = useState<SafetyThreshold>(getStoredSafetyLevel());
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevelSetting>(getStoredThinkingLevel());
  const [temperature, setTemperature] = useState<number>(getStoredTemperature());
  const [topP, setTopP] = useState<number>(getStoredTopP());
  const [autoFailover, setAutoFailover] = useState<boolean>(getStoredAutoFailover());
  const [autoSyncMemory, setAutoSyncMemory] = useState<boolean>(getStoredAutoSyncMemory());
  const [memorySyncGranularity, setMemorySyncGranularity] = useState<MemorySyncGranularity>(getStoredMemorySyncGranularity());
  const [keyRotationMode, setKeyRotationMode] = useState<KeyRotationMode>(getStoredKeyRotationMode());
  const [apiKeysList, setApiKeysList] = useState<string[]>(getStoredApiKeys());
  const [newKeyInput, setNewKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showBatchBox, setShowBatchBox] = useState(false);
  const [batchRawText, setBatchRawText] = useState('');
  const [batchFeedback, setBatchFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const keyFileInputRef = React.useRef<HTMLInputElement>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'model' | 'sync' | 'safety' | 'thinking' | 'key'>(
    'model'
  );

  const parseKeysFromRawText = (rawText: string): string[] => {
    if (!rawText) return [];
    const foundKeys: string[] = [];

    // 1. Line-by-line / whitespace / comma / semicolon tokens
    const tokens = rawText.split(/[\r\n,;\t\s]+/);
    for (let token of tokens) {
      let clean = token.trim().replace(/^["'`]|["'`]$/g, '');
      if (clean.includes('=')) {
        clean = clean.split('=').pop()?.trim().replace(/^["'`]|["'`]$/g, '') || '';
      }
      // Remove leading/trailing non-alphanumeric punctuation except dot/underscore/hyphen if part of key
      clean = clean.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (clean.length >= 15 && /^[a-zA-Z0-9_.-]+$/.test(clean)) {
        if (!foundKeys.includes(clean)) {
          foundKeys.push(clean);
        }
      }
    }

    // 2. Specific patterns: standard AI Studio (AIzaSy...) and newer/GCP formats (AQ.***)
    const googlePatterns = [
      /AIza[0-9A-Za-z-_]{30,}/g,
      /AQ\.[0-9A-Za-z-_.]+/g
    ];

    for (const pat of googlePatterns) {
      const matches = rawText.match(pat);
      if (matches) {
        for (const m of matches) {
          const cleanM = m.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
          if (cleanM.length >= 15 && !foundKeys.includes(cleanM)) {
            foundKeys.push(cleanM);
          }
        }
      }
    }

    return foundKeys;
  };

  const handleImportBatchKeys = (textToImport: string) => {
    const extracted = parseKeysFromRawText(textToImport);
    if (extracted.length === 0) {
      setBatchFeedback({
        text: 'No se detectaron claves de API válidas en el texto. Asegúrate de incluir claves que empiecen por "AIzaSy..." o tengan al menos 20 caracteres.',
        isError: true
      });
      return;
    }

    let addedCount = 0;
    const currentSet = new Set(apiKeysList);
    const updated = [...apiKeysList];

    for (const k of extracted) {
      if (!currentSet.has(k)) {
        currentSet.add(k);
        updated.push(k);
        addedCount++;
      }
    }

    setApiKeysList(updated);
    if (!keyInput.trim() && updated.length > 0) {
      setKeyInput(updated[0]);
    }

    const duplicates = extracted.length - addedCount;
    setBatchFeedback({
      text: `✓ Se ${addedCount === 1 ? 'ha importado 1 clave nueva' : `han importado ${addedCount} claves nuevas`}${
        duplicates > 0 ? ` (${duplicates} ya existían en el pool)` : ''
      }. Total en el pool: ${updated.length}.`,
      isError: false
    });
    setBatchRawText('');
    setShowBatchBox(false);
  };

  const handleKeyFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleImportBatchKeys(content);
      }
      if (keyFileInputRef.current) {
        keyFileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setBatchFeedback({ text: 'Error al leer el archivo seleccionado.', isError: true });
      if (keyFileInputRef.current) {
        keyFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExportKeys = () => {
    if (apiKeysList.length === 0) return;
    const content = `# Claves de API Google AI Studio - GM Studio\n# Total: ${apiKeysList.length}\n# Fecha: ${new Date().toLocaleString()}\n\n` + apiKeysList.join('\n') + '\n';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini_api_keys_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isOpen) {
      setKeyInput(currentKey || '');
      setApiKeysList(getStoredApiKeys());
      setKeyRotationMode(getStoredKeyRotationMode());
      setSelectedModel(currentModel || DEFAULT_MODEL_ID);
      setSelectedBackgroundModel(getStoredBackgroundModel() || DEFAULT_BACKGROUND_MODEL_ID);
      setSafetyLevel(getStoredSafetyLevel());
      setThinkingLevel(getStoredThinkingLevel());
      setTemperature(getStoredTemperature());
      setTopP(getStoredTopP());
      setAutoFailover(getStoredAutoFailover());
      setAutoSyncMemory(getStoredAutoSyncMemory());
      setMemorySyncGranularity(getStoredMemorySyncGranularity());
      setUso(resumirUso());
    }
  }, [isOpen, currentKey, currentModel]);

  const handleSave = () => {
    const primaryKey = keyInput.trim();
    let updatedList = [...apiKeysList];
    if (primaryKey && !updatedList.includes(primaryKey)) {
      updatedList = [primaryKey, ...updatedList];
    } else if (!primaryKey) {
      // Si el usuario borró conscientemente el campo de texto
      updatedList = [];
    }
    setStoredApiKeys(updatedList);
    setStoredKeyRotationMode(keyRotationMode);
    onSaveKey(primaryKey);
    onSaveModel(selectedModel);
    setStoredBackgroundModel(selectedBackgroundModel);
    setStoredSafetyLevel(safetyLevel);
    setStoredThinkingLevel(thinkingLevel);
    setStoredTemperature(temperature);
    setStoredTopP(topP);
    setStoredAutoFailover(autoFailover);
    setStoredAutoSyncMemory(autoSyncMemory);
    setStoredMemorySyncGranularity(memorySyncGranularity);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease]"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-[var(--bg-color)] p-5 md:p-6 rounded-xl shadow-2xl border-2 border-[var(--accent)] w-[640px] max-w-full font-lora max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-[var(--glass-border)] shrink-0">
          <div>
            <h3 className="font-cinzel text-lg md:text-xl text-[var(--accent)] font-bold m-0 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Configuración del Motor de IA & DM
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-0.5">
              Control sobre modelos, cuota, sincronización de memoria viva, NSFW y pensamiento
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg cursor-pointer p-1 rounded hover:bg-black/5"
          >
            <X className="w-4 h-4" />{' '}
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[var(--glass-border)] pt-2 pb-2 gap-1.5 shrink-0 overflow-x-auto">
          {[
            { id: 'model', label: 'Modelo' },
            { id: 'sync', label: 'Memoria & Cuota' },
            { id: 'safety', label: 'Filtros & NSFW' },
            { id: 'thinking', label: 'Pensamiento & Temp' },
            { id: 'key', label: 'API Keys' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSettingsTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-cinzel text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeSettingsTab === tab.id
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                  : 'bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-4 text-xs">
          {/* TAB 1: MODEL SELECTION */}
          {activeSettingsTab === 'model' && (
            <div className="space-y-3">
              <div className="bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 p-2.5 rounded-lg flex items-center gap-2 text-emerald-950 dark:text-emerald-200">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>Modelos de Alto Rendimiento:</strong> Compatibles con tu clave de Google AI Studio (tanto capa estándar como cuentas Pro con alta capacidad de cuota y sin límites).
                </span>
              </div>

              <label className="font-cinzel font-bold text-[var(--text-primary)] block">
                Selecciona el Modelo de Narración Principal:
              </label>

              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {AVAILABLE_MODELS.map(m => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--glass)] shadow-xs'
                          : 'border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-cinzel font-bold text-xs md:text-sm text-[var(--accent)] flex items-center gap-2">
                          <input
                            type="radio"
                            name="gemini_model"
                            checked={isSelected}
                            onChange={() => setSelectedModel(m.id)}
                            className="accent-[var(--accent)]"
                          />
                          {m.name}
                        </span>
                        <span className="text-[10px] font-cinzel font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)]">
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] pl-5 m-0 leading-relaxed">
                        {m.desc}
                      </p>
                      {(() => {
                        const u = usoDe(m.id);
                        if (!u) return null;
                        return (
                          <p className="text-[11px] pl-5 m-0 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[var(--accent)] font-cinzel">
                            <span className="flex items-center gap-1">
                              <Gauge className="w-3 h-3" />
                              {u.mediaTotal.toLocaleString('es-ES')} tokens por turno
                            </span>
                            <span className="text-[var(--text-secondary)] font-lora">
                              {u.mediaEntrada.toLocaleString('es-ES')} de entrada ·{' '}
                              {u.mediaSalida.toLocaleString('es-ES')} de respuesta
                            </span>
                            <span className="text-[var(--text-secondary)] font-lora">
                              {u.turnos} {u.turnos === 1 ? 'turno' : 'turnos'} medidos
                            </span>
                            {u.porcentajeCache > 0 && (
                              <span className="text-emerald-700 font-lora">
                                {u.porcentajeCache}% servido de caché
                              </span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* Custom Model input */}
              <div className="bg-[var(--glass)] p-2.5 rounded-lg border border-[var(--glass-border)]">
                <label className="text-[11px] font-cinzel font-bold text-[var(--text-secondary)] block mb-1">
                  <Pencil className="w-3.5 h-3.5" /> O introduce un identificador personalizado para el Narrador:
                </label>
                <input
                  type="text"
                  placeholder="Nombre o ID del modelo personalizado"
                  value={AVAILABLE_MODELS.some(m => m.id === selectedModel) ? '' : selectedModel}
                  onChange={e => {
                    if (e.target.value.trim()) {
                      setSelectedModel(e.target.value.trim());
                    }
                  }}
                  className="w-full bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] border border-[var(--user-border)] p-1.5 rounded font-mono text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>

              {uso.length > 0 && (
                <div className="bg-[var(--glass)] p-2.5 rounded-lg border border-[var(--glass-border)] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-cinzel font-bold text-[11px] text-[var(--text-primary)] flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" /> Lo que gasta cada modelo en TU campaña
                    </span>
                    <button
                      onClick={() => {
                        borrarUso();
                        setUso([]);
                      }}
                      className="text-[10px] font-cinzel text-[var(--text-secondary)] hover:text-red-500 underline cursor-pointer"
                    >
                      Empezar la cuenta de cero
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] m-0">
                    Son los tokens que ha cobrado Google de verdad en cada turno, no una estimación. La
                    entrada es todo lo que se le manda —directivas, documentos, memoria, escena—; la respuesta
                    es lo que escribe. Cambiar de modelo no cambia la entrada, así que las diferencias que
                    veas están en lo largo que escribe cada uno.
                  </p>
                  <div className="flex flex-col gap-1">
                    {uso.map(u => (
                      <div
                        key={u.modelo}
                        className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] border-b border-[var(--glass-border)] last:border-0 pb-1 last:pb-0"
                      >
                        <span className="font-mono">{u.modelo}</span>
                        <span className="text-[var(--text-secondary)]">
                          <strong className="text-[var(--accent)]">
                            {u.mediaTotal.toLocaleString('es-ES')}
                          </strong>{' '}
                          por turno · {u.turnos} {u.turnos === 1 ? 'turno' : 'turnos'}
                          {u.porcentajeCache > 0 ? ` · ${u.porcentajeCache}% de caché` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {esModeloAbierto(selectedModel) && (
                <div className="bg-amber-50/90 border border-amber-300 p-2.5 rounded-lg text-amber-950 text-[11px] leading-relaxed">
                  <strong>Con un Gemma seleccionado:</strong> no admiten los ajustes de la pestaña de Censura
                  ni la lectura de enlaces que pegues, así que la app deja de enviárselos y rige el filtro que
                  traiga Google de fábrica. A cambio consumen una cuota distinta a la de los Gemini, que es
                  justo lo que sirve cuando estos dan error de demanda.
                </div>
              )}

              {/* Lo que de verdad admite la clave, preguntado a Google */}
              <div className="bg-[var(--glass)] p-2.5 rounded-lg border border-[var(--glass-border)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    La lista de arriba está escrita a mano y envejece. Esto pregunta a Google qué admite tu
                    clave hoy.
                  </span>
                  <button
                    onClick={consultarModelos}
                    disabled={consultandoModelos || !hasConfiguredApiKey()}
                    className="shrink-0 flex items-center gap-1.5 rounded border border-[var(--user-border)] px-2.5 py-1 font-cinzel text-[11px] font-bold hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 cursor-pointer"
                  >
                    {consultandoModelos ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    {consultandoModelos ? 'Consultando…' : 'Ver los de mi clave'}
                  </button>
                </div>

                {errorModelos && <p className="text-[11px] text-red-500 m-0">{errorModelos}</p>}

                {modelosDeLaClave && (
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                    {modelosDeLaClave.length === 0 && (
                      <p className="text-[11px] text-[var(--text-secondary)] m-0">
                        La clave no ha devuelto ningún modelo de narración.
                      </p>
                    )}
                    {modelosDeLaClave.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        className={`text-left rounded px-2 py-1 font-mono text-[11px] transition-colors cursor-pointer ${
                          selectedModel === m.id
                            ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                            : 'hover:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]'
                        }`}
                        title={`${m.nombre} · entrada ${m.entrada.toLocaleString('es-ES')} tokens`}
                      >
                        {m.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: MEMORY SYNC & QUOTA OPTIMIZATION */}
          {activeSettingsTab === 'sync' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 p-3 rounded-lg flex items-start gap-2.5 text-emerald-950 dark:text-emerald-200">
                <Brain className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-cinzel font-bold text-xs">
                    Sincronización de Memoria Manual (Cero Gasto Automático)
                  </div>
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-300 m-0 leading-relaxed">
                    La sincronización de la memoria viva (diario, estado, fichas, PNJs, tramas y cronología) funciona exclusivamente a petición manual mediante el botón <strong>«Sincronizar»</strong>. Mientras se ejecuta, se procesa en segundo plano para que puedas seguir roleando sin interrupciones ni bloqueos de pantalla.
                  </p>
                </div>
              </div>

              <div className="bg-[var(--glass)] p-3 rounded-lg border border-[var(--glass-border)] space-y-2">
                <div className="font-cinzel font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" /> Control Total & Máxima Fluidez
                </div>
                <p className="text-xs text-[var(--text-secondary)] m-0 leading-relaxed">
                  No se realizan peticiones ocultas turno a turno. Cuando consideres oportuno consolidar los acontecimientos transcurridos, pulsa el botón <strong>«Sincronizar»</strong> en la barra superior o en cualquiera de las pestañas de Memoria, Estado o Calendario. La IA leerá los chats y actualizará todos los registros.
                </p>
              </div>

              {/* Modelo de Segundo Plano (Background Model) */}
              <div className="pt-3 border-t border-[var(--glass-border)] space-y-2">
                <label className="font-cinzel font-bold text-[var(--text-primary)] block">
                  Modelo Asignado al Pulsar Sincronizar / Extracciones:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      id: 'gemini-2.5-flash',
                      name: 'Gemini 2.5 Flash',
                      desc: 'Equilibrado y muy rápido (Recomendado)'
                    },
                    {
                      id: 'gemini-2.5-flash-lite',
                      name: 'Gemini 2.5 Flash Lite',
                      desc: 'Ultra rápido y consumo mínimo de cuota'
                    },
                    {
                      id: 'gemini-2.0-flash',
                      name: 'Gemini 2.0 Flash',
                      desc: 'Estándar Universal de alta compatibilidad'
                    },
                    {
                      id: 'gemini-3.7-flash',
                      name: 'Gemini 3.7 Flash',
                      desc: 'Híbrido de razonamiento'
                    },
                    {
                      id: 'gemini-2.5-pro',
                      name: 'Gemini 2.5 Pro',
                      desc: 'Máxima precisión deductiva'
                    },
                    {
                      id: 'gemini-1.5-flash',
                      name: 'Gemini 1.5 Flash',
                      desc: 'Clásico compatible'
                    }
                  ].map(bgm => {
                    const isBgSelected = selectedBackgroundModel === bgm.id;
                    return (
                      <div
                        key={bgm.id}
                        onClick={() => setSelectedBackgroundModel(bgm.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isBgSelected
                            ? 'border-[var(--accent)] bg-[var(--glass)] shadow-xs ring-1 ring-[var(--accent)]'
                            : 'border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]'
                        }`}
                      >
                        <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="bg_model"
                            checked={isBgSelected}
                            onChange={() => setSelectedBackgroundModel(bgm.id)}
                            className="accent-[var(--accent)]"
                          />
                          {bgm.name}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] pl-4 m-0 mt-0.5">
                          {bgm.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Auto-Failover against Google Server Overloads */}
              <div className="pt-3 border-t border-[var(--glass-border)]">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <label
                      onClick={() => setAutoFailover(!autoFailover)}
                      className="font-cinzel font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Respaldo Automático ante Saturación (Auto-Failover)
                    </label>
                    <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                      Si los servidores de Google dan error de saturación o límite de tasa (429/503), conmuta instantáneamente al siguiente modelo de respaldo para que la partida nunca se corte.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={autoFailover}
                      onChange={e => setAutoFailover(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
          {activeSettingsTab === 'safety' && (
            <div className="space-y-4">
              <div className="bg-amber-50/90 border border-amber-300 p-3 rounded-lg text-amber-950 flex flex-col gap-1">
                <div className="flex items-center gap-2 font-cinzel font-bold text-xs">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Modo Rol Adulto / 18+ & Dark Fantasy (Sin Censura)</span>
                </div>
                <p className="text-[11px] text-amber-900 m-0 leading-relaxed">
                  Para campañas con combate crudo y realista (heridas, desmembramientos, tácticas letales),
                  intriga política oscura y escenas de romance/intimidad madura al estilo de las novelas de
                  fantasía, selecciona <strong>"Desactivados (BLOCK_NONE)"</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-cinzel font-bold text-[var(--text-primary)] block">
                  <Shield className="w-3.5 h-3.5" /> Nivel de Filtros de Seguridad (Safety Threshold):
                </label>

                {[
                  {
                    id: 'BLOCK_NONE',
                    title: 'Desactivados (BLOCK_NONE) • Recomendado para Rol Adulto',
                    badge: 'Sin Censura',
                    badgeColor: 'bg-red-700',
                    desc: 'Desactiva completamente los filtros de acoso, violencia, odio y contenido sexual en la API. Ideal para partidas maduras, romance y combate visceral.'
                  },
                  {
                    id: 'BLOCK_ONLY_HIGH',
                    title: 'Permisivo (BLOCK_ONLY_HIGH)',
                    badge: 'Permisivo',
                    badgeColor: 'bg-amber-600',
                    desc: 'Bloquea únicamente contenido de extrema gravedad. Permite la gran mayoría de situaciones narrativas oscuras y complejas.'
                  },
                  {
                    id: 'BLOCK_MEDIUM_AND_ABOVE',
                    title: 'Moderado (BLOCK_MEDIUM_AND_ABOVE)',
                    badge: 'Standard',
                    badgeColor: 'bg-blue-600',
                    desc: 'Filtros estándar por defecto de Google AI Studio.'
                  },
                  {
                    id: 'BLOCK_LOW_AND_ABOVE',
                    title: 'Estricto (BLOCK_LOW_AND_ABOVE)',
                    badge: 'Máxima Moderación',
                    badgeColor: 'bg-gray-600',
                    desc: 'Máxima protección y bloqueo preventivo de cualquier alusión a violencia o contenido sensible.'
                  }
                ].map(item => {
                  const isSelected = safetyLevel === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSafetyLevel(item.id as SafetyThreshold)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--glass)] shadow-xs ring-1 ring-[var(--accent)]'
                          : 'border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-2">
                          <input
                            type="radio"
                            name="safety_level"
                            checked={isSelected}
                            onChange={() => setSafetyLevel(item.id as SafetyThreshold)}
                            className="accent-[var(--accent)]"
                          />
                          {item.title}
                        </span>
                        <span
                          className={`text-[10px] font-cinzel font-semibold px-2 py-0.5 rounded-full text-white ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] pl-5 m-0 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--glass)] p-2.5 rounded border border-[var(--glass-border)]">
                ℹ️ Esta configuración se aplica a todas las categorías: <em>Hate Speech</em>,{' '}
                <em>Sexually Explicit</em>, <em>Dangerous Content</em>, <em>Harassment</em> y{' '}
                <em>Civic Integrity</em>.
              </div>
            </div>
          )}

          {/* TAB 3: THINKING LEVEL & TEMPERATURE */}
          {activeSettingsTab === 'thinking' && (
            <div className="space-y-4">
              {/* Thinking Level Section */}
              <div className="space-y-2">
                <label className="font-cinzel font-bold text-[var(--text-primary)] block">
                  <Brain className="w-3.5 h-3.5" /> Nivel de Pensamiento / Razonamiento (Thinking Level):
                </label>
                <p className="text-[11px] text-[var(--text-secondary)] m-0">
                  Controla la profundidad deductiva del modelo (especialmente para Gemini 3.7 Flash y Gemini
                  2.5 Pro) para planificar tácticas de PNJs, deducir misterios y mantener la coherencia
                  cronológica de la campaña.
                </p>

                {[
                  {
                    id: 'MINIMAL',
                    title: '⚡ Sin Pensamiento / Instantáneo (MINIMAL - 0 tokens)',
                    desc: 'Desactiva el razonamiento previo para obtener la mínima latencia y arranque inmediato de respuesta.'
                  },
                  {
                    id: 'LOW',
                    title: 'Pensamiento Rápido (LOW - 1024 tokens)',
                    desc: 'Razonamiento ligero para agilizar combates y mantener diálogos dinámicos.'
                  },
                  {
                    id: 'HIGH',
                    title: 'Pensamiento Profundo (HIGH - 4096 tokens)',
                    desc: 'Máxima introspección y análisis exhaustivo de lore, tácticas de combate y consecuencias antes de escribir.'
                  },
                  {
                    id: 'AUTO',
                    title: 'Automático (Dinámico)',
                    desc: 'El modelo decide automáticamente la cantidad de razonamiento según la complejidad.'
                  }
                ].map(th => {
                  const isSelected = thinkingLevel === th.id;
                  return (
                    <div
                      key={th.id}
                      onClick={() => setThinkingLevel(th.id as ThinkingLevelSetting)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--glass)] shadow-xs ring-1 ring-[var(--accent)]'
                          : 'border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="thinking_level"
                          checked={isSelected}
                          onChange={() => setThinkingLevel(th.id as ThinkingLevelSetting)}
                          className="accent-[var(--accent)]"
                        />
                        <span className="font-cinzel font-bold text-xs text-[var(--accent)]">{th.title}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] pl-5 m-0 mt-0.5 leading-relaxed">
                        {th.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Temperature / Creativity Section */}
              <div className="pt-3 border-t border-[var(--glass-border)] space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-cinzel font-bold text-[var(--text-primary)]">
                    <Dices className="w-3.5 h-3.5" /> Temperatura / Creatividad Narrativa:
                  </label>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--on-accent)]">
                    {temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.05"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-cinzel">
                  <span>0.2 (Rígido/Técnico)</span>
                  <span className="font-bold text-[var(--accent)]">0.70 – 0.85 (Rol Óptimo)</span>
                  <span>1.5 (Impredecible)</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                  Valores entre <strong>0.70 y 0.85</strong> ofrecen el equilibrio idóneo para partidas de rol: riqueza y variedad descriptiva sin perder coherencia con el lore.
                </p>
              </div>

              {/* Top-P Section */}
              <div className="pt-3 border-t border-[var(--glass-border)] space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-cinzel font-bold text-[var(--text-primary)]">
                    <Zap className="w-3.5 h-3.5" /> Top-P (Nucleus Sampling):
                  </label>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--on-accent)]">
                    {topP.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value))}
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-cinzel">
                  <span>0.1 (Vocabulario Estrecho)</span>
                  <span className="font-bold text-[var(--accent)]">0.95 (Recomendado)</span>
                  <span>1.0 (Sin Filtrado)</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                  Configurado en <strong>0.95</strong> para permitir un léxico amplio, metáforas evocadoras y riqueza narrativa sin derivar en incoherencias.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: API KEY & KEY POOL */}
          {activeSettingsTab === 'key' && (
            <div className="space-y-4">
              {/* Clave Principal */}
              <div className="space-y-1.5">
                <label className="font-cinzel font-bold text-[var(--text-primary)] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[var(--accent)]" /> Clave de API Principal (Google AI Studio)
                  </span>
                  {apiKeysList.length > 1 && (
                    <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                      Pool activo: {apiKeysList.length} claves
                    </span>
                  )}
                </label>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    className="w-full bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] border border-[var(--user-border)] p-2.5 pr-20 rounded font-mono text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] shadow-inner"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {keyInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setKeyInput('');
                          setApiKeysList([]);
                        }}
                        className="text-xs font-mono text-stone-400 hover:text-red-500 cursor-pointer px-1.5 py-0.5 rounded bg-black/5"
                        title="Borrar clave por completo"
                      >
                        Borrar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer px-1.5 py-0.5 rounded bg-black/5"
                      title={showKey ? 'Ocultar' : 'Mostrar'}
                    >
                      {showKey ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Pool de Claves de Respaldo / Rotación */}
              <div className="bg-[var(--glass)] p-3.5 rounded-lg border border-[var(--glass-border)] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 font-cinzel font-bold text-xs text-[var(--accent)]">
                    <Layers className="w-3.5 h-3.5" /> Pool de Claves (Rotación Automática Anti-Límite de Cuota)
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] text-[var(--accent)]">
                    {apiKeysList.length} {apiKeysList.length === 1 ? 'clave configurada' : 'claves configuradas'}
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                  Si añades varias claves de Google AI Studio, la app <strong>saltará automáticamente a la siguiente clave</strong> si la actual alcanza el límite de cuota (429 / Resource Exhausted) o rotará entre ellas de forma equitativa.
                </p>

                {/* Feedback banner */}
                {batchFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center justify-between gap-2 animate-[fadeIn_0.2s_ease] ${
                      batchFeedback.isError
                        ? 'bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    }`}
                  >
                    <span className="flex-1 font-semibold">{batchFeedback.text}</span>
                    <button
                      type="button"
                      onClick={() => setBatchFeedback(null)}
                      className="text-xs cursor-pointer p-0.5 hover:opacity-70"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Barra de Acciones Rápidas (Importar TXT / Pegar Varias / Exportar / Vaciar) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={keyFileInputRef}
                    onChange={handleKeyFileSelected}
                    accept=".txt,.json,.csv,.env,text/plain"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => keyFileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] hover:bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--user-border)] rounded font-cinzel font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer hover:border-[var(--accent)]"
                    title="Importar claves desde un archivo .txt, .env o .json"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--accent)]" /> Importar Archivo .TXT
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowBatchBox(!showBatchBox);
                      setBatchFeedback(null);
                    }}
                    className={`px-2.5 py-1.5 rounded font-cinzel font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      showBatchBox
                        ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                        : 'bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] hover:bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--user-border)] hover:border-[var(--accent)]'
                    }`}
                    title="Pegar una lista de múltiples claves a la vez"
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> Pegar Varias a la Vez
                  </button>

                  {apiKeysList.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleExportKeys}
                        className="px-2.5 py-1.5 bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--user-border)] rounded font-cinzel font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="Descargar copia de respaldo en formato .txt"
                      >
                        <Download className="w-3.5 h-3.5" /> Exportar (.txt)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('¿Seguro que deseas vaciar todas las claves de API del pool?')) {
                            setApiKeysList([]);
                            setKeyInput('');
                            setBatchFeedback({ text: 'Pool de claves vaciado.', isError: false });
                          }
                        }}
                        className="px-2 py-1.5 text-stone-400 hover:text-red-500 rounded font-cinzel text-xs flex items-center gap-1 transition-all cursor-pointer ml-auto"
                        title="Vaciar todo el pool"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Vaciar Todo
                      </button>
                    </>
                  )}
                </div>

                {/* Panel desplegable para Pegar Varias Claves a la vez */}
                {showBatchBox && (
                  <div className="bg-[color-mix(in_srgb,var(--surface)_95%,transparent)] p-3 rounded-lg border-2 border-[var(--accent)]/40 space-y-2 animate-[fadeIn_0.15s_ease]">
                    <div className="flex items-center justify-between">
                      <label className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Pega aquí tus claves de API (separadas por saltos de línea, comas o espacios):
                      </label>
                      {batchRawText.trim() && (
                        <span className="text-[11px] font-mono text-[var(--accent)] font-semibold">
                          {parseKeysFromRawText(batchRawText).length} detectadas
                        </span>
                      )}
                    </div>

                    <textarea
                      rows={4}
                      value={batchRawText}
                      onChange={e => setBatchRawText(e.target.value)}
                      placeholder={`AIzaSyA1234567890abcdef...\nAIzaSyB0987654321fedcba...\nAIzaSyC1122334455aabbcc...`}
                      className="w-full bg-[var(--surface)] border border-[var(--user-border)] p-2 rounded font-mono text-xs outline-none focus:border-[var(--accent)] shadow-inner text-[var(--text-primary)] leading-relaxed resize-y"
                    />

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        * Admite formato .env, JSON o texto plano pegado directamente de Google AI Studio.
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowBatchBox(false);
                            setBatchRawText('');
                          }}
                          className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleImportBatchKeys(batchRawText)}
                          disabled={!batchRawText.trim()}
                          className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded font-cinzel font-bold text-xs hover:bg-[var(--accent-hover)] disabled:opacity-40 cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Añadir al Pool ({parseKeysFromRawText(batchRawText).length || 0})
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Input para añadir una clave individual */}
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="O añade una clave suelta (AIzaSy...)"
                    value={newKeyInput}
                    onChange={e => setNewKeyInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newKeyInput.trim()) {
                        e.preventDefault();
                        const val = newKeyInput.trim();
                        if (!apiKeysList.includes(val)) {
                          const updated = [...apiKeysList, val];
                          setApiKeysList(updated);
                          setNewKeyInput('');
                          if (!keyInput.trim()) setKeyInput(val);
                        }
                      }
                    }}
                    className="flex-1 bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] border border-[var(--user-border)] px-2.5 py-1.5 rounded font-mono text-xs outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = newKeyInput.trim();
                      if (val && !apiKeysList.includes(val)) {
                        const updated = [...apiKeysList, val];
                        setApiKeysList(updated);
                        setNewKeyInput('');
                        if (!keyInput.trim()) setKeyInput(val);
                      }
                    }}
                    disabled={!newKeyInput.trim()}
                    className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded font-cinzel font-bold text-xs flex items-center gap-1 hover:bg-[var(--accent-hover)] disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Añadir
                  </button>
                </div>

                {/* Lista de claves configuradas en el Pool */}
                {apiKeysList.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {apiKeysList.map((k, idx) => {
                      const isMain = idx === 0;
                      const masked = k.length > 10 ? `${k.slice(0, 7)}••••••••${k.slice(-4)}` : '••••••••';
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded border text-xs ${
                            isMain
                              ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                              : 'border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-mono">
                            <span className="w-4 h-4 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span className="font-semibold">{masked}</span>
                            {isMain && (
                              <span className="text-[10px] font-cinzel font-bold text-[var(--accent)] bg-[var(--accent)]/15 px-1.5 py-0.2 rounded">
                                Principal
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {!isMain && (
                              <button
                                type="button"
                                onClick={() => {
                                  const rest = apiKeysList.filter((_, i) => i !== idx);
                                  const reordered = [k, ...rest];
                                  setApiKeysList(reordered);
                                  setKeyInput(k);
                                }}
                                className="text-[10px] font-cinzel text-[var(--accent)] hover:underline cursor-pointer px-1.5 py-0.5"
                                title="Hacer clave principal"
                              >
                                Poner de 1ª
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = apiKeysList.filter((_, i) => i !== idx);
                                setApiKeysList(updated);
                                if (isMain) {
                                  setKeyInput(updated[0] || '');
                                }
                              }}
                              className="text-stone-400 hover:text-red-500 p-1 rounded hover:bg-black/5 cursor-pointer"
                              title="Eliminar del pool"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selector de Modo de Rotación de Claves */}
                <div className="pt-2 border-t border-[var(--glass-border)] space-y-2">
                  <label className="font-cinzel font-bold text-[var(--text-primary)] block">
                    Modo de Rotación del Pool de Claves:
                  </label>

                  {[
                    {
                      id: 'round_robin',
                      title: '⚡ Rotación Activa Turno a Turno (Round-Robin) — Recomendado',
                      badge: 'Reparto Equitativo',
                      badgeColor: 'bg-emerald-700',
                      desc: 'Distribuye equitativamente cada turno de narración y cada sincronización en segundo plano entre las claves del pool (1ª, 2ª, 3ª...). Evita límites de peticiones por minuto (RPM) y multiplica la cuota de la IA.'
                    },
                    {
                      id: 'failover_only',
                      title: '🛡️ Respaldo por Saturación (Failover únicamente)',
                      badge: 'Pasivo',
                      badgeColor: 'bg-stone-600',
                      desc: 'Usa siempre la primera clave y solo salta a la siguiente si la actual agota su cuota o devuelve error 429 (Resource Exhausted).'
                    }
                  ].map(mode => {
                    const isSelected = keyRotationMode === mode.id;
                    return (
                      <div
                        key={mode.id}
                        onClick={() => setKeyRotationMode(mode.id as KeyRotationMode)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--glass)] shadow-xs ring-1 ring-[var(--accent)]'
                            : 'border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-2">
                            <input
                              type="radio"
                              name="key_rotation_mode"
                              checked={isSelected}
                              onChange={() => setKeyRotationMode(mode.id as KeyRotationMode)}
                              className="accent-[var(--accent)]"
                            />
                            {mode.title}
                          </span>
                          <span
                            className={`text-[9px] font-cinzel font-semibold px-2 py-0.5 rounded-full text-white ${mode.badgeColor}`}
                          >
                            {mode.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] pl-5 m-0 leading-relaxed">
                          {mode.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guía para conseguir clave */}
              <div className="text-xs text-[var(--text-secondary)] bg-[var(--glass)] p-3 rounded border border-[var(--glass-border)] flex flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent)]">
                  <Lightbulb className="w-3.5 h-3.5" />
                  ¿Cómo obtener claves gratuitas?
                </span>
                <span>
                  1. Entra en{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] font-bold underline hover:text-[var(--accent-hover)]"
                  >
                    Google AI Studio (Get API Key)
                  </a>
                </span>
                <span>
                  2. Pulsa en <em>"Create API key"</em> y copia la clave generada.
                </span>
                <span>
                  3. Puedes crear claves en distintos proyectos de Google Cloud para multiplicar tu cuota diaria gratuita.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Success Alert */}
        {savedSuccess && (
          <div className="my-2 text-center text-xs font-bold text-green-800 bg-green-100 py-1.5 rounded border border-green-300 shrink-0 animate-[fadeIn_0.2s_ease]">
            <Check className="w-3.5 h-3.5" /> Configuración de motor de IA, filtros NSFW y parámetros
            guardados con éxito.
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-[var(--glass-border)] shrink-0">
          <div className="text-[11px] text-[var(--text-secondary)]">
            Filtros:{' '}
            <strong className="text-[var(--accent)]">
              {safetyLevel === 'BLOCK_NONE' ? 'Sin Censura' : safetyLevel}
            </strong>{' '}
            | Pensamiento: <strong className="text-[var(--accent)]">{thinkingLevel}</strong>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-cinzel text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold rounded-lg hover:bg-[var(--accent-hover)] transition-all shadow-sm cursor-pointer"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Modals: React.FC<{
  promptConfig: PromptConfig | null;
  setPromptConfig: (c: PromptConfig | null) => void;
  confirmConfig: ConfirmConfig | null;
  setConfirmConfig: (c: ConfirmConfig | null) => void;
  alertConfig: AlertConfig | null;
  setAlertConfig: (c: AlertConfig | null) => void;
  promptValue: string;
  setPromptValue: (val: string) => void;
}> = ({
  promptConfig,
  setPromptConfig,
  confirmConfig,
  setConfirmConfig,
  alertConfig,
  setAlertConfig,
  promptValue,
  setPromptValue
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (alertConfig?.isOpen) {
          setAlertConfig(null);
        } else if (confirmConfig?.isOpen) {
          confirmConfig.onCancel?.();
          setConfirmConfig(null);
        } else if (promptConfig?.isOpen) {
          setPromptConfig(null);
        }
      }
    };
    if (promptConfig?.isOpen || confirmConfig?.isOpen || alertConfig?.isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [promptConfig, confirmConfig, alertConfig, setPromptConfig, setConfirmConfig, setAlertConfig]);

  return (
    <>
      {promptConfig?.isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-[fadeIn_0.15s_ease]"
          onClick={e => {
            if (e.target === e.currentTarget) setPromptConfig(null);
          }}
        >
          <div className="bg-[var(--bg-color)] p-6 rounded-xl shadow-2xl border border-[var(--glass-border)] w-96 max-w-full">
            <h3 className="font-cinzel text-xl text-[var(--accent)] mb-4">{promptConfig.title}</h3>
            <input
              type="text"
              value={promptValue}
              onChange={e => setPromptValue(e.target.value)}
              className="w-full bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] border border-[var(--user-border)] p-2 rounded mb-4 font-lora outline-none focus:border-[var(--accent)]"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  promptConfig.onConfirm(promptValue);
                  setPromptConfig(null);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPromptConfig(null)}
                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-xs font-cinzel font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  promptConfig.onConfirm(promptValue);
                  setPromptConfig(null);
                }}
                className="px-4 py-2 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer text-xs font-cinzel font-bold shadow-xs"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmConfig?.isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-[fadeIn_0.15s_ease]"
          onClick={e => {
            if (e.target === e.currentTarget) {
              confirmConfig.onCancel?.();
              setConfirmConfig(null);
            }
          }}
        >
          <div className="bg-[var(--bg-color)] p-6 rounded-xl shadow-2xl border border-[var(--glass-border)] w-96 max-w-full">
            <h3 className="font-cinzel text-xl text-[var(--accent)] mb-3">Confirmar acción</h3>
            <p className="text-[var(--text-primary)] mb-6 font-lora text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
              {confirmConfig.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  confirmConfig.onCancel?.();
                  setConfirmConfig(null);
                }}
                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-xs font-cinzel font-bold"
              >
                {confirmConfig.cancelLabel || 'Cancelar'}
              </button>
              <button
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                className={`px-4 py-2 rounded-lg transition-colors cursor-pointer text-xs font-cinzel font-bold shadow-xs ${
                  confirmConfig.danger === false
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]'
                    : 'bg-red-700 text-white hover:bg-red-800'
                }`}
              >
                {confirmConfig.confirmLabel || 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertConfig?.isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-[fadeIn_0.15s_ease]"
          onClick={e => {
            if (e.target === e.currentTarget) setAlertConfig(null);
          }}
        >
          <div className="bg-[var(--bg-color)] p-6 rounded-xl shadow-2xl border border-[var(--glass-border)] w-96 max-w-full">
            <h3 className="font-cinzel text-xl text-[var(--accent)] mb-3">{alertConfig.title}</h3>
            <p className="text-[var(--text-primary)] mb-6 font-lora text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
              {alertConfig.message}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setAlertConfig(null)}
                className="px-5 py-2 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer text-xs font-cinzel font-bold shadow-xs"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
