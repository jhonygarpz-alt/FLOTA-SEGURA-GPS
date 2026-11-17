import { Component, ReactNode } from 'react';

/** Evita que un error en un módulo deje la aplicación en blanco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto mt-10 max-w-md p-6 text-center">
        <h2 className="text-lg font-bold">Algo salió mal en esta pantalla</h2>
        <p className="mt-1 text-[14px] text-slate-500">{this.state.error.message}</p>
        <button className="btn-primary mt-4" onClick={() => location.reload()}>Recargar</button>
      </div>
    );
  }
}
