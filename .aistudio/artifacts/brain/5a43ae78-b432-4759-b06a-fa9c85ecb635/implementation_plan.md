# Plan de Optimización, Limpieza de Código Muerto y Eliminación de Límites de Longitud de Respuesta

Plan de optimización técnica, saneamiento arquitectónico y ajuste de directivas para **GM Studio (Saga Viviente)**. Cubre la eliminación de código obsoleto y no utilizado, optimización del tamaño del paquete mediante división de código, reestructuración del prompt de IA sin redundancias y la eliminación completa de directivas que limitaban artificialmente la longitud o extensión de las respuestas del Narrador.

## Decisiones Críticas y Aprobaciones del Usuario

> [!IMPORTANT]
> Decisiones confirmadas e incorporadas:
> - **Alcance global coordinado**: Saneamiento de código muerto, aceleración de rutas críticas, reducción del tamaño del bundle y eficiencia de tokens.
> - **Eliminación de límites de longitud de respuesta (Nuevo requerimiento)**: Se retiran de las instrucciones del sistema y del código (`geminiHelper.ts`, directivas de campaña y plantillas de prompt) todas las restricciones que forzaban respuestas breves, topes de 1-2 párrafos, límites de 3-5 oraciones por párrafo o frenos a la extensión literaria de las intervenciones. El modelo podrá narrar con la amplitud y profundidad descriptiva natural que cada escena requiera.
> - **Optimización de tokens sin merma narrativa**: Se deduplica el ensamblado del prompt en `buildTurnPayload` cuando los **Documentos Vivos** están activos, retirando únicamente los bloques y directivas legadas que ya están cubiertos por el Cuaderno del GM y la Ficha viva.
> - **Preservación estricta de datos y compatibilidad**: La limpieza no altera esquemas de base de datos, historiales de chat ni fichas de personajes existentes.

---

## 1. Visión General y Objetivos

- **Propósito**: Sanear la base de código de la aplicación eliminando componentes huérfanos, optimizar el rendimiento en carga y ejecución, y liberar la capacidad narrativa del modelo eliminando las restricciones de extensión para lograr una prosa literaria fluida y completa.
- **Público Objetivo**: Jugadores y directores de rol que buscan una experiencia inmersiva en solitario en D&D 5e con narración estilo novela sin cortes arbitrarios ni truncamientos artificiales por límites de longitud.
- **Valor Clave**: Menor tiempo de carga en navegador/móvil, respuestas del Narrador más ricas y envolventes con plena libertad de desarrollo escénico, y eliminación de 3.000 a 8.000 tokens redundantes de contexto por turno.

---

## 2. Experiencia Narrativa y de Usuario

- **Amplitud Literaria Desbloqueada**: El Narrador ya no estará constreñido a réplicas telegráficas de 1 o 2 párrafos en diálogos o interacciones. Podrá desarrollar la atmósfera, el lenguaje corporal, la introspección de los PNJs y las consecuencias de las acciones con el aliento novelístico propio de las crónicas de Reinos Olvidados.
- **Arranque Rápido de la Aplicación**: Mediante la carga perezosa (`React.lazy`) de modales pesados, la interfaz principal (chat, HUD y mesa) se torna interactiva de forma instantánea.
- **Estética Inalterada**: Mantiene íntegra la paleta de diseño de pergamino, cuero y turquesa con soporte completo para modo claro y modo noche.

---

## 3. Decisiones Técnicas y Áreas de Intervención

### Decisión 1: Supresión de Límites de Longitud en Instrucciones y Código
- **En `src/utils/geminiHelper.ts`**:
  - Eliminar la directiva `✂️ Y EL LARGO DEL TURNO SE AJUSTA A LO QUE TE HAN DADO` (que imponía límites de 1-2 párrafos por turno y restringía los intercambios).
  - Suprimir la regla de `Limita los párrafos narrativos a 3-5 oraciones como máximo`.
  - Retirar las advertencias de "turno corto por naturaleza" y frenos a la atmósfera descriptiva.
  - Asegurar que `maxOutputTokens` no restrinja indebidamente la generación en streaming (permitiendo al modelo generar su narrativa completa).
- **En `src/utils/dmInstructions.ts` y directivas del sistema**:
  - Limpiar cualquier cláusula residual que obligue a respuestas cortas o restrinja el número de párrafos por intervención, permitiendo que la prosa respire con libertad.

### Decisión 2: Retirada de Módulos y Archivos 100% Huérfanos
- **Eliminación de `src/utils/googleDrive.ts`**: Archivo huérfano de 250 líneas no utilizado por la aplicación (la persistencia se gestiona en local a través de File System Access API en `diskBackup.ts` e IndexedDB en `fileStorage.ts`).
- **Eliminación de `src/components/DiaryView.tsx`**: Componente huérfano de 235 líneas reemplazado por `DailyAgendaDiary.tsx` y el panel de Documentos Vivos.
- **Limpieza de funciones exportadas sin uso**:
  - En `geminiHelper.ts`: `syncMemoryFromChats`, `looksLikePlayerSheet`, `looksLikeNpcSheet`, `buildArtNouveauUnifiedPrompt`, `extractStyleOrSystemFromFile`, `extraerElenco`, `extraerIndice`, `modeloDisponible`.
  - En `documentosVivos.ts`: `plantillaCuaderno`, `plantillaFicha`, `plantillaCronica`.
  - En `campaignCalendar.ts`: `iconoDeRelacion`, `nuevoIdHilo`.
  - En `mesaStorage.ts`: `contarMensajesSinLeerEnMesa`.
  - En `usageStats.ts`: `peticionesPorClaveDeHoy`, `modelosSinCupoHoy`.

