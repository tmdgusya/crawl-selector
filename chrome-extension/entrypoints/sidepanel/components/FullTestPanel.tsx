import { useState, useCallback, useMemo } from 'react';
import { useRecipeStore } from '../store/useRecipeStore';
import { TestModeSelector } from './TestModeSelector';
import { CopyIcon, CheckIcon, PlayIcon, SpinnerIcon } from './Icons';

export function FullTestPanel() {
  const {
    getActiveRecipe,
    testAllFields,
    clearTestResults,
    testRunning,
    fullTestResult,
  } = useRecipeStore();

  const recipe = getActiveRecipe();

  const [mode, setMode] = useState<'content-script' | 'fetch'>('content-script');
  const [url, setUrl] = useState(recipe?.url_pattern ?? '');
  const [copied, setCopied] = useState(false);

  const handleRun = useCallback(() => {
    if (testRunning) return;
    testAllFields(mode, mode === 'fetch' ? url : undefined);
  }, [mode, url, testRunning, testAllFields]);

  const handleClear = useCallback(() => {
    clearTestResults();
  }, [clearTestResults]);

  // Build a user-friendly JSON result: { field_name: transformed_value }
  const resultJson = useMemo(() => {
    if (!fullTestResult || !recipe) return '';
    const output: Record<string, unknown> = {};
    for (const field of recipe.fields) {
      const r = fullTestResult.fields[field.id];
      if (r) {
        output[field.field_name] = r.success ? r.transformed : null;
      }
    }
    return JSON.stringify(output, null, 2);
  }, [fullTestResult, recipe]);

  const handleCopy = useCallback(() => {
    if (!resultJson) return;
    navigator.clipboard.writeText(resultJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [resultJson]);

  if (!recipe || recipe.fields.length === 0) return null;

  const fields = recipe.fields;
  const hasResults = fullTestResult !== null;
  const successCount = hasResults
    ? Object.values(fullTestResult.fields).filter((r) => r.success).length
    : 0;
  const failCount = hasResults
    ? Object.values(fullTestResult.fields).filter((r) => !r.success).length
    : 0;

  // Detect global error: all fields failed with the same error message
  const globalError = useMemo(() => {
    if (!fullTestResult) return null;
    const results = Object.values(fullTestResult.fields);
    if (results.length === 0) return null;
    const allFailed = results.every((r) => !r.success);
    if (!allFailed) return null;
    const firstError = results[0].error;
    if (!firstError) return null;
    const sameError = results.every((r) => r.error === firstError);
    return sameError ? firstError : null;
  }, [fullTestResult]);

  return (
    <div
      className="space-y-2"
      role="region"
      aria-label="전체 테스트"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
          테스트
        </span>
        {hasResults && (
          <button
            onClick={handleClear}
            className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
          >
            결과 초기화
          </button>
        )}
      </div>

      {/* Mode selector */}
      <TestModeSelector
        mode={mode}
        url={url}
        onModeChange={setMode}
        onUrlChange={setUrl}
      />

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={testRunning || (mode === 'fetch' && !url.trim())}
        className="btn-press focus-ring w-full py-2 px-3 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 inline-flex items-center justify-center gap-1.5 shadow-xs"
        aria-label="전체 테스트 실행"
      >
        {testRunning ? (
          <>
            <SpinnerIcon />
            테스트 중…
          </>
        ) : (
          <>
            <PlayIcon size={12} />
            전체 테스트 실행
          </>
        )}
      </button>

      {/* Results */}
      {hasResults && (
        <div className="space-y-2">
          {/* Summary row */}
          <div className="flex items-center gap-2 text-xs">
            {successCount > 0 && (
              <span className="inline-flex items-center gap-1 text-success-600">
                <span aria-hidden="true">&#x2705;</span>
                {successCount}개 성공
              </span>
            )}
            {failCount > 0 && (
              <span className="inline-flex items-center gap-1 text-danger-600">
                <span aria-hidden="true">&#x274C;</span>
                {failCount}개 실패
              </span>
            )}
            {fullTestResult.source === 'fetch' && fullTestResult.url && (
              <span className="text-[10px] text-text-muted truncate ml-auto" title={fullTestResult.url}>
                {fullTestResult.url}
              </span>
            )}
          </div>

          {/* Global error banner */}
          {globalError && (
            <div className="px-2.5 py-2 rounded-md bg-danger-50 border border-danger-500/20 text-xs text-danger-600">
              <span className="font-semibold">오류: </span>
              {globalError}
            </div>
          )}

          {/* Per-field status list */}
          <ul className="space-y-1">
            {fields.map((field) => {
              const r = fullTestResult.fields[field.id];
              if (!r) return null;
              return (
                <li
                  key={field.id}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded-md bg-surface-card border border-border-default"
                >
                  <span className="shrink-0" aria-hidden="true">
                    {r.success ? '\u2705' : '\u274C'}
                  </span>
                  <span className="font-medium text-text-primary truncate">
                    {field.field_name}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-text-muted truncate max-w-[140px]">
                    {r.success
                      ? Array.isArray(r.transformed)
                        ? `[${r.matchCount}개]`
                        : r.transformed || '(빈 값)'
                      : r.error || '실패'}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* JSON preview */}
          <pre
            className="text-[10px] font-mono text-text-secondary bg-surface-card border border-border-default rounded-md p-2.5 max-h-48 overflow-auto whitespace-pre"
            aria-label="테스트 결과 JSON"
          >
            {resultJson}
          </pre>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`btn-press focus-ring w-full py-2 px-3 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all duration-150 ${
              copied
                ? 'bg-success-50 text-success-600 border border-success-500/30'
                : 'bg-surface-card border border-border-default text-text-secondary hover:bg-surface-inset hover:border-border-default shadow-xs'
            }`}
            aria-label={copied ? 'JSON이 클립보드에 복사되었습니다' : '결과 JSON 복사'}
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            {copied ? '복사 완료!' : '복사'}
          </button>
        </div>
      )}
    </div>
  );
}

