import { PlayerCharacter, InventoryItem, PlayerCurrencies } from "../types";

export interface InventoryChangeReport {
  itemsToAdd?: Array<{
    name: string;
    quantity: number;
    category?: InventoryItem["category"];
    description?: string;
    damageOrAc?: string;
    rarity?: string;
    weight?: number;
    equipped?: boolean;
    attuned?: boolean;
    durationMinutes?: number;
    durationNote?: string;
  }>;
  itemsToRemove?: Array<{
    name: string;
    quantity?: number;
  }>;
  currencyDelta?: Partial<PlayerCurrencies>;
}

/**
 * Normaliza nombres para comparación (sin tildes, minúsculas, sin puntuación).
 */
export function normalizeItemName(name: string): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Detecta la categoría aproximada de un objeto según su nombre o notas.
 */
export function inferItemCategory(
  name: string,
  notes: string,
): InventoryItem["category"] {
  const text = `${name} ${notes}`.toLowerCase();
  if (
    /espada|daga|arco|ballesta|hacha|maza|martillo|lanza|vara|bastón|baston|flecha|virote|arma|escudo/i.test(
      text,
    )
  ) {
    if (/escudo/i.test(text)) return "armor";
    return "weapon";
  }
  if (
    /armadura|cota|cuero|placas|malla|jubón|jubon|casco|guantes|grebas|coraza/i.test(
      text,
    )
  ) {
    return "armor";
  }
  if (/poci[oó]n|elixir|bálsamo|balsamo|filtro|vial|ungüento/i.test(text)) {
    return "potion";
  }
  if (/pergamino|rollo|grimorio|tomo|manual|tratado/i.test(text)) {
    return "scroll";
  }
  if (/baya|raci[oó]n|comida|pan|odre|fruta/i.test(text)) {
    return "equipment";
  }
  if (
    /m[aá]scara|anillo|amuleto|capa|botas|varita|orbe|talism[aá]n|reliquia|m[aá]gic/i.test(
      text,
    )
  ) {
    return "magic";
  }
  if (
    /joya|gema|rub[ií]|diamante|zafiro|esmeralda|lingote|cáliz|corona|tesoro/i.test(
      text,
    )
  ) {
    return "treasure";
  }
  return "equipment";
}

/**
 * Parsea la etiqueta [INVENTARIO: ...] o [OBJETOS: ...] o [MONEDAS: ...] del texto del Narrador.
 */
