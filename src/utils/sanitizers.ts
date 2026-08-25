import { PlayerCharacter, Memory } from '../types';

/**
 * Detecta si una cadena de texto es una descripción/nota narrativa en lugar de un nombre propio de personaje.
 */
export function isInvalidCharacterName(name?: string): boolean {
  if (!name || !name.trim()) return true;
  const trimmed = name.trim();

  // Empieza con signos de puntuación como ;, :, -, *, ., ,
  if (/^[;:*\-.,]/.test(trimmed)) return true;

  // Contiene signos de separación de oraciones o punto y coma
  if (trimmed.includes(';') || trimmed.includes('. ') || trimmed.includes('? ') || trimmed.includes('! ')) {
    return true;
  }

  // Si tiene más de 35 caracteres, es con toda probabilidad una nota o frase narrativa
  if (trimmed.length > 35) return true;

  // Patrones y giros narrativos típicos en castellano
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('ella ') ||
    lower.startsWith('él ') ||
    lower.startsWith('el jugador') ||
    lower.startsWith('la jugadora') ||
    lower.startsWith('sabe que') ||
    lower.startsWith('no se ') ||
    lower.startsWith('aquí se ') ||
    lower.includes('en segunda persona') ||
    lower.includes('en comunión') ||
    lower.includes('personaje jugador') ||
    lower.includes('protagonista (') ||
    lower.includes('sincronizar con ia') ||
    lower.includes('acontecimientos') ||
    lower.includes('ficha del')
  ) {
    return true;
  }

  return false;
}

/**
 * Higieniza y limpia la ficha de personaje del OC (Protagonista).
 * Si el nombre contiene texto narrativo largo o notas por error de importación/sincronización,
 * recupera el nombre canónico ("Aryendell") y traslada el texto a notas o resumen para no perder información.
 */
export function sanitizePlayerCharacter(
  pc?: PlayerCharacter,
  fallbackName = 'Aryendell'
): PlayerCharacter {
  if (!pc) {
    return {
      name: fallbackName,
      title: 'Protagonista (OC)',
      race: 'Elfa de la Luna',
      class: 'Druida / Maga',
      summary: '',
      events: []
    };
  }

  let name = (pc.name || '').trim();
  let recoveredNote: string | undefined = undefined;

  if (isInvalidCharacterName(name)) {
    // Es texto narrativo: limpiamos prefijos como ; o - y lo guardamos
    recoveredNote = name.replace(/^[;:*\-.,\s]+/, '').trim();
    // Buscamos si en el texto o en el nombre original se mencionaba un nombre reconocible
    if (/\bAryendell\b/i.test(recoveredNote)) {
      name = 'Aryendell';
    } else {
      name = fallbackName;
    }
  }

  // Comprobación de título
  let title = pc.title?.trim();
  if (title && (isInvalidCharacterName(title) || title.length > 60)) {
    if (!recoveredNote) recoveredNote = title;
    else recoveredNote += '\n\n' + title;
    title = undefined;
  }

  let summary = pc.summary || '';
  let notes = pc.notes || '';

  // Si recuperamos notas que estaban metidas por error en el nombre, las preservamos
  if (recoveredNote) {
    const alreadyPresent =
      (summary && summary.includes(recoveredNote)) ||
      (notes && notes.includes(recoveredNote)) ||
      (pc.backstory && pc.backstory.includes(recoveredNote)) ||
      (pc.personality && pc.personality.includes(recoveredNote));

    if (!alreadyPresent) {
      if (notes) {
        notes = `${notes}\n\n*Nota rescatada de identidad:* ${recoveredNote}`;
      } else {
        notes = `*Nota rescatada de identidad:* ${recoveredNote}`;
      }
    }
  }

  return {
    ...pc,
    name: name || fallbackName,
    title: title || pc.title,
    summary,
    notes,
    events: Array.isArray(pc.events) ? pc.events : []
  };
}

/**
 * Limpia y normaliza toda la memoria viva del proyecto.
 */
export function sanitizeProjectMemory(mem?: Memory): Memory {
  if (!mem) {
    return {
      story: '',
      quests: [],
      npcs: [],
      companions: [],
      locations: [],
      current_status: '',
      manual_notes: '',
      visual_memory: [],
      player_character: sanitizePlayerCharacter()
    };
  }

  const cleanPc = sanitizePlayerCharacter(mem.player_character);
  const pcClean = (cleanPc.name || '').trim().toLowerCase();
  const generic = new Set(['protagonista', 'jugador', 'el jugador', 'personaje jugador', 'oc', 'pj', 'hero', 'héroe']);

  // Filtrar PNJs que sean en realidad el protagonista
  const cleanNpcs = (mem.npcs || []).filter(n => {
    const nl = (n.name || '').trim().toLowerCase();
    if (!nl || generic.has(nl)) return false;
    if (pcClean && (nl === pcClean || (nl.length > 3 && (nl.includes(pcClean) || pcClean.includes(nl))))) {
      return false;
    }
    return true;
  });

  return {
    ...mem,
    story: mem.story || '',
    quests: Array.isArray(mem.quests) ? mem.quests : [],
    npcs: cleanNpcs,
    companions: Array.isArray(mem.companions) ? mem.companions : [],
    locations: Array.isArray(mem.locations) ? mem.locations : [],
    current_status: mem.current_status || '',
    manual_notes: mem.manual_notes || '',
    visual_memory: Array.isArray(mem.visual_memory) ? mem.visual_memory : [],
    player_character: cleanPc
  };
}
