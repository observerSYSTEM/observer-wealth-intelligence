"""auth profile settings

Revision ID: 20260731_0002
Revises: 20260731_0001
Create Date: 2026-07-31 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260731_0002"
down_revision: str | None = "20260731_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("users", "full_name", new_column_name="display_name")
    op.alter_column("users", "hashed_password", new_column_name="password_hash")
    op.execute("UPDATE users SET display_name = email WHERE display_name IS NULL")
    op.alter_column("users", "display_name", nullable=False)

    op.add_column("users", sa.Column("role", sa.String(length=24), nullable=True))
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("timezone", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("preferred_currency", sa.String(length=3), nullable=True),
    )
    op.execute(
        "UPDATE users SET role = 'owner' "
        "WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)"
    )
    op.execute("UPDATE users SET role = 'user' WHERE role IS NULL")
    op.execute("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL")
    op.execute("UPDATE users SET timezone = 'Europe/London' WHERE timezone IS NULL")
    op.execute("UPDATE users SET preferred_currency = 'GBP' WHERE preferred_currency IS NULL")
    op.alter_column("users", "role", nullable=False)
    op.alter_column("users", "is_verified", nullable=False)
    op.alter_column("users", "timezone", nullable=False)
    op.alter_column("users", "preferred_currency", nullable=False)
    op.drop_column("users", "is_superuser")
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("registration_enabled", sa.Boolean(), nullable=False),
        sa.Column("default_timezone", sa.String(length=64), nullable=False),
        sa.Column("default_currency", sa.String(length=3), nullable=False),
        sa.Column("savings_percentage", sa.Integer(), nullable=False),
        sa.Column("business_percentage", sa.Integer(), nullable=False),
        sa.Column("living_percentage", sa.Integer(), nullable=False),
        sa.Column("primary_goal_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("primary_goal_currency", sa.String(length=3), nullable=False),
        sa.Column("receipt_ocr_enabled", sa.Boolean(), nullable=False),
        sa.Column("theme_preference", sa.String(length=16), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "INSERT INTO app_settings "
        "(id, registration_enabled, default_timezone, default_currency, savings_percentage, "
        "business_percentage, living_percentage, primary_goal_amount, primary_goal_currency, "
        "receipt_ocr_enabled, theme_preference, updated_at) "
        "VALUES (1, FALSE, 'Europe/London', 'GBP', 50, 30, 20, 100000.00, 'GBP', "
        "TRUE, 'system', NOW())"
    )

    op.create_table(
        "refresh_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("csrf_token_hash", sa.String(length=64), nullable=False),
        sa.Column("replaced_by_id", sa.String(length=36), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_refresh_sessions_token_hash"),
        "refresh_sessions",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_refresh_sessions_user_id"),
        "refresh_sessions",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_user_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index(op.f("ix_refresh_sessions_user_id"), table_name="refresh_sessions")
    op.drop_index(op.f("ix_refresh_sessions_token_hash"), table_name="refresh_sessions")
    op.drop_table("refresh_sessions")

    op.drop_table("app_settings")

    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.add_column(
        "users",
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.drop_column("users", "preferred_currency")
    op.drop_column("users", "timezone")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "is_verified")
    op.drop_column("users", "role")
    op.alter_column("users", "display_name", nullable=True)
    op.alter_column("users", "password_hash", new_column_name="hashed_password")
    op.alter_column("users", "display_name", new_column_name="full_name")
