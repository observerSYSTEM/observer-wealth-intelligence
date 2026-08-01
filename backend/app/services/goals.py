from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.financial_goal import FinancialGoal
from app.models.goal_contribution import GoalContribution
from app.models.user import User
from app.models.wealth_entry import WealthEntry
from app.schemas.goal import (
    GoalContributionCreate,
    GoalContributionListRead,
    GoalContributionRead,
    GoalCreate,
    GoalListRead,
    GoalRead,
    GoalUpdate,
    estimated_monthly,
    progress_percentage,
)
from app.services.audit import create_audit_log
from app.services.entries import quantize_money
from app.services.notifications import notify_user


def goal_current_amount(db: Session, user: User, goal: FinancialGoal) -> Decimal:
    if goal.progress_source == "tracked_savings":
        total = (
            db.scalar(
                select(func.sum(WealthEntry.actual_savings)).where(
                    WealthEntry.user_id == user.id,
                    WealthEntry.currency == goal.currency,
                )
            )
            or Decimal("0.00")
        )
        return quantize_money(goal.starting_amount + total)
    if goal.progress_source == "linked_assets":
        total = (
            db.scalar(
                select(func.sum(Asset.current_value)).where(
                    Asset.user_id == user.id,
                    Asset.currency == goal.currency,
                    Asset.status == "active",
                )
            )
            or Decimal("0.00")
        )
        return quantize_money(goal.starting_amount + total)
    return quantize_money(goal.current_amount)


def goal_to_read(db: Session, user: User, goal: FinancialGoal) -> GoalRead:
    current = goal_current_amount(db, user, goal)
    capped_current = min(current, goal.target_amount)
    overfunded = max(Decimal("0.00"), current - goal.target_amount)
    remaining = max(Decimal("0.00"), goal.target_amount - current)
    return GoalRead.model_validate(goal, from_attributes=True).model_copy(
        update={
            "current_amount": current,
            "progress_percentage": progress_percentage(capped_current, goal.target_amount),
            "remaining_amount": quantize_money(remaining),
            "overfunded_amount": quantize_money(overfunded),
            "estimated_monthly_contribution": estimated_monthly(
                goal.target_amount,
                current,
                goal.deadline,
            ),
        }
    )


def contribution_to_read(contribution: GoalContribution) -> GoalContributionRead:
    return GoalContributionRead.model_validate(contribution, from_attributes=True)


def get_user_goal(db: Session, user: User, goal_id: str) -> FinancialGoal:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return goal


def ensure_primary_goal_available(
    db: Session,
    user: User,
    is_primary: bool,
    goal_id: str | None = None,
) -> None:
    if not is_primary:
        return
    existing = db.scalar(
        select(FinancialGoal).where(
            FinancialGoal.user_id == user.id,
            FinancialGoal.is_primary.is_(True),
            FinancialGoal.status == "active",
            FinancialGoal.id != goal_id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only one active primary goal is allowed",
        )


def create_goal(
    db: Session,
    user: User,
    payload: GoalCreate,
    request: Request | None = None,
) -> FinancialGoal:
    ensure_primary_goal_available(db, user, payload.is_primary)
    data = payload.model_dump()
    if data["current_amount"] == Decimal("0.00") and data["starting_amount"] > 0:
        data["current_amount"] = data["starting_amount"]
    goal = FinancialGoal(user_id=user.id, **data)
    db.add(goal)
    db.flush()
    notify_user(
        db,
        user,
        title="Goal created",
        message=f"{goal.name} is now tracking toward {goal.currency} {goal.target_amount}.",
        notification_type="goal_progress",
        severity="success",
        related_type="goal",
        related_id=goal.id,
        request=request,
    )
    create_audit_log(db, "goal_create", user.id, request, {"goal_id": goal.id})
    db.commit()
    db.refresh(goal)
    return goal


def update_goal(
    db: Session,
    user: User,
    goal: FinancialGoal,
    payload: GoalUpdate,
    request: Request | None = None,
) -> FinancialGoal:
    changes = payload.model_dump(exclude_unset=True)
    next_primary = changes.get("is_primary", goal.is_primary)
    next_status = changes.get("status", goal.status)
    if next_primary and next_status == "active":
        ensure_primary_goal_available(db, user, True, goal.id)
    for key, value in changes.items():
        setattr(goal, key, value)
    if changes.get("status") == "completed" and goal.completed_at is None:
        goal.completed_at = datetime.now(UTC)
    if changes.get("status") == "archived" and goal.archived_at is None:
        goal.archived_at = datetime.now(UTC)
    create_audit_log(db, "goal_update", user.id, request, {"goal_id": goal.id})
    db.commit()
    db.refresh(goal)
    return goal


def archive_goal(
    db: Session,
    user: User,
    goal: FinancialGoal,
    request: Request | None = None,
) -> None:
    goal.status = "archived"
    goal.archived_at = datetime.now(UTC)
    create_audit_log(db, "goal_archive", user.id, request, {"goal_id": goal.id})
    db.commit()


def add_goal_contribution(
    db: Session,
    user: User,
    goal: FinancialGoal,
    payload: GoalContributionCreate,
    request: Request | None = None,
) -> GoalContribution:
    currency = payload.currency or goal.currency
    if currency != goal.currency:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Goal contributions must use the goal currency until FX conversion is enabled",
        )
    if payload.source_id is not None:
        existing = db.scalar(
            select(GoalContribution).where(
                GoalContribution.goal_id == goal.id,
                GoalContribution.source_type == payload.source_type,
                GoalContribution.source_id == payload.source_id,
            )
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This linked contribution has already been recorded",
            )
    contribution = GoalContribution(
        goal_id=goal.id,
        user_id=user.id,
        amount=payload.amount,
        currency=currency,
        contribution_date=payload.contribution_date or datetime.now(UTC).date(),
        source_type=payload.source_type,
        source_id=payload.source_id,
        notes=payload.notes,
    )
    if goal.progress_source == "manual":
        goal.current_amount = quantize_money(goal.current_amount + contribution.amount)
    if goal_current_amount(db, user, goal) >= goal.target_amount and goal.status == "active":
        goal.status = "completed"
        goal.completed_at = datetime.now(UTC)
    db.add(contribution)
    db.flush()
    notify_user(
        db,
        user,
        title="Goal contribution added",
        message=f"{goal.name} increased by {currency} {contribution.amount}.",
        notification_type="goal_completed" if goal.status == "completed" else "goal_progress",
        severity="success",
        related_type="goal",
        related_id=goal.id,
        request=request,
    )
    create_audit_log(
        db,
        "goal_contribution_create",
        user.id,
        request,
        {"goal_id": goal.id, "contribution_id": contribution.id},
    )
    db.commit()
    db.refresh(contribution)
    return contribution


