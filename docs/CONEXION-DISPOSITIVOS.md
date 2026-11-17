# Manual de conexión de dispositivos

El asistente **Dispositivos → Conectar GPS** guía cada paso. Este manual explica qué significa cada uno.

## Antes de empezar
- La plataforma debe estar unida a Traccar (ver [Instalación, parte C](INSTALACION.md#parte-c--unir-railway-con-traccar)). Si no lo está, el equipo quedará en «Pendiente de configuración».
- Tenga a la mano el IMEI (etiqueta del equipo) y los datos de la SIM (ICCID y APN de su operador).

## Los 8 pasos
1. **Fabricante** — lista tomada del catálogo oficial de Traccar.
2. **Modelo** — define automáticamente el protocolo y el puerto. Confírmelo con la etiqueta.
3. **Identificación** — IMEI de 15 dígitos (se valida el dígito verificador) y número de serie.
4. **SIM** — ICCID, número, operador y APN. Puede registrarse después.
5. **Vehículo** — unidad donde está instalado (opcional).
6. **Configuración** — ficha con servidor, puerto, conexión, APN, identificador e intervalo, con botones para copiar.
7. **Primera transmisión** — la pantalla verifica cada 3 segundos.
8. **Conectado** — el equipo envía posiciones GPS válidas.

## Estados del diagnóstico

| Estado | Significado | Qué hacer |
|---|---|---|
| Pendiente de configuración | No registrado en Traccar | Verifique que Traccar esté configurado; pulse «Registrar en servidor» |
| Esperando conexión | Registrado, nunca ha transmitido | Revise IP, puerto, APN, saldo de datos y que el equipo tenga energía |
| Recibiendo datos | Se comunica pero sin posición GPS válida | Lleve el vehículo a cielo abierto; revise antena GPS |
| Conectado correctamente | Posiciones válidas recientes | Listo |
| Sin comunicación | Sin datos en los últimos 10 min | Energía, cobertura celular, SIM suspendida |
| Error de configuración | Falló el registro o fue eliminado en Traccar | Pulse «Reintentar registro» |

## Prueba sin GPS físico: teléfono con Traccar Client (verificado con documentación oficial)
1. Asistente → **Probar con mi teléfono**.
2. Instale **Traccar Client** (App Store / Google Play).
3. En la app, copie el **Identificador del dispositivo** al asistente.
4. En la app, **URL del servidor**: `http://<IP del VPS>:5055` (la ficha lo muestra exacto).
5. Frecuencia 30 s, precisión alta, active el servicio y conceda ubicación «Siempre».
6. Asigne el teléfono a una unidad para verlo en **Monitoreo**.

## Equipos prioritarios

| Equipo | Protocolo Traccar | Puerto | Estado de validación |
|---|---|---|---|
| Suntech ST8300 | suntech | 5011 | En la lista oficial de Traccar |
| Suntech ST8300**RP** | suntech (probable) | 5011 | La variante RP no aparece por separado: confirmar etiqueta y firmware con el primer equipo físico |
| **AT6** | por confirmar | — | No existe «AT6» en la lista oficial. Hay equipos AT6 de varios fabricantes (p. ej. Jimi IoT/Concox). Envíe foto de la etiqueta para identificarlo |
| Teltonika (FMB, FMC, FMM…) | teltonika | 5027 | Lista oficial |
| Queclink (GV, GL…) | gl200 | 5004 | Lista oficial |
| Concox / Jimi IoT (GT06, JM-VL…) | gt06 | 5023 | Lista oficial |

> No se publican comandos SMS de configuración porque varían por modelo y firmware. Use la herramienta o el manual oficial del fabricante; la ficha de configuración indica exactamente qué valores programar.

## Parámetros generales para equipos físicos
- **Servidor**: IP pública del VPS (`TRACCAR_PUBLIC_HOST`).
- **Puerto**: el de su protocolo (tabla anterior).
- **Conexión**: TCP (recomendado).
- **APN**: el de su operador de SIM.
- **Identificador**: el IMEI registrado.
- **Intervalo**: 30 s en movimiento, 5 min detenido (más frecuencia = más consumo de datos).
