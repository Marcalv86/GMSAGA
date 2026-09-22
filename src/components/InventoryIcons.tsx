import { InventoryItem } from '../types';

export type InventoryIconKind =
  | 'main_hand'
  | 'off_hand'
  | 'two_handed'
  | 'sword'
  | 'shield'
  | 'bow'
  | 'staff'
  | 'spear'
  | 'grimoire'
  | 'wand'
  | 'magic_item'
  | 'jewelry'
  | 'gem'
  | 'armor'
  | 'gold'
  | 'potion'
  | 'scroll'
  | 'instrument'
  | 'herbs'
  | 'key'
  | 'other';

interface IconSvgProps {
  className?: string;
  size?: number | string;
}

// 1. Espada / Arma estándar
export function IconSword({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l2 2 3-3-2-2" />
      <path d="M19 13l2 2-3 3-2-2" />
      <path d="M17.5 14.5l3.5 3.5" />
      <path d="M19.5 21.5l1.5-1.5" />
    </svg>
  );
}

// 2. Escudo
export function IconShield({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 5.5v13" strokeDasharray="2 2" strokeOpacity="0.7" />
      <path d="M7.5 10.5h9" strokeOpacity="0.7" />
    </svg>
  );
}

// 3. Arma de Mano Derecha (Espada con indicador diestro / mano principal)
export function IconMainHand({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M15 4l5 5L9 20H4v-5L15 4z" />
      <path d="M13.5 5.5l5 5" />
      <path d="M18 17l3 3m-3 0l3-3" strokeWidth="2" />
      <circle cx="19.5" cy="18.5" r="3.5" strokeDasharray="2 2" strokeWidth="1" />
    </svg>
  );
}

// 4. Arma de Mano Izquierda (Daga / empuñadura zurda / parada)
export function IconOffHand({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M4 10l6-6 4 4-6 6H4v-4z" />
      <path d="M8 6l4 4" />
      <path d="M14 14l6 6" />
      <path d="M17 13l4 4" />
      <circle cx="5.5" cy="18.5" r="3" strokeDasharray="2 2" strokeWidth="1" />
      <path d="M4 18.5h3" strokeWidth="1.5" />
    </svg>
  );
}

// 5. Arma a Dos Manos (Mandoble / Espadas cruzadas de gran envergadura)
export function IconTwoHanded({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M7 2l10 10-2 2L5 4z" />
      <path d="M4 7l2-2 13 13-2 2z" />
      <path d="M2 19l3 3" />
      <path d="M19 2l3 3" />
      <path d="M4 22l-2-2 3-3 2 2z" />
      <path d="M22 4l-2-2-3 3 2 2z" />
    </svg>
  );
}

// 6. Arco y Flecha / Ballesta
export function IconBow({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M19 5c-7 0-14 7-14 14" />
      <path d="M5 19l14-14" />
      <path d="M19 5v4m0-4h-4" />
      <path d="M11 13l-4 4" />
      <path d="M7 21l2-2" />
      <path d="M3 17l2-2" />
    </svg>
  );
}

// 7. Bastón / Báculo
export function IconStaff({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M5 21L17 5" />
      <circle cx="18.5" cy="4.5" r="2.5" />
      <path d="M17 3c1-2 4-1 4 1s-2 3-3 2" />
      <path d="M4 22l2-1" />
      <path d="M9 13l2-1" />
    </svg>
  );
}

// 8. Lanza / Pica / Jabalina
export function IconSpear({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M3 21L16 8" />
      <path d="M15 9l5-7-7 5 2 2z" fill="currentColor" fillOpacity="0.15" />
      <path d="M14 10l-2 1" />
      <path d="M2 22l2-1" />
    </svg>
  );
}

