export interface SetupInstructions {
  verification: 'official' | 'manufacturer';
  steps: string[];
  reference: string;
}

/**
 * Instrucciones de configuración. Solo las de Traccar Client provienen de documentación
 * oficial de Traccar; para equipos físicos se indican los parámetros y se remite al
 * manual del fabricante para la sintaxis exacta (no se inventan comandos).
 */
export function instructionsFor(manufacturer: string, protocol: string, host: string, port: number, uniqueId: string, apn: string | null): SetupInstructions {
  const apnText = apn ? `APN "${apn}"` : 'el APN de su operador de SIM';
  if (protocol === 'osmand') {
    return {
      verification: 'official',
      reference: 'https://www.traccar.org/client/',
      steps: [
        'Instale "Traccar Client" desde App Store (iPhone) o Google Play (Android).',
        `En "Identificador del dispositivo" escriba exactamente: ${uniqueId}`,
        `En "URL del servidor" escriba: http://${host || '<IP-o-dominio>'}:${port}`,
        'Ajuste la frecuencia (por ejemplo, 30 segundos) y la precisión de ubicación en "Alta".',
        'Active el servicio de rastreo y conceda permiso de ubicación "Siempre".',
      ],
    };
  }
  const common = [
    `Configure la conexión de datos de la SIM con ${apnText}.`,
    `Configure como servidor principal la dirección ${host || '<IP-o-dominio>'} y el puerto ${port}.`,
    'Seleccione el modo de conexión TCP salvo que el manual indique otro.',
    `Verifique que el identificador que reporta el equipo (normalmente el IMEI) sea ${uniqueId}.`,
    'Configure el intervalo de reporte (recomendado: 30 s en movimiento y 5 min detenido).',
  ];
  const tool: Record<string, string> = {
    Teltonika: 'Utilice la herramienta oficial "Teltonika Configurator" (sección GPRS: APN y ajustes de servidor).',
    Suntech: 'Utilice la herramienta de configuración o los comandos indicados en el manual oficial de Suntech para su modelo.',
    Queclink: 'Utilice la herramienta oficial de Queclink o los comandos @Track del manual de protocolo de su modelo.',
    Concox: 'Utilice los comandos SMS indicados en el manual oficial de su modelo (los comandos varían entre modelos y firmware).',
    'Jimi IoT': 'Utilice la herramienta o los comandos SMS del manual oficial de Jimi IoT para su modelo.',
  };
  return {
    verification: 'manufacturer',
    reference: 'Manual oficial del fabricante del equipo',
    steps: [tool[manufacturer] ?? 'Consulte el manual oficial del fabricante para la sintaxis exacta de configuración.', ...common],
  };
}
