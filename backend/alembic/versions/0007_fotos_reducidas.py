"""fotos reducidas: solo se conserva la miniatura (de prendas vendidas, a pedido de la usuaria)

Revision ID: 0007_fotos_reducidas
Revises: 0006_papelera_prendas
Create Date: 2026-10-19

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0007_fotos_reducidas"
down_revision: Union[str, None] = "0006_papelera_prendas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("alter table fotos add column reducida boolean not null default false")


def downgrade() -> None:
    op.execute("alter table fotos drop column reducida")
