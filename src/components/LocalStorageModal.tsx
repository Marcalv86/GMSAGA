import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  FolderOpen,
  CheckCircle2,
  X,
  Database,
  Trash2,
  FileJson,
  ShieldCheck,
  RefreshCw,
  FolderSync
} from 'lucide-react';
import { Project, Chat, ProjectFile } from '../types';
import {
  isDiskBackupSupported,
  isRunningInIframe,
  chooseBackupFolder,
  forgetBackupFolder,
  getBackupFolderName,
  checkBackupPermission,
  writeCampaignToDisk,
  listCampaignFilesFromDisk,
  DiskCampaignFile
} from '../utils/diskBackup';
import {
  requestPersistentStorage,
  getStorageEstimate
} from '../utils/fileStorage';
import {
  getStoredApiKeys,
  getStoredKeyRotationMode,
  getStoredModel,
  getStoredBackgroundModel,
  getStoredSafetyLevel,
  getStoredThinkingLevel,
  getStoredTemperature,
  getStoredTopP,
  getStoredAutoFailover,
  getStoredMemorySyncGranularity
} from '../utils/geminiHelper';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface LocalStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentProject: Project | null;
  currentChats: Chat[];
  currentFiles: ProjectFile[];
  onImportCampaign: (file: File) => Promise<void>;
  onExportCurrentProject: () => void;
  onOpenImportModal?: () => void;
}

