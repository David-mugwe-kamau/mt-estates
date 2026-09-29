"""Apply migration 012 — apartment types + type galleries (no photo copy)."""
from pathlib import Path
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

HINT = Path(__file__).resolve().parent.joinpath("alembic", "versions", "012_unit_types.sql").read_text(encoding="utf-8")


def apply(sql_path: Path) -> None:
    url = os.environ["DATABASE_URL"]
    engine = create_engine(url, pool_pre_ping=True)
    sql = sql_path.read_text(encoding="utf-8")
    statements = []
    buf = []
    for line in sql.splitlines():
        s = line.strip()
        if not s or s.startswith("--"):
            continue
        buf.append(line)
        if s.endswith(";"):
            statements.append("\n".join(buf))
            buf = []
    if buf:
        statements.append("\n".join(buf))

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        row = conn.execute(
            text("SELECT to_regclass('public.unit_types')")
        ).fetchone()
        if not row or not row[0]:
            raise RuntimeError("unit_types table not found after migration")
    print(f"Applied {sql_path.name}: {len(statements)} statements; unit_types verified")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent / "alembic" / "versions"
    try:
        apply(root / "012_unit_types.sql")
    except Exception as e:
        print("MIGRATION FAILED — run in Supabase SQL Editor:", file=sys.stderr)
        print(HINT, file=sys.stderr)
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
