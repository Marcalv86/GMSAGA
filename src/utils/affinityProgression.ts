import { deseaALaProtagonista, NPC } from '../types';

/**
 * Número mínimo de días/encuentros distintos requeridos para alcanzar cada puntuación en la escala 1-20.
 *
 * Estructura de los 5 Corazones / Rangos:
 * - Rango 0 (0-1, 🤍 Desconocido / Frialdad): 0-1 interacciones
 * - Rango 1 (2-5, ❤️ 1 Corazón / Curiosidad inicial): 1 a 2 interacciones (progresión ágil)
 * - Rango 2 (6-9, ❤️❤️ 2 Corazones / Camaradería): 3 a 5 interacciones
 * - Rango 3 (10-13, ❤️❤️❤️ 3 Corazones / Química / Alianza): 6 a 9 interacciones
 * - Rango 4 (14-17, ❤️❤️❤️❤️ 4 Corazones / Fascinación / Lealtad forjada): 10 a 14 interacciones
 * - Rango 5 (18-20, ❤️❤️❤️❤️❤️ 5 Corazones / Devoción absoluta): 15 a 18+ interacciones
 */
export function interaccionesRequeridasParaNivel(nivel: number): number {
  if (nivel <= 1) return 0;
  if (nivel <= 3) return 1;
  if (nivel <= 5) return 2;
  if (nivel <= 7) return 4;
  if (nivel <= 9) return 6;
  if (nivel <= 11) return 8;
  if (nivel <= 13) return 10;
  if (nivel <= 15) return 12;
  if (nivel <= 17) return 14;
  if (nivel <= 19) return 16;
  return 18;
}

/**
 * Calcula la progresión orgánica de un eje de afinidad (ATR, VÍN, CON) en la escala 0-20.
 *
 * Reglas de progresión:
 * 1. Límite diario: No puede subir más de +1 punto por día de calendario (marca).
 * 2. Si ya subió en el mismo día de calendario, el valor no se incrementa adicionalmente.
 * 3. Progresión escalonada: Subir a niveles superiores (rangos 2, 3, 4, 5) exige más días acumulados.
 * 4. Puntuaciones iniciales: un eje SIEMPRE empieza en 0 y sube desde ahí.
 * 5. Si el reporte sugiere una bajada (desconfianza, conflicto), se aplica directamente.
 *
 * ⛔ Lo que corrige el punto 4. Aquí había una regla llamada «Arquetipos
 * canónicos» que, la primera vez que un PNJ recibía puntuación, adoptaba tal
 * cual la que hubiera escrito el Narrador. Los protocolos dicen lo contrario
 * con todas las letras —«la atracción empieza en cero, siempre, para todos; no
 * hay puntuación de partida por arquetipo»—, así que el modelo escribía un 7
 * de salida y el código se lo firmaba, saltándose de paso el límite diario y
 * los días de trato acumulados. De ahí que a la jugadora le saliera atracción
 * en medio elenco desde el primer encuentro: no era el prompt desobedeciendo,
 * era esta función concediéndolo.
 */
