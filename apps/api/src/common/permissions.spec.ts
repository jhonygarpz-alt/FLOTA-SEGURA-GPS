import { effectivePermissions } from './permissions';
import { resolveCompanyId, tenantWhere } from './tenant';
import { AuthUser } from './auth-user';

describe('permisos', () => {
  it('el usuario de consulta no puede escribir', () => {
    expect(effectivePermissions('VIEWER', {})).not.toContain('vehicles:write');
  });
  it('las concesiones individuales se aplican, pero nunca platform:admin', () => {
    const p = effectivePermissions('VIEWER', { 'vehicles:write': true, 'platform:admin': true });
    expect(p).toContain('vehicles:write');
    expect(p).not.toContain('platform:admin');
  });
  it('las revocaciones individuales se aplican', () => {
    expect(effectivePermissions('MONITOR', { 'commands:send': false })).not.toContain('commands:send');
  });
});

describe('aislamiento multiempresa', () => {
  const user: AuthUser = { id: 'u', email: 'a', role: 'COMPANY_ADMIN', companyId: 'A', isDemo: false, permissions: [] };
  it('un usuario de empresa siempre opera sobre su empresa aunque solicite otra', () => {
    expect(resolveCompanyId(user, 'B')).toBe('A');
    expect(tenantWhere(user, 'B')).toEqual({ companyId: 'A' });
  });
  it('el superadministrador debe indicar la empresa para escribir', () => {
    const sa = { ...user, role: 'SUPERADMIN' as const, companyId: null };
    expect(() => resolveCompanyId(sa)).toThrow();
    expect(resolveCompanyId(sa, 'B')).toBe('B');
  });
});
