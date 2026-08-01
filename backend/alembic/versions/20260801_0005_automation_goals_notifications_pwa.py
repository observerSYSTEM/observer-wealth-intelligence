"""automation goals notifications pwa

Revision ID: 20260801_0005
Revises: 20260801_0004
Create Date: 2026-08-01 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260801_0005"
down_revision: str | None = "20260801_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("ocr_results", sa.Column("recipient", sa.String(length=180), nullable=True))
    op.add_column("ocr_results", sa.Column("sender", sa.String(length=180), nullable=True))
    op.add_column("ocr_results", sa.Column("extracted_fields_json", sa.Text(), nullable=True))
    op.add_column("ocr_results", sa.Column("amount_candidates_json", sa.Text(), nullable=True))
    op.add_column("ocr_results", sa.Column("engine_name", sa.String(length=80), nullable=True))
    op.add_column("ocr_results", sa.Column("engine_version", sa.String(length=80), nullable=True))
    op.add_column("ocr_results", sa.Column("processing_duration_ms", sa.Integer(), nullable=True))
    op.add_column(
        "ocr_results",
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "ocr_results",
        sa.Column("max_retries", sa.Integer(), server_default="3", nullable=False),
    )
    op.add_column(
        "ocr_results",
        sa.Column("failure_message", sa.String(length=1000), nullable=True),
    )

    op.create_table(
        "financial_goals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("category", sa.String(length=48), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("target_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("starting_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("progress_source", sa.String(length=32), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_financial_goals_category"),
        "financial_goals",
        ["category"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_goals_currency"),
        "financial_goals",
        ["currency"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_goals_deadline"),
        "financial_goals",
        ["deadline"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_goals_is_primary"),
        "financial_goals",
        ["is_primary"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_goals_progress_source"),
        "financial_goals",
        ["progress_source"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_goals_status"),
        "financial_goals",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_goals_user_id"),
        "financial_goals",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "automation_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("job_type", sa.String(length=48), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("cadence", sa.String(length=32), nullable=False),
        sa.Column("run_at_time", sa.String(length=5), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("configuration", sa.Text(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "job_type", name="uq_automation_jobs_user_type"),
    )
    op.create_index(
        op.f("ix_automation_jobs_job_type"),
        "automation_jobs",
        ["job_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_automation_jobs_status"),
        "automation_jobs",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_automation_jobs_user_id"),
        "automation_jobs",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=48), nullable=False),
        sa.Column("channel", sa.String(length=24), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("related_type", sa.String(length=48), nullable=True),
        sa.Column("related_id", sa.String(length=36), nullable=True),
        sa.Column("telegram_message_id", sa.String(length=120), nullable=True),
        sa.Column("failure_reason", sa.String(length=1000), nullable=True),
        sa.Column("deduplication_key", sa.String(length=160), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_channel"), "notifications", ["channel"], unique=False)
    op.create_index(
        op.f("ix_notifications_created_at"),
        "notifications",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notifications_deduplication_key"),
        "notifications",
        ["deduplication_key"],
        unique=False,
    )
    op.create_index(op.f("ix_notifications_status"), "notifications", ["status"], unique=False)
    op.create_index(op.f("ix_notifications_type"), "notifications", ["type"], unique=False)
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)

    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("daily_reminder_enabled", sa.Boolean(), nullable=False),
        sa.Column("daily_reminder_time", sa.String(length=5), nullable=False),
        sa.Column("daily_reminder_weekdays", sa.String(length=32), nullable=False),
        sa.Column("weekly_summary_enabled", sa.Boolean(), nullable=False),
        sa.Column("weekly_summary_weekday", sa.Integer(), nullable=False),
        sa.Column("weekly_summary_time", sa.String(length=5), nullable=False),
        sa.Column("goal_alerts_enabled", sa.Boolean(), nullable=False),
        sa.Column("ocr_alerts_enabled", sa.Boolean(), nullable=False),
        sa.Column("backup_alerts_enabled", sa.Boolean(), nullable=False),
        sa.Column("telegram_enabled", sa.Boolean(), nullable=False),
        sa.Column("telegram_chat_id", sa.String(length=80), nullable=True),
        sa.Column("quiet_hours_start", sa.String(length=5), nullable=True),
        sa.Column("quiet_hours_end", sa.String(length=5), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_notification_preferences_user"),
    )
    op.create_index(
        op.f("ix_notification_preferences_user_id"),
        "notification_preferences",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "goal_contributions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("goal_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("contribution_date", sa.Date(), nullable=False),
        sa.Column("source_type", sa.String(length=40), nullable=False),
        sa.Column("source_id", sa.String(length=36), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["goal_id"], ["financial_goals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "goal_id",
            "source_type",
            "source_id",
            name="uq_goal_contributions_source",
        ),
    )
    op.create_index(
        op.f("ix_goal_contributions_contribution_date"),
        "goal_contributions",
        ["contribution_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_goal_contributions_goal_id"),
        "goal_contributions",
        ["goal_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_goal_contributions_source_type"),
        "goal_contributions",
        ["source_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_goal_contributions_user_id"),
        "goal_contributions",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "backup_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=True),
        sa.Column("trigger", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("backup_filename", sa.String(length=255), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("manifest_json", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("restore_verified", sa.Boolean(), nullable=False),
        sa.Column("verification_message", sa.String(length=1000), nullable=True),
        sa.Column("error_message", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["automation_jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_backup_runs_job_id"), "backup_runs", ["job_id"], unique=False)
    op.create_index(op.f("ix_backup_runs_started_at"), "backup_runs", ["started_at"], unique=False)
    op.create_index(op.f("ix_backup_runs_status"), "backup_runs", ["status"], unique=False)
    op.create_index(op.f("ix_backup_runs_user_id"), "backup_runs", ["user_id"], unique=False)

    op.create_table(
        "backup_settings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("frequency", sa.String(length=16), nullable=False),
        sa.Column("run_time", sa.String(length=5), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=True),
        sa.Column("month_day", sa.Integer(), nullable=True),
        sa.Column("retention_daily", sa.Integer(), nullable=False),
        sa.Column("retention_weekly", sa.Integer(), nullable=False),
        sa.Column("retention_monthly", sa.Integer(), nullable=False),
        sa.Column("backup_path", sa.String(length=255), nullable=False),
        sa.Column("include_secrets", sa.Boolean(), nullable=False),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failure_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_backup_settings_user"),
    )
    op.create_index(
        op.f("ix_backup_settings_user_id"),
        "backup_settings",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "timeline_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_timeline_events_entity_id"),
        "timeline_events",
        ["entity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_timeline_events_entity_type"),
        "timeline_events",
        ["entity_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_timeline_events_event_type"),
        "timeline_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_timeline_events_occurred_at"),
        "timeline_events",
        ["occurred_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_timeline_events_user_id"),
        "timeline_events",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_timeline_events_user_id"), table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_occurred_at"), table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_event_type"), table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_entity_type"), table_name="timeline_events")
    op.drop_index(op.f("ix_timeline_events_entity_id"), table_name="timeline_events")
    op.drop_table("timeline_events")
    op.drop_index(op.f("ix_backup_settings_user_id"), table_name="backup_settings")
    op.drop_table("backup_settings")
    op.drop_index(op.f("ix_backup_runs_user_id"), table_name="backup_runs")
    op.drop_index(op.f("ix_backup_runs_status"), table_name="backup_runs")
    op.drop_index(op.f("ix_backup_runs_started_at"), table_name="backup_runs")
    op.drop_index(op.f("ix_backup_runs_job_id"), table_name="backup_runs")
    op.drop_table("backup_runs")
    op.drop_index(op.f("ix_goal_contributions_user_id"), table_name="goal_contributions")
    op.drop_index(op.f("ix_goal_contributions_source_type"), table_name="goal_contributions")
    op.drop_index(op.f("ix_goal_contributions_goal_id"), table_name="goal_contributions")
    op.drop_index(
        op.f("ix_goal_contributions_contribution_date"),
        table_name="goal_contributions",
    )
    op.drop_table("goal_contributions")
    op.drop_index(
        op.f("ix_notification_preferences_user_id"),
        table_name="notification_preferences",
    )
    op.drop_table("notification_preferences")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_type"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_status"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_deduplication_key"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_created_at"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_channel"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_automation_jobs_user_id"), table_name="automation_jobs")
    op.drop_index(op.f("ix_automation_jobs_status"), table_name="automation_jobs")
    op.drop_index(op.f("ix_automation_jobs_job_type"), table_name="automation_jobs")
    op.drop_table("automation_jobs")
    op.drop_index(op.f("ix_financial_goals_user_id"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_status"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_progress_source"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_is_primary"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_deadline"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_currency"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_category"), table_name="financial_goals")
    op.drop_table("financial_goals")
    op.drop_column("ocr_results", "failure_message")
    op.drop_column("ocr_results", "max_retries")
    op.drop_column("ocr_results", "retry_count")
    op.drop_column("ocr_results", "processing_duration_ms")
    op.drop_column("ocr_results", "engine_version")
    op.drop_column("ocr_results", "engine_name")
    op.drop_column("ocr_results", "amount_candidates_json")
    op.drop_column("ocr_results", "extracted_fields_json")
    op.drop_column("ocr_results", "sender")
    op.drop_column("ocr_results", "recipient")