export function calcularProgresoEje(
  valorActual: number | undefined,
  valorReportado: number | undefined,
  totalDiasVistos: number,
  diaActual: number,
  ultimoDiaSubidaEje: number | undefined
): { nuevoValor: number | undefined; diaSubida: number | undefined } {
  if (valorReportado === undefined || valorReportado === null) {
    return { nuevoValor: valorActual, diaSubida: ultimoDiaSubidaEje };
  }

  // Clampear valor sugerido entre 0 y 20
  const sugerido = Math.max(0, Math.min(20, Math.round(valorReportado)));

  // Sin valor previo, el eje nace en 0 y a partir de ahí sube por las mismas
  // reglas que los demás: un punto por día y con los días de trato pedidos.
  // Un primer encuentro puede dejarlo en 1 como mucho, nunca en el número que
  // le apetezca al Narrador.
  if (valorActual === undefined || valorActual === null) {
    if (sugerido <= 0) return { nuevoValor: 0, diaSubida: ultimoDiaSubidaEje };
    return { nuevoValor: 1, diaSubida: diaActual };
  }

  // Si el valor sugerido es menor o igual al actual (bajada o mantenimiento)
  if (sugerido <= valorActual) {
    return { nuevoValor: sugerido, diaSubida: ultimoDiaSubidaEje };
  }

  // Si es una subida (sugerido > valorActual):
  // 1. Regla de Límite Diario: si ya subió en este mismo día de calendario, frenar subida adicional
  if (ultimoDiaSubidaEje !== undefined && ultimoDiaSubidaEje === diaActual) {
    return { nuevoValor: valorActual, diaSubida: ultimoDiaSubidaEje };
  }

  // 2. Progresión paso a paso: Máximo +1 punto por subida
  const siguienteNivel = Math.min(valorActual + 1, 20);

  // 3. Comprobar requisitos de interacciones acumuladas según el nivel objetivo
  const interacciones = Math.max(1, totalDiasVistos);
  const requeridas = interaccionesRequeridasParaNivel(siguienteNivel);

  if (interacciones >= requeridas) {
    return { nuevoValor: siguienteNivel, diaSubida: diaActual };
  }

  // Requisitos no cumplidos aún: se mantiene el nivel actual
  return { nuevoValor: valorActual, diaSubida: ultimoDiaSubidaEje };
}

/*
 * ⛔ AQUÍ VIVÍA `esPersonalidadCoquetaOEnamoradiza`, y se ha ido con el 0-20.
 *
 * Buscaba por subcadena en siete campos del personaje —nombre, notas,
 * descripción, lo que aparenta, lo que oculta, el vínculo y la relación— una
 * lista de términos entre los que estaban «atractiv», «carismátic» y el nombre
 * propio de un PNJ concreto de una campaña. Al que acertara le concedía 6 de
 * 20 de atracción sin que nadie lo hubiera pedido.
 *
 * Eso ponía en dos corazones a media taberna: a cualquiera descrito como
 * atractivo o carismático, y al lugarteniente de alguien coqueto por llevar el
 * nombre de su jefe en las notas. Y era plano además: el drow más encantador
 * de la Costa y un tabernero simpático valían exactamente lo mismo.
 *
 * El deseo lo pone ahora quien tiene la ficha delante y sabe de quién habla.
 */

/**
 * Actualiza los tres ejes de afinidad (ATR, VÍN, CON) de un PNJ.
 *
 * 1. ATR (Atracción & Flechazo):
 *    Representa el magnetismo, la química y el flechazo del PNJ hacia la protagonista.
 *    Depende de la personalidad coqueta o enamoradiza del PNJ y de la química en escena.
 *    No es un contador burocrático lento: fluctúa dinámicamente según el flirteo,
 *    la audacia y los momentos compartidos, permitiendo chispa o flechazo inicial desde el primer encuentro.
 *    Si la orientación no es compatible (atrBloqueada), permanece bloqueada en 0.
 *
 * 2. VÍN (Vínculo Afectivo) y CON (Confianza en Secretos):
 *    Representan la lealtad forjada y la confianza ganada con el tiempo y las acciones,
 *    por lo que aplican progresión escalonada protegida por días de trato acumulados.
 */
