import { NPC } from "../types";

/**
 * Stopwords y partículas en nombres y denominaciones en español y fantasía
 */
const STOPWORDS_NPC = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "d",
  "da",
  "di",
  "du",
  "des",
  "y",
  "e",
  "en",
  "con",
  "por",
  "para",
  "al",
]);

/**
 * Títulos nobiliarios, militares o eclesiásticos que suelen añadirse u omitirse
 */
const TITULOS_HONORIFICOS_NPC = new Set([
  "capitan",
  "capitana",
  "lord",
  "lady",
  "sir",
  "maestro",
  "maestra",
  "general",
  "rey",
  "reina",
  "principe",
  "princesa",
  "archimago",
  "archimaga",
  "mago",
  "maga",
  "padre",
  "madre",
  "hermano",
  "hermana",
  "oficial",
  "sargento",
  "comandante",
  "teniente",
  "duque",
  "duquesa",
  "conde",
  "condesa",
  "marques",
  "marquesa",
  "baron",
  "baronesa",
  "don",
  "dona",
  "fray",
  "sor",
  "gran",
  "sumo",
  "suma",
  "alto",
  "alta",
  "corsario",
  "corsarios",
]);

/**
 * Normaliza un nombre quitando tildes, mayúsculas, comillas, apóstrofes y caracteres no alfanuméricos.
 */
