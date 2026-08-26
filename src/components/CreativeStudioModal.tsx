import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Wand2,
  Send,
  Radio,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Upload,
  Calendar,
  BookmarkPlus,
  Plus,
  RefreshCw,
  Palette,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Project, ProjectFile, TimelineEntry, CalendarConfig, CampaignDate } from '../types';
import {
  CALENDARIO_FANTASTICO,
  aDiaAbsoluto,
  desdeDiaAbsoluto,
  fechaInicial,
  fechaLegible,
  extraerMinutoDeTexto
} from '../utils/campaignCalendar';
import {
  extractVisualArtStyleFromImages,
  describeApiError,
  generateImageWithFailover,
  ExtractedImageStyle
} from '../utils/geminiHelper';

export interface CreativeStudioModalProps {
  isOpen?: boolean;
  initialTab?: 'music' | 'image' | 'video' | 'voice' | 'diary';
  sceneText?: string;
  lastSceneText?: string;
  project?: Project;
  files?: ProjectFile[];
  selectedAbsDay?: number;
  onUpdateProject?: (updater: Partial<Project> | ((prev: Project) => Partial<Project>)) => Promise<void> | void;
  onUploadFile?: (file: File, category?: any) => Promise<string>;
  onNavigateToDiary?: (absDay?: number) => void;
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
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      this.playBardLute();
    } else if (trackId === 'tavern') {
      this.playTavernAmbiance();
    } else if (trackId === 'dungeon') {
      this.playDungeonDrone();
    } else if (trackId === 'battle') {
      this.playBattleTension();
    } else if (trackId === 'elven_forest') {
      this.playElvenForest();
    }
  }

  private playBardLute() {
    if (!this.ctx || !this.gainNode) return;
    const notes = [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25, 587.33];
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

      const pattern = [0, 2, 4, 3, 5, 4, 2, 1];
      step = (step + pattern[Math.floor(Math.random() * pattern.length)]) % notes.length;
    }, 450);
  }

  private playTavernAmbiance() {
    if (!this.ctx || !this.gainNode) return;
    const freqs = [130.81, 164.81, 196.0, 246.94];
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
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(82.4, this.ctx.currentTime);

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
    const interval = setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.gainNode) {
        clearInterval(interval);
        return;
      }
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(73.42, this.ctx.currentTime);

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
    const freqs = [329.63, 440, 523.25, 659.25];
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

/**
 * Generates an optimized image prompt for a scene based on selected archetype
 */
function buildImagePromptFromScene(
  cleanText: string,
  archetype: string,
  modifiers: string[],
  customStylePrompt?: string
): string {
  const snippet = cleanText ? cleanText.slice(0, 320) : 'A party of fantasy adventurers resting by a campfire';
  const modStr = modifiers.length > 0 ? `, ${modifiers.join(', ')}` : '';

  if (archetype === 'uploaded_images' && customStylePrompt) {
    return `Masterpiece high fantasy illustration: ${snippet}. ${customStylePrompt}${modStr}, award-winning fantasy illustration, artstation trending, 8k resolution`;
  }

  switch (archetype) {
    case 'uploaded_images':
      return `Masterpiece high fantasy illustration matching campaign reference art style: ${snippet}. Cohesive color palette, atmospheric fantasy lighting, high detail${modStr}, artstation trending, 8k`;
    case 'character':
      return `Masterpiece character portrait, detailed fantasy hero/NPC from scene: ${snippet}. Intricate facial expression, high fantasy clothing and gear, atmospheric depth of field, dramatic rim lighting${modStr}, octane render, 8k resolution`;
    case 'action':
      return `Epic dynamic battle and action sequence, high fantasy combat: ${snippet}. Dynamic perspective angle, spell effects and motion trails, dramatic lighting, intense atmosphere${modStr}, masterpiece concept art, artstation trending`;
    case 'landscape':
      return `Vast atmospheric fantasy landscape and environment: ${snippet}. Wide panoramic view, breathtaking scenery, detailed architecture and nature, volumetric god rays${modStr}, matte painting masterpiece`;
    case 'grimdark':
      return `Grimdark dark fantasy tenebrism painting: ${snippet}. Deep shadows, heavy chiaroscuro lighting, gritty textures, ominous fog, Elden Ring and Witcher inspired atmosphere${modStr}, cinematic lighting`;
    case 'woodcut':
      return `Authentic vintage medieval woodcut engraving, parchment texture: ${snippet}. Detailed cross-hatching, antique ink illustration, high fantasy bestiary illustration style${modStr}, monochrome black ink on aged paper`;
    case 'classic':
    default:
      return `Masterpiece fantasy oil painting, highly detailed D&D scene: ${snippet}. Rich atmospheric lighting, deep contrast, evocative mood${modStr}, award-winning fantasy illustration, artstation HQ`;
  }
}

