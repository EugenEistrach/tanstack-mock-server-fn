# tanstack-mock-server-fn

A lightweight utility for mocking server functions in your stories and tests. Designed to work seamlessly with ESM modules and maintain proper scoping of your mock implementations.

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
import { serverFnOverridePlugin } from "tanstack-mock-server-fn/vite";

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
import { getUsers } from "./api";
import { mockUserData } from "./test-data";

// You can use variables and imports in your mocks
const customUsers = [...mockUserData];

// Register a mock implementation
mockServerFn(getUsers, async () => {
  console.log("Using mock implementation");
  return customUsers;
});

// The original getUsers function will now use the mock implementation
// in stories/tests where mocking is enabled
```

### Advanced Usage

The package uses a registry-based approach that allows you to:

- Use imported data and variables in your mocks
- Maintain proper scoping and context
- Dynamically switch between real and mock implementations

```ts
import { mockServerFn, clearMocks } from "tanstack-mock-server-fn";
import { createUser, deleteUser } from "./api";
import { generateTestUser } from "./test-utils";

// Mock multiple functions
mockServerFn(createUser, async (userData) => {
  const newUser = { ...userData, id: "test-id" };
  mockUsers.push(newUser);
  return newUser;
});

mockServerFn(deleteUser, async (id) => {
  mockUsers = mockUsers.filter((user) => user.id !== id);
  return { success: true };
});

// Clear all mocks if needed
clearMocks();
```

## How it Works

The package uses a combination of:

1. A runtime registry to store mock implementations
2. A Vite plugin that wraps server functions to check the registry
3. ESM-compatible transformations that preserve module semantics

This approach allows you to:

- Keep your production code clean and free of mocks
- Use any imported data or variables in your mocks
- Easily toggle between real and mock implementations
- Test your UI with predictable mock data

## License

[MIT](./LICENSE)
