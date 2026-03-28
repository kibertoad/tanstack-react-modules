import { createContext, useContext } from 'react'
import type { SlotMap } from '@reactive/core'

export const SlotsContext = createContext<SlotMap | null>(null)

/**
 * Access the collected slot contributions from all registered modules.
 * Must be used within a <ReactiveApp /> provider tree.
 *
 * @example
 * const slots = useSlots<AppSlots>()
 * const commands = slots.commands // CommandDefinition[] from all modules
 */
export function useSlots<TSlots extends SlotMap>(): TSlots {
  const slots = useContext(SlotsContext)
  if (!slots) {
    throw new Error(
      '[@reactive/registry] useSlots must be used within a <ReactiveApp />.',
    )
  }
  return slots as TSlots
}
