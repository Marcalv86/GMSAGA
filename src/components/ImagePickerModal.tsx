import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectFile, FileCategory } from '../types';
import { optimizeImageFile } from '../utils/fileStorage';
import {
  Castle,
  Check,
  ClipboardPaste,
  Drama,
  ExternalLink,
  FileImage,
  Info,
  Link,
  Loader2,
  Search,
  Shield,
  UploadCloud,
  X
} from 'lucide-react';

export interface ImagePickerTarget {
  type: 'player' | 'npc' | 'location' | 'item';
  id: string;
  name: string;
  desc?: string;
}

interface ImagePickerModalProps {
  target: ImagePickerTarget;
  allImageFiles: ProjectFile[];
  onSelectImage: (content: string) => void;
  onUploadFile?: (file: File, category?: FileCategory) => Promise<string>;
  onClose: () => void;
}

interface PinterestPreset {
  label: string;
  query: string;
}

function extractCharacterTraits(text: string) {
  const lower = text.toLowerCase();

  // 1. Race Detection
  let race = '';
  if (/drow|elfo\s+oscuro|dark\s+elf/i.test(lower)) {
    race = 'drow';
  } else if (/semielf[oa]|half-?elf/i.test(lower)) {
    race = 'half-elf';
  } else if (/shadar-?kai/i.test(lower)) {
    race = 'shadar-kai elf';
  } else if (/eladrin/i.test(lower)) {
    race = 'eladrin elf';
  } else if (/elf[oa]\s+de\s+los\s+bosques|wood\s+elf/i.test(lower)) {
    race = 'wood elf';
  } else if (/alto\s+elf[oa]|high\s+elf/i.test(lower)) {
    race = 'high elf';
  } else if (/elf[oa]|elf\b|elven/i.test(lower)) {
    race = 'elf';
  } else if (/duergar/i.test(lower)) {
    race = 'duergar dwarf';
  } else if (/enan[oa]|dwarf|dwarven/i.test(lower)) {
    race = 'dwarf';
  } else if (/tiefling|tiflin/i.test(lower)) {
    race = 'tiefling';
  } else if (/semiorc[oa]|half-?orc/i.test(lower)) {
    race = 'half-orc';
  } else if (/orc[oa]|orc\b/i.test(lower)) {
    race = 'orc';
  } else if (/drac[oó]nid[oa]|dragonborn/i.test(lower)) {
    race = 'dragonborn';
  } else if (/median[oa]|halfling|hobbit/i.test(lower)) {
    race = 'halfling';
  } else if (/svirfneblin/i.test(lower)) {
    race = 'svirfneblin deep gnome';
  } else if (/gnom[oa]|gnome/i.test(lower)) {
    race = 'gnome';
  } else if (/tabaxi|felin[oa]|catfolk/i.test(lower)) {
    race = 'tabaxi catfolk';
  } else if (/aasimar|celestial/i.test(lower)) {
    race = 'aasimar';
  } else if (/genas[ií]|genasi/i.test(lower)) {
    if (/fuego|fire/i.test(lower)) race = 'fire genasi';
    else if (/agua|water/i.test(lower)) race = 'water genasi';
    else if (/aire|air/i.test(lower)) race = 'air genasi';
    else if (/tierra|earth/i.test(lower)) race = 'earth genasi';
    else race = 'genasi';
  } else if (/goliat|goliath/i.test(lower)) {
    race = 'goliath';
  } else if (/trit[oó]n|triton|siren[ao]|merfolk/i.test(lower)) {
    race = 'triton';
  } else if (/kenku|aarakocra|owlin|ave/i.test(lower)) {
    race = 'aarakocra birdfolk';
  } else if (/goblin|trasgo/i.test(lower)) {
    race = 'goblin';
  } else if (/hobgoblin/i.test(lower)) {
    race = 'hobgoblin';
  } else if (/bugbear|osgo/i.test(lower)) {
    race = 'bugbear';
  } else if (/kobold/i.test(lower)) {
    race = 'kobold';
  } else if (/cambiante|changeling|shifter/i.test(lower)) {
    race = 'changeling';
  } else if (/yuan-?ti/i.test(lower)) {
    race = 'yuan-ti';
  } else if (/human[oa]|human\b/i.test(lower)) {
    race = 'human';
  }

  // 2. Class / Archetype / Profession
  let job = '';
  if (/corsari[oa]|pirata|swashbuckler|bucaner[oa]|corsair|pirate|marinero|sailor/i.test(lower)) {
    job = 'pirate corsair swashbuckler';
  } else if (/p[ií]car[oa]|rogue|ladr[oó]n|ladrona|thief|asesin[oa]|assassin|esp[ií]a/i.test(lower)) {
    job = 'rogue assassin';
  } else if (/palad[ií]n|paladina|paladin|cruzad[oa]|templari[oa]/i.test(lower)) {
    job = 'paladin';
  } else if (/b[aá]rbar[oa]|barbarian|berserker/i.test(lower)) {
    job = 'barbarian';
  } else if (/guerrer[oa]|fighter|warrior|caballer[oa]|knight|soldad[oa]|mercenari[oa]/i.test(lower)) {
    job = 'fighter warrior';
  } else if (/bruj[oa]|warlock/i.test(lower)) {
    job = 'warlock';
  } else if (/hechicer[oa]|sorcerer/i.test(lower)) {
    job = 'sorcerer';
  } else if (/nigromante|necromancer/i.test(lower)) {
    job = 'necromancer mage';
  } else if (/mag[oa]|wizard|mage|ilusionista|archimag[oa]/i.test(lower)) {
    job = 'wizard mage';
  } else if (/cl[eé]rig[oa]|cleric|sacerdot[ea]|priest|curandero/i.test(lower)) {
    job = 'cleric priest';
  } else if (/druida|druid|cham[aá]n/i.test(lower)) {
    job = 'druid';
  } else if (/explorador|exploradora|ranger|cazador|cazadora|hunter/i.test(lower)) {
    job = 'ranger hunter';
  } else if (/bard[oa]|bard|juglar|trovador/i.test(lower)) {
    job = 'bard';
  } else if (/monje|monja|monk/i.test(lower)) {
    job = 'monk';
  } else if (/art[ií]fice|artificer|alquimista|alchemist/i.test(lower)) {
    job = 'artificer';
  } else if (/capit[aá]n|capitana|captain/i.test(lower)) {
    job = 'captain';
  }

  // 3. Gender
  let gender = '';
  if (/mujer|femenin[oa]|female|woman|chica|dama|lady|corsaria|guerrera|maga|bruja|ladrona/i.test(lower)) {
    gender = 'female';
  } else if (/hombre|masculin[oa]|male|man|var[oó]n|corsario|guerrero|mago|brujo|ladrón|caballero/i.test(lower)) {
    gender = 'male';
  }

  return { race, job, gender };
}

