/**
 * Gestor de latido en segundo plano (Background Heartbeat)
 * 
 * Los navegadores modernos (Chrome, Safari, Firefox, Edge en móviles y escritorio)
 * aplican estrangulamiento agresivo (throttling) a requestAnimationFrame, setTimeout
 * y setInterval cuando una pestaña está en segundo plano, minimizada o la pantalla se atenúa.
 * 
 * Esta utilidad instancia un Web Worker inline (vía Blob URL). Los Web Workers se ejecutan
 * en un hilo independiente del DOM y NO sufren estrangulamiento de timers, permitiendo que
 * la lectura de streams de Gemini, la persistencia local y el volcado de texto continúen
 * fluidamente sin congelarse mientras la jugadora lee otra pestaña o bloquea el móvil.
 */

class BackgroundHeartbeatManager {
  private worker: Worker | null = null;
  private intervalId: number | null = null;
  private listeners: Set<() => void> = new Set();
  private isRunning = false;

  public start(callback?: () => void) {
    if (callback) {
      this.listeners.add(callback);
    }

    if (this.isRunning) return;
    this.isRunning = true;

    try {
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
        const workerScript = `
          var timer = null;
          self.onmessage = function(e) {
            if (e.data === 'start') {
              if (timer) clearInterval(timer);
              timer = setInterval(function() {
                self.postMessage('heartbeat_tick');
              }, 200);
            } else if (e.data === 'stop') {
              if (timer) {
                clearInterval(timer);
                timer = null;
              }
            }
          };
        `;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl);

        this.worker.onmessage = () => {
          this.notifyListeners();
        };

        this.worker.postMessage('start');
      } else {
        this.startFallbackInterval();
      }
    } catch {
      this.startFallbackInterval();
    }
  }

  private startFallbackInterval() {
    if (this.intervalId) return;
    this.intervalId = window.setInterval(() => {
      this.notifyListeners();
    }, 200);
  }

  private notifyListeners() {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.warn('Background heartbeat listener error:', err);
      }
    });
  }

  public stop(callback?: () => void) {
    if (callback) {
      this.listeners.delete(callback);
    }

    if (this.listeners.size === 0) {
      this.isRunning = false;
      if (this.worker) {
        try {
          this.worker.postMessage('stop');
          this.worker.terminate();
        } catch {
          // ignore
        }
        this.worker = null;
      }
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
  }
}

export const backgroundHeartbeat = new BackgroundHeartbeatManager();
