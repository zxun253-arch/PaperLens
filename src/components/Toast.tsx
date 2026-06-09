import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastOptions {
  type?: ToastType;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = Date.now() + Math.random();
      const type = options.type ?? "info";
      const durationMs = options.durationMs ?? 3500;

      setToasts((current) => [...current, { id, message, type }]);
      window.setTimeout(() => dismissToast(id), durationMs);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-5 top-5 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <ToastMessage
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function ToastMessage({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const tone =
    toast.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : toast.type === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-sky-200 bg-sky-50 text-sky-800";

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-md border px-4 py-3 text-sm shadow-sm ${tone}`}
      role="status"
    >
      <p className="leading-5">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded px-1 font-semibold opacity-70 hover:opacity-100"
        aria-label="关闭通知"
      >
        ×
      </button>
    </div>
  );
}
