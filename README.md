# Green Point Comfort

Dashboard web móvil para consultar las condiciones ambientales del segundo piso de Green Point.

## Stack

- React + TypeScript + Vite para una interfaz móvil rápida y accesible desde navegador.
- Firebase Cloud Firestore para historial y escucha de la última medición en tiempo real.
- Firebase Hosting para publicación HTTPS mediante un QR en las mesas.
- ESP32 Arduino Core para integrar DHT22, BMP280 y KY-038 en el prototipo físico.

## Ejecutar

```sh
npm ci
npm run dev
```

La aplicación inicia con todos los valores en `0` y un gráfico vacío. Solo mostrará mediciones cuando el ESP32 las registre en Firebase. Copia `.env.example` a `.env.local`, completa los valores de la configuración web de Firebase y reinicia Vite para activar la consulta a Firestore.

La web consulta la colección `readings`, ordenada por `createdAt` descendente. Cada documento debe incluir:

```json
{
  "temperature": 0,
  "humidity": 0,
  "pressure": 0,
  "noiseDb": 0,
  "createdAt": "Firestore Timestamp"
}
```

El ESP32 debe registrar una medición cada cinco minutos. El dashboard muestra temperatura, humedad, presión, ruido estimado, tendencias de 24 horas y 7 días, fecha de la última lectura y alertas sobre 75 dB o fuera del rango 22–26 °C. La exportación CSV incluye hasta 22.000 registros de los últimos 70 días. El KY-038 requiere calibración de referencia: sus valores en dB son aproximados y no constituyen mediciones acústicas certificadas.

## Seguridad de Firestore

`firestore.rules` permite consultas públicas y limita las escrituras a identidades autenticadas cuyo token incluya la afirmación personalizada `device: true`. Asigna esa afirmación únicamente al usuario o credencial del ESP32 y no incrustes una clave privada de cuenta de servicio en el firmware. Las reglas deben publicarse en Firebase Console antes de poner el sistema en uso.

El dashboard no necesita iniciar sesión para leer las mediciones. No se incluyeron credenciales del proyecto Firebase; configura `.env.local` para que la web pueda escuchar la colección. Sin Firebase configurado, los indicadores quedan en cero y se muestra que la conexión está pendiente.
