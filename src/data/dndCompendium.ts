import {
  CharacterSpell,
  CharacterTrait,
  PlayerAttributes,
  PlayerCharacter,
} from "../types";

export interface CompendiumSpell extends CharacterSpell {
  englishName?: string;
  classes?: string[];
  ritual?: boolean;
}

export interface CompendiumClass {
  name: string;
  hitDice: string;
  primaryAbility: keyof PlayerAttributes;
  savingThrows: string[];
  armorProficiencies: string;
  weaponProficiencies: string;
  skillChoices: string[];
  spellcastingAbility?: "int" | "wis" | "cha";
  spellcastingName?: string;
  description: string;
  iconicTraits: Array<{
    name: string;
    level: number;
    description: string;
    uses?: {
      max: number;
      current: number;
      recovery?: "short_rest" | "long_rest" | "dawn";
    };
  }>;
}

export interface CompendiumRace {
  name: string;
  subrace?: string;
  speed: string;
  attributeBonuses: Partial<PlayerAttributes>;
  languages: string[];
  darkvision?: string;
  traits: Array<{
    name: string;
    description: string;
    uses?: {
      max: number;
      current: number;
      recovery?: "short_rest" | "long_rest" | "dawn";
    };
  }>;
}

export interface CompendiumBackground {
  name: string;
  suggestedSkills: string[];
  toolProficiencies?: string;
  languages?: string;
  equipment?: string;
  featureName: string;
  featureDescription: string;
}

export interface CompendiumFeat {
  name: string;
  prerequisite?: string;
  description: string;
}

export interface CompendiumCompanionTemplate {
  name: string;
  type: "familiar" | "mount" | "animal" | "summon" | "sidekick";
  creatureType: string;
  size: string;
  ac: number;
  hp: number;
  maxHp: number;
  hitDice: string;
  speed: string;
  attributes: PlayerAttributes;
  senses?: string;
  traits: CharacterTrait[];
  actions: Array<{
    name: string;
    type: "attack" | "action" | "reaction";
    description: string;
    damageOrEffect?: string;
  }>;
}

