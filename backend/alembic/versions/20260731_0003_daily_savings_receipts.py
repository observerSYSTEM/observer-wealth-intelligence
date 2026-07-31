"""daily savings receipts

Revision ID: 20260731_0003
Revises: 20260731_0002
Create Date: 2026-07-31 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260731_0003"
down_revision: str | None = "20260731_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "receipts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=512), nullable=False),
        sa.Column("media_type", sa.String(length=80), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("storage_backend", sa.String(length=32), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "sha256", name="uq_receipts_user_sha256"),
    )
    op.create_index(op.f("ix_receipts_uploaded_at"), "receipts", ["uploaded_at"], unique=False)
    op.create_index(op.f("ix_receipts_user_id"), "receipts", ["user_id"], unique=False)

    op.create_table(
        "wealth_entries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("income_source", sa.String(length=24), nullable=False),
        sa.Column("realised_profit", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("savings_percentage", sa.Integer(), nullable=False),
        sa.Column("business_percentage", sa.Integer(), nullable=False),
        sa.Column("living_percentage", sa.Integer(), nullable=False),
        sa.Column("recommended_savings", sa.Numeric(18, 2), nullable=False),
        sa.Column("recommended_business", sa.Numeric(18, 2), nullable=False),
        sa.Column("recommended_living", sa.Numeric(18, 2), nullable=False),
        sa.Column("actual_savings", sa.Numeric(18, 2), nullable=False),
        sa.Column("actual_business", sa.Numeric(18, 2), nullable=False),
        sa.Column("actual_living", sa.Numeric(18, 2), nullable=False),
        sa.Column("savings_variance", sa.Numeric(18, 2), nullable=False),
        sa.Column("discipline_score", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("transfer_confirmed", sa.Boolean(), nullable=False),
        sa.Column("receipt_id", sa.String(length=36), nullable=True),
        sa.Column("idempotency_key", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["receipt_id"], ["receipts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("receipt_id"),
        sa.UniqueConstraint(
            "user_id",
            "idempotency_key",
            name="uq_wealth_entries_user_idempotency",
        ),
    )
    op.create_index(
        op.f("ix_wealth_entries_currency"),
        "wealth_entries",
        ["currency"],
        unique=False,
    )
    op.create_index(
        op.f("ix_wealth_entries_entry_date"),
        "wealth_entries",
        ["entry_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_wealth_entries_income_source"),
        "wealth_entries",
        ["income_source"],
        unique=False,
    )
    op.create_index(op.f("ix_wealth_entries_status"), "wealth_entries", ["status"], unique=False)
    op.create_index(op.f("ix_wealth_entries_user_id"), "wealth_entries", ["user_id"], unique=False)
    op.create_index(
        "ix_wealth_entries_user_date_source",
        "wealth_entries",
        ["user_id", "entry_date", "income_source"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_wealth_entries_user_date_source", table_name="wealth_entries")
    op.drop_index(op.f("ix_wealth_entries_user_id"), table_name="wealth_entries")
    op.drop_index(op.f("ix_wealth_entries_status"), table_name="wealth_entries")
    op.drop_index(op.f("ix_wealth_entries_income_source"), table_name="wealth_entries")
    op.drop_index(op.f("ix_wealth_entries_entry_date"), table_name="wealth_entries")
    op.drop_index(op.f("ix_wealth_entries_currency"), table_name="wealth_entries")
    op.drop_table("wealth_entries")
    op.drop_index(op.f("ix_receipts_user_id"), table_name="receipts")
    op.drop_index(op.f("ix_receipts_uploaded_at"), table_name="receipts")
    op.drop_table("receipts")
