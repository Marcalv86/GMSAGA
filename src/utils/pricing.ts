/**
 * Tarifas oficiales de la API de Google Gemini y cálculo de costes y saldo en tiempo real.
 *
 * Precios oficiales (Pay-as-you-go en USD por 1M de tokens):
 * - Gemini 3.8 Flash / 3.7 Flash / 2.5 Flash:
 *   - Entrada (<= 128k tokens): $0.075 / 1M ($0.000000075 / token)
 *   - Entrada (> 128k tokens): $0.30 / 1M ($0.00000030 / token)
 *   - Entrada Cacheada (<= 128k): $0.01875 / 1M ($0.00000001875 / token) [-75% de descuento]
 *   - Entrada Cacheada (> 128k): $0.075 / 1M ($0.000000075 / token) [-75% de descuento]
 *   - Salida (<= 128k): $0.30 / 1M ($0.00000030 / token)
 *   - Salida (> 128k): $1.20 / 1M ($0.00000120 / token)
 *
 * - Gemini 3.5 Flash Lite:
 *   - Entrada (<= 128k): $0.0375 / 1M; Entrada Cacheada: $0.009375 / 1M; Salida: $0.15 / 1M
 *   - Entrada (> 128k): $0.15 / 1M; Entrada Cacheada: $0.0375 / 1M; Salida: $0.60 / 1M
 *
 * - Gemini 3.5 Pro / 2.5 Pro:
 *   - Entrada (<= 128k): $1.25 / 1M; Entrada Cacheada: $0.3125 / 1M; Salida: $5.00 / 1M
 *   - Entrada (> 128k): $2.50 / 1M; Entrada Cacheada: $0.625 / 1M; Salida: $10.00 / 1M
 */

import { LlamadaRegistrada, entradaMostrable } from './callLog';

export interface TarifasModelo {
  inputRateBase: number;       // $ por token para prompts <= 128k
  inputRateLong: number;       // $ por token para prompts > 128k
  cachedRateBase: number;      // $ por token cacheado <= 128k
  cachedRateLong: number;      // $ por token cacheado > 128k
  outputRateBase: number;      // $ por token salida <= 128k
  outputRateLong: number;      // $ por token salida > 128k
}

const TARIFAS_POR_DEFECTO: TarifasModelo = {
  inputRateBase: 0.075 / 1_000_000,
  inputRateLong: 0.30 / 1_000_000,
  cachedRateBase: 0.01875 / 1_000_000,
  cachedRateLong: 0.075 / 1_000_000,
  outputRateBase: 0.30 / 1_000_000,
  outputRateLong: 1.20 / 1_000_000
};

export function obtenerTarifasModelo(modelo: string): TarifasModelo {
  const m = (modelo || '').toLowerCase();
  if (m.includes('lite')) {
    return {
      inputRateBase: 0.0375 / 1_000_000,
      inputRateLong: 0.15 / 1_000_000,
      cachedRateBase: 0.009375 / 1_000_000,
      cachedRateLong: 0.0375 / 1_000_000,
      outputRateBase: 0.15 / 1_000_000,
      outputRateLong: 0.60 / 1_000_000
    };
  }
  if (m.includes('pro')) {
    return {
      inputRateBase: 1.25 / 1_000_000,
      inputRateLong: 2.50 / 1_000_000,
      cachedRateBase: 0.3125 / 1_000_000,
      cachedRateLong: 0.625 / 1_000_000,
      outputRateBase: 5.00 / 1_000_000,
      outputRateLong: 10.00 / 1_000_000
    };
  }
  return TARIFAS_POR_DEFECTO;
}

export interface CosteDesglosado {
  costeTotal: number;
  costeEntrada: number;
  costeSalida: number;
  costeSinCache: number;
  ahorroPorCache: number;
  fichasEntrada: number;
  fichasEnCache: number;
  fichasNuevas: number;
  fichasSalida: number;
  esVentanaLarga: boolean;
  esEstimada: boolean;
}

export function calcularCosteLlamada(l: LlamadaRegistrada): CosteDesglosado {
  const tarifas = obtenerTarifasModelo(l.modelo);
  const entrada = entradaMostrable(l);
  const fichasEntradaTotal = entrada.fichas || 0;
  const fichasEnCache = Math.min(fichasEntradaTotal, l.fichasEnCache || 0);
  const fichasNuevas = Math.max(0, fichasEntradaTotal - fichasEnCache);
  const fichasSalida = (l.fichasSalida || 0) + (l.fichasDePensamiento || 0);

  const esVentanaLarga = fichasEntradaTotal > 128_000;
  const rateInput = esVentanaLarga ? tarifas.inputRateLong : tarifas.inputRateBase;
  const rateCached = esVentanaLarga ? tarifas.cachedRateLong : tarifas.cachedRateBase;
  const rateOutput = esVentanaLarga ? tarifas.outputRateLong : tarifas.outputRateBase;

  const costeEntrada = (fichasNuevas * rateInput) + (fichasEnCache * rateCached);
  const costeSalida = fichasSalida * rateOutput;
  const costeTotal = costeEntrada + costeSalida;

  const costeSinCache = (fichasEntradaTotal * rateInput) + costeSalida;
  const ahorroPorCache = Math.max(0, costeSinCache - costeTotal);

  return {
    costeTotal,
    costeEntrada,
    costeSalida,
    costeSinCache,
    ahorroPorCache,
    fichasEntrada: fichasEntradaTotal,
    fichasEnCache,
    fichasNuevas,
    fichasSalida,
    esVentanaLarga,
    esEstimada: entrada.estimada
  };
}

