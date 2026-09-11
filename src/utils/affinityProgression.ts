import { NPC } from '../types';

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

/**
 * Actualiza los tres ejes de afinidad (ATR, VÍN, CON) de un PNJ aplicando las reglas de nivel,
 * requisitos de días y límite diario de calendario.
 *
 * La atracción tiene además un candado propio: si la ficha del PNJ lo lleva
 * puesto —porque su orientación o su disponibilidad no dan para ello—, ninguna
 * subida que mande el Narrador entra. Pedírselo por escrito no bastaba: si la
 * decisión de que alguien no siente nada por ella depende de que el modelo se
 * acuerde, un turno cualquiera se le olvida y la barra ya no baja sola.
 */
export function actualizarAfinidadNpc(
  npc: NPC,
  reportado: { atr?: number; vin?: number; con?: number; vinculo?: string; aparenta?: string; oculta?: string },
  diasActualizados: number[],
  diaActual: number
): Partial<NPC> {
  const totalDias = diasActualizados.length;
  const ultimosDias = npc.ultimoDiaSubida || {};

  const progresoAtr = npc.atrBloqueada
    ? { nuevoValor: 0, diaSubida: ultimosDias.atr }
    : calcularProgresoEje(npc.atr, reportado.atr, totalDias, diaActual, ultimosDias.atr);
  const progresoVin = calcularProgresoEje(npc.vin, reportado.vin, totalDias, diaActual, ultimosDias.vin);
  const progresoCon = calcularProgresoEje(npc.con, reportado.con, totalDias, diaActual, ultimosDias.con);

  const nuevoUltimoDiaSubida = {
    atr: progresoAtr.diaSubida ?? ultimosDias.atr,
    vin: progresoVin.diaSubida ?? ultimosDias.vin,
    con: progresoCon.diaSubida ?? ultimosDias.con
  };

  return {
    atr: progresoAtr.nuevoValor,
    vin: progresoVin.nuevoValor,
    con: progresoCon.nuevoValor,
    ultimoDiaSubida: nuevoUltimoDiaSubida
  };
}
