export function mockServerFn<TArgs extends Array<any>, TReturn>(
  _serverFn: (...args: TArgs) => Promise<TReturn> | TReturn,
  _mockHandler: (...args: TArgs) => Promise<TReturn> | TReturn
): void {
  // This is just an empty marker function. We do nothing here at runtime.
  // The Vite plugin will intercept this call at build time, remember that
  // "serverFn" should be replaced with "mockHandler" in your final code.
  // At runtime, if the plugin is disabled, calls to `serverFn` remain real.
  // If the plugin is enabled, calls to `serverFn` become calls to `mockHandler`.
}
