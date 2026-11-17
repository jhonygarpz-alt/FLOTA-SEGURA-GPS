# Manual de instalación

No necesita instalar programas en su computadora. Todo se hace desde el navegador.

> **Costos.** Railway y Hetzner son servicios de pago. Railway ofrece créditos de prueba únicos; después requiere un plan (Hobby o superior). Hetzner cobra por hora el servidor y la IPv4 pública. Verifique los precios vigentes en cada sitio antes de contratar. No contrate nada hasta autorizarlo.

Orden recomendado: **Parte A (Railway)** → **Parte B (VPS Traccar)** → **Parte C (unir ambos)** → **Parte D (primer equipo)**.

---

## Parte A — Railway: API, base de datos y aplicación web

### A1. Crear el proyecto
1. Entre a **https://railway.com** → **Login** → **Continue with GitHub** y autorice.
2. **New Project** → **Deploy from GitHub repo**.
3. Si no aparece el repositorio, pulse **Configure GitHub App** y dé acceso a `FLOTA-SEGURA-GPS`.
4. Seleccione `FLOTA-SEGURA-GPS`. Railway crea un servicio; el primer despliegue fallará porque aún no tiene configuración. Es normal.

### A2. Servicio `api`
1. Abra el servicio → pestaña **Settings**:
   - **Service Name**: `api`.
   - **Source → Branch**: la rama a desplegar (`main` cuando se integren los cambios; mientras tanto `claude/happy-carson-dbnwcw`).
   - **Config-as-code → Railway Config File**: `/apps/api/railway.json`
2. No genere dominio público para `api`: solo la aplicación web la usa por la red privada.

### A3. Base de datos PostgreSQL
1. En el lienzo del proyecto: **+ Create** → **Database** → **PostgreSQL**.
2. No se requiere más configuración. La base no queda expuesta a internet a menos que usted active un proxy TCP (no lo active).

### A4. Variables del servicio `api`
Servicio `api` → **Variables** → **Raw Editor** → pegue y complete:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_ACCESS_SECRET=<cadena aleatoria de 48 o más caracteres>
JWT_REFRESH_SECRET=<otra cadena aleatoria distinta>
TRUST_PROXY_HOPS=2
DEMO_ENABLED=true
SEED_SUPERADMIN_EMAIL=<su correo de administrador>
SEED_SUPERADMIN_PASSWORD=<contraseña de 12 o más caracteres>
```

- `${{Postgres.DATABASE_URL}}` se escribe tal cual: Railway lo sustituye por la conexión real.
- Use un generador de contraseñas (por ejemplo, el de su navegador o gestor de contraseñas) para los secretos JWT.
- Pulse **Update Variables** y luego **Deploy**. Al iniciar, la API aplica las migraciones, crea el superadministrador y la empresa de demostración.

### A5. Servicio `web`
1. En el lienzo: **+ Create** → **GitHub Repo** → `FLOTA-SEGURA-GPS`.
2. **Settings**: Service Name `web`; misma rama; **Railway Config File**: `/apps/web/railway.json`.
3. **Variables → Raw Editor**:
   ```
   PORT=8080
   API_UPSTREAM=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3000
   ```
4. **Settings → Networking → Generate Domain** (puerto 8080). Obtendrá una dirección `https://web-….up.railway.app`.
5. Abra esa dirección: verá la pantalla de inicio de sesión. Pruebe **Probar modo demostración** y luego entre con su superadministrador.

Si la web muestra «Error 502», la API aún está desplegando; espere un minuto. Si persiste, en `api` → **Deployments** → **View logs** revise el error.

---

## Parte B — VPS de Traccar (Hetzner Cloud)

