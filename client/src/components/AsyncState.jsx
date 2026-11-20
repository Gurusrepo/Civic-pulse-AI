export function LoadingState({ children = 'Loading...' }) {
  return <p role="status" aria-live="polite" className="rounded-xl bg-white px-4 py-3 text-sm text-[#385743]">{children}</p>;
}

export function ErrorState({ children, onRetry, retryLabel = 'Try again' }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]"
    >
      <p>{children}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#8b3c2d]/40"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children = 'There is nothing to show yet.' }) {
  return <p className="rounded-xl border border-dashed border-[#d9ded5] px-4 py-6 text-center text-sm text-[#68736a]">{children}</p>;
}
