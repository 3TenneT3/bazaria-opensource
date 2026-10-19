"""soft delete en usuarias (eliminada_en)

Revision ID: 0002_soft_delete_usuarias
Revises: 0001_inicial
Create Date: 2026-10-15

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0002_soft_delete_usuarias"
down_revision: Union[str, None] = "0001_inicial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        alter table usuarias
        add column eliminada_en timestamptz null;
        """
    )
    # Acelera el job de purga (busca usuarias eliminadas hace > N días).
    op.execute("create index on usuarias (eliminada_en);")


def downgrade() -> None:
    # create index sin nombre => Postgres lo llama usuarias_eliminada_en_idx
    op.execute("drop index if exists usuarias_eliminada_en_idx;")
    op.execute("alter table usuarias drop column if exists eliminada_en;")
