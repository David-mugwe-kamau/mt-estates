"""Apply SQL migration 006 (arrears) through DATABASE_URL."""
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import os
import sys

load_dotenv()


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
        # verify
        row = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'meter_readings' AND column_name = 'arrears'"
            )
        ).fetchone()
        if not row:
            raise RuntimeError("arrears column not found after migration")
    print(f"Applied {sql_path.name}: {len(statements)} statements; arrears column verified")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent / "alembic" / "versions"
    try:
        apply(root / "006_arrears_carryforward.sql")
    except Exception as e:
        print("MIGRATION FAILED — run this SQL manually in Supabase SQL Editor:", file=sys.stderr)
        print(
            "ALTER TABLE meter_readings\n"
            "  ADD COLUMN IF NOT EXISTS arrears NUMERIC(12,2) NOT NULL DEFAULT 0;",
            file=sys.stderr,
        )
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
