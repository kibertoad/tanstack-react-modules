import type { ReactiveModuleDescriptor, LazyModuleDescriptor } from "@tanstack-react-modules/core";

export function validateNoDuplicateIds(
  modules: ReactiveModuleDescriptor[],
  lazyModules: LazyModuleDescriptor[],
): void {
  const ids = new Set<string>();
  for (const mod of modules) {
    if (ids.has(mod.id)) {
      throw new Error(
        `[@tanstack-react-modules/runtime] Duplicate module ID "${mod.id}". Each module must have a unique ID.`,
      );
    }
    ids.add(mod.id);
  }
  for (const mod of lazyModules) {
    if (ids.has(mod.id)) {
      throw new Error(
        `[@tanstack-react-modules/runtime] Duplicate module ID "${mod.id}". Each module must have a unique ID.`,
      );
    }
    ids.add(mod.id);
  }
}

export function validateDependencies(
  modules: ReactiveModuleDescriptor[],
  availableKeys: Set<string>,
): void {
  for (const mod of modules) {
    if (!mod.requires) continue;
    const missing = mod.requires.filter((key) => !availableKeys.has(key as string));
    if (missing.length > 0) {
      throw new Error(
        `[@tanstack-react-modules/runtime] Module "${mod.id}" requires dependencies not provided by the registry: ` +
          `${missing.map(String).join(", ")}. ` +
          `Available: ${[...availableKeys].join(", ") || "(none)"}`,
      );
    }
  }
}