// ---------------------------------------------------------------- COMPENDIO DE HECHIZOS D&D 5E
export const DND_SPELLS_COMPENDIUM: CompendiumSpell[] = [
  // TRUCOS (NIVEL 0)
  {
    name: "Guía",
    englishName: "Guidance",
    level: 0,
    school: "Adivinación",
    castingTime: "1 acción",
    range: "Toque",
    components: "V, S",
    duration: "1 minuto (Concentración)",
    classes: ["Clérigo", "Druida", "Artífice"],
    damageOrEffect: "+1d4 a una prueba de característica",
    description:
      "Tocas a una criatura voluntaria. Una vez antes de que el conjuro termine, el objetivo puede tirar un d4 y sumar el resultado a una prueba de característica de su elección.",
  },
  {
    name: "Prestidigitación",
    englishName: "Prestidigitation",
    level: 0,
    school: "Transmutación",
    castingTime: "1 acción",
    range: "10 pies",
    components: "V, S",
    duration: "Hasta 1 hora",
    classes: ["Bardo", "Hechicero", "Brujo", "Mago", "Artífice"],
    damageOrEffect: "Efectos sensoriales y trucos menores",
    description:
      "Crea efectos mágicos menores: un sonido tenue, ráfaga de viento, encender/apagar una vela, calentar o enfriar hasta 1 libra de material, limpiar o ensuciar un objeto, o cambiar su color/sabor.",
  },
  {
    name: "Ráfaga de Fuego",
    englishName: "Fire Bolt",
    level: 0,
    school: "Evocación",
    castingTime: "1 acción",
    range: "120 pies",
    components: "V, S",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago", "Artífice"],
    damageOrEffect: "1d10 fuego (aumenta a niveles 5, 11, 17)",
    description:
      "Lanzas una mota de fuego hacia una criatura u objeto. Haz un ataque de conjuro a distancia. Si impacta, el objetivo sufre 1d10 puntos de daño de fuego. Prende objetos inflamables que no se lleven puestos.",
  },
  {
    name: "Rayo de Escarcha",
    englishName: "Ray of Frost",
    level: 0,
    school: "Evocación",
    castingTime: "1 acción",
    range: "60 pies",
    components: "V, S",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago", "Artífice"],
    damageOrEffect: "1d8 frío y reduce velocidad 10 pies",
    description:
      "Un gélido rayo azul impacta contra una criatura. Ataque de conjuro a distancia. Con éxito inflige 1d8 de daño por frío y su velocidad se reduce en 10 pies hasta el inicio de tu siguiente turno.",
  },
  {
    name: "Llama Sagrada",
    englishName: "Sacred Flame",
    level: 0,
    school: "Evocación",
    castingTime: "1 acción",
    range: "60 pies",
    components: "V, S",
    duration: "Instantáneo",
    classes: ["Clérigo"],
    damageOrEffect: "1d8 radiante (Salvación DES niega)",
    description:
      "Un resplandor flamígero desciende sobre una criatura. Debe superar una salvación de Destreza o sufrir 1d8 de daño radiante. El objetivo no obtiene beneficio de cobertura para esta tirada.",
  },
  {
    name: "Descarga Eldritch / Agonía Mística",
    englishName: "Eldritch Blast",
    level: 0,
    school: "Evocación",
    castingTime: "1 acción",
    range: "120 pies",
    components: "V, S",
    duration: "Instantáneo",
    classes: ["Brujo"],
    damageOrEffect: "1d10 fuerza (rayos múltiples a niveles altos)",
    description:
      "Un rayo de energía crepitante se proyecta hacia una criatura dentro del alcance. Haz un ataque de conjuro a distancia. Con éxito, el objetivo sufre 1d10 de daño de fuerza.",
  },
  {
    name: "Mano de Mago",
    englishName: "Mage Hand",
    level: 0,
    school: "Conjuración",
    castingTime: "1 acción",
    range: "30 pies",
    components: "V, S",
    duration: "1 minuto",
    classes: ["Bardo", "Hechicero", "Brujo", "Mago", "Artífice"],
    damageOrEffect: "Manipulación espectral hasta 10 lbs",
    description:
      "Aparece una mano espectral flotante en un punto elegido. Puedes usarla para manipular objetos, abrir puertas sin trabar, coger objetos de recipientes o verter una poción. No puede atacar ni activar objetos mágicos.",
  },
  {
    name: "Ilusión Menor",
    englishName: "Minor Illusion",
    level: 0,
    school: "Ilusión",
    castingTime: "1 acción",
    range: "30 pies",
    components: "S, M (un vellón de lana)",
    duration: "1 minuto",
    classes: ["Bardo", "Hechicero", "Brujo", "Mago"],
    damageOrEffect: "Sonido o imagen estática en un cubo de 5 pies",
    description:
      "Creas un sonido (susurro, rugido, tambor) o una imagen de un objeto (no criatura) que cabe en un cubo de 5 pies. Las criaturas pueden discernir la ilusión superando una prueba de Investigación contra tu CD de conjuros.",
  },
  {
    name: "Toque Helado / Toque de Muerte",
    englishName: "Chill Touch",
    level: 0,
    school: "Nigromancia",
    castingTime: "1 acción",
    range: "120 pies",
    components: "V, S",
    duration: "1 asalto",
    classes: ["Hechicero", "Brujo", "Mago"],
    damageOrEffect: "1d8 necrótico e impide curación",
    description:
      "Creas una mano esquelética fantasmal en el espacio de la criatura. Ataque de conjuro a distancia. Si impacta, causa 1d8 daño necrótico y no puede recuperar puntos de golpe hasta el inicio de tu próximo turno.",
  },
  {
    name: "Luz",
    englishName: "Light",
    level: 0,
    school: "Evocación",
    castingTime: "1 acción",
    range: "Toque",
    components: "V, M (una luciérnaga o musgo fosforescente)",
    duration: "1 hora",
    classes: ["Bardo", "Clérigo", "Hechicero", "Mago", "Artífice"],
    damageOrEffect: "Luz brillante 20 pies + tenue 20 pies",
    description:
      "Tocas un objeto de no más de 10 pies en cualquier dimensión. El objeto emite luz brillante en un radio de 20 pies y luz tenue durante 20 pies adicionales del color que desees.",
  },
  {
    name: "Shillelagh / Garrote Mágico",
    englishName: "Shillelagh",
    level: 0,
    school: "Transmutación",
    castingTime: "1 acción adicional",
    range: "Toque",
    components: "V, S, M (muérdago y trébol)",
    duration: "1 minuto",
    classes: ["Druida"],
    damageOrEffect: "Arma mágica 1d8 con Sabiduría",
    description:
      "La madera de un garrote o bastón que sostienes se imbuye con el poder de la naturaleza. Puedes usar tu modificador de Sabiduría en lugar de Fuerza para tiradas de ataque y daño, y el dado de daño del arma se convierte en un d8 contundente mágico.",
  },
  {
    name: "Burla Cruel",
    englishName: "Vicious Mockery",
    level: 0,
    school: "Encantamiento",
    castingTime: "1 acción",
    range: "60 pies",
    components: "V",
    duration: "Instantáneo",
    classes: ["Bardo"],
    damageOrEffect: "1d4 psíquico y desventaja en próx. ataque",
    description:
      "Desatas una retahíla de insultos con sutiles encantamientos. Si el objetivo puede oírte (no necesita entenderte), debe superar una salvación de Sabiduría o sufrir 1d4 daño psíquico y tener desventaja en su próxima tirada de ataque antes del final de su siguiente turno.",
  },

  // NIVEL 1
  {
    name: "Escudo",
    englishName: "Shield",
    level: 1,
    school: "Abjuración",
    castingTime:
      "1 reacción (al ser impactado por un ataque o proyectil mágico)",
    range: "Personal",
    components: "V, S",
    duration: "1 asalto",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "+5 a la CA y anula Proyectil Mágico",
    description:
      "Una barrera invisible de fuerza mágica aparece y te protege. Hasta el comienzo de tu siguiente turno, obtienes un bonificador de +5 a la CA, incluido contra el ataque desencadenante, y no sufres daño de Proyectil Mágico.",
  },
  {
    name: "Proyectil Mágico",
    englishName: "Magic Missile",
    level: 1,
    school: "Evocación",
    castingTime: "1 acción",
    range: "120 pies",
    components: "V, S",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "3 dardos de 1d4+1 de fuerza (impacto automático)",
    description:
      "Creas tres dardos brillantes de fuerza mágica. Cada dardo impacta automáticamente a una criatura que puedas ver dentro del alcance y le inflige 1d4 + 1 puntos de daño de fuerza. Los dardos pueden dirigirse a un mismo objetivo o a varios.",
  },
  {
    name: "Curar Heridas",
    englishName: "Cure Wounds",
    level: 1,
    school: "Evocación",
    castingTime: "1 acción",
    range: "Toque",
    components: "V, S",
    duration: "Instantáneo",
    classes: [
      "Bardo",
      "Clérigo",
      "Druida",
      "Paladín",
      "Explorador",
      "Artífice",
    ],
    damageOrEffect: "Cura 1d8 + modificador de aptitud mágica",
    description:
      "Una criatura que tocas recupera una cantidad de puntos de golpe igual a 1d8 + tu modificador de aptitud mágica. No afecta a muertos vivientes ni a autómatas.",
  },
  {
    name: "Palabra de Curación",
    englishName: "Healing Word",
    level: 1,
    school: "Evocación",
    castingTime: "1 acción adicional",
    range: "60 pies",
    components: "V",
    duration: "Instantáneo",
    classes: ["Bardo", "Clérigo", "Druida"],
    damageOrEffect: "Cura 1d4 + modificador de aptitud mágica a distancia",
    description:
      "Pronuncias una palabra susurrante de alivio. Una criatura a tu elección que puedas ver dentro del alcance recupera puntos de golpe iguales a 1d4 + tu modificador de aptitud mágica.",
  },
  {
    name: "Armadura de Mago",
    englishName: "Mage Armor",
    level: 1,
    school: "Abjuración",
    castingTime: "1 acción",
    range: "Toque",
    components: "V, S, M (un trozo de cuero curado)",
    duration: "8 horas",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "CA base se convierte en 13 + modificador de Destreza",
    description:
      "Tocas a una criatura voluntaria que no lleve armadura. Una fuerza mágica protectora la envuelve hasta que el conjuro termine. Su CA base se convierte en 13 + su modificador de Destreza.",
  },
  {
    name: "Manos Ardientes",
    englishName: "Burning Hands",
    level: 1,
    school: "Evocación",
    castingTime: "1 acción",
    range: "Personal (cono de 15 pies)",
    components: "V, S",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "3d6 fuego en cono de 15 pies (DES mitad)",
    description:
      "Juntas tus pulgares y extiendes los dedos, desatando una lámina de llamas en un cono de 15 pies. Cada criatura en el cono debe superar una salvación de Destreza o sufrir 3d6 de daño por fuego (mitad con éxito).",
  },
  {
    name: "Encontrar Familiar",
    englishName: "Find Familiar",
    level: 1,
    school: "Conjuración",
    castingTime: "1 hora (o Ritual)",
    range: "10 pies",
    components:
      "V, S, M (10 po de carbón, incienso y hierbas consumidas en un brasero)",
    duration: "Instantáneo",
    classes: ["Mago"],
    isRitual: true,
    damageOrEffect: "Convoca un espíritu en forma animal leal",
    description:
      "Obtienes los servicios de un familiar, un espíritu que adopta una forma animal a tu elección: murciélago, gato, cangrejo, sapo, halcón, lagarto, pulpo, lechuza, serpiente venenosa, pez, rata, cuervo, caballito de mar, araña o comadreja. El familiar actúa independientemente pero obedece siempre tus órdenes. Puedes comunicarte telepáticamente con él y ver/oír a través de sus sentidos.",
  },
  {
    name: "Detectar Magia",
    englishName: "Detect Magic",
    level: 1,
    school: "Adivinación",
    castingTime: "1 acción (o Ritual)",
    range: "Personal",
    components: "V, S",
    duration: "10 minutos (Concentración)",
    classes: [
      "Bardo",
      "Clérigo",
      "Druida",
      "Paladín",
      "Explorador",
      "Hechicero",
      "Mago",
      "Artífice",
    ],
    isRitual: true,
    damageOrEffect: "Percibe auras mágicas a 30 pies y su escuela",
    description:
      "Durante la duración, sientes la presencia de magia a 30 pies de ti. Si detectas magia de esta forma, puedes usar tu acción para ver un aura tenue alrededor de cualquier criatura u objeto visible que albergue magia y conocer su escuela.",
  },
  {
    name: "Paso Brumoso",
    englishName: "Misty Step",
    level: 2,
    school: "Conjuración",
    castingTime: "1 acción adicional",
    range: "Personal",
    components: "V",
    duration: "Instantáneo",
    classes: ["Hechicero", "Brujo", "Mago"],
    damageOrEffect: "Teletransporte 30 pies a un espacio visible",
    description:
      "Rodeado brevemente por una neblina plateada, te teletransportas hasta 30 pies a un espacio desocupado que puedas ver.",
  },
  {
    name: "Rayo Abrasador",
    englishName: "Scorching Ray",
    level: 2,
    school: "Evocación",
    castingTime: "1 acción",
    range: "120 pies",
    components: "V, S",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "3 rayos de 2d6 daño de fuego cada uno",
    description:
      "Creas tres rayos de fuego y los arrojas a objetivos dentro del alcance. Haz un ataque de conjuro a distancia por cada rayo. Cada impacto inflige 2d6 de daño por fuego.",
  },
  {
    name: "Invisibilidad",
    englishName: "Invisibility",
    level: 2,
    school: "Ilusión",
    castingTime: "1 acción",
    range: "Toque",
    components: "V, S, M (una pestaña dentro de una goma arábiga)",
    duration: "1 hora (Concentración)",
    classes: ["Bardo", "Hechicero", "Brujo", "Mago", "Artífice"],
    damageOrEffect: "Criatura invisible hasta que ataque o lance conjuro",
    description:
      "Una criatura que tocas se vuelve invisible hasta que el conjuro termine. Todo lo que lleve o vista también es invisible. El conjuro termina prematuramente si el objetivo ataca o lanza un conjuro.",
  },
  {
    name: "Restauración Menor",
    englishName: "Lesser Restoration",
    level: 2,
    school: "Abjuración",
    castingTime: "1 acción",
    range: "Toque",
    components: "V, S",
    duration: "Instantáneo",
    classes: [
      "Bardo",
      "Clérigo",
      "Druida",
      "Paladín",
      "Explorador",
      "Artífice",
    ],
    damageOrEffect: "Elimina ceguera, sordera, parálisis o envenenamiento",
    description:
      "Tocas a una criatura y puedes terminar con una enfermedad o una condición que la aflija: cegado, ensordecido, paralizado o envenenado.",
  },
  {
    name: "Bola de Fuego",
    englishName: "Fireball",
    level: 3,
    school: "Evocación",
    castingTime: "1 acción",
    range: "150 pies",
    components: "V, S, M (una bolita de guano de murciélago y azufre)",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "8d6 daño de fuego en esfera de 20 pies (DES mitad)",
    description:
      "Un brillante haz de luz sale de tu dedo hacia un punto que elijas y luego estalla en un rugido de llamas. Cada criatura en una esfera de 20 pies de radio debe hacer una salvación de Destreza. Sufre 8d6 de daño de fuego si falla, o la mitad si tiene éxito.",
  },
  {
    name: "Contrahechizo",
    englishName: "Counterspell",
    level: 3,
    school: "Abjuración",
    castingTime:
      "1 reacción (cuando ves a una criatura a 60 pies lanzando un conjuro)",
    range: "60 pies",
    components: "S",
    duration: "Instantáneo",
    classes: ["Hechicero", "Brujo", "Mago"],
    damageOrEffect:
      "Interrumpe conjuro de nivel 3 o menor (o prueba de característica)",
    description:
      "Intentas interrumpir a una criatura en el proceso de lanzar un conjuro. Si la criatura está lanzando un conjuro de nivel 3 o inferior, su conjuro falla y no tiene efecto. Si es de nivel 4 o superior, haz una prueba con tu característica de lanzamiento (CD 10 + nivel del conjuro).",
  },
  {
    name: "Espíritus Guardianes",
    englishName: "Spirit Guardians",
    level: 3,
    school: "Conjuración",
    castingTime: "1 acción",
    range: "Personal (radio de 15 pies)",
    components: "V, S, M (un símbolo sagrado)",
    duration: "10 minutos (Concentración)",
    classes: ["Clérigo"],
    damageOrEffect:
      "3d8 radiante o necrótico en área y reduce velocidad a la mitad",
    description:
      "Invocas espíritus protectores que vuelan a tu alrededor a 15 pies. Las criaturas hostiles reducen su velocidad a la mitad en el área y sufren 3d8 de daño radiante (o necrótico si eres maligno) cuando entran al área por primera vez en un turno o inician su turno en ella (salvación SAB mitad).",
  },
  {
    name: "Vuelo",
    englishName: "Fly",
    level: 3,
    school: "Transmutación",
    castingTime: "1 acción",
    range: "Toque",
    components: "V, S, M (una pluma de ala de cualquier pájaro)",
    duration: "10 minutos (Concentración)",
    classes: ["Hechicero", "Brujo", "Mago", "Artífice"],
    damageOrEffect: "Otorga velocidad de vuelo de 60 pies",
    description:
      "Tocas a una criatura voluntaria. El objetivo obtiene una velocidad de vuelo de 60 pies durante la duración.",
  },
  {
    name: "Revivir / Reanimar",
    englishName: "Revivify",
    level: 3,
    school: "Nigromancia",
    castingTime: "1 acción",
    range: "Toque",
    components: "V, S, M (diamantes por valor de 300 po consumidos)",
    duration: "Instantáneo",
    classes: ["Clérigo", "Paladín", "Artífice"],
    damageOrEffect: "Devuelve la vida a quien murió hace menos de 1 minuto",
    description:
      "Tocas a una criatura que haya muerto en el último minuto. Esa criatura regresa a la vida con 1 punto de golpe. Este conjuro no puede devolver a la vida a criaturas muertas de vejez ni restaurar extremidades perdidas.",
  },
  {
    name: "Metamorfosis",
    englishName: "Polymorph",
    level: 4,
    school: "Transmutación",
    castingTime: "1 acción",
    range: "60 pies",
    components: "V, S, M (una crisálida de oruga)",
    duration: "1 hora (Concentración)",
    classes: ["Bardo", "Druida", "Hechicero", "Mago"],
    damageOrEffect: "Transforma criatura en bestia de VD igual o menor",
    description:
      "Transformas a una criatura en una nueva forma de bestia. La nueva forma puede ser cualquier bestia cuyo valor de desafío sea igual o menor al nivel o VD del objetivo. Asume los PG y estadísticas de la bestia.",
  },
  {
    name: "Puerta Dimensional",
    englishName: "Dimension Door",
    level: 4,
    school: "Conjuración",
    castingTime: "1 acción",
    range: "500 pies",
    components: "V",
    duration: "Instantáneo",
    classes: ["Bardo", "Brujo", "Hechicero", "Mago"],
    damageOrEffect: "Teletransporte hasta 500 pies con un acompañante",
    description:
      "Te teletransportas instantáneamente a cualquier ubicación dentro del alcance a la que puedas ver o visualizar mentalmente. Puedes llevar contigo hasta una criatura voluntaria de tu tamaño o menor.",
  },
  {
    name: "Cono de Frío",
    englishName: "Cone of Cold",
    level: 5,
    school: "Evocación",
    castingTime: "1 acción",
    range: "Personal (cono de 60 pies)",
    components: "V, S, M (un cono de cristal o vidrio)",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "8d8 daño de frío en cono de 60 pies (CON mitad)",
    description:
      "Una ráfaga de viento gélido surge de tus manos. Cada criatura en un cono de 60 pies debe hacer una salvación de Constitución. Sufre 8d8 de daño por frío si falla, o la mitad si tiene éxito. Las criaturas asesinadas quedan congeladas como estatuas.",
  },
  {
    name: "Desintegrar",
    englishName: "Disintegrate",
    level: 6,
    school: "Transmutación",
    castingTime: "1 acción",
    range: "60 pies",
    components: "V, S, M (un cuenco de piedra pómez y un pellizco de polvo)",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "10d6 + 40 daño de fuerza (pulveriza si reduce a 0 PG)",
    description:
      "Un fino rayo verde brota de tu dedo. El objetivo debe superar una salvación de Destreza o sufrir 10d6 + 40 de daño de fuerza. Si este daño reduce a la criatura a 0 PG, queda pulverizada en un montón de ceniza fina.",
  },
  {
    name: "Deseo",
    englishName: "Wish",
    level: 9,
    school: "Conjuración",
    castingTime: "1 acción",
    range: "Personal",
    components: "V",
    duration: "Instantáneo",
    classes: ["Hechicero", "Mago"],
    damageOrEffect: "El conjuro mortal más poderoso; altera la realidad",
    description:
      "Deseo es el conjuro más poderoso que una criatura mortal puede lanzar. Su uso básico duplica el efecto de cualquier otro conjuro de nivel 8 o menor sin requerir componentes, o permite alterar los cimientos mismos de la realidad.",
  },
];

