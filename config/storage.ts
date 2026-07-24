export function createStorage(_namespace: string) {
  return {
    clearAll() {
      // no-op stub for build
    },
    get(_key: string) { return null },
    set(_key: string, _value: any) { /** no-op */ },
  }
}