function computeSmartPinterestConfig(target: ImagePickerTarget) {
  const rawName = (target.name || '').trim();
  const name = rawName || (target.type === 'location' ? 'Lugar' : target.type === 'item' ? 'Objeto' : 'Personaje');
  const lower = (name + ' ' + (target.desc || '')).toLowerCase();

  if (target.type === 'location') {
    const isSea = /mar|oc[ée]ano|costa|bah[ií]a|playa|arrecife|estrecho|abismo\s+marino|isla|archipi[ée]lago/i.test(lower);
    const isShip = /nav[ií]o|barco|corsario|pirata|gale[oó]n|fragata|velero|carabela|bergant[ií]n|embarcaci[oó]n|buque|bote/i.test(lower);
    const isTavern = /taberna|posada|cantina|mes[oó]n|bodega|hostal|sal[oó]n/i.test(lower);
    const isCastle = /castillo|fortaleza|torre|ciudadela|alc[aá]zar|palacio|basti[oó]n|muralla|reino/i.test(lower);
    const isNature = /bosque|selva|pantano|ci[eé]naga|arboleda|valle|monta[ñn]a|caverna|cueva|desierto/i.test(lower);
    const isDungeon = /mazmorra|cripta|catacumba|ruinas|tumba|templo|santuario|mina|subterr[aá]neo/i.test(lower);
    const isCity = /ciudad|pueblo|aldea|villa|puerto|callej[oó]n|mercado|distrito|capital/i.test(lower);

    let defaultQuery = `${name} dnd fantasy landscape environment scenery art`;
    if (isShip) {
      defaultQuery = `${name} fantasy pirate ship vessel exterior interior battlemap concept art`;
    } else if (isSea) {
      defaultQuery = `${name} fantasy ocean sea coast landscape digital art`;
    } else if (isTavern) {
      defaultQuery = `${name} dnd fantasy tavern inn interior concept art`;
    } else if (isCastle) {
      defaultQuery = `${name} dnd fantasy castle fortress architecture environment art`;
    } else if (isNature) {
      defaultQuery = `${name} dnd fantasy wilderness forest landscape environment art`;
    } else if (isDungeon) {
      defaultQuery = `${name} dnd fantasy dungeon crypt ruins concept art`;
    } else if (isCity) {
      defaultQuery = `${name} dnd fantasy city town harbor street landscape art`;
    }

    const presets: PinterestPreset[] = [
      { label: '🌄 Exterior / Paisaje', query: `${name} dnd fantasy landscape environment scenery art` },
      { label: '🏰 Interior / Edificio', query: `${name} dnd fantasy interior room architecture concept art` },
      { label: '🗺️ Mapa / Battlemap', query: `${name} dnd rpg battlemap grid map cartography` },
      { label: '⛵ Navío / Barco', query: `${name} fantasy pirate ship vessel interior exterior concept art` },
      { label: '🌫️ Mazmorra / Ruinas', query: `${name} dnd fantasy dungeon crypt ruins battlemap` },
      { label: '🎨 Arte Conceptual', query: `${name} fantasy environment location concept art digital painting` }
    ];

    return {
      modalTitle: `Seleccionar Imagen o Mapa: ${name}`,
      entityLabel: 'lugar o escenario',
      boxTitle: '📌 1. Abrir búsqueda en Pinterest',
      boxSubtitle: `Encuentra ilustraciones para exteriores, interiores, navíos y mapas para ${name}.`,
      defaultQuery,
      presets,
      defaultCategory: 'map' as FileCategory
    };
  }

  if (target.type === 'item') {
    const presets: PinterestPreset[] = [
      { label: '🗡️ Arma / Artefacto', query: `${name} dnd fantasy magic weapon artifact concept art` },
      { label: '📜 Reliquia / Objeto', query: `${name} dnd magic item relic prop illustration` },
      { label: '🧪 Poción / Alquimia', query: `${name} fantasy potion alchemy bottle prop art` },
      { label: '🛡️ Armadura / Escudo', query: `${name} dnd fantasy armor shield concept art` }
    ];

    return {
      modalTitle: `Seleccionar Imagen de Objeto: ${name}`,
      entityLabel: 'objeto o equipamiento',
      boxTitle: '📌 1. Abrir búsqueda en Pinterest',
      boxSubtitle: `Ilustraciones de armas, reliquias y accesorios mágicos para ${name}.`,
      defaultQuery: `${name} dnd fantasy item magic weapon artifact concept art`,
      presets,
      defaultCategory: 'scene' as FileCategory
    };
  }

  // Characters (Protagonist / NPC)
  const traits = extractCharacterTraits(`${name} ${target.desc || ''}`);
  const descriptors: string[] = [];
  if (traits.race) descriptors.push(traits.race);
  if (traits.job) descriptors.push(traits.job);
  if (traits.gender) descriptors.push(traits.gender);

  const charDescriptor = descriptors.length > 0 ? descriptors.join(' ') : name;
  const isPirate = /pirate|corsair|swashbuckler/i.test(charDescriptor);
  const isDrow = /drow/i.test(charDescriptor);

  const presets: PinterestPreset[] = [
    { label: '🎭 Retrato', query: `${charDescriptor} dnd fantasy portrait character art` },
    { label: '🥋 Cuerpo Entero', query: `${charDescriptor} dnd fantasy character concept art full body illustration` },
    { label: '🪙 Token / Miniatura', query: `${charDescriptor} dnd tabletop token portrait rpg` },
    { label: '⚔️ En Acción', query: `${charDescriptor} dnd fantasy character combat action pose art` }
  ];

  if (isPirate) {
    presets.push({ label: '⛵ A Bordo / Barco', query: `${charDescriptor} ship deck pirate fantasy character art` });
  }
  if (isDrow) {
    presets.push({ label: '🌌 Underdark', query: `${charDescriptor} underdark fantasy character art` });
  }

  const defaultQuery = `${charDescriptor} dnd fantasy character portrait art`;

  return {
    modalTitle: `Seleccionar Retrato: ${name}`,
    entityLabel: target.type === 'player' ? 'protagonista' : 'PNJ',
    boxTitle: '📌 1. Abrir búsqueda en Pinterest',
    boxSubtitle: `Retratos, tokens y arte de fantasía para ${name}${descriptors.length > 0 ? ` (${descriptors.join(', ')})` : ''}.`,
    defaultQuery,
    presets,
    defaultCategory: (target.type === 'player' ? 'portrait_pj' : 'portrait_npc') as FileCategory
  };
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  target,
  allImageFiles,
  onSelectImage,
  onUploadFile,
  onClose
}) => {
  const config = useMemo(() => computeSmartPinterestConfig(target), [target]);
  const [searchQuery, setSearchQuery] = useState(config.defaultQuery);
  const [filterCategory, setFilterCategory] = useState<'all' | 'map' | 'scene' | 'portrait'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  const executePinterestSearch = (queryToSearch: string) => {
    const term = queryToSearch.trim();
    if (!term) return;
    const encoded = encodeURIComponent(term);
    window.open(`https://www.pinterest.com/search/pins/?q=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  const handleApplyPreset = (preset: PinterestPreset) => {
    setSearchQuery(preset.query);
    executePinterestSearch(preset.query);
  };

  // Helper to ingest and assign a File (from paste, drag or local browse)
  const processAndAssignFile = async (file: File) => {
    setIsProcessing(true);
    try {
      let finalUrl = '';
      if (onUploadFile) {
        finalUrl = await onUploadFile(file, config.defaultCategory);
      } else {
        finalUrl = await optimizeImageFile(file);
      }

      if (finalUrl) {
        onSelectImage(finalUrl);
        showToast('¡Imagen importada y asignada con éxito!', 'success');
      } else {
        showToast('No se pudo procesar la imagen.', 'error');
      }
    } catch (err) {
      console.error('Error importing image:', err);
      showToast('Error al importar la imagen.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to process an Image URL (from Pinterest or any web URL)
  const processAndAssignUrl = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    setIsProcessing(true);
    try {
      let fileToUpload: File | null = null;
      try {
        const res = await fetch(trimmed);
        if (res.ok) {
          const blob = await res.blob();
          const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
          const ext = mime.split('/')[1] || 'jpg';
          const cleanName = (target.name || 'imagen').replace(/[^a-zA-Z0-9_-]/g, '_');
          fileToUpload = new File([blob], `${cleanName}_${Date.now()}.${ext}`, { type: mime });
        }
      } catch {
        // Direct fetch blocked by CORS; we will use the URL directly
      }

      if (fileToUpload) {
        await processAndAssignFile(fileToUpload);
      } else {
        // Fallback: assign directly as URL
        onSelectImage(trimmed);
        showToast('¡Enlace de imagen asignado!', 'success');
      }
      setUrlInput('');
      setShowUrlInput(false);
    } catch (err) {
      console.error('Error processing URL:', err);
      showToast('Error al procesar la URL.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Clipboard Paste listener (captures Ctrl+V anywhere in the modal)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept if user is typing in standard text inputs (unless it's an image payload)
      const targetElement = e.target as HTMLElement;
      const isInput = targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA');

      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
              const cleanName = (target.name || 'imagen').replace(/[^a-zA-Z0-9_-]/g, '_');
              const file = new File([blob], `${cleanName}_pasted_${Date.now()}.png`, { type: blob.type || 'image/png' });
              await processAndAssignFile(file);
              return;
            }
          }
        }
      }

      // If user pasted a URL and wasn't typing inside an input
      if (!isInput) {
        const text = e.clipboardData?.getData('text');
        if (text && /^https?:\/\//i.test(text.trim())) {
          e.preventDefault();
          await processAndAssignUrl(text.trim());
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [target, config.defaultCategory, onUploadFile]);

  // Read clipboard via Clipboard API when clicking the "Pegar del portapapeles" button
  const handlePasteFromClipboardBtn = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const cleanName = (target.name || 'imagen').replace(/[^a-zA-Z0-9_-]/g, '_');
              const file = new File([blob], `${cleanName}_pasted_${Date.now()}.png`, { type });
              await processAndAssignFile(file);
              return;
            }
          }
        }
      }
      
      // Fallback: check text in clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && /^https?:\/\//i.test(text.trim())) {
          await processAndAssignUrl(text.trim());
          return;
        }
      }
      showToast('No se encontró una imagen en el portapapeles. Copia una imagen de Pinterest y pulsa Ctrl+V.', 'error');
    } catch {
      showToast('Pulsa Ctrl + V para pegar la imagen copiada desde Pinterest.', 'error');
    }
  };

  const filteredImages = useMemo(() => {
    if (filterCategory === 'all') return allImageFiles;
    if (filterCategory === 'map') return allImageFiles.filter(f => f.category === 'map');
    if (filterCategory === 'scene') return allImageFiles.filter(f => f.category === 'scene');
    if (filterCategory === 'portrait') {
      return allImageFiles.filter(f => f.category === 'portrait_pj' || f.category === 'portrait_npc' || f.category === 'portrait_companion');
    }
    return allImageFiles;
  }, [allImageFiles, filterCategory]);

  useEffect(() => {
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
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-2xs"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            await processAndAssignFile(file);
          }
        }
      }}
    >
      <div className="bg-[var(--bg-color)] p-4 sm:p-6 rounded-xl shadow-2xl border border-[var(--glass-border)] w-[680px] max-w-full font-lora max-h-[94vh] flex flex-col relative overflow-hidden">
        {/* Dragging Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-[var(--accent)]/20 border-2 border-dashed border-[var(--accent)] z-50 flex flex-col items-center justify-center backdrop-blur-2xs gap-2">
            <UploadCloud className="w-12 h-12 text-[var(--accent)] animate-bounce" />
            <span className="font-cinzel text-lg font-bold text-[var(--text-primary)]">
              Suelta la imagen para importarla y asignarla
            </span>
          </div>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/50 z-40 flex flex-col items-center justify-center backdrop-blur-2xs gap-2 text-white font-cinzel">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <span className="text-sm font-semibold">Procesando y guardando imagen...</span>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--user-border)] text-[var(--accent)] mt-0.5 shrink-0">
              {target.type === 'location' ? (
                <Castle className="w-5 h-5" />
              ) : target.type === 'item' ? (
                <Shield className="w-5 h-5" />
              ) : (
                <Drama className="w-5 h-5" />
              )}
            </div>
            <div>
              <h4 className="font-cinzel text-base sm:text-lg text-[var(--accent)] font-bold m-0 flex items-center gap-2">
                {config.modalTitle}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 m-0">
                Selecciona arte existente o importa ilustraciones al instante desde Pinterest o tu equipo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert / Toast */}
        {feedbackMsg && (
          <div
            className={`mb-3 px-3 py-2 rounded-lg text-xs font-cinzel font-semibold flex items-center gap-2 border transition-all ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
            }`}
          >
            {feedbackMsg.type === 'success' ? <Check className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Step 1: Pinterest Smart Search */}
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
            <span className="font-cinzel font-bold text-xs text-red-700 dark:text-red-300">
              {config.boxTitle}
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              {config.boxSubtitle}
            </span>
          </div>

          {/* Search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executePinterestSearch(searchQuery);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Términos de búsqueda..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-lg text-xs outline-none focus:border-red-500 text-[var(--text-primary)] transition-all"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-cinzel text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Abrir búsqueda en Pinterest"
            >
              <span>Buscar en Pinterest</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </form>

          {/* Quick preset pills */}
          <div className="space-y-1">
            <span className="text-[10px] font-cinzel uppercase tracking-wider font-bold text-[var(--text-secondary)] block">
              Sugerencias de búsqueda:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {config.presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2 py-1 rounded-md bg-[var(--surface)] hover:bg-red-500/20 text-[11px] font-cinzel text-[var(--text-primary)] border border-[var(--user-border)] hover:border-red-400 transition-all cursor-pointer flex items-center gap-1"
                  title={`Buscar: "${preset.query}"`}
                >
                  <span>{preset.label}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2: Instant Import from Clipboard / URL / Local File */}
        <div className="mb-3 p-3 bg-[var(--surface)] border border-[var(--user-border)] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5">
              <ClipboardPaste className="w-3.5 h-3.5" /> 2. Importar al instante (Pegado con Ctrl + V)
            </span>
            <span className="text-[10px] bg-[var(--glass)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--glass-border)]">
              Atajo: <kbd className="font-mono font-bold">Ctrl + V</kbd>
            </span>
          </div>

          <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            En Pinterest haz <strong>Clic Derecho → Copiar imagen</strong> (o copiar enlace). Luego presiona <strong className="text-[var(--text-primary)]">Ctrl + V</strong> aquí o usa los botones rápidos:
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handlePasteFromClipboardBtn}
              className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] rounded-lg font-cinzel text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Pegar imagen copiada del portapapeles"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Pegar Imagen Copiada</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-[var(--glass)] hover:bg-[var(--sidebar-bg)] text-[var(--text-primary)] border border-[var(--glass-border)] rounded-lg font-cinzel text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              title="Subir imagen desde tu ordenador"
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>Subir Archivo Local</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="px-2.5 py-1.5 bg-[var(--glass)] hover:bg-[var(--sidebar-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--glass-border)] rounded-lg font-cinzel text-xs flex items-center gap-1 transition-all cursor-pointer"
              title="Pegar enlace web directo"
            >
              <Link className="w-3.5 h-3.5" />
              <span>Pegar URL</span>
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  await processAndAssignFile(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {/* Collapsible URL input */}
          {showUrlInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                processAndAssignUrl(urlInput);
              }}
              className="flex gap-2 pt-2 border-t border-[var(--glass-border)]"
            >
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://i.pinimg.com/... o enlace de imagen..."
                className="flex-1 px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--user-border)] rounded-lg text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] transition-all"
                autoFocus
              />
              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="px-3 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-50 rounded-lg font-cinzel text-xs font-semibold cursor-pointer transition-all"
              >
                Importar
              </button>
            </form>
          )}
        </div>

        {/* Campaign Files Selector */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-cinzel font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            O elige de la Campaña ({filteredImages.length})
          </span>
          <div className="flex gap-1 text-[11px] font-cinzel">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                filterCategory === 'all'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
              }`}
            >
              Todas
            </button>
            {target.type === 'location' ? (
              <>
                <button
                  type="button"
                  onClick={() => setFilterCategory('map')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    filterCategory === 'map'
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                  }`}
                >
                  Mapas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('scene')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    filterCategory === 'scene'
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                  }`}
                >
                  Escenas
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setFilterCategory('portrait')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                  filterCategory === 'portrait'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                }`}
              >
                Retratos
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 min-h-[140px]">
          {filteredImages.length === 0 ? (
            <div className="py-6 px-4 text-center text-xs text-[var(--text-secondary)] italic bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] rounded-lg border border-[var(--user-border)] leading-relaxed">
              No hay imágenes guardadas en esta categoría todavía. ¡Puedes pegar cualquier imagen copiada con <strong>Ctrl + V</strong> para añadirla!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => onSelectImage(img.content)}
                  className="group bg-[var(--surface)] rounded-lg border border-[var(--user-border)] overflow-hidden cursor-pointer hover:border-[var(--accent)] hover:shadow-md transition-all flex flex-col"
                >
                  <div className="h-24 bg-black/5 overflow-hidden flex items-center justify-center relative">
                    <img
                      src={img.content}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-cinzel font-bold gap-1">
                      <Check className="w-3.5 h-3.5" /> Seleccionar
                    </div>
                  </div>
                  <div
                    className="p-1.5 text-[11px] font-cinzel font-bold truncate text-[var(--text-primary)]"
                    title={img.name}
                  >
                    {img.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 mt-3 pt-2.5 border-t border-[var(--glass-border)]">
          <button
            onClick={() => onSelectImage('')}
            className="px-3 py-1.5 text-xs font-cinzel text-red-700 dark:text-red-400 hover:text-red-900 border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-all"
          >
            Quitar Imagen
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface)] cursor-pointer transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