export function actualizarAfinidadNpc(
  npc: NPC,
  reportado: {
    atraccion?: 'si' | 'no';
    vin?: number;
    con?: number;
    vinculo?: string;
    aparenta?: string;
    oculta?: string;
  },
  diasActualizados: number[],
  diaActual: number
): Partial<NPC> {
  const totalDias = diasActualizados.length;
  const ultimosDias = npc.ultimoDiaSubida || {};

  /*
   * EL DESEO NO PASA POR AQUÍ.
   *
   * Aquí había una escala 0-20 con dos atajos que se contradecían: aceptaba
   * tal cual el número que pusiera el Narrador —saltándose el tope diario que
   * el propio prompt le prometía— y, si no decía nada, concedía un 6 de salida
   * a quien «sonara» coqueto. Ese 6 era plano (Jarlaxle y un tabernero
   * encantador valían lo mismo) y se disparaba por subcadena en siete campos,
   * así que el lugarteniente de alguien coqueto heredaba su puntuación.
   *
   * Ahora el deseo es un interruptor y lo pone quien corresponde: el Narrador,
   * que tiene la ficha del personaje delante. Lo único que se hace aquí es
   * respetarlo. Y no se apaga solo: que no venga nada en este turno no
   * significa que haya dejado de desearla.
   */
  const nuevaAtraccion = reportado.atraccion ?? npc.atraccion;

  // VÍN y CON (Lealtad y Confianza escalonadas)
  const progresoVin = calcularProgresoEje(npc.vin, reportado.vin, totalDias, diaActual, ultimosDias.vin);
  const progresoCon = calcularProgresoEje(npc.con, reportado.con, totalDias, diaActual, ultimosDias.con);

  const nuevoUltimoDiaSubida = {
    vin: progresoVin.diaSubida ?? ultimosDias.vin,
    con: progresoCon.diaSubida ?? ultimosDias.con
  };

  return {
    atraccion: nuevaAtraccion,
    vin: progresoVin.nuevoValor,
    con: progresoCon.nuevoValor,
    ultimoDiaSubida: nuevoUltimoDiaSubida
  };
}

/**
 * Devuelve la afinidad a su sitio después de una sincronización de memoria.
 * Respeta el flechazo/atracción inicial si el PNJ es coqueto/enamoradizo o si fue reportado,
 * mientras que VÍN y CON se construyen jugando.
 */
export function conciliarAfinidadesTrasSincronizar<
  T extends {
    name: string;
    atraccion?: 'si' | 'no';
    /** ⚠️ LEGADO, solo para migrar campañas anteriores al interruptor. */
    atr?: number;
    vin?: number;
    con?: number;
    /** ⚠️ LEGADO. */
    atrBloqueada?: boolean;
    notes?: string;
    description?: string;
    aparenta?: string;
    oculta?: string;
    vinculo?: string;
    relation?: string;
    diasVistos?: number[];
    ultimoDiaSubida?: { atr?: number; vin?: number; con?: number };
  }
>(
  npcsPrevios: T[],
  npcsSincronizados: T[],
  diaActual: number,
  mismoNpc: (a: string, b: string) => boolean
): T[] {
  return npcsSincronizados.map(sincronizado => {
    const previo = npcsPrevios.find(p => mismoNpc(p.name, sincronizado.name));

    /*
     * Alguien nuevo fichado en la sincronización.
     *
     * El deseo se respeta tal cual venga —es un interruptor, no algo que se
     * acumule, así que puede estar encendido desde el primer encuentro—.
     * VÍN y CON empiezan en 0 y se forjan jugando: eso es lo que se gana.
     */
    if (!previo) {
      return {
        ...sincronizado,
        atraccion: deseaALaProtagonista(sincronizado),
        vin: 0,
        con: 0,
        ultimoDiaSubida: {},
        diasVistos: sincronizado.diasVistos?.length ? sincronizado.diasVistos : [diaActual]
      };
    }

    // A quien ya existía se le actualiza respetando la progresión
    const dias = previo.diasVistos?.length ? previo.diasVistos : sincronizado.diasVistos || [];
    const progresado = actualizarAfinidadNpc(
      previo as any,
      { atraccion: deseaALaProtagonista(sincronizado), vin: sincronizado.vin, con: sincronizado.con },
      dias,
      diaActual
    );

    return {
      ...sincronizado,
      ...progresado,
      diasVistos: dias
    };
  });
}
