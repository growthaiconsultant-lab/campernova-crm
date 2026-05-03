'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Agent = { id: string; name: string }

type Props = {
  agents: Agent[]
  currentAgentId: string | null
}

export function DashboardFilters({ agents, currentAgentId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setAgent(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '__all__') {
      params.delete('agent')
    } else {
      params.set('agent', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Agente:</span>
      <Select value={currentAgentId ?? '__all__'} onValueChange={setAgent}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
