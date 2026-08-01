"""portfolio vault ocr

Revision ID: 20260801_0004
Revises: 20260731_0003
Create Date: 2026-08-01 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260801_0004"
down_revision: str | None = "20260731_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("asset_name", sa.String(length=160), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("purchase_price", sa.Numeric(18, 2), nullable=False),
        sa.Column("current_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("exchange_rate_to_primary", sa.Numeric(18, 6), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("institution", sa.String(length=160), nullable=True),
        sa.Column("reference", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assets_category"), "assets", ["category"], unique=False)
    op.create_index(op.f("ix_assets_currency"), "assets", ["currency"], unique=False)
    op.create_index(op.f("ix_assets_institution"), "assets", ["institution"], unique=False)
    op.create_index(op.f("ix_assets_reference"), "assets", ["reference"], unique=False)
    op.create_index(op.f("ix_assets_status"), "assets", ["status"], unique=False)
    op.create_index(op.f("ix_assets_user_id"), "assets", ["user_id"], unique=False)

    op.create_table(
        "asset_value_history",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("asset_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("previous_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("new_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("valuation_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_asset_value_history_asset_id"),
        "asset_value_history",
        ["asset_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_asset_value_history_recorded_at"),
        "asset_value_history",
        ["recorded_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_asset_value_history_user_id"),
        "asset_value_history",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_asset_value_history_valuation_date"),
        "asset_value_history",
        ["valuation_date"],
        unique=False,
    )

    op.create_table(
        "vault_documents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("asset_id", sa.String(length=36), nullable=True),
        sa.Column("folder", sa.String(length=48), nullable=False),
        sa.Column("storage_area", sa.String(length=16), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("encrypted_filename", sa.String(length=512), nullable=False),
        sa.Column("media_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("tags", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "sha256", name="uq_vault_documents_user_sha256"),
    )
    op.create_index(
        op.f("ix_vault_documents_asset_id"),
        "vault_documents",
        ["asset_id"],
        unique=False,
    )
    op.create_index(op.f("ix_vault_documents_folder"), "vault_documents", ["folder"], unique=False)
    op.create_index(
        op.f("ix_vault_documents_uploaded_at"),
        "vault_documents",
        ["uploaded_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_vault_documents_user_id"),
        "vault_documents",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "ocr_results",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.String(length=36), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("document_time", sa.String(length=8), nullable=True),
        sa.Column("reference", sa.String(length=180), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ocr_results_source_id"), "ocr_results", ["source_id"], unique=False)
    op.create_index(
        op.f("ix_ocr_results_source_type"),
        "ocr_results",
        ["source_type"],
        unique=False,
    )
    op.create_index(op.f("ix_ocr_results_status"), "ocr_results", ["status"], unique=False)
    op.create_index(op.f("ix_ocr_results_user_id"), "ocr_results", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ocr_results_user_id"), table_name="ocr_results")
    op.drop_index(op.f("ix_ocr_results_status"), table_name="ocr_results")
    op.drop_index(op.f("ix_ocr_results_source_type"), table_name="ocr_results")
    op.drop_index(op.f("ix_ocr_results_source_id"), table_name="ocr_results")
    op.drop_table("ocr_results")
    op.drop_index(op.f("ix_vault_documents_user_id"), table_name="vault_documents")
    op.drop_index(op.f("ix_vault_documents_uploaded_at"), table_name="vault_documents")
    op.drop_index(op.f("ix_vault_documents_folder"), table_name="vault_documents")
    op.drop_index(op.f("ix_vault_documents_asset_id"), table_name="vault_documents")
    op.drop_table("vault_documents")
    op.drop_index(op.f("ix_asset_value_history_valuation_date"), table_name="asset_value_history")
    op.drop_index(op.f("ix_asset_value_history_user_id"), table_name="asset_value_history")
    op.drop_index(op.f("ix_asset_value_history_recorded_at"), table_name="asset_value_history")
    op.drop_index(op.f("ix_asset_value_history_asset_id"), table_name="asset_value_history")
    op.drop_table("asset_value_history")
    op.drop_index(op.f("ix_assets_user_id"), table_name="assets")
    op.drop_index(op.f("ix_assets_status"), table_name="assets")
    op.drop_index(op.f("ix_assets_reference"), table_name="assets")
    op.drop_index(op.f("ix_assets_institution"), table_name="assets")
    op.drop_index(op.f("ix_assets_currency"), table_name="assets")
    op.drop_index(op.f("ix_assets_category"), table_name="assets")
    op.drop_table("assets")