### B1. Crear el servidor
1. Entre a **https://console.hetzner.com**, cree una cuenta y agregue un método de pago (requiere su autorización).
2. **+ New project** → nombre `Flota Segura`.
3. Dentro del proyecto: **Add Server**:
   - **Location**: *Ashburn, VA* o *Hillsboro, OR* (más cercanas a México).
   - **Image**: *Ubuntu 24.04*.
   - **Type**: *Shared vCPU*, mínimo 2 vCPU / 2 GB RAM (p. ej. CPX11). Para más de ~150 unidades, 4 GB.
   - **Networking**: deje activada **Public IPv4** (indispensable para recibir a los GPS).
   - **SSH keys**: opcional. Sin llave, Hetzner le envía la contraseña de root por correo.
   - **Firewalls**: cree uno nuevo con estas reglas de **entrada** (Inbound):

     | Protocolo | Puerto | Uso |
     |---|---|---|
     | TCP | 22 | Administración (SSH/consola) |
     | TCP | 80, 443 | HTTPS (certificado y API de Traccar) |
     | TCP | 5055 | Traccar Client (teléfonos) |
     | TCP y UDP | 5011 | Suntech |
     | TCP y UDP | 5027 | Teltonika |
     | TCP y UDP | 5023 | Concox / Jimi IoT (gt06) |
     | TCP y UDP | 5004 | Queclink (gl200) |

   - **Cloud config**: abra en GitHub el archivo [`infra/traccar/cloud-init.yaml`](../infra/traccar/cloud-init.yaml), pulse el botón **Copy raw file** y péguelo completo en este campo.
   - **Name**: `traccar-flota`.
4. **Create & Buy now**.

La instalación es automática (Docker, firewall, Traccar 6.16.0, base TimescaleDB, HTTPS, respaldos diarios). Tarda de 3 a 8 minutos.

### B2. Obtener los datos de conexión
1. En Hetzner, abra el servidor → icono **Console** (`>_`).
2. Inicie sesión como `root` con la contraseña recibida por correo (le pedirá cambiarla).
3. Escriba y pulse Enter:
   ```
   cat /opt/flota-traccar/RAILWAY.txt
   ```
   Verá cinco valores (`TRACCAR_URL`, `TRACCAR_ADMIN_EMAIL`, `TRACCAR_ADMIN_PASSWORD`, `TRACCAR_PROXY_SECRET`, `TRACCAR_PUBLIC_HOST`).
4. Si el archivo aún no existe, la instalación sigue en curso. Puede ver el avance con `tail -f /var/log/cloud-init-output.log` (salga con Ctrl+C).

`TRACCAR_URL` usa por defecto un nombre `<ip>.sslip.io`, que permite HTTPS sin comprar dominio. Si después adquiere un dominio, cree un registro **A** hacia la IP del servidor, cambie `TRACCAR_DOMAIN` en `/opt/flota-traccar/.env` (`nano /opt/flota-traccar/.env`) y ejecute `bash /opt/flota-traccar/install.sh`. Después actualice `TRACCAR_URL` en Railway.

---

## Parte C — Unir Railway con Traccar
1. Railway → servicio `api` → **Variables** → **Raw Editor** → agregue los cinco valores de `RAILWAY.txt`.
2. **Update Variables** → la API se vuelve a desplegar.
3. En **Deployments → View logs** debe aparecer: `Sesión administrativa con Traccar establecida` y `WebSocket de Traccar conectado`.

## Parte D — Primer equipo
Siga el [Manual de conexión de dispositivos](CONEXION-DISPOSITIVOS.md). Recomendación: pruebe primero con su teléfono (Traccar Client) antes de instalar un GPS físico.

---

## Operación

| Tarea | Cómo |
|---|---|
| Respaldos de Traccar | Automáticos 03:15 UTC en `/opt/backups/traccar` (14 días). Copie esa carpeta a almacenamiento externo. |
| Respaldos de Flota Segura | Railway → Postgres → **Backups** (según plan) o `scripts/backup-flota-db.sh`. |
| Panel interno de Traccar | Solo por túnel SSH: `ssh -L 8082:127.0.0.1:8082 root@IP` y abra `http://localhost:8082`. |
| Actualizar Traccar | Editar la versión en `/opt/flota-traccar/compose.yaml` y `docker compose pull && docker compose up -d` (respalde antes). |
| Agregar un protocolo | Agregar el nombre en `TRACCAR_PROTOCOLS` (`.env`), su puerto en `compose.yaml` y en el firewall de Hetzner. |
