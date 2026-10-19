"""plan gratis/premium por usuaria + registro real de uso de IA

Revision ID: 0004_plan_y_uso_ia
Revises: 0003_admin_cuentas
Create Date: 2026-10-16

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0004_plan_y_uso_ia"
down_revision: Union[str, None] = "0003_admin_cuentas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Una sentencia por op.execute: asyncpg no acepta varias en un solo prepared statement.
    op.execute(
        "alter table usuarias add column plan varchar(16) not null default 'gratis' "
        "check (plan in ('gratis', 'premium'))"
    )
    op.execute(
        """
        create table uso_ia (
          id              uuid primary key,
          usuaria_id      uuid not null references usuarias(id) on delete cascade,
          funcion         varchar(32) not null,
          modelo          text,
          tokens_entrada  int not null default 0,
          tokens_salida   int not null default 0,
          costo_centavos  int not null default 0,
          creado_en       timestamptz not null default now()
        )
        """
    )
    op.execute("create index ix_uso_ia_usuaria_fecha on uso_ia (usuaria_id, creado_en desc)")


def downgrade() -> None:
    op.execute("drop table uso_ia")
    op.execute("alter table usuarias drop column plan")
