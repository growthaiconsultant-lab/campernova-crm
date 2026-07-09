import { Skeleton, SkeletonRows, Card } from '@/components/redesign'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-[18px]">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-7 w-64" />
      </div>
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-[14px]" />
        ))}
      </div>
      <Card>
        <Skeleton className="mb-4 h-4 w-32" />
        <SkeletonRows rows={4} />
      </Card>
    </div>
  )
}
