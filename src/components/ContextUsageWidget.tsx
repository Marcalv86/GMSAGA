import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Project, ProjectFile, Chat } from '../types';
import {
  AVISO_TOKENS_POR_MINUTO,
  TOPE_TOKENS_POR_MINUTO,
  countTurnTokens,
  describeApiError,
  getStoredBusquedaLocal,
  estimarCargaDelTurno,
  getStoredApiKeys,
  getStoredModel,
  setStoredBusquedaLocal,
  PRESUPUESTO_FRAGMENTOS_CONSULTA,
  setStoredUsePaidTierOnly,
  getStoredAutoBackgroundTasks,
  setStoredAutoBackgroundTasks,
  techoDeEnvio
} from '../utils/geminiHelper';
import { peticionesDeHoy } from '../utils/usageStats';
import { presionDelMinuto, ultimoCacheMedido, getLlamadas, suscribirseALlamadas } from '../utils/callLog';
import {
  formatearCosteUSD,
  formatearSaldoUSD,
  getEstadisticasDeGasto,
  setStoredInitialBalance
} from '../utils/pricing';

import {
  BookOpen,
  Brain,
  ChartColumn,
  CreditCard,
  DollarSign,
  Edit3,
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
  Sparkles,
  X,
  Zap
} from 'lucide-react';
export const ContextUsageWidget: React.FC<{
  project: Project | null;
  files: ProjectFile[];
  chats: Chat[];
  currentChatId?: string | null;
  /** Tokens de entrada medidos por Google en el último turno, si los hay. */
  tokensMedidos?: number;
}> = ({ project, files, chats, currentChatId, tokensMedidos }) => {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [medida, setMedida] = useState<{
    total: number;
    sistema: number;
    conversacion: number;
    modelo: string;
  } | null>(null);
  const [midiendo, setMidiendo] = useState(false);
  const [errorMedida, setErrorMedida] = useState('');
  const [busqueda, setBusqueda] = useState(() => getStoredBusquedaLocal());
  const [llamadas, setLlamadas] = useState(() => getLlamadas());
  const [editandoSaldoModal, setEditandoSaldoModal] = useState(false);
  const [inputSaldoModal, setInputSaldoModal] = useState('');

  const [balanceVersion, setBalanceVersion] = useState(0);

  /*
   * La ventana del minuto se vacía sola, y la pantalla tiene que enterarse.
   *
   * Lo gastado hace 61 segundos deja de contar, pero sin un latido que fuerce
   * el repintado la barra se quedaba clavada en rojo hasta que algo más la
   * tocara. Una barra que no baja cuando la cuota SÍ baja enseña a ignorarla.
   */
  const [, setLatido] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLatido(v => v + 1), 5000);
    const onSettingsChange = () => {
      setLatido(v => v + 1);
      setBalanceVersion(v => v + 1);
    };
    const unsubLlamadas = suscribirseALlamadas(l => setLlamadas([...l]));
    window.addEventListener('storage', onSettingsChange);
    window.addEventListener('gemini_paid_tier_changed', onSettingsChange);
    window.addEventListener('gemini_settings_changed', onSettingsChange);
    window.addEventListener('gm_balance_changed', onSettingsChange);
    return () => {
      clearInterval(id);
      unsubLlamadas();
      window.removeEventListener('storage', onSettingsChange);
      window.removeEventListener('gemini_paid_tier_changed', onSettingsChange);
      window.removeEventListener('gemini_settings_changed', onSettingsChange);
      window.removeEventListener('gm_balance_changed', onSettingsChange);
    };
  }, []);

  const statsCoste = useMemo(() => getEstadisticasDeGasto(llamadas), [llamadas, balanceVersion]);

  const guardarSaldoModal = () => {
    const limpio = inputSaldoModal.trim().replace(',', '.');
    if (limpio === '') {
      setStoredInitialBalance(null);
    } else {
      const num = parseFloat(limpio);
      if (Number.isFinite(num) && num >= 0) {
        setStoredInitialBalance(num);
      }
    }
    setEditandoSaldoModal(false);
    setInputSaldoModal('');
    setBalanceVersion(v => v + 1);
  };

  const medirDeVerdad = async () => {
    if (!project || !currentChatId) return;
    setMidiendo(true);
    setErrorMedida('');
    try {
      setMedida(await countTurnTokens({ project, currentChatId, chats, files }));
    } catch (err) {
      setErrorMedida(describeApiError(err));
    } finally {
      setMidiendo(false);
    }
  };

  if (!project) return null;

  /*
   * El peso del turno sale de `estimarCargaDelTurno`, el mismo cálculo que usa
   * el aviso del chat. Estaban duplicados y con criterios distintos, así que
   * enseñaban cifras diferentes de lo mismo: una decía 165 mil y la otra 204
   * mil, y no había manera de saber cuál era la buena.
   */
  const carga = estimarCargaDelTurno({ project, chats, currentChatId, files });

  const instructionsChars = carga.directivas;
  const memoryChars = carga.memoria;
  // El total ya no es la suma de estas filas: sale de medir el envío real.

  const filesChars = carga.archivos;
  const deConsultaChars = carga.archivosDeConsulta;
  const mediaCount = carga.medios;
  const chatsChars = carga.capituloActual + carga.capitulosPrevios;
  const rescateChars = carga.fragmentosRescatados;
  const totalChars = carga.total;
  const ventanaHistorial = carga.ventanaHistorial;
  const mensajesRecortados = carga.mensajesRecortados;
  // La lista de verdad, que abajo se enumera por nombre.
  const esTexto = (f: ProjectFile) => !f.isImage && !f.isAudio && f.category !== 'style_sample';
  const deConsulta = files.filter(
    f =>
      esTexto(f) &&
      f.onDemand &&
      f.category !== 'oracle' &&
      f.category !== 'roster' &&
      f.category !== 'index'
  );

  // Un número como 127.694 no dice nada de un vistazo; 128 mil sí.
  const compact = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`
      : n >= 1000
        ? `${Math.round(n / 1000).toLocaleString('es-ES')} mil`
        : n.toLocaleString('es-ES');

  const estimatedTokens = carga.tokens;

  /*
   * El caché, medido en vez de supuesto.
   *
   * Lo que se enseñaba antes no era una medida: era «tus archivos pesan
   * mucho, así que estarán cacheados». Se encendía igual con el prefijo roto
   * y cero tokens servidos de caché. Ahora sale del `cachedContentTokenCount`
   * del último turno narrado, que es el único sitio donde eso consta, y si
   * todavía no hay ningún turno medido no se enseña nada, en lugar de afirmar
   * lo que no se sabe.
   */
  const cacheMedido = ultimoCacheMedido();

  /*
   * CONTRA QUÉ SE MIDE ESTA BARRA.
   *
   * Estaba fijada en 1.048.576 tokens, la ventana del modelo más grande, y de
   * ahí venía el susto: con un tomo de doscientos sesenta mil tokens la barra
   * decía «25%», todo en orden, mientras Google devolvía un 429 en cada turno.
   * Porque el que corta no es el tamaño de la ventana, es la CUOTA POR MINUTO
   * de la capa gratuita, que está en 250.000 tokens de entrada. Un tomo que
   * pesa más que eso falla en el primer turno y con una clave recién sacada:
   * no se ha «gastado» nada, sencillamente no cabe.
   *
   * Así que se mide contra el menor de los dos topes —el que de verdad va a
   * saltar— y la ventana real del modelo se pregunta al catálogo de Google en
   * lugar de darla por hecha, que con Gemma es menos de la cuarta parte.
   */
  const modeloDeNarracion = medida?.modelo || getStoredModel();
  const { limite: MAX_TOKENS, ventana, medido: limiteMedido, mandaLaCuota, cuota, esPayAsYouGo } =
    techoDeEnvio(modeloDeNarracion);

  /*
   * EL CUPO DIARIO, QUE ES EL QUE DECIDE CUÁNTO SE PUEDE JUGAR.
   *
   * Los Flash de la familia 3.x dan veinte peticiones al día por clave en la
   * capa gratuita. Veinte. Y cuando se acaban, Google devuelve el mismo error
   * 429 que cuando te pasas de tokens por minuto, sin nada que distinga un caso
   * del otro: se busca el problema en el tamaño del envío y no está ahí.
   *
   * En modo Pay-as-you-go no hay límite diario de peticiones.
   */
  const numeroDeClaves = esPayAsYouGo ? 1 : Math.max(1, getStoredApiKeys().length);
  const cupoDiario = esPayAsYouGo ? 1000000 : cuota.rpd * numeroDeClaves;
  const peticionesHoy = peticionesDeHoy(modeloDeNarracion);
  const cupoApurado = !esPayAsYouGo && peticionesHoy >= cupoDiario * 0.8;

  /*
   * EL VEREDICTO, QUE ERA LO ÚNICO QUE FALTABA.
   *
   * Esta ventana enseñaba siete filas con barras, dos límites que se parecen y
   * tres bloques de explicación, y de todo eso había que deducir lo único que
   * se viene a preguntar: ¿voy bien o no, y si no, qué quito? Datos había de
   * sobra; respuesta no había ninguna, y con un montón de datos delante la
   * sensación es de complicación, no de control.
   *
   * Esto no calcula nada nuevo: solo lee lo que ya estaba y lo dice en una
   * frase, nombrando además la pieza más gorda de las que SÍ se pueden tocar
   * —los protocolos y la ficha no se quitan, así que señalarlos no ayuda—.
   */
  const loQueSePuedeTocar = [
    { nombre: 'los archivos que viajan enteros', chars: filesChars, donde: 'En Archivos, pasa a «consulta» los que no hagan falta en cada escena.' },
    { nombre: 'el capítulo en curso', chars: chatsChars, donde: 'En Motor → Rendimiento puedes fijar una «Ventana de Historial», o cerrar el capítulo y abrir otro.' },
    { nombre: 'tus directivas del Narrador', chars: instructionsChars, donde: 'En Directivas, recorta lo que ya no uses.' },
    { nombre: 'la memoria general', chars: memoryChars, donde: 'En Memoria del Proyecto, resume lo que se haya quedado viejo.' }
  ].sort((a, b) => b.chars - a.chars)[0];

  /*
   * Manda lo medido de verdad, en este orden: la medición manual del botón «medir
   * de verdad», luego los tokens de entrada que Google devolvió en el último
   * turno, y solo si no hay ninguna de las dos, la estimación por caracteres.
   * Lo importante es que esta barra y la del chat partan del mismo dato.
   */
  const medidaDelTurno = medida?.total || tokensMedidos || 0;
  const tokensMostrados = medidaDelTurno > 0 ? medidaDelTurno : estimatedTokens;
  const esEstimacion = medidaDelTurno === 0;

  /*
   * LA BARRA MIDE LO QUE DE VERDAD PROVOCA EL 429.
   *
   * Antes comparaba el tamaño de UN turno contra las 250.000 fichas por
   * minuto, y eso no es el límite de Google: el límite es una ventana móvil de
   * sesenta segundos sobre todo lo que se le pide. Tres turnos seguidos de
   * 90.000 fichas salían al 36% cada uno —verde, todo en orden— y el tercero
   * se comía el 429, porque entre los tres sumaban 270.000 en menos de un
   * minuto. La barra decía que sobraba sitio justo cuando no lo había.
   *
   * Ahora enseña dónde va a quedar la cuota DESPUÉS de mandar este turno: lo
   * ya gastado en el último minuto más lo que se va a enviar. Y se mide sobre
   * la clave más descargada, porque la aplicación rota al saturarse y el envío
   * acaba ahí; con varias claves solo se bloquea de verdad cuando no queda
   * ninguna con sitio.
   *
   * El tamaño del turno no se pierde: sigue escrito debajo en fichas. Lo que
   * cambia es qué mide la barra, que era lo que engañaba.
   */
  const presion = presionDelMinuto(modeloDeNarracion, numeroDeClaves);
  const proyectado = (esPayAsYouGo ? 0 : presion.menor) + tokensMostrados;
  const topeMinutoReal = esPayAsYouGo ? MAX_TOKENS : TOPE_TOKENS_POR_MINUTO;
  const avisoMinutoReal = esPayAsYouGo ? Math.round(MAX_TOKENS * 0.85) : AVISO_TOKENS_POR_MINUTO;
  const percentage = Math.min(100, (proyectado / MAX_TOKENS) * 100);
  const pasadaDeCuota = proyectado >= topeMinutoReal;
  const cercaDeCuota = !pasadaDeCuota && proyectado >= avisoMinutoReal;
  /** Cuántas claves admitirían este envío ahora mismo sin pasarse del minuto. */
  const clavesConSitio = esPayAsYouGo ? 1 : presion.porClave.filter(c => c + tokensMostrados < MAX_TOKENS).length;

  const percentColor =
    percentage > 85
      ? 'text-red-700 dark:text-red-400 font-bold'
      : percentage > 70
      ? 'text-amber-700 dark:text-amber-400 font-bold'
      : 'text-emerald-700 dark:text-emerald-400 font-semibold';

  const barColor =
    percentage > 85
      ? 'bg-red-600'
      : percentage > 70
      ? 'bg-amber-600'
      : 'bg-emerald-600 dark:bg-emerald-500';

  return (
    <>
      <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--glass)]">
        <div className="flex justify-between items-center text-xs font-cinzel font-bold text-[var(--text-secondary)] mb-1.5">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Capacidad del Tomo
            {esPayAsYouGo ? (
              <span
                onClick={() => setIsGuideOpen(true)}
                className="text-[9px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 rounded px-1.5 py-0.5 font-sans font-semibold cursor-pointer hover:bg-emerald-500/30 transition-colors"
                title="Modo Saldo / Pay-as-you-go activo (Google Cloud). Capacidad ampliada a 4M TPM sin corte por minuto de 250k. Clic para detalles."
              >
                💳 Pay-as-you-go
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStoredUsePaidTierOnly(true);
                  setLatido(v => v + 1);
                }}
                className="text-[9px] bg-stone-500/10 text-stone-600 dark:text-stone-400 hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300 border border-[var(--glass-border)] rounded px-1.5 py-0.5 font-sans cursor-pointer transition-colors"
                title="¿Tienes saldo o cuenta con crédito de Google Cloud? Haz clic aquí para activar el modo Pay-as-you-go y eliminar el límite por minuto de 250k."
              >
                ¿Tienes saldo? Activar Pay-as-you-go
              </button>
            )}
          </span>
          <button
            onClick={() => setIsGuideOpen(true)}
            className={`text-[11px] hover:underline flex items-center gap-1 cursor-pointer ${percentColor}`}
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
            className={`h-full rounded-full transition-all duration-500 ${barColor} group-hover:brightness-110`}
            style={{ width: `${Math.max(2, percentage)}%` }}
          />
        </div>

        {/* Tokens & Chars Counter */}
        <div className="flex justify-between items-center text-[10px] text-[var(--text-secondary)] mt-1.5 font-cinzel">
          <span className="flex items-center gap-1.5">
            <span>
              {esEstimacion ? '~' : ''}
              {compact(tokensMostrados)} / {compact(MAX_TOKENS)} tokens
            </span>
            {/*
              Lo gastado en el minuto, que es la otra mitad de la barra en la capa gratuita.
              En Pay-as-you-go, el límite oficial es de 4.000.000 TPM sin filtro de 250k.
            */}
            {esPayAsYouGo ? (
              <span
                className="text-amber-800 dark:text-amber-300 font-sans text-[9px]"
                title="Clave con saldo de Google Cloud (Pay-as-you-go): cuota ampliada a 4.000.000 TPM sin el cuello de botella de 250.000."
              >
                · 4M TPM
              </span>
            ) : (
              presion.menor > 0 && (
                <span
                  className="text-[var(--text-secondary)]"
                  title={`En los últimos 60 s ya se han gastado ${presion.menor.toLocaleString('es-ES')} fichas en la clave más libre (${presion.llamadas} llamadas a ${modeloDeNarracion}). Esta barra suma eso al turno que vas a enviar, porque el límite de Google es por minuto, no por envío. Se vacía solo conforme pasa el minuto.`}
                >
                  · +{compact(presion.menor)} del minuto
                </span>
              )
            )}
            {!esPayAsYouGo && numeroDeClaves > 1 && clavesConSitio < numeroDeClaves && (
              <span
                className={`font-bold ${clavesConSitio === 0 ? 'text-red-700 dark:text-red-400' : 'text-amber-800 dark:text-amber-300'}`}
                title={
                  clavesConSitio === 0
                    ? 'Ninguna de tus claves tiene sitio para este envío en el minuto que corre. El turno va a dar 429 en todas y la aplicación se quedará esperando. Deja pasar un minuto.'
                    : `Solo ${clavesConSitio} de tus ${numeroDeClaves} claves admiten este envío ahora mismo. La aplicación rotará hasta encontrar una con sitio, pero cada 429 por el camino cuesta tiempo.`
                }
              >
                🔑 {clavesConSitio}/{numeroDeClaves}
              </span>
            )}
            {cacheMedido && cacheMedido.porcentaje > 0 && (
              <span
                className="text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 px-1 py-0.5 rounded text-[9px] font-sans"
                title={`En el último turno narrado, Google sirvió de caché ${cacheMedido.fichas.toLocaleString('es-ES')} fichas (${cacheMedido.porcentaje}% de la entrada) en ${cacheMedido.modelo}. Eso abarata el turno, pero OJO: las fichas servidas de caché cuentan enteras para el límite por minuto, así que esta barra no las descuenta.`}
              >
                ⚡ {cacheMedido.porcentaje}% de caché
              </span>
            )}
          </span>
          <span>{esEstimacion ? `${compact(totalChars)} car.` : `medido · ${modeloDeNarracion}`}</span>
        </div>

        {/*
          El aviso que faltaba. Que la barra se ponga roja no basta si no dice
          POR QUÉ: el 429 de Google se lee como «has gastado tu cuota» y lleva a
          buscar el problema en la clave, cuando el problema es el tamaño de lo
          que se manda en cada turno.
        */}
        {cupoApurado && (
          <div
            onClick={() => setIsGuideOpen(true)}
            className={`mt-2 rounded-lg border px-2.5 py-2 text-[10px] leading-snug cursor-pointer ${
              peticionesHoy >= cupoDiario
                ? 'border-red-700/60 bg-red-600/15 text-red-950 dark:text-red-200'
                : 'border-amber-700/60 bg-amber-500/20 text-amber-950 dark:text-amber-100'
            }`}
          >
            <strong>
              {peticionesHoy >= cupoDiario ? 'Cupo del día agotado' : 'Cupo del día casi agotado'}
            </strong>{' '}
            — {peticionesHoy} de {cupoDiario} peticiones con {modeloDeNarracion}
            {numeroDeClaves > 1 ? ` (${cuota.rpd} × ${numeroDeClaves} claves)` : ''}. Si te da 429 no es
            por el tamaño del envío: es que se acabaron los turnos de hoy con este modelo. Flash Lite
            tiene un cupo mucho mayor.
          </div>
        )}

        {(pasadaDeCuota || cercaDeCuota) && (
          <div
            onClick={() => setIsGuideOpen(true)}
            className={`mt-2 rounded-lg border px-2.5 py-2 text-[10px] leading-snug cursor-pointer ${
              pasadaDeCuota
                ? 'border-red-700/60 bg-red-600/15 text-red-950 dark:text-red-200'
                : 'border-amber-700/60 bg-amber-500/20 text-amber-950 dark:text-amber-100'
            }`}
          >
            {pasadaDeCuota ? (
              <>
                <strong>{esPayAsYouGo ? 'Supera la ventana del modelo.' : 'Cada turno superará la cuota por minuto.'}</strong> Este tomo manda{' '}
                {compact(tokensMostrados)} tokens y el límite es{' '}
                {compact(topeMinutoReal)}. {esPayAsYouGo ? 'El envío supera la ventana máxima del modelo.' : 'La capa gratuita corta en 250.000 por minuto.'}
              </>
            ) : (
              <>
                <strong>{esPayAsYouGo ? 'Cerca del límite de ventana del modelo.' : 'Cerca de la cuota por minuto.'}</strong> Vas por {compact(tokensMostrados)} de
                los {compact(topeMinutoReal)} tokens {esPayAsYouGo ? 'de la ventana del modelo (Pay-as-you-go)' : 'por minuto de la capa gratuita'}.
              </>
            )}
          </div>
        )}
        {/* Widget de Saldo & Coste de API en la barra lateral */}
        <div
          onClick={() => setIsGuideOpen(true)}
          className="mt-2.5 p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition-all cursor-pointer group flex flex-col gap-1.5"
          title="Haz clic para abrir la contabilidad de saldo, costes por turno y ahorro por Context Caching"
        >
          <div className="flex items-center justify-between gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-cinzel font-bold text-amber-900 dark:text-amber-200">
              <CreditCard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {statsCoste.saldoRestante !== null ? (
                  <>
                    Saldo:{' '}
                    <strong className="font-mono text-emerald-800 dark:text-emerald-300 font-bold">
                      {formatearSaldoUSD(statsCoste.saldoRestante)}
                    </strong>
                  </>
                ) : (
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 underline underline-offset-2">
                    Configurar Saldo
                  </span>
                )}
              </span>
            </div>
            {statsCoste.ultimoTurnoCoste !== null && (
              <span className="font-mono text-[10px] text-amber-800 dark:text-amber-300 font-semibold">
                Último: {formatearCosteUSD(statsCoste.ultimoTurnoCoste, true)}
              </span>
            )}
          </div>

          {/* Estado de Context Caching */}
          <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-secondary)] font-sans">
            <div className="flex items-center gap-1">
              {statsCoste.ultimoTurnoPctCache > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-bold">
                  <Zap className="w-3 h-3 text-emerald-500" />
                  <span>Caché activo ({statsCoste.ultimoTurnoPctCache}% descuento)</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-0.5 text-sky-700 dark:text-sky-300 font-semibold"
                  title="El primer turno o tras cambios de archivos es un arranque frío que crea el caché. Los siguientes turnos tendrán hasta un 75% de descuento."
                >
                  <span>❄️ Caché frío (1er turno)</span>
                </span>
              )}
            </div>
            {statsCoste.ahorroTotalCache > 0 && (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[9px]">
                +{formatearCosteUSD(statsCoste.ahorroTotalCache)} ahorrados
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Guide & Breakdown Modal */}
      {isGuideOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[150] p-2 sm:p-4 font-lora animate-[fadeIn_0.2s_ease]">
            <div className="bg-[var(--bg-color)] border-2 border-[var(--accent)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[88dvh] sm:max-h-[90vh] flex flex-col overflow-hidden min-h-0 text-[var(--text-primary)]">
              {/* Header */}
              <div className="p-3.5 sm:p-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--sidebar-bg)] shrink-0">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <Brain className="w-4 h-4 shrink-0 text-[var(--accent)]" />
                  <div>
                    <h3 className="font-cinzel text-base sm:text-xl text-[var(--accent)] font-bold m-0">
                      Memoria, Saldo y Capacidad del Tomo
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                      Contabilidad de crédito API, context caching y consumo de tokens
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGuideOpen(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--accent)] text-xl font-bold p-1 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-3.5 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4 sm:space-y-5 text-sm leading-relaxed touch-pan-y">
                {/* Módulo de Contabilidad de Saldo & Costes de API */}
                <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-cinzel font-bold text-sm text-amber-900 dark:text-amber-200">
                      <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Contabilidad de Saldo y Costes de API</span>
                    </div>
                    {!editandoSaldoModal && (
                      <button
                        onClick={() => {
                          setInputSaldoModal(
                            statsCoste.saldoInicial !== null ? statsCoste.saldoInicial.toString() : ''
                          );
                          setEditandoSaldoModal(true);
                        }}
                        className="flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 font-cinzel px-2.5 py-1 rounded border border-amber-500/40 bg-[var(--surface)] hover:bg-amber-500/20 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{statsCoste.saldoInicial !== null ? 'Ajustar Saldo' : 'Fijar Saldo Inicial'}</span>
                      </button>
                    )}
                  </div>

                  {editandoSaldoModal ? (
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)]">
                      <span className="text-xs text-[var(--text-secondary)]">Saldo disponible en Google Cloud ($ USD):</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ej. 4.18"
                        value={inputSaldoModal}
                        onChange={e => setInputSaldoModal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') guardarSaldoModal();
                          if (e.key === 'Escape') setEditandoSaldoModal(false);
                        }}
                        className="w-28 px-2.5 py-1 text-xs font-mono rounded border border-[var(--user-border)] bg-[var(--bg-color)] text-[var(--text-primary)] focus:border-amber-500 focus:outline-hidden"
                        autoFocus
                      />
                      <button
                        onClick={guardarSaldoModal}
                        className="px-3 py-1 text-xs font-cinzel font-bold bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditandoSaldoModal(false)}
                        className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-2.5 py-2">
                        <div className="font-mono text-base font-bold text-amber-700 dark:text-amber-300">
                          {formatearSaldoUSD(statsCoste.saldoRestante)}
                        </div>
                        <div className="text-[10px] font-cinzel text-[var(--text-secondary)]">
                          Saldo Restante
                        </div>
                      </div>
                      <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-2.5 py-2">
                        <div className="font-mono text-base font-bold text-rose-700 dark:text-rose-400">
                          {formatearCosteUSD(statsCoste.gastoTotal)}
                        </div>
                        <div className="text-[10px] font-cinzel text-[var(--text-secondary)]">
                          Gasto Acumulado
                        </div>
                      </div>
                      <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-2.5 py-2">
                        <div className="font-mono text-base font-bold text-[var(--accent)]">
                          {statsCoste.ultimoTurnoCoste !== null ? formatearCosteUSD(statsCoste.ultimoTurnoCoste, true) : '—'}
                        </div>
                        <div className="text-[10px] font-cinzel text-[var(--text-secondary)]">
                          Último Turno
                        </div>
                      </div>
                      <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] px-2.5 py-2">
                        <div className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                          +{formatearCosteUSD(statsCoste.ahorroTotalCache)}
                        </div>
                        <div className="text-[10px] font-cinzel text-[var(--text-secondary)] flex items-center justify-center gap-0.5">
                          <span>Ahorro Caché</span>
                          <Zap className="w-2.5 h-2.5 text-emerald-500" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg bg-[var(--surface)] p-2.5 text-xs text-[var(--text-secondary)] space-y-1.5 border border-[var(--glass-border)]">
                    <div className="flex items-center gap-1.5 font-cinzel font-bold text-[var(--text-primary)]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>¿Por qué el 1er turno cuesta más que los siguientes? (Context Caching)</span>
                    </div>
                    <p className="m-0 text-[11px] leading-relaxed">
                      • <strong>Primer turno (Caché frío):</strong> Al iniciar la sesión o añadir documentos nuevos, Google procesa los textos completos para crear su caché interno. Con un tomo grande (~250k fichas) esto cuesta aproximadamente <strong>~$0.018</strong>.
                      <br />
                      • <strong>Siguientes turnos (Caché caliente):</strong> Google reutiliza el caché y <strong>aplica un 75% de descuento</strong> directo en todos los tokens cacheados. Cada turno posterior cuesta solo unos <strong>~$0.002 a $0.005</strong>.
                      <br />
                      • <strong>Tareas de fondo protegidas:</strong> Todas las tareas redundantes automáticas están deshabilitadas para que ninguna llamada invisible consuma tu saldo.
                    </p>
                  </div>
                </div>
                {/* Selector / Switch de Modo: Gratuito vs Pay-as-you-go (Google Cloud) */}
                <div
                  className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                    esPayAsYouGo
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-[var(--glass-border)] bg-[var(--surface-soft)]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-cinzel font-bold text-xs text-[var(--text-primary)]">
                        Modo Facturación / Saldo Google Cloud (Pay-as-you-go)
                      </span>
                      {esPayAsYouGo && (
                        <span className="text-[10px] font-sans px-1.5 py-0.2 rounded font-semibold bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30">
                          Activo · 4M TPM
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] m-0">
                      {esPayAsYouGo
                        ? 'Tu cuenta utiliza saldo de Google Cloud: cuota ampliada a 4M TPM y límite medido por la ventana completa del modelo sin corte de 250k.'
                        : 'Activa esta opción si tu clave tiene crédito de Google Cloud (Pay-as-you-go) para eliminar el corte de 250.000 tokens por minuto.'}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0 select-none bg-[var(--surface)] px-2.5 py-1.5 rounded-md border border-[var(--glass-border)] hover:border-emerald-500/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={esPayAsYouGo}
                      onChange={e => {
                        setStoredUsePaidTierOnly(e.target.checked);
                        setLatido(v => v + 1);
                      }}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                    <span className="text-xs font-semibold font-cinzel text-[var(--text-primary)]">
                      {esPayAsYouGo ? '🟢 Pay-as-you-go' : '⚪ Capa Gratuita'}
                    </span>
                  </label>
                </div>

                {/* Selector de Tareas en Segundo Plano / Modo Ahorro */}
                {(() => {
                  const autoBg = getStoredAutoBackgroundTasks();
                  return (
                    <div
                      className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                        autoBg
                          ? 'border-[var(--glass-border)] bg-[var(--surface-soft)]'
                          : 'border-amber-500/50 bg-amber-500/10'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-cinzel font-bold text-xs text-[var(--text-primary)]">
                            Tareas de IA en Segundo Plano
                          </span>
                          <span className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-semibold border ${
                            autoBg
                              ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/30 font-bold'
                          }`}>
                            {autoBg ? 'Activas' : 'Modo Ahorro Máximo (Desactivadas)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] m-0">
                          {autoBg
                            ? 'La IA ejecuta análisis de memoria y campaña en segundo plano. Si quieres proteger al 100% tu saldo, apágalo: la IA solo correrá al enviar un turno.'
                            : 'Modo ahorro activo: la IA NUNCA consume saldo en segundo plano. Solo procesa cuando tú envías un mensaje o pulsas un botón manual.'}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer shrink-0 select-none bg-[var(--surface)] px-2.5 py-1.5 rounded-md border border-[var(--glass-border)] hover:border-amber-500/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={autoBg}
                          onChange={e => {
                            setStoredAutoBackgroundTasks(e.target.checked);
                            setLatido(v => v + 1);
                          }}
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                        />
                        <span className="text-xs font-semibold font-cinzel text-[var(--text-primary)]">
                          {autoBg ? '🟢 Activas' : '🟠 Modo Ahorro'}
                        </span>
                      </label>
                    </div>
                  );
                })()}

                {/*
                  LA RESPUESTA PRIMERO. Debajo están los datos para quien los
                  quiera, pero lo que se viene a preguntar aquí cabe en dos
                  frases y antes no estaba escrito en ninguna parte.
                */}
                <div
                  className={`rounded-lg border-2 p-4 ${
                    pasadaDeCuota || (peticionesHoy >= cupoDiario && !esPayAsYouGo)
                      ? 'border-red-600/60 bg-red-600/10'
                      : cercaDeCuota || (cupoApurado && !esPayAsYouGo)
                      ? 'border-amber-600/60 bg-amber-500/10'
                      : 'border-emerald-600/50 bg-emerald-500/10'
                  }`}
                >
                  <div className="font-cinzel font-bold text-base mb-1">
                    {peticionesHoy >= cupoDiario && !esPayAsYouGo
                      ? '⛔ Se acabaron los turnos de hoy'
                      : pasadaDeCuota
                      ? '⛔ Cada turno se pasa de cuota'
                      : cercaDeCuota
                      ? '⚠️ Vas justa'
                      : cupoApurado && !esPayAsYouGo
                      ? '⚠️ Te quedan pocos turnos hoy'
                      : '✅ Vas holgada'}
                  </div>
                  <p className="text-[13px] m-0 leading-relaxed">
                    {peticionesHoy >= cupoDiario && !esPayAsYouGo ? (
                      <>
                        Llevas <strong>{peticionesHoy} de {cupoDiario}</strong> peticiones con {modeloDeNarracion}.
                        No es por el tamaño de lo que mandas: es que se agotó el cupo del día. Cambia de modelo,
                        activa el modo Pay-as-you-go si tienes saldo, o espera a mañana.
                      </>
                    ) : pasadaDeCuota ? (
                      <>
                        Cada turno manda <strong>{compact(tokensMostrados)} fichas</strong> y el límite{' '}
                        {esPayAsYouGo ? 'del modelo' : 'por minuto'} está en {compact(topeMinutoReal)}. Va a dar error:{' '}
                        {esPayAsYouGo
                          ? 'el contexto supera la ventana máxima del modelo.'
                          : 'la capa gratuita de Google corta en 250.000 tokens por minuto.'}{' '}
                        Lo que más ocupa de lo que puedes tocar es <strong>{loQueSePuedeTocar.nombre}</strong> ({compact(loQueSePuedeTocar.chars)}).{' '}
                        {loQueSePuedeTocar.donde}
                      </>
                    ) : cercaDeCuota ? (
                      <>
                        Vas por <strong>{compact(tokensMostrados)}</strong> de {compact(topeMinutoReal)} fichas{' '}
                        {esPayAsYouGo ? 'de la ventana del modelo' : 'por minuto'}. Aún cabe, pero un turno largo puede pasarse. Si quieres margen, lo más gordo
                        que puedes tocar es <strong>{loQueSePuedeTocar.nombre}</strong> ({compact(loQueSePuedeTocar.chars)}).{' '}
                        {loQueSePuedeTocar.donde}
                      </>
                    ) : cupoApurado && !esPayAsYouGo ? (
                      <>
                        El tamaño de los turnos está bien, pero llevas{' '}
                        <strong>{peticionesHoy} de {cupoDiario}</strong> peticiones de hoy con {modeloDeNarracion}.
                        Cuando se acaben no podrás seguir con este modelo hasta mañana.
                      </>
                    ) : (
                      <>
                        Cada turno manda <strong>{compact(tokensMostrados)} fichas</strong>, y caben{' '}
                        {compact(topeMinutoReal)} {esPayAsYouGo ? 'en la ventana completa del modelo (Pay-as-you-go sin corte por minuto)' : 'por minuto'}. No tienes que hacer nada.
                      </>
                    )}
                  </p>
                </div>

                {/* Live Breakdown Box */}
                <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] rounded-lg p-4 shadow-xs">
                  <h4 className="font-cinzel font-bold text-sm text-[var(--accent)] mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <ChartColumn className="w-3.5 h-3.5" />
                      En qué se va el contexto
                    </span>
                    {/*
                      ⚠️ ESTE PORCENTAJE NO ES DE LA VENTANA, Y DECÍA QUE SÍ.

                      Mide contra `MAX_TOKENS`, que es el MENOR entre la ventana
                      del modelo y la cuota por minuto — y en la capa gratuita
                      casi siempre manda la cuota, que es cuatro veces más
                      pequeña. O sea que decía «66,8% de la ventana» cuando de
                      la ventana iba por el 16%: asustaba por un techo que no
                      era el que estaba midiendo. Ahora el rótulo dice contra
                      cuál de los dos mide.
                    */}
                    <span
                      className="text-xs bg-[var(--accent)] text-[var(--on-accent)] px-2 py-0.5 rounded-full font-sans"
                      title={
                        mandaLaCuota
                          ? `Mide contra la cuota por minuto (${compact(MAX_TOKENS)} fichas), que ahora mismo corta antes que la ventana del modelo (${compact(ventana)}).`
                          : `Mide contra la ventana del modelo: ${compact(MAX_TOKENS)} fichas por petición.`
                      }
                    >
                      {percentage < 0.1 ? '<0,1' : percentage.toFixed(1).replace('.', ',')}%{' '}
                      {mandaLaCuota ? 'del cupo por minuto' : 'de la ventana'}
                    </span>
                  </h4>

                  <p className="text-[11px] text-[var(--text-secondary)] m-0 mb-3">
                    Reparto de los {compact(totalChars)} <strong>caracteres</strong> que se envían en cada turno
                    — ⚠️ caracteres, no fichas: en castellano salen unas 3,5 letras por ficha, así que el número de
                    abajo siempre será bastante más pequeño y no se contradicen. De los capítulos cerrados solo
                    viaja el tramo final de cada uno; lo que hay que recordar de lo viejo vive en el diario y en la
                    memoria.
                  </p>

                  <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
                    {[
                      {
                        label: 'Protocolos de la aplicación',
                        chars: carga.andamiaje,
                        Icon: Gauge,
                        extra: 'Reglas de interfaz y etiquetas. Van en todos los turnos y no se pueden quitar.'
                      },
                      {
                        label: 'Directivas del Narrador',
                        chars: instructionsChars,
                        Icon: Scroll,
                        extra: 'Tus instrucciones de campaña, o las de por defecto si no las has tocado.'
                      },
                      {
                        label: 'Memoria del proyecto',
                        chars: memoryChars,
                        Icon: Brain,
                        extra:
                          'Solo la memoria general, tus notas y tus directivas manuales. La crónica, los PNJs, las tramas y los lugares NO viajan en el turno.'
                      },
                      {
                        label: 'Archivos que viajan enteros',
                        chars: filesChars,
                        Icon: Paperclip,
                        extra: mediaCount > 0 ? `${mediaCount} imágenes o audios (decorativos, no consumen tokens)` : undefined
                      },
                      {
                        label: 'Capítulo actual + cola de los anteriores',
                        chars: chatsChars,
                        Icon: MessageSquare,
                        extra:
                          ventanaHistorial === 'all'
                            ? `El capítulo en curso viaja ENTERO en cada turno (${carga.mensajesQueViajan} mensajes). Crece con cada respuesta: en Motor → Rendimiento puedes fijar una «Ventana de Historial» para mandar solo los últimos turnos.`
                            : `Ventana de historial: últimos ${ventanaHistorial} mensajes${mensajesRecortados > 0 ? ` (${mensajesRecortados} más antiguos no viajan)` : ''}.`
                      },
                      {
                        label: 'Fragmentos rescatados de los de consulta',
                        chars: rescateChars,
                        Icon: Search,
                        extra: rescateChars ? 'como mucho; lo normal es bastante menos' : undefined
                      },
                      {
                        label: 'Ficha, calendario y resto del turno',
                        chars: carga.otros,
                        Icon: Landmark,
                        extra: 'Ficha del protagonista, fecha y hora, salud, dados y demás bloques.'
                      }
                    ].map(({ label, chars, Icon, extra }) => {
                      const share = totalChars > 0 ? (chars / totalChars) * 100 : 0;
                      return (
                        <li key={label} className="flex flex-col gap-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-[var(--text-primary)] min-w-0">
                              <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                              <span className="truncate">{label}</span>
                            </span>
                            <span className="text-[var(--text-secondary)] tabular-nums shrink-0">
                              {compact(chars)} · {share < 1 && chars > 0 ? '<1' : Math.round(share)}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent)]/55 rounded-full"
                              style={{ width: `${Math.max(share, chars > 0 ? 1.5 : 0)}%` }}
                            />
                          </div>
                          {extra && <span className="text-[11px] text-[var(--text-secondary)]">{extra}</span>}
                        </li>
                      );
                    })}
                  </ul>

                  {deConsulta.length > 0 && (
                    <div className="mt-3 rounded-lg border border-dashed border-[var(--user-border)] bg-[var(--surface-soft)] p-2.5 text-[11px] text-[var(--text-secondary)]">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-cinzel font-bold text-[var(--text-primary)]">
                          {deConsulta.length} de consulta · {busqueda ? 'se buscan' : 'solo se anuncian'}
                        </span>
                        <span className="tabular-nums">
                          {compact(deConsultaChars)} car. ·{' '}
                          {busqueda ? (
                            <strong className="text-emerald-700">
                              viajan solo los fragmentos que hagan falta
                            </strong>
                          ) : (
                            <strong>no viaja nada de ellos</strong>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 truncate" title={deConsulta.map(f => f.name).join(', ')}>
                        {deConsulta.map(f => f.name).join(' · ')}
                      </div>

                      <label className="mt-2 flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={busqueda}
                          onChange={e => {
                            setStoredBusquedaLocal(e.target.checked);
                            setBusqueda(e.target.checked);
                          }}
                          className="mt-0.5 accent-[var(--accent)]"
                        />
                        <span>
                          <strong className="text-[var(--text-primary)]">Buscar en ellos cada turno.</strong>{' '}
                          Rescata hasta {(PRESUPUESTO_FRAGMENTOS_CONSULTA / 1000).toLocaleString('es-ES')} mil
                          caracteres de lo que venga a cuento de la escena. La búsqueda
                          corre en tu navegador y no gasta ninguna petición, pero esos fragmentos sí suman
                          tokens. Con esto apagado el Narrador solo sabe que los archivos existen y tendrá que
                          pedirte los datos.
                          <br />
                          Los turnos con y sin búsqueda se apuntan por separado en el botón Motor, para que
                          compares el gasto real en vez de fiarte de la impresión.
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-1.5 text-xs text-[var(--text-secondary)]">
                    {esPayAsYouGo && (
                      <div className="mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-cinzel font-bold text-amber-900 dark:text-amber-200">
                          💳 Modo Saldo / Crédito Activo (Pay-as-you-go)
                        </div>
                        <p className="m-0 text-[11px] leading-snug text-[var(--text-secondary)]">
                          Esta clave tiene facturación de Google Cloud activada:
                          <br />• <strong>Sin estrangulamiento por minuto:</strong> cuota oficial de 4.000.000 TPM (en vez de 250.000).
                          <br />• <strong>Peticiones por minuto:</strong> 1.000 RPM (en vez de 5 RPM).
                          <br />• <strong>Peticiones diarias:</strong> Ilimitadas (sin el tope de 20 peticiones/día de la capa gratuita).
                          <br />• <strong>Capacidad total del tomo:</strong> Aprovecha la ventana completa de {compact(ventana)} tokens de {modeloDeNarracion}.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                      <span>
                        Ventana de {modeloDeNarracion}: <strong>{compact(ventana)}</strong> de tokens
                        {limiteMedido ? '' : ' (estimada: aún no se ha consultado tu clave)'}
                      </span>
                      <span>
                        Te quedan{' '}
                        <strong className="text-[var(--accent)]">
                          {compact(Math.max(0, MAX_TOKENS - tokensMostrados))}
                        </strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                      <span>
                        Tokens por minuto {esPayAsYouGo ? '(Pay-as-you-go)' : '(capa gratuita)'}:{' '}
                        <strong>{compact(cuota.tpm)}</strong> de entrada
                      </span>
                      <span>
                        Peticiones por minuto: <strong>{cuota.rpm}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                      <span>
                        Peticiones por DÍA: <strong>{esPayAsYouGo ? 'Ilimitadas' : cuota.rpd}</strong> {esPayAsYouGo ? '' : 'por clave'}
                        {!esPayAsYouGo && numeroDeClaves > 1 ? ` · ${cupoDiario} con tus ${numeroDeClaves} claves` : ''}
                      </span>
                      <span>
                        Hoy llevas{' '}
                        <strong className={!esPayAsYouGo && peticionesHoy >= cupoDiario ? 'text-red-500' : 'text-[var(--accent)]'}>
                          {peticionesHoy}
                        </strong>
                      </span>
                    </div>
                    {!esPayAsYouGo && (
                      <>
                        <p className="m-0 text-[11px] leading-snug">
                          Son dos límites distintos y se confunden con facilidad. La <strong>ventana</strong>{' '}
                          es cuánto le cabe al modelo <em>en una petición</em>. La <strong>cuota por
                          minuto</strong> es cuánto te deja mandar Google <em>por minuto</em>, y no se gasta
                          con el uso: se reinicia cada minuto. Por eso un tomo demasiado grande falla en el
                          primer turno aunque la clave sea nueva y esté sin estrenar.
                          {mandaLaCuota
                            ? ' Ahora mismo el que corta antes es la cuota por minuto, y es contra ese contra el que mide la barra.'
                            : ' Ahora mismo el que corta antes es la ventana del modelo, y es contra ese contra el que mide la barra.'}
                        </p>
                        <p className="m-0 text-[11px] leading-snug">
                          Y hay un tercer límite que no tiene nada que ver con el tamaño:{' '}
                          <strong>las peticiones por día</strong>. Con {modeloDeNarracion} son {cuota.rpd} por
                          clave, y al agotarse Google devuelve exactamente el mismo error 429 que cuando el
                          envío es demasiado grande. Si la barra de arriba va holgada y aun así falla, mira
                          esta cuenta antes que ninguna otra cosa. Las tareas de fondo (sincronizar memoria,
                          novelizar, deducir fechas) también gastan de aquí.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Medida real contra la API */}
                  <div className="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        Lo de arriba es una estimación por caracteres. Google cuenta por tokens, y no salen
                        los mismos números.
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
                        {midiendo ? 'Midiendo…' : 'Medir de verdad'}
                      </button>
                    </div>

                    {errorMedida && <p className="text-[11px] text-red-500 m-0">{errorMedida}</p>}

                    {medida && (
                      <div className="rounded-lg bg-[var(--surface-soft)] border border-[var(--user-border)] p-3 text-xs space-y-1">
                        <div className="flex justify-between gap-3">
                          <span className="font-bold text-[var(--text-primary)]">
                            Medido en {medida.modelo}
                          </span>
                          <span className="tabular-nums font-bold text-[var(--accent)]">
                            {medida.total.toLocaleString('es-ES')} tokens
                          </span>
                        </div>
                        <div className="flex justify-between gap-3 text-[var(--text-secondary)]">
                          <span>Directivas, ficha, documentos y memoria</span>
                          <span className="tabular-nums">{medida.sistema.toLocaleString('es-ES')}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-[var(--text-secondary)]">
                          <span>Escena en curso</span>
                          <span className="tabular-nums">{medida.conversacion.toLocaleString('es-ES')}</span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] m-0 pt-1">
                          Este es el número que también verías en Google AI Studio con el mismo material.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/*
                  EL MANUAL, PLEGADO.

                  Debajo había tres secciones seguidas —cómo recuerda la
                  campaña, los dos límites que se parecen y la guía de
                  archivos— que son buenas pero son un MANUAL, y estaban
                  abiertas siempre. Quien abre esta ventana con un 429 delante
                  no quiere un manual: quiere saber qué quitar. Sigue todo
                  aquí, a un clic, para el rato en que sí apetece leerlo.
                */}
                <details className="rounded-lg border border-[var(--glass-border)] bg-[var(--surface-soft)] overflow-hidden">
                  <summary className="cursor-pointer select-none px-4 py-3 font-cinzel font-bold text-sm text-[var(--accent)] hover:bg-[var(--glass)] transition-colors">
                    ¿Cómo funciona todo esto? · memoria, límites y archivos
                  </summary>
                  <div className="px-4 pb-4 pt-1 space-y-6">
                {/* Cómo se gestiona la memoria */}
                <div className="space-y-2">
                  <h4 className="font-cinzel font-bold text-base text-[var(--accent)] flex items-center gap-2">
                    <Landmark className="w-4 h-4 shrink-0" /> Cómo recuerda la campaña
                  </h4>
                  <p className="text-xs md:text-sm text-[var(--text-primary)] m-0">
                    En cada turno le llegan al Narrador <strong>cuatro cosas distintas</strong>, y no valen lo
                    mismo. Entender cuál es cuál es lo que evita la mitad de los problemas:
                  </p>
                  <ol className="list-decimal pl-5 text-xs md:text-sm space-y-2 text-[var(--text-secondary)] marker:text-[var(--accent)] marker:font-bold">
                    <li>
                      <strong className="text-[var(--text-primary)]">Documentos — lo que el mundo ES.</strong>{' '}
                      Tu ficha, las de tus compañeros, los compendios, el módulo. <strong>Son la fuente.</strong>{' '}
                      Lo que está escrito ahí existe y es verdad aunque no haya salido jugando todavía y aunque no
                      lo repita ningún panel. Van íntegros y al principio del mensaje, donde Google los reutiliza
                      entre turnos en vez de reprocesarlos.
                    </li>
                    <li>
                      <strong className="text-[var(--text-primary)]">Chat actual — lo que pasa AHORA.</strong>{' '}
                      La conversación de esta sesión, entera y sin resumir. Manda sobre el estado de la escena:
                      quién tienes delante, qué se acaba de decir, dónde estás.
                    </li>
                    <li>
                      <strong className="text-[var(--text-primary)]">Chats cerrados — el pasado de la aventura.</strong>{' '}
                      El <em>final</em> de los capítulos anteriores, <strong>recortado</strong>: los últimos mensajes
                      de cada uno y hasta donde cabe. Sirve para enlazar con lo último que pasó.{' '}
                      <strong className="text-[var(--text-primary)]">No es el registro de la campaña</strong> — de eso
                      se encargan el diario y la memoria.
                    </li>
                    <li>
                      <strong className="text-[var(--text-primary)]">Memoria persistente y fichas de PNJ — el refuerzo.</strong>{' '}
                      Personajes, lugares, tramas, diario, inventario, vínculos y secretos. Se guarda en tu navegador y
                      viaja cerca del final, que es donde el modelo más mira.{' '}
                      <strong className="text-[var(--text-primary)]">No sustituye a nada:</strong> existe para que no se
                      olvide lo que se ha jugado, igual que la memoria de un proyecto no reemplaza a sus documentos.
                    </li>
                  </ol>
                  <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1.5">
                    <p className="m-0">
                      <strong className="text-[var(--accent)] font-cinzel">Lo importante, y va escrito en los
                      protocolos:</strong> que algo <em>no</em> salga en un panel no significa que no exista. Un panel
                      vacío es un panel vacío, no un mundo vacío. La memoria solo manda{' '}
                      <strong className="text-[var(--text-primary)]">dato por dato</strong>, sobre lo que dice que ha
                      cambiado —gastado, perdido, requisado, revelado—; para todo lo demás manda el documento.
                    </p>
                    <p className="m-0">
                      Por eso <em>Sincronizar con IA</em> en Memoria no es obligatorio para jugar: relee los capítulos
                      y pone al día esas fichas, y cuanto más al día estén, menos se apoya la partida en arrastrar
                      historial.
                    </p>
                  </div>
                </div>

                {/* File Optimization Guide */}
                <div className="space-y-3">
                  <h4 className="font-cinzel font-bold text-base text-[var(--accent)] flex items-center gap-2">
                    <Image className="w-4 h-4 shrink-0" /> ¿Subirlo como imagen o como texto?
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Image Card */}
                    <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-3.5 rounded-lg">
                      <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5 mb-1.5">
                        <Map className="w-3.5 h-3.5" /> Archivos Ideales como IMAGEN
                      </div>
                      <ul className="text-xs space-y-1.5 text-[var(--text-secondary)]">
                        <li>
                          <strong>Mapas y Planos tácticos:</strong> Se procesan con visión artificial de
                          Gemini para extraer geografía, rutas y zonas, permitiendo además añadir{' '}
                          <em>Marcadores interactivos</em>.
                        </li>
                        <li>
                          <strong>Retratos de Personajes / Criaturas:</strong> Excelentes para asignar en la
                          ficha del PNJ en <em>Memoria</em> y asociarles notas visuales y de actitud.
                        </li>
                        <li className="text-[11px] italic text-[var(--accent)]">
                          * Las imágenes consumen cuota de tokens visuales fijos (~258 tokens por imagen) sin
                          sobrecargar el texto.
                        </li>
                      </ul>
                    </div>

                    {/* Text Card */}
                    <div className="bg-[var(--surface-soft)] border border-[var(--user-border)] p-3.5 rounded-lg">
                      <div className="font-cinzel font-bold text-xs text-[var(--accent)] flex items-center gap-1.5 mb-1.5">
                        <Scroll className="w-3.5 h-3.5" /> Archivos Ideales como TEXTO / PDF
                      </div>
                      <ul className="text-xs space-y-1.5 text-[var(--text-secondary)]">
                        <li>
                          <strong>Novelas y Lore Canónico:</strong> Ideales en .txt, .md o PDF para que el
                          modelo cite eventos, diálogos y cronología con fidelidad milimétrica.
                        </li>
                        <li>
                          <strong>Módulos y aventuras:</strong> Permite al Narrador extraer encuentros,
                          acertijos, tesoros y estadísticas de forma instantánea.
                        </li>
                        <li className="text-[11px] italic text-[var(--accent)]">
                          * Puedes usar el botón <em>«Extraer Estilo/Sistema»</em> en cualquier texto para
                          adaptar el tono del narrador.
                        </li>
                      </ul>
                    </div>
                  </div>
                  </div>
                  </div>
                </details>
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
          document.body
        )}
    </>
  );
};
