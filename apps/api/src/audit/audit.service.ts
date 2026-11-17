import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditService {
  private log = new Logger('Audit');
  constructor(private prisma: PrismaService) {}

  async record(e: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: { ...e, metadata: (e.metadata ?? {}) as Prisma.InputJsonValue },
      });
    } catch (err) {
      this.log.error(`No se pudo registrar auditoría ${e.action}: ${(err as Error).message}`);
    }
  }
}
