import { Skeleton, SkeletonRows, Card } from '@/components/redesign'

export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-7 w-36" />
      </div>
      <Skeleton className="mb-4 h-9 w-full max-w-[420px] rounded-[10px]" />
      <Card>
        <SkeletonRows rows={7} />
      </Card>
    </div>
  )
}
