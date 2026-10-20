import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("src");
const configPath = ts.findConfigFile(".", ts.sys.fileExists, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, ".");
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : /\.[jt]sx?$/.test(file) && !file.endsWith(".d.ts") ? [file] : [];
  });
}
const graph = new Map();
const errors = [];
const relative = file => path.relative(root, file).replaceAll("\\", "/");
for (const file of files(root)) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const edges = [];
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    const specifier = node.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    if (node.isTypeOnly || node.importClause?.isTypeOnly) continue;
    const clause = node.importClause;
    if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
      && clause.namedBindings.elements.every(element => element.isTypeOnly)) continue;
    const name = specifier.text;
    if (!name.startsWith(".") && !name.startsWith("@/")) continue;
    if (/\.css$/.test(name)) continue;
    const resolved = ts.resolveModuleName(name, file, options, ts.sys).resolvedModule;
    if (!resolved) { errors.push(`Unresolved import: ${relative(file)} -> ${name}`); continue; }
    const target = path.resolve(resolved.resolvedFileName);
    if (target.startsWith(`${root}${path.sep}`)) edges.push(target);
    if (/^(components|config|services|lib)\//.test(relative(file)) && relative(target).startsWith("features/"))
      errors.push(`Shared module depends on a feature: ${relative(file)} -> ${relative(target)}`);
  }
  graph.set(file, edges);
}
const visited = new Set();
const active = new Set();
function visit(file, chain = []) {
  if (active.has(file)) { errors.push(`Runtime cycle: ${[...chain.slice(chain.indexOf(file)), file].map(relative).join(" -> ")}`); return; }
  if (visited.has(file)) return;
  active.add(file);
  for (const target of graph.get(file) ?? []) visit(target, [...chain, file]);
  active.delete(file);
  visited.add(file);
}
for (const file of graph.keys()) visit(file);
if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  if (!process.argv.includes("--baseline")) process.exitCode = 1;
} else console.log(`PASS: ${graph.size} source modules resolve, contain no runtime import cycles, and preserve shared-module boundaries`);