/**
 * Generates an optimized cinematic video prompt for a scene
 */
function buildVideoPromptFromScene(cleanText: string, cameraMove: string): string {
  const snippet = cleanText ? cleanText.slice(0, 240) : 'Ancient fantasy ruins shrouded in mist';
  let camInstruction = 'Slow cinematic camera pan';

  if (cameraMove === 'drone') {
    camInstruction = 'Epic high-angle aerial drone sweep rising above';
  } else if (cameraMove === 'push') {
    camInstruction = 'Dramatic slow push-in tracking shot focusing deeply on';
  } else if (cameraMove === 'firstperson') {
    camInstruction = 'Immersive first-person handheld camera perspective walking through';
  } else if (cameraMove === 'orbit') {
    camInstruction = 'Smooth 360-degree orbital rotation around';
  }

  return `${camInstruction} the scene: ${snippet}. Photorealistic 4k cinematic video, atmospheric volumetric lighting, hyper-detailed physics, 24fps motion blur, professional color grading.`;
}

/**
 * Generates a condensed diary summary from the scene
 */
function buildDiarySummaryFromScene(cleanText: string): string {
  if (!cleanText) return '';
  const firstSentences = cleanText
    .replace(/\s+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
  return firstSentences || cleanText.slice(0, 220);
}

export const CreativeStudioModal: React.FC<CreativeStudioModalProps> = ({
  initialTab = 'image',
  sceneText = '',
  lastSceneText = '',
  project,
  files = [],
  selectedAbsDay,
  onUpdateProject,
  onUploadFile,
  onNavigateToDiary,
  onInsertIntoChat,
  onSendToChat,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'music' | 'image' | 'video' | 'diary' | 'voice'>(
    initialTab
  );
  const handleSendToChat = onInsertIntoChat || onSendToChat;

  // Campaign Date Context
  const cal: CalendarConfig = project?.calendar || CALENDARIO_FANTASTICO;
  const fechaSegura: CampaignDate = useMemo(() => {
    if (selectedAbsDay !== undefined && Number.isFinite(selectedAbsDay)) {
      return desdeDiaAbsoluto(cal, selectedAbsDay, project?.currentDate?.minute ?? 8 * 60);
    }
    return project?.currentDate && Number.isFinite(project.currentDate.year)
      ? project.currentDate
      : fechaInicial(1490);
  }, [cal, project?.currentDate, selectedAbsDay]);

  const hoyAbs = useMemo(() => {
    return selectedAbsDay !== undefined ? selectedAbsDay : aDiaAbsoluto(cal, fechaSegura);
  }, [cal, fechaSegura, selectedAbsDay]);

  const fechaLegibleStr = useMemo(() => {
    return fechaLegible(cal, fechaSegura);
  }, [cal, fechaSegura]);

  // Scene Context State (Editable so the user can tweak what scene is being illustrated)
  const initialScene = useMemo(() => {
    return (sceneText || lastSceneText || '').replace(/<[^>]+>/g, '').trim();
  }, [sceneText, lastSceneText]);

  const [currentScene, setCurrentScene] = useState<string>(initialScene);
  const [showSceneEditor, setShowSceneEditor] = useState<boolean>(false);

  // Sync if new scene prop arrives
  useEffect(() => {
    if (sceneText || lastSceneText) {
      setCurrentScene((sceneText || lastSceneText || '').replace(/<[^>]+>/g, '').trim());
    }
  }, [sceneText, lastSceneText]);

  // Image generation & attachment controls
  const [imageArchetype, setImageArchetype] = useState<string>('classic');
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [attachedImageUrl, setAttachedImageUrl] = useState<string>('');
  const [customSceneTitle, setCustomSceneTitle] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [showImagePicker, setShowImagePicker] = useState<boolean>(false);
  const [linkedSuccessMsg, setLinkedSuccessMsg] = useState<{ text: string; absDay: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Style extraction & direct AI Image generation
  const [extractedStyle, setExtractedStyle] = useState<ExtractedImageStyle | null>(() => {
    try {
      const saved = localStorage.getItem('gmstudio_extracted_style');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [autoLinkToDiary, setAutoLinkToDiary] = useState<boolean>(true);

  // Video generation controls
  const [cameraMove, setCameraMove] = useState<string>('pan');
  const [videoPrompt, setVideoPrompt] = useState<string>('');

  // Diary generation controls
  const [diarySummary, setDiarySummary] = useState<string>('');

  // Audio / Music controls
  const [activeSoundtrack, setActiveSoundtrack] = useState<string>(synth.getTrack());
  const [volume, setVolume] = useState<number>(0.4);
  const [customMusicUrl, setCustomMusicUrl] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  // Available image files from campaign
  const campaignImageFiles = useMemo(() => {
    return files.filter(f => f.isImage || (f.content && f.content.startsWith('data:image')));
  }, [files]);

  // Set default archetype to 'uploaded_images' if campaign images exist
  useEffect(() => {
    if (campaignImageFiles.length > 0 && (imageArchetype === 'classic' || !imageArchetype)) {
      setImageArchetype('uploaded_images');
    }
  }, [campaignImageFiles.length]);

  const handleExtractStyle = async () => {
    if (campaignImageFiles.length === 0) return;
    setIsAnalyzingStyle(true);
    try {
      const result = await extractVisualArtStyleFromImages(campaignImageFiles);
      setExtractedStyle(result);
      try {
        localStorage.setItem('gmstudio_extracted_style', JSON.stringify(result));
      } catch {}
      setImageArchetype('uploaded_images');
    } catch (err: any) {
      console.error('Error analizando estilo de imagen:', err);
    } finally {
      setIsAnalyzingStyle(false);
    }
  };

  // Auto-analyze once if user has uploaded images and not analyzed yet
  useEffect(() => {
    if (campaignImageFiles.length > 0 && !extractedStyle && !isAnalyzingStyle) {
      handleExtractStyle();
    }
  }, [campaignImageFiles.length]);

  // Auto-update prompts when currentScene, archetype, modifiers, camera move, or extractedStyle changes
  useEffect(() => {
    setImagePrompt(
      buildImagePromptFromScene(
        currentScene,
        imageArchetype,
        selectedModifiers,
        extractedStyle?.stylePrompt
      )
    );
    setVideoPrompt(buildVideoPromptFromScene(currentScene, cameraMove));
    setDiarySummary(buildDiarySummaryFromScene(currentScene));
  }, [currentScene, imageArchetype, selectedModifiers, cameraMove, extractedStyle]);

  // Direct AI Generation with Imagen 3
  const handleGenerateAIImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setGenerationError(null);
    try {
      const base64Data = await generateImageWithFailover({
        prompt: imagePrompt,
        aspectRatio: '1:1'
      });
      setAttachedImageUrl(base64Data);

      // Auto link to diary if enabled
      if (autoLinkToDiary && project && onUpdateProject) {
        const title = customSceneTitle.trim() || '🎨 Ilustración de la Escena';
        const summary = diarySummary.trim() || currentScene.slice(0, 300) || imagePrompt;
        const newEntry: TimelineEntry = {
          id: `escena_${hoyAbs}_${Date.now()}`,
          absDay: hoyAbs,
          date: fechaLegibleStr,
          title: title.startsWith('🎨') ? title : `🎨 ${title}`,
          summary,
          tipo: 'escena',
          mood: '🎨',
          images: [base64Data],
          hito: `Escena ilustrada: ${title.replace(/^🎨\s*/, '')}`
        };
        const currentTimeline = project.timeline || [];
        await onUpdateProject({
          timeline: [newEntry, ...currentTimeline]
        });
        setLinkedSuccessMsg({
          text: `¡Ilustración generada con IA y guardada en el Diario del día ${fechaLegibleStr}!`,
          absDay: hoyAbs
        });
      }
    } catch (err: any) {
      console.error('Error generando imagen:', err);
      setGenerationError(describeApiError(err));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Handle direct file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      if (onUploadFile) {
        const url = await onUploadFile(file, 'general');
        setAttachedImageUrl(url);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setAttachedImageUrl(reader.result);
          }
          setIsUploadingImage(false);
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch (err) {
      console.error('Error subiendo imagen:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Link scene/illustration directly to Diary timeline
  const handleLinkSceneToDiary = async () => {
    if (!project || !onUpdateProject) {
      if (handleSendToChat) {
        handleSendToChat(`🎨 [Ilustración de la Escena del Día ${fechaLegibleStr}]: ${imagePrompt}`);
        onClose();
      }
      return;
    }

    const title = customSceneTitle.trim() || '🎨 Ilustración de la Escena';
    const summary = diarySummary.trim() || currentScene.slice(0, 300) || imagePrompt;
    const parsedMin = extraerMinutoDeTexto(`${title} ${summary}`);
    const resolvedMin = (parsedMin !== null && parsedMin !== undefined) ? parsedMin : (fechaSegura.minute || 840);
    
    const newEntry: TimelineEntry = {
      id: `escena_${hoyAbs}_${Date.now()}`,
      absDay: hoyAbs,
      date: fechaLegibleStr,
      minute: resolvedMin,
      title: title.startsWith('🎨') ? title : `🎨 ${title}`,
      summary: summary,
      tipo: 'escena',
      mood: '🎨',
      images: attachedImageUrl ? [attachedImageUrl] : undefined,
      hito: `Escena ilustrada: ${title.replace(/^🎨\s*/, '')}`
    };

    const currentTimeline = project.timeline || [];
    const updatedTimeline = [newEntry, ...currentTimeline];

    await onUpdateProject({
      timeline: updatedTimeline
    });

    setLinkedSuccessMsg({
      text: `¡Escena ilustrada vinculada con éxito al ${fechaLegibleStr}!`,
      absDay: hoyAbs
    });
  };

  // Link summary directly as diary event
  const handleLinkSummaryToDiary = async () => {
    if (!project || !onUpdateProject) {
      if (handleSendToChat) {
        handleSendToChat(`📜 [Acontecimiento para el Diario]: ${diarySummary}`);
        onClose();
      }
      return;
    }

    const title = customSceneTitle.trim() || 'Acontecimiento de la Jornada';
    const summary = diarySummary.trim() || currentScene.slice(0, 300);
    const parsedMin = extraerMinutoDeTexto(`${title} ${summary}`);
    const resolvedMin = (parsedMin !== null && parsedMin !== undefined) ? parsedMin : (fechaSegura.minute || 720);

    const newEntry: TimelineEntry = {
      id: `diario_${hoyAbs}_${Date.now()}`,
      absDay: hoyAbs,
      date: fechaLegibleStr,
      minute: resolvedMin,
      title: title,
      summary: summary,
      tipo: 'diario',
      mood: '✨',
      hito: title
    };

    const currentTimeline = project.timeline || [];
    const updatedTimeline = [newEntry, ...currentTimeline];

    await onUpdateProject({
      timeline: updatedTimeline
    });

    setLinkedSuccessMsg({
      text: `¡Acontecimiento guardado en el Diario del ${fechaLegibleStr}!`,
      absDay: hoyAbs
    });
  };

  // Ambient tracks
  const ambientTracks = [
    {
      id: 'bard_lute',
      name: 'Laúd de Bardo (Balada Fantasía)',
      icon: '🎻',
      desc: 'Arpegios continuos en laúd para narraciones de posada, interpretaciones y romance.',
      tags: ['posada', 'charla', 'viaje', 'laud', 'musica', 'bardo']
    },
    {
      id: 'tavern',
      name: 'Posada & Fuego Acogedor',
      icon: '🍺',
      desc: 'Ambiente cálido y relajante con resonancia armónica para momentos de descanso.',
      tags: ['taberna', 'posada', 'fuego', 'cerveza', 'descanso', 'comida']
    },
    {
      id: 'dungeon',
      name: 'Profundidades & Cripta Oscura',
      icon: '🕯️',
      desc: 'Dron grave y tétrico para exploración subterránea y tensión mágica.',
      tags: ['cripta', 'mazmorra', 'cueva', 'tumba', 'sombra', 'monstruo', 'muerte']
    },
    {
      id: 'battle',
      name: 'Tensión de Combate & Tambores',
      icon: '⚔️',
      desc: 'Pulsos rítmicos de combate táctico para turnos de iniciativa intensa.',
      tags: ['combate', 'pelea', 'lucha', 'arma', 'espada', 'sangre', 'enemigo', 'ataque']
    },
    {
      id: 'elven_forest',
      name: 'Bosque Élfico & Misticismo',
      icon: '🍃',
      desc: 'Armonías etéreas y naturaleza arcana para santuarios y viajes por el bosque.',
      tags: ['bosque', 'elfo', 'magia', 'naturaleza', 'arbol', 'santuario', 'rio']
    }
  ];

  // Smart ambient recommendation based on scene text
  const recommendedTrackId = useMemo(() => {
    if (!currentScene) return null;
    const lower = currentScene.toLowerCase();
    for (const track of ambientTracks) {
      if (track.tags.some(tag => lower.includes(tag))) {
        return track.id;
      }
    }
    return null;
  }, [currentScene]);

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

  const toggleModifier = (mod: string) => {
    setSelectedModifiers(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2500);
  };

  const quickModifiers = [
    'Luz de antorchas y fuego',
    'Niebla densa y misterio',
    'Lluvia tormentosa',
    'Luz de luna llena fría',
    'Rayos de sol volumétricos',
    'Destellos arcanos mágicos',
    'Ángulo dramático contrapicado',
    'Composición cinematográfica 16:9'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[var(--surface)] text-[var(--text-primary)] rounded-2xl shadow-2xl border border-[var(--glass-border)] flex flex-col max-h-[92vh] overflow-hidden font-lora">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--glass-border)] bg-[var(--surface-soft)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-cinzel font-bold text-[var(--text-primary)]">
                Taller Creativo & Estudio de Escena
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Transforma cualquier escena o acontecimiento en ilustraciones, cinemáticas, música y crónica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scene Context Bar (Prominently shows current active scene with toggleable editor) */}
        <div className="px-5 py-2.5 bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))] border-b border-[var(--glass-border)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-cinzel font-bold text-[var(--accent)]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Escena / Acontecimiento de Origen:</span>
            </div>
            <button
              onClick={() => setShowSceneEditor(!showSceneEditor)}
              className="text-[11px] font-cinzel text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              {showSceneEditor ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Ocultar editor de escena
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Editar / Cambiar escena
                </>
              )}
            </button>
          </div>

          {showSceneEditor ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={currentScene}
                onChange={e => setCurrentScene(e.target.value)}
                rows={3}
                placeholder="Pega o escribe aquí el texto de la escena o acontecimiento que deseas crear..."
                className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg p-2.5 text-xs font-lora outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
              />
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>
                  {currentScene.length > 0
                    ? `${currentScene.length} caracteres seleccionados`
                    : 'Sin escena seleccionada (se usarán valores por defecto)'}
                </span>
                {currentScene && (
                  <button
                    onClick={() => setCurrentScene('')}
                    className="text-red-500 hover:underline cursor-pointer"
                  >
                    Vaciar escena
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] italic line-clamp-2 mt-1 m-0">
              {currentScene
                ? `«${currentScene}»`
                : 'Ninguna escena específica seleccionada. Mostrando plantillas de alta fantasía.'}
            </p>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center px-4 pt-2 border-b border-[var(--glass-border)] bg-[var(--surface)] gap-1.5">
          {[
            { id: 'image', label: '🎨 Ilustración de Escena', icon: ImageIcon },
            { id: 'video', label: '🎬 Cinemática de Video', icon: Film },
            { id: 'music', label: '🎵 Bardo & Música', icon: Music },
            { id: 'diary', label: '📜 Resumen de Diario', icon: BookOpen },
            { id: 'voice', label: '🎤 Voz & Dictado', icon: Mic }
          ].map(t => {
            const isSel = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-cinzel font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isSel
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--glass)] rounded-t-lg shadow-2xs'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* TAB 1: IMAGE PROMPTING (ENRICHED BY SCENE) */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              {/* Card de Coherencia de Estilo Visual basada en las Imágenes del Usuario */}
              {campaignImageFiles.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-cinzel font-bold text-purple-700 dark:text-purple-300">
                      <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Estilo Artístico de tus Imágenes Subidas ({campaignImageFiles.length}):</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleExtractStyle}
                      disabled={isAnalyzingStyle}
                      className="px-2.5 py-1 text-[11px] font-cinzel rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-800 dark:text-purple-200 hover:bg-purple-500/20 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isAnalyzingStyle ? 'animate-spin' : ''}`} />
                      {isAnalyzingStyle ? 'Analizando estilo...' : 'Re-analizar estilo'}
                    </button>
                  </div>

                  {/* Miniaturas de las imágenes de referencia */}
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {campaignImageFiles.slice(0, 5).map(img => (
                      <div
                        key={img.id}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-purple-500/30 overflow-hidden shrink-0 shadow-xs"
                      >
                        <img
                          src={img.content}
                          alt={img.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                    <div className="text-[11px] text-[var(--text-secondary)] pl-1 flex-1 min-w-[140px]">
                      {extractedStyle ? (
                        <div>
                          <strong className="text-[var(--text-primary)] font-cinzel">{extractedStyle.styleName}</strong>
                          <div className="text-[10px] text-[var(--text-secondary)] line-clamp-1">
                            {extractedStyle.medium} · {extractedStyle.colorPalette}
                          </div>
                        </div>
                      ) : (
                        <span>Analizando la paleta y estética de tus imágenes subidas para aplicarla a las ilustraciones...</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Archetypes Selector */}
              <div>
                <label className="block text-xs font-cinzel font-bold text-[var(--text-primary)] mb-2">
                  1. Enfoque y Estilo Visual para la Escena:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    ...(campaignImageFiles.length > 0
                      ? [
                          {
                            id: 'uploaded_images',
                            label: '✨ Estilo de tus Imágenes',
                            desc: extractedStyle?.styleName || 'Coherente con tus imágenes subidas'
                          }
                        ]
                      : []),
                    { id: 'classic', label: '🎨 Cuadro Épico (D&D)', desc: 'Óleo clásico, luz dramática' },
                    { id: 'character', label: '👤 Retrato de Personaje', desc: 'Primer plano, expresión e indumentaria' },
                    { id: 'action', label: '⚔️ Acción & Hechizo', desc: 'Movimiento, partículas mágicas y combate' },
                    { id: 'landscape', label: '🗺️ Paisaje Panorámico', desc: 'Gran angular, arquitectura y clima' },
                    { id: 'grimdark', label: '🕯️ Grimdark & Claroscuro', desc: 'Tenebrismo, sombras marcadas, estilo Witcher' },
                    { id: 'woodcut', label: '📜 Grabado Medieval', desc: 'Xilografía clásica en pergamino' }
                  ].map(arch => (
                    <button
                      key={arch.id}
                      onClick={() => setImageArchetype(arch.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        imageArchetype === arch.id
                          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] ring-1 ring-[var(--accent)]'
                          : 'border-[var(--glass-border)] bg-[var(--surface-soft)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      <div className="text-xs font-cinzel font-bold text-[var(--text-primary)]">
                        {arch.label}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                        {arch.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modifiers Chips */}
              <div>
                <label className="block text-xs font-cinzel font-bold text-[var(--text-primary)] mb-1.5">
                  2. Modificadores de Atmósfera (Opcionales):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {quickModifiers.map(mod => {
                    const isSelected = selectedModifiers.includes(mod);
                    return (
                      <button
                        key={mod}
                        onClick={() => toggleModifier(mod)}
                        className={`text-[11px] font-cinzel px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] font-bold shadow-2xs'
                            : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] border-[var(--user-border)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {mod}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt Output Box & Generación Directa con IA */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--accent)] bg-[var(--surface-soft)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" /> Prompt de Ilustración:
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Compatible con Imagen 3, Midjourney, DALL-E y Stable Diffusion
                  </span>
                </div>
                <textarea
                  value={imagePrompt}
                  onChange={e => setImagePrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg p-2.5 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
                />

                {generationError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{generationError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateAIImage}
                      disabled={isGeneratingImage || !imagePrompt.trim()}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-purple-700 to-[var(--accent)] text-white rounded-lg text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pintando con IA...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" /> Generar con IA (Imagen 3)
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => copyToClipboard(imagePrompt, 'image_prompt')}
                      className="px-3 py-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--bg-color)] text-xs font-cinzel font-bold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      {copiedPrompt === 'image_prompt' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar Prompt
                        </>
                      )}
                    </button>
                  </div>

                  {handleSendToChat && (
                    <button
                      onClick={() => {
                        handleSendToChat(`🎨 [Ilustración de la Escena]: ${imagePrompt}`);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--user-border)] hover:border-[var(--accent)] text-[var(--text-primary)] rounded-lg text-xs font-cinzel font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Insertar en Chat
                    </button>
                  )}
                </div>
              </div>

              {/* Vincular Ilustración a la Cronología / Diario */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-soft)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-cinzel font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <BookmarkPlus className="w-3.5 h-3.5 text-[var(--accent)]" /> Guardar en el Diario de Campaña ({fechaLegibleStr})
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoLinkToDiary}
                      onChange={e => setAutoLinkToDiary(e.target.checked)}
                      className="accent-[var(--accent)] rounded"
                    />
                    <span>Auto-guardar al generar con IA</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={customSceneTitle}
                      onChange={e => setCustomSceneTitle(e.target.value)}
                      placeholder="Título de la escena ilustrada (opcional)..."
                      className="flex-1 bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  {/* Vista previa de la imagen generada o adjunta */}
                  {attachedImageUrl && (
                    <div className="p-2.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--bg-color)] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={attachedImageUrl}
                          alt="Ilustración generada o vinculada"
                          className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-[var(--user-border)] shrink-0 shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-cinzel font-bold text-emerald-700 dark:text-emerald-300 truncate">
                            ✓ Ilustración lista para el Diario
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] line-clamp-1">
                            Corresponde a la jornada: {fechaLegibleStr}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachedImageUrl('')}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer"
                        title="Quitar imagen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Imagen adjunta o seleccionada */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="px-3 py-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--bg-color)] text-xs font-cinzel font-bold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" /> {isUploadingImage ? 'Subiendo...' : 'Subir Imagen Local'}
                    </button>

                    {campaignImageFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowImagePicker(!showImagePicker)}
                        className="px-3 py-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--bg-color)] text-xs font-cinzel font-bold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Elegir de Archivos ({campaignImageFiles.length})
                      </button>
                    )}

                    {attachedImageUrl && !linkedSuccessMsg && (
                      <button
                        type="button"
                        onClick={handleLinkSceneToDiary}
                        className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-2xs hover:bg-[var(--accent-hover)] cursor-pointer ml-auto"
                      >
                        <Plus className="w-3.5 h-3.5" /> Guardar en el Diario
                      </button>
                    )}
                  </div>

                  {showImagePicker && campaignImageFiles.length > 0 && (
                    <div className="p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--bg-color)] max-h-36 overflow-y-auto grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {campaignImageFiles.map(imgFile => (
                        <div
                          key={imgFile.id}
                          onClick={() => {
                            setAttachedImageUrl(imgFile.content);
                            setShowImagePicker(false);
                          }}
                          className="relative group aspect-square rounded-lg overflow-hidden border border-[var(--user-border)] hover:border-[var(--accent)] cursor-pointer"
                        >
                          <img
                            src={imgFile.content}
                            alt={imgFile.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {linkedSuccessMsg && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                    <span>{linkedSuccessMsg.text}</span>
                    {onNavigateToDiary && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigateToDiary(linkedSuccessMsg.absDay);
                          onClose();
                        }}
                        className="font-bold underline flex items-center gap-1 cursor-pointer hover:text-emerald-600"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Abrir Día en el Diario ({fechaLegibleStr})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: VIDEO CINEMATIC PROMPTING */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-cinzel font-bold text-[var(--text-primary)] mb-2">
                  1. Movimiento de Cámara Cinemático para la Escena:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'pan', label: '🎥 Barrido Panorámico', desc: 'Movimiento lateral suave' },
                    { id: 'drone', label: '🦅 Travelling Aéreo', desc: 'Toma cenital y elevación' },
                    { id: 'push', label: '🔍 Acercamiento Intenso', desc: 'Push-in dramático a personajes' },
                    { id: 'orbit', label: '🔄 Giro Orbital 360°', desc: 'Rotación cinematográfica' }
                  ].map(cam => (
                    <button
                      key={cam.id}
                      onClick={() => setCameraMove(cam.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        cameraMove === cam.id
                          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] ring-1 ring-[var(--accent)]'
                          : 'border-[var(--glass-border)] bg-[var(--surface-soft)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      <div className="text-xs font-cinzel font-bold text-[var(--text-primary)]">
                        {cam.label}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                        {cam.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Prompt Output Box */}
              <div className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--surface-soft)] space-y-3">
                <span className="text-xs font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" /> Prompt Cinemático (Runway Gen-3 / Luma Dream Machine / Sora / Veo):
                </span>
                <textarea
                  value={videoPrompt}
                  onChange={e => setVideoPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg p-2.5 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => copyToClipboard(videoPrompt, 'video_prompt')}
                    className="px-3 py-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--bg-color)] text-xs font-cinzel font-bold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {copiedPrompt === 'video_prompt' ? (
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
                      className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-2xs hover:bg-[var(--accent-hover)] cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Insertar en la Historia
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MUSIC & BARDO (WITH SCENE RECOMMENDATION) */}
          {activeTab === 'music' && (
            <div className="space-y-4">
              <div className="bg-[var(--glass)] p-4 rounded-xl border border-[var(--glass-border)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[var(--accent)] animate-pulse" />
                    <h4 className="text-xs font-cinzel font-bold text-[var(--text-primary)]">
                      Banda Sonora & Paisajes Sonoros Sintetizados
                    </h4>
                  </div>
                  {activeSoundtrack && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      ● Reproduciendo de fondo
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                  Melodías ambientales interactivas que suenan de fondo en segundo plano mientras juegas, sin consumir cuota.
                </p>

                {/* Track list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ambientTracks.map(track => {
                    const isPlayingThis = activeSoundtrack === track.id;
                    const isRecommended = recommendedTrackId === track.id;
                    return (
                      <div
                        key={track.id}
                        onClick={() => handleToggleAudio(track.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                          isPlayingThis
                            ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-md scale-[1.02]'
                            : isRecommended
                              ? 'bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface-soft))] border-[var(--accent)]/60 text-[var(--text-primary)] ring-1 ring-[var(--accent)]/40'
                              : 'bg-[var(--surface-soft)] text-[var(--text-primary)] border-[var(--glass-border)] hover:border-[var(--accent)]'
                        }`}
                      >
                        {isRecommended && !isPlayingThis && (
                          <span className="absolute top-2 right-2 text-[9px] font-cinzel font-bold px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--on-accent)]">
                            ✨ Sugerida para la escena
                          </span>
                        )}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xl">{track.icon}</span>
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
                  <span className="text-xs font-mono w-8 text-right text-[var(--text-secondary)]">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              {/* External Music Links Helper (YouTube / Spotify) */}
              <div className="p-3.5 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-soft)] space-y-2">
                <span className="text-xs font-cinzel font-bold text-[var(--text-primary)]">
                  🎵 Enlace de Música de YouTube / Spotify para la Escena
                </span>
                <p className="text-[11px] text-[var(--text-secondary)] m-0">
                  Si prefieres una pista orquestal de YouTube o Spotify, introduce el enlace aquí para insertarla en el chat con reproductor integrado:
                </p>
                <div className="flex gap-2">
                  <input
                    value={customMusicUrl}
                    onChange={e => setCustomMusicUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... o Spotify URL"
                    className="flex-1 bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)] font-mono"
                  />
                  {handleSendToChat && (
                    <button
                      onClick={() => {
                        if (customMusicUrl.trim()) {
                          handleSendToChat(`🎵 ${customMusicUrl.trim()}`);
                          setCustomMusicUrl('');
                          onClose();
                        }
                      }}
                      disabled={!customMusicUrl.trim()}
                      className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Insertar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIARY / CHRONICLE SUMMARY GENERATOR */}
          {activeTab === 'diary' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--surface-soft)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-cinzel font-bold text-[var(--accent)] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Resumen de la Escena para el Diario / Crónica:
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] m-0">
                  Este resumen sintético recoge los sucesos clave de la escena para guardarlos como acontecimiento en la Agenda o añadirlo al Diario de Campaña:
                </p>
                <textarea
                  value={diarySummary}
                  onChange={e => setDiarySummary(e.target.value)}
                  rows={4}
                  placeholder="Resumen del acontecimiento..."
                  className="w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg p-2.5 text-xs font-lora text-[var(--text-primary)] outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => copyToClipboard(diarySummary, 'diary_summary')}
                    className="px-3 py-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--bg-color)] text-xs font-cinzel font-bold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {copiedPrompt === 'diary_summary' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> ¡Copiado al Portapapeles!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Resumen
                      </>
                    )}
                  </button>

                  {handleSendToChat && (
                    <button
                      onClick={() => {
                        handleSendToChat(`📜 [Acontecimiento de Crónica]: ${diarySummary}`);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-2xs hover:bg-[var(--accent-hover)] cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Insertar en el Chat
                    </button>
                  )}
                </div>

                <div className="pt-2 space-y-2 border-t border-[var(--glass-border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-cinzel font-bold text-[var(--text-primary)]">
                      Guardar como Acontecimiento en la Cronología del {fechaLegibleStr}:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLinkSummaryToDiary}
                    className="px-3.5 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] rounded-lg text-xs font-cinzel font-bold flex items-center gap-1.5 shadow-2xs hover:bg-[var(--accent-hover)] cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" /> Guardar en el Diario ({fechaLegibleStr})
                  </button>

                  {linkedSuccessMsg && (
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
                      <span>{linkedSuccessMsg.text}</span>
                      {onNavigateToDiary && (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToDiary(linkedSuccessMsg.absDay);
                            onClose();
                          }}
                          className="font-bold underline ml-2 flex items-center gap-1 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" /> Ver en Diario
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: VOICE INPUT GUIDELINES */}
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
                  Ya puedes hablarle directamente a tu Narrador con el botón del micrófono integrado en la barra de chat. Tus palabras se transcribirán en tiempo real.
                </p>
                <div className="p-3 bg-[var(--surface-soft)] rounded-lg text-xs text-[var(--text-secondary)] text-left max-w-md mx-auto space-y-1.5 border border-[var(--glass-border)]">
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