export function normalizarNombreNpc(nombre?: string): string {
  if (!nombre) return "";
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`´"]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae las palabras significativas de un nombre de PNJ (descartando stopwords y artículos).
 */
export function tokensSignificativosNpc(nombre?: string): string[] {
  const norm = normalizarNombreNpc(nombre);
  if (!norm) return [];
  return norm.split(/\s+/).filter((w) => w.length > 1 && !STOPWORDS_NPC.has(w));
}

/**
 * Tokens de raíz pura descartando también títulos honoríficos (ej: "Capitán Jarlaxle" -> ["jarlaxle"]).
 */
export function tokensRaizNpc(nombre?: string): string[] {
  const tokens = tokensSignificativosNpc(nombre);
  const filtrados = tokens.filter((w) => !TITULOS_HONORIFICOS_NPC.has(w));
  return filtrados.length > 0 ? filtrados : tokens;
}

/**
 * Determina si dos nombres o referencias se refieren al mismo PNJ.
 *
 * Casos contemplados:
 * - Exactos ("Jarlaxle" === "Jarlaxle", "Drow" === "drow")
 * - Nombre corto vs Completo ("Jarlaxle" === "Jarlaxle Baenre")
 * - Con o sin título ("Capitán Jarlaxle" === "Jarlaxle Baenre")
 * - Colectivos o facciones ("Corsarios de Bregan D'Aerthe" === "Bregan D'Aerthe")
 * - Alias e identidades descubiertas ("Oficial Corsario" con alias === "Jarlaxle")
 * - Inclusión de prefijo/sufijo ("Jarlaxle" contenido en "Jarlaxle Baenre")
 * - Previene falsos positivos en personas distintas que comparten solo apellido ("Gromph Baenre" !== "Jarlaxle Baenre")
 */
export function coincidenNombresNpc(
  nombreA?: string,
  nombreB?: string,
  extraA?: { alias?: string; trueIdentity?: string },
  extraB?: { alias?: string; trueIdentity?: string },
): boolean {
  if (!nombreA || !nombreB) return false;

  const normA = normalizarNombreNpc(nombreA);
  const normB = normalizarNombreNpc(nombreB);
  if (!normA || !normB) return false;

  // 1. Igualdad exacta tras normalizar
  if (normA === normB) return true;

  // 2. Comprobar alias e identidad verdadera si existen
  if (extraA?.alias && coincidenNombresNpc(extraA.alias, nombreB)) return true;
  if (extraA?.trueIdentity && coincidenNombresNpc(extraA.trueIdentity, nombreB))
    return true;
  if (extraB?.alias && coincidenNombresNpc(nombreA, extraB.alias)) return true;
  if (extraB?.trueIdentity && coincidenNombresNpc(nombreA, extraB.trueIdentity))
    return true;

  // 3. Tokens raíz y significativos
  const raizA = tokensRaizNpc(nombreA);
  const raizB = tokensRaizNpc(nombreB);

  if (raizA.length === 0 || raizB.length === 0) {
    return normA.includes(normB) || normB.includes(normA);
  }

  // 4. Si uno es de una sola palabra raíz (ej: "jarlaxle") y está en la otra ("jarlaxle", "baenre")
  if (raizA.length === 1 && raizB.includes(raizA[0])) return true;
  if (raizB.length === 1 && raizA.includes(raizB[0])) return true;

  // 5. Si ambos tienen múltiples palabras raíces:
  // Si el primer nombre (nombre de pila) es diferente (ej: "Gromph Baenre" vs "Jarlaxle Baenre"),
  // NO coinciden aunque compartan apellido o título.
  if (raizA.length >= 2 && raizB.length >= 2) {
    if (raizA[0] !== raizB[0]) {
      // Nombres de pila distintos: son personajes distintos de la misma casa o grupo
      return false;
    }
  }

  // 6. Intersección de tokens raíz (Dice coefficient)
  const setA = new Set(raizA);
  const setB = new Set(raizB);
  let compartidos = 0;
  setA.forEach((t) => {
    if (setB.has(t)) compartidos++;
  });

  const dice = (2 * compartidos) / (setA.size + setB.size);
  if (dice >= 0.5) return true;

  // 7. Substring directo si el término más corto tiene al menos 4 caracteres y está al inicio o fin
  const minLen = Math.min(normA.length, normB.length);
  if (minLen >= 4) {
    if (
      normA.startsWith(normB) ||
      normB.startsWith(normA) ||
      normA.endsWith(normB) ||
      normB.endsWith(normA)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Busca en la lista de PNJs uno que coincida con el nombre o alias dado.
 */
export function buscarNpcPorNombre(
  npcs: NPC[],
  nombre: string,
  extra?: { alias?: string; trueIdentity?: string },
): NPC | undefined {
  if (!nombre || !npcs || npcs.length === 0) return undefined;
  return npcs.find((n) =>
    coincidenNombresNpc(
      n.name,
      nombre,
      { alias: n.alias, trueIdentity: n.trueIdentity },
      extra,
    ),
  );
}

/**
 * Fusiona dos registros del mismo PNJ conservando el mejor nombre, retrato,
 * descripciones más detalladas, puntuaciones máximas de afinidad y registro de días vistos.
 */
export function fusionarDosNpcs(base: NPC, incoming: Partial<NPC>): NPC {
  // Elegir el nombre más completo o específico (por ejemplo "Jarlaxle Baenre" sobre "Jarlaxle")
  const baseTokens = tokensSignificativosNpc(base.name);
  const incomingTokens = incoming.name
    ? tokensSignificativosNpc(incoming.name)
    : [];
  let bestName = base.name;
  if (incoming.name && incomingTokens.length > baseTokens.length) {
    bestName = incoming.name;
  } else if (!base.name && incoming.name) {
    bestName = incoming.name;
  }

  // Retrato: conservar el que esté asignado (o el entrante si la base no tiene)
  const portrait = base.portrait || incoming.portrait;

  // Relación: preferir la más descriptiva o no genérica
  const esGenerica = (r?: string) =>
    !r || /conocido|neutral|desconocido|figurante/i.test(r);
  let relation = base.relation;
  if (
    incoming.relation &&
    (esGenerica(base.relation) || !esGenerica(incoming.relation))
  ) {
    relation = incoming.relation;
  }

  // Textos descriptivos: preferir los más ricos o combinar
  const pickBestText = (a?: string, b?: string) => {
    if (!a) return b;
    if (!b) return a;
    if (a.includes(b)) return a;
    if (b.includes(a)) return b;
    return a.length >= b.length ? a : b;
  };

  const appearance = pickBestText(base.appearance, incoming.appearance);
  const description = pickBestText(base.description, incoming.description);
  const notes = pickBestText(base.notes, incoming.notes) || "";
  const aparenta = pickBestText(base.aparenta, incoming.aparenta);
  const oculta = pickBestText(base.oculta, incoming.oculta);
  const vinculo = pickBestText(base.vinculo, incoming.vinculo);
  const alias = incoming.alias || base.alias;
  const trueIdentity = incoming.trueIdentity || base.trueIdentity;
  const disguise = incoming.disguise || base.disguise;

  // Afinidad: tomar los valores más avanzados/altos si ambos existen
  const pickMaxAffinity = (v1?: number, v2?: number) => {
    if (v1 !== undefined && v2 !== undefined) return Math.max(v1, v2);
    return v1 !== undefined ? v1 : v2;
  };

  const atr = pickMaxAffinity(base.atr, incoming.atr);
  const vin = pickMaxAffinity(base.vin, incoming.vin);
  const con = pickMaxAffinity(base.con, incoming.con);

  // Registro de días vistos: combinar sin duplicados
  const diasVistos = [
    ...new Set([...(base.diasVistos || []), ...(incoming.diasVistos || [])]),
  ];

  // Último día de subida: combinar
  const ultimoDiaSubida = {
    atr: incoming.ultimoDiaSubida?.atr ?? base.ultimoDiaSubida?.atr,
    vin: incoming.ultimoDiaSubida?.vin ?? base.ultimoDiaSubida?.vin,
    con: incoming.ultimoDiaSubida?.con ?? base.ultimoDiaSubida?.con,
  };

  // Ficha de personaje / estadísticas
  const characterSheet = incoming.characterSheet || base.characterSheet;

  return {
    ...base,
    ...incoming,
    id: base.portrait ? base.id : incoming.id || base.id,
    name: bestName,
    portrait,
    relation: relation || "Conocido",
    status: incoming.status || base.status || "Vivo",
    appearance,
    description,
    notes,
    aparenta,
    oculta,
    vinculo,
    alias,
    trueIdentity,
    disguise,
    atr,
    vin,
    con,
    diasVistos,
    ultimoDiaSubida,
    recurrente: Boolean(
      base.recurrente ||
      incoming.recurrente ||
      diasVistos.length >= 3 ||
      atr !== undefined ||
      vin !== undefined ||
      con !== undefined ||
      vinculo,
    ),
    characterSheet,
  };
}

/**
 * Revisa una lista de PNJs y fusiona cualquier duplicado existente
 * (como "Jarlaxle" y "Jarlaxle Baenre"), devolviendo una lista limpia y sin repeticiones.
 */
export function deduplicarListaNpcs(npcs: NPC[]): NPC[] {
  if (!npcs || npcs.length <= 1) return npcs || [];

  const resultado: NPC[] = [];
  const procesadosIds = new Set<string>();

  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    if (procesadosIds.has(npc.id)) continue;

    let fusionado = { ...npc };
    procesadosIds.add(npc.id);

    // Buscar si hay otros elementos en la lista que coincidan con este PNJ
    for (let j = i + 1; j < npcs.length; j++) {
      const otro = npcs[j];
      if (procesadosIds.has(otro.id)) continue;

      if (
        coincidenNombresNpc(
          fusionado.name,
          otro.name,
          { alias: fusionado.alias, trueIdentity: fusionado.trueIdentity },
          { alias: otro.alias, trueIdentity: otro.trueIdentity },
        )
      ) {
        fusionado = fusionarDosNpcs(fusionado, otro);
        procesadosIds.add(otro.id);
      }
    }

    resultado.push(fusionado);
  }

  return resultado;
}
