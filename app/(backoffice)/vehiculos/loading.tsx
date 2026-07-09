import { Skeleton } from '@/components/redesign'

export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-7 w-40" />
      </div>
      <Skeleton className="mb-4 h-12 w-full rounded-[12px]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[236px] w-full rounded-[14px]" />
        ))}
      </div>
    </div>
  )
}