export function parseInventoryTags(text: string): {
  cleaned: string;
  report: InventoryChangeReport | null;
} {
  if (
    !text ||
    (!text.includes("[INVENTARIO:") &&
      !text.includes("[OBJETOS:") &&
      !text.includes("[MONEDAS:"))
  ) {
    return { cleaned: text, report: null };
  }

  const report: InventoryChangeReport = {
    itemsToAdd: [],
    itemsToRemove: [],
    currencyDelta: {},
  };

  let hasChanges = false;

  // Regex para capturar [INVENTARIO:...], [OBJETOS:...] o [MONEDAS:...]
  const TAG_RE = /\[(?:INVENTARIO|OBJETOS|MONEDAS)\s*:([^\]]*)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(text)) !== null) {
    const body = match[1];
    // Partir por comas o punto y coma que no estén dentro de paréntesis
    const parts = body
      .split(/(?!\(.*?\)),/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const part of parts) {
      // 1. Monedas: +50 PO, -20 PO, +100 oro, -5 plata, +10 GP, -2 SP, etc.
      const currMatch = part.match(
        /^([+-])\s*(\d+)\s*(po|pp|pc|pt|pe|gp|sp|cp|ep|pp|oro|plata|cobre|platino|electro)\b/i,
      );
      if (currMatch) {
        const sign = currMatch[1] === "-" ? -1 : 1;
        const amount = parseInt(currMatch[2], 10) * sign;
        const rawUnit = currMatch[3].toLowerCase();
        let key: keyof PlayerCurrencies = "gp";
        if (rawUnit === "po" || rawUnit === "gp" || rawUnit === "oro")
          key = "gp";
        else if (rawUnit === "pp" || rawUnit === "sp" || rawUnit === "plata")
          key = "sp";
        else if (rawUnit === "pc" || rawUnit === "cp" || rawUnit === "cobre")
          key = "cp";
        else if (rawUnit === "pe" || rawUnit === "ep" || rawUnit === "electro")
          key = "ep";
        else if (rawUnit === "pt" || rawUnit === "pp" || rawUnit === "platino")
          key = "pp";

        report.currencyDelta![key] = (report.currencyDelta![key] || 0) + amount;
        hasChanges = true;
        continue;
      }

      // 2. Objetos a añadir: +10 Buenas Bayas (duran 24h) o +1 Máscara de Disfraz o +Espada Larga
      const addMatch = part.match(
        /^\+\s*(?:(\d+)\s*(?:x|de)?\s*)?([^(]+)(?:\(([^)]+)\))?/i,
      );
      if (addMatch) {
        const qty = addMatch[1] ? parseInt(addMatch[1], 10) : 1;
        const rawName = addMatch[2].trim();
        const details = (addMatch[3] || "").trim();

        if (rawName) {
          // Detectar duración temporal (ej: duran 24h, 24 horas, 1 día)
          let durationMinutes: number | undefined;
          let durationNote: string | undefined;
          const durMatch = details.match(
            /(?:duran?|caduca|expira|vida [uú]til)\s*(?:en|de)?\s*(\d+)\s*(h|horas?|d|d[ií]as?|m|min|minutos?)/i,
          );
          if (durMatch) {
            const num = parseInt(durMatch[1], 10);
            const unit = durMatch[2].toLowerCase();
            if (unit.startsWith("h")) durationMinutes = num * 60;
            else if (unit.startsWith("d")) durationMinutes = num * 1440;
            else durationMinutes = num;
            durationNote = durMatch[0];
          } else if (/buenas?\s*bayas?/i.test(rawName)) {
            // Regla oficial D&D 5e: Buenas Bayas caducan en 24 horas
            durationMinutes = 24 * 60;
            durationNote = "Duran 24 horas";
          }

          const isEquipped = /equipado|puesta|vestida|empuñada|empuñado/i.test(
            details,
          );
          const isAttuned = /sintonizad[oa]|attun/i.test(details);
          const isMagic = /m[aá]gic[oa]|artefacto|legendari[oa]/i.test(details);

          report.itemsToAdd!.push({
            name: rawName,
            quantity: qty,
            category: inferItemCategory(rawName, details),
            description: details || undefined,
            equipped: isEquipped,
            attuned: isAttuned,
            rarity: isMagic ? "rare" : "common",
            durationMinutes,
            durationNote,
          });
          hasChanges = true;
          continue;
        }
      }

      // 3. Objetos a quitar / consumir: -3 Buenas Bayas, -1 Poción de Curación, -Máscara de Disfraz
      const removeMatch = part.match(/^-\s*(?:(\d+)\s*(?:x|de)?\s*)?([^(]+)/i);
      if (removeMatch) {
        const qty = removeMatch[1] ? parseInt(removeMatch[1], 10) : 1;
        const rawName = removeMatch[2].trim();
        if (rawName) {
          report.itemsToRemove!.push({
            name: rawName,
            quantity: qty,
          });
          hasChanges = true;
          continue;
        }
      }
    }
  }

  const cleaned = text
    .replace(/\[(?:INVENTARIO|OBJETOS|MONEDAS)\s*:[^\]]*\]/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    cleaned,
    report: hasChanges ? report : null,
  };
}

/**
 * Aplica los cambios de inventario y monedas sobre el protagonista de forma canónica.
 */
