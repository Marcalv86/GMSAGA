import { PlayerCharacter, PlayerAttributes, InventoryItem, PlayerCurrencies } from '../types';

/**
 * Normaliza nombres de habilidades estándar de D&D 5e (en español e inglés)
 */
export const DND_SKILL_DEFINITIONS: Array<{
  name: string;
  statKey: keyof PlayerAttributes;
  statShort: string;
  aliases: string[];
}> = [
  { name: 'Acrobacias', statKey: 'dex', statShort: 'DES', aliases: ['acrobacias', 'acrobatics', 'acrobacia'] },
  { name: 'Arcanos', statKey: 'int', statShort: 'INT', aliases: ['arcanos', 'arcana', 'arcano', 'conocimiento arcano'] },
  { name: 'Atletismo', statKey: 'str', statShort: 'FUE', aliases: ['atletismo', 'athletics'] },
  { name: 'Engaño', statKey: 'cha', statShort: 'CAR', aliases: ['engaño', 'engano', 'deception'] },
  { name: 'Historia', statKey: 'int', statShort: 'INT', aliases: ['historia', 'history'] },
  { name: 'Interpretación', statKey: 'cha', statShort: 'CAR', aliases: ['interpretación', 'interpretacion', 'performance', 'actuación'] },
  { name: 'Intimidación', statKey: 'cha', statShort: 'CAR', aliases: ['intimidación', 'intimidacion', 'intimidation'] },
  { name: 'Intuición', statKey: 'wis', statShort: 'SAB', aliases: ['intuición', 'intuicion', 'insight', 'perspicacia'] },
  { name: 'Investigación', statKey: 'int', statShort: 'INT', aliases: ['investigación', 'investigacion', 'investigation'] },
  { name: 'Juego de Manos', statKey: 'dex', statShort: 'DES', aliases: ['juego de manos', 'sleight of hand', 'prestidigitacion'] },
  { name: 'Medicina', statKey: 'wis', statShort: 'SAB', aliases: ['medicina', 'medicine'] },
  { name: 'Naturaleza', statKey: 'int', statShort: 'INT', aliases: ['naturaleza', 'nature'] },
  { name: 'Percepción', statKey: 'wis', statShort: 'SAB', aliases: ['percepción', 'percepcion', 'perception'] },
  { name: 'Persuasión', statKey: 'cha', statShort: 'CAR', aliases: ['persuasión', 'persuasion'] },
  { name: 'Religión', statKey: 'int', statShort: 'INT', aliases: ['religión', 'religion'] },
  { name: 'Sigilo', statKey: 'dex', statShort: 'DES', aliases: ['sigilo', 'stealth'] },
  { name: 'Supervivencia', statKey: 'wis', statShort: 'SAB', aliases: ['supervivencia', 'survival'] },
  { name: 'Trato con Animales', statKey: 'wis', statShort: 'SAB', aliases: ['trato con animales', 'animal handling', 'manejo de animales'] }
];

