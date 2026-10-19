"""Hash de contraseñas del panel con scrypt (stdlib, sin dependencias nuevas)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

# N=2^16 (~64 MB por cálculo): más cerca de lo recomendado sin ahogar el mem_limit de 512 MB.
_N, _R, _P = 2**16, 8, 1
MINIMO = 12


def hashear(contrasena: str) -> str:
    sal = secrets.token_bytes(16)
    h = hashlib.scrypt(contrasena.encode(), salt=sal, n=_N, r=_R, p=_P, dklen=32, maxmem=256 * 1024 * 1024)
    b = lambda x: base64.b64encode(x).decode()
    return f"scrypt${_N}${_R}${_P}${b(sal)}${b(h)}"


def verificar(contrasena: str, guardado: str) -> bool:
    try:
        _, n, r, p, sal, h = guardado.split("$")
        calc = hashlib.scrypt(
            contrasena.encode(), salt=base64.b64decode(sal), n=int(n), r=int(r), p=int(p), dklen=32,
            maxmem=256 * 1024 * 1024,
        )
        return hmac.compare_digest(calc, base64.b64decode(h))
    except (ValueError, TypeError):
        return False


def problema(nueva: str, repetida: str) -> str | None:
    """Mensaje de error si la contraseña nueva no sirve; None si está bien."""
    if nueva != repetida:
        return "Las dos contraseñas no coinciden."
    if len(nueva) < MINIMO:
        return f"La contraseña debe tener al menos {MINIMO} caracteres."
    if nueva.lower() in {"admin123456789", "contrasena123", "password1234", "123456789012"}:
        return "Esa contraseña es demasiado común."
    return None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