// ---------------------------------------------------------------- COMPENDIO DE CLASES D&D 5E
export const DND_CLASSES_COMPENDIUM: CompendiumClass[] = [
  {
    name: "Bárbaro",
    hitDice: "1d12",
    primaryAbility: "str",
    savingThrows: ["FUE", "CON"],
    armorProficiencies: "Armaduras ligeras, medias, escudos",
    weaponProficiencies: "Armas simples y marciales",
    skillChoices: [
      "Atletismo",
      "Intimidación",
      "Naturaleza",
      "Percepción",
      "Supervivencia",
      "Trato con Animales",
    ],
    description:
      "Un guerrero feroz de origen salvaje que entra en un estado de furia destructiva en batalla.",
    iconicTraits: [
      {
        name: "Furia",
        level: 1,
        description:
          "En combate, puedes entrar en furia como acción adicional. Obtienes ventaja en pruebas y salvaciones de Fuerza, +2 de daño cuerpo a cuerpo con Fuerza, y resistencia al daño contundente, perforante y cortante.",
        uses: { max: 2, current: 2, recovery: "long_rest" },
      },
      {
        name: "Defensa sin Armadura (Bárbaro)",
        level: 1,
        description:
          "Mientras no lleves puesta ninguna armadura, tu Clase de Armadura es igual a 10 + tu modificador de Destreza + tu modificador de Constitución. Puedes usar escudo y conservar este beneficio.",
      },
      {
        name: "Ataque Temerario",
        level: 2,
        description:
          "Puedes renunciar a toda cautela para atacar con ferocidad. Al hacer tu primer ataque en tu turno, obtienes ventaja en tiradas de ataque cuerpo a cuerpo con Fuerza, pero los ataques contra ti tienen ventaja hasta tu siguiente turno.",
      },
    ],
  },
  {
    name: "Bardo",
    hitDice: "1d8",
    primaryAbility: "cha",
    savingThrows: ["DES", "CAR"],
    armorProficiencies: "Armaduras ligeras",
    weaponProficiencies:
      "Armas simples, ballesta de mano, espada corta, espada larga, estoque",
    skillChoices: ["Cualquiera 3 habilidades"],
    spellcastingAbility: "cha",
    spellcastingName: "Carisma",
    description:
      "Un mago versátil cuya música, oratoria y magia tejen la realidad y alientan a sus aliados.",
    iconicTraits: [
      {
        name: "Inspiración de Bardo",
        level: 1,
        description:
          "Puedes inspirar a otros mediante palabras o música. Como acción adicional, eliges a una criatura a 60 pies. Obtiene un dado de Inspiración (1d6) que puede sumar a una tirada de ataque, prueba de característica o salvación en los próximos 10 minutos.",
        uses: { max: 3, current: 3, recovery: "long_rest" },
      },
      {
        name: "Lanzamiento de Conjuros (Bardo)",
        level: 1,
        description:
          "Puedes lanzar conjuros de la lista de bardo usando Carisma como aptitud mágica. CD de salvación = 8 + bono de competencia + mod. Carisma.",
      },
      {
        name: "Aprendiz de Mucho (Jack of All Trades)",
        level: 2,
        description:
          "Sumas la mitad de tu bonificador de competencia (redondeado hacia abajo) a cualquier prueba de característica que hagas que no incluya ya tu bono de competencia.",
      },
    ],
  },
  {
    name: "Clérigo",
    hitDice: "1d8",
    primaryAbility: "wis",
    savingThrows: ["SAB", "CAR"],
    armorProficiencies:
      "Armaduras ligeras, medias, escudos (y pesadas según dominio)",
    weaponProficiencies: "Armas simples",
    skillChoices: [
      "Historia",
      "Intuición",
      "Medicina",
      "Persuasión",
      "Religión",
    ],
    spellcastingAbility: "wis",
    spellcastingName: "Sabiduría",
    description:
      "Un campeón sacerdotal que canaliza el poder divino de su deidad para sanar, proteger y castigar.",
    iconicTraits: [
      {
        name: "Lanzamiento de Conjuros Divinos",
        level: 1,
        description:
          "Preparas conjuros diarios de la lista de clérigo. Tu característica de conjuros es Sabiduría. CD = 8 + comp. + mod. Sabiduría.",
      },
      {
        name: "Canalizar Divinidad: Expulsar Muertos Vivientes",
        level: 2,
        description:
          "Como acción, muestras tu símbolo sagrado. Cada muerto viviente a 30 pies que pueda verte u oírte debe hacer una salvación de Sabiduría o quedar expulsado durante 1 minuto o hasta recibir daño.",
        uses: { max: 1, current: 1, recovery: "short_rest" },
      },
    ],
  },
  {
    name: "Druida",
    hitDice: "1d8",
    primaryAbility: "wis",
    savingThrows: ["INT", "SAB"],
    armorProficiencies:
      "Armaduras ligeras y medias de material no metálico, escudos de madera",
    weaponProficiencies:
      "Bastones, cimitarras, dagas, dardos, hondas, hoces, jabalinas, lanzas, mazas",
    skillChoices: [
      "Arcanos",
      "Intuición",
      "Medicina",
      "Naturaleza",
      "Percepción",
      "Religión",
      "Supervivencia",
      "Trato con Animales",
    ],
    spellcastingAbility: "wis",
    spellcastingName: "Sabiduría",
    description:
      "Un sacerdote de la naturaleza ancestral que adopta formas de bestias salvajes y controla los elementos.",
    iconicTraits: [
      {
        name: "Druídico",
        level: 1,
        description:
          "Conoces el idioma secreto de los druidas. Puedes hablarlo y dejar mensajes ocultos que solo otros druidas pueden descifrar.",
      },
      {
        name: "Forma Salvaje",
        level: 2,
        description:
          "Como acción, puedes transformarte mágicamente en una bestia que hayas visto antes. Asumes los puntos de golpe, atributos físicos y sentidos de la bestia manteniendo tu mente, alineamiento e intelecto.",
        uses: { max: 2, current: 2, recovery: "short_rest" },
      },
    ],
  },
  {
    name: "Guerrero",
    hitDice: "1d10",
    primaryAbility: "str",
    savingThrows: ["FUE", "CON"],
    armorProficiencies:
      "Todas las armaduras (ligeras, medias, pesadas) y escudos",
    weaponProficiencies: "Armas simples y marciales",
    skillChoices: [
      "Acrobacias",
      "Atletismo",
      "Historia",
      "Intimidación",
      "Intuición",
      "Percepción",
      "Supervivencia",
      "Trato con Animales",
    ],
    description:
      "Un maestro del combate marcial, perito en el uso de todo tipo de armaduras y armas.",
    iconicTraits: [
      {
        name: "Estilo de Combate",
        level: 1,
        description:
          "Adoptas un estilo marcial particular: Arquero (+2 a distancia), Defensa (+1 CA), Duelo (+2 daño a una mano), o Armas Grandes (repetir 1 y 2 en daño).",
      },
      {
        name: "Segundo Aliento (Second Wind)",
        level: 1,
        description:
          "Tienes una reserva limitada de energía a la que recurrir. En tu turno, puedes usar una acción adicional para recuperar puntos de golpe iguales a 1d10 + tu nivel de guerrero.",
        uses: { max: 1, current: 1, recovery: "short_rest" },
      },
      {
        name: "Oleada de Acción (Action Surge)",
        level: 2,
        description:
          "Puedes exigirte a ti mismo más allá de tus límites normales. En tu turno, puedes realizar una acción adicional además de tu acción normal y una posible acción adicional.",
        uses: { max: 1, current: 1, recovery: "short_rest" },
      },
    ],
  },
  {
    name: "Monje",
    hitDice: "1d8",
    primaryAbility: "dex",
    savingThrows: ["FUE", "DES"],
    armorProficiencies: "Ninguna",
    weaponProficiencies: "Armas simples, espadas cortas",
    skillChoices: [
      "Acrobacias",
      "Atletismo",
      "Historia",
      "Intuición",
      "Religión",
      "Sigilo",
    ],
    description:
      "Un maestro de las artes marciales que canaliza la energía espiritual del Ki en su propio cuerpo.",
    iconicTraits: [
      {
        name: "Defensa sin Armadura (Monje)",
        level: 1,
        description:
          "Mientras no lleves armadura ni empuñes un escudo, tu CA es igual a 10 + tu modificador de Destreza + tu modificador de Sabiduría.",
      },
      {
        name: "Artes Marciales",
        level: 1,
        description:
          "Tus ataques desarmados y con armas de monje pueden usar Destreza en lugar de Fuerza, usan un d4 de daño y te permiten dar un golpe desarmado como acción adicional tras atacar.",
      },
      {
        name: "Ki",
        level: 2,
        description:
          "Accedes a la energía mística del Ki. Puedes gastar puntos de Ki para realizar Ráfaga de Golpes (2 ataques desarmados extra), Defensa Paciente (Esquivar como acción adicional) o Paso del Viento (Destrabarse/Correr como acción adicional).",
        uses: { max: 2, current: 2, recovery: "short_rest" },
      },
    ],
  },
  {
    name: "Paladín",
    hitDice: "1d10",
    primaryAbility: "str",
    savingThrows: ["SAB", "CAR"],
    armorProficiencies: "Todas las armaduras y escudos",
    weaponProficiencies: "Armas simples y marciales",
    skillChoices: [
      "Atletismo",
      "Intimidación",
      "Intuición",
      "Medicina",
      "Persuasión",
      "Religión",
    ],
    spellcastingAbility: "cha",
    spellcastingName: "Carisma",
    description:
      "Un guerrero sagrado vinculado por un juramento inquebrantable de honor, justicia y rectitud.",
    iconicTraits: [
      {
        name: "Sentido Divino",
        level: 1,
        description:
          "Como acción, puedes abrir tu consciencia para detectar celestiales, infernales y muertos vivientes a 60 pies que no estén tras cobertura total.",
        uses: { max: 3, current: 3, recovery: "long_rest" },
      },
      {
        name: "Imposición de Manos",
        level: 1,
        description:
          "Posees una reserva de poder curativo igual a 5 × tu nivel de paladín. Como acción al tocar a una criatura, puedes restaurarle PG o gastar 5 puntos para curar una enfermedad o neutralizar un veneno.",
        uses: { max: 5, current: 5, recovery: "long_rest" },
      },
      {
        name: "Castigo Divino (Divine Smite)",
        level: 2,
        description:
          "Cuando impactas a una criatura con un ataque de arma cuerpo a cuerpo, puedes gastar un espacio de conjuro para infligir 2d8 de daño radiante adicional (+1d8 por cada nivel por encima de 1º, y +1d8 extra contra infernales o muertos vivientes).",
      },
    ],
  },
  {
    name: "Explorador",
    hitDice: "1d10",
    primaryAbility: "dex",
    savingThrows: ["FUE", "DES"],
    armorProficiencies: "Armaduras ligeras, medias, escudos",
    weaponProficiencies: "Armas simples y marciales",
    skillChoices: [
      "Acrobacias",
      "Atletismo",
      "Investigación",
      "Intuición",
      "Naturaleza",
      "Percepción",
      "Sigilo",
      "Supervivencia",
      "Trato con Animales",
    ],
    spellcastingAbility: "wis",
    spellcastingName: "Sabiduría",
    description:
      "Un rastreador y cazador experto en la espesura que defiende las fronteras de la civilización.",
    iconicTraits: [
      {
        name: "Enemigo Predilecto",
        level: 1,
        description:
          "Tienes amplia experiencia estudiando, rastreando y cazando un tipo específico de enemigo. Obtienes ventaja en pruebas de Supervivencia para rastrearlos y en pruebas de Inteligencia para recordar información sobre ellos.",
      },
      {
        name: "Explorador Natural",
        level: 1,
        description:
          "Eres un experto en navegar en un tipo de terreno salvaje. Tu grupo no puede perderse salvo por magia, te mantienes alerta al peligro mientras viajas y encuentras el doble de comida.",
      },
    ],
  },
  {
    name: "Pícaro",
    hitDice: "1d8",
    primaryAbility: "dex",
    savingThrows: ["DES", "INT"],
    armorProficiencies: "Armaduras ligeras",
    weaponProficiencies:
      "Armas simples, ballestas de mano, espadas cortas, estoques, dagas",
    skillChoices: [
      "Acrobacias",
      "Atletismo",
      "Engaño",
      "Interpretación",
      "Intimidación",
      "Intuición",
      "Investigación",
      "Juego de Manos",
      "Percepción",
      "Persuasión",
      "Sigilo",
    ],
    description:
      "Un especialista en el sigilo, la astucia, las trampas y los ataques de precisión letal.",
    iconicTraits: [
      {
        name: "Pericia (Expertise)",
        level: 1,
        description:
          "Elige dos de tus competencias en habilidades (o una habilidad y herramientas de ladrón). Tu bonificador de competencia se duplica para cualquier prueba de característica que las utilice.",
      },
      {
        name: "Ataque Furtivo (Sneak Attack)",
        level: 1,
        description:
          "Una vez por turno, puedes infligir 1d6 de daño extra a una criatura que impactes si tienes ventaja en el ataque con un arma sutil o a distancia, o si un aliado está a 5 pies de ella y no tienes desventaja.",
      },
      {
        name: "Acción Astuta (Cunning Action)",
        level: 2,
        description:
          "Puedes usar una acción adicional en cada uno de tus turnos para realizar las acciones de Correr, Destrabarse o Esconderse.",
      },
    ],
  },
  {
    name: "Hechicero",
    hitDice: "1d6",
    primaryAbility: "cha",
    savingThrows: ["CON", "CAR"],
    armorProficiencies: "Ninguna",
    weaponProficiencies: "Dagas, dardos, hondas, bastones, ballestas ligeras",
    skillChoices: [
      "Arcanos",
      "Engaño",
      "Intuición",
      "Intimidación",
      "Persuasión",
      "Religión",
    ],
    spellcastingAbility: "cha",
    spellcastingName: "Carisma",
    description:
      "Un lanzador de conjuros innato que lleva la magia en su propia sangre y linaje.",
    iconicTraits: [
      {
        name: "Magia Innata",
        level: 1,
        description:
          "Lanzas conjuros basados en tu propio poder interior. Tu característica de conjuros es Carisma. CD = 8 + comp. + mod. Carisma.",
      },
      {
        name: "Puntos de Hechicería y Metamagia",
        level: 2,
        description:
          "Tienes una reserva de puntos de hechicería que puedes usar para crear espacios de conjuro o modificar tus hechizos con Metamagia (Conjuro Acelerado, Distante, Gemelo, Sutil, etc.).",
        uses: { max: 2, current: 2, recovery: "long_rest" },
      },
    ],
  },
  {
    name: "Brujo",
    hitDice: "1d8",
    primaryAbility: "cha",
    savingThrows: ["SAB", "CAR"],
    armorProficiencies: "Armaduras ligeras",
    weaponProficiencies: "Armas simples",
    skillChoices: [
      "Arcanos",
      "Engaño",
      "Historia",
      "Intimidación",
      "Investigación",
      "Naturaleza",
      "Religión",
    ],
    spellcastingAbility: "cha",
    spellcastingName: "Carisma",
    description:
      "Un erudito de lo prohibido que obtiene sus poderes de un pacto con una entidad de otro plano.",
    iconicTraits: [
      {
        name: "Magia de Pacto",
        level: 1,
        description:
          "Tus espacios de conjuro son todos del nivel más alto que puedas lanzar y se recuperan completamente tras un descanso corto o largo.",
      },
      {
        name: "Invocaciones Sobrenaturales",
        level: 2,
        description:
          "Obtienes fragmentos de conocimiento prohibido que te otorgan habilidades mágicas permanentes, como Visión del Diablo (ver en oscuridad mágica) o Descarga Agónica.",
      },
    ],
  },
  {
    name: "Mago",
    hitDice: "1d6",
    primaryAbility: "int",
    savingThrows: ["INT", "SAB"],
    armorProficiencies: "Ninguna",
    weaponProficiencies: "Dagas, dardos, hondas, bastones, ballestas ligeras",
    skillChoices: [
      "Arcanos",
      "Historia",
      "Intuición",
      "Investigación",
      "Medicina",
      "Religión",
    ],
    spellcastingAbility: "int",
    spellcastingName: "Inteligencia",
    description:
      "Un estudioso supremo de las artes arcanas capaz de manipular la estructura misma del cosmos.",
    iconicTraits: [
      {
        name: "Libro de Conjuros y Lanzamiento Ritual",
        level: 1,
        description:
          "Anotas tus conjuros en un grimorio y puedes lanzar cualquier conjuro con la etiqueta ritual de tu libro sin gastar un espacio de conjuro.",
      },
      {
        name: "Recuperación Arcana",
        level: 1,
        description:
          "Una vez al día cuando completas un descanso corto, puedes recuperar espacios de conjuro gastados con un nivel combinado igual o menor a la mitad de tu nivel de mago (redondeado hacia arriba).",
        uses: { max: 1, current: 1, recovery: "long_rest" },
      },
    ],
  },
  {
    name: "Artífice",
    hitDice: "1d8",
    primaryAbility: "int",
    savingThrows: ["CON", "INT"],
    armorProficiencies: "Armaduras ligeras, medias, escudos",
    weaponProficiencies: "Armas simples",
    skillChoices: [
      "Arcanos",
      "Historia",
      "Investigación",
      "Medicina",
      "Naturaleza",
      "Percepción",
      "Juego de Manos",
    ],
    spellcastingAbility: "int",
    spellcastingName: "Inteligencia",
    description:
      "Un inventor magistral que imbuye magia e ingenio en objetos corrientes y autómatas.",
    iconicTraits: [
      {
        name: "Magia de Hojalatero (Magical Tinkering)",
        level: 1,
        description:
          "Puedes imbuir una chispa de magia en un objeto no mágico diminuto para que emita luz, un mensaje grabado, un aroma o un efecto visual estático.",
      },
      {
        name: "Infundir Objetos",
        level: 2,
        description:
          "Adquieres la habilidad de imbuir objetos mundanos con infusiones mágicas, convirtiéndolos en armas mágicas, armaduras reforzadas o réplicas de objetos mágicos.",
      },
    ],
  },
];

