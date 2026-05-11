interface Props {
  percent: number
}

export function CompletionBadge({ percent }: Props) {
  const color =
    percent >= 90
      ? 'bg-green-100 text-green-700 border-green-200'
      : percent >= 60
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-red-100 text-red-700 border-red-200'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          percent >= 90 ? 'bg-green-500' : percent >= 60 ? 'bg-amber-500' : 'bg-red-500'
        }`}
      />
      Expediente {percent}%
    </span>
  )
}