// 9. Grimorio / Libros de conjuros / Tomo
export function IconGrimoire({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M12 6l1.5 3 3 .5-2.25 2.25.5 3.25L12 13.5l-2.75 1.5.5-3.25L7.5 9.5l3-.5L12 6z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

// 10. Varitas / Cetros
export function IconWand({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M15 4L4 15l5 5L20 9l-5-5z" />
      <path d="M9 10l5 5" />
      <path d="M19 2v3m-1.5-1.5h3" />
      <path d="M21 7v2m-1-1h2" />
      <path d="M15 1v2m-1-1h2" />
    </svg>
  );
}

// 11. Objetos mágicos / Reliquias / Runas
export function IconMagicItem({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M12 2l2.4 5.6L20 10l-4.4 4 1.4 6-5-3.2L7 20l1.4-6L4 10l5.6-2.4L12 2z" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

// 12. Joyas / Anillos / Amuletos / Collares
export function IconJewelry({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <circle cx="12" cy="14" r="7" />
      <path d="M9 7l3-4 3 4" />
      <path d="M10 7h4l1.5-2h-7L10 7z" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="14" r="3" strokeDasharray="2 2" />
    </svg>
  );
}

// 13. Gemas (Facetadas, piedras preciosas de drops para vender por oro)
export function IconGem({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M6 3h12l4 6-10 12L2 9l4-6z" fill="currentColor" fillOpacity="0.15" />
      <path d="M2 9h20" />
      <path d="M10 3l-2 6 4 12 4-12-2-6" />
      <path d="M6 3l4 6" />
      <path d="M18 3l-4 6" />
    </svg>
  );
}

// 14. Armaduras / Corazas / Petos / Cascos
export function IconArmor({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M6 4h12l2 4-3 12H7L4 8l2-4z" fill="currentColor" fillOpacity="0.1" />
      <path d="M9 4a3 3 0 0 0 6 0" />
      <path d="M12 9v7" />
      <path d="M8 12h8" />
    </svg>
  );
}

// 15. Oro / Monedas / Bolsas de monedas
export function IconGold({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <circle cx="9" cy="9" r="6" fill="currentColor" fillOpacity="0.15" />
      <path d="M15 9a6 6 0 1 1-6 6" />
      <path d="M9 6v6m-2-4h4" strokeOpacity="0.8" />
      <circle cx="15" cy="15" r="5" fill="currentColor" fillOpacity="0.2" />
      <path d="M15 13v4m-1.5-2.5h3" strokeOpacity="0.8" />
    </svg>
  );
}

// 16. Pociones / Elixires / Viales
export function IconPotion({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M10 2h4" />
      <path d="M12 2v5" />
      <path d="M8.5 7h7l4.5 10a4 4 0 0 1-3.7 5H7.7A4 4 0 0 1 4 17L8.5 7z" fill="currentColor" fillOpacity="0.15" />
      <path d="M6 16c2-1 4-1 6 0s4 1 6 0" strokeDasharray="1 1" />
      <circle cx="10" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

// 17. Pergaminos / Cartas / Mapas
export function IconScroll({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M8 3H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4" />
      <path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M8 13h8" strokeOpacity="0.7" />
      <path d="M8 17h5" strokeOpacity="0.7" />
    </svg>
  );
}

// 18. Instrumentos musicales (Violín / Laúd / Flauta)
export function IconInstrument({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M14 6l4-4 2 2-4 4" />
      <path d="M12 8L7 13c-2 2-2 5 0 7s5 2 7 0l5-5-7-7z" fill="currentColor" fillOpacity="0.15" />
      <circle cx="10" cy="16" r="1.5" fill="currentColor" />
      <path d="M16 2l-14 14" strokeDasharray="2 2" strokeOpacity="0.6" />
    </svg>
  );
}

// 19. Hierbas / Botánica / Alquimia
export function IconHerbs({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M11 20A7 7 0 0 1 4 13C4 6 11 3 11 3s7 3 7 10a7 7 0 0 1-7 7z" fill="currentColor" fillOpacity="0.15" />
      <path d="M11 21V9" />
      <path d="M11 13l4-2" />
      <path d="M11 16l-3-2" />
    </svg>
  );
}

// 20. Llaves / Ganzúas
export function IconKey({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.5 12.5L21 2" />
      <path d="M17 6l2 2" />
      <path d="M19 4l2 2" />
    </svg>
  );
}

// 21. Otros / Mochila / Equipo general
export function IconOther({ className = 'w-6 h-6', size }: IconSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" fill="currentColor" fillOpacity="0.1" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M8 11h8" />
      <path d="M8 15h8" />
      <path d="M12 11v4" />
    </svg>
  );
}

// Helper para clasificar con precisión cualquier objeto según su slot, categoría y descripción
export function classifyInventoryItem(item: Partial<InventoryItem>): InventoryIconKind {
  const slot = (item as any)?.slot?.toString().toLowerCase() || '';
  const cat = item.category?.toString().toLowerCase() || '';
  const text = `${item.name || ''} ${item.description || ''} ${item.damageOrAc || ''} ${slot}`.toLowerCase();

  // 1. Detección explícita de agarres/slots de armas
  if (slot === 'main_hand' || slot === 'derecha' || /\b(?:mano derecha|main hand|diestra)\b/i.test(text)) {
    return 'main_hand';
  }
  if (slot === 'off_hand' || slot === 'izquierda' || /\b(?:mano izquierda|off hand|zurda|segunda mano)\b/i.test(text)) {
    return 'off_hand';
  }
  if (
    slot === 'two_hands' ||
    slot === 'dos_manos' ||
    /\b(?:a dos manos|dos manos|two-handed|two handed|mandoble|gran hacha|alabarda|pica pesada|gran martillo|arco largo)\b/i.test(text)
  ) {
    return 'two_handed';
  }

  // 2. Gemas y joyas (crucial para drops y venta por oro)
  if (
    cat === 'gem' ||
    cat === 'treasure' ||
    /\b(?:gema|gemas|diamante|rub[ií]|zafiro|esmeralda|[oó]palo|topacio|amatista|perla|jade|turquesa|aguamarina|circ[oó]n|piedra preciosa|piedras preciosas)\b/i.test(text)
  ) {
    return 'gem';
  }

  // 3. Oro y monedas
  if (
    /\b(?:moneda|monedas|oro|plata|cobre|electro|platino|bolsa de monedas|monedero|bolsa de oro|tesoro en monedas)\b/i.test(text)
  ) {
    return 'gold';
  }

  // 4. Joyas, anillos, amuletos, collares
  if (
    cat === 'jewelry' ||
    /\b(?:anillo|sortija|colgante|amuleto|medall[oó]n|joya|collar|broche|pendiente|talism[aá]n|tiara|diadema|brazalete|cintilante)\b/i.test(text)
  ) {
    return 'jewelry';
  }

  // 5. Escudos
  if (
    cat === 'armor' && /\b(?:escudo|broquel|rodela|pav[eé]s)\b/i.test(text) ||
    /\b(?:escudo|broquel|rodela|pav[eé]s)\b/i.test(text)
  ) {
    return 'shield';
  }

  // 6. Armaduras y vestimentas de protección
  if (
    cat === 'armor' ||
    /\b(?:armadura|coraza|cota de malla|cota de placas|peto|cuero tachonado|camisote|casco|yelmo|grebas|guanteletes|capa|manto|piwafwi|tabardo|ropa|t[uú]nica|bota|botas)\b/i.test(text)
  ) {
    return 'armor';
  }

  // 7. Lanzas y armas de asta
  if (/\b(?:lanza|pica|jabalina|tridente|chuzo|azagaya|alabarda|dardo)\b/i.test(text)) {
    return 'spear';
  }

  // 8. Bastones y báculos
  if (/\b(?:bast[oó]n|b[aá]culo|quarterstaff|vara m[aá]gica)\b/i.test(text)) {
    return 'staff';
  }

  // 9. Arcos, ballestas y munición
  if (/\b(?:arco|ballesta|flecha|flechas|virote|virotes|carcaj|aljaba)\b/i.test(text)) {
    return 'bow';
  }

  // 10. Espadas, dagas y armas de filo o impacto
  if (
    cat === 'weapon' ||
    /\b(?:espada|sable|estoque|florete|cimitarra|hoja|daga|pu[ñn]al|cuchillo|estilete|hacha|maza|martillo|mangual|garrote|guada[ñn]a)\b/i.test(text)
  ) {
    return 'sword';
  }

  // 11. Grimorios, libros, tomos, diarios
  if (
    /\b(?:grimorio|libro de conjuros|libro|tomo|diario|cuaderno|libreta|bit[aá]cora|c[oó]dice|manual|volumen)\b/i.test(text)
  ) {
    return 'grimoire';
  }

  // 12. Varitas y cetros
  if (/\b(?:varita|cetro|varilla m[aá]gica)\b/i.test(text)) {
    return 'wand';
  }

  // 13. Pociones, elixires, viales
  if (
    cat === 'potion' ||
    /\b(?:poci[oó]n|elixir|brebaje|ampolla|vial|frasco|ant[ií]doto|b[aá]lsamo|ung[uü]ento|filtro)\b/i.test(text)
  ) {
    return 'potion';
  }

  // 14. Pergaminos, cartas, mapas, documentos
  if (
    cat === 'scroll' ||
    item.deMision ||
    /\b(?:pergamino|rollo|carta|misiva|nota|mensaje|sobre|mapa|plano|derrotero|manuscrito|documento|salvoconducto|contrato)\b/i.test(text)
  ) {
    return 'scroll';
  }

  // 15. Instrumentos musicales
  if (
    /\b(?:viol[ií]n|lira|arpa|la[uú]d|flauta|tambor|instrumento|c[ií]tara|ocarina|cuerno de caza|trompeta|campana)\b/i.test(text)
  ) {
    return 'instrument';
  }

  // 16. Hierbas y flora
  if (
    /\b(?:hierba|hierbas|planta|flor|semilla|semillas|ra[ií]z|ra[ií]ces|baya|bayas|hongo|hongos|seta|setas|mu[eé]rdago|alquimia)\b/i.test(text)
  ) {
    return 'herbs';
  }

  // 17. Llaves y ganzúas
  if (/\b(?:llave|llaves|ganz[uú]a|ganz[uú]as|cerradura)\b/i.test(text)) {
    return 'key';
  }

  // 18. Objetos mágicos / Reliquias / Runas
  if (
    cat === 'magic' ||
    item.attuned ||
    /\b(?:m[aá]gico|m[aá]gica|reliquia|runa|runas|artefacto|orbe|esfera de cristal|talisman|amuleto sagrado)\b/i.test(text)
  ) {
    return 'magic_item';
  }

  return 'other';
}

// Componente React completo para renderizar el SVG con paleta cromática sutil
export function InventoryItemIcon({
  item,
  className = 'w-7 h-7',
  size
}: {
  item: Partial<InventoryItem>;
  className?: string;
  size?: number | string;
}) {
  const kind = classifyInventoryItem(item);

  // Paleta de tintes cromáticos elegantes según el tipo
  let colorClass = 'text-[var(--accent)]';
  switch (kind) {
    case 'main_hand':
    case 'sword':
      colorClass = 'text-amber-700 dark:text-amber-400';
      break;
    case 'off_hand':
      colorClass = 'text-orange-700 dark:text-orange-400';
      break;
    case 'two_handed':
      colorClass = 'text-red-700 dark:text-red-400';
      break;
    case 'shield':
    case 'armor':
      colorClass = 'text-sky-700 dark:text-sky-400';
      break;
    case 'bow':
    case 'spear':
      colorClass = 'text-emerald-700 dark:text-emerald-400';
      break;
    case 'staff':
    case 'wand':
    case 'grimoire':
    case 'magic_item':
      colorClass = 'text-indigo-700 dark:text-indigo-400';
      break;
    case 'gem':
      colorClass = 'text-cyan-600 dark:text-cyan-300';
      break;
    case 'gold':
      colorClass = 'text-amber-600 dark:text-amber-300';
      break;
    case 'jewelry':
      colorClass = 'text-purple-700 dark:text-purple-400';
      break;
    case 'potion':
      colorClass = 'text-rose-600 dark:text-rose-400';
      break;
    case 'scroll':
      colorClass = 'text-amber-700 dark:text-amber-300';
      break;
    case 'instrument':
      colorClass = 'text-teal-700 dark:text-teal-400';
      break;
    case 'herbs':
      colorClass = 'text-emerald-600 dark:text-emerald-400';
      break;
    case 'key':
      colorClass = 'text-yellow-700 dark:text-yellow-400';
      break;
    case 'other':
    default:
      colorClass = 'text-[var(--text-secondary)]';
      break;
  }

  const combinedClass = `${className} ${colorClass}`;

  switch (kind) {
    case 'main_hand':
      return <IconMainHand className={combinedClass} size={size} />;
    case 'off_hand':
      return <IconOffHand className={combinedClass} size={size} />;
    case 'two_handed':
      return <IconTwoHanded className={combinedClass} size={size} />;
    case 'sword':
      return <IconSword className={combinedClass} size={size} />;
    case 'shield':
      return <IconShield className={combinedClass} size={size} />;
    case 'bow':
      return <IconBow className={combinedClass} size={size} />;
    case 'staff':
      return <IconStaff className={combinedClass} size={size} />;
    case 'spear':
      return <IconSpear className={combinedClass} size={size} />;
    case 'grimoire':
      return <IconGrimoire className={combinedClass} size={size} />;
    case 'wand':
      return <IconWand className={combinedClass} size={size} />;
    case 'magic_item':
      return <IconMagicItem className={combinedClass} size={size} />;
    case 'jewelry':
      return <IconJewelry className={combinedClass} size={size} />;
    case 'gem':
      return <IconGem className={combinedClass} size={size} />;
    case 'armor':
      return <IconArmor className={combinedClass} size={size} />;
    case 'gold':
      return <IconGold className={combinedClass} size={size} />;
    case 'potion':
      return <IconPotion className={combinedClass} size={size} />;
    case 'scroll':
      return <IconScroll className={combinedClass} size={size} />;
    case 'instrument':
      return <IconInstrument className={combinedClass} size={size} />;
    case 'herbs':
      return <IconHerbs className={combinedClass} size={size} />;
    case 'key':
      return <IconKey className={combinedClass} size={size} />;
    case 'other':
    default:
      return <IconOther className={combinedClass} size={size} />;
  }
}

// Componente para insignia de monedas SVG en lugar de emojis de círculos
export function CoinBadgeDot({ type }: { type: 'cp' | 'sp' | 'ep' | 'gp' | 'pp' }) {
  const configs = {
    pp: { color: 'fill-slate-300 stroke-slate-500', label: 'PP' },
    gp: { color: 'fill-amber-400 stroke-amber-600', label: 'PO' },
    ep: { color: 'fill-cyan-400 stroke-cyan-600', label: 'PE' },
    sp: { color: 'fill-zinc-300 stroke-zinc-500', label: 'PA' },
    cp: { color: 'fill-amber-700 stroke-amber-900', label: 'PC' }
  };
  const c = configs[type] || configs.gp;

  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 inline-block shrink-0 align-middle mr-1">
      <circle cx="8" cy="8" r="6.5" className={`${c.color}`} strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3.5" fill="none" className="stroke-white/40" strokeWidth="1" strokeDasharray="1.5 1.5" />
    </svg>
  );
}
