from __future__ import annotations

import abc
import hashlib
import hmac
import io
import os
import re
import time
from dataclasses import dataclass

from PIL import Image, ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.models import Foto

MAX_BYTES = 5 * 1024 * 1024
# Tope de píxeles ANTES de decodificar: un PNG/WebP de pocos KB puede declarar 30000×30000 y,
# al abrirse, ocupar GB de RAM (bomba de descompresión) y tumbar la API (mem_limit 512 MB).
# La app manda fotos de 1280 px; 50 MP deja margen para una foto original de celular.
MAX_PIXELES = 50_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELES  # Pillow lanza DecompressionBombError a 2× esto
VARIANTES = {
    "mini": (320, 78),
    "detalle": (1024, 80),
}


class FotoInvalida(Exception):
    pass


@dataclass
class ImagenNormalizada:
    sha256: str
    ancho: int
    alto: int
    variantes: dict[str, bytes]  # nombre_variante -> bytes webp


def normalizar_y_generar_variantes(contenido: bytes) -> ImagenNormalizada:
    """Valida tamaño/decodificación, normaliza EXIF/RGB, genera variantes WebP.

    Lanza FotoInvalida si no decodifica como imagen real o excede MAX_BYTES.
    """
    if len(contenido) > MAX_BYTES:
        raise FotoInvalida("La foto excede el tamaño máximo de 5MB")

    try:
        img = Image.open(io.BytesIO(contenido))  # solo lee la cabecera, todavía no decodifica
    except Exception as exc:  # noqa: BLE001
        raise FotoInvalida("El archivo no es una imagen válida") from exc
    if img.width * img.height > MAX_PIXELES:
        raise FotoInvalida("La foto es demasiado grande (máximo 50 megapíxeles)")
    try:
        img.load()
    except Exception as exc:  # noqa: BLE001
        raise FotoInvalida("El archivo no es una imagen válida") from exc

    sha256 = hashlib.sha256(contenido).hexdigest()

    # Corregir orientación EXIF, quitar metadata, convertir a RGB.
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")

    ancho, alto = img.size

    variantes: dict[str, bytes] = {}
    for nombre, (lado_largo, calidad) in VARIANTES.items():
        copia = img.copy()
        copia.thumbnail((lado_largo, lado_largo), Image.LANCZOS)
        buf = io.BytesIO()
        copia.save(buf, format="WEBP", quality=calidad)
        variantes[nombre] = buf.getvalue()

    return ImagenNormalizada(sha256=sha256, ancho=ancho, alto=alto, variantes=variantes)


class Almacen(abc.ABC):
    """Interfaz de almacenamiento de archivos. Implementación local hoy,
    pensada para cambiar a S3/R2 sin tocar el resto de la app."""

    @abc.abstractmethod
    def guardar(self, llave_variante: str, contenido: bytes) -> None:
        ...

    @abc.abstractmethod
    def abrir(self, llave_variante: str) -> bytes:
        ...

    @abc.abstractmethod
    def borrar(self, llave_variante: str) -> None:
        ...

    @abc.abstractmethod
    def url(self, llave_variante: str) -> str:
        ...


class AlmacenLocal(Almacen):
    def __init__(self, base_dir: str | None = None, base_url: str | None = None) -> None:
        settings = get_settings()
        self.base_dir = base_dir or settings.fotos_dir
        self.base_url = (base_url or settings.fotos_base_url).rstrip("/")

    def _ruta(self, llave_variante: str) -> str:
        return os.path.join(self.base_dir, llave_variante)

    def guardar(self, llave_variante: str, contenido: bytes) -> None:
        ruta = self._ruta(llave_variante)
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with open(ruta, "wb") as f:
            f.write(contenido)

    def abrir(self, llave_variante: str) -> bytes:
        with open(self._ruta(llave_variante), "rb") as f:
            return f.read()

    def borrar(self, llave_variante: str) -> None:
        ruta = self._ruta(llave_variante)
        if os.path.exists(ruta):
            os.remove(ruta)

    def tamano(self, llave_variante: str) -> int:
        """Bytes que ocupa el archivo; FileNotFoundError si no existe."""
        return os.path.getsize(self._ruta(llave_variante))

    def url(self, llave_variante: str) -> str:
        e = expiracion_enlace()
        return f"{self.base_url}/{llave_variante}?e={e}&s={firmar_enlace(llave_variante, e)}"


# --- Enlaces firmados de fotos ---
# Antes, quien tuviera el enlace de una foto podía abrirla sin sesión. Ahora cada enlace
# lleva una caducidad y una firma HMAC: solo sirve si lo generó el servidor para la dueña
# (las URLs se entregan únicamente en respuestas autenticadas) y deja de servir al caducar.
# La caducidad se redondea al día para que el enlace sea el mismo durante ~24 h y la caché
# del navegador funcione; la app recibe enlaces nuevos en cada sincronización.
VIGENCIA_ENLACE_S = 7 * 24 * 3600
_DIA_S = 24 * 3600
_LLAVE_VALIDA = re.compile(r"^[0-9a-f]{2}/[0-9a-f]{2}/[0-9a-f]{64}_(mini|detalle)\.webp$")


def _clave_firma() -> bytes:
    # Derivada de JWT_SECRET con un contexto propio: no es la misma clave que firma sesiones.
    return hashlib.sha256(b"bazaria-fotos-v1:" + get_settings().jwt_secret.encode()).digest()


def expiracion_enlace(ahora: float | None = None) -> int:
    ahora = time.time() if ahora is None else ahora
    return (int(ahora) // _DIA_S + 1) * _DIA_S + VIGENCIA_ENLACE_S


def firmar_enlace(llave_variante: str, expira: int) -> str:
    msg = f"{llave_variante}:{expira}".encode()
    return hmac.new(_clave_firma(), msg, hashlib.sha256).hexdigest()[:32]


def enlace_valido(llave_variante: str, expira: str, firma: str, ahora: float | None = None) -> bool:
    if not _LLAVE_VALIDA.match(llave_variante) or not expira.isdigit() or not firma:
        return False
    if int(expira) < (time.time() if ahora is None else ahora):
        return False
    return hmac.compare_digest(firmar_enlace(llave_variante, int(expira)), firma)


def llave_variante(sha256: str, variante: str) -> str:
    """ej. 'ab/cd/abcd...ef_detalle.webp' (sin incluir FOTOS_DIR)."""
    return f"{sha256[0:2]}/{sha256[2:4]}/{sha256}_{variante}.webp"


def llave_base(sha256: str) -> str:
    """La 'llave' guardada en la tabla fotos: sin extensión ni variante."""
    return f"{sha256[0:2]}/{sha256[2:4]}/{sha256}"


async def sha_en_uso(db: AsyncSession, sha256: str, excluir_usuaria_id: str | None = None) -> bool:
    """¿Hay alguna fila de `fotos` (de cualquier usuaria, salvo `excluir_usuaria_id`) con este hash?

    Los archivos en disco se nombran solo por el hash del contenido, así que dos usuarias que
    suben la misma imagen comparten archivo. Antes de borrarlo hay que comprobar esto.
    """
    consulta = select(Foto.id).where(Foto.sha256 == sha256)
    if excluir_usuaria_id is not None:
        consulta = consulta.where(Foto.usuaria_id != excluir_usuaria_id)
    return (await db.execute(consulta.limit(1))).first() is not None
