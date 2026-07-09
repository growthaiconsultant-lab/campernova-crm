import { Skeleton, SkeletonRows, Card } from '@/components/redesign'

export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-7 w-52" />
      </div>
      <div className="mb-3 flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-[9px]" />
        ))}
      </div>
      <Skeleton className="mb-4 h-[92px] w-full rounded-[14px]" />
      <Card>
        <SkeletonRows rows={8} />
      </Card>
    </div>
  )
}
