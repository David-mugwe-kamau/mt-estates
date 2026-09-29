"""Apply migration 013 — type rent + vacancy."""
from pathlib import Path
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

HINT = (
    "ALTER TABLE unit_types ADD COLUMN IF NOT EXISTS rent_amount NUMERIC(12, 2);\n"
    "ALTER TABLE unit_types ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT TRUE;"
)


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
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'unit_types' AND column_name = 'is_vacant'"
            )
        ).fetchone()
        if not row:
            raise RuntimeError("is_vacant not found after migration")
    print(f"Applied {sql_path.name}: {len(statements)} statements; is_vacant verified")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent / "alembic" / "versions"
    try:
        apply(root / "013_type_rent_vacancy.sql")
    except Exception as e:
        print("MIGRATION FAILED — run in Supabase SQL Editor:", file=sys.stderr)
        print(HINT, file=sys.stderr)
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
