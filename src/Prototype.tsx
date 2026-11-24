import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchTelemetryForExport } from "./services/firebaseTelemetry";
import { useTelemetry } from "./hooks/useTelemetry";
import type { TelemetryReading } from "./types/telemetry";
import { AnimatePresence, motion } from "motion/react";
import { calculateEnvironmentalMetrics, calculateReadingDerivedValues } from "./utils/environmentalMetrics";
import {
  BellIcon,
  BarChartIcon,
  ChevronDownIcon,
  GearIcon,
  HomeIcon,
  SewingPinIcon,
  SpeakerLoudIcon,
  SunIcon,
  OpacityIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  DownloadIcon,
  Cross2Icon,
  MoonIcon,
} from "@radix-ui/react-icons";
import "./prototype.css";

type Metric = "Temperatura" | "Ruido" | "Humedad" | "Presión";
type Tab = "Inicio" | "Historial" | "Ubicación" | "Configuración";
type Reading = TelemetryReading;
type Theme = "light" | "dark";
type HistoryPeriod = "Última hora" | "24 horas" | "7 días";
type ComfortThresholds = { temperatureMin: number; temperatureMax: number; noiseMax: number };
const defaultThresholds: ComfortThresholds = { temperatureMin: 22, temperatureMax: 26, noiseMax: 75 };
const metricColor: Record<Metric, string> = {
  Temperatura: "#31b654",
  Ruido: "#22a9e8",
  Humedad: "#31b654",
  Presión: "#477dd2",
};
const unit: Record<Metric, string> = {
  Temperatura: "°C",
  Ruido: "dB",
  Humedad: "%",
  Presión: "hPa",
};

