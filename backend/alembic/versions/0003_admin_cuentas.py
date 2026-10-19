"""admin_cuentas: contraseña del panel cambiable + enlace de un solo uso

Revision ID: 0003_admin_cuentas
Revises: 0002_soft_delete_usuarias
Create Date: 2026-10-16

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0003_admin_cuentas"
down_revision: Union[str, None] = "0002_soft_delete_usuarias"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        create table admin_cuentas (
          usuario         varchar(64) primary key,
          password_hash   text,
          token_hash      varchar(64),
          token_expira    timestamptz,
          actualizado_en  timestamptz not null default now()
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table admin_cuentas;")
