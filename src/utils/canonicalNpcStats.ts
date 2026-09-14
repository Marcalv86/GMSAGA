import { PlayerCharacter, CharacterAction, CharacterTrait, NPC } from '../types';
import { getAIClient, BACKGROUND_LIGHTWEIGHT_MODEL_ID } from './geminiHelper';

/**
 * Base de datos de estadísticas canónicas oficiales de D&D 5e
 * para personajes destacados de los Reinos Olvidados (especialmente Bregan D'aerthe).
 */
export interface CanonicalStatblock {
  name: string;
  aliases?: string[];
  race: string;
  class: string;
  cr: string;
  ac: number;
  hp: number;
  maxHp: number;
  speed: string;
  attributes: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  savingThrows?: string[];
  skills?: string[];
  senses?: string;
  languages: string;
  traits: CharacterTrait[];
  actions: CharacterAction[];
  legendaryActions?: CharacterAction[];
  source?: string;
}

export const CANONICAL_NPCS_5E: Record<string, CanonicalStatblock> = {
  'soluun xibrindas': {
    name: 'Soluun Xibrindas',
    aliases: ['soluun'],
    race: 'Elfo (Drow)',
    class: 'Pistolero Drow / Asesino (Lugarteniente de Bregan D\'aerthe)',
    cr: 'CR 5',
    ac: 15,
    hp: 71,
    maxHp: 71,
    speed: '30 pies',
    attributes: { str: 13, dex: 18, con: 14, int: 11, wis: 13, cha: 12 },
    savingThrows: ['DES +7', 'CON +5', 'SAB +4'],
    skills: ['Percepción +7', 'Sigilo +10'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 17',
    languages: 'Élfico (Drow), Señas silenciosas drow (avanzado), Infracomún (fluido), Común (fluido)',
    traits: [
      {
        name: 'Ancestros Feéricos',
        description: 'Tiene ventaja en las tiradas de salvación para evitar ser hechizado y la magia no puede dormirlo.'
      },
      {
        name: 'Sensibilidad a la Luz Solar',
        description: 'Desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo luz solar directa.'
      },
      {
        name: 'Conjuros Innatos Drow',
        description: 'Carisma (salvación CD 12). A voluntad: Luces danzantes. 1/día cada uno: Oscuridad, Fuego feérico, Levitar (solo sobre sí mismo).'
      }
    ],
    actions: [
      {
        name: 'Ataque Múltiple',
        description: 'Realiza dos ataques con su pistola o con su espada ropera.'
      },
      {
        name: 'Pistola +2',
        damageOrEffect: '1d10 + 6 perforante',
        description: 'Ataque a distancia con arma: +8 a impactar, alcance 30/90 pies, un objetivo. Impacto: 10 (1d10 + 5) daño perforante.'
      },
      {
        name: 'Espada Ropera Envenenada',
        damageOrEffect: '1d8 + 4 perforante + 3d6 veneno',
        description: 'Ataque cuerpo a cuerpo con arma: +7 a impactar, alcance 5 pies, un objetivo. Impacto: 8 (1d8 + 4) daño perforante más 10 (3d6) de daño por veneno drow.'
      }
    ],
    source: 'Waterdeep: Dragon Heist (p. 201)'
  },

  'jarlaxle baenre': {
    name: 'Jarlaxle Baenre',
    aliases: ['jarlaxle', 'j.b.', 'jb', 'oficial corsario'],
    race: 'Elfo (Drow)',
    class: 'Líder Supremo de Bregan D\'aerthe / Maestro de Espías',
    cr: 'CR 15',
    ac: 24,
    hp: 123,
    maxHp: 123,
    speed: '30 pies',
    attributes: { str: 12, dex: 22, con: 13, int: 18, wis: 15, cha: 20 },
    savingThrows: ['DES +11', 'CON +6', 'SAB +7', 'CAR +10'],
    skills: ['Acrobacias +11', 'Atletismo +6', 'Engaño +15', 'Perspicacia +7', 'Percepción +7', 'Persuasión +15', 'Juego de Manos +11', 'Sigilo +11'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 17',
    languages: 'Común, Drow, Lenguaje de señas drow, Élfico, Infracomún (todos fluidos con oratoria magistral)',
    traits: [
      {
        name: 'Ancestros Feéricos & Evasión',
        description: 'Ventaja contra hechizos; inmune a dormir mágico. Si supera una salvación de DES para reducir a la mitad, no sufre daño.'
      },
      {
        name: 'Ataque Furtivo (1/turno)',
        description: 'Inflige 24 (7d6) de daño extra a un objetivo que impacte con ventaja o con un aliado adyacente.'
      },
      {
        name: 'Arsenal Mágico Prodigioso',
        description: 'Parche de inmunidad a detección y visión verdadera 30 pies; sombrero de disfraz y pluma de diadema; capa de piwafwi y plumas; varita de visiones y anillos de protección.'
      }
    ],
    actions: [
      {
        name: 'Ataque Múltiple',
        description: 'Realiza tres ataques con espada ropera o lanza hasta tres dagas ilusorias/arrojadizas de retorno.'
      },
      {
        name: 'Espada Ropera +3',
        damageOrEffect: '1d8 + 9 perforante',
        description: 'Ataque cuerpo a cuerpo: +14 a impactar, alcance 5 pies. Impacto: 13 (1d8 + 9) perforante.'
      },
      {
        name: 'Daga Arrojadiza de Retorno +2',
        damageOrEffect: '1d4 + 8 perforante',
        description: 'Ataque a distancia: +13 a impactar, alcance 20/60 pies. Vuelve mágicamente a su mano de inmediato.'
      }
    ],
    legendaryActions: [
      {
        name: 'Finta o Movimiento Rápido',
        description: 'Se mueve hasta su velocidad sin provocar ataques de oportunidad.'
      },
      {
        name: 'Lanzamiento de Daga Rápido',
        description: 'Realiza un ataque de daga arrojadiza contra una criatura a su alcance.'
      }
    ],
    source: 'Waterdeep: Dragon Heist (p. 206)'
  },

  'kimmuriel oblodra': {
    name: 'Kimmuriel Oblodra',
    aliases: ['kimmuriel'],
    race: 'Elfo (Drow)',
    class: 'Archipsiónico / Co-líder de Bregan D\'aerthe',
    cr: 'CR 14',
    ac: 17,
    hp: 99,
    maxHp: 99,
    speed: '30 pies',
    attributes: { str: 10, dex: 16, con: 14, int: 20, wis: 16, cha: 14 },
    savingThrows: ['INT +10', 'SAB +8'],
    skills: ['Arcanos +10', 'Perspicacia +8', 'Percepción +8'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 18',
    languages: 'Drow, Lenguaje de señas drow, Infracomún, Común (avanzado)',
    traits: [
      {
        name: 'Maestría Psiónica',
        description: 'No requiere componentes verbales ni somáticos para manifestar disciplinas mentales y telepatía.'
      }
    ],
    actions: [
      {
        name: 'Descarga Mental Psiónica',
        damageOrEffect: '4d10 psíquico',
        description: 'Ataque a distancia mental: salvación de INT CD 18 o 22 (4d10) de daño psíquico y aturdimiento.'
      }
    ],
    source: 'Canon Forgotten Realms / R.A. Salvatore'
  },

  'fel\'rekt lafeen': {
    name: 'Fel\'rekt Lafeen',
    aliases: ['felrekt', 'fel\'rekt'],
    race: 'Elfo (Drow)',
    class: 'Pistolero Drow / Lugarteniente de Bregan D\'aerthe',
    cr: 'CR 3',
    ac: 15,
    hp: 44,
    maxHp: 44,
    speed: '30 pies',
    attributes: { str: 11, dex: 17, con: 13, int: 11, wis: 12, cha: 14 },
    savingThrows: ['DES +5', 'CAR +4'],
    skills: ['Sigilo +7', 'Percepción +5'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 15',
    languages: 'Drow, Señas drow (avanzado), Infracomún, Común (medio / funcional)',
    traits: [
      {
        name: 'Ancestros Feéricos & Disparo Certero',
        description: 'Ventaja contra hechizos de dormir. Ignora cobertura media con armas de fuego.'
      }
    ],
    actions: [
      {
        name: 'Pistola Drow',
        damageOrEffect: '1d10 + 3 perforante',
        description: 'Ataque a distancia: +5 a impactar, alcance 30/90 pies. Impacto: 8 (1d10 + 3) perforante.'
      }
    ],
    source: 'Waterdeep: Dragon Heist (p. 202)'
  }
};

/**
 * Busca si un nombre corresponde a un PNJ canónico registrado en la base 5e.
 */
export function buscarEstadisticasCanonicas(nombre: string): CanonicalStatblock | null {
  if (!nombre) return null;
  const limpio = nombre.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const [clave, block] of Object.entries(CANONICAL_NPCS_5E)) {
    if (limpio === clave || limpio.includes(clave) || clave.includes(limpio)) {
      return block;
    }
    if (block.aliases?.some(a => limpio === a || limpio.includes(a))) {
      return block;
    }
  }
  return null;
}

/**
 * Convierte un CanonicalStatblock en un PlayerCharacter compatible con characterSheet.
 */
export function statblockAPlayerCharacter(stat: CanonicalStatblock): PlayerCharacter {
  return {
    name: stat.name,
    race: stat.race,
    class: stat.class,
    title: `${stat.race} · ${stat.class}`,
    cr: stat.cr,
    challengeRating: stat.cr,
    level: stat.cr,
    ac: stat.ac,
    hp: stat.hp,
    maxHp: stat.maxHp,
    speed: stat.speed,
    attributes: { ...stat.attributes },
    languages: [stat.languages],
    proficienciesAndLanguages: stat.languages,
    traits: stat.traits,
    actions: stat.actions,
    characterType: 'npc'
  };
}

/**
 * Genera o consulta la ficha canónica oficial de D&D 5e para un PNJ.
 * Si es canónico conocido, la resuelve instantáneamente.
 * Si es otro personaje, consulta la IA (Gemini 3.5 Flash Lite) para extraer/generar su statblock oficial.
 */
export async function obtenerOGenerarFichaNpc(
  npc: NPC,
  apiKey?: string
): Promise<{ sheet: PlayerCharacter; cr: string; idiomas: string }> {
  // 1. Comprobación rápida en la base de datos canónica pre-cargada
  const canonico = buscarEstadisticasCanonicas(npc.name) ||
    (npc.trueIdentity ? buscarEstadisticasCanonicas(npc.trueIdentity) : null) ||
    (npc.alias ? buscarEstadisticasCanonicas(npc.alias) : null);

  if (canonico) {
    const sheet = statblockAPlayerCharacter(canonico);
    return {
      sheet,
      cr: canonico.cr,
      idiomas: canonico.languages
    };
  }

  // 2. Si no está en la base local, consultamos con IA (Flash Lite 3.5)
  const ai = getAIClient(apiKey);
  const prompt = `Eres el mayor experto en D&D 5e y Reinos Olvidados (Forgotten Realms).
Tu tarea es proporcionar la FICHA / STATBLOCK OFICIAL DE D&D 5E para el siguiente personaje no jugador:

Nombre: "${npc.name}"
${npc.alias ? `Alias / Apodo: "${npc.alias}"` : ''}
${npc.trueIdentity ? `Identidad verdadera: "${npc.trueIdentity}"` : ''}
${npc.notes ? `Notas / Contexto: "${npc.notes}"` : ''}
${npc.appearance ? `Apariencia: "${npc.appearance}"` : ''}

INSTRUCCIONES CLAVE:
1. Si este personaje es CANÓNICO de D&D 5e / Reinos Olvidados (por ejemplo de libros oficiales como "Waterdeep: Dragon Heist", "Monster Manual", novelas de R.A. Salvatore o aventuras de Wizards of the Coast), debes usar o buscar sus estadísticas OFICIALES EXACTAS (CR / Desafío, CA, PG, Atributos FUE/DES/CON/INT/SAB/CAR, salvaciones, habilidades, idiomas y acciones).
2. Si es un PNJ incidental o secundario (por ejemplo marinero, posadero, corsario raso, explorador), asígnale un statblock balanceado de D&D 5e apropiado para su rol (ej: marinero drow CR 1/4 o 1/2; matón CR 1/2; capitán corsario CR 3-5; etc.).
3. Idiomas: Determina su idioma racial de base (con señas si es drow) y común si procede, con su nivel de dominio (chapurreado, medio, avanzado).

RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA (sin markdown adicional):
{
  "name": "${npc.name}",
  "race": "Raza exacta (ej. Elfo Drow, Humano, etc.)",
  "class": "Clase o Rol (ej. Pistolero Drow / Asesino, Corsario, Mago, etc.)",
  "cr": "CR 5 (o el valor de desafío que corresponda)",
  "ac": 15,
  "hp": 71,
  "maxHp": 71,
  "speed": "30 pies",
  "attributes": {
    "str": 13,
    "dex": 18,
    "con": 14,
    "int": 11,
    "wis": 13,
    "cha": 12
  },
  "savingThrows": ["DES +7", "CON +5"],
  "skills": ["Percepción +7", "Sigilo +10"],
  "senses": "Visión en la oscuridad 120 pies, Percepción pasiva 17",
  "languages": "Drow (nativo), Señas drow (avanzado), Común (fluido)",
  "traits": [
    { "name": "Nombre Rasgo", "description": "Efecto mecánico" }
  ],
  "actions": [
    { "name": "Nombre Ataque", "damageOrEffect": "1d10 + 4", "description": "Detalle del ataque o acción" }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: BACKGROUND_LIGHTWEIGHT_MODEL_ID,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const text = response.text?.trim() || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se recibió JSON válido de la IA');
    }

    const data = JSON.parse(jsonMatch[0]);

    const crNormalizado = data.cr ? (String(data.cr).toUpperCase().startsWith('CR') ? String(data.cr).toUpperCase() : `CR ${data.cr}`) : 'CR 1/2';
    const sheet: PlayerCharacter = {
      name: data.name || npc.name,
      race: data.race || 'Desconocida',
      class: data.class || 'Aventurero',
      title: `${data.race || ''} · ${data.class || ''}`.trim(),
      cr: crNormalizado,
      challengeRating: crNormalizado,
      level: crNormalizado,
      ac: Number(data.ac) || 12,
      hp: Number(data.hp) || 20,
      maxHp: Number(data.maxHp || data.hp) || 20,
      speed: data.speed || '30 pies',
      attributes: {
        str: Number(data.attributes?.str) || 10,
        dex: Number(data.attributes?.dex) || 10,
        con: Number(data.attributes?.con) || 10,
        int: Number(data.attributes?.int) || 10,
        wis: Number(data.attributes?.wis) || 10,
        cha: Number(data.attributes?.cha) || 10
      },
      savingThrowProficiencies: Array.isArray(data.savingThrows) ? data.savingThrows : [],
      skillProficiencies: Array.isArray(data.skills) ? data.skills : [],
      languages: data.languages ? [data.languages] : [],
      proficienciesAndLanguages: data.languages || '',
      traits: Array.isArray(data.traits) ? data.traits : [],
      actions: Array.isArray(data.actions) ? data.actions : [],
      characterType: 'npc'
    };

    return {
      sheet,
      cr: crNormalizado,
      idiomas: data.languages || 'Común'
    };
  } catch (err) {
    console.warn('[generarFichaCanonicaNpc] Fallo en generación con IA, aplicando plantilla base:', err);
    // Plantilla de emergencia equilibrada
    const emergencySheet: PlayerCharacter = {
      name: npc.name,
      race: 'Desconocida',
      class: 'Aventurero / Corsario',
      title: 'PNJ de Campaña',
      cr: 'CR 1/2',
      challengeRating: 'CR 1/2',
      level: 'CR 1/2',
      ac: 13,
      hp: 22,
      maxHp: 22,
      speed: '30 pies',
      attributes: { str: 11, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
      languages: [npc.idiomas || 'Común'],
      characterType: 'npc'
    };

    return {
      sheet: emergencySheet,
      cr: 'CR 1/2',
      idiomas: npc.idiomas || 'Común'
    };
  }
}
