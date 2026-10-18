# Actualización de Instrucciones del GM, Crónica con Ilustraciones, Frentes Paralelos e Hitos

Plan integral para incorporar las nuevas instrucciones de Director de Juego (D&D 5e / Forgotten Realms), añadir el cuarto documento vivo de **📜 Crónica** (con 3 momentos candidatos a ilustración por capítulo), integrar la tarjeta interactiva de **Frentes Paralelos** (`[FRENTES:]`) en el chat y el HUD, e implementar el **Contador Visual de Hitos de Nivel** (`[Avance: X/Y hacia Nivel N]`) en la Bitácora.

---

## Decisiones del Usuario y Alcance Confirmado

> [!IMPORTANT]
> **Alcance validado con el usuario:**
> 1. **Ámbito de las directivas:** Se actualizan las directivas por defecto para nuevas campañas (`DEFAULT_DM_INSTRUCTIONS` y `AGENTS.md`), preservando las campañas existentes intactas.
> 2. **Documento 📜 Crónica:** Se integra formalmente como el cuarto documento vivo en el proceso de cierre de capítulo / volcado, generando el relato de la sesión y 3 candidatos de ilustración (acción, íntimo y atmósfera) con visualización y copia rápida.
> 3. **Frentes Paralelos:** Tarjeta interactiva en la cabecera del chat / HUD para monitorizar el frente activo y avisar del corte de cámara al superar los 3 turnos.
> 4. **Hitos de Nivel:** Contador visual en la vista de Bitácora y Ficha viva con barra de progreso segmental hacia el siguiente nivel.

---

## 1. Visión General y Concepto

La versión actualizada de las instrucciones profundiza en el rigor canónico, el cortejo audaz de Jarlaxle, el anclaje de carácter, el protocolo de asimetría de información y la gestión de campañas en dos focos paralelos (*Split Party*). 

Este cambio amplía GM Studio con dos piezas mecánicas clave:
- **Gestión visual de Frentes Paralelos (`[FRENTES: activo: ... | otros: ...]`)**: cuando el grupo se divide, la IA y la interfaz alternan cámaras, muestran quién está en foco y recuerdan proactivamente a los 3 turnos cuándo procede el corte de cámara.
- **Cuarto Documento Vivo (`Crónica.md`)**: un relato literario consolidado al final de cada sesión/capítulo que extrae tres momentos candidatos para ilustrar (con prompts listos para generación o guardado).
- **Contador de Hitos (`[Avance: X/Y hacia Nivel N]`)**: progreso visible en la Bitácora y en la barra de campaña para que la subida de nivel no se estanque ni se pierda entre sesiones.

---

## 2. Experiencia de Usuario y Diseño Visual

### 2.1 Tarjeta Interactiva de Frentes Paralelos (`SceneHUDCard` / `ChatView`)
- **Aspecto**: Barra superior anclada en el chat con fondo de pergamino oscuro / dorado, icono cinematográfico de foco de cámara (`Clapperboard` o `Film`) y tipografía Cinzel.
- **Contenido**:
  - Indicador del foco actual: `En foco: [Nombre y Lugar]` con contador de turnos transcurridos en ese frente.
  - Lista de frentes en espera con insignias limpias tipográficas (sin pills artificiales): `Esperan: Jarlaxle en la costa · Auron en el sendero`.
  - Alerta sutil al llegar al tercer turno: *"Toca corte de cámara (3 turnos en este foco)"*.
  - Botón de acción rápida: *"Alternar frente"* para sugerir al DM el corte de cámara en el siguiente mensaje.

### 2.2 Cuarto Documento Vivo: 📜 Crónica Viva (`DocumentosVivosPanel` & `Bitacora`)
- **Pestaña y Archivo**: Incorporación de `Crónica.md` junto al Cuaderno del GM, la Ficha viva y la Bitácora.
- **Bloque de Momentos para Ilustración**:
  - Al cerrar capítulo, el volcado genera la crónica y desglosa los 3 momentos candidatos:
    1. **Acción / Aventura**: conflicto físico, maniobra o peligro.
    2. **Íntimo / Emocional**: mirada, silencio, confidencia o roce.
    3. **Atmósfera / Entorno**: lugar, clima o iluminación singular.
  - Cada momento incluye encuadre sugerido, paleta de color y un botón para *"Generar con IA"* o *"Copiar Prompt"*.

