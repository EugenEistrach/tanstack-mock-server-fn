import type { Plugin } from "vite";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

/**
 * A simple Vite plugin that:
 * 1. Detects calls to `mockServerFn(realFn, mockFn)`.
 * 2. Records pairs { realFnName -> mockFnName }.
 * 3. Rewrites calls to realFnName(...) to mockFnName(...).
 *
 * In normal ESM usage, you can't reassign an import. So we rely on AST transforms:
 * while bundling your stories (or code), we go in and replace calls to realFnName
 * with calls to mockFnName whenever the "mock is enabled".
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
  // Keep track of mocks and their implementations
  const mocks = new Map<string, t.ArrowFunctionExpression>();

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

          // First pass: collect mock implementations from story files
          if (isStoryFile) {
            traverse(ast, {
              CallExpression(path) {
                if (
                  t.isIdentifier(path.node.callee) &&
                  path.node.callee.name === "mockServerFn" &&
                  path.node.arguments.length === 2
                ) {
                  const [realFn, mockImpl] = path.node.arguments;
                  if (
                    t.isIdentifier(realFn) &&
                    t.isArrowFunctionExpression(mockImpl)
                  ) {
                    log("Found mock for", realFn.name);
                    mocks.set(realFn.name, mockImpl);
                    needsTransform = true;
                  }
                }
              },
            });
          }

          // Second pass: replace any exports or declarations of the server function
          if (mocks.size > 0) {
            // Track what we've replaced to avoid duplicates
            const replacedInFile = new Set<string>();

            traverse(ast, {
              // Replace export declarations
              ExportNamedDeclaration(path) {
                if (t.isVariableDeclaration(path.node.declaration)) {
                  path.node.declaration.declarations.forEach((decl) => {
                    if (t.isIdentifier(decl.id)) {
                      const mock = mocks.get(decl.id.name);
                      if (mock && !replacedInFile.has(decl.id.name)) {
                        log("Replacing export of", decl.id.name, "in", id);
                        decl.init = mock;
                        replacedInFile.add(decl.id.name);
                        needsTransform = true;
                      }
                    }
                  });
                }
              },
              // Replace variable declarations
              VariableDeclarator(path) {
                if (t.isIdentifier(path.node.id)) {
                  const mock = mocks.get(path.node.id.name);
                  if (mock && !replacedInFile.has(path.node.id.name)) {
                    log(
                      "Replacing declaration of",
                      path.node.id.name,
                      "in",
                      id
                    );
                    path.node.init = mock;
                    replacedInFile.add(path.node.id.name);
                    needsTransform = true;
                  }
                }
              },
              // Replace imports with mock declarations
              ImportDeclaration(path) {
                const replacements: t.VariableDeclaration[] = [];
                path.node.specifiers = path.node.specifiers.filter(
                  (specifier) => {
                    if (
                      t.isImportSpecifier(specifier) &&
                      t.isIdentifier(specifier.imported)
                    ) {
                      const mock = mocks.get(specifier.imported.name);
                      if (mock && !replacedInFile.has(specifier.local.name)) {
                        log(
                          "Replacing import of",
                          specifier.imported.name,
                          "in",
                          id
                        );
                        replacements.push(
                          t.variableDeclaration("const", [
                            t.variableDeclarator(
                              t.identifier(specifier.local.name),
                              mock
                            ),
                          ])
                        );
                        replacedInFile.add(specifier.local.name);
                        needsTransform = true;
                        return false;
                      }
                    }
                    return true;
                  }
                );
                if (replacements.length > 0) {
                  if (path.node.specifiers.length === 0) {
                    path.replaceWithMultiple(replacements);
                  } else {
                    path.insertAfter(replacements);
                  }
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
