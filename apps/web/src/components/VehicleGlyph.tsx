import { Bike, Car, Container, Forklift, Truck } from 'lucide-react';
import type { VehicleType } from '../lib/types';

const MAP = { TRACTOR: Truck, TANKER: Container, TRAILER: Container, TRUCK: Truck, CAR: Car, MOTORCYCLE: Bike, MACHINERY: Forklift };

export function VehicleGlyph({ type, className }: { type: VehicleType; className?: string }) {
  const Icon = MAP[type] ?? Truck;
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}