function TrendChart({
  metric,
  range,
  readings,
  theme,
  thresholds,
}: {
  metric: Metric;
  range: string;
  readings: Reading[];
  theme: Theme;
  thresholds: ComfortThresholds;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const values = readings.map((r) =>
    metric === "Temperatura"
      ? r.temperature
      : metric === "Ruido"
        ? r.noiseDb
        : metric === "Humedad"
          ? r.humidity
          : r.pressureHpa,
  );
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const paint = () => {
      const box = el.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      el.width = box.width * ratio;
      el.height = box.height * ratio;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      const w = box.width,
        h = box.height,
        left = 27,
        right = 4,
        top = 8,
        bottom = 22;
      const padding =
        metric === "Temperatura"
          ? 2
          : metric === "Ruido"
            ? 8
            : metric === "Presión"
              ? 3
              : 4;
      const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
      if (valid.length === 0) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      let min = Math.floor(Math.min(...valid) - padding);
      let max = Math.ceil(Math.max(...valid) + padding);
      if (metric === "Temperatura") {
        min = Math.min(min, thresholds.temperatureMin - 1);
        max = Math.max(max, thresholds.temperatureMax + 1);
      } else if (metric === "Ruido") {
        max = Math.max(max, thresholds.noiseMax + 5);
      }
      const timeStart = readings[0].createdAt.getTime();
      const timeEnd = readings[readings.length - 1].createdAt.getTime();
      const x = (i: number) => timeEnd === timeStart
        ? left + (w - left - right) / 2
        : left + ((readings[i].createdAt.getTime() - timeStart) / (timeEnd - timeStart)) * (w - left - right);
      const y = (v: number) =>
        top + ((max - v) / (max - min)) * (h - top - bottom);
      const dark = theme === "dark";
      const axisColor = dark ? "#9aada4" : "#66716c";
      const horizontalGrid = dark ? "rgba(208,231,218,.13)" : "#e8ebe6";
      const verticalGrid = dark ? "rgba(208,231,218,.08)" : "#f0f1ed";
      ctx.clearRect(0, 0, w, h);
      if (metric === "Temperatura") {
        ctx.fillStyle = dark ? "rgba(52,211,153,.12)" : "rgba(49,182,84,.09)";
        ctx.fillRect(left, y(thresholds.temperatureMax), w - left - right, y(thresholds.temperatureMin) - y(thresholds.temperatureMax));
      }
      ctx.font = '11px "Inter", system-ui, sans-serif';
      ctx.textAlign = "left";
      ctx.fillStyle = axisColor;
      for (let i = 0; i < 4; i++) {
        const v = max - ((max - min) * i) / 3;
        const yy = y(v);
        ctx.strokeStyle = horizontalGrid;
        ctx.lineWidth = 0.65;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(left, yy);
        ctx.lineTo(w - right, yy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(
          metric === "Temperatura"
            ? Math.round(v).toString()
            : Math.round(v).toString(),
          0,
          yy + 4,
        );
      }
      for (let i = 0; i < 5; i++) {
        const xx = left + ((w - left - right) * i) / 4;
        ctx.strokeStyle = verticalGrid;
        ctx.lineWidth = 0.65;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(xx, top);
        ctx.lineTo(xx, h - bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = "center";
        ctx.fillStyle = axisColor;
        ctx.fillText(
          range === "7 días"
            ? ["Lun", "Mar", "Mié", "Jue", "Vie"][i]
            : range === "1 hora" || range === "Última hora"
              ? ["−60m", "−45m", "−30m", "−15m", "Ahora"][i]
              : ["00:00", "06:00", "12:00", "18:00", "24:00"][i],
          xx,
          h - 4,
        );
      }
      if (metric === "Ruido") {
        ctx.beginPath();
        ctx.moveTo(left, y(thresholds.noiseMax));
        ctx.lineTo(w - right, y(thresholds.noiseMax));
        ctx.strokeStyle = dark ? "#fbbf24" : "#92400e";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const gradient = ctx.createLinearGradient(0, top, 0, h - bottom);
      const rgb =
        metricColor[metric] === "#22a9e8"
          ? "34,169,232"
          : metricColor[metric] === "#477dd2"
            ? "71,125,210"
            : "49,182,84";
      gradient.addColorStop(0, `rgba(${rgb},.22)`);
      gradient.addColorStop(1, `rgba(${rgb},.015)`);
      ctx.strokeStyle = metricColor[metric];
      ctx.lineWidth = 2.8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = metricColor[metric] + "66";
      ctx.shadowBlur = 7;
      ctx.fillStyle = gradient;
      let segment: number[] = [];
      const drawSegment = () => {
        if (!segment.length) return;
        ctx.beginPath();
        segment.forEach((index, position) => position === 0
          ? ctx.moveTo(x(index), y(values[index]!))
          : ctx.lineTo(x(index), y(values[index]!)));
        if (segment.length > 1) {
          ctx.stroke();
          ctx.lineTo(x(segment[segment.length - 1]), h - bottom);
          ctx.lineTo(x(segment[0]), h - bottom);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = metricColor[metric];
          ctx.beginPath();
          ctx.arc(x(segment[0]), y(values[segment[0]]!), 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = gradient;
        }
        segment = [];
      };
      values.forEach((value, index) => {
        if (value === null || !Number.isFinite(value)) drawSegment();
        else segment.push(index);
      });
      drawSegment();
      ctx.shadowBlur = 0;
      if (valid.length === 1 && readings.length > 1) {
        const index = values.findIndex((value) => value !== null && Number.isFinite(value));
        ctx.fillStyle = metricColor[metric];
        ctx.beginPath();
        ctx.arc(x(index), y(values[index]!), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (selectedIndex !== null && values[selectedIndex] !== null && values[selectedIndex] !== undefined) {
        ctx.beginPath();
        ctx.moveTo(x(selectedIndex), top);
        ctx.lineTo(x(selectedIndex), h - bottom);
        ctx.strokeStyle = dark ? "rgba(226,247,235,.55)" : "rgba(32,67,45,.45)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x(selectedIndex), y(values[selectedIndex]!), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = metricColor[metric];
        ctx.fill();
      }
    };
    paint();
    const resize = new ResizeObserver(paint);
    resize.observe(el);
    return () => resize.disconnect();
  }, [metric, range, values, readings, selectedIndex, theme, thresholds]);
  if (readings.length === 0 || !values.some((value) => value !== null && Number.isFinite(value)))
    return <div className="empty-chart">Aún no hay lecturas para mostrar.</div>;
  const point = selectedIndex === null ? null : readings[selectedIndex];
  const pointValue = selectedIndex === null ? null : values[selectedIndex];
  const findPoint = (clientX: number) => {
    const el = canvas.current;
    if (!el) return;
    const bounds = el.getBoundingClientRect();
    const plotLeft = 27;
    const plotRight = 4;
    const localX = Math.max(plotLeft, Math.min(bounds.width - plotRight, clientX - bounds.left));
    const firstTime = readings[0].createdAt.getTime();
    const lastTime = readings[readings.length - 1].createdAt.getTime();
    const pointX = (index: number) => lastTime === firstTime
      ? bounds.width / 2
      : plotLeft + ((readings[index].createdAt.getTime() - firstTime) / (lastTime - firstTime)) * (bounds.width - plotLeft - plotRight);
    let nearest: number | null = null;
    let distance = Number.POSITIVE_INFINITY;
    values.forEach((value, index) => {
      if (value === null || !Number.isFinite(value)) return;
      const nextDistance = Math.abs(pointX(index) - localX);
      if (nextDistance < distance) { nearest = index; distance = nextDistance; }
    });
    setSelectedIndex(nearest);
  };
  return (
    <div className="chart-plot" onPointerMove={(event) => findPoint(event.clientX)} onPointerLeave={() => setSelectedIndex(null)} onPointerDown={(event) => findPoint(event.clientX)}>
      <canvas
        ref={canvas}
        className="trend-canvas"
        aria-label={`Tendencia de ${metric.toLowerCase()} en las últimas ${range}`}
        role="img"
      />
      {point && pointValue !== null && pointValue !== undefined && (
        <div className="chart-tooltip" style={{ left: `${Math.min(92, Math.max(8, ((point.createdAt.getTime() - readings[0].createdAt.getTime()) / Math.max(1, readings[readings.length - 1].createdAt.getTime() - readings[0].createdAt.getTime())) * 100))}%` }}>
          <strong>{pointValue.toFixed(metric === "Temperatura" || metric === "Presión" ? 1 : 0)} {unit[metric]}</strong>
          <span>{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "medium" }).format(point.createdAt)}</span>
        </div>
      )}
    </div>
  );
}

function metricValueFor(reading: Reading, metric: Metric) {
  return metric === "Temperatura" ? reading.temperature
    : metric === "Ruido" ? reading.noiseDb
      : metric === "Humedad" ? reading.humidity
        : reading.pressureHpa;
}

function hasReadingAlert(reading: Reading, thresholds: ComfortThresholds = defaultThresholds) {
  return (reading.temperature !== null && (reading.temperature < thresholds.temperatureMin || reading.temperature > thresholds.temperatureMax))
    || (reading.noiseDb !== null && reading.noiseDb > thresholds.noiseMax);
}

function readingAlertDescriptions(reading: Reading, thresholds: ComfortThresholds) {
  const alerts: string[] = [];
  if (reading.temperature !== null && (reading.temperature < thresholds.temperatureMin || reading.temperature > thresholds.temperatureMax)) alerts.push(`Temperatura ${reading.temperature.toFixed(1)} °C`);
  if (reading.noiseDb !== null && reading.noiseDb > thresholds.noiseMax) alerts.push(`Ruido ${reading.noiseDb.toFixed(1)} dB`);
  return alerts;
}

function readingStatus(reading: Reading, thresholds: ComfortThresholds = defaultThresholds) {
  if (hasReadingAlert(reading, thresholds)) return "Alerta";
  if (reading.temperature === null || reading.humidity === null || reading.pressureHpa === null || reading.noiseDb === null) return "Incompleta";
  return "Óptimo";
}

function latestMetricDelta(readings: Reading[], metric: Metric) {
  const values = readings
    .map((reading) => metricValueFor(reading, metric))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return values.length < 2 ? null : Math.round((values[values.length - 1] - values[values.length - 2]) * 10) / 10;
}

function metricDeltaLabel(readings: Reading[], metric: Metric) {
  if (readings.length === 0) return "Esperando primera lectura";
  if (readings.length === 1) return "Esperando segunda lectura";
  const delta = latestMetricDelta(readings, metric);
  if (delta === null) return "Sin dato previo válido";
  const formatted = Math.abs(delta).toFixed(1);
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${formatted} ${unit[metric]} vs lectura anterior`;
}

function averageFor(readings: Reading[], metric: Metric) {
  const values = readings
    .map((reading) => metricValueFor(reading, metric))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function MetricInsights({
  metric, readings, current, scaleMin, scaleMax, zoneMin, zoneMax, threshold,
}: {
  metric: Metric;
  readings: Reading[];
  current: number | null;
  scaleMin: number;
  scaleMax: number;
  zoneMin?: number;
  zoneMax?: number;
  threshold?: number;
}) {
  const values = readings.map((item) => metricValueFor(item, metric)).filter((value): value is number => value !== null && Number.isFinite(value));
  const minimum = values.length ? Math.min(...values) : null;
  const maximum = values.length ? Math.max(...values) : null;
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const delta = latestMetricDelta(readings, metric);
  const trend = delta === null || delta === 0 ? "=" : delta > 0 ? "↑" : "↓";
  const position = current === null ? 0 : Math.max(0, Math.min(100, ((current - scaleMin) / (scaleMax - scaleMin)) * 100));
  const zoneLeft = zoneMin === undefined ? 0 : ((zoneMin - scaleMin) / (scaleMax - scaleMin)) * 100;
  const zoneWidth = zoneMin === undefined || zoneMax === undefined ? 0 : ((zoneMax - zoneMin) / (scaleMax - scaleMin)) * 100;
  const format = (value: number | null) => value === null ? "--" : `${value.toFixed(metric === "Temperatura" || metric === "Presión" ? 1 : 0)} ${unit[metric]}`;
  return (
    <div className="metric-insights">
      <div className="metric-meter" role="img" aria-label={`${metric}: ${format(current)}`}>
        <span className="meter-track">
          {current !== null && <span className="meter-fill" style={{ width: `${position}%` }} />}
          {zoneMin !== undefined && <span className="meter-zone" style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }} />}
          {threshold !== undefined && <span className="meter-threshold" style={{ left: `${((threshold - scaleMin) / (scaleMax - scaleMin)) * 100}%` }} />}
        </span>
        {current !== null && <span className="meter-value" style={{ left: `${position}%` }} />}
      </div>
      <div className="metric-stats">
        <span>Min <b>{format(minimum)}</b></span>
        <span>Prom <b>{format(average)}</b></span>
        <span>Max <b>{format(maximum)}</b></span>
        <span className="metric-trend" title="Cambio respecto a la lectura anterior">{trend}</span>
      </div>
    </div>
  );
}

function valueFor(reading: Reading | null, metric: Metric) {
  if (!reading) return "--";
  const value = metric === "Temperatura"
    ? reading.temperature
    : metric === "Ruido"
      ? reading.noiseDb
      : metric === "Humedad"
        ? reading.humidity
        : reading.pressureHpa;
  if (value === null) return "--";
  return metric === "Temperatura" || metric === "Presión" ? value.toFixed(1) : Math.round(value).toString();
}

export default function Prototype() {
  const { readings: history, latest: reading, connectionState, nodeState, lastSeenText } = useTelemetry(import.meta.env.VITE_NODE_ID || undefined);
  const [thresholds, setThresholds] = useState<ComfortThresholds>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("greenpoint-thresholds") || "null") as Partial<ComfortThresholds> | null;
      const candidate = { ...defaultThresholds, ...saved };
      if (Number.isFinite(candidate.temperatureMin) && Number.isFinite(candidate.temperatureMax) && candidate.temperatureMin < candidate.temperatureMax && Number.isFinite(candidate.noiseMax)) return candidate;
    } catch { /* Invalid or unavailable local storage uses firmware defaults. */ }
    return defaultThresholds;
  });
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = window.localStorage.getItem("greenpoint-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch { /* Fall back to the operating system preference. */ }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [metric, setMetric] = useState<Metric>("Temperatura");
  const [range, setRange] = useState("24 horas");
  const [topView, setTopView] = useState("Tiempo real");
  const [tab, setTab] = useState<Tab>("Inicio");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [noticePosition, setNoticePosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [toast, setToast] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("24 horas");
  const [historyAlertOnly, setHistoryAlertOnly] = useState(false);
  const [historyVisibleCount, setHistoryVisibleCount] = useState(25);
  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");
  useEffect(() => {
    if (!noticeOpen) {
      setNoticePosition(null);
      return;
    }

    const placePopover = () => {
      const button = notificationRef.current?.querySelector<HTMLButtonElement>(".notification-button");
      const header = notificationRef.current?.closest<HTMLElement>(".web-header");
      if (!button || !header) return;

      const buttonRect = button.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const gutter = 12;
      const leftBound = Math.max(gutter, headerRect.left + gutter);
      const rightBound = Math.min(window.innerWidth - gutter, headerRect.right - gutter);
      const maxWidth = window.innerWidth <= 639 ? 360 : 880;
      const width = Math.max(0, Math.min(maxWidth, rightBound - leftBound));
      const left = Math.min(Math.max(buttonRect.right - width, leftBound), rightBound - width);

      setNoticePosition({ top: buttonRect.bottom + 10, left, width });
    };

    placePopover();
    window.addEventListener("resize", placePopover);
    window.addEventListener("scroll", placePopover, true);
    return () => {
      window.removeEventListener("resize", placePopover);
      window.removeEventListener("scroll", placePopover, true);
    };
  }, [noticeOpen]);
  useEffect(() => {
    if (!noticeOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationRef.current?.contains(event.target)) setNoticeOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNoticeOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [noticeOpen]);
  const updateThreshold = (field: keyof ComfortThresholds, value: number) => setThresholds((current) => {
    if (!Number.isFinite(value)) return current;
    const next = { ...current, [field]: value };
    if (next.temperatureMin >= next.temperatureMax) return current;
    return next;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem("greenpoint-theme", theme); } catch { /* Theme remains active for this session. */ }
  }, [theme]);
  useEffect(() => {
    try { window.localStorage.setItem("greenpoint-thresholds", JSON.stringify(thresholds)); } catch { /* Settings remain active for this session. */ }
  }, [thresholds]);
  const hasReading = reading !== null;
  const activeAlerts = nodeState === "online" && reading
    ? readingAlertDescriptions(reading, thresholds).map((item) => item.startsWith("Temperatura") ? `${item} fuera de ${thresholds.temperatureMin}–${thresholds.temperatureMax} °C` : `${item} elevado (máx. ${thresholds.noiseMax} dB)`)
    : [];
  const alert = activeAlerts.length > 0;
  const firebaseState = {
    idle: "Firebase inactivo",
    connecting: "Conectando a Firebase…",
    connected: "Conectado a Firebase",
    error: "Error de conexión con Firebase",
  }[connectionState];
  const nodeStateLabel = {
    online: "En línea",
    stale: "Sin señal reciente",
    offline: "Desconectado",
    "no-data": "Esperando sensores",
  }[nodeState];
  const lastTime = useMemo(
    () =>
      hasReading
        ? new Intl.DateTimeFormat("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(reading!.createdAt)
        : "Sin lecturas",
    [reading?.createdAt, hasReading],
  );
  const exportCsv = async (filteredRecords?: Reading[]) => {
    setToast("Preparando archivo…");
    let records: Reading[] = [];
    try {
      records = filteredRecords ?? await fetchTelemetryForExport(import.meta.env.VITE_NODE_ID || undefined);
    } catch {
      setToast("No se pudo consultar el historial");
      window.setTimeout(() => setToast(""), 2400);
      return;
    }
    if (records.length === 0) {
      setToast("Aún no hay lecturas para exportar");
      window.setTimeout(() => setToast(""), 2400);
      return;
    }
    const rows: (string | number | null)[][] = [
      [
        "fecha_hora",
        "node_id",
        "temperatura_c",
        "humedad_pct",
        "presion_hpa",
        "ruido_estimado_db",
        "sensacion_termica_c",
        "punto_rocio_c",
        "humedad_absoluta_gm3",
        "vpd_kpa",
        "altitud_est_m",
      ],
      ...records.map((r) => {
        const derived = calculateReadingDerivedValues(r);
        return [
          r.createdAt.toISOString(),
          r.nodeId,
          r.temperature,
          r.humidity,
          r.pressureHpa,
          r.noiseDb,
          derived.heatIndexC,
          derived.dewPointC,
          derived.absoluteHumidityGm3,
          derived.vpdKpa,
          derived.estimatedAltitudeM,
        ];
      }),
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((r) => r.join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "green-point-mediciones.csv";
    a.click();
    URL.revokeObjectURL(url);
    setToast(
      `CSV descargado · ${records.length} registro${records.length === 1 ? "" : "s"}`,
    );
    window.setTimeout(() => setToast(""), 2400);
  };

  const metricValue = valueFor(reading, metric);
  const rangeStart =
    Date.now() - (range === "24 horas" ? 24 : 7 * 24) * 60 * 60 * 1000;
  const chartReadings = history.filter(
    (r) => r.createdAt.getTime() >= rangeStart,
  );
  const environmentalMetrics = calculateEnvironmentalMetrics(chartReadings, thresholds);
  const allTimeEnvironmentalMetrics = calculateEnvironmentalMetrics(history, thresholds);
  const historyPeriodMs = historyPeriod === "Última hora" ? 60 * 60 * 1000 : historyPeriod === "24 horas" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const periodReadings = history.filter((item) => item.createdAt.getTime() >= Date.now() - historyPeriodMs);
  const periodEnvironmentalMetrics = calculateEnvironmentalMetrics(periodReadings, thresholds);
  const periodAlerts = periodReadings.filter((item) => hasReadingAlert(item, thresholds));
  const recentAlertReadings = history.filter((item) => hasReadingAlert(item, thresholds)).slice().reverse().slice(0, 5);
  const latestPressureReading = history.slice().reverse().find((item) => item.pressureHpa !== null);
  const latestBarometricAltitude = latestPressureReading ? calculateReadingDerivedValues(latestPressureReading).estimatedAltitudeM : null;
  const filteredHistory = historyAlertOnly ? periodAlerts : periodReadings;
  const visibleHistory = filteredHistory.slice().reverse().slice(0, historyVisibleCount);
  const historyAverages = {
    Temperatura: averageFor(periodReadings, "Temperatura"),
    Humedad: averageFor(periodReadings, "Humedad"),
    Presión: averageFor(periodReadings, "Presión"),
    Ruido: averageFor(periodReadings, "Ruido"),
  };
  const formatAverage = (value: number | null, metricName: Metric) => value === null ? "--" : `${value.toFixed(metricName === "Temperatura" || metricName === "Presión" ? 1 : 0)} ${unit[metricName]}`;
  const temperature = reading?.temperature ?? null;
  const humidity = reading?.humidity ?? null;
  const noise = reading?.noiseDb ?? null;
  const temperatureOutOfRange = temperature !== null && (temperature < thresholds.temperatureMin || temperature > thresholds.temperatureMax);
  const comfortMessage = nodeState === "offline"
    ? "Nodo desconectado"
    : nodeState === "stale"
    ? "Sin señal reciente"
    : nodeState === "no-data"
      ? "Esperando la primera lectura"
      : temperature === null || noise === null
        ? "Datos incompletos: revisa los sensores"
        : temperatureOutOfRange
          ? "Alerta: temperatura fuera del rango de confort"
          : noise > thresholds.noiseMax
            ? "Alerta: ruido elevado"
            : "Ambiente óptimo para trabajo y estudio";
  const sensorStates = [
    ["DHT22", reading !== null && reading.temperature !== null && reading.humidity !== null, environmentalMetrics.sensorAvailability.dht22],
    ["BMP280", reading !== null && reading.pressureHpa !== null, environmentalMetrics.sensorAvailability.bmp280],
    ["KY-038", reading !== null && reading.noiseDb !== null, environmentalMetrics.sensorAvailability.ky038],
  ] as const;
  const comfortScore = temperature === null || humidity === null || noise === null
    ? null
    : Math.round((
        (temperature >= thresholds.temperatureMin && temperature <= thresholds.temperatureMax ? 100 : Math.max(0, 100 - Math.min(Math.abs(temperature - thresholds.temperatureMin), Math.abs(temperature - thresholds.temperatureMax)) * 20))
        + (humidity >= 40 && humidity <= 60 ? 100 : Math.max(0, 100 - Math.min(Math.abs(humidity - 40), Math.abs(humidity - 60)) * 2))
        + Math.max(0, 100 - Math.max(0, noise - 45) * (55 / Math.max(1, thresholds.noiseMax - 45)))
      ) / 3);
  const comfortTone = nodeState === "online" && (temperatureOutOfRange || (noise !== null && noise > thresholds.noiseMax))
    ? "is-alert"
    : nodeState === "online" && comfortScore !== null
      ? "is-healthy"
      : "is-idle";
  return (
    <div className="app-shell">
      <div className="web-container">
        <header className="hero web-header">
          <div className="web-header-main">
            <div className="brand-group">
              <button
                className="brand-lockup"
                onClick={() => { setTab("Inicio"); setTopView("Tiempo real"); }}
                aria-label="Green Point, inicio"
              >
                <SunIcon className="brand-leaf" />
                <span>Green<br />point</span>
              </button>
              <div className="brand-description">
                <div className="hero-title">Green Point Comfort</div>
                <div className="hero-subtitle">Monitoreo ambiental IoT</div>
                <div className="hero-place">
                  <span className="hero-location"><SewingPinIcon /> Segundo Piso</span>
                  <span className={`node-pill node-pill-${nodeState}`}>
                    <span className={`node-beacon node-${nodeState}`} title={nodeStateLabel} aria-label={nodeStateLabel} />
                    {nodeStateLabel} · {lastSeenText}
                  </span>
                </div>
              </div>
            </div>
            <div className="hero-actions">
              <span className="connection-label"><i className={`connection-dot connection-${connectionState}`} />{firebaseState}</span>
              <div className="notification-container" ref={notificationRef}>
                <button className="icon-button notification-button" aria-label="Alertas" aria-expanded={noticeOpen} aria-controls="notification-popover" title="Alertas" onClick={() => setNoticeOpen((v) => !v)}>
                  <BellIcon />{activeAlerts.length > 0 && <span className="notification-count">{activeAlerts.length}</span>}
                </button>
                {noticeOpen && (
                  <section className="alert-popover" id="notification-popover" role="dialog" aria-label="Notificaciones recientes" style={noticePosition ?? undefined}>
                    <header><div><b>Notificaciones</b><span>{activeAlerts.length === 0 ? "Sin alertas activas" : activeAlerts.length === 1 ? "1 alerta activa" : `${activeAlerts.length} alertas activas`}</span></div><button aria-label="Cerrar notificaciones" onClick={() => setNoticeOpen(false)}><Cross2Icon /></button></header>
                    {activeAlerts.length ? <div className="active-alert-list">{activeAlerts.map((item) => <p key={item}><ExclamationTriangleIcon />{item}</p>)}</div> : <div className="no-active-alerts"><CheckCircledIcon />Sin alertas activas</div>}
                    <h4>Alertas recientes</h4>
                    {recentAlertReadings.length ? recentAlertReadings.map((item) => <div className="recent-alert-item" key={item.id}><span>{readingAlertDescriptions(item, thresholds).join(" · ")}</span><time>{new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(item.createdAt)}</time></div>) : <p className="no-history-alerts">No hay alertas registradas recientemente.</p>}
                  </section>
                )}
              </div>
              <button className="header-export" onClick={() => exportCsv()}>
                <DownloadIcon /> Exportar CSV
              </button>
              <button className="theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
              </button>
            </div>
          </div>
          <nav className="web-nav" aria-label="Navegación principal">
            {([
              ["Inicio", <HomeIcon />],
              ["Historial", <BarChartIcon />],
              ["Ubicación", <SewingPinIcon />],
              ["Configuración", <GearIcon />],
            ] as [Tab, ReactNode][]).map(([name, icon]) => (
              <button key={name} className={tab === name ? "active" : ""} aria-current={tab === name ? "page" : undefined}
                onClick={() => {
                  setTab(name);
                  if (name === "Historial") setTopView(name);
                  else if (name === "Inicio") setTopView("Tiempo real");
                }}>
                <span className="nav-icon">{icon}</span><span>{name}</span>
                {tab === name && <motion.i className="nav-indicator" layoutId="active-nav-indicator" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              </button>
            ))}
          </nav>
        </header>

        <main className="screen-content">
          <AnimatePresence mode="wait" initial={false}>
          <motion.div className="content-pad" key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: "easeOut" }}>
            {alert && (
              <div className="alert-banner warning">
                <span>
                  <ExclamationTriangleIcon />
                </span>
                <div>
                  <b>Alerta ambiental</b>
                  <small>
                    {activeAlerts[0] || "Revisa las lecturas recientes del nodo."}
                  </small>
                </div>
              </div>
            )}

            {tab === "Inicio" && (
              <>
                <motion.div className="metric-grid" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.075 } } }}>
                  <motion.article variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } } }} className={`metric-card temp-card ${temperatureOutOfRange ? "metric-alert" : ""}`}>
                    <div className="metric-icon temp-icon">
                      <SunIcon />
                    </div>
                    <div className="metric-main">
                      <div className="metric-label">Temperatura</div>
                      <div className="metric-value">
                        {reading?.temperature == null ? "--" : reading.temperature.toFixed(1)} <small>°C</small>
                      </div>
                      <div
                        className={`metric-delta ${temperatureOutOfRange ? "bad" : ""}`}
                      >
                        {metricDeltaLabel(history, "Temperatura")}
                      </div>
                      <div className="metric-caption">
                        {history.length > 1 ? "Cambio frente a la lectura válida anterior" : "El cambio aparecerá con otra lectura"}
                      </div>
                    </div>
                    <MetricInsights metric="Temperatura" readings={chartReadings} current={temperature} scaleMin={10} scaleMax={40} zoneMin={thresholds.temperatureMin} zoneMax={thresholds.temperatureMax} />
                  </motion.article>
                  <motion.article variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } } }} className={`metric-card noise-card ${noise !== null && noise > thresholds.noiseMax ? "metric-alert" : ""}`}>
                    <div className="metric-icon noise-icon">
                      <SpeakerLoudIcon />
                    </div>
                    <div className="metric-main">
                      <div className="metric-label">Nivel de Ruido</div>
                      <div className="metric-value">
                        {reading?.noiseDb == null ? "--" : Math.round(reading.noiseDb)} <small>dB</small>
                      </div>
                      <div
                        className={`metric-delta ${noise !== null && noise > thresholds.noiseMax ? "bad" : ""}`}
                      >
                        {metricDeltaLabel(history, "Ruido")}
                      </div>
                      <div className="metric-caption">
                        {history.length > 1 ? "Cambio frente a la lectura válida anterior" : "El cambio aparecerá con otra lectura"}
                      </div>
                    </div>
                    <MetricInsights metric="Ruido" readings={chartReadings} current={noise} scaleMin={0} scaleMax={120} threshold={thresholds.noiseMax} />
                  </motion.article>
                <motion.article variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } } }} className="metric-card humidity-card">
                  <div className="metric-icon humidity-icon">
                    <OpacityIcon />
                  </div>
                  <div className="humidity-info">
                    <span className="metric-label">Humedad</span>
                    <strong>
                      {reading?.humidity === null || !reading ? "--" : Math.round(reading.humidity)} <small>%</small>
                    </strong>
                  </div>
                  <div className="humidity-side">
                    <span className="healthy-pill">
                      {hasReading
                        ? reading?.humidity == null
                          ? "Sin dato"
                          : reading.humidity > 70
                            ? "Alta"
                            : "Normal"
                        : "Sin dato"}
                    </span>
                    <div className="humidity-track">
                      <i style={{ width: `${reading?.humidity ?? 0}%` }} />
                    </div>
                  </div>
                  <MetricInsights metric="Humedad" readings={chartReadings} current={reading?.humidity ?? null} scaleMin={0} scaleMax={100} zoneMin={40} zoneMax={60} />
                </motion.article>
                <motion.article variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } } }} className="metric-card pressure-card">
                  <div className="metric-icon pressure-icon"><BarChartIcon /></div>
                  <div className="metric-main">
                    <div className="metric-label">Presión atmosférica</div>
                    <div className="metric-value">{reading?.pressureHpa == null ? "--" : reading.pressureHpa.toFixed(1)} <small>hPa</small></div>
                    <div className="metric-caption">Sensor BMP280</div>
                  </div>
                  <MetricInsights metric="Presión" readings={chartReadings} current={reading?.pressureHpa ?? null} scaleMin={900} scaleMax={1100} />
                </motion.article>
                </motion.div>
                <motion.section className={`comfort-card ${comfortTone}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
                  <div className="comfort-copy">
                    <span className={`comfort-symbol ${temperatureOutOfRange || (noise !== null && noise > thresholds.noiseMax) ? "warning" : nodeState === "online" ? "healthy" : "idle"}`}>
                      {temperatureOutOfRange || (noise !== null && noise > thresholds.noiseMax) ? <ExclamationTriangleIcon /> : <CheckCircledIcon />}
                    </span>
                    <div><small>ESTADO DE CONFORT</small><h2>{comfortMessage}</h2><p>Evaluación basada en la última lectura recibida.</p></div>
                  </div>
                  <div className="comfort-score-wrap">
                    <span>Índice de confort ambiental</span>
                    <div className="comfort-ring" style={{ background: `conic-gradient(#10b981 ${comfortScore ?? 0}%, #dce9e1 0)` }}><span>{comfortScore === null ? "--" : comfortScore}<small>%</small></span></div>
                  </div>
                  <div className="sensor-health">
                    <span className="sensor-health-title">Salud de sensores</span>
                    {sensorStates.map(([name, hasCurrentValue, availability]) => {
                      const active = nodeState === "online" && hasCurrentValue;
                      const offline = nodeState === "offline";
                      return <span className={`sensor-health-item ${active ? "active" : "inactive"}${offline ? " offline" : ""}`} key={name}><i />{name}<b>{active ? "Activo" : "Sin señal"}{availability !== null && <small> · {Math.round(availability)}%</small>}</b></span>;
                    })}
                  </div>
                </motion.section>
                <section className="derived-panel">
                  <div className="derived-heading"><div><span className="section-eyebrow">MÉTRICAS CALCULADAS</span><h2>Análisis Ambiental Derivado</h2></div><span>Basado en {chartReadings.length} lecturas del periodo</span></div>
                  <div className="derived-grid">
                    <article className="derived-card derived-heat"><span className="derived-icon"><SunIcon /></span><div><small>Sensación térmica</small><strong>{environmentalMetrics.heatIndexC === null ? "--" : `${environmentalMetrics.heatIndexC.toFixed(1)} °C`}</strong><span className={`derived-badge level-${environmentalMetrics.heatIndexLevel === "Confortable" ? "good" : environmentalMetrics.heatIndexLevel === "Sin datos" ? "none" : "warm"}`}>{environmentalMetrics.heatIndexLevel}</span></div></article>
                    <article className="derived-card derived-dew"><span className="derived-icon"><OpacityIcon /></span><div><small>Punto de rocío</small><strong>{environmentalMetrics.dewPointC === null ? "--" : `${environmentalMetrics.dewPointC.toFixed(1)} °C`}</strong><span>Humedad absoluta <b>{environmentalMetrics.absoluteHumidityGm3 === null ? "--" : `${environmentalMetrics.absoluteHumidityGm3.toFixed(1)} g/m³`}</b></span></div></article>
                    <article className="derived-card derived-acoustic"><span className="derived-icon"><SpeakerLoudIcon /></span><div><small>Acústica energética</small><strong>{environmentalMetrics.leqDb === null ? "--" : `${environmentalMetrics.leqDb.toFixed(1)} dB Leq`}</strong><span>L90 <b>{environmentalMetrics.l90Db === null ? "--" : `${environmentalMetrics.l90Db.toFixed(1)} dB`}</b> · L10 <b>{environmentalMetrics.l10Db === null ? "--" : `${environmentalMetrics.l10Db.toFixed(1)} dB`}</b></span></div></article>
                    <article className="derived-card derived-pressure"><span className="derived-icon"><BarChartIcon /></span><div><small>Barometría y altitud</small><strong>{environmentalMetrics.estimatedAltitudeM === null ? "--" : `${Math.round(environmentalMetrics.estimatedAltitudeM).toLocaleString("es-CO")} m s.n.m.`}</strong><span>{environmentalMetrics.barometricTrend}{environmentalMetrics.pressureDeltaHpa === null ? "" : ` · ${environmentalMetrics.pressureDeltaHpa > 0 ? "+" : ""}${environmentalMetrics.pressureDeltaHpa.toFixed(1)} hPa`}</span></div></article>
                    <article className="derived-card derived-vpd"><span className="derived-icon"><CheckCircledIcon /></span><div><small>VPD · eficiencia de confort</small><strong>{environmentalMetrics.vpdKpa === null ? "--" : `${environmentalMetrics.vpdKpa.toFixed(2)} kPa`}</strong><span>En zona de confort <b>{environmentalMetrics.comfortPercent === null ? "--" : `${Math.round(environmentalMetrics.comfortPercent)}%`}</b></span></div></article>
                  </div>
                </section>
                <section className="trend-card">
                  <div className="trend-header">
                    <div>
                      <h2>
                        {topView === "Estadísticas"
                          ? "Estadísticas ambientales"
                          : "Tendencia de las últimas 24 horas"}
                      </h2>
                      <p>
                        {firebaseState} · {nodeStateLabel} <span>·</span> hoy, {lastTime}
                      </p>
                    </div>
                    <label className="metric-select">
                      <select
                        value={metric}
                        aria-label="Seleccionar variable"
                        onChange={(e) => setMetric(e.target.value as Metric)}
                      >
                        {["Temperatura", "Ruido", "Humedad", "Presión"].map(
                          (m) => (
                            <option key={m}>{m}</option>
                          ),
                        )}
                      </select>
                      <ChevronDownIcon />
                    </label>
                  </div>
                  <div className="chart-value">
                    <b style={{ color: metricColor[metric] }}>
                      {metricValue} {unit[metric]}
                    </b>
                    <span>
                      {hasReading ? "Última lectura" : "Sin lecturas"}
                    </span>
                  </div>
                  <TrendChart
                    metric={metric}
                    range={range}
                    readings={chartReadings}
                    theme={theme}
                    thresholds={thresholds}
                  />
                  <div className="range-tabs" aria-label="Rango de tiempo">
                    {["24 horas", "7 días"].map((r) => (
                      <button
                        className={range === r ? "selected" : ""}
                        key={r}
                        onClick={() => setRange(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {metric === "Ruido" && (
                    <p className="disclaimer">
                      El nivel de ruido es estimado y no corresponde a una
                      medición acústica certificada.
                    </p>
                  )}
                </section>
                <div className="reading-footer">
                  <span className={hasReading ? "online-dot" : "sensor-dot"} />
                  {hasReading
                    ? `Actualizado a las ${lastTime}`
                    : "Esperando la primera lectura"}
                  <span>·</span> lecturas cada 5 min
                </div>
                <p className="noise-footnote">
                  * Ruido estimado con KY-038; no es una medición acústica
                  certificada.
                </p>
              </>
            )}

            {tab === "Historial" && (
              <>
                <div className="history-heading">
                  <div><span className="section-eyebrow">TELEMETRÍA</span><h1>Historial de lecturas</h1><p>Consulta y exporta las mediciones recibidas del nodo.</p></div>
                  <button className="header-export history-export" onClick={() => exportCsv(filteredHistory)}><DownloadIcon /> Exportar filtrado</button>
                </div>
                <div className="history-filters">
                  <label>Periodo<select value={historyPeriod} onChange={(event) => { setHistoryPeriod(event.target.value as HistoryPeriod); setHistoryVisibleCount(25); }}>
                    <option>Última hora</option><option>24 horas</option><option>7 días</option>
                  </select></label>
                  <label>Estado<select value={historyAlertOnly ? "alerts" : "all"} onChange={(event) => { setHistoryAlertOnly(event.target.value === "alerts"); setHistoryVisibleCount(25); }}>
                    <option value="all">Todos</option><option value="alerts">Solo alertas</option>
                  </select></label>
                  <span className="filter-result-count">{filteredHistory.length} registros</span>
                </div>
                <div className="history-summary-cards">
                  <article><span>Registros</span><b>{periodReadings.length.toLocaleString("es-CO")}</b><small>en {historyPeriod.toLowerCase()}</small></article>
                  <article><span>En zona de confort</span><b>{periodEnvironmentalMetrics.comfortPercent === null ? "--" : `${Math.round(periodEnvironmentalMetrics.comfortPercent)}%`}</b><small>temperatura y ruido</small></article>
                  <article><span>Leq energético</span><b>{periodEnvironmentalMetrics.leqDb === null ? "--" : `${periodEnvironmentalMetrics.leqDb.toFixed(1)} dB`}</b><small>promedio acústico real</small></article>
                  <article><span>Promedio térmico</span><b>{formatAverage(historyAverages.Temperatura, "Temperatura")}</b><small>rango seleccionado</small></article>
                  <article className="summary-alert"><span>Lecturas con alerta</span><b>{periodAlerts.length.toLocaleString("es-CO")}</b><small>temperatura o ruido</small></article>
                </div>
                <section className="trend-card history-chart">
                  <div className="trend-header">
                    <div><h2>Tendencia del periodo</h2><p>Segundo piso · Green Point</p></div>
                    <label className="metric-select"><select value={metric} aria-label="Seleccionar variable" onChange={(event) => setMetric(event.target.value as Metric)}>
                      {["Temperatura", "Ruido", "Humedad", "Presión"].map((name) => <option key={name}>{name}</option>)}
                    </select><ChevronDownIcon /></label>
                  </div>
                  <TrendChart metric={metric} range={historyPeriod} readings={periodReadings} theme={theme} thresholds={thresholds} />
                </section>
                <section className="history-table-card">
                  <div className="history-table-heading"><div><h2>Registros</h2><span>Más recientes primero</span></div><span className="history-total">{filteredHistory.length} resultados</span></div>
                  {visibleHistory.length ? <>
                    <div className="history-table-scroll"><table className="history-table">
                      <thead><tr><th>Fecha y hora</th><th>Temperatura</th><th>Sensación térmica</th><th>Humedad</th><th>Punto de rocío</th><th>Presión</th><th>Ruido</th><th>Estado</th></tr></thead>
                      <tbody>{visibleHistory.map((item) => {
                        const status = readingStatus(item, thresholds);
                        const derived = calculateReadingDerivedValues(item);
                        return <tr key={item.id}>
                          <td>{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "medium" }).format(item.createdAt)}</td>
                          <td>{item.temperature === null ? "--" : `${item.temperature.toFixed(1)} °C`}</td>
                          <td>{derived.heatIndexC === null ? "--" : `${derived.heatIndexC.toFixed(1)} °C`}</td>
                          <td>{item.humidity === null ? "--" : `${Math.round(item.humidity)} %`}</td>
                          <td>{derived.dewPointC === null ? "--" : `${derived.dewPointC.toFixed(1)} °C`}</td>
                          <td>{item.pressureHpa === null ? "--" : `${item.pressureHpa.toFixed(1)} hPa`}</td>
                          <td>{item.noiseDb === null ? "--" : `${Math.round(item.noiseDb)} dB`}</td>
                          <td><span className={`reading-status status-${status === "Alerta" ? "alert" : status === "Óptimo" ? "optimal" : "incomplete"}`}>{status}</span></td>
                        </tr>;
                      })}</tbody>
                    </table></div>
                    <div className="history-record-cards">{visibleHistory.map((item) => {
                      const status = readingStatus(item, thresholds);
                      const derived = calculateReadingDerivedValues(item);
                      return <article className="history-record-card" key={item.id}>
                        <div className="record-card-heading"><div><b>{item.nodeId}</b><time>{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(item.createdAt)}</time></div><span className={`reading-status status-${status === "Alerta" ? "alert" : status === "Óptimo" ? "optimal" : "incomplete"}`}>{status}</span></div>
                        <div className="record-card-values"><span>Temperatura<b>{item.temperature === null ? "--" : `${item.temperature.toFixed(1)} °C`}</b></span><span>Sensación térmica<b>{derived.heatIndexC === null ? "--" : `${derived.heatIndexC.toFixed(1)} °C`}</b></span><span>Humedad<b>{item.humidity === null ? "--" : `${Math.round(item.humidity)} %`}</b></span><span>Punto de rocío<b>{derived.dewPointC === null ? "--" : `${derived.dewPointC.toFixed(1)} °C`}</b></span><span>Presión<b>{item.pressureHpa === null ? "--" : `${item.pressureHpa.toFixed(1)} hPa`}</b></span><span>Ruido<b>{item.noiseDb === null ? "--" : `${Math.round(item.noiseDb)} dB`}</b></span></div>
                      </article>;
                    })}</div>
                    {visibleHistory.length < filteredHistory.length && <button className="show-more-button" onClick={() => setHistoryVisibleCount((count) => count + 25)}>Mostrar más lecturas</button>}
                  </> : <div className="history-empty"><BarChartIcon /><b>{historyAlertOnly ? "No hay alertas en este periodo" : "No hay lecturas en este periodo"}</b><span>Prueba con otro rango de tiempo o filtro.</span></div>}
                </section>
                <p className="disclaimer">* El nivel sonoro del KY-038 es estimado y no corresponde a una medición acústica certificada.</p>
              </>
            )}

            {tab === "Ubicación" && (
              <section className="info-card location-card">
                <div className="metric-icon location-icon">
                  <SewingPinIcon />
                </div>
                <h2>Segundo piso</h2>
                <p>Green Point · Universidad Autónoma de Occidente</p>
                <div className="location-facts">
                  <span>ID del nodo</span>
                  <b>{reading?.nodeId || import.meta.env.VITE_NODE_ID || "Sin configurar"}</b>
                  <span>Área monitoreada</span>
                  <b>Zona común · Segundo piso</b>
                  <span>Arquitectura</span>
                  <b>ESP32 + DHT22 + BMP280 + KY-038</b>
                  <span>Altitud barométrica</span>
                  <b>{latestBarometricAltitude === null ? "Sin datos" : `${Math.round(latestBarometricAltitude).toLocaleString("es-CO")} m estimados`}</b>
                  <span>Disponibilidad DHT22</span>
                  <b>{allTimeEnvironmentalMetrics.sensorAvailability.dht22 === null ? "Sin datos" : `${allTimeEnvironmentalMetrics.sensorAvailability.dht22.toFixed(1)}%`}</b>
                  <span>Disponibilidad BMP280</span>
                  <b>{allTimeEnvironmentalMetrics.sensorAvailability.bmp280 === null ? "Sin datos" : `${allTimeEnvironmentalMetrics.sensorAvailability.bmp280.toFixed(1)}%`}</b>
                  <span>Disponibilidad KY-038</span>
                  <b>{allTimeEnvironmentalMetrics.sensorAvailability.ky038 === null ? "Sin datos" : `${allTimeEnvironmentalMetrics.sensorAvailability.ky038.toFixed(1)}%`}</b>
                  <span>Intervalo de transmisión</span>
                  <b>Cada 5 minutos</b>
                  <span>Conectividad</span>
                  <b><span className={`node-pill node-pill-${nodeState}`}>{nodeStateLabel}</span> · {firebaseState}</b>
                </div>
                <div className="location-note">
                  Las lecturas representan las condiciones ambientales en el
                  punto donde se encuentra instalado el dispositivo.
                </div>
              </section>
            )}

            {tab === "Configuración" && (
              <section className="info-card settings-card">
                <div className="settings-mark">GP</div>
                <h2>Green Point Comfort</h2>
                <p>Monitoreo ambiental del segundo piso</p>
                <div className="setting-row">
                  <span>Conexión de datos</span>
                  <b>
                    <i className="online-dot" />
                    {firebaseState}
                  </b>
                </div>
                <div className="setting-row appearance-row">
                  <span>Apariencia</span>
                  <button className="theme-toggle settings-theme-toggle" onClick={toggleTheme} aria-pressed={theme === "dark"}>
                    {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                    {theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  </button>
                </div>
                <div className="setting-row">
                  <span>Frecuencia de lectura</span>
                  <b>Cada 5 minutos</b>
                </div>
                <div className="threshold-settings">
                  <label>Temperatura mínima (°C)<input type="number" step="0.1" value={thresholds.temperatureMin} onChange={(event) => { if (event.target.value !== "") updateThreshold("temperatureMin", Number(event.target.value)); }} /></label>
                  <label>Temperatura máxima (°C)<input type="number" step="0.1" value={thresholds.temperatureMax} onChange={(event) => { if (event.target.value !== "") updateThreshold("temperatureMax", Number(event.target.value)); }} /></label>
                  <label>Ruido máximo (dB)<input type="number" step="1" min="0" value={thresholds.noiseMax} onChange={(event) => { if (event.target.value !== "") updateThreshold("noiseMax", Number(event.target.value)); }} /></label>
                  <button className="reset-thresholds" onClick={() => setThresholds(defaultThresholds)}>Restaurar valores por defecto</button>
                </div>
                <div className="setting-row"><span>Umbrales activos</span><b>{thresholds.temperatureMin}–{thresholds.temperatureMax} °C · {thresholds.noiseMax} dB</b></div>
                <p className="disclaimer">
                  Los niveles sonoros son estimados con el sensor KY-038 y
                  requieren calibración de referencia.
                </p>
                <button className="csv-button" onClick={() => exportCsv()}>
                  <DownloadIcon /> Exportar última medición
                </button>
              </section>
            )}
          </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {toast && (
        <div className="toast">
          <CheckCircledIcon />
          {toast}
        </div>
      )}
    </div>
  );
}
