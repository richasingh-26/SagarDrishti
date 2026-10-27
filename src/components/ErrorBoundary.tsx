import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center p-6 bg-bg-base">
          <div className="glass-panel max-w-md p-6 border border-[#FF4444]/40 rounded-xl text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#FF4444]/20 border border-[#FF4444]/50 mx-auto flex items-center justify-center text-[#FF4444]">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {this.props.fallbackTitle || 'Module Visual Error Recovered'}
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                {this.state.error?.message || 'A WebGL / Map render error was intercepted and isolated.'}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-lg bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-black text-xs font-bold flex items-center justify-center gap-2 mx-auto transition-all"
            >
              <RefreshCw size={14} /> Reload View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
