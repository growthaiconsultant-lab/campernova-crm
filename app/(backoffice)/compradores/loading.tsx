import { Skeleton, SkeletonRows, Card } from '@/components/redesign'

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando compradores">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <Card>
        <Skeleton className="mb-4 h-8 w-full max-w-md" />
        <Skeleton className="mb-4 h-10 w-full rounded-lg" />
        <SkeletonRows rows={8} />
      </Card>
    </div>
  )
}