export const LocalStorageModal: React.FC<LocalStorageModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentProject,
  currentChats,
  currentFiles,
  onImportCampaign,
  onExportCurrentProject,
  onOpenImportModal
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'disk' | 'storage'>('backup');
  const [backupFolder, setBackupFolder] = useState<string | null>(null);
  const [backupNeedsPermission, setBackupNeedsPermission] = useState(false);
  const [isChoosingFolder, setIsChoosingFolder] = useState(false);
  const [folderSuccessMsg, setFolderSuccessMsg] = useState<string | null>(null);
  const [folderErrorMsg, setFolderErrorMsg] = useState<string | null>(null);
  const [isPersistedStorage, setIsPersistedStorage] = useState(false);
  const [storageStats, setStorageStats] = useState<{ usageMB: string; quotaMB: string; percent: number } | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Archivos de partida encontrados en la carpeta activa de disco
  const [diskFiles, setDiskFiles] = useState<DiskCampaignFile[]>([]);
  const [isLoadingDiskFiles, setIsLoadingDiskFiles] = useState(false);
  const [diskFilesPermissionNeeded, setDiskFilesPermissionNeeded] = useState(false);
  const [importingFileName, setImportingFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDiskFiles = useCallback(async () => {
    if (!isDiskBackupSupported()) return;
    setIsLoadingDiskFiles(true);
    try {
      const res = await listCampaignFilesFromDisk();
      if (res.ok) {
        setDiskFiles(res.files);
        setDiskFilesPermissionNeeded(false);
      } else if (res.permissionNeeded) {
        setDiskFilesPermissionNeeded(true);
      }
    } catch (err) {
      console.warn('Error listando archivos de disco:', err);
    } finally {
      setIsLoadingDiskFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Check backup folder
    (async () => {
      const name = await getBackupFolderName();
      setBackupFolder(name);
      if (name) {
        const state = await checkBackupPermission(false);
        const needsPerm = state !== 'granted';
        setBackupNeedsPermission(needsPerm);
        if (!needsPerm) {
          void fetchDiskFiles();
        }
      }
    })();

    // Check storage estimate & persistence
    (async () => {
      const { persisted } = await requestPersistentStorage();
      setIsPersistedStorage(persisted);
      const estimate = await getStorageEstimate();
      if (estimate && estimate.quota > 0) {
        const usageMB = (estimate.usage / (1024 * 1024)).toFixed(1);
        const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
        const percent = Math.min(100, Math.round((estimate.usage / estimate.quota) * 100));
        setStorageStats({ usageMB, quotaMB, percent });
      }
    })();
  }, [isOpen, fetchDiskFiles]);

  const handleChooseFolder = async () => {
    setIsChoosingFolder(true);
    setFolderErrorMsg(null);
    setFolderSuccessMsg(null);
    try {
      const res = await chooseBackupFolder();
      if (res.ok && res.name) {
        setBackupFolder(res.name);
        setBackupNeedsPermission(false);
        if (currentProject) {
          await writeCampaignToDisk(currentProject, currentChats, currentFiles);
        }
        setFolderSuccessMsg(`Copia en disco activada en la carpeta: "${res.name}".`);
        setTimeout(() => setFolderSuccessMsg(null), 5000);
        void fetchDiskFiles();
      } else if (res.error) {
        setFolderErrorMsg(res.error);
      }
    } catch (err: any) {
      setFolderErrorMsg(err?.message || 'No se pudo seleccionar la carpeta.');
    } finally {
      setIsChoosingFolder(false);
    }
  };

  const handleGrantPermission = async () => {
    const state = await checkBackupPermission(true);
    setBackupNeedsPermission(state !== 'granted');
    if (state === 'granted') {
      if (currentProject) {
        await writeCampaignToDisk(currentProject, currentChats, currentFiles);
      }
      setFolderSuccessMsg('Permiso reactivado y sincronizado.');
      setTimeout(() => setFolderSuccessMsg(null), 4000);
      void fetchDiskFiles();
    }
  };

  const handleForgetFolder = async () => {
    await forgetBackupFolder();
    setBackupFolder(null);
    setBackupNeedsPermission(false);
    setDiskFiles([]);
  };

  const handleImportDiskFile = async (diskFile: DiskCampaignFile) => {
    setImportingFileName(diskFile.name);
    setFolderErrorMsg(null);
    try {
      const file = await diskFile.getFile();
      await onImportCampaign(file);
      setSuccessNotice(`Campaña "${diskFile.name}" importada y cargada.`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: any) {
      console.error('Error importando archivo de disco:', err);
      setFolderErrorMsg(err?.message || `Error al importar "${diskFile.name}".`);
    } finally {
      setImportingFileName(null);
    }
  };


  const handleExportAll = () => {
    setIsExportingAll(true);
    try {
      const apiKeys = getStoredApiKeys();
      const backupData = {
        version: 'gmstudio_v2',
        exportedAt: new Date().toISOString(),
        totalCampaigns: projects.length,
        projects: projects,
        apiKeys: apiKeys.length > 0 ? apiKeys : undefined,
        keyRotationMode: getStoredKeyRotationMode(),
        settings: {
          model: getStoredModel(),
          backgroundModel: getStoredBackgroundModel(),
          safetyLevel: getStoredSafetyLevel(),
          thinkingLevel: getStoredThinkingLevel(),
          temperature: getStoredTemperature(),
          topP: getStoredTopP(),
          autoFailover: getStoredAutoFailover(),
          memorySyncGranularity: getStoredMemorySyncGranularity()
        }
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GMStudio_CopiaCompleta_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessNotice('Copia completa de todas tus campañas y configuración descargada con éxito.');
      setTimeout(() => setSuccessNotice(null), 5000);
    } finally {
      setIsExportingAll(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onImportCampaign(file);
      setSuccessNotice(`Archivo "${file.name}" importado correctamente.`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: any) {
      console.error('Error importando:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-[var(--bg-color)] border border-[var(--glass-border)] w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-[fadeIn_0.2s_ease]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--glass)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel font-bold text-base md:text-lg text-[var(--accent)] m-0">
                Almacenamiento y Copias Locales
              </h3>
              <p className="text-xs text-[var(--text-secondary)] m-0 font-lora">
                100% privado en tu navegador, sin registros ni servidores externos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="flex border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] px-4 pt-2 gap-2 text-xs font-cinzel font-bold">
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'backup'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Copias JSON</span>
          </button>
          <button
            onClick={() => setActiveTab('disk')}
            className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'disk'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Auto-Guardado en Disco</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'storage'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Estado del Almacén</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {successNotice && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 p-3 rounded-lg flex items-center gap-2 animate-[fadeIn_0.2s_ease]">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* TAB 1: BACKUP & RESTORE JSON */}
          {activeTab === 'backup' && (
            <div className="space-y-4 font-lora">
              <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-lg text-[var(--text-primary)] space-y-1.5">
                <div className="flex items-center gap-2 font-cinzel font-bold text-xs text-amber-800 dark:text-amber-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Máxima privacidad y control total de tus partidas</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">
                  Tus partidas, diarios, personajes, mapas y <strong>claves API de Google AI Studio / rotación</strong> se guardan de forma instantánea en tu navegador. Al descargar tus copias JSON o activar el guardado en disco, tus claves y preferencias de IA van incluidas para que no tengas que volver a escribirlas al restaurar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Export Current Project */}
                <div className="border border-[var(--glass-border)] bg-[var(--glass)] p-3.5 rounded-lg flex flex-col justify-between gap-3">
                  <div>
                    <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5 mb-1">
                      <Download className="w-4 h-4" />
                      <span>Guardar Tomo Activo</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                      Descarga el tomo actual con todos sus capítulos, oráculos, notas y memoria.
                    </p>
                  </div>
                  <button
                    onClick={onExportCurrentProject}
                    disabled={!currentProject}
                    className="w-full py-2 px-3 rounded font-cinzel font-bold text-xs bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar {currentProject ? `«${currentProject.name}»` : 'Tomo'}</span>
                  </button>
                </div>

                {/* Export All Campaigns */}
                <div className="border border-[var(--glass-border)] bg-[var(--glass)] p-3.5 rounded-lg flex flex-col justify-between gap-3">
                  <div>
                    <div className="font-cinzel font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
                      <Database className="w-4 h-4" />
                      <span>Copia Global ({projects.length} Tomos)</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                      Descarga un único archivo con absolutamente todas las campañas y contenidos.
                    </p>
                  </div>
                  <button
                    onClick={handleExportAll}
                    disabled={projects.length === 0 || isExportingAll}
                    className="w-full py-2 px-3 rounded font-cinzel font-bold text-xs bg-emerald-700 hover:bg-emerald-800 text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Todo el Almacén</span>
                  </button>
                </div>
              </div>

              {/* Import Section */}
              <div className="border border-[var(--glass-border)] bg-[var(--glass)] p-3.5 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    <span>Importar Campaña o Datos Externos</span>
                  </div>
                </div>

                {/* Si hay una carpeta activa con archivos en disco, acceso directo de importación */}
                {backupFolder && diskFiles.length > 0 && (
                  <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-cinzel font-bold text-xs text-sky-900 dark:text-sky-300 flex items-center gap-1.5 truncate">
                        <FolderSync className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Partidas en carpeta activa: <strong>{backupFolder}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('disk')}
                        className="text-[11px] text-[var(--accent)] font-cinzel font-bold hover:underline shrink-0 ml-2 cursor-pointer"
                      >
                        Ver todas ({diskFiles.length})
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {diskFiles.map(df => (
                        <div
                          key={df.name}
                          className="flex items-center justify-between gap-2 p-2 rounded bg-[var(--surface)] text-xs border border-[var(--glass-border)] hover:border-[var(--accent)]/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[var(--text-primary)] truncate text-[11px]">
                              {df.name}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)]">
                              {formatFileSize(df.size)} · {new Date(df.lastModified).toLocaleDateString('es-ES')}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleImportDiskFile(df)}
                            disabled={importingFileName !== null}
                            className="px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-cinzel text-[10px] font-bold shrink-0 cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1 disabled:opacity-50"
                          >
                            {importingFileName === df.name ? (
                              <>
                                <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Cargando...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-2.5 h-2.5" />
                                <span>Cargar</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {onOpenImportModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenImportModal();
                    }}
                    className="w-full py-2.5 px-3 rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] border border-[var(--accent)]/50 hover:bg-[color-mix(in_srgb,var(--accent)_20%,var(--surface))] text-[var(--accent)] font-cinzel font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
                  >
                    <FolderSync className="w-4 h-4" />
                    <span>Importar de Gemini, NotebookLM o PDF (Recomendado)</span>
                  </button>
                )}

                <div className="pt-1 border-t border-[var(--user-border)]/40">
                  <p className="text-[11px] text-[var(--text-secondary)] m-0 mb-1.5 leading-relaxed">
                    O restaura un archivo <code>.JSON</code> nativo exportado previamente desde GM Studio:
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,.gmstudio.json,application/json,text/json,text/plain,*/*"
                    onChange={handleFileSelected}
                    className="hidden"
                    id="local-storage-file-input"
                  />
                  <label
                    htmlFor="local-storage-file-input"
                    className="w-full py-2 px-3 rounded border border-dashed border-[var(--user-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] font-cinzel font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors block text-center"
                  >
                    <Upload className="w-3.5 h-3.5 inline mr-1" />
                    <span>Seleccionar archivo .JSON nativo</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DISK AUTO-BACKUP */}
          {activeTab === 'disk' && (
            <div className="space-y-4 font-lora">
              <div className="bg-sky-500/10 border border-sky-500/20 p-3.5 rounded-lg space-y-1.5">
                <div className="font-cinzel font-bold text-xs text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4" />
                  <span>Copia en Carpeta de tu Ordenador</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">
                  Si juegas en Chrome, Edge o navegadores compatibles con File System, puedes elegir una carpeta local en tu disco. Cada vez que el Narrador termine un turno, la campaña se guardará como archivo <code>.json</code> en esa carpeta de forma transparente.
                </p>
                <p className="text-[11px] text-sky-700 dark:text-sky-400 font-semibold m-0 pt-0.5">
                  💡 Truco: Si seleccionas una carpeta de Google Drive, OneDrive o Dropbox en tu ordenador, tendrás sincronización automática entre dispositivos sin configurar ninguna API.
                </p>
              </div>

              {folderSuccessMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 p-2.5 rounded text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>{folderSuccessMsg}</span>
                </div>
              )}

              {folderErrorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-300 p-2.5 rounded text-xs flex items-start gap-2">
                  <X className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <span>{folderErrorMsg}</span>
                  </div>
                </div>
              )}

              {isRunningInIframe() && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1.5 text-amber-900 dark:text-amber-300">
                  <div className="font-cinzel font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Aviso de marco embebido (iFrame)</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                    Las políticas de seguridad del navegador impiden que ventanas embebidas o vistas previas accedan directamente a las carpetas locales de tu ordenador. Para respaldar tu campaña aquí, usa la pestaña <strong>Copias JSON</strong> (Descargar Tomo) o abre la aplicación en una pestaña propia de tu navegador.
                  </p>
                </div>
              )}

              {isDiskBackupSupported() ? (
                <div className="border border-[var(--glass-border)] bg-[var(--glass)] p-4 rounded-lg space-y-3">
                  {!backupFolder ? (
                    <div className="text-center py-3 space-y-2">
                      <p className="text-xs text-[var(--text-secondary)] m-0">
                        No hay ninguna carpeta de disco seleccionada actualmente.
                      </p>
                      <button
                        onClick={handleChooseFolder}
                        disabled={isChoosingFolder}
                        className="py-2 px-4 rounded font-cinzel font-bold text-xs bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Elegir Carpeta de Guardado</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] border border-[var(--glass-border)]">
                        <div className="flex items-center gap-2 min-w-0">
                          <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-cinzel font-bold text-xs text-[var(--accent)] block truncate">
                              {backupFolder}
                            </span>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                              Activa · Se actualiza tras cada turno
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleForgetFolder}
                            className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer shrink-0"
                            title="Desvincular esta carpeta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {backupNeedsPermission && (
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded flex items-center justify-between gap-2">
                          <span className="text-[11px] text-amber-900 dark:text-amber-300">
                            El navegador requiere confirmar el permiso de acceso para sincronizar.
                          </span>
                          <button
                            onClick={handleGrantPermission}
                            className="py-1 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-cinzel font-bold cursor-pointer shrink-0"
                          >
                            Reactivar
                          </button>
                        </div>
                      )}

                      {/* Lista de Partidas en la Carpeta Activa con botón de Importación directa */}
                      <div className="p-3 rounded-lg border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FolderSync className="w-3.5 h-3.5 text-[var(--accent)]" />
                            <span className="font-cinzel font-bold text-xs text-[var(--accent)]">
                              Partidas en esta Carpeta ({diskFiles.length})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={fetchDiskFiles}
                            disabled={isLoadingDiskFiles}
                            className="text-[11px] font-cinzel text-[var(--text-secondary)] hover:text-[var(--accent)] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Actualizar lista de archivos"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingDiskFiles ? 'animate-spin' : ''}`} />
                            <span>Actualizar</span>
                          </button>
                        </div>

                        {diskFilesPermissionNeeded ? (
                          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded flex items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-900 dark:text-amber-300">
                              Pulsa para autorizar la lectura de los archivos de esta carpeta.
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await handleGrantPermission();
                                await fetchDiskFiles();
                              }}
                              className="py-1 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-cinzel font-bold cursor-pointer shrink-0"
                            >
                              Autorizar
                            </button>
                          </div>
                        ) : isLoadingDiskFiles ? (
                          <div className="py-3 text-center text-[11px] text-[var(--text-secondary)] italic flex items-center justify-center gap-1.5">
                            <span className="inline-block w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                            <span>Explorando carpeta...</span>
                          </div>
                        ) : diskFiles.length === 0 ? (
                          <p className="text-[11px] text-[var(--text-secondary)] italic m-0 py-1">
                            No se han detectado archivos <code>.json</code> de partidas en esta carpeta todavía. Se guardará uno aquí al jugar un turno.
                          </p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {diskFiles.map(df => (
                              <div
                                key={df.name}
                                className="p-2.5 rounded border border-[var(--glass-border)] bg-[var(--surface)] flex items-center justify-between gap-2 hover:border-[var(--accent)]/40 transition-colors"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <FileJson className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                                    <span className="font-semibold text-xs text-[var(--text-primary)] truncate block">
                                      {df.name}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 flex gap-2">
                                    <span>{formatFileSize(df.size)}</span>
                                    <span>•</span>
                                    <span>
                                      {new Date(df.lastModified).toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleImportDiskFile(df)}
                                  disabled={importingFileName !== null}
                                  className="py-1.5 px-3 rounded bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 font-cinzel font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0 transition-opacity disabled:opacity-50 shadow-xs"
                                >
                                  {importingFileName === df.name ? (
                                    <>
                                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Importando...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3 h-3" />
                                      <span>Importar Tomo</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={handleChooseFolder}
                          className="text-xs text-[var(--accent)] hover:underline font-cinzel inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Cambiar a otra carpeta</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-stone-100 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-700 rounded text-[11px] text-[var(--text-secondary)]">
                  Tu navegador actual no admite la API File System nativa. Puedes usar los botones de <strong>Copias JSON</strong> para descargar tus partidas en cualquier momento.
                </div>
              )}
            </div>
          )}


          {/* TAB 3: STORAGE STATUS */}
          {activeTab === 'storage' && (
            <div className="space-y-4 font-lora">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]">
                  <span className="text-[11px] font-cinzel text-[var(--text-secondary)] block mb-1">
                    Tomos Guardados
                  </span>
                  <span className="font-cinzel font-bold text-lg text-[var(--accent)]">
                    {projects.length}
                  </span>
                </div>
                <div className="p-3.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]">
                  <span className="text-[11px] font-cinzel text-[var(--text-secondary)] block mb-1">
                    Almacén Persistente
                  </span>
                  <span className={`font-cinzel font-bold text-xs flex items-center gap-1.5 ${isPersistedStorage ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                    <ShieldCheck className="w-4 h-4" />
                    {isPersistedStorage ? 'Protegido' : 'Estándar'}
                  </span>
                </div>
              </div>

              {storageStats && (
                <div className="border border-[var(--glass-border)] bg-[var(--glass)] p-3.5 rounded-lg space-y-2">
                  <div className="flex justify-between text-xs font-cinzel">
                    <span className="text-[var(--text-secondary)]">Uso de Almacenamiento Local</span>
                    <span className="font-bold text-[var(--accent)]">{storageStats.usageMB} MB usados</span>
                  </div>
                  <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[var(--accent)] h-full transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(2, storageStats.percent)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] m-0">
                    Capacidad asignada por el navegador: ~{storageStats.quotaMB} MB
                  </p>
                </div>
              )}

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs space-y-1">
                <div className="font-cinzel font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sin conexión ni dependencias externas</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                  Todo tu contenido funciona 100% offline. No necesitas mantener cuentas de Firebase ni permisos de Google Workspace. Tus partidas son tuyas y quedan archivadas en tu propio dispositivo.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--glass)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded font-cinzel font-bold text-xs bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
