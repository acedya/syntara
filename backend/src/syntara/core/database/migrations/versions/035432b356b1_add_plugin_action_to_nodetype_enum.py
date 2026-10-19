"""add plugin_action to nodetype enum

Revision ID: 035432b356b1
Revises: 212e44830cac
Create Date: 2026-10-16 14:14:08.564022

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "035432b356b1"
down_revision: str | Sequence[str] | None = "212e44830cac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # CUSTOM: extend the activity_execution nodetype Postgres enum with the
    # plugin_action value used by the plugin marketplace POC. ALTER TYPE ADD
    # VALUE cannot run inside a transaction block in older Postgres; Postgres
    # 12+ handles it, and Alembic runs migrations in a transaction by default.
    # Use a plain execute which autocommits appropriately for ADD VALUE.
    # END CUSTOM
    op.execute("ALTER TYPE nodetype ADD VALUE IF NOT EXISTS 'plugin_action'")


def downgrade() -> None:
    """Downgrade schema."""
    # CUSTOM: Postgres cannot remove a value from an enum; the extra value is
    # harmless once no rows use it.
    # END CUSTOM
