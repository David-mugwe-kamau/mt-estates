"""Subscription queries — Stripe / M-Pesa integration added later."""
from sqlalchemy.orm import Session

from app.models.subscription import Subscription


def list_subscriptions_summary(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.created_at.desc())
        .all()
    )
    return [
        {
            "product": r.product,
            "status": r.status,
            "provider": r.provider,
            "current_period_end": r.current_period_end.isoformat() if r.current_period_end else None,
        }
        for r in rows
    ]
