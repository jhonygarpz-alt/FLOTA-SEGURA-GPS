export type Role = 'SUPERADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'MONITOR' | 'INSTALLER' | 'VIEWER';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleLabel: string;
  mfaEnabled: boolean;
  permissions: string[];
  company: { id: string; name: string; isDemo: boolean; timezone: string } | null;
}

export interface LivePosition {
  deviceId: string;
  vehicleId: string | null;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number;
  altitude: number;
  fixTime: string;
  serverTime: string;
  valid: boolean;
  outdated: boolean;
  address: string | null;
  ignition: boolean | null;
  motion: boolean | null;
  alarm: string | null;
  powerVolts: number | null;
  batteryVolts: number | null;
  batteryLevel: number | null;
  fuel: number | null;
  source: 'traccar' | 'demo';
}

export type VehicleType = 'TRACTOR' | 'TANKER' | 'TRAILER' | 'TRUCK' | 'CAR' | 'MOTORCYCLE' | 'MACHINERY';

export interface FleetVehicle {
  id: string;
  economicNumber: string;
  plates: string | null;
  type: VehicleType;
  brand: string | null;
  model: string | null;
  year: number | null;
  photoUrl: string | null;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  company: { id: string; name: string; isDemo: boolean };
  operator: { id: string; name: string; phone: string | null } | null;
  device: { id: string; name: string; status: DeviceStatus; isDemo: boolean; protocol: string } | null;
  position: LivePosition | null;
}

export type DeviceStatus = 'PENDING_CONFIG' | 'WAITING' | 'RECEIVING' | 'CONNECTED' | 'NO_COMMUNICATION' | 'CONFIG_ERROR';

export interface Device {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  protocol: string;
  port: number;
  uniqueId: string;
  serialNumber: string | null;
  status: DeviceStatus;
  isDemo: boolean;
  traccarDeviceId: number | null;
  lastPositionAt: string | null;
  vehicle: { id: string; economicNumber: string; plates: string | null } | null;
  simCard: { iccid: string; phone: string | null; carrier: string | null; apn: string | null } | null;
}

export interface Operator {
  id: string;
  name: string;
  phone: string | null;
  license: string | null;
  active: boolean;
  vehicles: { id: string; economicNumber: string }[];
}
