import { useEffect, useState } from "react";
import type { FirebaseConnectionState, NodeOperationalState, TelemetryReading } from "../types/telemetry";
import { FRESHNESS_POLL_INTERVAL_MS, OFFLINE_THRESHOLD_MS, STALE_THRESHOLD_MS } from "../types/telemetry";
import { subscribeToTelemetry } from "../services/firebaseTelemetry";

export function useTelemetry(nodeId?: string) {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [connectionState, setConnectionState] = useState<FirebaseConnectionState>("idle");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setConnectionState("connecting");
    subscribeToTelemetry(
      (nextReadings) => {
        if (!active) return;
        setReadings(nextReadings);
        setConnectionState("connected");
      },
      () => { if (active) setConnectionState("error"); },
      nodeId,
    ).then((stop) => {
      if (active) unsubscribe = stop;
      else stop();
    }).catch(() => { if (active) setConnectionState("error"); });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [nodeId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), FRESHNESS_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const latest = readings[readings.length - 1] ?? null;
  const ageMs = latest ? now - latest.createdAt.getTime() : null;
  const nodeState: NodeOperationalState = !latest
    ? "no-data"
    : ageMs === null || !Number.isFinite(ageMs) || ageMs > OFFLINE_THRESHOLD_MS
      ? "offline"
      : ageMs > STALE_THRESHOLD_MS
        ? "stale"
        : "online";
  const lastSeenText = ageMs === null
    ? "Sin datos"
    : !Number.isFinite(ageMs)
      ? "Tiempo desconocido"
      : ageMs < 60 * 1000
        ? "hace unos segundos"
        : ageMs < 60 * 60 * 1000
          ? `hace ${Math.floor(ageMs / (60 * 1000))} min`
          : ageMs < 24 * 60 * 60 * 1000
            ? `hace ${Math.floor(ageMs / (60 * 60 * 1000))} h`
            : `hace ${Math.floor(ageMs / (24 * 60 * 60 * 1000))} d`;

  return { readings, latest, connectionState, nodeState, lastSeenText };
}
