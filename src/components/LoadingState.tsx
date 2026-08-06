type LoadingStateProps = {
  message?: string;
  className?: string;
  variant?: 'page' | 'card' | 'inline';
};

export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`loading-dots ${className}`.trim()} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function LoadingState({ message = 'Yuklanmoqda', className = '', variant = 'card' }: LoadingStateProps) {
  const isInline = variant === 'inline';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`loading-state loading-state-${variant} ${className}`.trim()}
    >
      <div className={`loading-content ${isInline ? 'loading-content-inline' : ''}`.trim()}>
        {!isInline && (
          <div className="loading-mark" aria-hidden="true">
            <span className="loading-orbit loading-orbit-outer" />
            <span className="loading-orbit loading-orbit-inner" />
            <span className="loading-core">
              <img src="/logo.png" alt="" />
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">{message}</span>
          <LoadingDots />
        </div>
      </div>
      <span className="sr-only">Iltimos, kuting.</span>
    </div>
  );
}
