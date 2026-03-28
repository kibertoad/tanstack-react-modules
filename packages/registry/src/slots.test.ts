import { describe, it, expect } from 'vitest'
import { buildSlotsManifest } from './slots.js'
import type { ReactiveModuleDescriptor, SlotMap } from '@reactive/core'
import type { AnyRoute } from '@tanstack/react-router'

interface TestSlots extends SlotMap {
  commands: { id: string; label: string }[]
  badges: { type: string }[]
}

function fakeModule(
  overrides: Partial<ReactiveModuleDescriptor<any, TestSlots>> = {},
): ReactiveModuleDescriptor<any, TestSlots> {
  return {
    id: overrides.id ?? 'test',
    version: '0.1.0',
    createRoutes: (parent: AnyRoute) => parent,
    ...overrides,
  }
}

describe('buildSlotsManifest', () => {
  it('returns empty object when no modules have slots', () => {
    const result = buildSlotsManifest<TestSlots>([
      fakeModule({ id: 'a' }),
      fakeModule({ id: 'b' }),
    ])

    expect(result).toEqual({})
  })

  it('collects slots from a single module', () => {
    const result = buildSlotsManifest<TestSlots>([
      fakeModule({
        id: 'billing',
        slots: {
          commands: [{ id: 'cmd-1', label: 'Open Billing' }],
        },
      }),
    ])

    expect(result.commands).toEqual([{ id: 'cmd-1', label: 'Open Billing' }])
  })

  it('concatenates slots from multiple modules', () => {
    const result = buildSlotsManifest<TestSlots>([
      fakeModule({
        id: 'billing',
        slots: {
          commands: [{ id: 'cmd-1', label: 'Open Billing' }],
          badges: [{ type: 'overdue' }],
        },
      }),
      fakeModule({
        id: 'users',
        slots: {
          commands: [{ id: 'cmd-2', label: 'View Users' }],
        },
      }),
    ])

    expect(result.commands).toEqual([
      { id: 'cmd-1', label: 'Open Billing' },
      { id: 'cmd-2', label: 'View Users' },
    ])
    expect(result.badges).toEqual([{ type: 'overdue' }])
  })

  it('skips modules without slots property', () => {
    const result = buildSlotsManifest<TestSlots>([
      fakeModule({ id: 'no-slots' }),
      fakeModule({
        id: 'with-slots',
        slots: { commands: [{ id: 'cmd-1', label: 'Test' }] },
      }),
    ])

    expect(result.commands).toEqual([{ id: 'cmd-1', label: 'Test' }])
  })

  it('handles empty slot arrays', () => {
    const result = buildSlotsManifest<TestSlots>([
      fakeModule({
        id: 'empty',
        slots: { commands: [] },
      }),
    ])

    expect(result.commands).toEqual([])
  })
})
