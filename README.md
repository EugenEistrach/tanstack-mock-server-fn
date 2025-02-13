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

## Vite Integration

To enable server function mocking, add the Vite plugin to your configuration. The plugin automatically inspects your code to locate server functions (which must be created via a call chain starting with `createServerFn` by default, or a custom name you configure) and rewrites them to delegate to your registered mocks.

**Configuration Options:**

- `enabled`: _(boolean, default: `true`)_ - Whether the plugin is active. If `false`, the plugin skips rewriting, and the real server function is used.
- `debug`: _(boolean, default: `false`)_ - Whether to enable debug logging in the console during development.
- `serverFnName`: _(string, default: `"createServerFn"`)_ - The function name used to detect server function creation. This option allows you to specify a different function name if your server function creator is named something other than `"createServerFn"`.

**Example Configuration:**

```ts:README.md
// vite.config.ts
import { defineConfig } from "vite";
import { serverFnOverridePlugin } from "tanstack-mock-server-fn/vite";

export default defineConfig({
  plugins: [
    serverFnOverridePlugin({
      enabled: true,                 // Enable for stories/tests, disable for production
      debug: false,                  // Optional: Enable debug logging during development
      serverFnName: "createServerFn", // Optional: Customize the server function creator name
    }),
  ],
});
```

If you use a different function name to create your server functions, for example, `myServerFnCreator`, you would configure the plugin like this:

```ts:README.md
// vite.config.ts
import { defineConfig } from "vite";
import { serverFnOverridePlugin } from "tanstack-mock-server-fn/vite";

export default defineConfig({
  plugins: [
    serverFnOverridePlugin({
      enabled: true,
      debug: true,
      serverFnName: "myServerFnCreator", // Use "myServerFnCreator" instead of "createServerFn"
    }),
  ],
});
```

## Mocking Server Functions

In your stories or tests, you can easily mock your server functions. Import the `mockServerFn` helper from this package and register your mock implementation. Importantly, you pass exactly two arguments—the function to be mocked and your mock implementation. The plugin automatically injects the function's name as a third parameter, ensuring correct linkage.

```ts:story.ts
// my-story.ts
import { mockServerFn, clearMocks } from "tanstack-mock-server-fn";
import { getUsers } from "./api";
import { mockUserData } from "./test-data";

// Register a mock implementation for the getUsers server function
mockServerFn(getUsers, async (args) => {
  console.log("Using mock implementation for getUsers");
  return mockUserData;
});

// Later, if necessary, you can clear all registered mocks
clearMocks();
```

When the server function `getUsers` is invoked in your testing environment, the Vite plugin transforms it into something like this:

```js:transformation.js
(args) => {
  const mockImpl = getMockImplementation("getUsers");
  if (mockImpl)
    return mockImpl(args ?? {});
  throw new Error("No mock implementation found for getUsers");
}
```

If no mock is found, an error will be thrown. This ensures that you are always explicitly handling the behavior of your mocked server functions.

## Advanced API

Internally, the package uses a global registry to store mock implementations. In addition to `mockServerFn` and `clearMocks`, you can access two additional helpers:

- **Check if a mock exists:**

  ```ts:advanced.ts
  import { hasMock } from "tanstack-mock-server-fn";
  if (hasMock("getUsers")) {
    console.log("Mock for getUsers is registered");
  }
  ```

- **Directly fetch the mock implementation:**
  ```ts:advanced2.ts
  import { getMockImplementation } from "tanstack-mock-server-fn";
  const mock = getMockImplementation("getUsers");
  ```

## How It Works

1. **Runtime Registry:** A global registry stores your mock implementations, keyed by the function name.
2. **Vite Plugin Transformation:** The plugin scans your code for server functions (identified by a call chain beginning with `createServerFn`), and rewrites them to delegate to a registered mock.

## License

[MIT](./LICENSE)