export function applyInventoryReport(
  pc: PlayerCharacter,
  report: InventoryChangeReport,
): PlayerCharacter {
  let inventory = [...(pc.inventory || [])];
  const currencies: PlayerCurrencies = {
    cp: pc.currencies?.cp || 0,
    sp: pc.currencies?.sp || 0,
    ep: pc.currencies?.ep || 0,
    gp: pc.currencies?.gp || 0,
    pp: pc.currencies?.pp || 0,
  };

  // 1. Aplicar cambios de monedas
  if (report.currencyDelta) {
    for (const key of ["cp", "sp", "ep", "gp", "pp"] as Array<
      keyof PlayerCurrencies
    >) {
      if (report.currencyDelta[key] !== undefined) {
        currencies[key] = Math.max(
          0,
          (currencies[key] || 0) + report.currencyDelta[key]!,
        );
      }
    }
  }

  // 2. Quitar objetos
  if (report.itemsToRemove && report.itemsToRemove.length > 0) {
    for (const rem of report.itemsToRemove) {
      const normRem = normalizeItemName(rem.name);
      const qtyToRemove = rem.quantity || 1;

      // Buscar coincidencia por nombre normalizado
      const idx = inventory.findIndex((item) => {
        const normItem = normalizeItemName(item.name);
        return (
          normItem === normRem ||
          normItem.includes(normRem) ||
          normRem.includes(normItem)
        );
      });

      if (idx !== -1) {
        const existing = inventory[idx];
        const newQty = (existing.quantity || 1) - qtyToRemove;
        if (newQty <= 0) {
          inventory.splice(idx, 1);
        } else {
          inventory[idx] = {
            ...existing,
            quantity: newQty,
          };
        }
      }
    }
  }

  // 3. Añadir objetos
  if (report.itemsToAdd && report.itemsToAdd.length > 0) {
    for (const add of report.itemsToAdd) {
      const normAdd = normalizeItemName(add.name);

      // Buscar si ya existe para incrementar cantidad
      const existingIdx = inventory.findIndex((item) => {
        const normItem = normalizeItemName(item.name);
        return normItem === normAdd;
      });

      if (existingIdx !== -1) {
        const existing = inventory[existingIdx];
        inventory[existingIdx] = {
          ...existing,
          quantity: (existing.quantity || 1) + add.quantity,
          equipped:
            add.equipped !== undefined ? add.equipped : existing.equipped,
          attuned: add.attuned !== undefined ? add.attuned : existing.attuned,
          expiresInMinutes: add.durationMinutes || existing.expiresInMinutes,
          durationNote: add.durationNote || existing.durationNote,
        };
      } else {
        const newItem: InventoryItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          name: add.name,
          category:
            add.category || inferItemCategory(add.name, add.description || ""),
          quantity: add.quantity,
          weight: add.weight ?? 1,
          equipped: add.equipped || false,
          attuned: add.attuned || false,
          description: add.description || "",
          damageOrAc: add.damageOrAc || "",
          rarity: add.rarity || "common",
          expiresInMinutes: add.durationMinutes,
          durationNote: add.durationNote,
        };
        inventory.push(newItem);
      }
    }
  }

  return {
    ...pc,
    inventory,
    currencies,
  };
}

/**
 * Limpia objetos temporales expirados cuando avanza el tiempo de campaña.
 * (Ejemplo: Buenas Bayas que duran 24h = 1440 min).
 */
export function expireTemporaryItems(
  inventory: InventoryItem[],
  minutesPassed: number,
): { updatedInventory: InventoryItem[]; expiredNames: string[] } {
  if (minutesPassed <= 0 || !inventory.length) {
    return { updatedInventory: inventory, expiredNames: [] };
  }

  const updatedInventory: InventoryItem[] = [];
  const expiredNames: string[] = [];

  for (const item of inventory) {
    // Si tiene expiración explícita
    if (item.expiresInMinutes !== undefined) {
      const remaining = item.expiresInMinutes - minutesPassed;
      if (remaining <= 0) {
        expiredNames.push(item.name);
      } else {
        updatedInventory.push({
          ...item,
          expiresInMinutes: remaining,
        });
      }
      continue;
    }

    // Comprobación de palabras clave como "Buenas Bayas" o "duran 24h"
    const norm = normalizeItemName(item.name);
    const desc = normalizeItemName(item.description || "");
    if (
      (norm.includes("buenas bayas") ||
        norm.includes("buena baya") ||
        desc.includes("24h") ||
        desc.includes("24 horas")) &&
      minutesPassed >= 1440
    ) {
      expiredNames.push(item.name);
      continue;
    }

    updatedInventory.push(item);
  }

  return { updatedInventory, expiredNames };
}
