// Registry to store mock implementations
const mockRegistry = new Map<string, Function>();

/**
 * Register a mock implementation for a server function
 */
export function mockServerFn<TArgs extends Array<any>, TReturn>(
  serverFn: (...args: TArgs) => Promise<TReturn> | TReturn,
  mockImpl: (...args: TArgs) => Promise<TReturn> | TReturn
): void {
  // Use the function name as the key
  const key = serverFn.name;
  if (!key) {
    throw new Error("Server function must have a name to be mocked");
  }
  mockRegistry.set(key, mockImpl);
}

/**
 * Get a mock implementation if one exists
 */
export function getMockImplementation(fnName: string): Function | undefined {
  return mockRegistry.get(fnName);
}

/**
 * Clear all registered mocks
 */
export function clearMocks(): void {
  mockRegistry.clear();
}

/**
 * Check if a function has a mock implementation
 */
export function hasMock(fnName: string): boolean {
  return mockRegistry.has(fnName);
}

/**
 * Create a mock wrapper that checks the registry
 */
export function createMockWrapper<TArgs extends Array<any>, TReturn>(
  originalFn: (...args: TArgs) => Promise<TReturn> | TReturn
): (...args: TArgs) => Promise<TReturn> | TReturn {
  return (...args: TArgs) => {
    const mockImpl = getMockImplementation(originalFn.name);
    if (mockImpl) {
      return mockImpl(...args);
    }
    return originalFn(...args);
  };
}
