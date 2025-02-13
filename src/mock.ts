// Global registry to store mock implementations
declare global {
  var __SERVER_FN_MOCKS__: Record<string, Function>;
}

// Initialize global registry if it doesn't exist
globalThis.__SERVER_FN_MOCKS__ = globalThis.__SERVER_FN_MOCKS__ || {};

// Debug helper
const debug = (...args: any[]) => {
  console.log("[mock-server-fn]", ...args);
};

/**
 * Register a mock implementation for a server function.
 * @internal The third parameter is injected by the Vite plugin
 */
export function mockServerFn<TArgs extends Array<any>, TReturn>(
  serverFn: (...args: TArgs) => Promise<TReturn> | TReturn,
  mockImpl: (...args: TArgs) => Promise<TReturn> | TReturn,
  _fnName?: string // Injected by Vite plugin
): void {
  const name = _fnName || serverFn.name;
  debug("Registering mock for", name);
  globalThis.__SERVER_FN_MOCKS__[name] = mockImpl;
}

/**
 * Get a mock implementation if one exists
 */
export function getMockImplementation(fnName: string): Function | undefined {
  const mockImpl = globalThis.__SERVER_FN_MOCKS__[fnName];
  debug("Looking up mock for", fnName, "found:", !!mockImpl);
  return mockImpl;
}

/**
 * Clear all registered mocks
 */
export function clearMocks(): void {
  debug("Clearing all mocks");
  globalThis.__SERVER_FN_MOCKS__ = {};
}

/**
 * Check if a function has a mock implementation
 */
export function hasMock(fnName: string): boolean {
  return fnName in globalThis.__SERVER_FN_MOCKS__;
}
