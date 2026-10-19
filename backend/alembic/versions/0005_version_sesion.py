"""version de sesion por usuaria (cerrar sesion en todos los dispositivos)

Revision ID: 0005_version_sesion
Revises: 0004_plan_y_uso_ia
Create Date: 2026-10-19

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0005_version_sesion"
down_revision: Union[str, None] = "0004_plan_y_uso_ia"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("alter table usuarias add column version_sesion integer not null default 0")


def downgrade() -> None:
    op.execute("alter table usuarias drop column version_sesion")
