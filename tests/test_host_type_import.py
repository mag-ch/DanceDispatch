import ast
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


def test_imported_host_uses_type_and_only_reads_id():
    source = (Path(__file__).resolve().parents[1] / "src" / "migrate_supabase.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    functions = [
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name in ("_insert_host", "get_host_id")
    ]

    class Query:
        def __init__(self):
            self.operations = []
            self.inserted = False

        def table(self, name):
            self.operations.append(("table", name))
            return self

        def select(self, fields):
            self.operations.append(("select", fields))
            return self

        def eq(self, column, value):
            return self

        def limit(self, number):
            return self

        def insert(self, data, **kwargs):
            self.operations.append(("insert", data, kwargs))
            self.inserted = True
            return self

        def execute(self):
            return SimpleNamespace(data=[{"id": 42}] if self.inserted else [])

    query = Query()
    namespace = {"interactive": True, "_execute_with_retry": lambda call: call(), "_client": lambda: query}
    exec(compile(ast.Module(body=functions, type_ignores=[]), "src/migrate_supabase.py", "exec"), namespace)
    with patch("builtins.input", side_effect=["", "judge"]):
        assert namespace["get_host_id"]("Example") == [42]

    assert ("insert", {"name": "Example", "bio": None, "host_type": "Judge"}, {"returning": "minimal"}) in query.operations
    assert all(operation[1] == "id" for operation in query.operations if operation[0] == "select")