### Decisión 3: Optimización de Tokens en `buildTurnPayload` (Documentos Vivos)
- Cuando `docsVivos` está activo en el proyecto:
  - Se suprime la inyección de bloques redundantes de misiones, inventario duplicado e instrucciones de etiquetas antiguas (`[PREPARADO:]`, `[BAMBALINAS:]`, `[FACCIÓN:]`), ya que todo el estado vivo reside centralizado en el Cuaderno del GM y la Ficha viva.
  - Se precompilan expresiones regulares estáticas en `localSearch.ts` y `geminiHelper.ts` para evitar la recreación de objetos RegExp en cada turno.

### Decisión 4: Code Splitting y Carga Perezosa en `App.tsx`
- Envolver modales pesados y vistas secundarias con `React.lazy` y `<Suspense fallback={null}>`:
  - `LocalStorageModal`
  - `TraerDeClaudeModal`
  - `ImportarSesionesModal`
  - `ImportCampaignModal`
  - `LoggerModal`
  - `InstallAppModal`
  - `CreativeStudioModal`
  - `MapViewer`
  - `NovelReaderView`

---

## 4. Diagrama de la Arquitectura Refactorizada

```
┌────────────────────────────────────────────────────────────────────────┐
│                          APLICACIÓN REACT 19                           │
│                                                                        │
│   Carga Inmediata (Core Bundle)       Carga Dinámica (Lazy Chunks)     │
│   ┌─────────────────────────────┐     ┌────────────────────────────┐   │
│   │ • App.tsx & ContextWidget   │     │ • LocalStorageModal        │   │
│   │ • ChatView & SceneHUDCard   │     │ • CreativeStudioModal      │   │
│   │ • MesaView & SimpleMemory   │     │ • ImportCampaign / Claude  │   │
│   │ • DocumentosVivosPanel      │     │ • MapViewer & NovelReader  │   │
│   └──────────────┬──────────────┘     └─────────────┬──────────────┘   │
└──────────────────┼──────────────────────────────────┼──────────────────┘
                   │                                  │
                   ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       CAPA DE SERVICIOS Y UTILIDADES                   │
│                                                                        │
│   Estado y Documentos Vivos               Motor de Narración Gemini    │
│   ┌─────────────────────────────┐         ┌────────────────────────┐   │
│   │ • fileStorage (IndexedDB)   │         │ • geminiHelper.ts      │   │
│   │ • diskBackup (File Access)  │         │   - Directivas libres  │   │
│   │ • documentosVivos.ts        │         │     (sin tope de largo)│   │
│   │ • mesaStorage & logger      │         │   - buildTurnPayload   │   │
│   │ (Archivos muertos purgados) │         │     (sin duplicados)   │   │
│   └─────────────────────────────┘         └───────────┬────────────┘   │
└───────────────────────────────────────────────────────┼────────────────┘
                                                        │
                                                        ▼
                                            ┌────────────────────────┐
                                            │ Modelos Gemini         │
                                            │ Prosa novelada libre   │
                                            │ Sin cortes artificiales│
                                            └────────────────────────┘
```

---

## 5. Plan de Ejecución Paso a Paso

1. **Fase 1: Eliminación de límites de largo de respuesta en directivas y código**
   - Retirar en `src/utils/geminiHelper.ts` las directivas de tope de párrafos y oraciones (`3-5 oraciones`, `1 o 2 párrafos`, etc.).
   - Revisar directivas en `src/utils/dmInstructions.ts` y `defaultDirectives.ts` para asegurar que el modelo tenga plena libertad de desarrollo narrativo.

2. **Fase 2: Purga de código muerto y archivos huérfanos**
   - Eliminar `src/utils/googleDrive.ts` y `src/components/DiaryView.tsx`.
   - Limpiar exports no utilizados en utilidades (`geminiHelper.ts`, `documentosVivos.ts`, `campaignCalendar.ts`, `mesaStorage.ts`, `usageStats.ts`).

3. **Fase 3: Optimización del ensamblado de prompt en `buildTurnPayload`**
   - Condicionar y deduplicar bloques redundantes cuando `docsVivos` está activo.
   - Optimizar regexes y llamadas en caliente en `localSearch.ts`.

4. **Fase 4: Code splitting de modales en `App.tsx`**
   - Implementar `React.lazy` con `Suspense` para los modales secundarios.
   - Verificar la segregación de paquetes en la compilación de Vite.

5. **Fase 5: Validación completa**
   - Ejecutar `compile_applet` y `lint_applet` para certificar compilación limpia y ausencia de errores de tipado o imports rotos.