export function calculateModifier(score: number): number {
  return Math.floor(((score || 10) - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Normaliza nombres para comparación de objetos
 */
export function normalizeItemName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Deduplica y refina el inventario de un personaje:
 * 1. Elimina duplicados genéricos si existe un objeto específico (ej: Bastón común vs Bastón de Cedro Lunar).
 * 2. Re-categoriza objetos oraculares / reliquias (como "Escudo de Fionn", "Ramas de Ogham") como mágicos, no como armadura.
 * 3. Aplica reglas de empuñadura: si lleva arma a dos manos o bastón a dos manos, ningún escudo puede estar equipado.
 * 4. Elimina líneas parseadas accidentalmente que eran competencias de reglas (ej: "Armaduras ligeras, medias, escudos").
 */
export function refineAndDeduplicateInventory(rawItems: InventoryItem[], rawSourceText?: string): InventoryItem[] {
  if (!rawItems || rawItems.length === 0) return [];

  // 1. Filtrar falsos objetos que son realmente competencias o texto de reglas
  const filtered = rawItems.filter(item => {
    const norm = normalizeItemName(item.name);
    // Eliminar si es una lista de competencias
    if (
      /^(?:competencias?|idiomas?|armaduras?\s+ligeras?|armas?\s+simples?|herramientas?\s+de|salvaciones?\s+con|rasgos?\s+de|dotes?)\b/i.test(norm) ||
      norm.includes('competencia en') ||
      norm.includes('salvacion')
    ) {
      return false;
    }
    return true;
  });

  // 2. Comprobar si existen versiones especializadas de armas/bastones
  const hasNamedStaff = filtered.some(item =>
    /bast[oó]n\s+de\s+[a-záéíóúñ]+/i.test(item.name) &&
    !/bast[oó]n\s+(?:de\s+viaje|com[uú]n|b[aá]sico|de\s+madera)/i.test(item.name)
  );

  const hasNamedSword = filtered.some(item =>
    /(?:espada|espad[oó]n|daga|arco|hacha)\s+(?:de\s+|del\s+|lunar|solar|m[aá]gic)/i.test(item.name)
  );

  // 3. Filtrar genéricos duplicados
  let deduped = filtered.filter(item => {
    const norm = normalizeItemName(item.name);
    if (hasNamedStaff && /^(?:baston(?:\s+(?:de\s+viaje|comun|basico|de\s+madera))?|baston\s+de\s+viajero)$/i.test(norm)) {
      return false;
    }
    if (hasNamedSword && /^(?:espada\s+comun|espada\s+corta|espada\s+larga|daga\s+comun)$/i.test(norm)) {
      return false;
    }
    return true;
  });

  // 4. Re-categorizar y limpiar propiedades de reliquias / oráculos / focos
  deduped = deduped.map(item => {
    const norm = normalizeItemName(item.name);
    const isOracularOrRelic =
      /fionn|ogham|oraculo|reliquia|foco\s+druidico|foco\s+arcano|simbolo\s+sagrado|tablilla/i.test(norm) ||
      /oraculo|adivinatorio|reliquia/i.test(item.description || '');

    if (isOracularOrRelic) {
      return {
        ...item,
        category: 'magic' as const,
        equipped: false, // Las reliquias/oráculos no son armaduras equipadas
        damageOrAc: item.damageOrAc && !item.damageOrAc.includes('+2 CA') && !item.damageOrAc.includes('CA')
          ? item.damageOrAc
          : 'Foco ritual / Oráculo'
      };
    }

    return item;
  });

  // 5. Eliminar escudos genéricos inventados si el documento de origen no los menciona en inventario
  if (rawSourceText) {
    const normSource = normalizeItemName(rawSourceText);
    const sourceMentionsShieldAsItem =
      /(?:inventario|equipo|posesiones)[\s\S]*?\b(?:escudo\s+de\s+madera|escudo\s+de\s+combate|escudo\s+de\s+acero|escudo\s+de\s+cuero)\b/i.test(normSource);

    if (!sourceMentionsShieldAsItem) {
      // Si el texto NO tiene un escudo en inventario, remover cualquier "Escudo" genérico
      deduped = deduped.filter(item => {
        const norm = normalizeItemName(item.name);
        if (norm === 'escudo' || norm === 'escudo de madera' || norm === 'escudo comun' || norm === 'wooden shield') {
          return false;
        }
        return true;
      });
    }
  }

  // 6. Regla de compatibilidad de equipo: Dos manos vs Escudo
  // Si lleva un arma a dos manos equipada (o bastón usado a dos manos), desactivar cualquier escudo
  const isWieldingTwoHanded = deduped.some(item => {
    if (!item.equipped) return false;
    const desc = `${item.name} ${item.damageOrAc || ''} ${item.description || ''}`.toLowerCase();
    return (
      desc.includes('dos manos') ||
      desc.includes('two-handed') ||
      desc.includes('a 2 manos') ||
      desc.includes('arco largo') ||
      desc.includes('arco corto') ||
      desc.includes('ballesta pesada') ||
      desc.includes('espadón') ||
      desc.includes('gran hacha') ||
      desc.includes('alabarda') ||
      desc.includes('guja') ||
      desc.includes('pica')
    );
  });

  if (isWieldingTwoHanded) {
    deduped = deduped.map(item => {
      if (item.category === 'armor' && /escudo|shield/i.test(item.name)) {
        return { ...item, equipped: false };
      }
      return item;
    });
  }

  return deduped;
}

/**
 * Valida y normaliza la ficha del personaje completa garantizando consistencia
 * matemática en atributos, CA, PG y equipo.
 */
export function validateCharacterEquipment(pc: PlayerCharacter): PlayerCharacter {
  const inventory = refineAndDeduplicateInventory(pc.inventory || [], pc.sheetText);

  // Mantener CA coherente del documento sin sumas arbitrarias de escudos inexistentes
  const calculatedAc = pc.ac ?? 10;

  return {
    ...pc,
    inventory,
    ac: calculatedAc
  };
}

/**
 * Parser determinista y universal para extraer cualquier ficha de D&D / rol
 * (Bárbaro, Mago, Guerrero, Pícaro, Clérigo, Druida, etc.) sin datos fijos inventados.
 */
export function parseDndSheetText(rawText: string, existingPc?: Partial<PlayerCharacter>): Partial<PlayerCharacter> {
  if (!rawText || typeof rawText !== 'string') return existingPc || {};

  const text = rawText.trim();
  const result: Partial<PlayerCharacter> = { ...(existingPc || {}) };

  // 1. ATRIBUTOS (FUE, DES, CON, INT, SAB, CAR)
  const attrObj: PlayerAttributes = {
    str: existingPc?.attributes?.str ?? 10,
    dex: existingPc?.attributes?.dex ?? 10,
    con: existingPc?.attributes?.con ?? 10,
    int: existingPc?.attributes?.int ?? 10,
    wis: existingPc?.attributes?.wis ?? 10,
    cha: existingPc?.attributes?.cha ?? 10
  };

  // Patrones directos tipo "FUE: 16", "FUE 16 (+3)", "| FUE | 16 |"
  const fueMatch = text.match(/\b(?:FUE|STR|Fuerza|Strength)\b[\s:·|*]*(\d+)/i);
  if (fueMatch) attrObj.str = parseInt(fueMatch[1], 10);

  const desMatch = text.match(/\b(?:DES|DEX|Destreza|Dexterity)\b[\s:·|*]*(\d+)/i);
  if (desMatch) attrObj.dex = parseInt(desMatch[1], 10);

  const conMatch = text.match(/\b(?:CON|Constituci[oó]n|Constitution)\b[\s:·|*]*(\d+)/i);
  if (conMatch) attrObj.con = parseInt(conMatch[1], 10);

  const intMatch = text.match(/\b(?:INT|Inteligencia|Intelligence)\b[\s:·|*]*(\d+)/i);
  if (intMatch) attrObj.int = parseInt(intMatch[1], 10);

  const sabMatch = text.match(/\b(?:SAB|WIS|Sabidur[ií]a|Wisdom)\b[\s:·|*]*(\d+)/i);
  if (sabMatch) attrObj.wis = parseInt(sabMatch[1], 10);

  const carMatch = text.match(/\b(?:CAR|CHA|Carisma|Charisma)\b[\s:·|*]*(\d+)/i);
  if (carMatch) attrObj.cha = parseInt(carMatch[1], 10);

  // Tablas markdown de atributos
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 2; i++) {
    const headerLine = lines[i];
    const sepLine = lines[i + 1];
    const valLine = lines[i + 2];
    if (headerLine.includes('|') && sepLine.includes('|') && sepLine.includes('-') && valLine.includes('|')) {
      const headers = headerLine.split('|').map(s => s.trim().toUpperCase()).filter(Boolean);
      const vals = valLine.split('|').map(s => s.trim()).filter(Boolean);
      if (headers.length >= 6 && vals.length >= 6) {
        const hasDndHeader = headers.some(h => ['FUE', 'STR', 'DES', 'DEX', 'CON', 'INT', 'SAB', 'WIS', 'CAR', 'CHA'].includes(h));
        if (hasDndHeader) {
          headers.forEach((h, idx) => {
            const vStr = vals[idx] || '';
            const numMatch = vStr.match(/\d+/);
            if (numMatch) {
              const num = parseInt(numMatch[0], 10);
              if (h === 'FUE' || h === 'STR') attrObj.str = num;
              else if (h === 'DES' || h === 'DEX') attrObj.dex = num;
              else if (h === 'CON') attrObj.con = num;
              else if (h === 'INT') attrObj.int = num;
              else if (h === 'SAB' || h === 'WIS') attrObj.wis = num;
              else if (h === 'CAR' || h === 'CHA') attrObj.cha = num;
            }
          });
          break;
        }
      }
    }
  }

  result.attributes = attrObj;

  // 2. IDENTIDAD BÁSICA (Nombre, Raza, Clase, Subclase, Nivel, Trasfondo, Alineamiento)
  const nameMatch = text.match(/(?:Nombre|Name)\s*[:·*]*\s*([^\n|]+)/i);
  if (nameMatch && !result.name) result.name = nameMatch[1].trim();

  const raceMatch = text.match(/(?:Raza|Race|Linaje|Ancestry)\s*[:·*]*\s*([^\n|]+)/i);
  if (raceMatch) result.race = raceMatch[1].trim();

  const classMatch = text.match(/(?:Clase|Class)\s*[:·*]*\s*([^\n|]+)/i);
  if (classMatch) {
    const fullClass = classMatch[1].trim();
    // Extraer posible subclase entre paréntesis
    const subMatch = fullClass.match(/\(([^)]+)\)/);
    if (subMatch) {
      result.class = fullClass.replace(/\([^)]+\)/, '').trim();
      result.subclass = subMatch[1].trim();
    } else {
      result.class = fullClass;
    }
  }

  const levelMatch = text.match(/(?:Nivel|Level|Nv\.?)\s*[:·*]*\s*(\d+)/i);
  if (levelMatch) result.level = levelMatch[1].trim();

  const bgMatch = text.match(/(?:Trasfondo|Background|Origen)\s*[:·*]*\s*([^\n|]+)/i);
  if (bgMatch) result.background = bgMatch[1].trim();

  const alignMatch = text.match(/(?:Alineamiento|Alignment)\s*[:·*]*\s*([^\n|]+)/i);
  if (alignMatch) result.alignment = alignMatch[1].trim();

  // 3. PG / HP & DADOS DE GOLPE
  const pgMatch = text.match(/(?:\*\*PG\*\*|\bPG\b|\bHP\b|Puntos\s+de\s+Golpe|Hit\s+Points)\s*[:·*]*\s*(\d+)(?:\s*(?:\/|de)\s*(\d+))?(?:\s*\(([^)]+)\))?/i);
  if (pgMatch) {
    const curHp = parseInt(pgMatch[1], 10);
    const maxHp = pgMatch[2] ? parseInt(pgMatch[2], 10) : curHp;
    result.hp = curHp;
    result.maxHp = maxHp;
    if (pgMatch[3]) result.hitDice = pgMatch[3].trim();
  }

  const hdMatch = text.match(/(?:Dados?\s+de\s+Golpe|Hit\s+Dice)\s*[:·*]*\s*([0-9dD+\-\s]+)/i);
  if (hdMatch && !result.hitDice) {
    result.hitDice = hdMatch[1].trim();
  }

  // 4. CA / CLASE DE ARMADURA
  const caMatch = text.match(/(?:\*\*CA\*\*|\bCA\b|\bAC\b|Clase\s+de\s+Armadura|Armor\s+Class)\s*[:·*]*\s*(\d+)/i);
  if (caMatch) {
    result.ac = parseInt(caMatch[1], 10);
  }

  // 5. VELOCIDAD
  const velMatch = text.match(/(?:\*\*Vel\.\*\*|\bVel\.\b|\bVelocidad\b|\bSpeed\b)\s*[:·*]*\s*([^·|\n,]+)/i);
  if (velMatch) {
    result.speed = velMatch[1].trim();
  }

  // 6. INICIATIVA
  const inicMatch = text.match(/(?:\*\*Inic\.\*\*|\bInic\.\b|\bIniciativa\b|\bInitiative\b)\s*[:·*]*\s*([+\-]?\d+)/i);
  if (inicMatch) {
    result.initiative = inicMatch[1].trim();
  }

  // 7. BONO DE COMPETENCIA
  const compMatch = text.match(/(?:\*\*Comp\.\*\*|\bComp\.\b|\bCompetencia\b|Bono\s+de\s+Comp\w*|Proficiency(?:\s+Bonus)?)\s*[:·*]*\s*([+\-]?\d+)/i);
  if (compMatch) {
    result.proficiencyBonus = parseInt(compMatch[1].replace('+', ''), 10);
  }

  // 8. SALVACIONES CON COMPETENCIA
  const salvMatch = text.match(/(?:Salvaciones(?:\s+con\s+competencia)?|Tiradas\s+de\s+salvaci[oó]n|Saving\s+Throws)\s*[:*]*\s*([^\n|.]+)/i);
  if (salvMatch) {
    const rawS = salvMatch[1].toUpperCase();
    const found: string[] = [];
    ['SAB', 'INT', 'CAR', 'CON', 'DES', 'FUE', 'WIS', 'CHA', 'STR', 'DEX'].forEach(stat => {
      if (new RegExp(`\\b${stat}\\b`, 'i').test(rawS)) {
        found.push(stat === 'WIS' ? 'SAB' : stat === 'CHA' ? 'CAR' : stat === 'STR' ? 'FUE' : stat === 'DEX' ? 'DES' : stat);
      }
    });
    if (found.length) result.savingThrowProficiencies = Array.from(new Set(found));
  }

  // 9. HABILIDADES
  const expertMatch = text.match(/Habilidades\s+expertas\s*[:*]*\s*([^\n.]+?)(?:\.\s*Competentes|\.|$)/i);
  const expertSkills: string[] = [];
  if (expertMatch) {
    expertMatch[1].split(/[,·]/).forEach(s => {
      const clean = s.replace(/[+\-]?\d+/g, '').replace(/\([^)]+\)/g, '').trim();
      if (clean) expertSkills.push(clean);
    });
  }

  const compSkillsMatch = text.match(/(?:Competentes|Habilidades\s+competentes|Competencias\s+en\s+habilidades|Habilidades|Skills)\s*[:*]*\s*([^\n.]+?)(?:\.\s*Dotes|\.|$)/i);
  const compSkills: string[] = [];
  if (compSkillsMatch) {
    compSkillsMatch[1].split(/[,·]/).forEach(s => {
      const clean = s.replace(/[+\-]?\d+/g, '').replace(/\([^)]+\)/g, '').trim();
      if (clean) compSkills.push(clean);
    });
  }

  const allSkills = Array.from(new Set([...expertSkills, ...compSkills]));
  if (allSkills.length > 0) {
    result.skillProficiencies = allSkills;
  }

  // 10. MAGIA / SPELLCASTING (sólo si existe en el texto)
  const magicMatch = text.match(/(?:Magia|Spellcasting|Aptitud\s+M[aá]gica|Lanzamiento\s+de\s+conjuros)\s*[:*]*\s*([^\n.]+)/i);
  if (magicMatch) {
    const mStr = magicMatch[1];
    const abilityMatch = mStr.match(/\b(SAB|INT|CAR|FUE|DES|CON|WIS|CHA|STR|DEX)\b/i);
    const cdMatch = mStr.match(/CD\s*(\d+)/i);
    const atkMatch = mStr.match(/(?:Ataque|Bono)\s*([+\-]?\d+)/i);

    let abilityName = 'Sabiduría';
    if (abilityMatch) {
      const abUpper = abilityMatch[1].toUpperCase();
      if (abUpper === 'INT') abilityName = 'Inteligencia';
      else if (abUpper === 'CAR' || abUpper === 'CHA') abilityName = 'Carisma';
      else if (abUpper === 'SAB' || abUpper === 'WIS') abilityName = 'Sabiduría';
    }

    result.spellcasting = {
      ability: abilityName,
      saveDc: cdMatch ? parseInt(cdMatch[1], 10) : undefined,
      attackBonus: atkMatch ? parseInt(atkMatch[1].replace('+', ''), 10) : undefined
    };
  }

  // 11. MONEDAS / CURRENCIES (ÚNICAMENTE si están escritas en el texto; por defecto 0)
  const currencies: PlayerCurrencies = {
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0
  };

  const gpMatch = text.match(/(\d+)\s*(?:PO|GP|oro|gold|piezas?\s+de\s+oro)/i);
  if (gpMatch) currencies.gp = parseInt(gpMatch[1], 10);

  const spMatch = text.match(/(\d+)\s*(?:PP|SP|plata|silver|piezas?\s+de\s+plata)/i);
  if (spMatch) currencies.sp = parseInt(spMatch[1], 10);

  const cpMatch = text.match(/(\d+)\s*(?:PC|CP|cobre|copper|piezas?\s+de\s+cobre)/i);
  if (cpMatch) currencies.cp = parseInt(cpMatch[1], 10);

  const epMatch = text.match(/(\d+)\s*(?:PE|EP|electro|electrum)/i);
  if (epMatch) currencies.ep = parseInt(epMatch[1], 10);

  const ppMatch = text.match(/(\d+)\s*(?:PT|PP|platino|platinum|piezas?\s+de\s+platino)/i);
  if (ppMatch) currencies.pp = parseInt(ppMatch[1], 10);

  result.currencies = currencies;

  // 12. INVENTARIO / OBJETOS GENÉRICOS DEL DOCUMENTO
  const parsedItems: InventoryItem[] = [];
  const inventorySection = text.match(/(?:###?\s*(?:Inventario|Equipo|Objetos|Armas|Posesiones|Equipment|Items)[\s\S]*?)(?:###|$)/i);
  const targetTextForItems = inventorySection ? inventorySection[0] : text;

  // Si hay sección explícita de inventario, parsear sus líneas
  if (inventorySection) {
    const lines = targetTextForItems.split('\n');
    lines.forEach((line, idx) => {
      const clean = line.trim().replace(/^[-*•]\s*/, '').trim();
      if (clean && !clean.startsWith('#') && !clean.startsWith('|') && clean.length > 2 && clean.length < 120) {
        // Ignorar encabezados o metadatos
        if (/^(?:nombre|clase|raza|nivel|pg|ca|vel|inic|fue|des|con|int|sab|car)\b/i.test(clean)) return;

        let category: InventoryItem['category'] = 'equipment';
        if (/espada|hacha|maza|arco|bast[oó]n|daga|lanza|martillo|greataxe|sword|bow/i.test(clean)) category = 'weapon';
        else if (/armadura|escudo|cota|cuero|shield|armor/i.test(clean)) category = 'armor';
        else if (/poci[oó]n|elixir|ung[uü]ento|potion/i.test(clean)) category = 'potion';
        else if (/pergamino|scroll|tomo|grimorio/i.test(clean)) category = 'scroll';
        else if (/anillo|amuleto|vara|foco|varita|magic/i.test(clean)) category = 'magic';

        // Evitar marcar como armadura objetos de adivinación u oráculos
        if (/fionn|ogham|or[aá]culo|reliquia/i.test(clean)) {
          category = 'magic';
        }

        parsedItems.push({
          id: `item_doc_${idx}_${Date.now()}`,
          name: clean,
          category,
          quantity: 1,
          equipped: category === 'weapon'
        });
      }
    });
  }

  if (parsedItems.length > 0) {
    const refined = refineAndDeduplicateInventory(parsedItems, text);
    if (!result.inventory || result.inventory.length === 0) {
      result.inventory = refined;
    }
  }

  // 13. NOTAS & TRASFONDO
  if (!result.sheetText) {
    result.sheetText = text;
  }

  return result;
}

/**
 * Asegura que una ficha de personaje tenga campos consistentes sin sobreescribir
 * arbitrariamente con datos inventados.
 */
export function ensureValidPlayerCharacter(pc?: PlayerCharacter): PlayerCharacter {
  const neutralPc: PlayerCharacter = {
    name: 'Protagonista',
    level: '1',
    hp: 10,
    maxHp: 10,
    ac: 10,
    speed: '30 pies',
    initiative: '+0',
    proficiencyBonus: 2,
    attributes: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    },
    savingThrowProficiencies: [],
    skillProficiencies: [],
    currencies: {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 0,
      pp: 0
    },
    inventory: []
  };

  if (!pc) return neutralPc;

  // Si tiene sheetText y atributos no definidos, parseamos pero sin pisar el inventario ya procesado
  if (pc.sheetText) {
    const parsed = parseDndSheetText(pc.sheetText, pc);
    const merged: PlayerCharacter = {
      ...neutralPc,
      ...parsed,
      ...pc,
      inventory: pc.inventory && pc.inventory.length > 0 ? pc.inventory : (parsed.inventory || []),
      currencies: pc.currencies || parsed.currencies || neutralPc.currencies,
      attributes: pc.attributes || parsed.attributes || neutralPc.attributes
    };
    return validateCharacterEquipment(merged);
  }

  const merged: PlayerCharacter = {
    ...neutralPc,
    ...pc,
    currencies: pc.currencies || neutralPc.currencies,
    attributes: pc.attributes || neutralPc.attributes
  };
  return validateCharacterEquipment(merged);
}
