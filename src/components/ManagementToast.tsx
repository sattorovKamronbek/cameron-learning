import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type ToastKind = 'success' | 'error';

type ManagementToastProps = {
  message: string | null;
  kind: ToastKind;
  onDismiss: () => void;
};

/** A single, top-level feedback surface for contest management actions. */
export function ManagementToast({ message, kind, onDismiss }: ManagementToastProps) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => onDismissRef.current(), kind === 'success' ? 4_500 : 6_500);
    return () => window.clearTimeout(timeout);
  }, [kind, message]);

  if (!message || typeof document === 'undefined') return null;

  const isSuccess = kind === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  const title = isSuccess ? 'Saqlandi' : 'Amal bajarilmadi';
  const duration = isSuccess ? '4.5s' : '6.5s';

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--header-h)+0.9rem)] z-[200] flex justify-center px-4 sm:px-6">
      <div
        role={isSuccess ? 'status' : 'alert'}
        aria-live={isSuccess ? 'polite' : 'assertive'}
        className={`management-toast ${isSuccess ? 'management-toast-success' : 'management-toast-error'}`}
      >
        <div className={`management-toast-icon ${isSuccess ? 'bg-success-500/10 text-success-600' : 'bg-error-500/10 text-error-600'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-sm font-extrabold text-slate-900">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{message}</p>
        </div>
        <button type="button" onClick={onDismiss} className="management-toast-close" aria-label="Xabarni yopish">
          <X className="h-4 w-4" />
        </button>
        <span className={`management-toast-progress ${isSuccess ? 'bg-success-500' : 'bg-error-500'}`} style={{ animationDuration: duration }} />
      </div>
    </div>,
    document.body,
  );
}
