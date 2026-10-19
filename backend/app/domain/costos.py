"""Replica bit a bit la lógica de web/src/domain/costos.ts (frontend TypeScript).

No cambiar la fórmula sin actualizar ambos lados (backend y frontend).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


@dataclass
class PrendaCosto:
    """Vista mínima de una prenda para el prorrateo: id, costo, costoManual."""

    id: str
    costo: int
    costo_manual: bool


def prorratear_lote(
    costo_total: int,
    piezas_compradas: int,
    piezas_descartadas: int,
    prendas_del_lote: Sequence[PrendaCosto],
) -> dict[str, int]:
    """Devuelve {prenda_id: nuevo_costo} para las prendas que deben actualizarse.

    Traducción directa de `prorratearLote` en web/src/domain/costos.ts:
    - piezasValidas = piezasCompradas - piezasDescartadas (debe ser > 0)
    - las prendas con costo_manual=True se excluyen del prorrateo; su costo se
      resta del total antes de prorratear
    - costoBaseUnitario = floor(costoAProrratear / piezasAProrratear)
    - el residuo de centavos se asigna a la ÚLTIMA prenda prorrateada (en el
      orden de `prendas_del_lote`)
    """
    piezas_validas = piezas_compradas - piezas_descartadas
    if piezas_validas <= 0:
        raise ValueError("El número de piezas válidas debe ser mayor a 0")

    prendas_manuales = [p for p in prendas_del_lote if p.costo_manual]
    prendas_a_prorratear = [p for p in prendas_del_lote if not p.costo_manual]

    costo_manual_total = sum(p.costo for p in prendas_manuales)
    costo_a_prorratear = costo_total - costo_manual_total

    if not prendas_a_prorratear:
        return {}

    piezas_a_prorratear = piezas_validas - len(prendas_manuales)
    costo_base_unitario = costo_a_prorratear // piezas_a_prorratear
    residuo = costo_a_prorratear - costo_base_unitario * piezas_a_prorratear

    resultado: dict[str, int] = {}
    ultimo_idx = len(prendas_a_prorratear) - 1
    for idx, p in enumerate(prendas_a_prorratear):
        es_ultima = idx == ultimo_idx
        costo = costo_base_unitario + (residuo if es_ultima else 0)
        resultado[p.id] = costo

    return resultado


def ganancia_venta(precio_final: int, costo: int, costo_envio: int, comision: int) -> int:
    return precio_final - costo - costo_envio - comision


def ingreso_venta(precio_final: int, reembolso: int = 0) -> int:
    """Lo que de verdad entró por la venta: precio final menos lo reembolsado en una devolución."""
    return precio_final - reembolso


def cuenta_costo_de_prenda(destino_devolucion: str | None) -> bool:
    """El costo de la prenda se carga a la venta salvo que haya vuelto al inventario
    (se cargará cuando se venda otra vez). Si llegó dañada o se la quedó la clienta, sí cuenta."""
    return destino_devolucion != "disponible"


def capital_parado(prendas: Sequence[tuple[str, int]]) -> int:
    """prendas: secuencia de (status, costo). Suma costo de disponible/apartada."""
    return sum(costo for status, costo in prendas if status in ("disponible", "apartada"))


def recuperacion_lote(costo_total_lote: int, precios_finales_ventas_del_lote: Sequence[int]) -> dict[str, int]:
    recuperado = sum(precios_finales_ventas_del_lote)
    faltante = max(0, costo_total_lote - recuperado)
    return {"recuperado": recuperado, "faltante": faltante}
