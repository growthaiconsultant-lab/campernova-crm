'use client'

import { useState, createContext, useContext } from 'react'

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'firma', label: 'Firma' },
] as const

type TabId = (typeof TABS)[number]['id']

const TabContext = createContext<TabId>('resumen')

export function DeliveryTabs({
  defaultTab = 'resumen',
  children,
}: {
  defaultTab?: TabId
  children: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)

  return (
    <TabContext.Provider value={activeTab}>
      <div>
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
        <div className="pt-4">{children}</div>
      </div>
    </TabContext.Provider>
  )
}

export function TabPanel({ tab, children }: { tab: TabId; children: React.ReactNode }) {
  const activeTab = useContext(TabContext)
  return <div className={activeTab === tab ? '' : 'hidden'}>{children}</div>
}