def list_goals(
    db: Session,
    user: User,
    status_filter: str | None,
    category: str | None,
    currency: str | None,
    priority: int | None,
    deadline_before,
    deadline_after,
    limit: int,
    offset: int,
) -> GoalListRead:
    filters = [FinancialGoal.user_id == user.id]
    if status_filter is not None:
        filters.append(FinancialGoal.status == status_filter)
    if category is not None:
        filters.append(FinancialGoal.category == category)
    if currency is not None:
        filters.append(FinancialGoal.currency == currency)
    if priority is not None:
        filters.append(FinancialGoal.priority == priority)
    if deadline_before is not None:
        filters.append(FinancialGoal.deadline <= deadline_before)
    if deadline_after is not None:
        filters.append(FinancialGoal.deadline >= deadline_after)
    total = db.scalar(select(func.count()).select_from(FinancialGoal).where(and_(*filters))) or 0
    items = list(
        db.scalars(
            select(FinancialGoal)
            .where(and_(*filters))
            .order_by(FinancialGoal.priority, desc(FinancialGoal.updated_at))
            .limit(limit)
            .offset(offset)
        ).all()
    )
    return GoalListRead(
        items=[goal_to_read(db, user, item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def list_goal_contributions(
    db: Session,
    user: User,
    goal: FinancialGoal,
) -> GoalContributionListRead:
    items = list(
        db.scalars(
            select(GoalContribution)
            .where(GoalContribution.user_id == user.id, GoalContribution.goal_id == goal.id)
            .order_by(desc(GoalContribution.contribution_date), desc(GoalContribution.created_at))
        ).all()
    )
    return GoalContributionListRead(
        items=[contribution_to_read(item) for item in items],
        total=len(items),
    )


def get_user_contribution(
    db: Session,
    user: User,
    goal: FinancialGoal,
    contribution_id: str,
) -> GoalContribution:
    contribution = db.get(GoalContribution, contribution_id)
    if (
        contribution is None
        or contribution.user_id != user.id
        or contribution.goal_id != goal.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")
    return contribution


def delete_goal_contribution(
    db: Session,
    user: User,
    goal: FinancialGoal,
    contribution: GoalContribution,
    request: Request | None = None,
) -> None:
    if goal.progress_source == "manual":
        goal.current_amount = quantize_money(
            max(Decimal("0.00"), goal.current_amount - contribution.amount)
        )
        if goal.status == "completed" and goal.current_amount < goal.target_amount:
            goal.status = "active"
            goal.completed_at = None
    db.delete(contribution)
    create_audit_log(
        db,
        "goal_contribution_delete",
        user.id,
        request,
        {"goal_id": goal.id, "contribution_id": contribution.id},
    )
    db.commit()
