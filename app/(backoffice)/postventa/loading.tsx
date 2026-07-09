import { Skeleton } from '@/components/redesign'

export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-7 w-40" />
      </div>
      <Skeleton className="mb-5 h-8 w-full max-w-[480px] rounded-[9px]" />
      <div className="flex flex-col gap-3.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[130px] w-full rounded-[14px]" />
        ))}
      </div>
    </div>
  )
}
