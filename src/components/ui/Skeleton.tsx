import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  const { theme } = useTheme();
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{
        backgroundColor: theme.skeletonBase,
        ...style,
      }}
    />
  );
}

export function CardSkeleton({ count = 1 }: { count?: number }) {
  const { theme } = useTheme();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border p-4 space-y-4" style={{ borderColor: theme.border, background: theme.cardBg }}>
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </>
  );
}

export function TableRowSkeleton({ count = 5, cols = 4 }: { count?: number; cols?: number }) {
  const { theme } = useTheme();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b" style={{ borderColor: theme.border }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-4">
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

