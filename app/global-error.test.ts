import { afterEach, describe, expect, it, vi } from 'vitest'
import { Children, isValidElement, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import GlobalError from './global-error'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void) => effect(),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function findButton(node: ReactNode): { onClick: () => void; children: ReactNode } | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick: () => void }>(child)) continue
    if (child.type === 'button') return { ...child.props, children: child.props.children }
    const button = findButton(child.props.children)
    if (button) return button
  }
}

describe('global error recovery', () => {
  it('captures the error, then reloads only on explicit click without reusing the broken tree', () => {
    const reload = vi.fn()
    const reset = vi.fn()
    vi.stubGlobal('window', { location: { reload } })
    const error = new Error('test runtime failure')
    const button = findButton(GlobalError({ error, reset }))
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
    expect(reload).not.toHaveBeenCalled()
    expect(button?.children).toBe('Recargar página')
    button?.onClick()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })
})
