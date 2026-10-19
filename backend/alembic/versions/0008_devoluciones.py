"""devoluciones: reembolso (total o parcial) y qué pasó con la prenda

Revision ID: 0008_devoluciones
Revises: 0007_fotos_reducidas
Create Date: 2026-10-19
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0008_devoluciones"
down_revision: Union[str, None] = "0007_fotos_reducidas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("alter table ventas add column devuelta_en timestamptz")
    op.execute("alter table ventas add column reembolso bigint not null default 0")
    op.execute("alter table ventas add column destino_devolucion text")
    op.execute(
        "alter table ventas add constraint ventas_reembolso_check "
        "check (reembolso >= 0 and reembolso <= precio_final)"
    )
    op.execute(
        "alter table ventas add constraint ventas_destino_devolucion_check "
        "check (destino_devolucion is null or destino_devolucion in ('disponible','descartada','cliente'))"
    )


def downgrade() -> None:
    op.execute("alter table ventas drop constraint ventas_destino_devolucion_check")
    op.execute("alter table ventas drop constraint ventas_reembolso_check")
    op.execute("alter table ventas drop column destino_devolucion")
    op.execute("alter table ventas drop column reembolso")
    op.execute("alter table ventas drop column devuelta_en")
