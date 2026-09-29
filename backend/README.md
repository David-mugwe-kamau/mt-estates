# MT Estates – Backend

Production-ready MVP backend for **MT Estates**, a property management SaaS that lets landlords manage buildings, units, tenants, and rent payments.

- **Stack:** Python, FastAPI, PostgreSQL, SQLAlchemy, Alembic, JWT (bcrypt)
- **Architecture:** Clean layers (routes → services → models), dependency injection, type hints

---

## Project structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, route registration
│   ├── config/
│   │   └── settings.py      # Pydantic settings from .env
│   ├── database/
│   │   ├── base.py         # SQLAlchemy Base, mixins
│   │   ├── session.py      # Engine, SessionLocal, get_db
│   │   └── init_db.py      # Optional table creation
│   ├── models/             # SQLAlchemy models (User, Property, Unit, Tenant, RentPayment)
│   ├── schemas/            # Pydantic request/response schemas
│   ├── services/           # Business logic (auth, property, unit, tenant, payment, dashboard)
│   ├── api/                # Route modules (auth, properties, units, tenants, payments, dashboard)
│   ├── auth/               # JWT, password hashing, get_current_user dependency
│   └── utils/
│       └── helpers.py
├── alembic/                # Migrations
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── tests/
│   ├── conftest.py         # Pytest fixtures, test client
│   └── test_auth.py
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

- **Routes** are thin and only call **services** and return responses.
- **Services** contain business logic and use **models** and **schemas**.
- **Database** access is via `get_db()` dependency; sessions are injected into routes.

---

## Install dependencies

From the `backend/` directory:

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate
pip install -r requirements.txt
```

---

## Configure environment

1. Copy the example env file:

   ```bash
   copy .env.example .env   # Windows
   # cp .env.example .env   # macOS/Linux
   ```

2. Edit `.env` and set at least:

   - **DATABASE_URL** – PostgreSQL connection string, e.g.  
     `postgresql://postgres:postgres@localhost:5432/mt_estates`
   - **SECRET_KEY** – Strong secret for JWT (e.g. 32+ random characters)

   Optional: `DEBUG`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, etc.

---

## Run PostgreSQL

- **Local:** Install PostgreSQL and create a database:

  ```bash
  createdb mt_estates
  ```

- **Docker:**

  ```bash
  docker run -d --name mt-estates-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mt_estates -p 5432:5432 postgres:15
  ```

Then set `DATABASE_URL` in `.env` to match (e.g. `postgresql://postgres:postgres@localhost:5432/mt_estates`).

---

## Run migrations

Using Alembic (recommended):

```bash
# From backend/
alembic upgrade head
```

To create tables without Alembic (e.g. quick local run):

```python
from app.database.init_db import create_tables
create_tables()
```

---

## Start the FastAPI server

```bash
# From backend/
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API base: `http://localhost:8000`
- Interactive docs: **http://localhost:8000/docs**
- ReDoc: **http://localhost:8000/redoc**
- Health: **http://localhost:8000/health**

---

## Test endpoints

1. **Register a landlord**

   ```http
   POST /api/v1/auth/register
   Content-Type: application/json

   {
     "name": "Jane Landlord",
     "email": "jane@example.com",
     "password": "your-secure-password",
     "phone": "+254700000000"
   }
   ```

2. **Login**

   ```http
   POST /api/v1/auth/login
   Content-Type: application/json

   {
     "email": "jane@example.com",
     "password": "your-secure-password"
   }
   ```

   Use the returned `access_token` in the next requests.

3. **Protected endpoints**  
   Add header:

   ```http
   Authorization: Bearer <access_token>
   ```

   Then try:

   - `POST /api/v1/properties` – create property
   - `GET /api/v1/properties` – list properties
   - `POST /api/v1/units` – add unit (body: `property_id`, `unit_number`, `rent_amount`, optional `status`)
   - `GET /api/v1/units` – list units (optional query `?property_id=1`)
   - `POST /api/v1/tenants` – add tenant and assign to unit
   - `GET /api/v1/tenants` – list tenants
   - `POST /api/v1/payments` – record rent payment
   - `GET /api/v1/payments` – list payments
   - `GET /api/v1/dashboard` – dashboard stats (`total_properties`, `total_units`, `occupied_units`, `vacant_units`, `rent_collected`)

---

## Run tests

```bash
# From backend/
pytest
# With coverage:
# pytest --cov=app
```

Tests use an in-memory SQLite DB by default (set `DATABASE_URL` if you want to use another DB for tests).

---

## Docker

Build and run the API container:

```bash
docker build -t mt-estates-backend .
docker run -p 8000:8000 --env-file .env mt-estates-backend
```

Ensure PostgreSQL is reachable at the `DATABASE_URL` host (e.g. run DB in Docker or use a cloud instance).

---

## API summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/v1/auth/register` | Register landlord |
| POST   | `/api/v1/auth/login`    | Login, get JWT |
| GET    | `/api/v1/auth/me`      | Current user (protected) |
| POST   | `/api/v1/properties`   | Create property (protected) |
| GET    | `/api/v1/properties`   | List properties (protected) |
| DELETE | `/api/v1/properties/{id}` | Delete property (protected) |
| POST   | `/api/v1/units`        | Add unit (protected) |
| GET    | `/api/v1/units`        | List units, optional `?property_id=` (protected) |
| PATCH  | `/api/v1/units/{id}`   | Update unit status/rent (protected) |
| POST   | `/api/v1/tenants`      | Add tenant (protected) |
| GET    | `/api/v1/tenants`      | List tenants (protected) |
| POST   | `/api/v1/payments`     | Record payment (protected) |
| GET    | `/api/v1/payments`     | List payments (protected) |
| GET    | `/api/v1/dashboard`   | Dashboard stats (protected) |

All protected routes require `Authorization: Bearer <token>`.
