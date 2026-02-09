interface Props {
  mode: 'content-script' | 'fetch';
  url: string;
  onModeChange: (mode: 'content-script' | 'fetch') => void;
  onUrlChange: (url: string) => void;
}

export function TestModeSelector({ mode, url, onModeChange, onUrlChange }: Props) {
  return (
    <div className="space-y-2">
      {/* Segmented control */}
      <div
        className="flex rounded-lg bg-surface-inset p-0.5"
        role="radiogroup"
        aria-label="테스트 모드 선택"
      >
        <button
          role="radio"
          aria-checked={mode === 'content-script'}
          onClick={() => onModeChange('content-script')}
          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all duration-150 ${
            mode === 'content-script'
              ? 'bg-surface-card text-text-primary shadow-xs'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          현재 탭
        </button>
        <button
          role="radio"
          aria-checked={mode === 'fetch'}
          onClick={() => onModeChange('fetch')}
          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all duration-150 ${
            mode === 'fetch'
              ? 'bg-surface-card text-text-primary shadow-xs'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          URL 입력
        </button>
      </div>

      {/* URL input (fetch mode only) */}
      {mode === 'fetch' && (
        <div className="space-y-1.5">
          <input
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com/page"
            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-border-default bg-surface-card text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
            aria-label="테스트할 URL"
          />
          <p className="text-[10px] text-warning-600">
            ⚠️ CSR(SPA) 페이지는 지원되지 않습니다
          </p>
        </div>
      )}
    </div>
  );
}
