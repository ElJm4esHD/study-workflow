import { Component, type ReactNode } from 'react';

export const ErrorScreen = () => (
  <div className="center-screen">
    <h1>Algo salió mal</h1>
    <p>Recargá la app. Si sigue pasando, avisá qué estabas haciendo.</p>
    <button className="btn primary" onClick={() => location.reload()}>Recargar</button>
  </div>
);

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorScreen />;
  }
}
