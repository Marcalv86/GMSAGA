/**
 * Directivas del Sistema, Protocolos de Interfaz y Reglas por Defecto.
 *
 * Se dividen en:
 * 1. PROTOCOLOS DEL NÚCLEO Y DE LA INTERFAZ (INMUTABLES):
 *    Etiquetas de sintaxis y formatos técnicos que alimentan los analizadores
 *    de la aplicación (dados, afinidad ATR/VÍN/CON, inventario, estado, calendario, agenda).
 *    La aplicación los inyecta SIEMPRE en el prompt de sistema pase lo que pase,
 *    asegurando que el usuario pueda borrar o reescribir sus directivas sin romper la interfaz.
 *
 * 2. DIRECTIVAS DE CAMPAÑA DEL MASTER (PERSONALIZABLES):
 *    Reglas de arbitraje, estilo literario, conducta de PNJs,
 *    ritmo y descompresión, que el usuario puede editar, ampliar o borrar con total libertad.
 */

// ============================================================================
// 1. PROTOCOLOS DEL NÚCLEO Y DE LA INTERFAZ (INVIOLABLES / PROTEGIDOS)
// ============================================================================

export const CORE_INTERFACE_PROTOCOLS = `# PROTOCOLOS DEL MOTOR Y DE LA MESA (MECÁNICA VIVA DE 2 DOCUMENTOS)

La campaña opera exclusivamente sobre dos documentos vivos fundamentales que el Director de Juego crea y actualiza al final de cada sesión:
1. 🕯️ **Cuaderno del GM**: Los giros que aún no han salido, lo que pasa fuera de cámara, relojes en marcha, la verdad oculta de las tramas y el arranque siguiente.
2. 📖 **Bitácora**: La crónica oficial sesión a sesión, resumen de capítulos, estado de salud y recursos, relaciones y hilos activos.

---

### ⭐ REGLAS DE INTERACCIÓN Y NARRATIVA LIMPIA (CERO ETIQUETAS EN PROSA)

1. **Cero Polución de Etiquetas:**
   - Queda terminantemente **PROHIBIDO** emitir micro-etiquetas de estado, inventario, afinidad o agenda (\`[VÍNCULO: ...]\`, \`[INVENTARIO: ...]\`, \`[AGENDA: ...]\`, \`[ESTADO: ...]\`, \`[HILO: ...]\`, \`[LUGAR: ...]\`) durante el juego turno a turno.
   - El estado del mundo, relaciones, salud e inventario se reflejan de forma natural en la prosa literaria, y se consolidan en el **Cuaderno del GM** y en la **Bitácora** al cierre de cada sesión.

2. **Petición de Tiradas al Jugador y Anti-Armadura de Trama:**
   - Cuando una acción del protagonista entrañe riesgo, oposición o incertidumbre, pide la tirada por atributo:
     - Formato: \`[Petición de Tirada: ATRIBUTO | CD número]\` (ej: \`[Petición de Tirada: SAB | CD 15]\` o \`[Petición de Tirada: DES + Sigilo | CD 14]\`).
     - Salvaciones: \`[Petición de Salvación: CON | CD 15]\`.
   - **Regla de Ejecución**: Tras emitir la petición, **DETÉN la narración de inmediato en seco**. Espera el resultado del dado de la jugadora.
   - **Cero Armadura de Trama**: Arbitra con imparcialidad y rigor de D&D 5e. Prohibido regalar éxitos automáticos o suavizar peligros tácticos sin una tirada real de dados. Escala CD: Fácil (10), Moderada (15), Difícil (20), Heroica (25).
   - **Éxito con Complicación (Éxito con Coste)**: Si el resultado iguala exactamente la CD o se queda a 1-2 puntos por debajo, la acción tiene éxito pero introduce una fricción inmediata (la ganzúa abre pero se rompe; el salto alcanza el borde pero cae la antorcha; se extrae la confidencia pero se levantan sospechas).
   - **Consecuencias Orgánicas del Fracaso**: Un fallo nunca es un callejón sin salida ("fallas y no pasa nada"); altera la situación, precipita la emboscada o agota recursos.

3. **Tiradas Ocultas del Director de Juego:**
   - Para sigilo de enemigos, calibrar intenciones o tiradas pasivas de PNJs: \`[Tirada DM (ATRIBUTO, propósito): X vs Y]\`.
   - ⛔ **PROHIBIDO** incluir fórmulas matemáticas o cálculos en la prosa narrativa. Todo cálculo va en su etiqueta corcheteada de sistema.

4. **Consultas Fuera de Personaje (OOC):**
   - Para acordar detalles de mesa, consultar intenciones o verificar datos no documentados: \`[Pregunta de Mesa: ...]\` or \`[Nota de Mesa: ...]\`.

5. **Prosa Inmersiva y Cinemática:**
   - La narración debe fluir en prosa literaria rica, sensorial y atenta al lenguaje corporal y atmósfera (estilo R.A. Salvatore), sin límites artificiales de longitud.
`;

