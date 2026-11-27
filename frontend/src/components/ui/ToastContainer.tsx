import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {toast.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
          {toast.type === 'error' && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
          {(toast.type === 'info' || toast.type === 'warning') && (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          )}
          <div className="flex-1 text-xs">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
