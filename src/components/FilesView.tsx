import React, { useState, useRef, useMemo } from 'react';
import { Project, ProjectFile, FileCategory } from '../types';
import { classifyFileAuto } from '../utils/geminiHelper';
import { recuperar } from '../utils/localSearch';

import {
  BookOpen,
  Brain,
  Download,
  Drama,
  Image,
  Map,
  Pin,
  RefreshCw,
  Save,
  Scissors,
  Scroll,
  Search,
  Sparkles,
  Star,
  Trash2,
  X
} from 'lucide-react';
export const FilesView: React.FC<{
  project: Project;
  files: ProjectFile[];
  onUpload: (files: File[]) => void;
  onDeleteFile: (file: ProjectFile) => Promise<void>;
  onOpenMap: (file: ProjectFile) => void;
  onAnalyzeImageFile?: (file: ProjectFile) => Promise<void>;
  onUpdateFileAnalysis?: (fileId: string, analysis: string) => Promise<void>;
  onDeleteFileAnalysis?: (fileId: string) => Promise<void>;
  onUpdateFileCategory?: (fileId: string, category: FileCategory) => Promise<void>;
  onToggleOnDemand?: (fileId: string, onDemand: boolean) => Promise<void>;
  /** Deja de una hoja de oráculo solo las tablas y las reglas. */
  onDistillOracle?: (file: ProjectFile) => Promise<void>;
  onAutoClassifyAll?: () => Promise<void>;
  onExtractPlayerCharacter?: (file: ProjectFile) => Promise<void>;
  onExtractCompanion?: (file: ProjectFile) => Promise<void>;
  onExtractNpc?: (file: ProjectFile) => Promise<void>;
  onCreateNpcFromImage?: (file: ProjectFile) => Promise<void>;
  onUsePortraitAsPc?: (file: ProjectFile) => Promise<void>;
  isGenerating: boolean;
  extractingFileIds?: string[];
}> = ({
  project,
  files,
  onUpload,
  onDeleteFile,
  onOpenMap,
  onAnalyzeImageFile,
  onUpdateFileAnalysis,
  onDeleteFileAnalysis,
  onUpdateFileCategory,
  onToggleOnDemand,
  onDistillOracle,
  onAutoClassifyAll,
  onExtractPlayerCharacter,
  onExtractCompanion,
  onExtractNpc,
  onCreateNpcFromImage,
  onUsePortraitAsPc,
  isGenerating,
  extractingFileIds = []
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FileCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fit modes per image (cover vs contain)
  const [imageFits, setImageFits] = useState<Record<string, 'cover' | 'contain'>>({});

  // Lightbox preview modal
  const [lightboxFile, setLightboxFile] = useState<ProjectFile | null>(null);

  // Modal for viewing & editing visual analysis
  const [selectedAnalysisFile, setSelectedAnalysisFile] = useState<ProjectFile | null>(null);
  const [analysisDraft, setAnalysisDraft] = useState('');
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);

  const toggleImageFit = (fileId: string, defaultFit: 'cover' | 'contain') => {
    setImageFits(prev => {
      const current = prev[fileId] || defaultFit;
      return { ...prev, [fileId]: current === 'cover' ? 'contain' : 'cover' };
    });
  };

  // Helper to get effective category using comprehensive heuristic + memory match
  const getFileCategory = (f: ProjectFile): FileCategory => {
    if (f.category && f.category !== 'other') return f.category;
    return classifyFileAuto(f, project.memory);
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<FileCategory | 'all', number> = {
      all: files.length,
      map: 0,
      sheet_pj: 0,
      sheet_companion: 0,
      sheet_npc: 0,
      portrait_pj: 0,
      portrait_companion: 0,
      portrait_npc: 0,
      scene: 0,
      document: 0,
      style_sample: 0,
      oracle: 0,
      roster: 0,
      index: 0,
      audio: 0,
      other: 0
    };

    files.forEach(f => {
      const cat = getFileCategory(f);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return counts;
  }, [files, project.memory]);

  // Filtered files list
  // Solo el texto viaja en cada turno; las imágenes cuestan un coste fijo aparte.
  const CONTEXT_BUDGET_CHARS = 4000000;
  const countsAsContext = (f: ProjectFile) =>
    !f.isImage &&
    !f.isAudio &&
    f.category !== 'style_sample' &&
    (!f.onDemand || f.category === 'oracle' || f.category === 'roster' || f.category === 'index');
  const textChars = files.reduce((acc, f) => acc + (countsAsContext(f) ? f.length || 0 : 0), 0);
  const budgetShare = (textChars / CONTEXT_BUDGET_CHARS) * 100;
  const budgetLevel = budgetShare < 25 ? 'holgado' : budgetShare < 50 ? 'ajustado' : 'excesivo';

  // La búsqueda corre entera en el navegador, así que probarla no cuesta nada:
  // ni una petición a Google ni esperar a nadie.
  const [pruebaBusqueda, setPruebaBusqueda] = useState('');
  const archivosBuscables = useMemo(
    () => files.filter(f => !f.isImage && !f.isAudio && f.onDemand && f.category !== 'oracle'),
    [files]
  );
  const resultadosPrueba = useMemo(() => {
    if (pruebaBusqueda.trim().length < 3 || !archivosBuscables.length) return [];
    return recuperar(archivosBuscables, pruebaBusqueda, 3000);
  }, [pruebaBusqueda, archivosBuscables]);

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const cat = getFileCategory(f);
      const matchesCategory = activeCategory === 'all' || cat === activeCategory;
      const matchesQuery =
        !searchQuery.trim() ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.analysis && f.analysis.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesQuery;
    });
  }, [files, activeCategory, searchQuery, project.memory]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onUpload(droppedFiles);
    }
  };

  const handleOpenAnalysisModal = (file: ProjectFile) => {
    setSelectedAnalysisFile(file);
    // Un elenco recién extraído guarda la lista en el propio archivo, no en el
    // análisis. Si abriera el cuadro en blanco parecería que se ha perdido, y al
    // guardar se quedaría una lista vacía tapando a la buena.
    setAnalysisDraft(file.analysis || (file.category === 'roster' ? file.content || '' : ''));
    setIsEditingModalOpen(true);
  };

  const handleSaveAnalysis = async () => {
    if (!selectedAnalysisFile || !onUpdateFileAnalysis) return;
    await onUpdateFileAnalysis(selectedAnalysisFile.id, analysisDraft.trim());
    setIsEditingModalOpen(false);
    setSelectedAnalysisFile(null);
  };

  const categoryLabels: { key: FileCategory | 'all'; label: string; icon: string; desc: string }[] = [
    { key: 'all', label: 'Todos', icon: '', desc: 'Todo el material' },
    { key: 'sheet_pj', label: 'Fichas PJ (OC)', icon: '', desc: 'Ficha y datos del protagonista' },
    { key: 'sheet_companion', label: 'Fichas Familiares', icon: '', desc: 'Familiares, monturas y compañeros' },
    { key: 'sheet_npc', label: 'Fichas PNJs / Monstruos', icon: '', desc: 'Statblocks de PNJs y criaturas' },
    { key: 'portrait_pj', label: 'Retratos PJ', icon: '', desc: 'Personajes protagonistas' },
    { key: 'portrait_npc', label: 'Retratos PNJ', icon: '', desc: 'PNJs, criaturas y villanos' },
    { key: 'map', label: 'Mapas', icon: '', desc: 'Mapas tácticos y del mundo' },
    { key: 'scene', label: 'Ilustraciones', icon: '', desc: 'Paisajes y escenas' },
    { key: 'document', label: 'Documentos', icon: '', desc: 'Reglas, lore y libros' },
    {
      key: 'style_sample',
      label: 'Muestras de estilo',
      icon: '',
      desc: 'Fragmentos que solo sirven de referencia de escritura'
    },
    {
      key: 'oracle',
      label: 'Oráculos y tablas',
      icon: '',
      desc: 'Tablas que se consultan tirando dados, no lore que se lee'
    },
    {
      key: 'roster',
      label: 'Elenco',
      icon: '',
      desc: 'Quién es quién y qué es qué: nombres propios que no debe inventarse'
    },
    {
      key: 'index',
      label: 'Índices de aventura',
      icon: '',
      desc: 'Qué se puede jugar en los módulos que has subido, una línea por capítulo'
    },
    { key: 'audio', label: 'Audios', icon: '', desc: 'BSO y efectos' }
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-[5%] py-4 md:py-8 font-lora">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 md:p-8 text-center cursor-pointer transition-all mb-8 ${
          isDragging
            ? 'border-[var(--accent)] bg-amber-50/50 scale-[1.01]'
            : 'border-[var(--user-border)] bg-[var(--surface-soft)] hover:border-[var(--accent)] hover:bg-[var(--surface-soft)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files && e.target.files.length > 0) {
              onUpload(Array.from(e.target.files));
            }
          }}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="flex justify-center text-[var(--accent)] opacity-70">
            <Download className="w-10 h-10" strokeWidth={1.5} />
          </div>
          <div className="font-cinzel text-base md:text-lg font-bold text-[var(--accent)]">
            Añadir Documentos, Fichas de PJ, Mapas, Retratos o Audios
          </div>
          <div className="text-xs md:text-sm text-[var(--text-secondary)] max-w-xl">
            Arrastra o haz clic para subir fichas de personaje (.pdf, .txt, .md), retratos (.png, .jpg), mapas
            tácticos o música. Se clasificarán y sincronizarán automáticamente con la Memoria de la campaña.
          </div>
        </div>
      </div>

      {/* Presupuesto de contexto */}
      {textChars > 0 && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
            budgetLevel === 'excesivo'
              ? 'border-red-300 bg-red-50/70 text-red-900'
              : budgetLevel === 'ajustado'
                ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                : 'border-emerald-300 bg-emerald-50/60 text-emerald-900'
          }`}
        >
          <span className="font-cinzel font-bold">
            Los documentos ocupan el {budgetShare < 1 ? '<1' : Math.round(budgetShare)}% de la ventana de
            contexto
          </span>
          <span className="italic">
            {budgetLevel === 'holgado'
              ? 'Margen de sobra para que la crónica crezca.'
              : budgetLevel === 'ajustado'
                ? 'Cabe, pero cada turno tarda más. Deja sitio para los capítulos.'
                : 'Demasiado: la campaña se quedará sin espacio y las respuestas se volverán lentas.'}
          </span>
        </div>
      )}

      {/* Probador de la búsqueda. Los archivos de consulta ya no viajan enteros:
          la app busca en ellos cada turno. Poder ver QUÉ encontraría es lo que
          convierte «no lo ha usado» en «no lo ha encontrado, y por esto». */}
      {archivosBuscables.length > 0 && (
        <div className="mb-6 rounded-lg border border-[var(--user-border)] bg-[var(--surface-soft)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" /> Probar la búsqueda
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              en {archivosBuscables.length}{' '}
              {archivosBuscables.length === 1 ? 'archivo de consulta' : 'archivos de consulta'}
            </span>
          </div>
          <input
            value={pruebaBusqueda}
            onChange={e => setPruebaBusqueda(e.target.value)}
            placeholder="Escribe como en la partida: «me ha mordido una serpiente»"
            className="mt-2 w-full bg-[var(--bg-color)] border border-[var(--user-border)] rounded px-2.5 py-1.5 text-sm font-lora outline-none focus:border-[var(--accent)]"
          />
          {pruebaBusqueda.trim().length > 2 && (
            <div className="mt-2 space-y-1.5">
              {resultadosPrueba.length === 0 && (
                <p className="text-[11px] text-[var(--text-secondary)] italic m-0">
                  Nada. Busca por las palabras que usa el libro: encuentra nombres propios y términos
                  escritos, no sinónimos.
                </p>
              )}
              {resultadosPrueba.map((r, i) => (
                <div key={i} className="rounded border border-[var(--glass-border)] bg-[var(--bg-color)] p-2">
                  <div className="text-[11px] font-cinzel font-bold text-[var(--accent)]">
                    {r.fragmento.fileName}
                    {r.fragmento.titulo ? ` › ${r.fragmento.titulo}` : ''}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] m-0 mt-0.5 line-clamp-3">
                    {r.fragmento.texto.slice(0, 260)}…
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-6 pb-4 border-b border-[var(--glass-border)]">
        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {categoryLabels.map(cat => {
            const count = categoryCounts[cat.key] || 0;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-cinzel font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                    : 'bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] text-[var(--text-secondary)] hover:bg-amber-100/60 hover:text-[var(--accent)] border border-[var(--glass-border)]'
                }`}
                title={cat.desc}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-[color-mix(in_srgb,var(--surface)_30%,transparent)] text-white'
                      : 'bg-black/5 text-[var(--text-secondary)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar archivo o lore..."
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface)] border border-[var(--user-border)] rounded-md text-xs font-lora outline-none focus:border-[var(--accent)]"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)] opacity-60 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-xs text-[var(--text-secondary)] hover:text-red-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />{' '}
              </button>
            )}
          </div>

          {onAutoClassifyAll && (
            <button
              onClick={onAutoClassifyAll}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-cinzel text-xs font-bold hover:bg-amber-200 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0 shadow-2xs"
              title="Re-analizar y clasificar automáticamente todos los archivos por tipo y vincularlos con la memoria"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Auto-Clasificar
            </button>
          )}
        </div>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-8 px-6 text-[var(--text-secondary)] italic bg-[var(--surface-soft)] rounded-lg border border-[var(--user-border)] max-w-2xl mx-auto shadow-2xs leading-relaxed text-xs md:text-sm">
          {files.length === 0
            ? 'No hay archivos en la Base de Conocimiento. Sube fichas, mapas o lore arriba.'
            : 'No se encontraron archivos con los filtros seleccionados.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredFiles.map((f, i) => {
            const currentCat = getFileCategory(f);
            const fit = imageFits[f.id] || (currentCat === 'map' ? 'contain' : 'cover');

            // Cross-check if linked to an NPC, Location or Protagonist
            const isProtagonistPortrait = project.memory?.player_character?.portrait === f.content;
            const isProtagonistSheet = currentCat === 'sheet_pj' || f.name.toLowerCase().includes('ficha');
            const linkedNpc = project.memory?.npcs?.find(
              n =>
                n.portrait === f.content ||
                (n.name.length > 2 && f.name.toLowerCase().includes(n.name.toLowerCase()))
            );
            const linkedLoc = project.memory?.locations?.find(
              l =>
                l.portrait === f.content ||
                (l.name.length > 2 && f.name.toLowerCase().includes(l.name.toLowerCase()))
            );

            return (
              <div
                key={f.id || i}
                className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-4 rounded-xl shadow-2xs flex flex-col justify-between relative group hover:shadow-md hover:border-[var(--accent)] transition-all"
              >
                <div>
                  {/* Top Bar: Icon + Name + Category selector */}
                  <div className="flex justify-between items-start gap-2">
                    <div
                      className="font-cinzel font-bold truncate text-sm text-[var(--text-primary)] flex-1"
                      title={f.name}
                    >
                      {currentCat === 'map'
                        ? ''
                        : currentCat === 'sheet_pj'
                          ? ''
                          : currentCat === 'portrait_pj'
                            ? ''
                            : currentCat === 'portrait_npc'
                              ? ''
                              : currentCat === 'scene'
                                ? ''
                                : currentCat === 'audio'
                                  ? ''
                                  : f.name.toLowerCase().endsWith('.pdf')
                                    ? ''
                                    : ''}{' '}
                      {f.name}
                    </div>

                    {/* Category Selector Dropdown */}
                    {onUpdateFileCategory && (
                      <select
                        value={currentCat}
                        onChange={e => onUpdateFileCategory(f.id, e.target.value as FileCategory)}
                        className="text-[10px] font-cinzel font-bold bg-[var(--surface)] border border-[var(--user-border)] text-[var(--accent)] rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-[var(--accent)] shrink-0"
                        title="Cambiar categoría de este archivo"
                      >
                        <option value="sheet_pj">Ficha PJ (OC)</option>
                        <option value="sheet_companion">Ficha Familiar / Compañero</option>
                        <option value="sheet_npc">Ficha PNJ / Monstruo</option>
                        <option value="portrait_pj">Retrato PJ</option>
                        <option value="portrait_npc">Retrato PNJ</option>
                        <option value="map">Mapa</option>
                        <option value="scene">Ilustración</option>
                        <option value="document">Documento</option>
                        <option value="style_sample">Muestra de estilo</option>
                        <option value="oracle">Oráculo / tablas</option>
                        <option value="roster">Elenco</option>
                        <option value="index">Índice de aventura</option>
                        <option value="audio">Audio</option>
                        <option value="other">Otro</option>
                      </select>
                    )}
                  </div>

                  {/* Metadata line & Link Badges */}
                  <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--text-secondary)] italic flex-wrap gap-1">
                    <span>
                      {f.type || 'Documento'} • {f.length.toLocaleString('es-ES')}{' '}
                      {f.isImage || f.isAudio ? 'bytes' : 'caracteres'}
                      {f.category === 'style_sample' && (
                        <>
                          {' • '}
                          <strong
                            className="text-emerald-800 not-italic"
                            title="Solo se usó para aprender el estilo; su texto no se envía al modelo"
                          >
                            no ocupa contexto
                          </strong>
                        </>
                      )}
                      {f.category === 'oracle' && (
                        <>
                          {' • '}
                          <strong
                            className="text-[var(--accent)] not-italic"
                            title="Se envía entero en cada turno para que el Narrador pueda consultarlo en el momento"
                          >
                            tabla de oráculo
                          </strong>
                        </>
                      )}
                      {countsAsContext(f) && textChars > 0 && (
                        <>
                          {' • '}
                          <strong
                            className={
                              (f.length || 0) / textChars > 0.4
                                ? 'text-red-700 not-italic'
                                : 'text-[var(--text-secondary)] not-italic'
                            }
                            title="Parte del texto que se envía al modelo en cada turno que ocupa este archivo"
                          >
                            {Math.max(1, Math.round(((f.length || 0) / textChars) * 100))}% del contexto
                          </strong>
                        </>
                      )}
                      {f.onDemand && (
                        <>
                          {' • '}
                          <strong
                            className="text-emerald-800 not-italic"
                            title="Su texto no se envía en cada turno; el Narrador solo sabe que existe"
                          >
                            de consulta
                          </strong>
                        </>
                      )}
                    </span>
                    <div className="flex gap-1 items-center flex-wrap">
                      {isProtagonistPortrait && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-cinzel font-bold">
                          <Star className="w-3.5 h-3.5" />
                          Protagonista
                        </span>
                      )}
                      {isProtagonistSheet && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-cinzel font-bold">
                          <Scroll className="w-3.5 h-3.5" />
                          Ficha OC
                        </span>
                      )}
                      {linkedNpc && (
                        <span
                          className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.2 rounded font-cinzel font-bold"
                          title={`Vinculado como retrato al PNJ: ${linkedNpc.name}`}
                        >
                          {linkedNpc.name}
                        </span>
                      )}
                      {linkedLoc && (
                        <span
                          className="text-[10px] bg-blue-100 text-blue-900 border border-blue-300 px-1.5 py-0.2 rounded font-cinzel font-bold"
                          title={`Vinculado al lugar: ${linkedLoc.name}`}
                        >
                          {linkedLoc.name}
                        </span>
                      )}
                      {f.isImage && f.analysis && (
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-cinzel font-semibold shrink-0"
                          title="Análisis visual registrado en la memoria de la campaña"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          En Memoria
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Adaptive Image Container */}
                  {f.isImage && (f.content.startsWith('data:image') || f.content.startsWith('http')) && (
                    <div className="mt-3 flex flex-col gap-2">
                      <div
                        className="relative w-full aspect-[4/3] bg-[#1a1714] rounded-lg overflow-hidden border border-[var(--glass-border)] shadow-xs group/img flex items-center justify-center cursor-pointer"
                        onClick={() => setLightboxFile(f)}
                        title="Clic para ampliar imagen en alta resolución y ver opciones"
                      >
                        {/* Ambient blurred backdrop if contained */}
                        {fit === 'contain' && (
                          <div
                            className="absolute inset-0 bg-cover bg-center filter blur-md opacity-25 scale-110"
                            style={{ backgroundImage: `url(${f.content})` }}
                          />
                        )}

                        <img
                          src={f.content}
                          alt={f.name}
                          className={`relative z-10 w-full h-full transition-all duration-300 ${
                            fit === 'cover'
                              ? currentCat === 'portrait_pj' || currentCat === 'portrait_npc'
                                ? 'object-cover object-[center_15%]'
                                : 'object-cover object-center'
                              : 'object-contain object-center'
                          }`}
                          referrerPolicy="no-referrer"
                        />

                        {/* Top Fit Toggle Button */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            toggleImageFit(f.id, currentCat === 'map' ? 'contain' : 'cover');
                          }}
                          className="absolute top-2 right-2 z-20 px-2 py-1 bg-black/70 hover:bg-black text-white text-[10px] font-cinzel rounded shadow-md backdrop-blur-xs flex items-center gap-1 border border-white/20 transition-all opacity-0 group-hover/img:opacity-100 cursor-pointer"
                          title="Alternar entre encuadre centrado en rostro o vista completa"
                        >
                          {fit === 'cover' ? 'Rostro / Centro' : 'Completo'}
                        </button>

                        {/* Hover Overlay with Action hints */}
                        <div className="absolute inset-0 z-10 bg-black/45 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-cinzel font-bold text-center px-2 pointer-events-none">
                          <span className="inline-flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-md border border-white/30 backdrop-blur-xs">
                            <Search className="w-3.5 h-3.5" />
                            Ampliar / Acciones
                          </span>
                        </div>
                      </div>

                      {f.analysis ? (
                        <div className="bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[var(--user-border)] p-2.5 rounded-md text-xs text-[var(--text-secondary)]">
                          <div className="font-cinzel font-bold text-[10px] text-[var(--accent)] mb-1 flex justify-between items-center">
                            <span className="inline-flex items-center gap-1.5">
                              <Search className="w-3.5 h-3.5" />
                              ANÁLISIS EN MEMORIA
                            </span>
                            <button
                              onClick={() => handleOpenAnalysisModal(f)}
                              className="text-[10px] text-[var(--accent)] hover:underline cursor-pointer font-normal"
                            >
                              Ver / Editar
                            </button>
                          </div>
                          <p className="line-clamp-2 italic m-0">{f.analysis}</p>
                        </div>
                      ) : (
                        onAnalyzeImageFile && (
                          <button
                            onClick={() => onAnalyzeImageFile(f)}
                            disabled={extractingFileIds.includes(f.id)}
                            className="w-full py-1.5 bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-xs font-cinzel font-bold transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                          >
                            {extractingFileIds.includes(f.id) ? (
                              <>
                                <span className="inline-block w-3.5 h-3.5 border-2 border-amber-800 border-t-transparent rounded-full animate-spin" />
                                <span>Analizando en 2º plano...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" /> Analizar para Memoria
                              </>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {/* Audio Player */}
                  {f.isAudio && (
                    <audio controls className="w-full mt-3 h-8">
                      <source src={f.content} type={f.mime || 'audio/mpeg'} />
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                  )}

                  {/* Document Text Snippet */}
                  {!f.isImage && !f.isAudio && (
                    <div className="mt-3">
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-3 bg-black/5 p-2.5 rounded-md italic">
                        {f.content.slice(0, 180)}...
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions toolbar */}
                <div className="mt-4 pt-2 border-t border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {!f.isImage && !f.isAudio && (
                      <>
                        {/* Igual que en las imágenes: la acción sigue a la categoría.
                            Una muestra de estilo o un documento de lore no ofrecen
                            extraer la ficha del protagonista. */}
                        {onExtractPlayerCharacter && (currentCat === 'sheet_pj' || currentCat === 'document') && (
                          <button
                            onClick={() => onExtractPlayerCharacter(f)}
                            disabled={extractingFileIds.includes(f.id)}
                            className="px-2 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded text-[10px] md:text-[11px] font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors cursor-pointer disabled:opacity-60 font-bold flex items-center gap-1.5"
                            title="Leer esta ficha y registrar al protagonista de la campaña en segundo plano"
                          >
                            {extractingFileIds.includes(f.id) ? (
                              <>
                                <span className="inline-block w-3 h-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin" />
                                <span>Leyendo ficha...</span>
                              </>
                            ) : (
                              <>
                                <Star className="w-3.5 h-3.5" /> {currentCat === 'sheet_pj' ? 'Extraer Ficha Protagonista' : 'Ficha Protagonista (OC)'}
                              </>
                            )}
                          </button>
                        )}
                        {onExtractCompanion && (currentCat === 'sheet_companion' || currentCat === 'document') && (
                          <button
                            onClick={() => onExtractCompanion(f)}
                            disabled={extractingFileIds.includes(f.id)}
                            className="px-2 py-1 bg-purple-50 text-purple-900 border border-purple-300 rounded text-[10px] md:text-[11px] font-cinzel hover:bg-purple-600 hover:text-white transition-colors cursor-pointer disabled:opacity-60 font-bold flex items-center gap-1.5"
                            title="Extraer ficha como Familiar, Montura o Compañero Animal en segundo plano"
                          >
                            {extractingFileIds.includes(f.id) ? (
                              <>
                                <span className="inline-block w-3 h-3 border-2 border-purple-800 border-t-transparent rounded-full animate-spin" />
                                <span>Extrayendo compañero...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" /> {currentCat === 'sheet_companion' ? 'Extraer Familiar / Compañero' : 'Ficha Familiar'}
                              </>
                            )}
                          </button>
                        )}
                        {onExtractNpc && (currentCat === 'sheet_npc' || currentCat === 'document') && (
                          <button
                            onClick={() => onExtractNpc(f)}
                            disabled={extractingFileIds.includes(f.id)}
                            className="px-2 py-1 bg-sky-50 text-sky-900 border border-sky-300 rounded text-[10px] md:text-[11px] font-cinzel hover:bg-sky-600 hover:text-white transition-colors cursor-pointer disabled:opacity-60 font-bold flex items-center gap-1.5"
                            title="Extraer ficha de PNJ o Criatura a la lista de PNJs en segundo plano"
                          >
                            {extractingFileIds.includes(f.id) ? (
                              <>
                                <span className="inline-block w-3 h-3 border-2 border-sky-800 border-t-transparent rounded-full animate-spin" />
                                <span>Extrayendo PNJ...</span>
                              </>
                            ) : (
                              <>
                                <Drama className="w-3.5 h-3.5" /> {currentCat === 'sheet_npc' ? 'Extraer Ficha PNJ' : 'Ficha PNJ'}
                              </>
                            )}
                          </button>
                        )}
                        {currentCat === 'oracle' && onDistillOracle && (
                          <button
                            onClick={() => onDistillOracle(f)}
                            disabled={extractingFileIds.includes(f.id)}
                            className="px-2 py-1 bg-[var(--accent)] text-[var(--on-accent)] border border-[var(--accent)] rounded text-[10px] md:text-[11px] font-cinzel font-bold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                            title="Quedarse solo con las tablas y las reglas y tirar los ejemplos de partida y los créditos. Es lo que viajará al Narrador."
                          >
                            {extractingFileIds.includes(f.id) ? (
                              <>
                                <span className="inline-block w-3 h-3 border-2 border-[var(--on-accent)] border-t-transparent rounded-full animate-spin" />
                                <span>Destilando...</span>
                              </>
                            ) : (
                              <>
                                <Scissors className="w-3.5 h-3.5" />
                                {f.analysis && f.analysis.trim().length > 80
                                  ? 'Volver a destilar'
                                  : 'Destilar la tabla'}
                              </>
                            )}
                          </button>
                        )}
                        {(currentCat === 'roster' || currentCat === 'index') && (
                          <button
                            onClick={() => handleOpenAnalysisModal(f)}
                            className="px-2 py-1 bg-[var(--surface)] border border-[var(--user-border)] rounded text-[10px] md:text-[11px] font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors cursor-pointer flex items-center gap-1"
                            title="Leer y corregir la lista a mano: añadir lo que falte, arreglar una entrada que se haya quedado corta"
                          >
                            <Search className="w-3.5 h-3.5" />{' '}
                            {currentCat === 'roster' ? 'Ver / corregir el elenco' : 'Ver / corregir el índice'}
                          </button>
                        )}
                        {currentCat === 'oracle' && f.analysis && f.analysis.trim().length > 80 && (
                          <button
                            onClick={() => handleOpenAnalysisModal(f)}
                            className="px-2 py-1 bg-[var(--surface)] border border-[var(--user-border)] rounded text-[10px] md:text-[11px] font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors cursor-pointer flex items-center gap-1"
                            title="Leer y corregir a mano lo que se le manda al Narrador"
                          >
                            <Search className="w-3.5 h-3.5" /> Ver el destilado
                          </button>
                        )}
                        {onToggleOnDemand &&
                          currentCat !== 'style_sample' &&
                          currentCat !== 'oracle' &&
                          currentCat !== 'roster' &&
                          currentCat !== 'index' && (
                          <button
                            onClick={() => onToggleOnDemand(f.id, !f.onDemand)}
                            className={`px-2 py-1 border rounded text-[10px] md:text-[11px] font-cinzel transition-colors cursor-pointer flex items-center gap-1 ${
                              f.onDemand
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-[var(--surface)] border-[var(--user-border)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]'
                            }`}
                            title={
                              f.onDemand
                                ? 'Ahora es de consulta: su texto no se envía en cada turno. Pulsa para volver a incluirlo siempre.'
                                : 'Su texto se envía en cada turno. Pulsa para dejarlo solo como material de consulta y ahorrar contexto.'
                            }
                          >
                            {f.onDemand ? (
                              <>
                                <BookOpen className="w-3.5 h-3.5" /> De consulta
                              </>
                            ) : (
                              <>
                                <Pin className="w-3.5 h-3.5" /> Siempre presente
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}

                    {f.isImage && (
                      <>
                        <button
                          onClick={() => onOpenMap(f)}
                          className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--user-border)] rounded text-[10px] md:text-[11px] font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors cursor-pointer flex items-center gap-1 font-bold"
                          title="Abrir como mapa interactivo con cuadrícula y marcadores"
                        >
                          <Map className="w-3.5 h-3.5" /> Mapa Táctico
                        </button>
                        {f.analysis && (
                          <button
                            onClick={() => handleOpenAnalysisModal(f)}
                            className="px-2 py-1 bg-[var(--surface)] border border-[var(--user-border)] rounded text-[10px] md:text-[11px] font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors cursor-pointer flex items-center gap-1"
                            title="Ver y editar el análisis visual guardado en memoria"
                          >
                            <Search className="w-3.5 h-3.5" /> Análisis
                          </button>
                        )}
                        {/* La acción depende de dónde esté archivada la imagen: un
                            retrato del protagonista no debe ofrecer crear un PNJ. */}
                        {onCreateNpcFromImage && currentCat === 'portrait_npc' && (
                          <button
                            onClick={() => onCreateNpcFromImage(f)}
                            disabled={isGenerating}
                            className="px-2 py-1 bg-purple-50 text-purple-900 border border-purple-300 rounded text-[10px] md:text-[11px] font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors cursor-pointer disabled:opacity-50 font-bold flex items-center gap-1"
                            title="Crear un PNJ en la Memoria usando esta imagen como retrato"
                          >
                            <Drama className="w-3.5 h-3.5" /> Crear PNJ
                          </button>
                        )}
                        {onUsePortraitAsPc && currentCat === 'portrait_pj' && (
                          <button
                            onClick={() => onUsePortraitAsPc(f)}
                            disabled={isGenerating}
                            className="px-2 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded text-[10px] md:text-[11px] font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors cursor-pointer disabled:opacity-50 font-bold flex items-center gap-1"
                            title="Usar esta imagen como retrato del protagonista"
                          >
                            <Star className="w-3.5 h-3.5" /> Retrato del PJ
                          </button>
                        )}
                        {onExtractPlayerCharacter && currentCat === 'sheet_pj' && (
                          <button
                            onClick={() => onExtractPlayerCharacter(f)}
                            disabled={isGenerating}
                            className="px-2 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded text-[10px] md:text-[11px] font-cinzel hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-colors cursor-pointer disabled:opacity-50 font-bold flex items-center gap-1"
                            title="Leer esta ficha y registrar al protagonista"
                          >
                            <Star className="w-3.5 h-3.5" /> Extraer ficha
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => onDeleteFile(f)}
                    className="text-red-700 hover:text-red-900 p-1 font-bold cursor-pointer transition-colors ml-auto"
                    title="Eliminar archivo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />{' '}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* High-Resolution Lightbox Modal */}
      {lightboxFile && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setLightboxFile(null)}
        >
          <div
            className="bg-[#1c1917] border border-amber-900/40 rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-3 bg-[#141210] border-b border-amber-900/30 text-amber-100">
              <div className="font-cinzel font-bold text-sm truncate flex items-center gap-2">
                <Image className="w-3.5 h-3.5" /> {lightboxFile.name}
              </div>
              <button
                onClick={() => setLightboxFile(null)}
                className="text-amber-200/70 hover:text-white text-lg font-bold px-2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />{' '}
              </button>
            </div>

            {/* Image Canvas */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
              <img
                src={lightboxFile.content}
                alt={lightboxFile.name}
                className="max-h-[65vh] max-w-full object-contain rounded shadow-lg border border-white/10"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Lightbox Footer Actions */}
            <div className="p-4 bg-[#141210] border-t border-amber-900/30 flex flex-wrap items-center justify-between gap-3 text-xs font-cinzel">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const cat = getFileCategory(lightboxFile);
                    toggleImageFit(lightboxFile.id, cat === 'map' ? 'contain' : 'cover');
                  }}
                  className="px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900 text-amber-200 border border-amber-700/50 rounded cursor-pointer transition-colors"
                >
                  {imageFits[lightboxFile.id] === 'cover' ? 'Encuadre Centrado' : 'Modo Completo'}
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setLightboxFile(null);
                    onOpenMap(lightboxFile);
                  }}
                  className="px-3 py-1.5 bg-amber-900/40 hover:bg-amber-800 text-amber-100 border border-amber-700/50 rounded cursor-pointer transition-colors"
                >
                  <Map className="w-3.5 h-3.5" /> Abrir como Mapa
                </button>
                {onAnalyzeImageFile && (
                  <button
                    onClick={() => {
                      const file = lightboxFile;
                      setLightboxFile(null);
                      onAnalyzeImageFile(file);
                    }}
                    disabled={isGenerating}
                    className="px-3 py-1.5 bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/50 rounded cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Analizar con IA
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis View / Edit Modal */}
      {isEditingModalOpen && selectedAnalysisFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-color)] p-6 rounded-lg shadow-2xl border border-[var(--glass-border)] w-[580px] max-w-full font-lora flex flex-col max-h-[90vh]">
            <h4 className="font-cinzel text-lg text-[var(--accent)] mb-1 font-bold flex items-center gap-2">
              <Image className="w-3.5 h-3.5" /> Análisis en Memoria: {selectedAnalysisFile.name}
            </h4>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              Esta descripción visual es consultada por el Narrador IA para mantener coherencia en las
              escenas.
            </p>
            <div className="flex-1 overflow-y-auto mb-4">
              <textarea
                value={analysisDraft}
                onChange={e => setAnalysisDraft(e.target.value)}
                placeholder="Escribe o edita el análisis visual de esta imagen..."
                className="w-full h-64 bg-[var(--surface)] border border-[var(--user-border)] p-3 rounded-lg text-sm font-lora outline-none focus:border-[var(--accent)] leading-relaxed shadow-inner"
              />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[var(--glass-border)]">
              {onDeleteFileAnalysis && selectedAnalysisFile.analysis && (
                <button
                  onClick={async () => {
                    await onDeleteFileAnalysis(selectedAnalysisFile.id);
                    setIsEditingModalOpen(false);
                    setSelectedAnalysisFile(null);
                  }}
                  className="text-xs font-cinzel text-red-700 hover:text-red-900 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Borrar Análisis
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setIsEditingModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-cinzel border border-[var(--glass-border)] rounded hover:bg-[var(--surface)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAnalysis}
                  className="px-4 py-1.5 text-xs font-cinzel bg-emerald-700 text-white rounded hover:bg-emerald-800 font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar en Memoria
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
