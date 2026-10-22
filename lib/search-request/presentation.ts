import { QUESTION_SECTIONS, type Question } from './questions'

/** WEB-12 creates this immutable identity; source/status remain editable separately. */
export function isSearchRequestLead(id: string) {
  return /^search_request_[a-f0-9]{40}$/.test(id)
}

export type SearchAnswerRow = Pick<Question, 'key' | 'label' | 'kind'> & {
  value: string
  provided: boolean
}
export type SearchAnswerSection = { title: string; rows: SearchAnswerRow[] }

/** Read-only adapter for WEB-12 snapshots. Ambiguous text falls back to the full original. */
export function readSearchSnapshot(content: string | null): SearchAnswerSection[] | null {
  if (!content) return null
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  if (
    lines[0] !== 'FICHA DE BÚSQUEDA WEB · /busqueda-bajo-pedido' ||
    !lines[1]?.startsWith('Versión ') ||
    !lines[2]?.startsWith('Acepta el tratamiento ')
  )
    return null

  const markers = QUESTION_SECTIONS.flatMap((section) => [
    {
      title: section.title,
      question: null as Question | null,
      prefix: section.title.toUpperCase(),
    },
    ...section.questions.map((question) => ({
      title: section.title,
      question,
      prefix: `${question.label}: `,
    })),
  ])
  const positions: number[] = []
  for (const marker of markers) {
    const hits: number[] = []
    for (let i = 3; i < lines.length; i++) {
      if (marker.question ? lines[i].startsWith(marker.prefix) : lines[i] === marker.prefix)
        hits.push(i)
    }
    if (hits.length !== 1 || hits[0] <= (positions[positions.length - 1] ?? 2)) return null
    positions.push(hits[0])
  }
  if (lines.slice(3, positions[0]).some((line) => line.trim())) return null
  if (
    markers.some(
      (marker, index) =>
        !marker.question &&
        lines.slice(positions[index] + 1, positions[index + 1]).some((line) => line.trim())
    )
  )
    return null

  const sections: SearchAnswerSection[] = []
  markers.forEach((marker, index) => {
    const from = positions[index]
    const to = positions[index + 1] ?? lines.length
    if (!marker.question) {
      sections.push({ title: marker.title, rows: [] })
      return
    }
    const value = [lines[from].slice(marker.prefix.length), ...lines.slice(from + 1, to)]
      .join('\n')
      .trimEnd()
    const { key, label, kind } = marker.question
    sections[sections.length - 1].rows.push({
      key,
      label,
      kind,
      value,
      provided: !!value.trim() && value !== 'Sin indicar',
    })
  })
  return sections
}

const moneyKeys = new Set(['budget', 'budgetLimit', 'improvementsBudget'])
export function formatSearchAnswer(row: SearchAnswerRow) {
  if (!row.provided) return 'Pendiente de concretar'
  if (moneyKeys.has(row.key) && /^\d+(\.\d{1,2})?$/.test(row.value)) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(row.value))
  }
  if (row.kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(row.value)) {
    const [year, month, day] = row.value.split('-')
    return `${day}/${month}/${year}`
  }
  if (row.kind === 'number' && /^\d+(\.\d{1,2})?$/.test(row.value)) {
    const units: Record<string, string> = {
      maxKm: ' km',
      maxLength: ' m',
      minInteriorHeight: ' m',
      personHeight: ' cm',
    }
    // Years are identifiers, not a quantity with a thousands separator.
    return row.key === 'minYear'
      ? row.value
      : `${Number(row.value).toLocaleString('es-ES')}${units[row.key] ?? ''}`
  }
  return row.value
}
