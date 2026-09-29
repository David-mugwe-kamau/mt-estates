"""MT Estates - Property Management API."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.auth_routes import router as auth_router
# Ensure all models are registered on Base.metadata (for tests / create_all)
from app.models import (  # noqa: F401
    User,
    Property,
    PropertyImage,
    Unit,
    UnitType,
    ViewingRequest,
    MeterReading,
    WishlistItem,
    UserRole,
    Subscription,
    Tenant,
    RentPayment,
)
from app.api.property_routes import router as property_router
from app.api.unit_routes import router as unit_router
from app.api.tenant_routes import router as tenant_router
from app.api.payment_routes import router as payment_router
from app.api.dashboard_routes import router as dashboard_router
from app.api.wishlist_routes import router as wishlist_router
from app.api.viewing_routes import router as viewing_router
from app.api.billing_routes import router as billing_router
from app.api.admin_routes import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: ensure DB is reachable. Shutdown: nothing special."""
    # Optional: run migrations or create tables here
    yield


app = FastAPI(
    title=settings.app_name,
    description="Property management system for landlords",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["http://localhost:3004", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes under /api/v1
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(property_router, prefix=settings.api_v1_prefix)
app.include_router(unit_router, prefix=settings.api_v1_prefix)
app.include_router(tenant_router, prefix=settings.api_v1_prefix)
app.include_router(payment_router, prefix=settings.api_v1_prefix)
app.include_router(dashboard_router, prefix=settings.api_v1_prefix)
app.include_router(wishlist_router, prefix=settings.api_v1_prefix)
app.include_router(viewing_router, prefix=settings.api_v1_prefix)
app.include_router(billing_router, prefix=settings.api_v1_prefix)
app.include_router(admin_router, prefix=settings.api_v1_prefix)

# Convenience alias: GET /api/v1/listings → same as /api/v1/properties/public
from app.api.property_routes import public_listings  # noqa: E402
from fastapi import Depends, Query
from app.database.session import get_db
from app.schemas.property_schema import PublicListingDetailResponse, PublicListingResponse
from app.api.property_routes import get_public_listing_detail

@app.get(f"{settings.api_v1_prefix}/listings", response_model=list[PublicListingResponse], tags=["Listings"])
def listings_alias(
    db=Depends(get_db),
    listing_type: str | None = Query(None),
    location: str | None = Query(None),
    county: str | None = Query(None),
    locality: str | None = Query(None),
    min_price: float | None = Query(None),
    max_price: float | None = Query(None),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    radius: float = Query(20.0),
    category: str | None = Query(None),
):
    """Alias for /properties/public — public listing feed."""
    return public_listings(
        db=db,
        listing_type=listing_type,
        location=location,
        county=county,
        locality=locality,
        min_price=min_price,
        max_price=max_price,
        lat=lat,
        lng=lng,
        radius=radius,
        category=category,
    )


@app.get(f"{settings.api_v1_prefix}/listings/{{listing_id}}", response_model=PublicListingDetailResponse, tags=["Listings"])
def listing_detail(listing_id: int, db=Depends(get_db)):
    """Public listing detail with gallery."""
    return get_public_listing_detail(db, listing_id)


@app.get("/health")
def health():
    """Health check for load balancers and Docker."""
    return {"status": "ok"}


@app.get("/")
def root():
    """Root redirect to docs."""
    return {"message": "MT Estates API", "docs": "/docs"}
