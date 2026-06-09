import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled React error", error, errorInfo);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
          <div className="w-full max-w-lg rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-red-700">
              页面渲染失败
            </p>
            <h1 className="mt-2 text-xl font-semibold">发生了未处理错误</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {this.state.error.message || "请重试，或返回上一页继续操作。"}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={this.reset}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                重试
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
