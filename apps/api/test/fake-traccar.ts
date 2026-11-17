import http from 'http';
import { AddressInfo } from 'net';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Servidor que imita el subconjunto de la API de Traccar 6 usado por Flota Segura.
 * Solo para pruebas automatizadas: no envía comandos ni se conecta a equipos reales.
 */
export async function startFakeTraccar() {
  const devices: any[] = [];
  const groups: any[] = [];
  const sockets = new Set<WebSocket>();
  let nextId = 1;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = (code: number, data: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      if (url.pathname === '/api/session' && req.method === 'POST') {
        const p = new URLSearchParams(body);
        if (p.get('email') !== 'admin' || p.get('password') !== 'secret') return json(401, {});
        res.setHeader('Set-Cookie', 'JSESSIONID=fake123; Path=/; HttpOnly');
        return json(200, { id: 1, name: 'admin' });
      }
      if (!req.headers.cookie?.includes('JSESSIONID=fake123')) return json(401, {});
      if (url.pathname === '/api/groups' && req.method === 'POST') {
        const g = { ...JSON.parse(body), id: nextId++ };
        groups.push(g);
        return json(200, g);
      }
      if (url.pathname === '/api/devices' && req.method === 'POST') {
        const d = JSON.parse(body);
        if (devices.some((x) => x.uniqueId === d.uniqueId)) return json(400, { error: 'duplicate' });
        const created = { ...d, id: nextId++, status: 'unknown', lastUpdate: null, positionId: 0, disabled: false };
        devices.push(created);
        return json(200, created);
      }
      if (url.pathname === '/api/devices' && req.method === 'GET') {
        const id = url.searchParams.get('id');
        return json(200, id ? devices.filter((d) => d.id === Number(id)) : devices);
      }
      if (url.pathname === '/api/positions') return json(200, []);
      json(404, {});
    });
  });
  const wss = new WebSocketServer({ server, path: '/api/socket' });
  wss.on('connection', (ws, req) => {
    if (!req.headers.cookie?.includes('JSESSIONID=fake123')) return ws.close();
    sockets.add(ws);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    devices,
    groups,
    connected: () => sockets.size,
    push(msg: unknown) {
      for (const s of sockets) s.send(JSON.stringify(msg));
    },
    async close() {
      for (const s of sockets) s.terminate();
      wss.close();
      await new Promise((r) => server.close(r));
    },
  };
}
