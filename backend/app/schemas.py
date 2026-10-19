from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


def _uuid_o_none(v: Optional[str]) -> Optional[str]:
    """Los ids que elige el cliente (captura sin conexión) deben ser UUID."""
    if v is None:
        return None
    try:
        return str(uuid.UUID(str(v)))
    except ValueError as exc:
        raise ValueError("id debe ser un UUID") from exc


# ---------- Lotes ----------


class LoteOut(CamelModel):
    id: str
    nombre: str
    costo_total: int
    piezas_compradas: int
    piezas_descartadas: int
    fecha_compra: datetime
    notas: Optional[str] = None


class LoteCrear(CamelModel):
    # Opcional: el cliente lo genera al capturar sin conexión. Hace idempotente el reintento.
    id: Optional[str] = None
    nombre: str
    costo_total: int = Field(ge=0)
    piezas_compradas: int = Field(gt=0)
    piezas_descartadas: int = Field(ge=0, default=0)
    fecha_compra: datetime
    notas: Optional[str] = None

    _id_uuid = field_validator("id")(_uuid_o_none)


class LoteActualizar(CamelModel):
    nombre: Optional[str] = None
    costo_total: Optional[int] = Field(default=None, ge=0)
    piezas_compradas: Optional[int] = Field(default=None, gt=0)
    piezas_descartadas: Optional[int] = Field(default=None, ge=0)
    fecha_compra: Optional[datetime] = None
    notas: Optional[str] = None


# ---------- Prendas ----------

Estado = Literal["nueva", "seminueva", "usada"]
Status = Literal["disponible", "apartada", "vendida", "descartada"]


class PrendaOut(CamelModel):
    id: str
    lote_id: Optional[str] = None
    foto_url: Optional[str] = None
    foto_mini_url: Optional[str] = None
    tipo: Optional[str] = None
    color: Optional[str] = None
    talla: Optional[str] = None
    marca: Optional[str] = None
    estado: Estado
    costo: int
    costo_manual: bool
    precio_venta: int
    status: Status
    creado_en: datetime
    descartada_en: Optional[datetime] = None
    # Solo conserva la miniatura: `fotoUrl` ya apunta a ella.
    foto_reducida: bool = False


class LiberarFotosIn(CamelModel):
    """Prendas vendidas a las que se les quita la foto grande. Sin `ids`: todas las vendidas."""

    ids: Optional[list[str]] = Field(default=None, max_length=500)

    @field_validator("ids")
    @classmethod
    def _ids_uuid(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return None if v is None else [_uuid_o_none(i) for i in v]


class LiberarFotosOut(CamelModel):
    liberados: int
    bytes_liberados: int


class PrendaCrearData(CamelModel):
    id: Optional[str] = None
    # Hora real de captura (si se capturó sin conexión). El servidor no acepta fechas futuras.
    creado_en: Optional[datetime] = None
    lote_id: Optional[str] = None
    tipo: Optional[str] = None
    color: Optional[str] = None
    talla: Optional[str] = None
    marca: Optional[str] = None
    estado: Estado
    costo: int = Field(ge=0, default=0)
    costo_manual: bool = False
    precio_venta: int = Field(ge=0, default=0)

    _id_uuid = field_validator("id", "lote_id")(_uuid_o_none)


class PrendaActualizar(CamelModel):
    lote_id: Optional[str] = None
    tipo: Optional[str] = None
    color: Optional[str] = None
    talla: Optional[str] = None
    marca: Optional[str] = None
    estado: Optional[Estado] = None
    costo: Optional[int] = Field(default=None, ge=0)
    costo_manual: Optional[bool] = None
    precio_venta: Optional[int] = Field(default=None, ge=0)
    status: Optional[Status] = None

    _lote_uuid = field_validator("lote_id")(_uuid_o_none)


class PrendaStatusUpdate(CamelModel):
    status: Status


# ---------- Ventas ----------

Canal = Literal["instagram", "whatsapp", "bazar", "otro"]


class VentaCrear(CamelModel):
    id: Optional[str] = None
    # Hora real de la venta (si se registró sin conexión). El servidor no acepta fechas futuras.
    fecha_venta: Optional[datetime] = None
    precio_final: int = Field(ge=0)
    costo_envio: int = Field(ge=0, default=0)
    comision: int = Field(ge=0, default=0)
    canal: Canal

    _id_uuid = field_validator("id")(_uuid_o_none)


DestinoDevolucion = Literal["disponible", "descartada", "cliente"]


class DevolucionCrear(CamelModel):
    # Lo que se le regresó a la clienta, en centavos (0 .. precio final de la venta).
    reembolso: int = Field(ge=0)
    destino: DestinoDevolucion
    # Hora real (si se registró sin conexión). Si no viene, la del servidor.
    fecha_devolucion: Optional[datetime] = None


class VentaOut(CamelModel):
    id: str
    prenda_id: str
    precio_final: int
    costo_envio: int
    comision: int
    canal: Canal
    fecha_venta: datetime
    devuelta_en: Optional[datetime] = None
    reembolso: int = 0
    destino_devolucion: Optional[DestinoDevolucion] = None


# ---------- Auth ----------


class MeOut(CamelModel):
    email: str
    plan: str = "gratis"
    # True si la app debe ofrecer reconocer la foto (premium y con IA conectada).
    ia_disponible: bool = False
    # Espacio de fotos (para que la usuaria vea cuánto lleva antes de llegar al límite).
    fotos_bytes_usados: int = 0
    fotos_bytes_cuota: int = 0


# ---------- IA ----------


class AnalisisFotoOut(CamelModel):
    tipo: Optional[str] = None
    color: Optional[str] = None
    talla: Optional[str] = None
    marca: Optional[str] = None
    estado: Optional[Estado] = None
    confianza: float


# ---------- Reportes ----------


class TopTipoOut(CamelModel):
    tipo: str
    ganancia: int


class ResumenMesOut(CamelModel):
    anio: int
    mes: int
    total_ventas: int
    ganancia_neta: int
    numero_prendas_vendidas: int
    top_tipos: list[TopTipoOut]
    prendas_estancadas: list[PrendaOut]


class ResumenLoteOut(CamelModel):
    lote: LoteOut
    recuperado: int
    faltante: int
    costo_unitario_actual: int
