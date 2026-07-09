import { Skeleton } from '@/components/redesign'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-[18px]">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-[14px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Skeleton className="h-[320px] w-full rounded-[14px]" />
        <Skeleton className="h-[260px] w-full rounded-[14px]" />
      </div>
    </div>
  )
}
