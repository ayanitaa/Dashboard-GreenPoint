import type { TelemetryReading } from "../types/telemetry";

type FirebaseConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

type RawReading = Record<string, unknown>;
type ReadingSnapshot = {
  id: string;
  data: () => RawReading;
};

function firebaseConfig(): FirebaseConfig | null {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
  } = import.meta.env;
  if (!VITE_FIREBASE_API_KEY || !VITE_FIREBASE_PROJECT_ID || !VITE_FIREBASE_APP_ID) return null;
  return {
    apiKey: VITE_FIREBASE_API_KEY,
    projectId: VITE_FIREBASE_PROJECT_ID,
    appId: VITE_FIREBASE_APP_ID,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
}

async function getReadingsCollection() {
  const config = firebaseConfig();
  if (!config) throw new Error("Firebase is not configured");
  const [{ getApps, initializeApp }, firestore] = await Promise.all([
    import("firebase/app"),
    import("firebase/firestore"),
  ]);
  const app = getApps()[0] ?? initializeApp(config);
  return { firestore, collection: firestore.collection(firestore.getFirestore(app), "readings") };
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validDate(value: unknown): Date | null {
  const date = value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
    ? value.toDate()
    : value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}

export function mapTelemetryReading(id: string, raw: RawReading): TelemetryReading | null {
  const createdAt = validDate(raw.createdAt);
  if (!createdAt) return null;
  return {
    id,
    nodeId: typeof raw.nodeId === "string" && raw.nodeId ? raw.nodeId : "legacy-unknown",
    temperature: finiteNumber(raw.temperature ?? raw.temperatureC),
    humidity: finiteNumber(raw.humidity),
    pressureHpa: finiteNumber(raw.pressureHpa ?? raw.pressure),
    noiseDb: finiteNumber(raw.noiseDb ?? raw.noise),
    createdAt,
  };
}

function filterForNode(readings: TelemetryReading[], nodeId?: string) {
  if (!nodeId) return readings;
  // Include legacy documents without nodeId during migration/testing.
  return readings.filter((reading) => reading.nodeId === nodeId || reading.nodeId === "legacy-unknown");
}

export async function subscribeToTelemetry(
  onReadings: (readings: TelemetryReading[]) => void,
  onError: (error: Error) => void,
  nodeId?: string,
): Promise<() => void> {
  const { firestore, collection } = await getReadingsCollection();
  const from = firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const request = firestore.query(
    collection,
    firestore.where("createdAt", ">=", from),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(2200),
  );
  return firestore.onSnapshot(request, (snapshot) => {
    const readings = snapshot.docs
      .map((doc: ReadingSnapshot) => mapTelemetryReading(doc.id, doc.data()))
      .filter((reading: TelemetryReading | null): reading is TelemetryReading => reading !== null);
    onReadings(filterForNode(readings, nodeId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
  }, (error: Error) => onError(error));
}

export async function fetchTelemetryForExport(nodeId?: string): Promise<TelemetryReading[]> {
  const { firestore, collection } = await getReadingsCollection();
  const from = firestore.Timestamp.fromDate(new Date(Date.now() - 70 * 24 * 60 * 60 * 1000));
  const snapshot = await firestore.getDocs(firestore.query(
    collection,
    firestore.where("createdAt", ">=", from),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(22000),
  ));
  const readings = snapshot.docs
    .map((doc: ReadingSnapshot) => mapTelemetryReading(doc.id, doc.data()))
    .filter((reading: TelemetryReading | null): reading is TelemetryReading => reading !== null);
  return filterForNode(readings, nodeId);
}
