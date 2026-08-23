import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Download,
  FolderOpen,
  CheckCircle2,
  X,
  Database,
  Trash2,
  FileJson,
  ShieldCheck,
  RefreshCw,
  FolderSync,
  Upload,
  AlertTriangle,
  Save
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
  deleteCampaignFileFromDisk,
  getCampaignFileName,
  DiskCampaignFile
} from '../utils/diskBackup';
import {
  requestPersistentStorage,
  getStorageEstimate
} from '../utils/fileStorage';

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
  onExportCurrentProject?: () => void;
  onImportCampaignFile?: (file: File) => Promise<void> | void;
}

export const LocalStorageModal: React.FC<LocalStorageModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentProject,
  currentChats,
  currentFiles,
  onExportCurrentProject,
  onImportCampaignFile
}) => {
  const [activeTab, setActiveTab] = useState<'disk' | 'export' | 'storage'>('disk');
  const [backupFolder, setBackupFolder] = useState<string | null>(null);
  const [backupNeedsPermission, setBackupNeedsPermission] = useState(false);
  const [isChoosingFolder, setIsChoosingFolder] = useState(false);
  const [folderSuccessMsg, setFolderSuccessMsg] = useState<string | null>(null);
  const [folderErrorMsg, setFolderErrorMsg] = useState<string | null>(null);
  const [isPersistedStorage, setIsPersistedStorage] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [fileToConfirmDelete, setFileToConfirmDelete] = useState<string | null>(null);
  const [fileToConfirmRestore, setFileToConfirmRestore] = useState<DiskCampaignFile | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [isOverwritingFile, setIsOverwritingFile] = useState<string | null>(null);

  const handleManualSaveToDisk = async (customTargetFileName?: string) => {
    if (!currentProject) {
      setFolderErrorMsg('No hay ninguna campaña activa para guardar.');
      return;
    }
    setIsSavingManual(true);
    setFolderErrorMsg(null);
    setFolderSuccessMsg(null);
    try {
      if (!backupFolder) {
        // Si aún no ha seleccionado carpeta, abrimos el selector primero
        const res = await chooseBackupFolder();
        if (!res.ok || !res.name) {
          if (res.error) setFolderErrorMsg(res.error);
          return;
        }
        setBackupFolder(res.name);
        setBackupNeedsPermission(false);
      }

      const saveRes = await writeCampaignToDisk(currentProject, currentChats, currentFiles, customTargetFileName);
      if (saveRes.written) {
        setFolderSuccessMsg(`¡Campaña guardada con éxito como «${saveRes.fileName || customTargetFileName || getCampaignFileName(currentProject.name)}»!`);
        setTimeout(() => setFolderSuccessMsg(null), 5000);
        void fetchDiskFiles();
      } else if (saveRes.reason === 'no-permission') {
        setBackupNeedsPermission(true);
        setFolderErrorMsg('El navegador requiere autorizar el permiso de escritura en la carpeta.');
      } else {
        setFolderErrorMsg('No se pudo guardar la campaña en la carpeta.');
      }
    } catch (err: any) {
      setFolderErrorMsg(err?.message || 'Error al guardar en carpeta.');
    } finally {
      setIsSavingManual(false);
      setIsOverwritingFile(null);
    }
  };

  const handleDeleteDiskFile = async (fileName: string) => {
    setIsDeletingFile(true);
    setFolderErrorMsg(null);
    setFolderSuccessMsg(null);
    try {
      const res = await deleteCampaignFileFromDisk(fileName);
      if (res.ok) {
        setFolderSuccessMsg(`Archivo «${fileName}» eliminado correctamente de tu carpeta.`);
        setTimeout(() => setFolderSuccessMsg(null), 4000);
        setFileToConfirmDelete(null);
        void fetchDiskFiles();
      } else {
        setFolderErrorMsg(res.error || 'No se pudo eliminar el archivo.');
      }
    } catch (err: any) {
      setFolderErrorMsg(err?.message || 'Error al eliminar el archivo.');
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleRestoreDiskFile = async (diskFile: DiskCampaignFile) => {
    if (!onImportCampaignFile) {
      setFolderErrorMsg('Función de importación no disponible.');
      return;
    }
    setFolderErrorMsg(null);
    try {
      const file = await diskFile.getFile();
      await onImportCampaignFile(file);
      setFolderSuccessMsg(`¡Campaña «${diskFile.name}» cargada y restaurada con éxito!`);
      setFileToConfirmRestore(null);
      setTimeout(() => {
        setFolderSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setFolderErrorMsg(err?.message || 'Error al restaurar el archivo de partida.');
    }
  };
  const [storageStats, setStorageStats] = useState<{ usageMB: string; quotaMB: string; percent: number } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Archivos de partida encontrados en la carpeta activa de disco
  const [diskFiles, setDiskFiles] = useState<DiskCampaignFile[]>([]);
  const [isLoadingDiskFiles, setIsLoadingDiskFiles] = useState(false);
  const [diskFilesPermissionNeeded, setDiskFilesPermissionNeeded] = useState(false);

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
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel font-bold text-base md:text-lg text-[var(--accent)] m-0">
                Copias de Seguridad y Almacenamiento
              </h3>
              <p className="text-xs text-[var(--text-secondary)] m-0 font-lora">
                100% privado en tu ordenador, sin registros ni servidores externos
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
            onClick={() => setActiveTab('export')}
            className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'export'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Copia JSON</span>
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

          {/* TAB 1: DISK AUTO-BACKUP */}
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
                  💡 Truco: Si seleccionas una carpeta sincronizada con Google Drive, OneDrive o Dropbox en tu ordenador, tendrás sincronización automática entre dispositivos.
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
                    Las políticas de seguridad del navegador impiden que ventanas embebidas o vistas previas accedan directamente a las carpetas locales de tu ordenador. Para respaldar tu campaña aquí, usa la pestaña <strong>Descargar Copia JSON</strong> o abre la aplicación en una pestaña propia de tu navegador.
                  </p>
                </div>
              )}

              {isDiskBackupSupported() ? (
                <div className="border border-[var(--glass-border)] bg-[var(--glass)] p-4 rounded-lg space-y-3">
                  {!backupFolder ? (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-xs text-[var(--text-secondary)] m-0">
                        No hay ninguna carpeta de disco vinculada actualmente.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleChooseFolder}
                          disabled={isChoosingFolder}
                          className="py-2.5 px-4 rounded-lg font-cinzel font-bold text-xs bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 transition-opacity inline-flex items-center gap-2 cursor-pointer shadow-xs"
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>Elegir Carpeta y Activar Auto-Guardado</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleManualSaveToDisk()}
                          disabled={isSavingManual || !currentProject}
                          className="py-2.5 px-4 rounded-lg font-cinzel font-bold text-xs bg-[color-mix(in_srgb,var(--accent)_15%,var(--surface))] border border-[var(--accent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_25%,var(--surface))] transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <Download className="w-4 h-4" />
                          <span>{isSavingManual ? 'Guardando...' : 'Guardar Manualmente en Carpeta'}</span>
                        </button>
                      </div>
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
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleManualSaveToDisk()}
                            disabled={isSavingManual || !currentProject}
                            className="py-1.5 px-3 rounded bg-[var(--accent)] text-[var(--on-accent)] font-cinzel font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity shadow-xs disabled:opacity-50"
                            title="Guardar de inmediato el estado actual de la campaña en esta carpeta"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isSavingManual ? 'Guardando...' : 'Guardar en Carpeta Ahora'}</span>
                          </button>
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

                      {/* Lista de Partidas en la Carpeta Activa */}
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
                            No se han detectado archivos <code>.json</code> de partidas en esta carpeta todavía. Se guardará uno aquí al jugar un turno o pulsar guardar.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {diskFiles.map(df => {
                              const isCurrentCampaignFile =
                                currentProject &&
                                (df.name === getCampaignFileName(currentProject.name) ||
                                  df.name.toLowerCase().includes(currentProject.name.toLowerCase().replace(/\s+/g, '-').slice(0, 15)));

                              return (
                                <div
                                  key={df.name}
                                  className={`p-2.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                    isCurrentCampaignFile
                                      ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]'
                                      : 'border-[var(--glass-border)] bg-[var(--surface)] hover:border-[var(--accent)]/40'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <FileJson className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                                      <span className="font-semibold text-xs text-[var(--text-primary)] break-all">
                                        {df.name}
                                      </span>
                                      {isCurrentCampaignFile && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-cinzel font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                          Tomo Actual
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-[var(--text-secondary)] mt-1 flex items-center gap-2">
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

                                  {/* Action Buttons for this file */}
                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    {onImportCampaignFile && (
                                      <button
                                        type="button"
                                        onClick={() => setFileToConfirmRestore(df)}
                                        className="py-1 px-2 rounded bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] hover:bg-[color-mix(in_srgb,var(--accent)_22%,var(--surface))] text-[var(--accent)] border border-[var(--accent)]/40 font-cinzel font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                        title={`Cargar y continuar jugando la partida de ${df.name}`}
                                      >
                                        <Upload className="w-3 h-3" />
                                        <span>Cargar</span>
                                      </button>
                                    )}

                                    {currentProject && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsOverwritingFile(df.name);
                                          void handleManualSaveToDisk(df.name);
                                        }}
                                        disabled={isSavingManual && isOverwritingFile === df.name}
                                        className="py-1 px-2 rounded bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] hover:bg-[var(--glass-border)] text-[var(--text-primary)] border border-[var(--glass-border)] font-cinzel font-semibold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                                        title={`Sobrescribir ${df.name} con el estado más reciente de la campaña activa (${currentProject.name})`}
                                      >
                                        <Save className={`w-3 h-3 ${isSavingManual && isOverwritingFile === df.name ? 'animate-spin' : ''}`} />
                                        <span>
                                          {isSavingManual && isOverwritingFile === df.name ? 'Guardando...' : 'Sobrescribir'}
                                        </span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => setFileToConfirmDelete(df.name)}
                                      className="p-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors cursor-pointer"
                                      title={`Eliminar ${df.name} definitivamente de la carpeta`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="pt-2 border-t border-[var(--glass-border)] text-[10px] text-[var(--text-secondary)] space-y-1">
                          <p className="m-0 leading-relaxed">
                            💡 <strong>Gestión de Copias y Nombres:</strong> Las partidas se guardan automáticamente con el nombre de tu campaña (ej. <code>{currentProject ? getCampaignFileName(currentProject.name) : 'Mi-Campana.gmstudio.json'}</code>). Si has cambiado el nombre de una partida o tienes archivos antiguos como <code>Nueva-Campana.gmstudio.json</code>, puedes eliminarlos con el botón de la papelera o pulsar <strong>Sobrescribir</strong> para reemplazarlos con la versión más moderna.
                          </p>
                        </div>
                      </div>

                      {/* Confirmation Modal for Deleting File from Folder */}
                      {fileToConfirmDelete && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2 text-xs text-red-900 dark:text-red-300 animate-[fadeIn_0.15s_ease]">
                          <div className="flex items-center gap-1.5 font-cinzel font-bold text-red-700 dark:text-red-400">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>¿Eliminar archivo de la carpeta?</span>
                          </div>
                          <p className="text-[11px] m-0 leading-relaxed text-[var(--text-secondary)]">
                            Se borrará permanentemente el archivo <strong>«{fileToConfirmDelete}»</strong> de tu carpeta de disco. Esta acción no se puede deshacer.
                          </p>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setFileToConfirmDelete(null)}
                              disabled={isDeletingFile}
                              className="py-1 px-3 rounded bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--glass-border)] font-cinzel text-[11px] cursor-pointer hover:bg-[var(--glass-border)] transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDiskFile(fileToConfirmDelete)}
                              disabled={isDeletingFile}
                              className="py-1 px-3 rounded bg-red-600 hover:bg-red-700 text-white font-cinzel font-bold text-[11px] cursor-pointer transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{isDeletingFile ? 'Borrando...' : 'Sí, Eliminar Archivo'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Confirmation Modal for Restoring/Loading File */}
                      {fileToConfirmRestore && (
                        <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg space-y-2 text-xs text-sky-900 dark:text-sky-300 animate-[fadeIn_0.15s_ease]">
                          <div className="flex items-center gap-1.5 font-cinzel font-bold text-sky-700 dark:text-sky-400">
                            <Upload className="w-4 h-4 shrink-0" />
                            <span>¿Cargar y Restaurar Partida?</span>
                          </div>
                          <p className="text-[11px] m-0 leading-relaxed text-[var(--text-secondary)]">
                            Se importará y cargará la partida desde <strong>«{fileToConfirmRestore.name}»</strong> ({formatFileSize(fileToConfirmRestore.size)}).
                          </p>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setFileToConfirmRestore(null)}
                              className="py-1 px-3 rounded bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--glass-border)] font-cinzel text-[11px] cursor-pointer hover:bg-[var(--glass-border)] transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRestoreDiskFile(fileToConfirmRestore)}
                              className="py-1 px-3 rounded bg-[var(--accent)] text-[var(--on-accent)] font-cinzel font-bold text-[11px] cursor-pointer hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Cargar Partida</span>
                            </button>
                          </div>
                        </div>
                      )}

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
                  Tu navegador actual no admite la API File System nativa. Puedes usar la pestaña <strong>Descargar Copia JSON</strong> para respaldar tus partidas en cualquier momento.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPORTAR / DESCARGAR COPIAS JSON */}
          {activeTab === 'export' && (
            <div className="space-y-4 font-lora">
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-[var(--text-primary)] space-y-1.5">
                <div className="flex items-center gap-2 font-cinzel font-bold text-sm text-amber-800 dark:text-amber-300">
                  <FileJson className="w-4 h-4" />
                  <span>Descargar Copia de Respaldo (.JSON)</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">
                  Descarga un archivo <code>.json</code> completo con todos los capítulos, memoria viva, personajes, mapas, imágenes e inventario del tomo actual. Puedes guardarlo en tu ordenador o transferirlo a cualquier otro dispositivo.
                </p>
              </div>

              {currentProject ? (
                <div className="p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-cinzel text-[var(--text-secondary)] uppercase tracking-wider block">
                        Tomo Activo Seleccionado
                      </span>
                      <h4 className="font-cinzel font-bold text-sm text-[var(--accent)] m-0">
                        {currentProject.name}
                      </h4>
                    </div>
                    <span className="text-[11px] font-cinzel text-[var(--text-secondary)]">
                      {currentChats.length} capítulos · {currentFiles.length} archivos
                    </span>
                  </div>

                  {onExportCurrentProject && (
                    <button
                      type="button"
                      onClick={() => {
                        onExportCurrentProject();
                        setSuccessNotice(`Copia de "${currentProject.name}" descargada correctamente.`);
                        setTimeout(() => setSuccessNotice(null), 4000);
                      }}
                      className="w-full py-3 px-4 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 font-cinzel font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Copia de «{currentProject.name}» (.json)</span>
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] italic text-center py-4">
                  No hay ningún tomo abierto actualmente para exportar.
                </p>
              )}

              <div className="p-3 bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] border border-[var(--glass-border)] rounded-lg text-xs space-y-1">
                <span className="font-cinzel font-bold text-[var(--text-primary)] block">
                  ¿Cómo restaurar tu copia más tarde?
                </span>
                <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
                  Para cargar o continuar una partida guardada en un archivo <code>.json</code>, utiliza el botón <strong>Importar</strong> en la cabecera superior del menú.
                </p>
              </div>
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
