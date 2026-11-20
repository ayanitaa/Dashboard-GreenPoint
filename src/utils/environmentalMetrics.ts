import type { TelemetryReading } from "../types/telemetry";

export type BarometricTrend = "Subiendo" | "Estable" | "Bajando" | "Sin datos";
export type HeatIndexLevel = "Confortable" | "Precaución" | "Calor elevado" | "Sin datos";

export type ReadingDerivedValues = {
  heatIndexC: number | null;
  dewPointC: number | null;
  absoluteHumidityGm3: number | null;
  vpdKpa: number | null;
  estimatedAltitudeM: number | null;
};

export type EnvironmentalMetrics = ReadingDerivedValues & {
  heatIndexLevel: HeatIndexLevel;
  leqDb: number | null;
  l90Db: number | null;
  l10Db: number | null;
  pressureDeltaHpa: number | null;
  barometricTrend: BarometricTrend;
  comfortPercent: number | null;
  sensorAvailability: {
    dht22: number | null;
    bmp280: number | null;
    ky038: number | null;
  };
};

const SEA_LEVEL_PRESSURE_HPA = 1013.25;
const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);

function calculateHeatIndexC(temperatureC: number, humidity: number): number {
  const temperatureF = temperatureC * 9 / 5 + 32;
  let heatIndexF = 0.5 * (temperatureF + 61 + (temperatureF - 68) * 1.2 + humidity * 0.094);
  heatIndexF = (heatIndexF + temperatureF) / 2;

  if (temperatureF >= 80 && humidity >= 40) {
    heatIndexF = -42.379
      + 2.04901523 * temperatureF
      + 10.14333127 * humidity
      - 0.22475541 * temperatureF * humidity
      - 0.00683783 * temperatureF ** 2
      - 0.05481717 * humidity ** 2
      + 0.00122874 * temperatureF ** 2 * humidity
      + 0.00085282 * temperatureF * humidity ** 2
      - 0.00000199 * temperatureF ** 2 * humidity ** 2;

    if (humidity < 13 && temperatureF >= 80 && temperatureF <= 112) {
      heatIndexF -= ((13 - humidity) / 4) * Math.sqrt((17 - Math.abs(temperatureF - 95)) / 17);
    } else if (humidity > 85 && temperatureF >= 80 && temperatureF <= 87) {
      heatIndexF += ((humidity - 85) / 10) * ((87 - temperatureF) / 5);
    }
  }
  return (heatIndexF - 32) * 5 / 9;
}

export function calculateReadingDerivedValues(reading: TelemetryReading): ReadingDerivedValues {
  const temperature = reading.temperature;
  const humidity = reading.humidity;
  const pressure = reading.pressureHpa;
  const hasTemperatureHumidity = finite(temperature) && finite(humidity) && humidity >= 0 && humidity <= 100;

  let heatIndexC: number | null = null;
  let dewPointC: number | null = null;
  let absoluteHumidityGm3: number | null = null;
  let vpdKpa: number | null = null;

  if (hasTemperatureHumidity) {
    heatIndexC = calculateHeatIndexC(temperature, humidity);
    const gamma = humidity > 0
      ? Math.log(humidity / 100) + (17.625 * temperature) / (243.04 + temperature)
      : null;
    dewPointC = gamma === null ? null : (243.04 * gamma) / (17.625 - gamma);
    const saturationPressureHpa = 6.112 * Math.exp((17.67 * temperature) / (temperature + 243.5));
    const vaporPressureHpa = saturationPressureHpa * humidity / 100;
    absoluteHumidityGm3 = 216.7 * vaporPressureHpa / (273.15 + temperature);
    vpdKpa = Math.max(0, saturationPressureHpa - vaporPressureHpa) / 10;
  }

  const estimatedAltitudeM = finite(pressure) && pressure > 0
    ? 44330 * (1 - (pressure / SEA_LEVEL_PRESSURE_HPA) ** 0.1903)
    : null;

  return { heatIndexC, dewPointC, absoluteHumidityGm3, vpdKpa, estimatedAltitudeM };
}

function percentile(values: number[], percentileValue: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function logarithmicAverageDb(values: number[]): number | null {
  if (!values.length) return null;
  const maximum = Math.max(...values);
  const meanScaledEnergy = values.reduce((sum, value) => sum + 10 ** ((value - maximum) / 10), 0) / values.length;
  return maximum + 10 * Math.log10(meanScaledEnergy);
}

function barometricChange(readings: TelemetryReading[]): Pick<EnvironmentalMetrics, "pressureDeltaHpa" | "barometricTrend"> {
  const latest = [...readings].reverse().find((item) => finite(item.pressureHpa));
  if (!latest) return { pressureDeltaHpa: null, barometricTrend: "Sin datos" };
  const latestTime = latest.createdAt.getTime();
  const candidates = readings.filter((item) => {
    const age = latestTime - item.createdAt.getTime();
    return finite(item.pressureHpa) && age >= 60 * 60 * 1000 && age <= 3 * 60 * 60 * 1000;
  });
  if (!candidates.length) return { pressureDeltaHpa: null, barometricTrend: "Sin datos" };
  const reference = candidates.reduce((best, item) =>
    Math.abs(latestTime - item.createdAt.getTime() - 2 * 60 * 60 * 1000)
      < Math.abs(latestTime - best.createdAt.getTime() - 2 * 60 * 60 * 1000) ? item : best,
  );
  const delta = latest.pressureHpa! - reference.pressureHpa!;
  return {
    pressureDeltaHpa: delta,
    barometricTrend: delta > 0.5 ? "Subiendo" : delta < -0.5 ? "Bajando" : "Estable",
  };
}

export function calculateEnvironmentalMetrics(
  readings: TelemetryReading[],
  thresholds: { temperatureMin: number; temperatureMax: number; noiseMax: number } = { temperatureMin: 22, temperatureMax: 26, noiseMax: 75 },
): EnvironmentalMetrics {
  const latest = readings[readings.length - 1];
  const derived = latest
    ? calculateReadingDerivedValues(latest)
    : { heatIndexC: null, dewPointC: null, absoluteHumidityGm3: null, vpdKpa: null, estimatedAltitudeM: null };
  const noises = readings.map((item) => item.noiseDb).filter((value): value is number => finite(value));
  const leqDb = logarithmicAverageDb(noises);
  const inComfortZone = readings.filter((item) => finite(item.temperature) && finite(item.noiseDb));
  const pressureMetrics = barometricChange(readings);
  const availability = (count: number) => readings.length ? 100 * count / readings.length : null;
  const heatIndexLevel: HeatIndexLevel = derived.heatIndexC === null
    ? "Sin datos"
    : derived.heatIndexC >= 32 ? "Calor elevado"
      : derived.heatIndexC >= 26 ? "Precaución" : "Confortable";

  return {
    ...derived,
    heatIndexLevel,
    leqDb,
    l90Db: percentile(noises, 0.1),
    l10Db: percentile(noises, 0.9),
    ...pressureMetrics,
    comfortPercent: inComfortZone.length
      ? 100 * inComfortZone.filter((item) => item.temperature! >= thresholds.temperatureMin && item.temperature! <= thresholds.temperatureMax && item.noiseDb! <= thresholds.noiseMax).length / inComfortZone.length
      : null,
    sensorAvailability: {
      dht22: availability(readings.filter((item) => finite(item.temperature) && finite(item.humidity)).length),
      bmp280: availability(readings.filter((item) => finite(item.pressureHpa)).length),
      ky038: availability(readings.filter((item) => finite(item.noiseDb)).length),
    },
  };
}
