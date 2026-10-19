"""papelera de prendas: cuándo se descartó cada una (se borra sola a los 30 días)

Revision ID: 0006_papelera_prendas
Revises: 0005_version_sesion
Create Date: 2026-10-19

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0006_papelera_prendas"
down_revision: Union[str, None] = "0005_version_sesion"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("alter table prendas add column descartada_en timestamptz")
    # Las que ya estaban descartadas empiezan su plazo de 30 días hoy: no se borra nada de golpe.
    op.execute("update prendas set descartada_en = now() where status = 'descartada'")


def downgrade() -> None:
    op.execute("alter table prendas drop column descartada_en")
