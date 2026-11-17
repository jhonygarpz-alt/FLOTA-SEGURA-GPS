import { Construction } from 'lucide-react';
import { AppModule } from '../lib/modules';
import { PageHeader } from '../components/ui';

/** Módulo aún no implementado: se informa claramente, sin simular funcionalidad. */
export default function ModuleSoon({ m }: { m: AppModule }) {
  const Icon = m.icon;
  return (
    <div className="animate-fade-up">
      <PageHeader title={m.name} subtitle={m.description} back="/" />
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-[22%] text-white shadow-icon" style={{ backgroundColor: m.color }}>
          <Icon className="h-10 w-10" />
        </span>
        <h2 className="mt-5 text-xl font-bold">Módulo en desarrollo</h2>
        <p className="mt-2 max-w-md text-[15px] text-slate-500 dark:text-slate-400">
          Este módulo se habilitará en la <strong>fase {m.phase}</strong> del plan de desarrollo. No se muestran datos simulados para no confundirlos con información real.
        </p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-pearl-100 px-4 py-2 text-[13px] font-semibold text-slate-600 dark:bg-ink-700 dark:text-slate-300">
          <Construction className="h-4 w-4" /> Próximamente
        </span>
      </div>
    </div>
  );
}
