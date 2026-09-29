"""Apply migration 007 — users.avatar_url TEXT."""
from pathlib import Path
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

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
        row = conn.execute(
            text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name = 'users' AND column_name = 'avatar_url'"
            )
        ).fetchone()
        print(f"avatar_url type: {row[0] if row else 'MISSING'}")
    print(f"Applied {sql_path.name}")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent / "alembic" / "versions"
    try:
        apply(root / "007_avatar_url_text.sql")
    except Exception as e:
        print("MIGRATION FAILED — run in Supabase SQL Editor:", file=sys.stderr)
        print("ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;", file=sys.stderr)
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
