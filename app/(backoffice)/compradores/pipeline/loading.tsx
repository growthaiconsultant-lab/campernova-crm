import { Skeleton } from '@/components/redesign'

export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-7 w-56" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[268px] shrink-0 rounded-[13px] border border-line bg-canvas">
            <Skeleton className="m-3 h-4 w-28" />
            <div className="space-y-2 p-2.5 pt-0">
              <Skeleton className="h-[84px] w-full rounded-[11px]" />
              <Skeleton className="h-[84px] w-full rounded-[11px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
