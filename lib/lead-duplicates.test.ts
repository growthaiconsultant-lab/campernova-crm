import { describe, expect, it } from 'vitest'
import { leadDuplicateGroups } from './lead-duplicates'

const lead = (id: string, agentId: string | null, phone = '', email: string | null = null) => ({
  id,
  agentId,
  phone,
  email,
})
describe('duplicate contacts across agents', () => {
  it('matches Spanish phones with spaces and international prefixes', () => {
    expect(
      leadDuplicateGroups([lead('1', 'a', '612 345 678'), lead('2', 'b', '0034 612345678')])
    ).toHaveLength(1)
  })
  it('matches trimmed case-insensitive emails', () => {
    expect(
      leadDuplicateGroups([
        lead('1', 'a', '', ' Example@example.com '),
        lead('2', 'b', '', 'example@example.com'),
      ])[0].criterion
    ).toBe('email')
  })
  it('excludes same-owner and unassigned-only overlaps', () => {
    expect(
      leadDuplicateGroups([
        lead('1', 'a', '612345678'),
        lead('2', 'a', '612345678'),
        lead('3', null, '612345678'),
      ])
    ).toEqual([])
  })
  it('ignores empty and short placeholder contacts', () => {
    expect(leadDuplicateGroups([lead('1', 'a', '123'), lead('2', 'b', '123')])).toEqual([])
  })
  it('keeps all affected records in a conflict group', () => {
    expect(
      leadDuplicateGroups([
        lead('1', 'a', '612345678'),
        lead('2', 'b', '612345678'),
        lead('3', null, '612345678'),
      ])[0].leads
    ).toHaveLength(3)
  })
})
