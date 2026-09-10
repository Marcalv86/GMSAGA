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
/**
 * Nombre de reserva cuando no hay ninguno.
 *
 * Era «Aryendell», el personaje de una campaña concreta, cableado en el código
 * como si fuera el de todo el mundo. Un hueco se rellena con un hueco, no con
 * los datos de otra partida.
 */
const NOMBRE_DE_RESERVA = 'Protagonista';

export function sanitizePlayerCharacter(
  pc?: PlayerCharacter,
  fallbackName = NOMBRE_DE_RESERVA
): PlayerCharacter {
  if (!pc) {
    /*
     * ⛔ AQUÍ NO SE INVENTA UNA RAZA NI UNA CLASE.
     *
     * Esto devolvía «Elfa de la Luna · Druida / Maga» cuando no había ficha, y
     * eso NO se quedaba en la pantalla: la raza viaja al Narrador en cada turno
     * como «RAZA / ESPECIE: Elfa de la Luna». O sea que el Narrador no se
     * confundía —se lo estábamos diciendo nosotros—, y luego chocaba con los
     * documentos, que decían drow. De ahí salían párrafos con «la elfa de la
     * luna» y «la piel de obsidiana de la prisionera» en la misma página.
     *
     * Un campo vacío es un campo vacío. Que no se sepa la raza es un dato
     * cierto; inventarla es un dato falso.
     */
    return {
      name: fallbackName,
      title: 'Protagonista (OC)',
      level: 'Nivel 1',
      levelProgress: 0,
      summary: '',
      events: []
    };
  }

  let name = (pc.name || '').trim();
  let levelProgress = typeof pc.levelProgress === 'number' ? Math.max(0, Math.min(100, pc.levelProgress)) : 50;
  let recoveredNote: string | undefined = undefined;

  if (isInvalidCharacterName(name)) {
    // Es texto narrativo: limpiamos prefijos como ; o - y lo guardamos
    recoveredNote = name.replace(/^[;:*\-.,\s]+/, '').trim();
    // Buscamos si en el texto o en el nombre original se mencionaba un nombre reconocible
    name = fallbackName;
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
    levelProgress,
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
      visual_memory: [],
      player_character: sanitizePlayerCharacter()
    };
  }

  const cleanPc = sanitizePlayerCharacter(mem.player_character);

  /*
   * EL PROTAGONISTA NO ES UN PNJ, Y AQUÍ SE LE CERRABA MAL LA PUERTA.
   *
   * Se comparaba contra `cleanPc.name`, que YA VIENE CON EL NOMBRE DE RESERVA
   * puesto: si la ficha no tenía nombre, la comparación se hacía contra
   * «Protagonista» y cualquier ficha del OC —«Aryendell»— pasaba limpiamente.
   * Y como el compendio de la campaña habla del OC en cada página, el extractor
   * de PNJs le hacía su tarjeta como a uno más.
   *
   * Ahora se compara contra el nombre DE VERDAD, sin el relleno, y plegando
   * tildes: «Aryéndell» y «Aryendell» eran dos personas distintas para un
   * `toLowerCase()` a secas.
   */
  const plegar = (v?: string) =>
    (v || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const generic = new Set(['protagonista', 'jugador', 'el jugador', 'personaje jugador', 'oc', 'pj', 'hero', 'heroe']);
  const nombreReal = plegar(mem.player_character?.name);
  const pcClean = generic.has(nombreReal) ? '' : nombreReal;
  // «Aryendell Sylvaris» y «Aryendell» son la misma: el nombre de pila cuenta.
  const pcPila = pcClean.split(/\s+/)[0] || '';

  const esElProtagonista = (nombre?: string) => {
    const nl = plegar(nombre);
    if (!nl) return false;
    if (generic.has(nl)) return true;
    if (!pcClean) return false;
    if (nl === pcClean) return true;
    if (nl.length > 3 && (nl.includes(pcClean) || pcClean.includes(nl))) return true;
    // Nombre de pila suelto contra ficha con apellido, y al revés.
    if (pcPila.length > 3 && plegar(nombre).split(/\s+/)[0] === pcPila) return true;
    return false;
  };

  // Y los que la jugadora haya marcado a mano como «esto no es un PNJ».
  const vetados = new Set((mem.no_son_pnj || []).map(plegar).filter(Boolean));

  // Filtrar PNJs que sean en realidad el protagonista
  const cleanNpcs = (mem.npcs || []).filter(
    n => (n.name || '').trim() && !esElProtagonista(n.name) && !vetados.has(plegar(n.name))
  );

  return {
    ...mem,
    story: mem.story || '',
    quests: Array.isArray(mem.quests) ? mem.quests : [],
    npcs: cleanNpcs,
    no_son_pnj: Array.isArray(mem.no_son_pnj) ? mem.no_son_pnj : undefined,
    companions: Array.isArray(mem.companions) ? mem.companions : [],
    locations: Array.isArray(mem.locations) ? mem.locations : [],
    current_status: mem.current_status || '',
    visual_memory: Array.isArray(mem.visual_memory) ? mem.visual_memory : [],
    player_character: cleanPc
  };
}
