import type { ReactiveModuleDescriptor, SlotMap } from '@reactive/core'

/**
 * Collects slot contributions from all registered modules.
 * Arrays are concatenated per slot key across modules.
 */
export function buildSlotsManifest<TSlots extends SlotMap>(
  modules: readonly ReactiveModuleDescriptor<any, TSlots>[],
): TSlots {
  const result: Record<string, unknown[]> = {}

  for (const mod of modules) {
    if (!mod.slots) continue
    for (const [key, items] of Object.entries(mod.slots)) {
      if (!result[key]) result[key] = []
      if (Array.isArray(items)) {
        result[key].push(...items)
      }
    }
  }

  return result as unknown as TSlots
}