export function formatearCosteUSD(coste: number, precisionAlta = false): string {
  if (coste === 0) return '$0.00';
  if (coste < 0.0001) return '< $0.0001';
  if (precisionAlta || coste < 0.01) {
    return `$${coste.toFixed(4)}`;
  }
  return `$${coste.toFixed(3)}`;
}

const CLAVE_SALDO_INICIAL = 'gmstudio_user_balance_initial';
const CLAVE_SALDO_TIMESTAMP = 'gmstudio_user_balance_timestamp';

export function getStoredInitialBalance(): { balance: number | null; timestamp: number | null } {
  if (typeof window === 'undefined') return { balance: null, timestamp: null };
  const rawBal = localStorage.getItem(CLAVE_SALDO_INICIAL);
  const rawTs = localStorage.getItem(CLAVE_SALDO_TIMESTAMP);
  if (!rawBal) return { balance: null, timestamp: null };
  const balance = parseFloat(rawBal);
  const timestamp = rawTs ? parseInt(rawTs, 10) : null;
  return {
    balance: Number.isFinite(balance) ? balance : null,
    timestamp: Number.isFinite(timestamp) ? timestamp : null
  };
}

export function setStoredInitialBalance(balance: number | null): void {
  if (typeof window === 'undefined') return;
  if (balance === null || !Number.isFinite(balance) || balance < 0) {
    localStorage.removeItem(CLAVE_SALDO_INICIAL);
    localStorage.removeItem(CLAVE_SALDO_TIMESTAMP);
    return;
  }
  localStorage.setItem(CLAVE_SALDO_INICIAL, balance.toString());
  localStorage.setItem(CLAVE_SALDO_TIMESTAMP, Date.now().toString());
}

export interface BalanceStats {
  saldoInicial: number | null;
  gastoTotal: number;
  saldoRestante: number | null;
  ahorroTotalCache: number;
  totalLlamadas: number;
  ultimoTurnoCoste: number | null;
  ultimoTurnoAhorro: number | null;
  ultimoTurnoFichasCache: number;
  ultimoTurnoPctCache: number;
}

export function getEstadisticasDeGasto(llamadas: LlamadaRegistrada[]): BalanceStats {
  const { balance: saldoInicial, timestamp: saldoTimestamp } = getStoredInitialBalance();

  let gastoTotal = 0;
  let ahorroTotalCache = 0;
  let ultimoTurnoCoste: number | null = null;
  let ultimoTurnoAhorro: number | null = null;
  let ultimoTurnoFichasCache = 0;
  let ultimoTurnoPctCache = 0;

  // Las llamadas vienen ordenadas o sin ordenar; filtramos por timestamp si hay saldo inicial fijado
  const llamadasValidas = llamadas.filter(l => l.estado === 'ok' || l.estado === 'cortada');

  // Encontrar el último turno narrado
  for (let i = 0; i < llamadas.length; i++) {
    const l = llamadas[i];
    if (/^Turno narrado/i.test(l.proposito || '')) {
      const des = calcularCosteLlamada(l);
      ultimoTurnoCoste = des.costeTotal;
      ultimoTurnoAhorro = des.ahorroPorCache;
      ultimoTurnoFichasCache = des.fichasEnCache;
      ultimoTurnoPctCache = des.fichasEntrada > 0 ? Math.round((des.fichasEnCache / des.fichasEntrada) * 100) : 0;
      break;
    }
  }

  for (const l of llamadasValidas) {
    // Si se fijó un saldo en un momento dado, solo deducir llamadas posteriores (o todas si no hay ts)
    if (saldoTimestamp) {
      const t = Date.parse(l.inicio);
      if (Number.isFinite(t) && t < saldoTimestamp) {
        continue;
      }
    }
    const des = calcularCosteLlamada(l);
    gastoTotal += des.costeTotal;
    ahorroTotalCache += des.ahorroPorCache;
  }

  const saldoRestante = saldoInicial !== null ? Math.max(0, saldoInicial - gastoTotal) : null;

  return {
    saldoInicial,
    gastoTotal,
    saldoRestante,
    ahorroTotalCache,
    totalLlamadas: llamadasValidas.length,
    ultimoTurnoCoste,
    ultimoTurnoAhorro,
    ultimoTurnoFichasCache,
    ultimoTurnoPctCache
  };
}
