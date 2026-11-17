import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { FleetProvider } from './lib/fleet';
import { MODULES, moduleByKey } from './lib/modules';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Home from './pages/Home';
import ModuleSoon from './pages/ModuleSoon';

const MapPage = lazy(() => import('./pages/MapPage'));
const Vehicles = lazy(() => import('./pages/Vehicles'));
const Devices = lazy(() => import('./pages/devices/Devices'));
const DeviceWizard = lazy(() => import('./pages/devices/DeviceWizard'));
const DeviceDetail = lazy(() => import('./pages/devices/DeviceDetail'));
const Operators = lazy(() => import('./pages/Operators'));
const Users = lazy(() => import('./pages/Users'));
const Clients = lazy(() => import('./pages/Clients'));
const Settings = lazy(() => import('./pages/Settings'));

const IMPLEMENTED = new Set(['monitoring', 'vehicles', 'devices', 'operators', 'users', 'clients', 'settings']);

const Loading = () => <div className="grid h-[60vh] place-items-center text-brand-600"><Spinner /></div>;

export default function App() {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="grid h-dvh place-items-center text-brand-600"><Spinner className="h-8 w-8" /></div>;
  if (!user) return <Login />;
  const guard = (perm: string | undefined, el: JSX.Element) => (!perm || can(perm) ? el : <Navigate to="/" replace />);

  return (
    <FleetProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="mapa" element={guard('monitoring:read', <MapPage />)} />
            <Route path="unidades" element={guard('vehicles:read', <Vehicles />)} />
            <Route path="dispositivos" element={guard('devices:read', <Devices />)} />
            <Route path="dispositivos/nuevo" element={guard('devices:write', <DeviceWizard />)} />
            <Route path="dispositivos/:id" element={guard('devices:read', <DeviceDetail />)} />
            <Route path="operadores" element={guard('operators:read', <Operators />)} />
            <Route path="usuarios" element={guard('users:read', <Users />)} />
            <Route path="clientes" element={guard('platform:admin', <Clients />)} />
            <Route path="configuracion" element={<Settings />} />
            <Route path="perfil" element={<Settings />} />
            {MODULES.filter((m) => !IMPLEMENTED.has(m.key)).map((m) => (
              <Route key={m.key} path={m.path.slice(1)} element={guard(m.permission, <ModuleSoon m={moduleByKey(m.key)} />)} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </FleetProvider>
  );
}
