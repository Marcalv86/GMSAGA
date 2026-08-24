import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Sparkles,
  Swords,
  Smile,
  Compass,
  Crown,
  Flame,
  History
} from 'lucide-react';

export interface EmojiItem {
  emoji: string;
  name: string;
  category: 'rpg' | 'faces' | 'combat' | 'world' | 'symbols';
  keywords: string[];
}

export const EMOJI_DATABASE: EmojiItem[] = [
  // --- 🎲 D&D, ROL & FANTASÍA ---
  { emoji: '🎲', name: 'Dado d20', category: 'rpg', keywords: ['dado', 'dice', 'd20', 'dnd', 'azar', 'tirada', 'suerte'] },
  { emoji: '⚔️', name: 'Espadas cruzadas', category: 'rpg', keywords: ['espadas', 'combate', 'lucha', 'duelo', 'ataque', 'armas'] },
  { emoji: '🗡️', name: 'Daga', category: 'rpg', keywords: ['daga', 'cuchillo', 'asesino', 'sigilo', 'apunalar', 'pícaro'] },
  { emoji: '🛡️', name: 'Escudo', category: 'rpg', keywords: ['escudo', 'defensa', 'armadura', 'proteger', 'guardia', 'ca'] },
  { emoji: '🏹', name: 'Arco y flecha', category: 'rpg', keywords: ['arco', 'flecha', 'cazador', 'disparo', 'distancia', 'ranger'] },
  { emoji: '🪓', name: 'Hacha de guerra', category: 'rpg', keywords: ['hacha', 'barbaro', 'golpe', 'corte', 'armas'] },
  { emoji: '🪄', name: 'Varita mágica', category: 'rpg', keywords: ['varita', 'mago', 'conjuro', 'magia', 'hechizo'] },
  { emoji: '🔮', name: 'Bola de cristal', category: 'rpg', keywords: ['bola', 'cristal', 'oraculo', 'adivinacion', 'vidente', 'magia'] },
  { emoji: '📜', name: 'Pergamino', category: 'rpg', keywords: ['pergamino', 'mapa', 'mision', 'carta', 'manuscrito', 'papiro'] },
  { emoji: '📖', name: 'Grimorio / Libro', category: 'rpg', keywords: ['libro', 'grimorio', 'tomo', 'diario', 'estudio', 'hechizos'] },
  { emoji: '🕯️', name: 'Vela encendida', category: 'rpg', keywords: ['vela', 'luz', 'mazmorra', 'cripta', 'noche', 'cera'] },
  { emoji: '🪔', name: 'Lámpara de aceite', category: 'rpg', keywords: ['lampara', 'aceite', 'luz', 'antorcha', 'fuego'] },
  { emoji: '🗝️', name: 'Llave antigua', category: 'rpg', keywords: ['llave', 'cerradura', 'cofre', 'puerta', 'secreto', 'mazmorra'] },
  { emoji: '💰', name: 'Bolsa de monedas', category: 'rpg', keywords: ['bolsa', 'oro', 'dinero', 'tesoro', 'botin', 'monedas'] },
  { emoji: '🪙', name: 'Moneda de oro', category: 'rpg', keywords: ['moneda', 'oro', 'plata', 'pago', 'recompensa', 'precio'] },
  { emoji: '💎', name: 'Gema preciosa', category: 'rpg', keywords: ['gema', 'diamante', 'joya', 'cristal', 'tesoro', 'rubi'] },
  { emoji: '👑', name: 'Corona real', category: 'rpg', keywords: ['corona', 'rey', 'reina', 'noble', 'lider', 'realeza'] },
  { emoji: '💍', name: 'Anillo mágico', category: 'rpg', keywords: ['anillo', 'joya', 'alianza', 'magico', 'compromiso'] },
  { emoji: '🧪', name: 'Poción / Frasco', category: 'rpg', keywords: ['pocion', 'frasco', 'alquimia', 'elixir', 'curacion', 'veneno'] },
  { emoji: '🏺', name: 'Reliquia / Ánfora', category: 'rpg', keywords: ['anfora', 'jarron', 'reliquia', 'urna', 'antiguedad'] },
  { emoji: '💀', name: 'Calavera', category: 'rpg', keywords: ['calavera', 'esqueleto', 'muerte', 'no muerto', 'peligro', 'hueso'] },
  { emoji: '☠️', name: 'Peligro mortal', category: 'rpg', keywords: ['veneno', 'toxico', 'peligro', 'muerte', 'pirata', 'calavera'] },
  { emoji: '🐉', name: 'Dragón', category: 'rpg', keywords: ['dragon', 'wyrm', 'monstruo', 'bestia', 'fuego', 'escamas'] },
  { emoji: '🐲', name: 'Cabeza de dragón', category: 'rpg', keywords: ['dragon', 'draconico', 'bestia'] },
  { emoji: '🐺', name: 'Lobo salvaje', category: 'rpg', keywords: ['lobo', 'manada', 'bestia', 'fiera', 'druida', 'bosque'] },
  { emoji: '🦅', name: 'Águila / Halcón', category: 'rpg', keywords: ['aguila', 'halcon', 'ave', 'vision', 'vuelo'] },
  { emoji: '🦇', name: 'Murciélago', category: 'rpg', keywords: ['murcielago', 'cueva', 'vampiro', 'noche', 'caverna'] },
  { emoji: '🕷️', name: 'Araña', category: 'rpg', keywords: ['arana', 'lolth', 'drow', 'veneno', 'infraoscuridad', 'aracnido'] },
  { emoji: '🕸️', name: 'Telaraña', category: 'rpg', keywords: ['telarana', 'trampa', 'emboscada', 'arana', 'red'] },
  { emoji: '🐀', name: 'Rata de cloaca', category: 'rpg', keywords: ['rata', 'roedor', 'cloacas', 'plaga', 'alcantarillas'] },
  { emoji: '🐍', name: 'Serpiente', category: 'rpg', keywords: ['serpiente', 'veneno', 'reptil', 'mordedura', 'sigilo'] },
  { emoji: '🐴', name: 'Caballo', category: 'rpg', keywords: ['caballo', 'montura', 'viaje', 'carreta', 'viajar'] },
  { emoji: '🐎', name: 'Caballo al galope', category: 'rpg', keywords: ['galope', 'caballo', 'huida', 'carrera', 'velocidad'] },
  { emoji: '🎭', name: 'Máscaras de teatro', category: 'rpg', keywords: ['mascara', 'teatro', 'bardo', 'engano', 'disfraz', 'farsa'] },
  { emoji: '📯', name: 'Cuerno de guerra', category: 'rpg', keywords: ['cuerno', 'trompeta', 'alarma', 'llamada', 'guerra'] },
  { emoji: '🧭', name: 'Brújula', category: 'rpg', keywords: ['brujula', 'orientacion', 'norte', 'mapa', 'rumbo', 'viaje'] },

  // --- 😊 EXPRESIONES & ROLES ---
  { emoji: '😏', name: 'Sonrisa pícara', category: 'faces', keywords: ['picaro', 'sonrisa', 'jarlaxle', 'coqueteo', 'astuto', 'chulo'] },
  { emoji: '🤫', name: 'Silencio / Secreto', category: 'faces', keywords: ['silencio', 'secreto', 'shh', 'sigilo', 'discreto', 'callar'] },
  { emoji: '🤨', name: 'Ceja levantada / Sospecha', category: 'faces', keywords: ['sospecha', 'duda', 'desconfianza', 'ceja', 'incredulo'] },
  { emoji: '🤔', name: 'Pensativo / Táctica', category: 'faces', keywords: ['pensar', 'duda', 'plan', 'tactica', 'reflexion', 'idea'] },
  { emoji: '🧐', name: 'Investigación / Monóculo', category: 'faces', keywords: ['monoculo', 'investigar', 'examinar', 'pista', 'detalle'] },
  { emoji: '🥺', name: 'Súplica / Persuasión', category: 'faces', keywords: ['suplica', 'persuasion', 'ojos', 'pedir', 'carisma', 'ternura'] },
  { emoji: '😳', name: 'Sonrojado / Turbado', category: 'faces', keywords: ['sonrojado', 'verguenza', 'sorpresa', 'timido', 'turbado'] },
  { emoji: '😈', name: 'Diablillo pícaro', category: 'faces', keywords: ['diablo', 'travesura', 'maldad', 'plan maligno', 'villano'] },
  { emoji: '😇', name: 'Inocente / Celestial', category: 'faces', keywords: ['angel', 'inocente', 'santo', 'bondad', 'paladin'] },
  { emoji: '😤', name: 'Determinación / Orgullo', category: 'faces', keywords: ['orgullo', 'firme', 'decision', 'enfado', 'resoplar'] },
  { emoji: '😡', name: 'Furia / Ira', category: 'faces', keywords: ['furia', 'rabia', 'ira', 'barbaro', 'enfadado', 'ataque'] },
  { emoji: '😱', name: 'Terror / Espanto', category: 'faces', keywords: ['terror', 'miedo', 'susto', 'panico', 'grito', 'pesadilla'] },
  { emoji: '😭', name: 'Llanto / Tragedia', category: 'faces', keywords: ['llanto', 'lagrimas', 'tristeza', 'dolor', 'perdida', 'luto'] },
  { emoji: '🤣', name: 'Carcajada / Risas', category: 'faces', keywords: ['carcajada', 'risa', 'humor', 'broma', 'taberna', 'diversion'] },
  { emoji: '😂', name: 'Risa cómplice', category: 'faces', keywords: ['risa', 'gracioso', 'alegria', 'complicidad'] },
  { emoji: '😊', name: 'Sonrisa cordial', category: 'faces', keywords: ['amable', 'sonrisa', 'calido', 'afecto', 'saludo'] },
  { emoji: '😉', name: 'Guiño de complicidad', category: 'faces', keywords: ['guino', 'trato', 'acuerdo', 'complicidad', 'picardia'] },
  { emoji: '😌', name: 'Alivio / Paz', category: 'faces', keywords: ['alivio', 'calma', 'paz', 'descanso', 'respiro'] },
  { emoji: '🥱', name: 'Cansancio / Bostezo', category: 'faces', keywords: ['cansado', 'bostezo', 'sueno', 'guardia nocturna', 'fatiga'] },
  { emoji: '😴', name: 'Dormido / Descanso', category: 'faces', keywords: ['dormir', 'descanso largo', 'inconsciente', 'reposo'] },
  { emoji: '🫡', name: 'Saludo marcial / Respeto', category: 'faces', keywords: ['saludo', 'militar', 'respeto', 'orden', 'guardia', 'honor'] },
  { emoji: '🤝', name: 'Pacto / Alianza', category: 'faces', keywords: ['trato', 'acuerdo', 'alianza', 'pacto', 'negocio', 'manos'] },
  { emoji: '👏', name: 'Aplauso / Elogio', category: 'faces', keywords: ['aplauso', 'elogio', 'bardo', 'felicitacion', 'bravo'] },
  { emoji: '🫂', name: 'Abrazo / Reencuentro', category: 'faces', keywords: ['abrazo', 'afecto', 'consuelo', 'reencuentro', 'carino'] },
  { emoji: '💋', name: 'Beso / Romance', category: 'faces', keywords: ['beso', 'romance', 'pasion', 'amor', 'intimidad', 'labios'] },
  { emoji: '🫦', name: 'Mordisco de labio', category: 'faces', keywords: ['labio', 'romance', 'tension', 'coqueteo', 'deseo'] },
  { emoji: '👀', name: 'Mirada atenta / Espionaje', category: 'faces', keywords: ['ojos', 'mirar', 'espia', 'atencion', 'vigilar', 'acechar'] },
  { emoji: '🤤', name: 'Deseo / Apetito', category: 'faces', keywords: ['antojo', 'comida', 'deseo', 'delicioso', 'tentacion'] },
  { emoji: '🥶', name: 'Frío glacial / Helado', category: 'faces', keywords: ['frio', 'hielo', 'escarcha', 'congelado', 'invierno'] },
  { emoji: '🥵', name: 'Calor sofocante / Fiebre', category: 'faces', keywords: ['calor', 'fiebre', 'ardiente', 'sofoco', 'desierto'] },
  { emoji: '🤯', name: 'Revelación / Asombro', category: 'faces', keywords: ['asombro', 'revelacion', 'shock', 'sorpresa', 'impacto'] },
  { emoji: '🤥', name: 'Engaño / Mentira', category: 'faces', keywords: ['mentira', 'engano', 'farol', 'embuste', 'pinocho'] },

  // --- ⚔️ COMBATE & MAGIA ---
  { emoji: '💥', name: 'Impacto / Explosión', category: 'combat', keywords: ['impacto', 'golpe', 'critico', 'explosion', 'dano', 'choque'] },
  { emoji: '✨', name: 'Destello mágico', category: 'combat', keywords: ['magia', 'brillo', 'destello', 'hechizo', 'luz', 'bendicion'] },
  { emoji: '⚡', name: 'Relámpago / Rayo', category: 'combat', keywords: ['rayo', 'relampago', 'trueno', 'electricidad', 'rapidez'] },
  { emoji: '🔥', name: 'Fuego ardiente', category: 'combat', keywords: ['fuego', 'llama', 'bola de fuego', 'ardiente', 'calor', 'quemar'] },
  { emoji: '❄️', name: 'Escarcha / Frío', category: 'combat', keywords: ['hielo', 'frio', 'escarcha', 'nieve', 'congelar', 'invierno'] },
  { emoji: '🌪️', name: 'Torbellino / Viento', category: 'combat', keywords: ['viento', 'tornado', 'torbellino', 'tempestad', 'aire'] },
  { emoji: '💫', name: 'Aturdido / Mareo', category: 'combat', keywords: ['aturdido', 'mareo', 'estrellas', 'desorientado', 'golpe'] },
  { emoji: '🌟', name: 'Estrella brillante', category: 'combat', keywords: ['estrella', 'exito', 'guia', 'iluminacion', 'aura'] },
  { emoji: '☄️', name: 'Meteoro', category: 'combat', keywords: ['meteoro', 'cometa', 'fuego', 'caida', 'impacto'] },
  { emoji: '🩸', name: 'Gota de sangre', category: 'combat', keywords: ['sangre', 'herida', 'dano', 'corte', 'salud', 'dolor'] },
  { emoji: '🩹', name: 'Vendaje / Curación', category: 'combat', keywords: ['vendaje', 'curacion', 'medicina', 'primeros auxilios', 'herida'] },
  { emoji: '🎯', name: 'Diana / Blanco fijado', category: 'combat', keywords: ['diana', 'objetivo', 'critico', 'punteria', 'acierto'] },
  { emoji: '💣', name: 'Bomba explosiva', category: 'combat', keywords: ['bomba', 'explosivo', 'trampa', 'polvora'] },
  { emoji: '🧨', name: 'Pólvora smokepowder', category: 'combat', keywords: ['dinamita', 'polvora', 'smokepowder', 'petardo'] },
  { emoji: '⛓️', name: 'Cadenas / Prisión', category: 'combat', keywords: ['cadenas', 'prision', 'atadura', 'esclavo', 'cautivo', 'preso'] },
  { emoji: '🚪', name: 'Puerta / Acceso', category: 'combat', keywords: ['puerta', 'entrada', 'barricada', 'pasadizo', 'salida'] },
  { emoji: '🥊', name: 'Combate desarmado', category: 'combat', keywords: ['punetazo', 'boxeo', 'desarmado', 'monje', 'pelea'] },
  { emoji: '🏃', name: 'Huida / Carrera rápida', category: 'combat', keywords: ['correr', 'huir', 'retirada', 'persecucion', 'escape'] },
  { emoji: '🧎', name: 'Rendición / Plegaria', category: 'combat', keywords: ['plegaria', 'rezar', 'clerigo', 'rendicion', 'arrodillarse'] },
  { emoji: '🛌', name: 'Descanso / Recuperación', category: 'combat', keywords: ['cama', 'descanso corto', 'descanso largo', 'recuperar'] },

  // --- 🏰 MUNDO & OBJETOS ---
  { emoji: '🏰', name: 'Castillo / Ciudadela', category: 'world', keywords: ['castillo', 'fortaleza', 'ciudad', 'waterdeep', 'luskan', 'muralla'] },
  { emoji: '⛺', name: 'Campamento', category: 'world', keywords: ['campamento', 'tienda', 'refugio', 'acampada', 'vivac'] },
  { emoji: '🌲', name: 'Bosque / Naturaleza', category: 'world', keywords: ['bosque', 'arbol', 'selva', 'espesura', 'druida'] },
  { emoji: '🏔️', name: 'Montañas nevadas', category: 'world', keywords: ['montana', 'cordillera', 'espina del mundo', 'pico', 'roca'] },
  { emoji: '🌊', name: 'Mar embravecido', category: 'world', keywords: ['mar', 'oceano', 'ola', 'tormenta', 'costa de la espada'] },
  { emoji: '🗺️', name: 'Mapa de campaña', category: 'world', keywords: ['mapa', 'faerun', 'continente', 'reino', 'territorio'] },
  { emoji: '⛵', name: 'Barco velero', category: 'world', keywords: ['barco', 'navio', 'corsario', 'viaje maritimo', 'marineros'] },
  { emoji: '🚢', name: 'Navío de gran calado', category: 'world', keywords: ['barco', 'navio', 'puerto', 'embarcacion'] },
  { emoji: '⚓', name: 'Ancla portuaria', category: 'world', keywords: ['ancla', 'puerto', 'amarre', 'costa', 'muelle'] },
  { emoji: '🍺', name: 'Jarra de hidromiel/cerveza', category: 'world', keywords: ['cerveza', 'hidromiel', 'taberna', 'posada', 'trago', 'brindis'] },
  { emoji: '🍷', name: 'Copa de vino', category: 'world', keywords: ['vino', 'copa', 'aristocracia', 'cena', 'banquete', 'brindis'] },
  { emoji: '🍻', name: 'Brindis de taberna', category: 'world', keywords: ['brindis', 'jarras', 'fiesta', 'taberna', 'celebracion'] },
  { emoji: '🍞', name: 'Raciones de pan', category: 'world', keywords: ['pan', 'raciones', 'comida', 'viaje', 'alimento'] },
  { emoji: '🍖', name: 'Banquete de asado', category: 'world', keywords: ['carne', 'asado', 'banquete', 'comida', 'festin'] },
  { emoji: '🍲', name: 'Guiso caliente', category: 'world', keywords: ['guiso', 'puchero', 'sopa', 'posada', 'cena'] },
  { emoji: '☕', name: 'Infusión caliente', category: 'world', keywords: ['te', 'infusion', 'cafe', 'taza', 'charla'] },
  { emoji: '🍄', name: 'Hongos / Esporas', category: 'world', keywords: ['hongo', 'seta', 'infraoscuridad', 'esporas', 'cueva'] },
  { emoji: '🌿', name: 'Hierbas medicinales', category: 'world', keywords: ['hierbas', 'plantas', 'botanica', 'medicina', 'alquimia'] },
  { emoji: '🍂', name: 'Hojas de otoño', category: 'world', keywords: ['otono', 'marpenoth', 'hojas', 'estacion', 'viento'] },
  { emoji: '🌙', name: 'Luna nocturna', category: 'world', keywords: ['luna', 'noche', 'selune', 'sigilo', 'oscuridad'] },
  { emoji: '☀️', name: 'Sol radiante', category: 'world', keywords: ['sol', 'dia', 'lathander', 'amanecer', 'mediodia'] },
  { emoji: '🌤️', name: 'Día templado', category: 'world', keywords: ['dia', 'clima', 'manana', 'tiempo'] },
  { emoji: '🌧️', name: 'Lluvia / Tormenta', category: 'world', keywords: ['lluvia', 'tormenta', 'temporal', 'chubasco', 'agua'] },
  { emoji: '🌫️', name: 'Niebla misteriosa', category: 'world', keywords: ['niebla', 'bruma', 'misterio', 'humo', 'visibilidad'] },
  { emoji: '🎒', name: 'Mochila de aventurero', category: 'world', keywords: ['mochila', 'equipo', 'provisiones', 'inventario', 'viajero'] },
  { emoji: '📦', name: 'Caja / Cargamento', category: 'world', keywords: ['caja', 'cargamento', 'mercancia', 'fardo', 'paquete'] },

  // --- ⚜️ SÍMBOLOS & MARCADORES ---
  { emoji: '⏳', name: 'Reloj de arena', category: 'symbols', keywords: ['reloj', 'tiempo', 'plazo', 'cuenta atras', 'arena', 'duracion'] },
  { emoji: '📅', name: 'Calendario de Harptos', category: 'symbols', keywords: ['calendario', 'fecha', 'dia', 'harptos', 'cita', 'agenda'] },
  { emoji: '📍', name: 'Marcador de mapa', category: 'symbols', keywords: ['marcador', 'ubicacion', 'aqui', 'lugar', 'posicion'] },
  { emoji: '⚜️', name: 'Flor de lis / Renombre', category: 'symbols', keywords: ['renombre', 'estatus', 'faccion', 'nobleza', 'honor', 'rango'] },
  { emoji: '👤', name: 'Personaje / Protagonista', category: 'symbols', keywords: ['personaje', 'jugador', 'pj', 'avatar', 'individuo'] },
  { emoji: '👥', name: 'Grupo de aventureros', category: 'symbols', keywords: ['grupo', 'companeros', 'aventureros', 'aliados', 'multitud'] },
  { emoji: '💬', name: 'Diálogo', category: 'symbols', keywords: ['dialogo', 'hablar', 'conversacion', 'voz', 'bocadillo'] },
  { emoji: '💭', name: 'Pensamiento', category: 'symbols', keywords: ['pensamiento', 'idea', 'mente', 'secreto', 'reflexion'] },
  { emoji: '🖋️', name: 'Pluma de escribir', category: 'symbols', keywords: ['pluma', 'escribir', 'firma', 'contrato', 'tinta', 'carta'] },
  { emoji: '🔔', name: 'Campana de alarma', category: 'symbols', keywords: ['campana', 'alarma', 'templo', 'aviso', 'llamada'] },
  { emoji: '⚠️', name: 'Advertencia de peligro', category: 'symbols', keywords: ['advertencia', 'peligro', 'cuidado', 'alerta', 'riesgo'] },
  { emoji: '❓', name: 'Interrogación / Misterio', category: 'symbols', keywords: ['pregunta', 'duda', 'misterio', 'incognita', 'interrogacion'] },
  { emoji: '❗', name: 'Exclamación', category: 'symbols', keywords: ['exclamacion', 'alerta', 'atencion', 'urgente', 'importante'] },
  { emoji: '💯', name: 'Éxito rotundo', category: 'symbols', keywords: ['cien', 'perfecto', 'exito', 'completado', 'total'] },
  { emoji: '🚩', name: 'Hito / Bandera', category: 'symbols', keywords: ['hito', 'bandera', 'objetivo', 'senal', 'marcador'] },
  { emoji: '🖤', name: 'Corazón negro', category: 'symbols', keywords: ['corazon negro', 'oscuridad', 'drow', 'luto', 'duelo', 'lealtad'] },
  { emoji: '🤍', name: 'Corazón blanco', category: 'symbols', keywords: ['corazon blanco', 'pureza', 'luz', 'verdad'] },
  { emoji: '💔', name: 'Corazón roto', category: 'symbols', keywords: ['corazon roto', 'traicion', 'desamor', 'dolor', 'ruptura'] },
  { emoji: '❤️', name: 'Corazón rojo / Salud', category: 'symbols', keywords: ['corazon', 'amor', 'salud', 'vida', 'pasion'] },
  { emoji: '💖', name: 'Corazón brillante / Romance', category: 'symbols', keywords: ['romance', 'brillo', 'afecto', 'ilusion', 'enamorado'] },
  { emoji: '🕊️', name: 'Paloma mensajera / Paz', category: 'symbols', keywords: ['paloma', 'paz', 'mensajero', 'carta', 'libertad'] }
];

