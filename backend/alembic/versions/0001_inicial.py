"""esquema inicial bazaria

Revision ID: 0001_inicial
Revises:
Create Date: 2026-10-15

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_inicial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        create table usuarias (
          id          uuid primary key,
          google_sub  text not null unique,
          email       text not null,
          nombre      text,
          creada_en   timestamptz not null default now()
        );
        """
    )

    op.execute(
        """
        create table lotes (
          id                   uuid primary key,
          usuaria_id           uuid not null references usuarias(id) on delete cascade,
          nombre               text not null,
          costo_total          bigint not null check (costo_total >= 0),
          piezas_compradas     int not null check (piezas_compradas > 0),
          piezas_descartadas   int not null default 0 check (piezas_descartadas >= 0),
          fecha_compra         timestamptz not null,
          notas                text,
          creado_en            timestamptz not null default now()
        );
        """
    )

    op.execute(
        """
        create table fotos (
          id          uuid primary key,
          usuaria_id  uuid not null references usuarias(id) on delete cascade,
          sha256      char(64) not null,
          llave       text not null,
          mime        text not null default 'image/webp',
          bytes       int  not null,
          ancho       int  not null,
          alto        int  not null,
          creada_en   timestamptz not null default now(),
          unique (usuaria_id, sha256)
        );
        """
    )

    op.execute(
        """
        create table prendas (
          id             uuid primary key,
          usuaria_id     uuid not null references usuarias(id) on delete cascade,
          lote_id        uuid references lotes(id) on delete set null,
          foto_id        uuid references fotos(id) on delete set null,
          tipo           text, color text, talla text, marca text,
          estado         text not null check (estado in ('nueva','seminueva','usada')),
          costo          bigint not null default 0 check (costo >= 0),
          costo_manual   boolean not null default false,
          precio_venta   bigint not null default 0 check (precio_venta >= 0),
          status         text not null default 'disponible'
                         check (status in ('disponible','apartada','vendida','descartada')),
          creada_en      timestamptz not null default now()
        );
        """
    )
    op.execute("create index on prendas (usuaria_id, status);")
    op.execute("create index on prendas (usuaria_id, lote_id);")

    op.execute(
        """
        create table ventas (
          id            uuid primary key,
          usuaria_id    uuid not null references usuarias(id) on delete cascade,
          prenda_id     uuid not null references prendas(id) on delete cascade,
          precio_final  bigint not null check (precio_final >= 0),
          costo_envio   bigint not null default 0,
          comision      bigint not null default 0,
          canal         text not null check (canal in ('instagram','whatsapp','bazar','otro')),
          fecha_venta   timestamptz not null
        );
        """
    )
    op.execute("create index on ventas (usuaria_id, fecha_venta desc);")

    # Tabla auxiliar NO prevista en el esquema exacto de la spec: necesaria
    # para el límite diario de IA (429 LIMITE_DIARIO_IA) exigido por el
    # contrato. Ver README, sección 'Desviaciones'.
    op.execute(
        """
        create table uso_ia_diario (
          id          uuid primary key,
          usuaria_id  uuid not null references usuarias(id) on delete cascade,
          fecha       varchar(10) not null,
          contador    int not null default 0,
          unique (usuaria_id, fecha)
        );
        """
    )


def downgrade() -> None:
    op.execute("drop table if exists uso_ia_diario;")
    op.execute("drop table if exists ventas;")
    op.execute("drop table if exists prendas;")
    op.execute("drop table if exists fotos;")
    op.execute("drop table if exists lotes;")
    op.execute("drop table if exists usuarias;")
