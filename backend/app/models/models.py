from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Usuaria(Base):
    __tablename__ = "usuarias"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    google_sub: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    nombre: Mapped[str | None] = mapped_column(Text, nullable=True)
    creada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Soft delete: cuando la usuaria pide eliminar su cuenta, se marca aquí
    # (no se borra nada todavía). Un job de purga (scripts/purgar_usuarias.py)
    # borra definitivamente (DB + fotos en disco) pasado un periodo de gracia
    # (ver RETENCION_DIAS en ese script). Mientras esté marcada, pierde acceso
    # inmediato: usuaria_actual la trata como inexistente (401).
    # "gratis" o "premium". Solo lo cambia un admin desde el panel.
    plan: Mapped[str] = mapped_column(String(16), nullable=False, default="gratis", server_default="gratis")
    # Va dentro de cada token de sesión. Subirla invalida TODAS las sesiones abiertas de la usuaria
    # ("cerrar sesión en todos lados", o un admin desde el panel si pierde el teléfono).
    version_sesion: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    eliminada_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Lote(Base):
    __tablename__ = "lotes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    usuaria_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("usuarias.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    costo_total: Mapped[int] = mapped_column(BigInteger, nullable=False)
    piezas_compradas: Mapped[int] = mapped_column(Integer, nullable=False)
    piezas_descartadas: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fecha_compra: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("costo_total >= 0", name="lotes_costo_total_check"),
        CheckConstraint("piezas_compradas > 0", name="lotes_piezas_compradas_check"),
        CheckConstraint("piezas_descartadas >= 0", name="lotes_piezas_descartadas_check"),
    )


class Foto(Base):
    __tablename__ = "fotos"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    usuaria_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("usuarias.id", ondelete="CASCADE"), nullable=False
    )
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    llave: Mapped[str] = mapped_column(Text, nullable=False)
    mime: Mapped[str] = mapped_column(Text, nullable=False, default="image/webp")
    bytes_: Mapped[int] = mapped_column("bytes", Integer, nullable=False)
    ancho: Mapped[int] = mapped_column(Integer, nullable=False)
    alto: Mapped[int] = mapped_column(Integer, nullable=False)
    creada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (UniqueConstraint("usuaria_id", "sha256", name="fotos_usuaria_sha256_key"),)


class Prenda(Base):
    __tablename__ = "prendas"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    usuaria_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("usuarias.id", ondelete="CASCADE"), nullable=False
    )
    lote_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("lotes.id", ondelete="SET NULL"), nullable=True
    )
    foto_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("fotos.id", ondelete="SET NULL"), nullable=True
    )
    tipo: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(Text, nullable=True)
    talla: Mapped[str | None] = mapped_column(Text, nullable=True)
    marca: Mapped[str | None] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(Text, nullable=False)
    costo: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    costo_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    precio_venta: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="disponible")
    creada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("estado in ('nueva','seminueva','usada')", name="prendas_estado_check"),
        CheckConstraint("costo >= 0", name="prendas_costo_check"),
        CheckConstraint("precio_venta >= 0", name="prendas_precio_venta_check"),
        CheckConstraint(
            "status in ('disponible','apartada','vendida','descartada')",
            name="prendas_status_check",
        ),
    )


class Venta(Base):
    __tablename__ = "ventas"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    usuaria_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("usuarias.id", ondelete="CASCADE"), nullable=False
    )
    prenda_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("prendas.id", ondelete="CASCADE"), nullable=False
    )
    precio_final: Mapped[int] = mapped_column(BigInteger, nullable=False)
    costo_envio: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    comision: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    canal: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_venta: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint("precio_final >= 0", name="ventas_precio_final_check"),
        CheckConstraint(
            "canal in ('instagram','whatsapp','bazar','otro')", name="ventas_canal_check"
        ),
    )


class UsoIaDiario(Base):
    """Tabla auxiliar (no está en la spec original) para el límite diario de IA.

    No forma parte del esquema exacto de backend-spec.md; se agrega porque el
    contrato exige un 429 por límite diario y eso requiere persistir el conteo
    en algún lado. Documentado como desviación en el README.
    """

    __tablename__ = "uso_ia_diario"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    usuaria_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("usuarias.id", ondelete="CASCADE"), nullable=False
    )
    fecha: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    contador: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("usuaria_id", "fecha", name="uso_ia_diario_usuaria_fecha_key"),)


class AdminCuenta(Base):
    """Contraseña del panel cambiada desde el propio panel (hash scrypt).

    Si existe fila para un usuario, MANDA sobre ADMIN_PASSWORD / ADMIN_LECTOR_PASSWORD
    del .env (que quedan solo como contraseña inicial). También guarda el enlace de un
    solo uso para fijar contraseña sin entrar por SSH (solo el hash del token).
    """

    __tablename__ = "admin_cuentas"

    usuario: Mapped[str] = mapped_column(String(64), primary_key=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    token_expira: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class UsoIa(Base):
    """Una llamada real a un modelo de IA (lo que cuesta dinero). Una fila por llamada."""

    __tablename__ = "uso_ia"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    usuaria_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("usuarias.id", ondelete="CASCADE"), nullable=False
    )
    funcion: Mapped[str] = mapped_column(String(32), nullable=False)  # ej. "analizar_foto"
    modelo: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_entrada: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_salida: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    costo_centavos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # MXN estimado
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
