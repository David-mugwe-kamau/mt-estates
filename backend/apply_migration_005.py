"""Apply SQL migration files through DATABASE_URL (Supabase pooler)."""
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import os

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
    print(f"Applied {sql_path.name}: {len(statements)} statements")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent / "alembic" / "versions"
    apply(root / "005_viewings_billing.sql")
