"""Runtime import boundaries, including the no-storage-service requirement."""

import ast
import importlib.util
from pathlib import Path


def test_runtime_graph_resolves_without_cycles_or_storage_dependencies():
    root = Path(__file__).resolve().parents[2] / "app"
    modules = {}
    for path in root.rglob("*.py"):
        module = ".".join(path.relative_to(root.parent).with_suffix("").parts)
        modules[module.removesuffix(".__init__")] = path
    graph = {module: set() for module in modules}
    forbidden = {
        "sqlite3",
        "sqlalchemy",
        "redis",
        "pymongo",
        "psycopg",
        "psycopg2",
        "mysql",
        "databases",
        "tortoise",
    }

    class Imports(ast.NodeVisitor):
        def __init__(self, module, package):
            self.module, self.package = module, package

        def visit_If(self, node):
            if isinstance(node.test, ast.Name) and node.test.id == "TYPE_CHECKING":
                for statement in node.orelse:
                    self.visit(statement)
            else:
                self.generic_visit(node)

        def add(self, target):
            assert target.split(".")[0] not in forbidden, f"Storage dependency: {target}"
            if self.module.startswith("app.features.game."):
                assert target.split(".")[0] not in {"fastapi", "starlette", "uvicorn"}
                assert not target.startswith(
                    ("app.runtime", "app.dependencies", "app.features.realtime")
                )
            if target in modules:
                graph[self.module].add(target)
            elif target.startswith("app."):
                raise AssertionError(f"Unresolved import: {self.module} -> {target}")

        def visit_Import(self, node):
            for alias in node.names:
                self.add(alias.name)

        def visit_ImportFrom(self, node):
            target = (
                importlib.util.resolve_name("." * node.level + (node.module or ""), self.package)
                if node.level
                else node.module
            )
            if target:
                self.add(target)
                for alias in node.names:
                    if (child := target + "." + alias.name) in modules:
                        graph[self.module].add(child)

    for module, path in modules.items():
        package = module if path.name == "__init__.py" else module.rpartition(".")[0]
        Imports(module, package).visit(ast.parse(path.read_text(encoding="utf-8")))

    visited = set()
    active = []

    def visit(module):
        assert module not in active, f"Runtime cycle: {' -> '.join([*active, module])}"
        if module in visited:
            return
        active.append(module)
        for target in graph[module]:
            visit(target)
        active.pop()
        visited.add(module)

    for module in graph:
        visit(module)
