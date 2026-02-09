import type { FieldTestResult } from '../../../shared/types';
import { SpinnerIcon } from './Icons';

interface Props {
  result?: FieldTestResult;
  loading: boolean;
}

export function FieldTestResultView({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="mt-2 px-3 py-2 rounded-md bg-surface-inset text-text-muted text-xs flex items-center gap-2">
        <SpinnerIcon className="text-brand-500" />
        <span>추출 중…</span>
      </div>
    );
  }

  if (!result) return null;

  if (!result.success) {
    // Use the specific error message as the header when it's not a simple no-match
    const isNoMatch = !result.error || result.error === '매칭 요소 없음';
    return (
      <div className="mt-2 px-3 py-2 rounded-md bg-danger-50 text-danger-600 text-xs">
        <span className="font-semibold">{isNoMatch ? '매칭 요소 없음' : '추출 실패'}</span>
        {result.error && !isNoMatch && (
          <p className="mt-0.5 text-[11px] text-danger-500">{result.error}</p>
        )}
      </div>
    );
  }

  const isMultiple = Array.isArray(result.transformed);
  const rawValues = Array.isArray(result.raw) ? result.raw : [result.raw];
  const transformedValues = Array.isArray(result.transformed)
    ? result.transformed
    : [result.transformed];

  // Check whether transforms actually changed anything
  const hasTransformDiff =
    JSON.stringify(result.raw) !== JSON.stringify(result.transformed);

  return (
    <div className="mt-2 px-3 py-2 rounded-md bg-success-50 text-xs space-y-1.5">
      {/* Header with match count */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-success-600">추출 결과</span>
        {isMultiple && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-success-100 text-success-600 font-semibold">
            {result.matchCount}개 매칭
          </span>
        )}
      </div>

      {/* Single value display */}
      {!isMultiple && (
        <SingleValueDisplay
          raw={rawValues[0]}
          transformed={transformedValues[0]}
          showRaw={hasTransformDiff}
        />
      )}

      {/* Multiple values display */}
      {isMultiple && (
        <ol className="list-none space-y-1">
          {transformedValues.map((val, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="shrink-0 text-[10px] text-success-600 font-mono mt-0.5">
                {i + 1}.
              </span>
              <span className="font-mono text-text-primary break-all">
                {val || <EmptyValue />}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Show raw values for multiple mode when transforms changed them */}
      {isMultiple && hasTransformDiff && (
        <details className="mt-1">
          <summary className="text-[10px] text-text-muted cursor-pointer hover:text-text-secondary">
            Raw 값 보기
          </summary>
          <ol className="list-none space-y-0.5 mt-1">
            {rawValues.map((val, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="shrink-0 text-[10px] text-text-muted font-mono mt-0.5">
                  {i + 1}.
                </span>
                <span className="font-mono text-text-muted break-all text-[11px]">
                  {val || <EmptyValue />}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function SingleValueDisplay({
  raw,
  transformed,
  showRaw,
}: {
  raw: string;
  transformed: string;
  showRaw: boolean;
}) {
  return (
    <div className="space-y-1">
      {showRaw && (
        <div className="flex items-baseline gap-1.5">
          <span className="shrink-0 text-[10px] text-text-muted font-semibold">
            Raw
          </span>
          <span className="font-mono text-text-muted break-all text-[11px]">
            {raw || <EmptyValue />}
          </span>
        </div>
      )}
      <div className="flex items-baseline gap-1.5">
        {showRaw && (
          <span className="shrink-0 text-[10px] text-success-600 font-semibold">
            변환
          </span>
        )}
        <span className="font-mono text-text-primary break-all">
          {transformed || <EmptyValue />}
        </span>
      </div>
    </div>
  );
}

function EmptyValue() {
  return <span className="italic text-text-muted">(빈 값)</span>;
}

