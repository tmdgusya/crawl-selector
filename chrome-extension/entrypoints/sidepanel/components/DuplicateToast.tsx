import { useRecipeStore } from '../store/useRecipeStore';

export function DuplicateToast() {
  const pendingDuplicate = useRecipeStore((s) => s.pendingDuplicate);
  const resolveDuplicate = useRecipeStore((s) => s.resolveDuplicate);

  if (!pendingDuplicate) return null;

  return (
    <div
      className="toast-enter fixed bottom-3 left-3 right-3 bg-warning-50 border border-warning-500/30 rounded-lg shadow-lg p-3 z-50"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-xs font-semibold text-warning-700 mb-1">
        같은 셀렉터가 있습니다
      </p>
      <p className="text-[11px] text-text-secondary mb-0.5">
        필드 <span className="font-mono font-semibold text-text-primary">{pendingDuplicate.existingFieldName}</span>에서
        이미 사용 중인 셀렉터입니다.
      </p>
      <p className="text-[11px] font-mono text-text-muted truncate mb-2" title={pendingDuplicate.selector}>
        {pendingDuplicate.selector}
      </p>
      <p className="text-[11px] text-text-secondary mb-2">
        <code className="bg-warning-100 px-1 py-0.5 rounded text-warning-700 text-[10px]">multiple: true</code>로
        변경할까요?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => resolveDuplicate(true)}
          className="btn-press focus-ring flex-1 text-xs px-3 py-1.5 rounded-md bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-xs"
        >
          Merge
        </button>
        <button
          onClick={() => resolveDuplicate(false)}
          className="btn-press focus-ring flex-1 text-xs px-3 py-1.5 rounded-md bg-surface-inset text-text-secondary hover:bg-border-default transition-colors"
        >
          Add Anyway
        </button>
      </div>
    </div>
  );
}