// ---------------------------------------------------------------- COMPENDIO DE RAZAS D&D 5E
export const DND_RACES_COMPENDIUM: CompendiumRace[] = [
  {
    name: "Humano",
    speed: "30 pies",
    attributeBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    languages: ["Común", "Un idioma adicional"],
    traits: [
      {
        name: "Versatilidad Humana",
        description:
          "Los humanos son los más adaptables y ambiciosos entre las razas comunes. Obtienen +1 a todas sus puntuaciones de característica.",
      },
    ],
  },
  {
    name: "Alto Elfo",
    speed: "30 pies",
    attributeBonuses: { dex: 2, int: 1 },
    languages: ["Común", "Élfico", "Un idioma adicional"],
    darkvision: "60 pies",
    traits: [
      {
        name: "Visión en la Oscuridad (60 pies)",
        description:
          "Puedes ver en luz tenue a 60 pies como si fuera luz brillante, y en la oscuridad como si fuera luz tenue.",
      },
      {
        name: "Sentidos Agudos",
        description: "Tienes competencia en la habilidad Percepción.",
      },
      {
        name: "Ascendencia Feérica",
        description:
          "Tienes ventaja en tiradas de salvación para evitar ser hechizado, y la magia no puede dormirte.",
      },
      {
        name: "Trance",
        description:
          "Los elfos no necesitan dormir. Meditan profundamente durante 4 horas al día para obtener los mismos beneficios que un humano tras 8 horas de sueño.",
      },
      {
        name: "Truco Adicional de Mago",
        description:
          "Conoces un truco de la lista de conjuros de mago a tu elección, usando Inteligencia como característica.",
      },
    ],
  },
  {
    name: "Elfo de los Bosques",
    speed: "35 pies",
    attributeBonuses: { dex: 2, wis: 1 },
    languages: ["Común", "Élfico"],
    darkvision: "60 pies",
    traits: [
      {
        name: "Pies Ligeros",
        description: "Tu velocidad base al caminar aumenta a 35 pies.",
      },
      {
        name: "Máscara de la Naturaleza",
        description:
          "Puedes intentar esconderte incluso cuando solo estás ligeramente oculto por follaje, lluvia intensa, nieve o niebla.",
      },
      {
        name: "Ascendencia Feérica & Trance",
        description:
          "Inmune al sueño mágico, ventaja contra encantamientos y meditación de 4 horas.",
      },
    ],
  },
  {
    name: "Enano de las Colinas",
    speed: "25 pies",
    attributeBonuses: { con: 2, wis: 1 },
    languages: ["Común", "Enano"],
    darkvision: "60 pies",
    traits: [
      {
        name: "Resistencia Enana",
        description:
          "Tienes ventaja en las tiradas de salvación contra veneno y resistencia al daño de veneno.",
      },
      {
        name: "Dureza Enana",
        description:
          "Tus puntos de golpe máximos aumentan en 1, y aumentan en 1 cada vez que subes de nivel.",
      },
      {
        name: "Afinidad con la Piedra (Stonecunning)",
        description:
          "Siempre que hagas una prueba de Historia relacionada con el origen de trabajos en piedra, sumas el doble de tu bonificador de competencia.",
      },
    ],
  },
  {
    name: "Enano de la Montaña",
    speed: "25 pies",
    attributeBonuses: { con: 2, str: 2 },
    languages: ["Común", "Enano"],
    darkvision: "60 pies",
    traits: [
      {
        name: "Entrenamiento con Armadura Enana",
        description:
          "Tienes competencia con armaduras ligeras y armaduras medias.",
      },
      {
        name: "Resistencia Enana",
        description:
          "Ventaja en salvaciones contra veneno y resistencia al daño de veneno.",
      },
    ],
  },
  {
    name: "Mediano Piesligeros",
    speed: "25 pies",
    attributeBonuses: { dex: 2, cha: 1 },
    languages: ["Común", "Mediano"],
    traits: [
      {
        name: "Afortunado (Lucky)",
        description:
          "Cuando saques un 1 natural en una tirada de ataque, prueba de característica o salvación, puedes volver a tirar el dado y debes usar el nuevo resultado.",
      },
      {
        name: "Valiente",
        description:
          "Tienes ventaja en tiradas de salvación para evitar ser asustado.",
      },
      {
        name: "Agilidad de Mediano",
        description:
          "Puedes moverte a través del espacio de cualquier criatura que sea de un tamaño mayor que el tuyo.",
      },
      {
        name: "Sigilo Nato",
        description:
          "Puedes intentar esconderte incluso cuando solo estás oculto tras una criatura que sea al menos un tamaño mayor que tú.",
      },
    ],
  },
  {
    name: "Tiefling",
    speed: "30 pies",
    attributeBonuses: { cha: 2, int: 1 },
    languages: ["Común", "Infernal"],
    darkvision: "60 pies",
    traits: [
      {
        name: "Resistencia Infernal",
        description: "Tienes resistencia al daño de fuego.",
      },
      {
        name: "Legado Infernal",
        description:
          "Conoces el truco Taumaturgia. A nivel 3 puedes lanzar Reprensión Infernal una vez al día como conjuro de nivel 2. A nivel 5 puedes lanzar Oscuridad una vez al día.",
      },
    ],
  },
  {
    name: "Dracónido",
    speed: "30 pies",
    attributeBonuses: { str: 2, cha: 1 },
    languages: ["Común", "Dracónico"],
    traits: [
      {
        name: "Arma de Aliento Dracónico",
        description:
          "Puedes usar tu acción para exhalar energía destructiva (cono de 15 pies o línea de 30 pies según linaje). Las criaturas en el área sufren 2d6 de daño (fuego, frío, ácido, relámpago o veneno) con salvación a mitad.",
        uses: { max: 1, current: 1, recovery: "short_rest" },
      },
      {
        name: "Resistencia al Daño",
        description:
          "Tienes resistencia al tipo de daño asociado a tu linaje dracónico.",
      },
    ],
  },
  {
    name: "Semiorco",
    speed: "30 pies",
    attributeBonuses: { str: 2, con: 1 },
    languages: ["Común", "Orco"],
    darkvision: "60 pies",
    traits: [
      {
        name: "Aguante Implacable",
        description:
          "Cuando tus puntos de golpe se reducen a 0 pero no mueres directamente, puedes quedarte en 1 punto de golpe en su lugar.",
        uses: { max: 1, current: 1, recovery: "long_rest" },
      },
      {
        name: "Ataques Salvajes",
        description:
          "Cuando logres un golpe crítico con un ataque cuerpo a cuerpo, puedes tirar uno de los dados de daño del arma una vez más y sumarlo al daño extra.",
      },
      {
        name: "Amenazante",
        description: "Tienes competencia en la habilidad Intimidación.",
      },
    ],
  },
  {
    name: "Semielfo",
    speed: "30 pies",
    attributeBonuses: { cha: 2, dex: 1, con: 1 },
    languages: ["Común", "Élfico", "Un idioma adicional"],
    darkvision: "60 pies",
    traits: [
      {
        name: "Ascendencia Feérica",
        description:
          "Tienes ventaja en las salvaciones contra encantamiento y la magia no puede dormirte.",
      },
      {
        name: "Versatilidad con Habilidades",
        description: "Obtienes competencia en dos habilidades a tu elección.",
      },
    ],
  },
  {
    name: "Gnomo de las Rocas",
    speed: "25 pies",
    attributeBonuses: { int: 2, con: 1 },
    languages: ["Común", "Gnomo"],
    darkvision: "60 pies",
    traits: [
      {
        name: "Astucia Gnómica",
        description:
          "Tienes ventaja en todas las tiradas de salvación de Inteligencia, Sabiduría y Carisma contra magia.",
      },
      {
        name: "Conocimiento de Artificiero",
        description:
          "Sumas el doble de tu competencia en Historia sobre objetos mágicos, alquímicos o tecnológicos.",
      },
    ],
  },
  {
    name: "Drow (Elfo Oscuro)",
    subrace: "Elfo Oscuro",
    speed: "30 pies",
    attributeBonuses: { dex: 2, cha: 1 },
    languages: ["Común", "Élfico", "Infracomún (Undercommon)"],
    darkvision: "120 pies",
    traits: [
      {
        name: "Visión en la Oscuridad Superior (120 pies)",
        description:
          "Tu visión en la oscuridad alcanza los 120 pies de radio en penumbra y oscuridad total.",
      },
      {
        name: "Magia Drow",
        description:
          "Conoces el truco Luces Danzantes. A nivel 3 puedes lanzar Fuego Feérico una vez al día. A nivel 5 puedes lanzar Oscuridad una vez al día (Carisma es tu aptitud de conjuro).",
      },
      {
        name: "Entrenamiento con Armas Drow",
        description:
          "Tienes competencia con estoques, espadas cortas y ballestas de mano.",
      },
      {
        name: "Ascendencia Feérica & Trance",
        description:
          "Ventaja en salvaciones para no ser hechizado, inmune al sueño mágico y meditación de 4 horas en vez de dormir.",
      },
      {
        name: "Sensibilidad a la Luz Solar / Adaptación",
        description:
          "Bajo luz solar directa tienes desventaja en tiradas de ataque y Percepción visual (en D&D 2024 / modo solitario heroico esta penalización se modera por aclimatación).",
      },
    ],
  },
];

