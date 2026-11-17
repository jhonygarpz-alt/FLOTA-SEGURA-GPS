import { Role } from '@prisma/client';
import { Permission } from './permissions';

/** Usuario autenticado adjunto a cada solicitud. companyId es la frontera de aislamiento multiempresa. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  companyId: string | null;
  isDemo: boolean;
  permissions: Permission[];
}

export interface JwtPayload {
  sub: string;
  role: Role;
  cid: string | null;
  demo: boolean;
  typ: 'access' | 'mfa';
}
