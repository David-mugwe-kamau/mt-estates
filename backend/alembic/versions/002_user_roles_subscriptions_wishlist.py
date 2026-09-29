"""User roles, subscriptions, wishlist_items

Revision ID: 002
Revises: 001
Create Date: 2026-03-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("product", sa.String(50), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("provider", sa.String(30), nullable=True),
        sa.Column("provider_customer_id", sa.String(255), nullable=True),
        sa.Column("provider_subscription_id", sa.String(255), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "wishlist_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("location_text", sa.String(500), nullable=True),
        sa.Column("listing_type", sa.String(30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("external_ref", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Backfill roles for existing users (single-account model).
    op.execute(
        """
        INSERT INTO user_roles (user_id, role, enabled, created_at)
        SELECT u.id, 'renter', true, NOW() FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'renter'
        );
        """
    )
    op.execute(
        """
        INSERT INTO user_roles (user_id, role, enabled, created_at)
        SELECT u.id, 'rental_landlord', true, NOW() FROM users u
        WHERE u.role = 'landlord'
        AND NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'rental_landlord'
        );
        """
    )


def downgrade() -> None:
    op.drop_table("wishlist_items")
    op.drop_table("subscriptions")
    op.drop_table("user_roles")
