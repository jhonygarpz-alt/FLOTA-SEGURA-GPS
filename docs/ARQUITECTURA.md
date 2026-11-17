# Arquitectura

## Componentes

| Componente | Tecnología | Dónde se ejecuta |
|---|---|---|
| Web / PWA | React 18, TypeScript, Vite 6, Tailwind 3, Lucide, MapLibre GL 4 | Railway (nginx) |
| API | NestJS 11, Prisma 6, Socket.IO, argon2, otplib | Railway |
| Base administrativa | PostgreSQL | Railway (red privada) |
| Motor GPS | Traccar 6.16.0 | VPS con IP pública |
| Base de Traccar | TimescaleDB 2.30 (PostgreSQL 17) | VPS (sin puerto público) |
| HTTPS de Traccar | Caddy 2.11 (Let's Encrypt) | VPS |

Las dos bases de datos son independientes: la de Flota Segura guarda empresas, usuarios, unidades, dispositivos, SIM, operadores, planes y auditoría; la de Traccar guarda posiciones y eventos.

## Flujo de datos en tiempo real

1. El equipo GPS transmite a `IP-del-VPS:puerto` (p. ej. Suntech 5011, Teltonika 5027, Traccar Client 5055).
2. Traccar decodifica y guarda la posición.
3. La API mantiene **una** conexión WebSocket administrativa con Traccar (`/api/socket`) con reconexión automática (retroceso exponencial hasta 60 s).
4. Cada posición se asocia a su dispositivo → empresa mediante el `DeviceRegistry`. Las posiciones de equipos no registrados en Flota Segura se descartan.
5. La API emite la posición normalizada (km/h, UTC) solo a la sala Socket.IO `company:<id>` de la empresa propietaria.
6. La PWA actualiza el mapa; al reconectar recarga la flota completa por REST.

## Multiempresa

- Toda consulta filtra por `companyId` tomado del token, nunca del cliente (`common/tenant.ts`). Un `companyId` enviado por un usuario de empresa se ignora.
- El superadministrador (SECUREFLEET) opera sobre todas las empresas y debe indicar explícitamente la empresa destino al escribir.
- WebSocket: cada socket se autentica con el token y se une únicamente a la sala de su empresa.
- En Traccar, cada empresa tiene su propio grupo (`FS · <empresa>`); las credenciales administrativas de Traccar solo existen en el backend.
- Pruebas automatizadas verifican lectura, escritura, borrado, inyección de `companyId` y WebSocket entre empresas.

## Roles y permisos

Roles: Superadministrador, Administrador de empresa, Gerente, Supervisor, Monitorista, Instalador, Usuario de consulta. Cada rol tiene permisos base por módulo y acción (`common/permissions.ts`) y cada usuario puede recibir concesiones o revocaciones individuales (`User.permissions`), excepto `platform:admin`.

## Seguridad

| Control | Implementación |
|---|---|
| Contraseñas | argon2id; bloqueo de 15 min tras 5 intentos fallidos; mensaje genérico |
| Sesión | JWT de acceso de 15 min en memoria; refresh token aleatorio (hash SHA-256 en BD) en cookie `httpOnly`, `Secure`, `SameSite=Strict`, con rotación y detección de reutilización |
| MFA | TOTP (Google/Microsoft Authenticator) |
| Límites | 300 solicitudes/min por IP; 10/min en inicio de sesión |
| Validación | class-validator con lista blanca; campos desconocidos se rechazan |
| Cabeceras | helmet (API), HSTS, X-Frame-Options, nosniff (nginx) |
| Mismo origen | nginx del servicio web reenvía `/api` a la API: sin cookies de terceros |
| Traccar | puerto 8082 solo en 127.0.0.1; Caddy exige el encabezado `X-Flota-Proxy-Key`; registro público deshabilitado |
| PostgreSQL | sin puertos públicos (red privada de Railway / red Docker del VPS) |
| Auditoría | `AuditLog`: inicios de sesión, fallos, cambios de unidades, dispositivos, usuarios y empresas |
| Ubicación | la PWA nunca guarda en caché respuestas de `/api` |
| Demo | empresa `isDemo`, de solo lectura, datos marcados `source: 'demo'` y banda visible |

## Decisiones técnicas

- **Traccar 6.16.0**: última versión estable con más de un mes publicada al iniciar (6.17.0 salió el 1 nov 2026).
- **TimescaleDB** para Traccar, según el ejemplo oficial de producción.
- **Mapa**: OpenFreeMap (sin clave, uso comercial permitido). La vista satelital solo se activa si se configura un proveedor autorizado (`VITE_SATELLITE_STYLE_URL`). El tráfico requerirá un proveedor con licencia.
- **Catálogo de equipos**: generado de https://www.traccar.org/devices/ (447 modelos de 12 fabricantes + Traccar Client). El backend rechaza combinaciones protocolo/puerto que no estén en el catálogo.
- **Protocolos activos en el VPS**: osmand, suntech, teltonika, gt06, gl200 (clave oficial `protocols.enable`). Se amplían editando `TRACCAR_PROTOCOLS` y los puertos en `compose.yaml`.
