from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def request_ip(request: Request | None) -> str | None:
    if request is None or request.client is None:
        return None
    return request.client.host


def request_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    return request.headers.get("user-agent")


def create_audit_log(
    db: Session,
    action: str,
    user_id: str | None = None,
    request: Request | None = None,
    details: dict | None = None,
) -> AuditLog:
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        details=details or {},
        ip_address=request_ip(request),
        user_agent=request_user_agent(request),
    )
    db.add(audit_log)
    return audit_log