// ---------------------------------------------------------------- TRASFONDOS D&D 5E & 5.5E (2024 / COSTA DE LA ESPADA)
export const DND_BACKGROUNDS_COMPENDIUM: CompendiumBackground[] = [
  {
    name: "Acólito",
    suggestedSkills: ["Perspicacia", "Religión"],
    languages: "Dos a tu elección",
    featureName: "Refugio de los Fieles",
    featureDescription:
      "Tú y tus compañeros podéis recibir curación y cuidado gratuitos en templos de tu fe, siempre que proporciones los componentes materiales necesarios.",
  },
  {
    name: "Viajero de Tierras Exóticas (Far Traveler)",
    suggestedSkills: ["Perspicacia", "Percepción"],
    languages: "Uno a tu elección",
    toolProficiencies: "Un instrumento musical o juego de mesa exótico",
    featureName: "Todos los Ojos en Ti (Curiosidad Exótica)",
    featureDescription:
      "Tus modales, atuendo y relatos de tierras lejanas despiertan fascinación y cortesía. Nobles, eruditos y posaderos te facilitan audiencias y cobijo solo para escuchar tus historias.",
  },
  {
    name: "Peregrino (Pilgrim)",
    suggestedSkills: ["Religión", "Supervivencia"],
    languages: "Uno a tu elección",
    toolProficiencies: "Herramientas de herboristería o kit de navegante",
    featureName: "Rutas Sagradas y Hospitalidad Piadosa",
    featureDescription:
      "Conoces caminos santos, santuarios ocultos y fuentes benditas. Comunidades de fieles y clérigos devotos te ofrecen hospedaje y bendiciones a cambio de tus plegarias compartidas.",
  },
  {
    name: "Guardián de la Ciudad (City Watch)",
    suggestedSkills: ["Atletismo", "Perspicacia"],
    languages: "Dos a tu elección",
    featureName: "Ojo de la Guardia",
    featureDescription:
      "Sabes reconocer puestos de guardia, cuarteles, pasos de contrabando y puedes solicitar apoyo a alguaciles y patrullas de las ciudades.",
  },
  {
    name: "Cazarrecompensas Urbano (Urban Bounty Hunter)",
    suggestedSkills: ["Engaño", "Sigilo"],
    toolProficiencies: "Herramientas de ladrón o juego de dados/cartas",
    featureName: "Oído en la Calle",
    featureDescription:
      "Cuentas con informantes en tabernas y callejones que te alertan sobre contratos, recompensas y movimientos de fugitivos.",
  },
  {
    name: "Criminal / Espía",
    suggestedSkills: ["Engaño", "Sigilo"],
    toolProficiencies: "Juego de dados o cartas, Herramientas de ladrón",
    featureName: "Contacto Criminal",
    featureDescription:
      "Tienes un contacto de confianza que actúa como enlace con una red de criminales para obtener información, rutas seguras o compradores de bienes ilícitos.",
  },
  {
    name: "Erudito (Sage)",
    suggestedSkills: ["Arcanos", "Historia"],
    languages: "Dos a tu elección",
    featureName: "Investigador",
    featureDescription:
      "Cuando intentas aprender o recordar un dato de lore, si no lo sabes directamente, a menudo sabes dónde y de quién puedes obtener esa información.",
  },
  {
    name: "Héroe del Pueblo",
    suggestedSkills: ["Supervivencia", "Trato con Animales"],
    toolProficiencies:
      "Un tipo de herramientas de artesano, vehículos terrestres",
    featureName: "Hospitalidad Rústica",
    featureDescription:
      "La gente común te protege, te da cobijo y esconde a tu grupo de la ley u otras amenazas.",
  },
  {
    name: "Noble",
    suggestedSkills: ["Historia", "Persuasión"],
    toolProficiencies: "Un juego de mesa",
    languages: "Uno a tu elección",
    featureName: "Posición de Privilegio",
    featureDescription:
      "La gente asume que perteneces a la alta sociedad. Tienes acceso a recepciones aristocráticas y los plebeyos hacen todo lo posible por complacerte.",
  },
  {
    name: "Forastero (Outlander)",
    suggestedSkills: ["Atletismo", "Supervivencia"],
    toolProficiencies: "Un instrumento musical",
    languages: "Uno a tu elección",
    featureName: "Errante",
    featureDescription:
      "Tienes excelente memoria para mapas y geografía. Puedes encontrar comida y agua fresca para ti y hasta cinco personas cada día en terreno salvaje.",
  },
  {
    name: "Soldado",
    suggestedSkills: ["Atletismo", "Intimidación"],
    toolProficiencies: "Un juego de cartas o dados, vehículos terrestres",
    featureName: "Rango Militar",
    featureDescription:
      "Los soldados de tu antigua organización reconocen tu autoridad e influencia. Puedes obtener acceso a campamentos y fortalezas militares.",
  },
  {
    name: "Artesano Gremial (Guild Artisan)",
    suggestedSkills: ["Perspicacia", "Persuasión"],
    toolProficiencies: "Un tipo de herramientas de artesano",
    languages: "Uno a tu elección",
    featureName: "Membresía del Gremio",
    featureDescription:
      "Tu gremio te respalda con alojamiento gratuito, talleres en las principales urbes y protección jurídica gremial.",
  },
  {
    name: "Ermitaño (Hermit)",
    suggestedSkills: ["Medicina", "Religión"],
    toolProficiencies: "Kit de herboristería",
    languages: "Uno a tu elección",
    featureName: "Descubrimiento / Epifanía Secreta",
    featureDescription:
      "En tu largo aislamiento descubriste un secreto único sobre los dioses, la magia arcana o una catástrofe inminente.",
  },
  {
    name: "Charlatán (Charlatan)",
    suggestedSkills: ["Engaño", "Juego de Manos"],
    toolProficiencies: "Kit de disfraz, kit de falsificación",
    featureName: "Segunda Identidad Establecida",
    featureDescription:
      "Posees una identidad alternativa completa con documentos, contactos y disfraces para moverte bajo otra apariencia.",
  },
  {
    name: "Marinero (Sailor)",
    suggestedSkills: ["Atletismo", "Percepción"],
    toolProficiencies: "Herramientas de navegante, vehículos acuáticos",
    featureName: "Pasaje en Barco",
    featureDescription:
      "Puedes conseguir pasaje naval gratuito para ti y tu grupo a cambio de ayudar en las labores de navegación a bordo.",
  },
];

