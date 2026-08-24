import React, { useState } from 'react';
import {
  Sparkles,
  Music,
  Image as ImageIcon,
  Film,
  Mic,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Copy,
  Check,
  X,
  ExternalLink,
  Wand2,
  Send,
  Radio
} from 'lucide-react';

export interface CreativeStudioModalProps {
  isOpen?: boolean;
  initialTab?: 'music' | 'image' | 'video' | 'voice';
  sceneText?: string;
  lastSceneText?: string;
  onInsertIntoChat?: (text: string) => void;
  onSendToChat?: (text: string) => void;
  onClose: () => void;
}

// Built-in synthesized fantasy soundscapes / ambiances using Web Audio API
class FantasyAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentTrack = '';
  private gainNode: GainNode | null = null;
  private activeNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playTrack(trackId: string, volume: number = 0.5) {
    this.stop();
    this.initContext();
    if (!this.ctx) return;

    this.isPlaying = true;
    this.currentTrack = trackId;

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    this.gainNode.connect(this.ctx.destination);

    if (trackId === 'bard_lute') {
      // Arpeggiated lute notes (pentatonic fantasy progression)
      this.playBardLute();
    } else if (trackId === 'tavern') {
      // Warm fireplace drone & cozy harmonies
      this.playTavernAmbiance();
    } else if (trackId === 'dungeon') {
      // Low atmospheric dark drone
      this.playDungeonDrone();
    } else if (trackId === 'battle') {
      // Rhythmic war tension pulses
      this.playBattleTension();
    } else if (trackId === 'elven_forest') {
      // Ethereal wind and gentle bells
      this.playElvenForest();
    }
  }

  private playBardLute() {
    if (!this.ctx || !this.gainNode) return;
    const notes = [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25, 587.33]; // A minor pentatonic / dorian
    let step = 0;

    const interval = setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.gainNode) {
        clearInterval(interval);
        return;
      }
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      const freq = notes[step % notes.length];
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      noteGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

      osc.connect(noteGain);
      noteGain.connect(this.gainNode);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.2);
      this.activeNodes.push(osc);

      // Random lute fingerpicking variation
      const pattern = [0, 2, 4, 3, 5, 4, 2, 1];
      step = (step + pattern[Math.floor(Math.random() * pattern.length)]) % notes.length;
    }, 450);
  }

  private playTavernAmbiance() {
    if (!this.ctx || !this.gainNode) return;
    // Warm rich pad
    const freqs = [130.81, 164.81, 196.0, 246.94]; // C major 7 warm chord
    freqs.forEach(f => {
      if (!this.ctx || !this.gainNode) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);
      g.gain.setValueAtTime(0.12, this.ctx.currentTime);
      osc.connect(g);
      g.connect(this.gainNode);
      osc.start();
      this.activeNodes.push(osc);
    });
  }

  private playDungeonDrone() {
    if (!this.ctx || !this.gainNode) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(82.4, this.ctx.currentTime); // E

    // Filter to make it deep & spooky
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, this.ctx.currentTime);

    g.gain.setValueAtTime(0.18, this.ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(this.gainNode);

    osc1.start();
    osc2.start();
    this.activeNodes.push(osc1, osc2);
  }

  private playBattleTension() {
    if (!this.ctx || !this.gainNode) return;
    // Rhythmic pulse
    const interval = setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.gainNode) {
        clearInterval(interval);
        return;
      }
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(73.42, this.ctx.currentTime); // D

      g.gain.setValueAtTime(0.25, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      osc.connect(g);
      g.connect(this.gainNode);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
      this.activeNodes.push(osc);
    }, 550);
  }

  private playElvenForest() {
    if (!this.ctx || !this.gainNode) return;
    const freqs = [329.63, 440, 523.25, 659.25]; // E minor ethereal
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.gainNode) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);
      g.gain.setValueAtTime(0.08 / (idx + 1), this.ctx.currentTime);
      osc.connect(g);
      g.connect(this.gainNode);
      osc.start();
      this.activeNodes.push(osc);
    });
  }

  public setVolume(vol: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  public stop() {
    this.isPlaying = false;
    this.currentTrack = '';
    this.activeNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // already stopped
      }
    });
    this.activeNodes = [];
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  public getTrack() {
    return this.currentTrack;
  }
}

