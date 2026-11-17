import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { authenticateToken } from '../common/guards';
import { RealtimeHub } from './realtime.hub';

/**
 * Socket.IO en /api/socket.io. Cada conexión se autentica con el token de acceso y se
 * une únicamente a la sala de su empresa (aislamiento multiempresa en WebSocket).
 */
@WebSocketGateway({ path: '/api/socket.io', cors: { origin: (process.env.CORS_ORIGINS ?? '').split(','), credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private log = new Logger('Realtime');
  constructor(private jwt: JwtService, private prisma: PrismaService, private hub: RealtimeHub) {}

  afterInit(server: Server) {
    this.hub.server = server;
  }

  async handleConnection(socket: Socket) {
    const token = (socket.handshake.auth?.token as string | undefined) ?? '';
    try {
      const user = await authenticateToken(this.jwt, this.prisma, token);
      if (user.role === 'SUPERADMIN') await socket.join('platform');
      else if (user.companyId) await socket.join(`company:${user.companyId}`);
      socket.data.user = user;
      socket.emit('ready', { companyId: user.companyId, demo: user.isDemo });
    } catch {
      socket.emit('unauthorized', { message: 'Sesión inválida' });
      socket.disconnect(true);
    }
  }
}
