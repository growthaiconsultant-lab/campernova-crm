import { Skeleton } from '@/components/redesign'

export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-7 w-36" />
      </div>
      <Skeleton className="mb-5 h-8 w-full max-w-[420px] rounded-[9px]" />
      <Skeleton className="mb-2.5 h-3 w-32" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-[14px]" />
        ))}
      </div>
    </div>
  )
}
