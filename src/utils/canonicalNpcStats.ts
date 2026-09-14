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
  },

  'drizzt do\'urden': {
    name: 'Drizzt Do\'Urden',
    aliases: ['drizzt', 'drizzt do urden'],
    race: 'Elfo (Drow)',
    class: 'Explorador / Héroe de Mithril Hall',
    cr: 'CR 8',
    ac: 19,
    hp: 91,
    maxHp: 91,
    speed: '40 pies',
    attributes: { str: 13, dex: 20, con: 15, int: 17, wis: 17, cha: 14 },
    savingThrows: ['DES +8', 'FUE +4', 'SAB +6'],
    skills: ['Acrobacias +8', 'Atletismo +4', 'Percepción +9', 'Sigilo +11', 'Supervivencia +9'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 19',
    languages: 'Común, Drow, Lenguaje de señas drow, Élfico, Enano, Infracomún',
    traits: [
      {
        name: 'Maestría en Dos Armas & Evasión',
        description: 'Puede atacar con ambas cimitarras sumando su mod de DES al daño secundario. No sufre daño al superar salvaciones de DES.'
      },
      {
        name: 'Ancestros Feéricos & Ceguera Solar Superada',
        description: 'Ventaja contra hechizos que duerman o hechicen. Ha superado gran parte de la sensibilidad drow a la superficie.'
      }
    ],
    actions: [
      {
        name: 'Ataque Múltiple',
        description: 'Realiza tres ataques con sus cimitarras mágicas (Muerte Helada y Centella).'
      },
      {
        name: 'Muerte Helada (Cimitarra +3)',
        damageOrEffect: '1d6 + 8 cortante + 1d6 frío',
        description: 'Ataque cuerpo a cuerpo: +11 a impactar, alcance 5 pies. Impacto: 11 (1d6 + 8) cortante más 3 (1d6) daño de frío.'
      },
      {
        name: 'Centella (Cimitarra Defensora +2)',
        damageOrEffect: '1d6 + 7 cortante',
        description: 'Ataque cuerpo a cuerpo: +10 a impactar, alcance 5 pies. Puede transferir bonificador de ataque a su CA.'
      }
    ],
    source: 'Canon Forgotten Realms / R.A. Salvatore'
  },

  'zaknafein do\'urden': {
    name: 'Zaknafein Do\'Urden',
    aliases: ['zaknafein'],
    race: 'Elfo (Drow)',
    class: 'Maestro de Armas de la Casa Do\'Urden',
    cr: 'CR 10',
    ac: 18,
    hp: 105,
    maxHp: 105,
    speed: '35 pies',
    attributes: { str: 14, dex: 20, con: 15, int: 15, wis: 14, cha: 13 },
    savingThrows: ['DES +9', 'FUE +6', 'CON +6'],
    skills: ['Acrobacias +9', 'Atletismo +6', 'Percepción +6', 'Sigilo +9'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 16',
    languages: 'Drow, Señas drow, Infracomún',
    traits: [
      {
        name: 'Maestro Supremo de Esgrima Drow',
        description: 'Sus impactos críticos ocurren con 19 y 20 en el d20. Puede realizar un ataque adicional si impacta a dos enemigos distintos.'
      }
    ],
    actions: [
      {
        name: 'Ataque Múltiple',
        description: 'Realiza tres ataques con espada larga o espada corta ropera.'
      },
      {
        name: 'Espada Larga Fina de Adamantina +2',
        damageOrEffect: '1d8 + 7 cortante',
        description: 'Ataque cuerpo a cuerpo: +11 a impactar, alcance 5 pies. Impacto: 11 (1d8 + 7) cortante.'
      }
    ],
    source: 'Canon Menzoberranzan / R.A. Salvatore'
  },

  'artemis entreri': {
    name: 'Artemis Entreri',
    aliases: ['entreri', 'artemis'],
    race: 'Humano',
    class: 'Maestro Asesino de Calimport',
    cr: 'CR 11',
    ac: 19,
    hp: 110,
    maxHp: 110,
    speed: '30 pies',
    attributes: { str: 13, dex: 20, con: 14, int: 16, wis: 15, cha: 14 },
    savingThrows: ['DES +9', 'INT +7'],
    skills: ['Acrobacias +9', 'Atletismo +5', 'Engaño +6', 'Percepción +6', 'Sigilo +13'],
    senses: 'Percepción pasiva 16',
    languages: 'Común, Alzhedo, Infracomún, Señas de ladrones',
    traits: [
      {
        name: 'Ataque Furtivo Mortal (1/turno)',
        description: 'Inflige 21 (6d6) de daño adicional si tiene ventaja o un aliado está adyacente.'
      },
      {
        name: 'Asesinato Preciso',
        description: 'Ventaja en tiradas de ataque contra cualquier criatura que aún no haya actuado en el combate. Golpes sorpresa son críticos automáticos.'
      }
    ],
    actions: [
      {
        name: 'Ataque Múltiple',
        description: 'Realiza tres ataques con espada o daga robavidas.'
      },
      {
        name: 'Espada de Calimport +2',
        damageOrEffect: '1d8 + 7 cortante',
        description: 'Ataque cuerpo a cuerpo: +11 a impactar, alcance 5 pies. Impacto: 11 (1d8 + 7) cortante.'
      },
      {
        name: 'Daga Robavidas de Vampirismo',
        damageOrEffect: '1d4 + 7 perforante + 2d6 necrótico',
        description: 'Ataque cuerpo a cuerpo: +11 a impactar. Si impacta, recupera PG temporales equivalentes al daño necrótico infligido.'
      }
    ],
    source: 'Canon Forgotten Realms / R.A. Salvatore'
  },

  'gromph baenre': {
    name: 'Gromph Baenre',
    aliases: ['gromph'],
    race: 'Elfo (Drow)',
    class: 'Archimago de Menzoberranzan (Sorcere)',
    cr: 'CR 20',
    ac: 17,
    hp: 135,
    maxHp: 135,
    speed: '30 pies',
    attributes: { str: 10, dex: 14, con: 14, int: 20, wis: 15, cha: 16 },
    savingThrows: ['INT +11', 'SAB +8'],
    skills: ['Arcanos +17', 'Historia +11', 'Perspicacia +8', 'Percepción +8'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 18',
    languages: 'Drow, Señas drow, Infracomún, Dracónico, Abisal, Común',
    traits: [
      {
        name: 'Lanzamiento de Conjuros Arcanos (Nivel 18)',
        description: 'Conoce y domina conjuros hasta nivel 9 de la academia de magia Sorcere (CD de salvación 19, +11 a impactar).'
      }
    ],
    actions: [
      {
        name: 'Vara de Poder Arcano',
        damageOrEffect: '1d6 + 3 contundente + 2d6 fuerza',
        description: 'Ataque cuerpo a cuerpo mágico: +8 a impactar. Puede gastar cargas para lanzar Bolas de Fuego, Rayo Relámpago o Escudo.'
      }
    ],
    source: 'Out of the Abyss (p. 235)'
  },

  'dab\'nay tr\'arach': {
    name: 'Dab\'nay Tr\'arach',
    aliases: ['dabnay', 'dab\'nay', 'oficial dabnay'],
    race: 'Elfa (Drow)',
    class: 'Oficial Náutica / Corsaria de Bregan D\'aerthe',
    cr: 'CR 3',
    ac: 15,
    hp: 52,
    maxHp: 52,
    speed: '30 pies',
    attributes: { str: 12, dex: 17, con: 14, int: 13, wis: 13, cha: 14 },
    savingThrows: ['DES +5', 'SAB +3'],
    skills: ['Navegación +5', 'Percepción +5', 'Sigilo +7', 'Atletismo +3'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 15',
    languages: 'Drow, Señas drow (avanzado), Infracomún (fluido), Común (medio / funcional marinero)',
    traits: [
      {
        name: 'Táctica de Maniobra Corsaria',
        description: 'Ventaja en chequeos de acrobacias y atletismo sobre aparejos navales y cubiertas mecidas por oleaje.'
      },
      {
        name: 'Ancestros Feéricos',
        description: 'Ventaja contra ser hechizada; inmune a dormir mágico.'
      }
    ],
    actions: [
      {
        name: 'Ataque Múltiple',
        description: 'Realiza dos ataques con espada ropera o cimitarra.'
      },
      {
        name: 'Cimitarra de la Flota',
        damageOrEffect: '1d6 + 3 cortante',
        description: 'Ataque cuerpo a cuerpo: +5 a impactar, alcance 5 pies. Impacto: 6 (1d6 + 3) cortante.'
      },
      {
        name: 'Ballesta de Mano con Veneno Drow',
        damageOrEffect: '1d6 + 3 perforante (CD 13 CON o dormido)',
        description: 'Ataque a distancia: +5 a impactar, alcance 30/120 pies. El objetivo debe superar salvación CON CD 13 o caer envenenado durante 1 hora (o inconsciente si falla por 5 o más).'
      }
    ],
    source: 'Campaña SAGA / Bregan D\'aerthe 5e'
  },

  'beniago kurso': {
    name: 'Beniago Kurso',
    aliases: ['beniago'],
    race: 'Elfo (Drow / Disfrazado de Humano)',
    class: 'Capitán Mercante & Espía de Bregan D\'aerthe',
    cr: 'CR 5',
    ac: 16,
    hp: 68,
    maxHp: 68,
    speed: '30 pies',
    attributes: { str: 12, dex: 18, con: 14, int: 15, wis: 13, cha: 18 },
    savingThrows: ['DES +7', 'CAR +7'],
    skills: ['Engaño +10', 'Persuasión +10', 'Perspicacia +4', 'Juego de Manos +7', 'Sigilo +7'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 14',
    languages: 'Común, Élfico, Drow, Señas drow, Infracomún, Enano (todos fluidos con registro comercial impecable)',
    traits: [
      {
        name: 'Maestro del Disfraz y Tapadera',
        description: 'Utiliza magia ilusoria para camuflar sus rasgos drow bajo la apariencia de un refinado comerciante luskita.'
      }
    ],
    actions: [
      {
        name: 'Ataque Múltiple',
        description: 'Realiza dos ataques con espada ropera.'
      },
      {
        name: 'Espada Ropera de Mercader',
        damageOrEffect: '1d8 + 4 perforante',
        description: 'Ataque cuerpo a cuerpo: +7 a impactar, alcance 5 pies. Impacto: 8 (1d8 + 4) perforante.'
      }
    ],
    source: 'Waterdeep: Dragon Heist / Bregan D\'aerthe'
  },

  'valas hune': {
    name: 'Valas Hune',
    aliases: ['valas'],
    race: 'Elfo (Drow)',
    class: 'Explorador Mayor de Bregan D\'aerthe',
    cr: 'CR 6',
    ac: 16,
    hp: 78,
    maxHp: 78,
    speed: '35 pies',
    attributes: { str: 13, dex: 18, con: 14, int: 14, wis: 16, cha: 12 },
    savingThrows: ['DES +7', 'SAB +6'],
    skills: ['Percepción +6', 'Sigilo +10', 'Supervivencia +9'],
    senses: 'Visión en la oscuridad 120 pies, Percepción pasiva 16',
    languages: 'Drow, Señas drow, Infracomún, Común (medio)',
    traits: [
      {
        name: 'Rastreador Implacable de la Infraoscuridad',
        description: 'No puede ser sorprendido mientras esté despierto y no deja huellas si viaja en sigilo.'
      }
    ],
    actions: [
      {
        name: 'Ataque Múltiple',
        description: 'Realiza dos ataques con espada o ballesta pesada.'
      },
      {
        name: 'Ballesta Pesada Modificada',
        damageOrEffect: '1d10 + 4 perforante',
        description: 'Ataque a distancia: +7 a impactar, alcance 100/400 pies.'
      }
    ],
    source: 'Canon Forgotten Realms / Bregan D\'aerthe'
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
    savingThrowProficiencies: stat.savingThrows || [],
    skillProficiencies: stat.skills || [],
    languages: [stat.languages],
    proficienciesAndLanguages: stat.languages,
    traits: stat.traits,
    actions: stat.actions,
    characterType: 'npc'
  };
}

/**
 * Genera un statblock completo, balanceado y canónico de D&D 5e de forma determinista
 * e instantánea para cualquier PNJ incidental o secundario, deduciendo su raza, rol,
 * atributos, CA, PG, salvaciones, rasgos, idiomas y acciones según su nombre, notas y contexto.
 */
export function generarStatblockDnd5eBase(
  npc: Partial<NPC> & { name: string; race?: string; class?: string }
): CanonicalStatblock {
  const nombre = npc.name.trim();
  const textoContexto = [
    nombre,
    npc.alias || '',
    npc.trueIdentity || '',
    npc.race || '',
    npc.class || '',
    npc.notes || '',
    npc.description || '',
    npc.appearance || '',
    npc.relation || '',
    npc.idiomas || ''
  ].join(' ').toLowerCase();

  // 1. Detección de Raza
  let raza = npc.race || (npc.characterSheet?.race);
  let esDrow = false;
  if (!raza) {
    if (
      textoContexto.includes('drow') ||
      textoContexto.includes('elfo oscuro') ||
      textoContexto.includes('elfa oscura') ||
      textoContexto.includes('bregan') ||
      textoContexto.includes('menzoberranzan') ||
      textoContexto.includes('piwafwi') ||
      textoContexto.includes('infraoscuridad') ||
      textoContexto.includes('infracomun') ||
      textoContexto.includes('infracomún')
    ) {
      raza = 'Elfo (Drow)';
      esDrow = true;
    } else if (textoContexto.includes('enano') || textoContexto.includes('enana')) {
      raza = 'Enano del Escudo';
    } else if (textoContexto.includes('elfo') || textoContexto.includes('elfa')) {
      raza = 'Elfo de la Luna';
    } else if (textoContexto.includes('mediano') || textoContexto.includes('halfling')) {
      raza = 'Mediano Piesligeros';
    } else if (textoContexto.includes('gnomo') || textoContexto.includes('gnoma')) {
      raza = 'Gnomo de las Rocas';
    } else if (textoContexto.includes('tiefling')) {
      raza = 'Tiefling';
    } else if (textoContexto.includes('semiorco') || textoContexto.includes('orco')) {
      raza = 'Semiorco';
    } else if (textoContexto.includes('dracónido') || textoContexto.includes('dragonborn')) {
      raza = 'Dracónido';
    } else {
      // Por defecto en ambientación costera / corsaria con Bregan D'aerthe
      raza = textoContexto.includes('sombra') || textoContexto.includes('corsari') ? 'Elfo (Drow)' : 'Humano de la Costa de la Espada';
      esDrow = raza.includes('Drow');
    }
  } else {
    esDrow = raza.toLowerCase().includes('drow') || raza.toLowerCase().includes('oscuro');
  }

  // 2. Detección de Arquetipo / Clase / Rol
  let clase = npc.class || (npc.characterSheet?.class);
  let rol: 'mago' | 'clerigo' | 'picaro' | 'pistolero' | 'oficial' | 'corsario' | 'guerrero' | 'bardo' | 'plebeyo' = 'corsario';

  if (textoContexto.includes('pistolero')) {
    rol = 'pistolero';
    if (!clase) clase = 'Pistolero Corsario';
  } else if (
    textoContexto.includes('mago') ||
    textoContexto.includes('hechicero') ||
    textoContexto.includes('archimago') ||
    textoContexto.includes('arcano') ||
    textoContexto.includes('psiónico') ||
    textoContexto.includes('brujo')
  ) {
    rol = 'mago';
    if (!clase) clase = 'Mago Arcano';
  } else if (
    textoContexto.includes('clérigo') ||
    textoContexto.includes('clerigo') ||
    textoContexto.includes('sacerdotisa') ||
    textoContexto.includes('lolth') ||
    textoContexto.includes('druida')
  ) {
    rol = 'clerigo';
    if (!clase) clase = 'Clérigo / Devoto';
  } else if (
    textoContexto.includes('pícaro') ||
    textoContexto.includes('picaro') ||
    textoContexto.includes('asesino') ||
    textoContexto.includes('espía') ||
    textoContexto.includes('espia') ||
    textoContexto.includes('ladrón') ||
    textoContexto.includes('infiltrado')
  ) {
    rol = 'picaro';
    if (!clase) clase = 'Pícaro Infiltrado';
  } else if (
    textoContexto.includes('capitán') ||
    textoContexto.includes('capitan') ||
    textoContexto.includes('oficial') ||
    textoContexto.includes('contramaestre') ||
    textoContexto.includes('lugarteniente')
  ) {
    rol = 'oficial';
    if (!clase) clase = 'Oficial Corsario';
  } else if (
    textoContexto.includes('bardo') ||
    textoContexto.includes('músico') ||
    textoContexto.includes('musico') ||
    textoContexto.includes('trovador') ||
    textoContexto.includes('artista')
  ) {
    rol = 'bardo';
    if (!clase) clase = 'Bardo de Taberna';
  } else if (
    textoContexto.includes('guerrero') ||
    textoContexto.includes('soldado') ||
    textoContexto.includes('guardia') ||
    textoContexto.includes('matón') ||
    textoContexto.includes('caballero')
  ) {
    rol = 'guerrero';
    if (!clase) clase = 'Guerrero / Guardia';
  } else if (
    textoContexto.includes('posadero') ||
    textoContexto.includes('tabernero') ||
    textoContexto.includes('mercader') ||
    textoContexto.includes('sirviente') ||
    textoContexto.includes('pescador')
  ) {
    rol = 'plebeyo';
    if (!clase) clase = 'Lugareño / Plebeyo';
  } else {
    rol = 'corsario';
    if (!clase) clase = 'Corsario Marinero';
  }

  // 3. Atributos, CR, CA, PG según rol
  let cr = 'CR 1/2';
  let ac = 13;
  let hp = 22;
  let speed = '30 pies';
  let attributes = { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 };
  let savingThrows: string[] = ['DES +4'];
  let skills: string[] = ['Percepción +2', 'Sigilo +4'];
  const traits: CharacterTrait[] = [];
  const actions: CharacterAction[] = [];

  if (esDrow) {
    traits.push(
      {
        name: 'Ancestros Feéricos',
        description: 'Ventaja en salvaciones contra hechizos; inmune a efectos mágicos de sueño.'
      },
      {
        name: 'Sensibilidad a la Luz Solar',
        description: 'Desventaja en tiradas de ataque y Percepción visual bajo luz de sol directa.'
      }
    );
  }

  switch (rol) {
    case 'pistolero':
      cr = 'CR 3';
      ac = 15;
      hp = 48;
      attributes = { str: 11, dex: 18, con: 14, int: 12, wis: 12, cha: 13 };
      savingThrows = ['DES +6', 'CAR +3'];
      skills = ['Sigilo +6', 'Percepción +3', 'Acrobacias +6'];
      traits.push({
        name: 'Disparo Certero',
        description: 'Ignora cobertura media con armas de proyectil y pistolas.'
      });
      actions.push(
        {
          name: 'Ataque Múltiple',
          description: 'Realiza dos ataques con su pistola o con su espada ropera.'
        },
        {
          name: 'Pistola Drow',
          damageOrEffect: '1d10 + 4 perforante',
          description: 'Ataque a distancia: +6 a impactar, alcance 30/90 pies. Impacto: 9 (1d10 + 4) perforante.'
        },
        {
          name: 'Espada Ropera',
          damageOrEffect: '1d8 + 4 perforante',
          description: 'Ataque cuerpo a cuerpo: +6 a impactar, alcance 5 pies. Impacto: 8 (1d8 + 4) perforante.'
        }
      );
      break;

    case 'oficial':
      cr = 'CR 3';
      ac = 16;
      hp = 55;
      attributes = { str: 12, dex: 17, con: 14, int: 13, wis: 13, cha: 16 };
      savingThrows = ['DES +5', 'CAR +5'];
      skills = ['Engaño +5', 'Persuasión +5', 'Perspicacia +3', 'Percepción +3', 'Sigilo +5'];
      traits.push({
        name: 'Mando Táctico (1/turno)',
        description: 'Puede otorgar +1d4 a la tirada de ataque o salvación de un aliado en 30 pies que pueda escucharle.'
      });
      actions.push(
        {
          name: 'Ataque Múltiple',
          description: 'Realiza dos ataques cuerpo a cuerpo con espada o cimitarra.'
        },
        {
          name: 'Espada Ropera de Oficial',
          damageOrEffect: '1d8 + 3 perforante',
          description: 'Ataque cuerpo a cuerpo: +5 a impactar, alcance 5 pies. Impacto: 7 (1d8 + 3) perforante.'
        },
        {
          name: 'Ballesta de Mano con Veneno Drow',
          damageOrEffect: '1d6 + 3 perforante',
          description: 'Ataque a distancia: +5 a impactar, alcance 30/120 pies. Salvación CON CD 13 o envenenado por 1 hora.'
        }
      );
      break;

    case 'picaro':
      cr = 'CR 2';
      ac = 15;
      hp = 38;
      attributes = { str: 10, dex: 17, con: 13, int: 13, wis: 12, cha: 14 };
      savingThrows = ['DES +5', 'INT +3'];
      skills = ['Sigilo +7', 'Juego de Manos +5', 'Percepción +3', 'Engaño +4'];
      traits.push({
        name: 'Ataque Furtivo (1/turno)',
        description: 'Inflige 7 (2d6) de daño adicional si tiene ventaja o si un aliado está a 5 pies de la víctima.'
      });
      actions.push(
        {
          name: 'Ataque Múltiple',
          description: 'Realiza dos ataques con sus dagas o espadas cortas.'
        },
        {
          name: 'Daga Envenenada',
          damageOrEffect: '1d4 + 3 perforante + 1d6 veneno',
          description: 'Ataque cuerpo a cuerpo o a distancia: +5 a impactar, alcance 5 pies o 20/60 pies. Impacto: 5 (1d4 + 3) perforante más veneno.'
        }
      );
      break;

    case 'mago':
      cr = 'CR 3';
      ac = 13; // Con Armadura de Mago o cuero
      hp = 36;
      attributes = { str: 9, dex: 14, con: 13, int: 16, wis: 13, cha: 12 };
      savingThrows = ['INT +5', 'SAB +3'];
      skills = ['Arcanos +5', 'Historia +5', 'Percepción +3'];
      traits.push({
        name: 'Lanzamiento de Conjuros Arcanos (CD 13, +5 a impactar)',
        description: 'Trucos: Rayo de Escarcha, Ilusión Menor, Luces Danzantes. Nivel 1 (4 espacios): Proyectil Mágico, Escudo, Armadura de Mago. Nivel 2 (2 espacios): Paso Brumoso, Ráfaga Abrasadora.'
      });
      actions.push(
        {
          name: 'Vara / Bastón Arcano',
          damageOrEffect: '1d6 + 1 contundente',
          description: 'Ataque cuerpo a cuerpo: +3 a impactar, alcance 5 pies. Impacto: 4 (1d6 + 1) contundente.'
        },
        {
          name: 'Rayo de Escarcha (Truco)',
          damageOrEffect: '1d8 frío',
          description: 'Ataque de conjuro a distancia: +5 a impactar, alcance 60 pies. Reduce la velocidad del objetivo en 10 pies.'
        }
      );
      break;

    case 'clerigo':
      cr = 'CR 2';
      ac = 16; // Cota de malla o coraza
      hp = 42;
      attributes = { str: 13, dex: 12, con: 14, int: 11, wis: 16, cha: 13 };
      savingThrows = ['SAB +5', 'CAR +3'];
      skills = ['Religión +3', 'Perspicacia +5', 'Medicina +5'];
      traits.push({
        name: 'Magia Divina (CD 13, +5 a impactar)',
        description: 'Trucos: Llama Sagrada, Taumaturgia. Nivel 1 (4 espacios): Curar Heridas, Fuego Púrpura/Escudo de Fe. Nivel 2 (2 espacios): Inmovilizar Persona.'
      });
      actions.push(
        {
          name: 'Maza o Azote Espinoso',
          damageOrEffect: '1d6 + 1 contundente',
          description: 'Ataque cuerpo a cuerpo: +3 a impactar, alcance 5 pies. Impacto: 4 (1d6 + 1) contundente.'
        },
        {
          name: 'Llama Sagrada (Truco)',
          damageOrEffect: '1d8 radiante o fuego',
          description: 'Salvación de DES CD 13 o recibe 1d8 de daño sagrado sin cobertura.'
        }
      );
      break;

    case 'bardo':
      cr = 'CR 2';
      ac = 14;
      hp = 35;
      attributes = { str: 10, dex: 16, con: 12, int: 12, wis: 11, cha: 16 };
      savingThrows = ['DES +5', 'CAR +5'];
      skills = ['Actuación +5', 'Persuasión +5', 'Engaño +5', 'Acrobacias +5'];
      traits.push({
        name: 'Inspiración Bárdica (d6, 3/día)',
        description: 'Puede inspirar a un compañero con una palabra o melodía ingeniosa.'
      });
      actions.push(
        {
          name: 'Espada Ropera Elegante',
          damageOrEffect: '1d8 + 3 perforante',
          description: 'Ataque cuerpo a cuerpo: +5 a impactar, alcance 5 pies. Impacto: 7 (1d8 + 3) perforante.'
        },
        {
          name: 'Burla Cruel (Truco)',
          damageOrEffect: '1d4 psíquico + desventaja',
          description: 'Salvación SAB CD 13 o 1d4 psíquico y desventaja en su próximo ataque.'
        }
      );
      break;

    case 'guerrero':
      cr = 'CR 1';
      ac = 16;
      hp = 45;
      attributes = { str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10 };
      savingThrows = ['FUE +5', 'CON +4'];
      skills = ['Atletismo +5', 'Intimidación +2', 'Percepción +2'];
      traits.push({
        name: 'Estilo de Combate Defensivo',
        description: '+1 a la CA mientras lleve armadura.'
      });
      actions.push(
        {
          name: 'Ataque Múltiple',
          description: 'Realiza dos ataques con espada larga o lanza.'
        },
        {
          name: 'Espada Larga de Soldado',
          damageOrEffect: '1d8 + 3 cortante',
          description: 'Ataque cuerpo a cuerpo: +5 a impactar, alcance 5 pies. Impacto: 7 (1d8 + 3) cortante.'
        }
      );
      break;

    case 'plebeyo':
      cr = 'CR 1/8';
      ac = 11;
      hp = 12;
      attributes = { str: 10, dex: 11, con: 11, int: 10, wis: 10, cha: 10 };
      savingThrows = [];
      skills = ['Percepción +2'];
      actions.push({
        name: 'Garrote o Cuchillo de Trabajo',
        damageOrEffect: '1d4 contundente o perforante',
        description: 'Ataque cuerpo a cuerpo: +2 a impactar, alcance 5 pies. Impacto: 2 (1d4) daño.'
      });
      break;

    case 'corsario':
    default:
      cr = 'CR 1/2';
      ac = 14;
      hp = 26;
      attributes = { str: 11, dex: 15, con: 13, int: 10, wis: 11, cha: 12 };
      savingThrows = ['DES +4'];
      skills = ['Atletismo +2', 'Acrobacias +4', 'Percepción +2', 'Sigilo +4'];
      traits.push({
        name: 'Pies Marineros',
        description: 'Ventaja en salvaciones para evitar ser derribado en superficies inestables o resbaladizas.'
      });
      actions.push(
        {
          name: 'Cimitarra de Abordaje',
          damageOrEffect: '1d6 + 2 cortante',
          description: 'Ataque cuerpo a cuerpo: +4 a impactar, alcance 5 pies. Impacto: 5 (1d6 + 2) cortante.'
        },
        {
          name: 'Daga Arrojadiza / Ballesta Ligera',
          damageOrEffect: '1d4 + 2 perforante',
          description: 'Ataque a distancia: +4 a impactar, alcance 20/60 pies. Impacto: 4 (1d4 + 2) perforante.'
        }
      );
      break;
  }

  // 4. Idiomas según raza
  let idiomas = npc.idiomas;
  if (!idiomas) {
    if (esDrow) {
      idiomas = 'Drow (nativo), Señas silenciosas drow (avanzado), Infracomún (fluido), Común (medio / funcional)';
    } else if (raza.includes('Enano')) {
      idiomas = 'Enano (nativo), Común (fluido)';
    } else if (raza.includes('Elfo')) {
      idiomas = 'Élfico (nativo), Común (fluido)';
    } else {
      idiomas = 'Común (fluido)';
    }
  }

  const senses = esDrow
    ? 'Visión en la oscuridad 120 pies, Percepción pasiva 12'
    : (raza.includes('Elfo') || raza.includes('Enano') ? 'Visión en la oscuridad 60 pies, Percepción pasiva 12' : 'Percepción pasiva 11');

  return {
    name: nombre,
    race: raza,
    class: clase,
    cr,
    ac,
    hp,
    maxHp: hp,
    speed,
    attributes,
    savingThrows,
    skills,
    senses,
    languages: idiomas,
    traits,
    actions,
    source: 'Motor de Reglas D&D 5e / Forgotten Realms'
  };
}

/**
 * Garantiza de forma instantánea que un PNJ tenga su ficha D&D 5e COMPLETA
 * con atributos (FUE, DES, CON, INT, SAB, CAR), CA, PG, idiomas, rasgos y ataques,
 * tanto si es un PNJ canónico oficial como si es incidental/secundario.
 * No requiere llamadas a la red ni botones bajo demanda: se resuelve de inmediato en memoria.
 */
export function asegurarFichaCompletaNpc(
  npc: Partial<NPC> & { name: string; race?: string; class?: string }
): { sheet: PlayerCharacter; cr: string; idiomas: string } {
  // 1. Si el PNJ ya posee una ficha completa con atributos válidos, respetarla
  if (
    npc.characterSheet &&
    npc.characterSheet.attributes &&
    typeof npc.characterSheet.attributes.str === 'number' &&
    typeof npc.characterSheet.attributes.dex === 'number' &&
    typeof npc.characterSheet.ac === 'number' &&
    typeof npc.characterSheet.hp === 'number'
  ) {
    const cr = String(npc.cr || npc.characterSheet.cr || npc.characterSheet.challengeRating || 'CR 1/2');
    const idiomas = npc.idiomas || (npc.characterSheet.languages?.[0]) || npc.characterSheet.proficienciesAndLanguages || 'Común';
    return {
      sheet: npc.characterSheet,
      cr,
      idiomas
    };
  }

  // 2. Comprobar si corresponde a un PNJ canónico de los Reinos Olvidados
  const canonico =
    buscarEstadisticasCanonicas(npc.name) ||
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

  // 3. Generar statblock canónico base de D&D 5e contextual e inmediato
  const baseStat = generarStatblockDnd5eBase(npc);
  const sheet = statblockAPlayerCharacter(baseStat);
  return {
    sheet,
    cr: baseStat.cr,
    idiomas: baseStat.languages
  };
}

/**
 * Genera o consulta la ficha canónica oficial de D&D 5e para un PNJ.
 * Si es canónico conocido o si se ejecuta en local, resuelve instantáneamente.
 * Si se solicita enriquecer con IA, consulta Gemini.
 */
export async function obtenerOGenerarFichaNpc(
  npc: NPC,
  apiKey?: string
): Promise<{ sheet: PlayerCharacter; cr: string; idiomas: string }> {
  // Primero aseguramos la ficha base instantánea
  const instantanea = asegurarFichaCompletaNpc(npc);

  // Si no hay API key o es un personaje ya canónico exacto, devolver instantáneo
  const esCanonicoExacto = Boolean(
    buscarEstadisticasCanonicas(npc.name) ||
    (npc.trueIdentity && buscarEstadisticasCanonicas(npc.trueIdentity)) ||
    (npc.alias && buscarEstadisticasCanonicas(npc.alias))
  );

  if (esCanonicoExacto || !apiKey) {
    return instantanea;
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
