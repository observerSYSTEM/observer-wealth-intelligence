from datetime import date

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.common import MessageRead
from app.schemas.goal import (
    GoalContributionCreate,
    GoalContributionListRead,
    GoalContributionRead,
    GoalCreate,
    GoalListRead,
    GoalRead,
    GoalUpdate,
)
from app.services.goals import (
    add_goal_contribution,
    archive_goal,
    contribution_to_read,
    create_goal,
    delete_goal_contribution,
    get_user_contribution,
    get_user_goal,
    goal_to_read,
    list_goal_contributions,
    list_goals,
    update_goal,
)

router = APIRouter()


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def create_user_goal(
    payload: GoalCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> GoalRead:
    return goal_to_read(db, current_user, create_goal(db, current_user, payload, request))


@router.get("", response_model=GoalListRead)
def read_goals(
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = None,
    currency: str | None = None,
    priority: int | None = Query(default=None, ge=1, le=5),
    deadline_before: date | None = None,
    deadline_after: date | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalListRead:
    return list_goals(
        db,
        current_user,
        status_filter,
        category,
        currency,
        priority,
        deadline_before,
        deadline_after,
        limit,
        offset,
    )


@router.get("/{goal_id}", response_model=GoalRead)
def read_goal(
    goal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalRead:
    return goal_to_read(db, current_user, get_user_goal(db, current_user, goal_id))


@router.patch("/{goal_id}", response_model=GoalRead)
def update_user_goal(
    goal_id: str,
    payload: GoalUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> GoalRead:
    goal = get_user_goal(db, current_user, goal_id)
    return goal_to_read(db, current_user, update_goal(db, current_user, goal, payload, request))


@router.delete("/{goal_id}", response_model=MessageRead)
def archive_user_goal(
    goal_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> MessageRead:
    archive_goal(db, current_user, get_user_goal(db, current_user, goal_id), request)
    return MessageRead(message="Goal archived")


@router.post(
    "/{goal_id}/contributions",
    response_model=GoalContributionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_goal_contribution(
    goal_id: str,
    payload: GoalContributionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> GoalContributionRead:
    goal = get_user_goal(db, current_user, goal_id)
    return contribution_to_read(add_goal_contribution(db, current_user, goal, payload, request))


@router.get("/{goal_id}/contributions", response_model=GoalContributionListRead)
def read_goal_contributions(
    goal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalContributionListRead:
    goal = get_user_goal(db, current_user, goal_id)
    return list_goal_contributions(db, current_user, goal)


@router.delete("/{goal_id}/contributions/{contribution_id}", response_model=MessageRead)
def delete_user_goal_contribution(
    goal_id: str,
    contribution_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> MessageRead:
    goal = get_user_goal(db, current_user, goal_id)
    contribution = get_user_contribution(db, current_user, goal, contribution_id)
    delete_goal_contribution(db, current_user, goal, contribution, request)
    return MessageRead(message="Contribution deleted")
