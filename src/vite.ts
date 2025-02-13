import type { Plugin } from "vite";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

/**
 * A simple Vite plugin that:
 * 1. Detects server functions and wraps them with mock registry checks
 * 2. Allows mockServerFn to register mocks that can use any imported data
 * 3. Preserves ESM module semantics while enabling mocking
 */
export interface ServerFnOverrideOptions {
  /**
   * Whether the plugin is active. If false,
   * we skip rewriting so the real serverFn is used.
   */
  enabled: boolean;
  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

export function serverFnOverridePlugin(
  options: ServerFnOverrideOptions = { enabled: true }
): Plugin[] {
  const { enabled, debug = false } = options;
  // Keep track of functions we've seen to be mocked
  const mockedFunctions = new Set<string>();

  const log = (...args: any[]) => {
    if (debug) {
      console.log("[serverFnOverride]", ...args);
    }
  };

  const debugLog = (...args: any[]) => {
    if (debug) {
      console.debug("[serverFnOverride]", ...args);
    }
  };

  return [
    {
      name: "vite-plugin-serverfn-override",
      enforce: "pre",

      transform(code, id) {
        if (
          !enabled ||
          id.includes("node_modules") ||
          !id.match(/\.[jt]sx?$/)
        ) {
          return null;
        }

        debugLog("Processing file:", id);

        try {
          const ast = parse(code, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
          });

          let needsTransform = false;
          let isStoryFile = id.includes(".stories.");

          // First pass: collect functions that are being mocked
          if (isStoryFile) {
            traverse(ast, {
              CallExpression(path) {
                if (
                  t.isIdentifier(path.node.callee) &&
                  path.node.callee.name === "mockServerFn" &&
                  path.node.arguments.length === 2
                ) {
                  const [realFn] = path.node.arguments;
                  if (t.isIdentifier(realFn)) {
                    log("Found mock for", realFn.name);
                    mockedFunctions.add(realFn.name);
                    needsTransform = true;
                  }
                }
              },
            });
          }

          // Second pass: wrap server functions with mock registry checks
          if (mockedFunctions.size > 0) {
            traverse(ast, {
              // Handle export declarations
              ExportNamedDeclaration(path) {
                if (t.isVariableDeclaration(path.node.declaration)) {
                  path.node.declaration.declarations.forEach((decl) => {
                    if (
                      t.isIdentifier(decl.id) &&
                      mockedFunctions.has(decl.id.name)
                    ) {
                      log("Wrapping export of", decl.id.name, "in", id);
                      // Add import for createMockWrapper if not present
                      addCreateMockWrapperImport(path);
                      // Wrap the original function with createMockWrapper
                      decl.init = t.callExpression(
                        t.identifier("createMockWrapper"),
                        [decl.init as t.Expression]
                      );
                      needsTransform = true;
                    }
                  });
                }
              },
              // Handle variable declarations
              VariableDeclarator(path) {
                if (
                  t.isIdentifier(path.node.id) &&
                  mockedFunctions.has(path.node.id.name)
                ) {
                  log("Wrapping declaration of", path.node.id.name, "in", id);
                  // Add import for createMockWrapper if not present
                  addCreateMockWrapperImport(path);
                  // Wrap the original function with createMockWrapper
                  path.node.init = t.callExpression(
                    t.identifier("createMockWrapper"),
                    [path.node.init as t.Expression]
                  );
                  needsTransform = true;
                }
              },
            });
          }

          if (!needsTransform) {
            return null;
          }

          const output = generate(ast, {}, code);
          log("Transformed", id);
          return {
            code: output.code,
            map: null,
          };
        } catch (error) {
          console.error("[serverFnOverride] Error processing", id, error);
          return null;
        }
      },
    },
    {
      name: "vite-plugin-process-polyfill",
      config() {
        return {
          define: {
            "process.env.NODE_ENV": JSON.stringify(
              process.env.NODE_ENV || "development"
            ),
            "process.env": "{}",
            "process.platform": JSON.stringify(process.platform),
            "process.version": JSON.stringify(process.version),
            "process.versions": JSON.stringify(process.versions),
          },
        };
      },
    },
  ];
}

// Helper to add createMockWrapper import if not present
function addCreateMockWrapperImport(path: any) {
  const program = path.findParent((p: any) => p.isProgram());
  const hasImport = program.node.body.some(
    (node: any) =>
      t.isImportDeclaration(node) &&
      node.source.value === "tanstack-mock-server-fn" &&
      node.specifiers.some(
        (spec: any) =>
          t.isImportSpecifier(spec) &&
          t.isIdentifier(spec.imported) &&
          spec.imported.name === "createMockWrapper"
      )
  );

  if (!hasImport) {
    program.unshiftContainer(
      "body",
      t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier("createMockWrapper"),
            t.identifier("createMockWrapper")
          ),
        ],
        t.stringLiteral("tanstack-mock-server-fn")
      )
    );
  }
}
