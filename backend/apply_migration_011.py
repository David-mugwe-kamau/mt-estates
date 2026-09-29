"""Apply migration 011 — county and locality on properties."""
from pathlib import Path
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

HINT = (
    "ALTER TABLE properties ADD COLUMN IF NOT EXISTS county VARCHAR(100);\n"
    "ALTER TABLE properties ADD COLUMN IF NOT EXISTS locality VARCHAR(150);"
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
        rows = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'properties' AND column_name IN ('county', 'locality')"
            )
        ).fetchall()
        found = {r[0] for r in rows}
        if "county" not in found or "locality" not in found:
            raise RuntimeError(f"county/locality not found after migration: {found}")
    print(f"Applied {sql_path.name}: {len(statements)} statements; county+locality verified")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent / "alembic" / "versions"
    try:
        apply(root / "011_county_locality.sql")
    except Exception as e:
        print("MIGRATION FAILED — run in Supabase SQL Editor:", file=sys.stderr)
        print(HINT, file=sys.stderr)
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
