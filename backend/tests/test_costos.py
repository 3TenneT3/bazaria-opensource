from app.domain.costos import PrendaCosto, prorratear_lote


def test_prorrateo_simple_sin_manuales():
    prendas = [PrendaCosto(id="1", costo=0, costo_manual=False), PrendaCosto(id="2", costo=0, costo_manual=False)]
    resultado = prorratear_lote(10000, 2, 0, prendas)
    assert resultado == {"1": 5000, "2": 5000}


def test_prorrateo_con_residuo_va_a_la_ultima():
    prendas = [
        PrendaCosto(id="1", costo=0, costo_manual=False),
        PrendaCosto(id="2", costo=0, costo_manual=False),
        PrendaCosto(id="3", costo=0, costo_manual=False),
    ]
    resultado = prorratear_lote(100, 3, 0, prendas)
    # 100 // 3 = 33, residuo 1 -> ultima recibe 34
    assert resultado == {"1": 33, "2": 33, "3": 34}


def test_prorrateo_excluye_costo_manual():
    prendas = [
        PrendaCosto(id="1", costo=2000, costo_manual=True),
        PrendaCosto(id="2", costo=0, costo_manual=False),
        PrendaCosto(id="3", costo=0, costo_manual=False),
    ]
    resultado = prorratear_lote(10000, 3, 0, prendas)
    # costo_a_prorratear = 10000 - 2000 = 8000, entre 2 piezas = 4000 c/u
    assert resultado == {"2": 4000, "3": 4000}
    assert "1" not in resultado


def test_prorrateo_divisor_usa_piezas_reales_no_cantidad_de_prendas():
    # Solo 2 de 10 piezas registradas: cada una recibe el costo unitario real.
    prendas = [PrendaCosto(id="1", costo=0, costo_manual=False), PrendaCosto(id="2", costo=0, costo_manual=False)]
    resultado = prorratear_lote(10000, 10, 0, prendas)
    assert resultado == {"1": 1000, "2": 1000}


def test_prorrateo_piezas_validas_cero_lanza_error():
    import pytest

    with pytest.raises(ValueError):
        prorratear_lote(1000, 2, 2, [])


def test_prorrateo_sin_prendas_a_prorratear_devuelve_vacio():
    prendas = [PrendaCosto(id="1", costo=5000, costo_manual=True)]
    resultado = prorratear_lote(5000, 1, 0, prendas)
    assert resultado == {}