### 2.3 Contador Visual de Hitos de Nivel (`DailyAgendaDiary` / `Bitácora`)
- **Indicador de Avance**: Medidor segmental (`● ● ○`) indicando `[Avance: 2/3 hacia Nivel 3]`.
- **Desglose de Tipos de Hito**: Etiquetas limpias para distinguir si el hito fue de Investigación, Social, Espiritual/Druídico, Exploración, Vínculos o Combate (garantizando que la progresión no dependa solo de pelear).

---

## 3. Decisiones de Producto y Arquitectura de Datos

1. **Directivas del DM (`DEFAULT_DM_INSTRUCTIONS` y `AGENTS.md`)**:
   - Se reemplaza el texto completo en `src/utils/defaultDirectives.ts` con la versión maestra provista por el usuario.
   - Se mantiene intacto el contrato de interfaces de GM Studio (`CORE_INTERFACE_PROTOCOLS`).
   - Las campañas ya guardadas conservan su campo `instructions` actual, y el botón *"Restablecer directivas canónicas"* en la vista de Instrucciones cargará la nueva versión.

2. **Parser y Estado de Frentes (`[FRENTES: ...]`)**:
   - Se añade parser en `src/utils/geminiHelper.ts` para detectar:
     - `[FRENTES: activo: <quién/dónde> | otros: <frente2>; <frente3>]`
     - `[FRENTES: fin]`
   - Se almacena en `project.memory.frentes` con timestamp y recuento de turnos.

3. **Generación de 📜 Crónica al Cierre de Capítulo**:
   - En `volcarDocumentosVivos` y `consolidarCronicaAlCerrarCapitulo` (`geminiHelper.ts` / `documentosVivos.ts`), se genera el bloque de Crónica y los 3 momentos de ilustración, guardándolo en `project.files` como `Crónica.md` (o en la estructura de documentos vivos).

4. **Parser de Avance de Nivel (`[Avance: X/Y hacia Nivel N]`)**:
   - Se añade extracción de hitos en `src/utils/campaignCalendar.ts` y se renderiza en la tarjeta de capítulo de la Bitácora.

---

## 4. Diagrama de Arquitectura y Flujo de Datos

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FLUJO DE TURNO Y CIERRE                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│   Turno de Chat IA      │───▶│ Parser de Frentes       │───▶ Render en HUD
│   (Gemini 3.8 Flash)    │    │ [FRENTES: activo|otros] │     (Alerta de corte a los 3 turnos)
└─────────────────────────┘    └─────────────────────────┘
            │
            ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│ Cierre de Capítulo /    │───▶│ Generador de 📜 Crónica │───▶ Guarda Crónica.md
│ Volcado de Documentos   │    │ Relato + 3 Ilustraciones│     (Acción, Íntimo, Atmósfera)
└─────────────────────────┘    └─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ Extracción de Hitos     │───▶ Barra de Avance en Bitácora
│ [Avance: X/Y hacia Nivel]│     (Investigación / Social / Druídico / Combate)
└─────────────────────────┘
```

---

## 5. Fases de Ejecución

1. **Fase 1: Directivas y Cantera**:
   - Actualizar `src/utils/defaultDirectives.ts` con el texto completo del nuevo prompt del Director de Juego.
   - Sincronizar `AGENTS.md` con el nuevo contenido.
2. **Fase 2: Motor de Frentes Paralelos**:
   - Crear tipos y parser de `[FRENTES:]` en `src/utils/campaignCalendar.ts` / `src/utils/geminiHelper.ts`.
   - Implementar el componente visual de Frentes en `src/components/SceneHUDCard.tsx` y `ChatView.tsx`.
3. **Fase 3: Crónica Viva y Momentos de Ilustración**:
   - Añadir la generación y soporte de archivo `Crónica.md` en `src/utils/documentosVivos.ts` y `src/utils/geminiHelper.ts`.
   - Añadir pestaña / visor de Crónica y selector de ilustraciones en `DocumentosVivosPanel.tsx`.
4. **Fase 4: Hitos de Nivel en Bitácora**:
   - Parser de `[Avance: X/Y]` y widget de progreso en `DailyAgendaDiary.tsx` / `Bitácora`.
5. **Fase 5: Validación**:
   - Comprobar compilación (`compile_applet`) y tipado estricto (`lint_applet`).
