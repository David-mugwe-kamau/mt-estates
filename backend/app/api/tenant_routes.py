"""Tenant API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.schemas.tenant_schema import TenantCreate, TenantResponse
from app.services.tenant_service import create_tenant, list_tenants_by_owner

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.post("", response_model=TenantResponse)
def create(
    data: TenantCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TenantResponse:
    """Add a tenant and assign to a unit."""
    try:
        tenant = create_tenant(db, current_user.id, data)
        return tenant
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=list[TenantResponse])
def list_tenants(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[TenantResponse]:
    """List all tenants in your properties."""
    tenants = list_tenants_by_owner(db, current_user.id)
    return tenants
