# tanstack-mock-server-fn

A lightweight utility for mocking server functions in your stories and tests.

## Installation

```bash
npm install tanstack-mock-server-fn
# or
pnpm add tanstack-mock-server-fn
# or
yarn add tanstack-mock-server-fn
```

## Usage

1. Add the Vite plugin to your configuration:

```ts
// vite.config.ts
import { serverFnOverridePlugin } from "tanstack-mock-server-fn";

export default defineConfig({
  plugins: [
    serverFnOverridePlugin({
      enabled: true, // Enable for stories/tests, disable for production
      debug: false, // Optional: Enable debug logging
    }),
  ],
});
```

2. Mock your server functions in stories/tests:

```ts
import { mockServerFn } from "tanstack-mock-server-fn";
import { myServerFunction } from "./api";

// Mock the server function
mockServerFn(myServerFunction, async (input) => {
  // Return mock data
  return {
    data: "mocked response",
  };
});

// Now all calls to myServerFunction will use the mock implementation
// when the plugin is enabled
```

## How it Works

The package uses a Vite plugin to transform your code at build time:

1. Detects calls to `mockServerFn(realFn, mockFn)`
2. Records pairs of real and mock functions
3. Rewrites calls to use mock implementations when enabled

This approach allows you to:

- Keep your production code clean and free of mocks
- Easily toggle between real and mock implementations
- Test your UI with predictable mock data

## License

[MIT](./LICENSE)