// ---------------------------------------------------------------- DOTES (FEATS) D&D 5E & 5.5E (2024)
export const DND_FEATS_COMPENDIUM: CompendiumFeat[] = [
  {
    name: "Alerta",
    description:
      "+5 a la iniciativa, no puedes ser sorprendido mientras estés consciente y los atacantes ocultos no obtienen ventaja por atacar sin ser vistos.",
  },
  {
    name: "Afortunado (Lucky)",
    description:
      "Tienes 3 puntos de suerte por descanso largo. Puedes gastar un punto para tirar un d20 adicional en cualquier ataque, prueba o salvación que hagas, o contra un ataque que te impacte.",
  },
  {
    name: "Robusto (Tough)",
    description:
      "Tus puntos de golpe máximos aumentan en una cantidad igual a 2 × tu nivel, y aumentan en 2 cada vez que subes de nivel.",
  },
  {
    name: "Iniciado en la Magia (Magic Initiate - Dote de Origen 2024)",
    description:
      "Aprendes dos trucos y un conjuro de nivel 1 de la lista de mago, clérigo o druida. Puedes lanzarlo una vez gratis por descanso largo y con tus espacios de conjuro.",
  },
  {
    name: "Músico / Inspirador (Musician - Dote de Origen 2024)",
    description:
      "Al finalizar un descanso corto o largo, tocas música o pronuncias palabras inspiradoras otorgando Inspiración Heroica a tus compañeros.",
  },
  {
    name: "Matón de Taberna (Tavern Brawler - Dote de Origen 2024)",
    description:
      "Tus ataques desarmados hacen 1d4 + FUE y puedes repetir 1s en daño de daño de armas improvisadas. Al golpear desarmado puedes empujar 5 pies una vez por turno.",
  },
  {
    name: "Curandero (Healer)",
    description:
      "Al usar un estuche de primeros auxilios estabilizas a un moribundo devolviéndole 1 PG. Además puedes gastar un uso para sanar 1d6 + 4 + nivel de PG a una criatura por descanso.",
  },
  {
    name: "Combatiente con Dos Armas",
    description:
      "Obtienes +1 a la CA mientras empuñes dos armas cuerpo a cuerpo. Puedes combatir con dos armas aunque no sean ligeras, y puedes desenfundar o enfundar dos armas a la vez.",
  },
  {
    name: "Conjurador de Guerra (War Caster)",
    description:
      "Ventaja en salvaciones de Constitución para mantener la concentración. Puedes realizar los componentes somáticos con armas o escudo en manos. Puedes lanzar un conjuro como ataque de oportunidad.",
  },
  {
    name: "Maestro en Armas Grandes (Great Weapon Master)",
    description:
      "Cuando logres un crítico o mates a una criatura, puedes hacer un ataque cuerpo a cuerpo como acción adicional. Antes de atacar con arma pesada, puedes sufrir -5 al ataque para ganar +10 al daño.",
  },
  {
    name: "Tirador de Primera (Sharpshooter)",
    description:
      "Atacar a alcance largo no impone desventaja. Tus ataques con armas a distancia ignoran media cobertura y tres cuartos de cobertura. Puedes aceptar -5 al ataque a cambio de +10 al daño.",
  },
  {
    name: "Centinela (Sentinel)",
    description:
      "Cuando impactas con un ataque de oportunidad la velocidad del enemigo pasa a 0. Las criaturas provocan ataque de oportunidad aunque usen Destrabarse. Atacas si dañan a un aliado adyacente.",
  },
  {
    name: "Luchador Móvil (Mobile)",
    description:
      "Tu velocidad aumenta en 10 pies. Esprintar ignora terreno difícil. Al realizar un ataque cuerpo a cuerpo contra una criatura, no provocas ataques de oportunidad de ella ese turno.",
  },
  {
    name: "Observador (Observant)",
    description:
      "+5 a la Percepción e Investigación pasiva. Puedes leer los labios de cualquier criatura si comprendes su idioma y la ves hablar claramente.",
  },
  {
    name: "Resiliente",
    description:
      "Aumenta una puntuación de característica en 1 (hasta un máximo de 20) y obtienes competencia en tiradas de salvación con esa característica.",
  },
];

