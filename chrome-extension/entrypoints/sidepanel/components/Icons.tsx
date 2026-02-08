const size = 16;

interface IconProps {
  className?: string;
  size?: number;
}

export function CrosshairIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="1" x2="8" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="12" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="8" x2="4" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function StopIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

export function CopyIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 11V3.5A.5.5 0 013.5 3H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DownloadIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2v8m0 0l-3-3m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function UploadIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 10V2m0 0L5 5m3-3l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M2.5 4h11M6 7v4M8 7v4M10 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.5 4l.5 9a1 1 0 001 1h6a1 1 0 001-1l.5-9" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function ChevronDownIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SparklesIcon({ className, size: s = size }: IconProps) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12.5 1l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L10 3.5l1.5-.5.5-1.5z" fill="currentColor" />
    </svg>
  );
}
