'use client'

import { useState } from 'react'

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'horas', label: 'Horas' },
  { id: 'piezas', label: 'Piezas' },
  { id: 'costes', label: 'Costes resultantes' },
] as const

type TabId = (typeof TABS)[number]['id']

interface Props {
  defaultTab?: TabId
  children: (activeTab: TabId) => React.ReactNode
}

export function WorkOrderTabs({ defaultTab = 'resumen', children }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)

  return (
    <div className="space-y-0">
      <div className="flex border-b border-cn-line">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-cn-teal-900 text-cn-teal-900'
                : 'text-cn-ink-500 hover:text-cn-ink-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{children(activeTab)}</div>
    </div>
  )
}
