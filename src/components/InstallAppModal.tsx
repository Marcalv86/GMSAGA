import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Sparkles,
  Zap,
  Check,
  Copy,
  QrCode,
  Laptop,
  Link2,
  X,
  Dices,
  Code2,
  Share2,
  PlusSquare,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const InstallAppModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstalled?: () => void;
}> = ({ isOpen, onClose, deferredPrompt, onInstalled }) => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  useEffect(() => {
    // Check if running as installed PWA
    const checkStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setInstallSuccess(true);
          if (onInstalled) onInstalled();
        }
      } catch (err) {
        console.error("Error durante la instalación:", err);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-lora"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2d201c] via-[#452b22] to-[#2d201c] text-[#f4ecd8] p-4 flex justify-between items-center border-b border-[var(--light-gold)]/40">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-6 h-6 text-[var(--light-gold)]" />
            <div>
              <h3 className="font-cinzel text-lg font-bold text-[var(--light-gold)] m-0 leading-tight">
                Instalar GM Studio en tu Dispositivo
              </h3>
              <p className="text-[11px] text-[#f4ecd8]/80 font-sans m-0">
                Acceso directo nativo, pantalla completa y respuesta
                ultrarrápida
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#f4ecd8]/80 hover:text-white p-1 rounded transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 overflow-y-auto flex flex-col gap-4 text-[var(--text-primary)]">
          {isStandalone ? (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 text-center flex flex-col items-center gap-2 text-emerald-900">
              <Sparkles className="w-7 h-7 text-emerald-600" />
              <h4 className="font-cinzel font-bold text-base m-0">
                ¡Ya estás usando la App instalada!
              </h4>
              <p className="text-xs text-emerald-800 m-0">
                GM Studio ya está funcionando en modo nativo en este dispositivo
                con memoria persistente y pantalla completa.
              </p>
            </div>
          ) : installSuccess ? (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 text-center flex flex-col items-center gap-2 text-emerald-900">
              <Check className="w-7 h-7 text-emerald-600" />
              <h4 className="font-cinzel font-bold text-base m-0">
                ¡Instalación Iniciada!
              </h4>
              <p className="text-xs text-emerald-800 m-0">
                La aplicación se ha añadido a la pantalla de inicio o al cajón
                de aplicaciones de tu dispositivo.
              </p>
            </div>
          ) : (
            <>
              {/* Native Prompt Available (Android / Chrome / Edge / Desktop) */}
              {deferredPrompt && (
                <div className="bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded-lg p-4 flex flex-col items-center gap-3 text-center shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8b0000] to-[#2d201c] flex items-center justify-center text-white shadow-md border-2 border-[var(--light-gold)]">
                    <Dices className="w-7 h-7 text-[var(--light-gold)]" />
                  </div>
                  <div>
                    <h4 className="font-cinzel font-bold text-base text-[var(--accent)] m-0">
                      Instalación Rápida con 1 Clic
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Compatible con teléfonos, tablets (Android / iPad) y
                      ordenadores (Windows / Mac / Linux).
                    </p>
                  </div>
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[var(--accent)] to-[#b22222] text-white font-cinzel font-bold text-sm rounded-lg shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Instalar Ahora en este Dispositivo</span>
                  </button>
                </div>
              )}

              {/* iOS Safari Instructions */}
              {isIOS && !deferredPrompt && (
                <div className="bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 font-cinzel font-bold text-sm text-[var(--accent)]">
                    <Smartphone className="w-4 h-4" />
                    <span>En iPhone o iPad (Safari)</span>
                  </div>
                  <ol className="text-xs text-[var(--text-primary)] space-y-2 list-decimal list-inside bg-amber-50/60 p-3 rounded border border-amber-200/60">
                    <li>
                      Toca el botón <strong>Compartir</strong>{" "}
                      <Share2 className="w-3.5 h-3.5 inline mx-1 text-sky-600" />{" "}
                      en la barra inferior de Safari.
                    </li>
                    <li>
                      Desplázate hacia abajo y selecciona{" "}
                      <strong>"Añadir a la pantalla de inicio"</strong>{" "}
                      <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-sky-600" />
                      .
                    </li>
                    <li>
                      Pulsa <strong>"Añadir"</strong> en la esquina superior
                      derecha.
                    </li>
                  </ol>
                  <p className="text-[11px] text-[var(--text-secondary)] italic m-0">
                    ¡Listo! Podrás abrir GM Studio como una app independiente a
                    pantalla completa desde tu pantalla de inicio.
                  </p>
                </div>
              )}

              {/* General / Android / Desktop fallback if prompt already dismissed */}
              {!deferredPrompt && !isIOS && (
                <div className="bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 font-cinzel font-bold text-sm text-[var(--accent)]">
                    <Laptop className="w-4 h-4" />
                    <span>En Chrome, Edge o Móvil Android</span>
                  </div>
                  <ol className="text-xs text-[var(--text-primary)] space-y-2 list-decimal list-inside bg-amber-50/60 p-3 rounded border border-amber-200/60">
                    <li>
                      Abre el{" "}
                      <strong>Menú del navegador (⋮ o tres puntos)</strong> en
                      la esquina superior derecha.
                    </li>
                    <li>
                      Haz clic o toca en{" "}
                      <strong>"Instalar GM Studio..."</strong> o{" "}
                      <strong>"Añadir a pantalla principal"</strong>.
                    </li>
                    <li>
                      Confirma la instalación para crear el acceso directo en el
                      escritorio o en tus apps.
                    </li>
                  </ol>
                </div>
              )}

              {/* Live Link & Mobile QR Scanner */}
              <div className="bg-amber-50/80 border-2 border-amber-300/80 rounded-lg p-3.5 flex flex-col gap-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-cinzel font-bold text-xs text-[var(--accent)]">
                    <Link2 className="w-4 h-4" />
                    <span>Enlace Directo a tu Aplicación</span>
                  </div>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-cinzel font-bold">
                    Web & Móvil
                  </span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] m-0">
                  Copia este enlace o ábrelo en tu teléfono para jugar o
                  instalar la app:
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentUrl}
                    className="flex-1 bg-[var(--surface)] border border-[var(--user-border)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-mono select-all truncate outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] text-xs font-cinzel font-bold rounded hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>

                {/* QR Code for instant phone scanning */}
                {currentUrl && (
                  <div className="mt-2 pt-2 border-t border-amber-200 flex items-center gap-3">
                    <div className="w-16 h-16 bg-[var(--surface)] p-1 rounded border border-amber-300 shrink-0 shadow-xs">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}`}
                        alt="Escanear QR para abrir en el móvil"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      <strong className="flex items-center gap-1 text-[var(--accent)]">
                        <QrCode className="w-3.5 h-3.5 inline" /> ¿Estás en el
                        ordenador?
                      </strong>
                      Apunta la cámara de tu móvil a este código QR para abrir
                      el juego al instante en tu teléfono o tablet.
                    </div>
                  </div>
                )}
              </div>

              {/* GitHub Installation Info */}
              <div className="bg-[#2d201c]/5 border border-[var(--user-border)] rounded-lg p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-cinzel font-bold text-xs text-[var(--accent)]">
                  <Code2 className="w-4 h-4" />
                  <span>Código Abierto & Despliegue en GitHub</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] m-0 leading-relaxed">
                  Para clonar o instalar el repositorio en tu propio GitHub y
                  ejecutarlo en local:
                </p>
                <div className="bg-[#2d201c] text-[#f4ecd8] p-2.5 rounded font-mono text-[11px] select-all overflow-x-auto">
                  git clone &lt;tu-repositorio&gt;
                  <br />
                  npm install
                  <br />
                  npm run dev
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[var(--sidebar-bg)] p-3.5 border-t border-[var(--glass-border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-cinzel bg-[var(--surface)] border border-[var(--user-border)] text-[var(--text-primary)] rounded hover:bg-black/5 transition-all cursor-pointer font-semibold"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
