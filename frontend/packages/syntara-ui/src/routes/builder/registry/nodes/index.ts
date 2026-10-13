/**
 * Central registration point for all workflow step types (Add step panel).
 * Auto-discovers registration modules using import.meta.glob (each maps to React Flow node components).
 */

// Stryker disable all: Vite needs static glob arguments before test transforms run.
const nodeModules = import.meta.glob<{ default: () => void }>(['./register*Node.ts', '!./*.test.ts', '!./*.spec.ts'], {
  eager: true,
})
// Stryker restore all

/**
 * Register all workflow step types.
 * Call this once during app initialization.
 *
 * Discovers and registers every `register*Node.ts` module (each defines a canvas step type for the builder).
 */
export function registerAllNodes() {
  for (const module of Object.values(nodeModules)) {
    module.default()
  }
}
