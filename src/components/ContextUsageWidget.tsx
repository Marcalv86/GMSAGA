import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Project, ProjectFile, Chat } from "../types";
import {
  countTurnTokens,
  describeApiError,
  getStoredBusquedaLocal,
  setStoredBusquedaLocal,
} from "../utils/geminiHelper";

import {
  BookOpen,
  Brain,
  ChartColumn,
  Gauge,
  Image,
  Info,
  Landmark,
  Loader,
  Map,
  MessageSquare,
  Paperclip,
  Search,
  Scroll,
  X,
} from "lucide-react";
export const ContextUsageWidget: React.FC<{
  project: Project | null;
  files: ProjectFile[];
  chats: Chat[];
  currentChatId?: string | null;
}> = ({ project, files, chats, currentChatId }) => {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [medida, setMedida] = useState<{
    total: number;
    sistema: number;
    conversacion: number;
    modelo: string;
  } | null>(null);
  const [midiendo, setMidiendo] = useState(false);
  const [errorMedida, setErrorMedida] = useState("");
  const [busqueda, setBusqueda] = useState(() => getStoredBusquedaLocal());

  const medirDeVerdad = async () => {
    if (!project || !currentChatId) return;
    setMidiendo(true);
    setErrorMedida("");
    try {
      setMedida(
        await countTurnTokens({ project, currentChatId, chats, files }),
      );
    } catch (err) {
      setErrorMedida(describeApiError(err));
    } finally {
      setMidiendo(false);
    }
  };

  if (!project) return null;

  // Breakdown calculations
  const instructionsChars =
    (project.instructions?.length || 0) +
    (project.system?.length || 0) +
    (project.style?.length || 0);

  const memoryChars =
    (project.memory?.story?.length || 0) +
    (project.memory?.current_status?.length || 0) +
    (project.memory?.manual_notes?.length || 0) +
    (project.memory?.npcs || []).reduce(
      (acc, n) =>
        acc +
        (n.name?.length || 0) +
        (n.notes?.length || 0) +
        (n.description?.length || 0),
      0,
    ) +
    (project.memory?.quests || []).reduce(
      (acc, q) =>
        acc +
        (q.title?.length || 0) +
        (q.objective?.length || 0) +
        (q.progress?.length || 0),
      0,
    ) +
    (project.memory?.locations || []).reduce(
      (acc, l) =>
        acc +
        (l.name?.length || 0) +
        (l.desc?.length || 0) +
        (l.notes?.length || 0),
      0,
    );

  // Un archivo de texto viaja entero salvo que sea una muestra de estilo (su valor
  // ya se destiló en las directivas) o esté marcado de consulta. Las tablas de
  // oráculo son la excepción a la excepción: se mandan siempre, porque un oráculo
  // que hay que pedir no sirve de nada.
  const esTexto = (f: ProjectFile) =>
    !f.isImage && !f.isAudio && f.category !== "style_sample";
  const viajaEntero = (f: ProjectFile) =>
    esTexto(f) && (!f.onDemand || f.category === "oracle");

  const filesChars = files.reduce(
    (acc, f) => acc + (viajaEntero(f) ? f.length || 0 : 0),
    0,
  );

  // Lo que NO viaja, contado aparte. Antes simplemente desaparecía del reparto, y
  // entonces no había manera de comprobar que marcar algo «de consulta» hubiera
  // servido de algo, ni de saber cuánto te estabas ahorrando.
  const deConsulta = files.filter(
    (f) => esTexto(f) && f.onDemand && f.category !== "oracle",
  );
  const deConsultaChars = deConsulta.reduce(
    (acc, f) => acc + (f.length || 0),
    0,
  );

  const mediaCount = files.filter((f) => f.isImage || f.isAudio).length;

  // Las imágenes no viajan, pero su análisis escrito sí, y eso hasta ahora no se
  // contaba en ninguna parte.
  const visualChars = files.reduce(
    (acc, f) =>
      acc +
      (f.isImage && f.analysis ? f.analysis.length + f.name.length + 40 : 0),
    0,
  );

  // Los mismos topes que aplica `buildTurnPayload` al enviar. Antes se sumaban
  // TODOS los mensajes de TODOS los capítulos, así que en una campaña larga la
  // barra daba un susto que no se correspondía con nada: del historial solo viaja
  // el tramo reciente del capítulo actual más una cola de los anteriores.
  const PREVIO_MAX = 8000;
  const ESCENA_MAX = 40000;
  const largoDe = (c: Chat) =>
    (c.messages || []).reduce((acc, m) => acc + (m.content?.length || 0), 0);

  const capituloActual =
    chats.find((c) => c.id === currentChatId) || chats[chats.length - 1];
  const escenaChars = capituloActual
    ? Math.min(ESCENA_MAX, largoDe(capituloActual))
    : 0;
  const previosChars = Math.min(
    PREVIO_MAX,
    chats
      .filter((c) => c.id !== capituloActual?.id)
      .reduce((acc, c) => acc + largoDe(c), 0),
  );
  const chatsChars = escenaChars + previosChars;

  // Los fragmentos rescatados sí viajan, así que tienen que contar. Cuánto exacto
  // depende de la escena y no se sabe hasta el turno; se pone el techo, que es lo
  // honesto: la barra debe pecar de prudente, no de optimista.
  const rescateChars = busqueda && deConsulta.length ? 6000 : 0;

  const totalChars =
    instructionsChars +
    memoryChars +
    filesChars +
    visualChars +
    chatsChars +
    rescateChars;

  // Un número como 127.694 no dice nada de un vistazo; 128 mil sí.
  const compact = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`
      : n >= 1000
        ? `${Math.round(n / 1000).toLocaleString("es-ES")} mil`
        : n.toLocaleString("es-ES");

  // Conversión aproximada para prosa de rol en español: ~3,8 caracteres por token
  const estimatedTokens = Math.round(totalChars / 3.8);
  const MAX_TOKENS = 1048576;

  // Si se ha medido de verdad contra la API, manda esa cifra; si no, la estimación.
  const tokensMostrados = medida ? medida.total : estimatedTokens;
  const percentage = Math.min(100, (tokensMostrados / MAX_TOKENS) * 100);

  return (
    <>
      <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--glass)]">
        <div className="flex justify-between items-center text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1.5">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Capacidad del Tomo
          </span>
          <button
            onClick={() => setIsGuideOpen(true)}
            className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
            title="Ver desglose y guía de optimización de memoria"
          >
            <Info className="w-3 h-3" /> {percentage.toFixed(1)}%
          </button>
        </div>

        {/* Progress Bar */}
        <div
          onClick={() => setIsGuideOpen(true)}
          className="w-full bg-[var(--glass-border)] rounded-full h-2 overflow-hidden cursor-pointer group"
          title="Haz clic para ver la guía de memoria y tokens"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentage > 85
                ? "bg-red-600"
                : percentage > 50
                  ? "bg-amber-600"
                  : "bg-[var(--accent)]"
            } group-hover:brightness-110`}
            style={{ width: `${Math.max(2, percentage)}%` }}
          />
        </div>

        {/* Tokens & Chars Counter */}
        <div className="flex justify-between items-center text-[10px] text-[var(--text-secondary)] mt-1.5 font-cinzel">
          <span>
            {medida ? "" : "~"}
            {compact(tokensMostrados)} tokens
          </span>
          <span>
            {medida
              ? `medido · ${medida.modelo}`
              : `${compact(totalChars)} car.`}
          </span>
        </div>
      </div>

      {/* Guide & Breakdown Modal */}
      {isGuideOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[150] p-4 font-lora animate-[fadeIn_0.2s_ease]">
            <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[var(--text-primary)]">
              {/* Header */}
              <div className="p-4 md:p-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--sidebar-bg)]">
                <div className="flex items-center gap-2.5">
                  <Brain className="w-4 h-4" />
                  <div>
                    <h3 className="font-cinzel text-lg md:text-xl text-[var(--accent)] font-bold m-0">
                      Memoria y Capacidad del Tomo
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                      Gestión de contexto, consumo de tokens y optimización de
                      archivos
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGuideOpen(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--accent)] text-xl font-bold p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />{" "}
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-6 text-sm leading-relaxed">
                {/* Live Breakdown Box */}
                <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] rounded-lg p-4 shadow-xs">
                  <h4 className="font-cinzel font-bold text-sm text-[var(--accent)] mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <ChartColumn className="w-3.5 h-3.5" />
                      En qué se va el contexto
                    </span>
                    <span className="text-xs bg-[var(--accent)] text-[var(--on-accent)] px-2 py-0.5 rounded-full font-sans">
                      {percentage < 0.1
                        ? "<0,1"
                        : percentage.toFixed(1).replace(".", ",")}
                      % de la ventana
                    </span>
                  </h4>

                  <p className="text-[11px] text-[var(--text-secondary)] m-0 mb-3">
                    Reparto de los {compact(totalChars)} caracteres que se
                    envían en cada turno. Del historial solo viaja el tramo
                    reciente: lo viejo ya está resumido en la Memoria Viva.
                  </p>

                  <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
                    {[
                      {
                        label: "Directivas",
                        chars: instructionsChars,
                        Icon: Scroll,
                      },
                      {
                        label: "Memoria viva",
                        chars: memoryChars,
                        Icon: Brain,
                      },
                      {
                        label: "Archivos que viajan enteros",
                        chars: filesChars,
                        Icon: Paperclip,
                        extra:
                          mediaCount > 0
                            ? `${mediaCount} imágenes o audios aparte`
                            : undefined,
                      },
                      {
                        label: "Análisis de imágenes y mapas",
                        chars: visualChars,
                        Icon: Image,
                        extra: undefined,
                      },
                      {
                        label: "Capítulos (solo el tramo reciente)",
                        chars: chatsChars,
                        Icon: MessageSquare,
                        extra: undefined,
                      },
                      {
                        label: "Fragmentos rescatados de los de consulta",
                        chars: rescateChars,
                        Icon: Search,
                        extra: rescateChars
                          ? "como mucho; lo normal es bastante menos"
                          : undefined,
                      },
                    ].map(({ label, chars, Icon, extra }) => {
                      const share =
                        totalChars > 0 ? (chars / totalChars) * 100 : 0;
                      return (
                        <li key={label} className="flex flex-col gap-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-[var(--text-primary)] min-w-0">
                              <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                              <span className="truncate">{label}</span>
                            </span>
                            <span className="text-[var(--text-secondary)] tabular-nums shrink-0">
                              {compact(chars)} ·{" "}
                              {share < 1 && chars > 0
                                ? "<1"
                                : Math.round(share)}
                              %
                            </span>
                          </div>
                          <div className="h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent)]/55 rounded-full"
                              style={{
                                width: `${Math.max(share, chars > 0 ? 1.5 : 0)}%`,
                              }}
                            />
                          </div>
                          {extra && (
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              {extra}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {deConsulta.length > 0 && (
                    <div className="mt-3 rounded-lg border border-dashed border-[var(--user-border)] bg-[var(--surface-soft)] p-2.5 text-[11px] text-[var(--text-secondary)]">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-cinzel font-bold text-[var(--text-primary)]">
                          {deConsulta.length} de consulta ·{" "}
                          {busqueda ? "se buscan" : "solo se anuncian"}
                        </span>
                        <span className="tabular-nums">
                          {compact(deConsultaChars)} car. ·{" "}
                          {busqueda ? (
                            <strong className="text-emerald-700">
                              viajan solo los fragmentos que hagan falta
                            </strong>
                          ) : (
                            <strong>no viaja nada de ellos</strong>
                          )}
                        </span>
                      </div>
                      <div
                        className="mt-1 truncate"
                        title={deConsulta.map((f) => f.name).join(", ")}
                      >
                        {deConsulta.map((f) => f.name).join(" · ")}
                      </div>

                      <label className="mt-2 flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={busqueda}
                          onChange={(e) => {
                            setStoredBusquedaLocal(e.target.checked);
                            setBusqueda(e.target.checked);
                          }}
                          className="mt-0.5 accent-[var(--accent)]"
                        />
                        <span>
                          <strong className="text-[var(--text-primary)]">
                            Buscar en ellos cada turno.
                          </strong>{" "}
                          Rescata hasta 6 mil caracteres de lo que venga a
                          cuento de la escena. La búsqueda corre en tu navegador
                          y no gasta ninguna petición, pero esos fragmentos sí
                          suman tokens. Con esto apagado el Narrador solo sabe
                          que los archivos existen y tendrá que pedirte los
                          datos.
                          <br />
                          Los turnos con y sin búsqueda se apuntan por separado
                          en el botón Motor, para que compares el gasto real en
                          vez de fiarte de la impresión.
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-[var(--glass-border)] flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span>
                      Ventana del modelo: {compact(MAX_TOKENS)} de tokens
                    </span>
                    <span>
                      Te quedan{" "}
                      <strong className="text-[var(--accent)]">
                        {compact(MAX_TOKENS - tokensMostrados)}
                      </strong>
                    </span>
                  </div>

                  {/* Medida real contra la API */}
                  <div className="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        Lo de arriba es una estimación por caracteres. Google
                        cuenta por tokens, y no salen los mismos números.
                      </span>
                      <button
                        onClick={medirDeVerdad}
                        disabled={midiendo || !currentChatId}
                        className="shrink-0 flex items-center gap-1.5 rounded bg-[var(--accent)] px-3 py-1.5 font-cinzel text-[11px] font-bold text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 cursor-pointer"
                        title="Pregunta a Google cuántos tokens ocupa exactamente el turno. No gasta cuota de generación."
                      >
                        {midiendo ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Gauge className="w-3.5 h-3.5" />
                        )}
                        {midiendo ? "Midiendo…" : "Medir de verdad"}
                      </button>
                    </div>

                    {errorMedida && (
                      <p className="text-[11px] text-red-500 m-0">
                        {errorMedida}
                      </p>
                    )}

                    {medida && (
                      <div className="rounded-lg bg-[var(--surface-soft)] border border-[var(--user-border)] p-3 text-xs space-y-1">
                        <div className="flex justify-between gap-3">
                          <span className="font-bold text-[var(--text-primary)]">
                            Medido en {medida.modelo}
                          </span>
                          <span className="tabular-nums font-bold text-[var(--accent)]">
                            {medida.total.toLocaleString("es-ES")} tokens
                          </span>
                        </div>
                        <div className="flex justify-between gap-3 text-[var(--text-secondary)]">
                          <span>Directivas, ficha, documentos y memoria</span>
                          <span className="tabular-nums">
                            {medida.sistema.toLocaleString("es-ES")}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3 text-[var(--text-secondary)]">
                          <span>Escena en curso</span>
                          <span className="tabular-nums">
                            {medida.conversacion.toLocaleString("es-ES")}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] m-0 pt-1">
                          Este es el número que también verías en Google AI
                          Studio con el mismo material.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cómo se gestiona la memoria */}
                <div className="space-y-2">
                  <h4 className="font-cinzel font-bold text-base text-[var(--accent)] flex items-center gap-2">
                    <Landmark className="w-4 h-4 shrink-0" /> Cómo recuerda la
                    campaña
                  </h4>
                  <p className="text-xs md:text-sm text-[var(--text-primary)] m-0">
                    Todo lo que ves arriba viaja al modelo en cada turno. Se
                    organiza en tres capas para que la partida no pierda el hilo
                    tras cientos de mensajes:
                  </p>
                  <ul className="list-disc pl-5 text-xs md:text-sm space-y-1.5 text-[var(--text-secondary)]">
                    <li>
                      <strong className="text-[var(--text-primary)]">
                        Base de conocimiento.
                      </strong>{" "}
                      Tus documentos, íntegros. Al ser lo que menos cambia, van
                      al principio del mensaje, donde Google puede reutilizarlos
                      entre turnos en vez de reprocesarlos.
                    </li>
                    <li>
                      <strong className="text-[var(--text-primary)]">
                        Memoria viva.
                      </strong>{" "}
                      PNJs, lugares, tramas y estado actual. Se guarda en tu
                      navegador y se inyecta en cada escena, junto al final del
                      mensaje, que es donde el modelo más atención presta.
                    </li>
                    <li>
                      <strong className="text-[var(--text-primary)]">
                        Sincronización.
                      </strong>{" "}
                      Al pulsar <em>Sincronizar con IA</em> en Memoria, se
                      releen los capítulos y se actualizan esas fichas. Cuanto
                      más al día esté la memoria, menos historial hace falta
                      arrastrar.
                    </li>
                  </ul>
                </div>

                {/* File Optimization Guide */}
                <div className="space-y-3">
                  <h4 className="font-cinzel font-bold text-base text-[var(--accent)] flex items-center gap-2">
                    <Image className="w-4 h-4 shrink-0" /> ¿Subirlo como imagen
                    o como texto?
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Image Card */}
                    <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-3.5 rounded-lg">
                      <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5 mb-1.5">
                        <Map className="w-3.5 h-3.5" /> Archivos Ideales como
                        IMAGEN
                      </div>
                      <ul className="text-xs space-y-1.5 text-[var(--text-secondary)]">
                        <li>
                          <strong>Mapas y Planos tácticos:</strong> Se procesan
                          con visión artificial de Gemini para extraer
                          geografía, rutas y zonas, permitiendo además añadir{" "}
                          <em>Marcadores interactivos</em>.
                        </li>
                        <li>
                          <strong>Retratos de Personajes / Criaturas:</strong>{" "}
                          Excelentes para asignar en la ficha del PNJ en{" "}
                          <em>Memoria</em> y asociarles notas visuales y de
                          actitud.
                        </li>
                        <li className="text-[11px] italic text-[var(--accent)]">
                          * Las imágenes consumen cuota de tokens visuales fijos
                          (~258 tokens por imagen) sin sobrecargar el texto.
                        </li>
                      </ul>
                    </div>

                    {/* Text Card */}
                    <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-3.5 rounded-lg">
                      <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5 mb-1.5">
                        <Scroll className="w-3.5 h-3.5" /> Archivos Ideales como
                        TEXTO / PDF
                      </div>
                      <ul className="text-xs space-y-1.5 text-[var(--text-secondary)]">
                        <li>
                          <strong>Novelas y Lore Canónico:</strong> Ideales en
                          .txt, .md o PDF para que el modelo cite eventos,
                          diálogos y cronología con fidelidad milimétrica.
                        </li>
                        <li>
                          <strong>Módulos y aventuras:</strong> Permite al
                          Narrador extraer encuentros, acertijos, tesoros y
                          estadísticas de forma instantánea.
                        </li>
                        <li className="text-[11px] italic text-[var(--accent)]">
                          * Puedes usar el botón{" "}
                          <em>«Extraer Estilo/Sistema»</em> en cualquier texto
                          para adaptar el tono del narrador.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[var(--glass-border)] bg-[var(--sidebar-bg)] flex justify-end">
                <button
                  onClick={() => setIsGuideOpen(false)}
                  className="bg-[var(--accent)] text-[var(--on-accent)] px-5 py-2 rounded-lg font-cinzel text-xs font-bold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
