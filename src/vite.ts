import type { Plugin } from "vite";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

type BabelPath = NodePath & {
  node: t.Node;
  unshiftContainer(key: string, nodes: t.Node | t.Node[]): void;
};

const mockedFns = new Set<string>();

/**
 * A simple Vite plugin that:
 * 1. Detects server functions and injects mock checking into their handlers
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
  /**
   * The function name to use for detecting server function creation.
   * This allows you to use a different function name than the default
   * "createServerFn". Defaults to "createServerFn".
   */
  serverFnName?: string;
}

export function serverFnOverridePlugin(
  options: ServerFnOverrideOptions = { enabled: true }
): Plugin {
  const { enabled, debug = false, serverFnName = "createServerFn" } = options;

  const log = (...args: any[]) => {
    if (debug) {
      console.log("[serverFnOverride]", ...args);
    }
  };

  return {
    name: "vite-plugin-serverfn-override",
    enforce: "pre",

    transform(code, id) {
      if (!enabled || id.includes("node_modules") || !id.match(/\.[jt]sx?$/)) {
        return null;
      }

      try {
        const ast = parser.parse(code, {
          sourceType: "module",
          plugins: ["jsx", "typescript"],
        });

        let needsTransform = false;

        // First pass: find mockServerFn calls and collect names
        traverse(ast, {
          CallExpression(path: NodePath<t.CallExpression>) {
            if (
              t.isIdentifier(path.node.callee) &&
              path.node.callee.name === "mockServerFn" &&
              path.node.arguments.length === 2 &&
              t.isIdentifier(path.node.arguments[0])
            ) {
              const fnName = path.node.arguments[0].name;
              log("Found mock registration for", fnName, "in", id);
              path.node.arguments.push(t.stringLiteral(fnName));
              mockedFns.add(fnName);
              needsTransform = true;
            }
          },
        });

        // Second pass: find server function definitions and replace them
        traverse(ast, {
          VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
            if (
              !t.isIdentifier(path.node.id) ||
              !mockedFns.has(path.node.id.name)
            ) {
              return;
            }

            const fnName = path.node.id.name;

            // Check if this is actually a server function
            let current = path.node.init;
            let isServerFn = false;
            let chainDepth = 0;

            // Handle different patterns of server function creation:
            // 1. serverFnName().handler()
            // 2. serverFnName().validator().handler()
            // 3. serverFnName().handler().someOtherMethod()
            while (t.isCallExpression(current)) {
              if (
                t.isIdentifier(current.callee) &&
                current.callee.name === serverFnName
              ) {
                isServerFn = true;
                log(`Found ${serverFnName} at depth ${chainDepth} for`, fnName);
                break;
              }
              // Move up the chain if it's a method call
              if (t.isMemberExpression(current.callee)) {
                const methodName = t.isIdentifier(current.callee.property)
                  ? current.callee.property.name
                  : "unknown";
                log(`Found method '${methodName}' in chain for`, fnName);
                current = current.callee.object;
                chainDepth++;
              } else {
                log(
                  `Breaking chain at depth ${chainDepth} for`,
                  fnName,
                  "- not a method call"
                );
                break;
              }
            }

            if (!isServerFn) {
              log(
                "Skipping",
                fnName,
                "as it's not a server function (chain depth:",
                chainDepth,
                ")"
              );
              return;
            }

            log("Found mocked server function", fnName, "in", id);

            // Add our mock imports
            const program = path.findParent((p) => p.isProgram()) as BabelPath;
            if (program) {
              log("Adding mock import to", id);
              program.unshiftContainer(
                "body",
                t.importDeclaration(
                  [
                    t.importSpecifier(
                      t.identifier("getMockImplementation"),
                      t.identifier("getMockImplementation")
                    ),
                  ],
                  t.stringLiteral("tanstack-mock-server-fn")
                )
              );
            }

            // Replace the entire server function with a direct mock call
            path.node.init = t.arrowFunctionExpression(
              [t.identifier("args")],
              t.blockStatement([
                t.variableDeclaration("const", [
                  t.variableDeclarator(
                    t.identifier("mockImpl"),
                    t.callExpression(t.identifier("getMockImplementation"), [
                      t.stringLiteral(fnName),
                    ])
                  ),
                ]),
                t.ifStatement(
                  t.identifier("mockImpl"),
                  t.returnStatement(
                    t.callExpression(t.identifier("mockImpl"), [
                      t.logicalExpression(
                        "??",
                        t.identifier("args"),
                        t.objectExpression([])
                      ),
                    ])
                  ),
                  t.throwStatement(
                    t.newExpression(t.identifier("Error"), [
                      t.stringLiteral(
                        `No mock implementation found for ${fnName}`
                      ),
                    ])
                  )
                ),
              ])
            );

            log(
              "Successfully replaced server function with mock for",
              fnName,
              "in",
              id
            );
            needsTransform = true;
          },
        });

        if (needsTransform) {
          const output = generate(ast, {}, code);
          log("Transformed file", id);
          return {
            code: output.code,
            map: null,
          };
        }

        return null;
      } catch (error) {
        console.error("[serverFnOverride] Error processing", id, error);
        return null;
      }
    },
  };
}