const RECENT_STORAGE_KEY = 'rpg_recent_emojis_v1';

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  isOpen,
  onClose,
  onSelectEmoji
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'rpg' | 'faces' | 'combat' | 'world' | 'symbols'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar recientes de localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_STORAGE_KEY);
      if (saved) {
        setRecentEmojis(JSON.parse(saved));
      } else {
        // Valores iniciales frecuentes por defecto
        setRecentEmojis(['🎲', '⚔️', '🛡️', '😏', '🤫', '📜', '💰', '✨', '⏳', '🍷']);
      }
    } catch {
      setRecentEmojis(['🎲', '⚔️', '🛡️', '😏', '🤫', '📜', '💰', '✨', '⏳', '🍷']);
    }
  }, []);

  // Foco automático en el buscador al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Click outside para cerrar
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleEmojiClick = (emoji: string) => {
    onSelectEmoji(emoji);

    // Guardar en recientes
    setRecentEmojis(prev => {
      const filtered = prev.filter(e => e !== emoji);
      const updated = [emoji, ...filtered].slice(0, 16);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return EMOJI_DATABASE.filter(item => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      if (!matchesCategory) return false;

      if (!q) return true;

      const nameMatch = item.name.toLowerCase().includes(q);
      const keywordMatch = item.keywords.some(k => k.toLowerCase().includes(q));
      const emojiMatch = item.emoji.includes(q);

      return nameMatch || keywordMatch || emojiMatch;
    });
  }, [searchQuery, activeCategory]);

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'Todos', icon: Sparkles },
    { id: 'rpg', label: 'Rol & D&D', icon: Swords },
    { id: 'faces', label: 'Expresión', icon: Smile },
    { id: 'combat', label: 'Combate', icon: Flame },
    { id: 'world', label: 'Mundo', icon: Compass },
    { id: 'symbols', label: 'Símbolos', icon: Crown }
  ] as const;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 sm:left-4 md:left-12 mb-2 z-50 w-[94vw] sm:w-[380px] max-w-[420px] bg-[var(--surface)] border border-[var(--user-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col font-lora animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
      style={{
        maxHeight: '440px'
      }}
    >
      {/* Header del Selector */}
      <div className="p-2.5 sm:p-3 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface-soft)_80%,transparent)] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-cinzel text-xs font-bold text-[var(--accent)]">
            <Smile className="w-4 h-4" />
            <span>Ventana Rápida de Emojis</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass)] rounded transition-colors cursor-pointer"
            title="Cerrar ventana de emojis (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Buscador Rápido */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-secondary)] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar emoji (ej: espada, picaro, dragón, vino, dado...)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-color)] border border-[var(--glass-border)] focus:border-[var(--accent)] text-xs text-[var(--text-primary)] pl-8 pr-7 py-1.5 rounded-lg outline-none font-lora shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Barra de Categorías */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {categories.map(cat => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchQuery('');
                }}
                className={`text-[11px] font-cinzel font-semibold px-2 py-1 rounded-md flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)] border border-[var(--glass-border)]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Recientes (solo si no hay búsqueda activa) */}
      {!searchQuery && recentEmojis.length > 0 && (
        <div className="px-3 py-1.5 border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-cinzel text-[var(--text-secondary)] flex items-center gap-1 shrink-0 font-bold uppercase tracking-wider">
            <History className="w-3 h-3" /> Recientes:
          </span>
          <div className="flex items-center gap-1">
            {recentEmojis.map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => handleEmojiClick(emoji)}
                className="w-7 h-7 flex items-center justify-center text-base rounded hover:bg-[var(--glass)] hover:scale-125 active:scale-95 transition-all cursor-pointer"
                title={`Insertar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rejilla de Emojis */}
      <div className="p-3 overflow-y-auto max-h-[260px] flex-1">
        {filteredEmojis.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-secondary)] font-lora">
            No se encontraron emojis con «{searchQuery}». Prueba con términos en español como <em>espada, dragón, dado, fuego, beso</em>.
          </div>
        ) : (
          <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
            {filteredEmojis.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleEmojiClick(item.emoji)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-xl sm:text-2xl rounded-lg hover:bg-[var(--surface-soft)] border border-transparent hover:border-[var(--accent)]/40 hover:scale-115 active:scale-90 transition-all cursor-pointer shadow-2xs group relative"
                title={`${item.name} (${item.emoji})`}
                aria-label={item.name}
              >
                <span>{item.emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pie con sugerencia */}
      <div className="px-3 py-1.5 border-t border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface-soft)_60%,transparent)] flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-lora">
        <span>Haz clic para insertar en el chat</span>
        <span className="font-cinzel">{filteredEmojis.length} emojis</span>
      </div>
    </div>
  );
};