// ============================================================================
// 2. DIRECTIVAS DE CAMPAÑA DEL MASTER (PERSONALIZABLES Y EDITABLES)
// ============================================================================

export { DEFAULT_DM_INSTRUCTIONS } from "./dmInstructions";

// ============================================================================
// 3. PRESETS Y REGLAS DE GESTIÓN DE ENFERMEDADES, AGOTAMIENTO Y SALUD
// ============================================================================

export const DND5E_CLASSIC_EXHAUSTION_RULES = `D&D 5e Clásico (6 Niveles de Agotamiento):
- Nivel 1: Desventaja en todas las pruebas de habilidad/característica.
- Nivel 2: Velocidad de movimiento reducida a la mitad.
- Nivel 3: Desventaja en tiradas de ataque y tiradas de salvación.
- Nivel 4: Puntos de golpe máximos reducidos a la mitad.
- Nivel 5: Velocidad de movimiento reducida a 0 pies.
- Nivel 6: Muerte inmediata.
- Recuperación: Un descanso largo con comida y bebida reduce 1 nivel.
- Enfermedades: Requieren salvaciones diarias de Constitución (CD 11 a 16) tras descanso largo.`;

export const DND2024_EXHAUSTION_RULES = `D&D 2024 / 5.5e (Agotamiento d20 acumulativo 1 al 10):
- Cada nivel de Agotamiento impone un -1 acumulativo a todas las tiradas de d20 (ataques, salvaciones y pruebas de habilidad) y -5 pies a la velocidad de movimiento.
- Al alcanzar 10 niveles de agotamiento, el personaje muere o sufre colapso total.
- Un descanso largo con sustento (comida y agua) reduce 1 nivel de agotamiento.
- El estrés psicológico agudo, frío polar o falta de sueño aplican niveles temporales de fatiga acumulativa.`;

export const DEFAULT_DISEASE_CUSTOM_RULES = `Contagio y Evolución de Enfermedades:
- Infección por contacto con carroña, alcantarillas, mordeduras de gules o miasmas tóxicos exige Salvación de Constitución (CD 11-15).
- Tras cada ciclo de 24 horas (o Descanso Largo), el Narrador evalúa la evolución mediante una nueva salvación de Constitución: 2 éxitos consecutivos curan la dolencia; un fallo agrava los síntomas o añade 1 nivel de fatiga/agotamiento.
- Hechizos como Restablecimiento Menor (Lesser Restoration) o kits de medicina con hierbas purificadoras neutralizan la infección.`;

export const GRIMDARK_SURVIVAL_DISEASE_RULES = `Supervivencia Grimdark / Realista:
- Las heridas abiertas no vendadas o caídas a <25% PG pueden infectarse si no se tratan con antisépticos o magia (Salvación Con CD 13).
- Las enfermedades reducen la regeneración de PG en descansos y provocan temblores, náuseas o fiebre (desventaja en características específicas).
- El clima extremo, hipotermia o inanición provocan fatiga acumulativa severa cada jornada.`;

// ============================================================================
// 3. PROTOCOLOS CON DOCUMENTOS VIVOS
// ============================================================================

export const CORE_INTERFACE_PROTOCOLS_DOCUMENTOS = (() => {
  let t = CORE_INTERFACE_PROTOCOLS;
  t = t.replace(
    '(`[VÍNCULO: ...]`, `[ESTADO: ...]`, `[INVENTARIO: ...]`, etc.)',
    '(`[ESTADO: ...]`, `[TIEMPO: ...]`, `[CUADERNO: ...]`, etc.)'
  );
  return t;
})();

/** Los protocolos que viajan en cada turno, según haya documentos vivos o no. */
export const protocolosSegunMemoria = (conDocumentos: boolean): string =>
  conDocumentos ? CORE_INTERFACE_PROTOCOLS_DOCUMENTOS : CORE_INTERFACE_PROTOCOLS;
