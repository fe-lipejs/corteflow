interface AdminSkeletonProps {
  rows?: number;
  type?: 'table' | 'cards' | 'stat';
  cols?: number;
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-[#1a1a1a] rounded animate-pulse ${className}`} />;
}

export function AdminStatSkeleton() {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-6">
      <SkeletonBlock className="h-3 w-24 mb-4" />
      <SkeletonBlock className="h-8 w-32 mb-2" />
      <SkeletonBlock className="h-3 w-16" />
    </div>
  );
}

export function AdminTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex gap-4 px-6 py-3 border-b border-[#1a1a1a]">
        {[40, 25, 20, 15].map((w, i) => (
          <SkeletonBlock key={i} className={`h-3 w-${w === 40 ? '2/5' : w === 25 ? '1/4' : w === 20 ? '1/5' : '1/6'}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-[#111]">
          <SkeletonBlock className="h-8 w-8 rounded-full flex-shrink-0" />
          <SkeletonBlock className="h-4 flex-1" />
          <SkeletonBlock className="h-4 w-1/4" />
          <SkeletonBlock className="h-5 w-16 rounded-full" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function AdminCardsSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-4`}>
      {Array.from({ length: cols }).map((_, i) => (
        <AdminStatSkeleton key={i} />
      ))}
    </div>
  );
}

export default function AdminSkeleton({ rows = 5, type = 'table', cols = 4 }: AdminSkeletonProps) {
  if (type === 'cards') return <AdminCardsSkeleton cols={cols} />;
  if (type === 'stat') return <AdminStatSkeleton />;
  return <AdminTableSkeleton rows={rows} />;
}