// Global synth instance
const synth = new FantasyAudioSynthesizer();

export const CreativeStudioModal: React.FC<CreativeStudioModalProps> = ({
  initialTab = 'music',
  sceneText,
  lastSceneText = '',
  onInsertIntoChat,
  onSendToChat,
  onClose
}) => {
  const effectiveSceneText = sceneText || lastSceneText;
  const handleSendToChat = onInsertIntoChat || onSendToChat;
  const [activeTab, setActiveTab] = useState<'music' | 'image' | 'video' | 'voice'>(initialTab);
  const [activeSoundtrack, setActiveSoundtrack] = useState<string>(synth.getTrack());
  const [volume, setVolume] = useState<number>(0.4);
  const [customMusicUrl, setCustomMusicUrl] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  // Image / Scene generation prompt helper
  const [imagePrompt, setImagePrompt] = useState<string>(() => {
    if (effectiveSceneText) {
      const clean = effectiveSceneText.replace(/<[^>]+>/g, '').trim().slice(0, 300);
      return `Masterpiece fantasy oil painting, highly detailed D&D scene: ${clean}`;
    }
    return 'D&D fantasy party camping near ancient elven ruins under starlight, warm campfire, high fantasy artstyle';
  });

  // Video / Cinematic prompt
  const [videoPrompt, setVideoPrompt] = useState<string>(() => {
    if (effectiveSceneText) {
      const clean = effectiveSceneText.replace(/<[^>]+>/g, '').trim().slice(0, 200);
      return `Cinematic 4k fantasy camera pan: ${clean}, slow motion, epic atmospheric lighting`;
    }
    return 'Epic slow cinematic push towards a towering dragon sleeping atop a treasure hoard, smoke and embers swirling';
  });

  const ambientTracks = [
    {
      id: 'bard_lute',
      name: 'Laúd de Bardo (Balada Fantasía)',
      icon: '🎻',
      desc: 'Arpegios continuos en laúd para narraciones de posada, interpretaciones y romance.'
    },
    {
      id: 'tavern',
      name: 'Posada & Fuego Acogedor',
      icon: '🍺',
      desc: 'Ambiente cálido y relajante con resonancia armónica para momentos de descanso.'
    },
    {
      id: 'dungeon',
      name: 'Profundidades & Cripta Oscura',
      icon: '🕯️',
      desc: 'Dron grave y tétrico para exploración subterránea y tensión mágica.'
    },
    {
      id: 'battle',
      name: 'Tensión de Combate & Tambores',
      icon: '⚔️',
      desc: 'Pulsos rítmicos de combate táctico para turnos de iniciativa intensa.'
    },
    {
      id: 'elven_forest',
      name: 'Bosque Élfico & Misticismo',
      icon: '🍃',
      desc: 'Armonías etéreas y naturaleza arcana para santuarios y viajes por el bosque.'
    }
  ];

  const handleToggleAudio = (trackId: string) => {
    if (activeSoundtrack === trackId) {
      synth.stop();
      setActiveSoundtrack('');
    } else {
      synth.playTrack(trackId, volume);
      setActiveSoundtrack(trackId);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    synth.setVolume(newVol);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[var(--surface)] text-[var(--text-primary)] rounded-2xl shadow-2xl border border-[var(--glass-border)] flex flex-col max-h-[92vh] overflow-hidden font-lora">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--surface-soft)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-cinzel font-bold text-[var(--text-primary)]">
                Taller Creativo & Multimedia
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Música ambiental, ambientación de Bardo, ilustraciones de escena y cinemáticas
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-4 pt-2 border-b border-[var(--glass-border)] bg-[var(--surface)] gap-1 overflow-x-auto">
          {[
            { id: 'music', label: '🎵 Música & Bardo', icon: Music },
            { id: 'image', label: '🎨 Ilustración', icon: ImageIcon },
            { id: 'video', label: '🎬 Cinemática', icon: Film },
            { id: 'voice', label: '🎤 Entrada de Voz', icon: Mic }
          ].map(t => {
            const isSel = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-cinzel font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isSel
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--glass)] rounded-t-lg'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: MUSIC & BARD */}
          {activeTab === 'music' && (
            <div className="space-y-4">
              <div className="bg-[var(--glass)] p-3.5 rounded-xl border border-[var(--glass-border)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[var(--accent)] animate-pulse" />
                    <h4 className="text-xs font-cinzel font-bold text-[var(--text-primary)]">
                      Banda Sonora & Paisajes Sonoros Sintetizados
                    </h4>
                  </div>
                  {activeSoundtrack && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      ● Reproduciendo
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                  Melodías ambientales interactivas que suenan de fondo en segundo plano mientras juegas, sin consumir cuota ni interrumpirse.
                </p>

                {/* Track list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ambientTracks.map(track => {
                    const isPlayingThis = activeSoundtrack === track.id;
                    return (
                      <div
                        key={track.id}
                        onClick={() => handleToggleAudio(track.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isPlayingThis
                            ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-md scale-[1.02]'
                            : 'bg-[var(--surface-soft)] text-[var(--text-primary)] border-[var(--glass-border)] hover:border-[var(--accent)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-lg">{track.icon}</span>
                          <button
                            className={`p-1.5 rounded-lg flex items-center justify-center transition-transform ${
                              isPlayingThis ? 'bg-white/20 text-white' : 'bg-[var(--glass)] text-[var(--accent)]'
                            }`}
                          >
                            {isPlayingThis ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div>
                          <div className="text-xs font-cinzel font-bold mb-0.5">{track.name}</div>
                          <div
                            className={`text-[11px] line-clamp-2 leading-relaxed ${
                              isPlayingThis ? 'text-white/90' : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {track.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Volume Slider */}
                <div className="mt-4 pt-3 border-t border-[var(--glass-border)] flex items-center gap-3">
                  <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                    {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    Volumen:
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                    className="flex-1 accent-[var(--accent)] cursor-pointer"
                  />
                  <span className="text-xs font-mono text-[var(--text-secondary)] w-8 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              {/* YouTube / Spotify Quick Insert */}
              <div className="bg-[var(--surface-soft)] p-3.5 rounded-xl border border-[var(--glass-border)] space-y-2">
                <h4 className="text-xs font-cinzel font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Insertar Enlace de YouTube o Spotify al Chat
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Pega el enlace de una canción (canción de bardo, tema de combate o música de fondo) y se añadirá a tu mensaje con reproductor integrado.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... o https://open.spotify.com/track/..."
                    value={customMusicUrl}
                    onChange={e => setCustomMusicUrl(e.target.value)}
                    className="flex-1 bg-[var(--surface)] border border-[var(--user-border)] px-3 py-2 rounded-lg text-xs outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    onClick={() => {
                      if (customMusicUrl.trim() && handleSendToChat) {
                        handleSendToChat(`🎶 [Música de fondo / Interpretación]: ${customMusicUrl.trim()}`);
                        setCustomMusicUrl('');
                        onClose();
                      }
                    }}
                    disabled={!customMusicUrl.trim()}
                    className="px-3.5 py-2 bg-[var(--accent)] text-[var(--on-accent)] font-cinzel font-bold text-xs rounded-lg flex items-center gap-1 hover:bg-[var(--accent-hover)] disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" /> Insertar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMAGE GENERATION & PROMPT BUILDER */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="bg-[var(--glass)] p-3.5 rounded-xl border border-[var(--glass-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-cinzel font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Generador de Prompts Artísticos para la Escena
                  </h4>
                  <span className="text-[10px] text-[var(--accent)] font-cinzel font-bold bg-[var(--surface-soft)] px-2 py-0.5 rounded border border-[var(--glass-border)]">
                    Fantasía D&D
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Crea o personaliza la descripción visual del momento actual para generar ilustraciones en herramientas como Imagen o adjuntarlas a la crónica.
                </p>

                <textarea
                  value={imagePrompt}
                  onChange={e => setImagePrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-[var(--surface)] border border-[var(--user-border)] p-3 rounded-lg text-xs leading-relaxed outline-none focus:border-[var(--accent)] font-lora"
                />

                {/* Quick style presets */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-[var(--text-secondary)] self-center mr-1">Estilos:</span>
                  {[
                    'Óleo de Fantasía Clásica',
                    'Retrato Realista de PNJ',
                    'Mapa Táctico de Batalla (Grid 2D)',
                    'Atmósfera Tenebrosa / Grimdark',
                    'Grabado Medieval Antiguo'
                  ].map(style => (
                    <button
                      key={style}
                      onClick={() => {
                        setImagePrompt(prev => `${prev}, style: ${style}`);
                      }}
                      className="text-[10px] font-cinzel font-bold px-2 py-1 bg-[var(--surface-soft)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] border border-[var(--glass-border)] rounded-md transition-colors cursor-pointer"
                    >
                      + {style}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]">
                  <button
                    onClick={() => copyToClipboard(imagePrompt, 'img_prompt')}
                    className="flex items-center gap-1.5 text-xs font-cinzel font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    {copiedPrompt === 'img_prompt' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> ¡Copiado al Portapapeles!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Prompt
                      </>
                    )}
                  </button>
                  {handleSendToChat && (
                    <button
                      onClick={() => {
                        handleSendToChat(`🎨 [Ilustración de la Escena / Momento Clave]: ${imagePrompt}`);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-bold flex items-center gap-1 shadow-xs hover:bg-[var(--accent-hover)] cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Adjuntar a la Crónica
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VIDEO & CINEMATICS */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <div className="bg-[var(--glass)] p-3.5 rounded-xl border border-[var(--glass-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-cinzel font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Cinemática de Escena (Video Prompting)
                  </h4>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Veo / Cinematic 16:9
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Genera una toma cinematográfica de cámara lenta, barrido o revelación épica para los momentos decisivos de la campaña.
                </p>

                <textarea
                  value={videoPrompt}
                  onChange={e => setVideoPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-[var(--surface)] border border-[var(--user-border)] p-3 rounded-lg text-xs leading-relaxed outline-none focus:border-[var(--accent)] font-lora"
                />

                <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]">
                  <button
                    onClick={() => copyToClipboard(videoPrompt, 'vid_prompt')}
                    className="flex items-center gap-1.5 text-xs font-cinzel font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    {copiedPrompt === 'vid_prompt' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> ¡Copiado al Portapapeles!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Prompt Cinemático
                      </>
                    )}
                  </button>
                  {handleSendToChat && (
                    <button
                      onClick={() => {
                        handleSendToChat(`🎬 [Cinemática de Escena]: ${videoPrompt}`);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-bold flex items-center gap-1 shadow-xs hover:bg-[var(--accent-hover)] cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar a la Historia
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VOICE INPUT */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div className="bg-[var(--glass)] p-4 rounded-xl border border-[var(--glass-border)] text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shadow-md">
                  <Mic className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-cinzel font-bold text-[var(--text-primary)]">
                  Dictado y Reconocimiento de Voz
                </h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
                  Ya puedes hablarle directamente a tu DM con el botón del micrófono integrado en la barra de chat. Tus palabras se transcribirán en tiempo real en la caja de texto.
                </p>
                <div className="p-3 bg-[var(--surface-soft)] rounded-lg text-xs text-[var(--text-secondary)] text-left max-w-md mx-auto space-y-1 border border-[var(--glass-border)]">
                  <div className="font-bold font-cinzel text-[var(--text-primary)] mb-1">
                    💡 Consejos para rolear por voz:
                  </div>
                  <div>• Di <em>«Lanzo mi conjuro de Fuego...»</em> para dictar tu acción directamente.</div>
                  <div>• Di <em>«Comillas ... comillas»</em> si deseas hablar en primera persona de diálogo.</div>
                  <div>• Funciona en móviles, tabletas y ordenadores con micrófono habilitado.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--glass-border)] bg-[var(--surface-soft)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-cinzel font-bold border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface)] transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
