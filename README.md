# FLOTA SEGURA GPS

Plataforma SaaS de rastreo satelital de **SECUREFLEET CONSULTING** para empresas de transporte de carga, hidrocarburos, logística, flotillas y clientes particulares.

Traccar Server es el motor que recibe y decodifica las señales GPS. Flota Segura GPS es una plataforma independiente con su propia interfaz, administración multiempresa, seguridad e identidad corporativa.

```
 Equipos GPS (Suntech, Teltonika, Queclink, Concox/Jimi…)  ·  Teléfono con Traccar Client
                      │  SIM / Internet  →  IP pública + puerto (TCP/UDP/HTTP)
                      ▼
 ┌──────────── VPS (Hetzner) ─────────────┐        ┌──────────────── Railway ────────────────┐
 │ Traccar 6.16.0  ── TimescaleDB (privada)│ HTTPS  │ API NestJS ── PostgreSQL administrativo │
 │ Caddy HTTPS + encabezado secreto        │◀──────▶│   REST + WebSocket (Socket.IO)          │
 └─────────────────────────────────────────┘        │ Web (PWA React) ── nginx /api → API     │
                                                    └─────────────────────────────────────────┘
                                                                 ▼
                                             Navegador · iPhone/Android (PWA instalable)
```

## Estado

Fase 1 completa y parte de la fase 2 (rastreo funcional). Detalle en [PROGRESS.md](PROGRESS.md).

- Integración verificada contra **Traccar 6.16.0 real**: registro del equipo → posición enviada con el protocolo de Traccar Client → recepción en tiempo real → diagnóstico «Conectado correctamente».
- 34 pruebas automatizadas (28 backend, 6 frontend), incluidas pruebas de aislamiento entre empresas.

## Estructura

| Ruta | Contenido |
|---|---|
| `apps/api` | Backend NestJS + Prisma (PostgreSQL), integración con Traccar, WebSocket |
| `apps/web` | Frontend React + Vite + Tailwind, PWA, MapLibre |
| `infra/traccar` | Instalación del VPS de Traccar (compose, Caddy, cloud-init, respaldos) |
| `docs/` | Arquitectura, instalación, conexión de dispositivos, manual de usuario |
| `scripts/` | Respaldo de la base administrativa |

## Documentación

- [Arquitectura y seguridad](docs/ARQUITECTURA.md)
- [Manual de instalación (Railway + VPS)](docs/INSTALACION.md)
- [Manual de conexión de dispositivos](docs/CONEXION-DISPOSITIVOS.md)
- [Manual de usuario](docs/MANUAL-USUARIO.md)

## Desarrollo (referencia técnica)

```bash
npm install
npm run dev:api      # API en :3000 (requiere DATABASE_URL y secretos JWT)
npm run dev:web      # Web en :5173 (proxy /api → :3000)
npm test
```

Variables de entorno: ver [.env.example](.env.example). Nunca suba credenciales reales al repositorio.
