export type TelemetryReading = {
  id: string;
  nodeId: string;
  temperature: number | null;
  humidity: number | null;
  pressureHpa: number | null;
  noiseDb: number | null;
  createdAt: Date;
};

export type FirebaseConnectionState = "idle" | "connecting" | "connected" | "error";
export type NodeOperationalState = "online" | "stale" | "offline" | "no-data";

export const TEMP_MIN = 22.0;
export const TEMP_MAX = 26.0;
export const NOISE_MAX = 75.0;
export const STALE_THRESHOLD_MS = 6 * 60 * 1000;
export const OFFLINE_THRESHOLD_MS = 11 * 60 * 1000;
export const FRESHNESS_POLL_INTERVAL_MS = 10 * 1000;