// ---------------------------------------------------------------- PLANTILLAS DE FAMILIARES Y COMPAÑEROS
export const DND_COMPANIONS_TEMPLATES: CompendiumCompanionTemplate[] = [
  {
    name: "Cuervo Familiar",
    type: "familiar",
    creatureType: "Bestia (Espíritu Familiar)",
    size: "Diminuto",
    ac: 12,
    hp: 2,
    maxHp: 2,
    hitDice: "1d4",
    speed: "10 pies, volar 50 pies",
    attributes: { str: 2, dex: 14, con: 8, int: 2, wis: 12, cha: 6 },
    senses: "Percepción pasiva 13",
    traits: [
      {
        name: "Mimetismo",
        description:
          "El cuervo puede imitar sonidos simples que haya escuchado, como una persona susurrando o el chirrido de una puerta.",
      },
      {
        name: "Conexión Telepática de Familiar",
        description:
          "Mientras el familiar esté a 100 pies de su amo, pueden comunicarse telepáticamente y el amo puede ver/oír a través de sus ojos/oídos.",
      },
    ],
    actions: [
      {
        name: "Pico",
        type: "attack",
        description:
          "+4 al ataque, alcance 5 pies. Impacto: 1 daño perforante.",
        damageOrEffect: "1 perforante",
      },
    ],
  },
  {
    name: "Lechuza Familiar",
    type: "familiar",
    creatureType: "Bestia (Espíritu Familiar)",
    size: "Diminuto",
    ac: 11,
    hp: 2,
    maxHp: 2,
    hitDice: "1d4",
    speed: "5 pies, volar 60 pies",
    attributes: { str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7 },
    senses: "Visión en la oscuridad 120 pies, Percepción pasiva 13",
    traits: [
      {
        name: "Vuelo Sigiloso (Flyby)",
        description:
          "La lechuza no provoca ataques de oportunidad cuando vuela fuera del alcance de un enemigo.",
      },
      {
        name: "Vista y Oído Agudos",
        description:
          "La lechuza tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan de la vista o el oído.",
      },
    ],
    actions: [
      {
        name: "Garras",
        type: "attack",
        description: "+3 al ataque, alcance 5 pies. Impacto: 1 daño cortante.",
        damageOrEffect: "1 cortante",
      },
    ],
  },
  {
    name: "Gato Familiar",
    type: "familiar",
    creatureType: "Bestia (Espíritu Familiar)",
    size: "Diminuto",
    ac: 12,
    hp: 2,
    maxHp: 2,
    hitDice: "1d4",
    speed: "40 pies, trepar 30 pies",
    attributes: { str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7 },
    senses: "Visión en la oscuridad 30 pies, Percepción pasiva 13",
    traits: [
      {
        name: "Olfato y Oído Agudos",
        description:
          "El gato tiene ventaja en pruebas de Sabiduría (Percepción) basadas en el olfato o el oído.",
      },
    ],
    actions: [
      {
        name: "Garras",
        type: "attack",
        description: "+0 al ataque, alcance 5 pies. Impacto: 1 daño cortante.",
        damageOrEffect: "1 cortante",
      },
    ],
  },
  {
    name: "Pseudodragón",
    type: "familiar",
    creatureType: "Dragón Diminuto",
    size: "Diminuto",
    ac: 13,
    hp: 7,
    maxHp: 7,
    hitDice: "2d4+2",
    speed: "15 pies, volar 60 pies",
    attributes: { str: 6, dex: 15, con: 13, int: 10, wis: 12, cha: 10 },
    senses: "Visión en la oscuridad 60 pies, Sentido ciego 10 pies",
    traits: [
      {
        name: "Resistencia Mágica",
        description:
          "El pseudodragón tiene ventaja en tiradas de salvación contra conjuros y otros efectos mágicos.",
      },
      {
        name: "Telepatía Limitada",
        description:
          "Puede comunicarse mágicamente mediante imágenes e ideas con cualquier criatura a 100 pies que entienda un idioma.",
      },
    ],
    actions: [
      {
        name: "Aguijón Venenoso",
        type: "attack",
        description:
          "+4 al ataque, alcance 5 pies. Impacto: 1d4+2 perforante y el objetivo debe superar salvación CON CD 11 o quedar envenenado (si falla por 5 o más, cae inconsciente 1 hora).",
        damageOrEffect: "1d4+2 perforante + veneno",
      },
    ],
  },
  {
    name: "Caballo de Guerra (Montura)",
    type: "mount",
    creatureType: "Bestia Grande",
    size: "Grande",
    ac: 11,
    hp: 19,
    maxHp: 19,
    hitDice: "3d10+3",
    speed: "60 pies",
    attributes: { str: 18, dex: 12, con: 13, int: 2, wis: 12, cha: 7 },
    senses: "Percepción pasiva 11",
    traits: [
      {
        name: "Embestida (Trampling Charge)",
        description:
          "Si el caballo se mueve al menos 20 pies en línea recta hacia una criatura y luego la impacta con sus cascos, el objetivo debe superar una salvación de Fuerza CD 14 o quedar derribado.",
      },
    ],
    actions: [
      {
        name: "Cascos",
        type: "attack",
        description:
          "+6 al ataque, alcance 5 pies. Impacto: 2d6+4 daño contundente.",
        damageOrEffect: "2d6+4 contundente",
      },
    ],
  },
  {
    name: "Lobo / Compañero Animal",
    type: "animal",
    creatureType: "Bestia Mediana",
    size: "Mediano",
    ac: 13,
    hp: 11,
    maxHp: 11,
    hitDice: "2d8+2",
    speed: "40 pies",
    attributes: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    senses: "Visión en la oscuridad 60 pies, Percepción pasiva 13",
    traits: [
      {
        name: "Tácticas de Manada (Pack Tactics)",
        description:
          "El lobo tiene ventaja en las tiradas de ataque contra una criatura si al menos uno de los aliados del lobo está a 5 pies de la criatura y no está incapacitado.",
      },
      {
        name: "Oído y Olfato Agudos",
        description:
          "Ventaja en pruebas de Percepción basadas en el oído o el olfato.",
      },
    ],
    actions: [
      {
        name: "Mordisco",
        type: "attack",
        description:
          "+4 al ataque, alcance 5 pies. Impacto: 2d4+2 daño perforante. Si el objetivo es una criatura, debe superar una salvación de Fuerza CD 11 o ser derribada.",
        damageOrEffect: "2d4+2 perforante + derribo",
      },
    ],
  },
];

