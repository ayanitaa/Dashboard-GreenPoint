import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MobileScroll } from "./mobile";
import {
  BellIcon,
  BarChartIcon,
  ChevronDownIcon,
  GearIcon,
  HamburgerMenuIcon,
  HomeIcon,
  SewingPinIcon,
  MagnifyingGlassIcon,
  SpeakerLoudIcon,
  SunIcon,
  OpacityIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  DownloadIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import "./prototype.css";

type Metric = "Temperatura" | "Ruido" | "Humedad" | "Presión";
type Tab = "Inicio" | "Historial" | "Ubicación" | "Configuración";
type Reading = {
  temperature: number;
  humidity: number;
  pressure: number;
  noise: number;
  createdAt: Date;
};

const zeroReading: Reading = {
  temperature: 0,
  humidity: 0,
  pressure: 0,
  noise: 0,
  createdAt: new Date(0),
};
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
}: {
  metric: Metric;
  range: string;
  readings: Reading[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const values = readings.map((r) =>
    metric === "Temperatura"
      ? r.temperature
      : metric === "Ruido"
        ? r.noise
        : metric === "Humedad"
          ? r.humidity
          : r.pressure,
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
      const min = Math.floor(Math.min(...values) - padding);
      const max = Math.ceil(Math.max(...values) + padding);
      const x = (i: number) =>
        left + (i / (values.length - 1)) * (w - left - right);
      const y = (v: number) =>
        top + ((max - v) / (max - min)) * (h - top - bottom);
      ctx.clearRect(0, 0, w, h);
      ctx.font = '11px "Inter", system-ui, sans-serif';
      ctx.textAlign = "left";
      ctx.fillStyle = "#66716c";
      for (let i = 0; i < 4; i++) {
        const v = max - ((max - min) * i) / 3;
        const yy = y(v);
        ctx.strokeStyle = "#e8ebe6";
        ctx.lineWidth = 0.8;
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
        ctx.strokeStyle = "#f0f1ed";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(xx, top);
        ctx.lineTo(xx, h - bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = "center";
        ctx.fillStyle = "#66716c";
        ctx.fillText(
          range === "7 días"
            ? ["Lun", "Mar", "Mié", "Jue", "Vie"][i]
            : ["00:00", "06:00", "12:00", "18:00", "24:00"][i],
          xx,
          h - 4,
        );
      }
      const line = new Path2D();
      values.forEach((v, i) =>
        i ? line.lineTo(x(i), y(v)) : line.moveTo(x(i), y(v)),
      );
      const area = new Path2D(line);
      area.lineTo(x(values.length - 1), h - bottom);
      area.lineTo(x(0), h - bottom);
      area.closePath();
      const gradient = ctx.createLinearGradient(0, top, 0, h - bottom);
      const rgb =
        metricColor[metric] === "#22a9e8"
          ? "34,169,232"
          : metricColor[metric] === "#477dd2"
            ? "71,125,210"
            : "49,182,84";
      gradient.addColorStop(0, `rgba(${rgb},.22)`);
      gradient.addColorStop(1, `rgba(${rgb},.015)`);
      ctx.fillStyle = gradient;
      ctx.fill(area);
      ctx.strokeStyle = metricColor[metric];
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(line);
      if (values.length === 1) {
        ctx.fillStyle = metricColor[metric];
        ctx.beginPath();
        ctx.arc(x(0), y(values[0]), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    paint();
    const resize = new ResizeObserver(paint);
    resize.observe(el);
    return () => resize.disconnect();
  }, [metric, range, values]);
  if (readings.length === 0)
    return <div className="empty-chart">Aún no hay lecturas para mostrar.</div>;
  return (
    <canvas
      ref={canvas}
      className="trend-canvas"
      aria-label={`Tendencia de ${metric.toLowerCase()} en las últimas ${range}`}
      role="img"
    />
  );
}

function valueFor(reading: Reading, metric: Metric) {
  return metric === "Temperatura"
    ? reading.temperature.toFixed(1)
    : metric === "Ruido"
      ? Math.round(reading.noise).toString()
      : metric === "Humedad"
        ? Math.round(reading.humidity).toString()
        : reading.pressure.toFixed(1);
}

function deltaLabel(current: number, previous: number, unitLabel: string) {
  const delta = current - previous;
  return `${delta >= 0 ? "↑ +" : "↓ −"}${Math.abs(delta).toFixed(1)} ${unitLabel}`;
}

export default function Prototype() {
  const [reading, setReading] = useState<Reading>(zeroReading);
  const [history, setHistory] = useState<Reading[]>([]);
  const [metric, setMetric] = useState<Metric>("Temperatura");
  const [range, setRange] = useState("24 horas");
  const [topView, setTopView] = useState("Tiempo real");
  const [tab, setTab] = useState<Tab>("Inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [firebaseState, setFirebaseState] = useState("Firebase sin configurar");
  const [toast, setToast] = useState("");
  const hasReading = history.length > 0;
  const alert =
    hasReading &&
    (reading.noise > 75 ||
      reading.temperature < 22 ||
      reading.temperature > 26);
  const lastTime = useMemo(
    () =>
      hasReading
        ? new Intl.DateTimeFormat("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(reading.createdAt)
        : "Sin lecturas",
    [reading.createdAt, hasReading],
  );
  const hourAgoReading = hasReading
    ? history
        .slice()
        .reverse()
        .find(
          (r) =>
            r.createdAt.getTime() <=
            reading.createdAt.getTime() - 60 * 60 * 1000,
        )
    : undefined;

  useEffect(() => {
    const cfg = (import.meta as ImportMeta & { env?: Record<string, string> })
      .env;
    const needed = [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_APP_ID",
    ];
    if (!cfg || !needed.every((k) => cfg[k])) {
      setFirebaseState("Firebase sin configurar · esperando sensores");
      return;
    }
    let alive = true;
    setFirebaseState("Conectando a Firebase…");
    let unsubscribe = () => {};
    import("firebase/app")
      .then(async ({ initializeApp, getApps }) => {
        const {
          getFirestore,
          collection,
          query,
          orderBy,
          limit,
          where,
          Timestamp,
          onSnapshot,
        } = await import("firebase/firestore");
        const app =
          getApps()[0] ??
          initializeApp({
            apiKey: cfg.VITE_FIREBASE_API_KEY,
            authDomain: cfg.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: cfg.VITE_FIREBASE_PROJECT_ID,
            appId: cfg.VITE_FIREBASE_APP_ID,
          });
        if (!alive) return;
        const db = getFirestore(app);
        const from = Timestamp.fromDate(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        );
        const q = query(
          collection(db, "readings"),
          where("createdAt", ">=", from),
          orderBy("createdAt", "desc"),
          limit(2200),
        );
        unsubscribe = onSnapshot(
          q,
          (snap) => {
            if (!alive) return;
            if (snap.empty) {
              setHistory([]);
              setReading(zeroReading);
              setFirebaseState("Sin lecturas en Firebase");
              return;
            }
            const recent = snap.docs.map((doc) => {
              const d = doc.data();
              const createdAt =
                typeof d.createdAt?.toDate === "function"
                  ? d.createdAt.toDate()
                  : new Date(d.createdAt ?? Date.now());
              return {
                temperature: Number(d.temperature ?? d.temperatureC ?? 0),
                humidity: Number(d.humidity ?? 0),
                pressure: Number(d.pressure ?? d.pressureHpa ?? 0),
                noise: Number(d.noiseDb ?? d.noise ?? 0),
                createdAt,
              };
            });
            setHistory(recent.slice().reverse());
            setReading(recent[0]);
            setFirebaseState("En vivo · Firebase");
          },
          () => setFirebaseState("Sin conexión · último dato guardado"),
        );
      })
      .catch(() => setFirebaseState("Sin conexión a Firebase"));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const exportCsv = async () => {
    setToast("Preparando archivo…");
    let records: Reading[] = [];
    try {
      const cfg = (import.meta as ImportMeta & { env?: Record<string, string> })
        .env;
      if (
        cfg?.VITE_FIREBASE_API_KEY &&
        cfg.VITE_FIREBASE_PROJECT_ID &&
        cfg.VITE_FIREBASE_APP_ID
      ) {
        const [
          { initializeApp, getApps },
          {
            getFirestore,
            collection,
            query,
            orderBy,
            limit,
            where,
            Timestamp,
            getDocs,
          },
        ] = await Promise.all([
          import("firebase/app"),
          import("firebase/firestore"),
        ]);
        const app =
          getApps()[0] ??
          initializeApp({
            apiKey: cfg.VITE_FIREBASE_API_KEY,
            authDomain: cfg.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: cfg.VITE_FIREBASE_PROJECT_ID,
            appId: cfg.VITE_FIREBASE_APP_ID,
          });
        const from = Timestamp.fromDate(
          new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
        );
        const snap = await getDocs(
          query(
            collection(getFirestore(app), "readings"),
            where("createdAt", ">=", from),
            orderBy("createdAt", "desc"),
            limit(22000),
          ),
        );
        if (!snap.empty)
          records = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              temperature: Number(d.temperature ?? d.temperatureC ?? 0),
              humidity: Number(d.humidity ?? 0),
              pressure: Number(d.pressure ?? d.pressureHpa ?? 0),
              noise: Number(d.noiseDb ?? d.noise ?? 0),
              createdAt:
                typeof d.createdAt?.toDate === "function"
                  ? d.createdAt.toDate()
                  : new Date(d.createdAt ?? Date.now()),
            };
          });
      } else {
        setToast("Configura Firebase para exportar las lecturas");
        window.setTimeout(() => setToast(""), 2400);
        return;
      }
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
    const rows: (string | number)[][] = [
      [
        "fecha_hora",
        "temperatura_c",
        "humedad_pct",
        "presion_hpa",
        "ruido_estimado_db",
      ],
      ...records.map((r) => [
        r.createdAt.toISOString(),
        r.temperature,
        r.humidity,
        r.pressure,
        r.noise,
      ]),
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
  return (
    <div className="app-shell">
      <MobileScroll className="app-screen">
        <main className="screen-content">
          <header className="hero">
            <div className="hero-actions">
              <button
                className="icon-button"
                aria-label="Abrir menú"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <HamburgerMenuIcon />
              </button>
              <button
                className="icon-button"
                aria-label="Notificaciones"
                onClick={() => setNoticeOpen((v) => !v)}
              >
                <BellIcon />
              </button>
            </div>
            {menuOpen && (
              <div className="menu-popover">
                <button
                  onClick={() => {
                    setTab("Inicio");
                    setMenuOpen(false);
                  }}
                >
                  Panel principal
                </button>
                <button
                  onClick={() => {
                    setTab("Historial");
                    setMenuOpen(false);
                  }}
                >
                  Datos históricos
                </button>
                <button
                  onClick={() => {
                    setTab("Configuración");
                    setMenuOpen(false);
                  }}
                >
                  Sobre el proyecto
                </button>
              </div>
            )}
            <button
              className="brand-lockup"
              onClick={() => {
                setTab("Inicio");
                setTopView("Tiempo real");
              }}
              aria-label="Green Point, inicio"
            >
              <SunIcon className="brand-leaf" />
              <span>
                Green
                <br />
                point
              </span>
            </button>
            <div className="hero-title">Monitoreo Ambiental</div>
            <div className="hero-place">
              <SewingPinIcon /> Segundo Piso <span className="status-live" />
            </div>
            <div
              className="top-tabs"
              role="tablist"
              aria-label="Vista del dashboard"
            >
              {["Tiempo real", "Historial", "Estadísticas"].map((name) => (
                <button
                  role="tab"
                  aria-selected={topView === name}
                  className={topView === name ? "active" : ""}
                  key={name}
                  onClick={() => {
                    setTopView(name);
                    if (name === "Historial") setTab("Historial");
                    else if (name === "Tiempo real") setTab("Inicio");
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </header>

          <div className="content-pad">
            {noticeOpen && (
              <div className={`alert-banner ${alert ? "warning" : "ok"}`}>
                <span>
                  {alert ? <ExclamationTriangleIcon /> : <CheckCircledIcon />}
                </span>
                <div>
                  <b>
                    {!hasReading
                      ? "Esperando datos ambientales"
                      : alert
                        ? "Revisar condiciones ambientales"
                        : "Ambiente dentro de los rangos"}
                  </b>
                  <small>
                    {!hasReading
                      ? "Las lecturas aparecerán cuando el ESP32 las registre en Firebase."
                      : alert
                        ? `Ruido: ${reading.noise} dB · Temperatura: ${reading.temperature} °C`
                        : "Sin alertas activas en este momento"}
                  </small>
                </div>
                <button
                  aria-label="Cerrar"
                  onClick={() => setNoticeOpen(false)}
                >
                  <Cross2Icon />
                </button>
              </div>
            )}
            {alert && (
              <div className="alert-banner warning">
                <span>
                  <ExclamationTriangleIcon />
                </span>
                <div>
                  <b>Alerta ambiental</b>
                  <small>
                    {reading.noise > 75
                      ? "Ruido superior al límite operativo de 75 dB."
                      : "Temperatura fuera del rango de referencia de 22–26 °C."}
                  </small>
                </div>
              </div>
            )}

            {tab === "Inicio" && (
              <>
                <div className="metric-grid">
                  <article className="metric-card temp-card">
                    <div className="metric-icon temp-icon">
                      <SunIcon />
                    </div>
                    <div className="metric-main">
                      <div className="metric-label">Temperatura</div>
                      <div className="metric-value">
                        {reading.temperature.toFixed(1)} <small>°C</small>
                      </div>
                      <div
                        className={`metric-delta ${hasReading && (reading.temperature > 26 || reading.temperature < 22) ? "bad" : ""}`}
                      >
                        {hourAgoReading
                          ? deltaLabel(
                              reading.temperature,
                              hourAgoReading.temperature,
                              "°C",
                            )
                          : "Sin dato previo"}
                      </div>
                      <div className="metric-caption">
                        {hourAgoReading
                          ? "vs. hace 1 hora"
                          : "esperando historial"}
                      </div>
                    </div>
                  </article>
                  <article className="metric-card noise-card">
                    <div className="metric-icon noise-icon">
                      <SpeakerLoudIcon />
                    </div>
                    <div className="metric-main">
                      <div className="metric-label">Nivel de Ruido</div>
                      <div className="metric-value">
                        {Math.round(reading.noise)} <small>dB</small>
                      </div>
                      <div
                        className={`metric-delta ${hasReading && reading.noise > 75 ? "bad" : ""}`}
                      >
                        {hourAgoReading
                          ? deltaLabel(
                              reading.noise,
                              hourAgoReading.noise,
                              "dB",
                            )
                          : "Sin dato previo"}
                      </div>
                      <div className="metric-caption">
                        {hourAgoReading
                          ? "vs. hace 1 hora"
                          : "esperando historial"}
                      </div>
                    </div>
                  </article>
                </div>
                <article className="humidity-card">
                  <div className="metric-icon humidity-icon">
                    <OpacityIcon />
                  </div>
                  <div className="humidity-info">
                    <span className="metric-label">Humedad</span>
                    <strong>
                      {Math.round(reading.humidity)} <small>%</small>
                    </strong>
                  </div>
                  <div className="humidity-side">
                    <span className="healthy-pill">
                      {hasReading
                        ? reading.humidity > 70
                          ? "Alta"
                          : "Normal"
                        : "Sin dato"}
                    </span>
                    <div className="humidity-track">
                      <i style={{ width: `${reading.humidity}%` }} />
                    </div>
                  </div>
                </article>
                <div className="pressure-strip">
                  <span>Presión atmosférica</span>
                  <b>
                    {reading.pressure.toFixed(1)} <small>hPa</small>
                  </b>
                  <span className="sensor-dot" /> BMP280
                </div>
                <section className="trend-card">
                  <div className="trend-header">
                    <div>
                      <h2>
                        {topView === "Estadísticas"
                          ? "Estadísticas ambientales"
                          : "Tendencia de las últimas 24 horas"}
                      </h2>
                      <p>
                        {firebaseState} <span>·</span> hoy, {lastTime}
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
                <div className="history-summary">
                  <span>Registros ambientales</span>
                  <b>Últimas {range.toLowerCase()}</b>
                </div>
                <section className="trend-card history-chart">
                  <div className="trend-header">
                    <div>
                      <h2>Historial ambiental</h2>
                      <p>Segundo piso · Green Point</p>
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
                  <div className="range-tabs">
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
                  <TrendChart
                    metric={metric}
                    range={range}
                    readings={chartReadings}
                  />
                </section>
                <div className="history-list">
                  <h3>Mediciones recientes</h3>
                  {history.length > 0 ? (
                    history
                      .slice()
                      .reverse()
                      .slice(0, 3)
                      .map((r, i) => (
                        <div
                          className="reading-row"
                          key={r.createdAt.toISOString()}
                        >
                          <span className="history-time">
                            {new Intl.DateTimeFormat("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            }).format(r.createdAt)}
                            <small>
                              {i === 0 ? "Reciente" : `${i * 5} min`}
                            </small>
                          </span>
                          <span>
                            <b>{r.temperature.toFixed(1)} °C</b>
                            <small>Temperatura</small>
                          </span>
                          <span>
                            <b>{Math.round(r.humidity)}%</b>
                            <small>Humedad</small>
                          </span>
                          <span>
                            <b>{Math.round(r.noise)} dB</b>
                            <small>Ruido*</small>
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="empty-state">
                      Las lecturas aparecerán aquí cuando el ESP32 las envíe a
                      Firebase.
                    </div>
                  )}
                </div>
                <button className="csv-button" onClick={exportCsv}>
                  <DownloadIcon /> Descargar datos CSV
                </button>
                <p className="disclaimer">
                  * Nivel sonoro estimado. No corresponde a una medición
                  acústica certificada.
                </p>
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
                  <span>Dispositivo</span>
                  <b>Green Point Comfort</b>
                  <span>Área monitoreada</span>
                  <b>Zona común · Segundo piso</b>
                  <span>Conectividad</span>
                  <b>{firebaseState}</b>
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
                <div className="setting-row">
                  <span>Frecuencia de lectura</span>
                  <b>Cada 5 minutos</b>
                </div>
                <div className="setting-row">
                  <span>Alerta de ruido</span>
                  <b>Sobre 75 dB</b>
                </div>
                <div className="setting-row">
                  <span>Rango de temperatura</span>
                  <b>22–26 °C</b>
                </div>
                <p className="disclaimer">
                  Los niveles sonoros son estimados con el sensor KY-038 y
                  requieren calibración de referencia.
                </p>
                <button className="csv-button" onClick={exportCsv}>
                  <DownloadIcon /> Exportar última medición
                </button>
              </section>
            )}
          </div>
        </main>
      </MobileScroll>
      <nav className="bottom-nav" aria-label="Navegación principal">
        {(
          [
            ["Inicio", <HomeIcon />],
            ["Historial", <BarChartIcon />],
            ["Ubicación", <SewingPinIcon />],
            ["Configuración", <GearIcon />],
          ] as [Tab, ReactNode][]
        ).map(([name, icon]) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            onClick={() => {
              setTab(name);
              if (name === "Historial") setTopView(name);
              else if (name === "Inicio") setTopView("Tiempo real");
            }}
          >
            <span className="nav-icon">{icon}</span>
            <small>{name}</small>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast">
          <CheckCircledIcon />
          {toast}
        </div>
      )}
    </div>
  );
}
