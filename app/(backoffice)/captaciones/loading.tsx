import { Skeleton } from '@/components/redesign'

export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <Skeleton className="mb-4 h-14 w-full rounded-[12px]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-w-0 rounded-[13px] border border-line bg-canvas">
            <Skeleton className="m-3 h-4 w-32" />
            <div className="space-y-2 p-2.5 pt-0">
              <Skeleton className="h-[92px] w-full rounded-[11px]" />
              <Skeleton className="h-[92px] w-full rounded-[11px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