export function applyClassTemplate(
  char: PlayerCharacter,
  className: string,
  levelNum: number = 1,
): PlayerCharacter {
  const cls = DND_CLASSES_COMPENDIUM.find(
    (c) => c.name.toLowerCase() === className.toLowerCase(),
  );
  if (!cls) return char;

  const currentTraits = [...(char.traits || [])];
  const newTraits = cls.iconicTraits
    .filter(
      (t) =>
        t.level <= levelNum &&
        !currentTraits.some(
          (ct) => ct.name.toLowerCase() === t.name.toLowerCase(),
        ),
    )
    .map((t) => ({
      name: t.name,
      type: "class" as const,
      source: `${cls.name} Nvl ${t.level}`,
      description: t.description,
      uses: t.uses,
    }));

  const profBonus = Math.floor((levelNum - 1) / 4) + 2;

  return {
    ...char,
    class: cls.name,
    level: `Nivel ${levelNum}`,
    hitDice: `${levelNum}${cls.hitDice}`,
    proficiencyBonus: profBonus,
    savingThrowProficiencies: Array.from(
      new Set([...(char.savingThrowProficiencies || []), ...cls.savingThrows]),
    ),
    proficienciesAndLanguages: char.proficienciesAndLanguages
      ? `${char.proficienciesAndLanguages}\nArmaduras: ${cls.armorProficiencies}. Armas: ${cls.weaponProficiencies}.`
      : `Armaduras: ${cls.armorProficiencies}. Armas: ${cls.weaponProficiencies}.`,
    traits: [...currentTraits, ...newTraits],
  };
}

export function applyRaceTemplate(
  char: PlayerCharacter,
  raceName: string,
): PlayerCharacter {
  const race = DND_RACES_COMPENDIUM.find(
    (r) => r.name.toLowerCase() === raceName.toLowerCase(),
  );
  if (!race) return char;

  const attrs = {
    ...(char.attributes || {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    }),
  };
  if (race.attributeBonuses) {
    (Object.keys(race.attributeBonuses) as (keyof PlayerAttributes)[]).forEach(
      (k) => {
        attrs[k] = (attrs[k] || 10) + (race.attributeBonuses[k] || 0);
      },
    );
  }

  const currentTraits = [...(char.traits || [])];
  const newTraits = race.traits
    .filter(
      (t) =>
        !currentTraits.some(
          (ct) => ct.name.toLowerCase() === t.name.toLowerCase(),
        ),
    )
    .map((t) => ({
      name: t.name,
      type: "race" as const,
      source: race.name,
      description: t.description,
    }));

  const currentLangs = Array.from(
    new Set([...(char.languages || []), ...race.languages]),
  );

  return {
    ...char,
    race: race.name,
    speed: race.speed,
    attributes: attrs,
    languages: currentLangs,
    traits: [...currentTraits, ...newTraits],
  };
}

export function applyBackgroundTemplate(
  char: PlayerCharacter,
  bgName: string,
  append: boolean = false,
): PlayerCharacter {
  const bg = DND_BACKGROUNDS_COMPENDIUM.find(
    (b) => b.name.toLowerCase() === bgName.toLowerCase(),
  );
  if (!bg) return char;

  const currentSkills = Array.from(
    new Set([...(char.skillProficiencies || []), ...bg.suggestedSkills]),
  );
  const currentTraits = [...(char.traits || [])];

  if (
    !currentTraits.some(
      (t) => t.name.toLowerCase() === bg.featureName.toLowerCase(),
    )
  ) {
    currentTraits.push({
      name: bg.featureName,
      type: "background",
      source: `Trasfondo: ${bg.name}`,
      description: bg.featureDescription,
    });
  }

  let finalBg = bg.name;
  if (
    append &&
    char.background &&
    !char.background.toLowerCase().includes(bg.name.toLowerCase())
  ) {
    finalBg = `${char.background} + ${bg.name}`;
  }

  return {
    ...char,
    background: finalBg,
    skillProficiencies: currentSkills,
    traits: currentTraits,
  };
}

export function createCompanionFromTemplate(
  templateName: string,
  customName?: string,
): PlayerCharacter {
  const tmpl =
    DND_COMPANIONS_TEMPLATES.find((t) =>
      t.name.toLowerCase().includes(templateName.toLowerCase()),
    ) || DND_COMPANIONS_TEMPLATES[0];
  const name = customName?.trim() || tmpl.name.split("/")[0].trim();

  return {
    id: "comp_" + Date.now() + "_" + Math.random().toString(36).substring(7),
    characterType: "companion",
    companionType:
      tmpl.type === "mount"
        ? "Montura"
        : tmpl.type === "animal"
          ? "Compañero Animal"
          : "Familiar",
    name,
    race: tmpl.creatureType,
    level: "Criatura",
    hp: tmpl.hp,
    maxHp: tmpl.maxHp,
    ac: tmpl.ac,
    speed: tmpl.speed,
    hitDice: tmpl.hitDice,
    proficiencyBonus: 2,
    attributes: tmpl.attributes,
    traits: tmpl.traits.map((t) => ({
      name: t.name,
      type: "other",
      source: tmpl.name,
      description: t.description,
    })),
    actions: tmpl.actions.map((a) => ({
      name: a.name,
      type: a.type,
      damageOrEffect: a.damageOrEffect,
      description: a.description,
    })),
    notes: `Sentidos: ${tmpl.senses}. Tamaño: ${tmpl.size}.`,
  };
}
