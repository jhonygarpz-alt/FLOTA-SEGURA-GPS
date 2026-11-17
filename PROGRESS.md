# PROGRESS — FLOTA SEGURA GPS

Última actualización: 2026-11-17

## Fase 1 — Fundamentos ✅

| Funcionalidad | Estado | Notas |
|---|---|---|
| Análisis del repositorio | ✅ | Repositorio vacío; monorepo npm workspaces |
| Arquitectura | ✅ | `docs/ARQUITECTURA.md` |
| GitHub / CI | ✅ | GitHub Actions: pruebas API con PostgreSQL, typecheck, pruebas y build web |
| Base administrativa (Prisma) | ✅ | Empresas, usuarios, sesiones, unidades, dispositivos, SIM, operadores, planes, suscripciones, auditoría |
| Autenticación | ✅ | argon2id, JWT 15 min, refresh rotatorio en cookie httpOnly, bloqueo por intentos |
| MFA (TOTP) | ✅ | Alta con QR desde Configuración |
| Roles y permisos granulares | ✅ | 7 roles + concesiones/revocaciones por usuario (API); editor visual de permisos pendiente |
| Aislamiento multiempresa | ✅ | API, consultas, WebSocket y grupos de Traccar; pruebas automatizadas |
| Auditoría | ✅ | Registro en BD; endpoint `/api/audit` (pantalla pendiente) |
| Límites de solicitudes | ✅ | Global y en autenticación |
| Layout principal | ✅ | Barra lateral compacta (escritorio), pestañas inferiores (móvil) |
| Pantalla de inicio tipo iPhone | ✅ | 15 módulos, colores, insignias reales, estados |
| Modo claro / oscuro | ✅ | Incluye mapa oscuro |
| PWA instalable | ✅ | Manifest, íconos, service worker sin caché de `/api` |
| Modo demostración | ✅ | Empresa demo de solo lectura, 7 unidades simuladas, franja visible |
| Instalación de Traccar | ✅ | `infra/traccar` (cloud-init, compose, Caddy, firewall, respaldos) |
| Configuración regional | ✅ | es-MX, km/h, km, MXN, UTC interno, zona horaria por empresa |

## Fase 2 — Rastreo funcional (avanzada)

| Funcionalidad | Estado | Notas |
|---|---|---|
| Integración REST con Traccar | ✅ | Sesión, dispositivos, grupos, posiciones, ruta, eventos |
| WebSocket de Traccar con reconexión | ✅ | Retroceso exponencial |
| Registro de dispositivos | ✅ | Valida protocolo/puerto contra catálogo oficial |
| Asistente de 8 pasos | ✅ | Con diagnóstico en vivo y ficha de configuración |
| Asignación a vehículos | ✅ | |
| Mapa en tiempo real | ✅ | MapLibre, agrupación, rumbo, filtros, búsqueda, seguimiento, tarjeta |
| Prueba con Traccar real | ✅ | Traccar 6.16.0 en Docker + posición OsmAnd: «Conectado correctamente» |
| Prueba con Traccar Client en teléfono | ⏳ | Requiere VPS desplegado |
| Primer GPS físico | ⏳ | Requiere equipo y SIM |

## Pendiente (fases 3–5)
- Recorridos: reproducción animada (la API `/devices/:id/route` ya existe), paradas, km, exportación.
- Geocercas, rutas autorizadas, restricciones horarias.
- Centro de alertas con responsables, comentarios, evidencias y escalamiento.
- Centro de monitoreo: turnos, bitácora, barridos, protocolos de emergencia.
- Reportes (PDF, Excel, CSV) y dashboard ejecutivo.
- Panel comercial completo: planes, suscripciones, renovaciones, inventario de GPS y SIM.
- Compartir ubicación con enlace temporal.
- Comandos remotos con doble autorización y bloqueo de inmovilización en movimiento.
- Combustible, videomonitoreo (arquitectura modular), integración con Flota Segura ERP.
- Carga de fotografías (almacenamiento de archivos por empresa).
- Editor visual de permisos y pantalla de auditoría.

## Dependencias externas (requieren acción del propietario)

| Dependencia | Estado | Acción |
|---|---|---|
| Cuenta Railway (plan de pago tras la prueba) | ⏳ Pendiente de autorización | `docs/INSTALACION.md` parte A |
| VPS Hetzner con IPv4 pública | ⏳ Pendiente de autorización | Parte B |
| Dominio propio (opcional) | Opcional | Se usa `<ip>.sslip.io` sin costo |
| Proveedor de mapa satelital / tráfico | Opcional | Requiere licencia (p. ej. MapTiler); variable `VITE_SATELLITE_STYLE_URL` |
| Equipos Suntech ST8300RP y AT6 | ⏳ | Confirmar etiqueta (fabricante/modelo/firmware) |
| SIM con datos y APN | ⏳ | Operador del cliente |
| Precios de los planes (MXN) | ⏳ | Los planes se crean con precio 0; definir por SECUREFLEET |

## Decisiones técnicas
- Monorepo con npm workspaces (`apps/api`, `apps/web`).
- Traccar 6.16.0 fijado (estable); TimescaleDB 2.30.2-pg17 según ejemplo oficial.
- Bases de datos separadas: administrativa (Railway) y Traccar (VPS).
- La web (nginx) reenvía `/api` a la API por la red privada de Railway: mismo origen, cookies `SameSite=Strict`.
- Traccar oculto tras Caddy con encabezado secreto; panel solo por túnel SSH.
- Mapa base OpenFreeMap (sin clave, uso comercial permitido).
- Catálogo de equipos generado desde traccar.org/devices (2026-11-17).
- Sin datos inventados: si el equipo no reporta un dato, se muestra «No reportado».

## Pruebas
- Backend: 28 (unitarias, aislamiento multiempresa, refresh token, bloqueo, demo, registro de dispositivos, flujo completo con Traccar simulado).
- Frontend: 6 (lógica de estados de vehículo) + verificación visual con Playwright en escritorio y iPhone.
- Contenedores: imágenes `api` y `web` construidas y probadas (migraciones, seed, proxy nginx, WebSocket).
- VPS: compose de producción probado (TimescaleDB + Traccar + Caddy: 403 sin encabezado, 200 con encabezado).
