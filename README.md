<div align="center">
  <h1>🎲 GM Studio</h1>
  <p><strong>Narrador de campañas de rol con IA, memoria persistente y fichas interactivas.</strong></p>
  <p><em>Aplicación 100% local: tus campañas nunca salen de tu navegador.</em></p>
</div>

---

## ¿Qué es esto?

GM Studio es un Director de Juego asistido por IA para partidas de rol en solitario.
Lleva la narración, arbitra las reglas, recuerda lo que ha pasado en la campaña y
gestiona fichas, PNJs, lugares y mapas. No presupone ninguna ambientación: toma el
mundo y el tono de la ficha y los documentos que subas.

Funciona contra la API de Google Gemini con **tu propia API key** de
[Google AI Studio](https://aistudio.google.com/app/apikey). No hay servidor, ni cuenta,
ni base de datos en la nube: todo se guarda en el navegador (IndexedDB + localStorage).

### Características

- **Narrativa estilo novela**, con directivas de narración editables por campaña.
- **Memoria viva persistente**: crónica, tramas, PNJs con ejes de afinidad, lugares y estado actual, sincronizables desde el historial con un clic.
- **Ficha del protagonista (OC) y de PNJs**, con retratos que puedes subir o vincular desde la galería de la campaña.
- **Mapas tácticos interactivos** con marcadores enlazables a PNJs y lugares.
- **Seguimiento de combate**: rondas, iniciativa, HP y estados.
- **Lector modo novela** y exportación de la crónica a PDF.
- **Importación y exportación de campañas completas en JSON** (copia de seguridad).
- **PWA instalable** y offline-first en móvil, tablet y escritorio.

---

## Puesta en marcha

Requisitos: **Node.js 18+** y npm.

```bash
git clone https://github.com/Marcalv86/Saga-Viviente-.git
cd Saga-Viviente-
npm install
npm run dev
```

La app se abrirá en `http://localhost:3000`.

### Configurar la API key

La forma recomendada es desde la propia aplicación:

1. Pulsa **⚙️ Motor** en la barra superior.
2. Pega tu API key de [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Elige modelo, temperatura, nivel de razonamiento y filtros de seguridad.

La clave se guarda en el `localStorage` de tu navegador y **no se envía a ningún sitio
salvo a la propia API de Google**.

Alternativamente puedes crear un `.env.local` con `GEMINI_API_KEY="..."` (mira
`.env.example`). Ten en cuenta que esa opción incrusta la clave en el bundle compilado,
así que úsala solo en local y nunca publiques ese `dist/`.

### Modelos disponibles

El selector incluye Gemini 3.7 Flash (por defecto), 3.1 Pro, 3.6 Flash, 3.5 Flash Lite
y los estables 2.5 Pro / 2.5 Flash como respaldo. Si un modelo te da errores de cuota,
baja a uno más ligero desde el mismo panel.

---

## Instalación como app (PWA)

- **Android (Chrome/Edge/Brave)**: botón **📲 Instalar App** en la barra superior.
- **iPhone/iPad (Safari)**: Compartir → *Añadir a la pantalla de inicio*.
- **PC/Mac (Chrome/Edge)**: icono de instalación en la barra de direcciones.

---

## Compilar

```bash
npm run build     # comprueba tipos y genera /dist
npm run preview   # sirve /dist en local para probarlo
npm run lint      # solo comprobación de tipos
```

El resultado es estático: `dist/` se puede servir desde cualquier servidor de archivos.

### Publicar la versión web

Esta copia se publica en GitHub Pages desde la carpeta `docs/`, que es una copia de
`dist/` ya compilada. Para actualizar la web tras un cambio:

```bash
npm run build
rm -rf docs && cp -r dist docs
```

Y sube `docs/` al repositorio. En *Settings → Pages* el origen debe ser
*Deploy from a branch* → rama `main` → carpeta `/docs`.

---

## Dónde se guardan tus datos

| Dato | Ubicación |
|---|---|
| Campañas, memoria, capítulos | IndexedDB (`gmstudio_app_db`) |
| Copia ligera de respaldo | `localStorage` |
| Archivos, retratos y mapas | IndexedDB |
| API key y ajustes del motor | `localStorage` |

Nada se sincroniza ni se sube a ningún servidor. Si borras los datos del navegador
pierdes la campaña, así que **exporta a JSON de vez en cuando** desde el menú lateral.

---

## Licencia

Proyecto personal. Construido con React, TypeScript, Tailwind CSS, Vite y la API de
Google Gemini.
