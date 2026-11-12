import { Skeleton, SkeletonRows, Card } from '@/components/redesign'

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <Skeleton className="mb-5 h-7 w-52" />
      <div className="mb-5 flex gap-2 border-b pb-2">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-24" />
      </div>
      <Card>
        <Skeleton className="mb-4 h-4 w-32" />
        <SkeletonRows rows={4} />
      </Card>
    </div>
  )
}
