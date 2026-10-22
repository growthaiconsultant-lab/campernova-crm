import { describe, expect, it } from 'vitest'
import { leadListView } from './lead-list-view'

describe('personal lead list default', () => {
  it.each(['mis_leads', 'mis-leads'])('opens %s on an unfiltered visit', (mine) => {
    expect(leadListView(undefined, mine)).toBe(mine)
  })
  it.each(['todos', 'sin_asignar', 'stock'])('respects explicit view %s', (view) => {
    expect(leadListView(view, 'mis_leads')).toBe(view)
  })
  it.each(['another-agent', '__none__'])('allows a direct agent filter %s', (agentId) => {
    expect(leadListView(undefined, 'mis_leads', agentId)).toBe('todos')
  })
  it('preserves an explicit personal view with a filter', () => {
    expect(leadListView('mis_leads', 'mis_leads', 'another-agent')).toBe('mis_leads')
  })
})
