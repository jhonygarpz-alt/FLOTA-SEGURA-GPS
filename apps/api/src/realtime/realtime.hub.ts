import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Punto único de emisión en tiempo real. Las salas son por empresa: `company:<id>`. */
@Injectable()
export class RealtimeHub {
  server: Server | null = null;

  toCompany(companyId: string, event: string, payload: unknown) {
    this.server?.to(`company:${companyId}`).emit(event, payload);
    // El superadministrador observa toda la operación real (nunca la demostración).
    this.server?.to('platform').except(`company:${companyId}`).emit(event, { companyId, payload });
  }
}
