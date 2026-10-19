from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://bazaria:bazaria@db:5432/bazaria"
    jwt_secret: str = Field(default="", validate_default=True)
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 14  # antes 30; además se puede cerrar en todos lados

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: Optional[str] = None  # si None, se deriva de FRONTEND... no, de api base

    frontend_url: str = "https://example.com"
    api_base_url: str = "https://api.example.com"

    fotos_dir: str = "/data/fotos"
    fotos_base_url: str = "https://api.example.com/fotos"

    allowed_emails: str = ""

    ia_limite_diario: int = 50

    # Cuotas de fotos por usuaria (protegen el disco del VPS compartido). Espacio = suma de las
    # variantes guardadas (mini + detalle). Las fotos repetidas (duplicar prenda) no cuentan.
    cuota_fotos_mb_gratis: int = 500
    cuota_fotos_mb_premium: int = 5000
    fotos_por_hora: int = 300
    # Mientras no haya un modelo de IA conectado, /ia/analizar-foto no cuenta usos
    # (si no, cada foto sumaba al 'Uso IA diario' sin haber IA de verdad).
    ia_activa: bool = False

    cookie_secure: bool = True

    # El panel (/admin y /flare) solo responde en este dominio; en cualquier otro (p. ej.
    # api.example.com) da 404. Vacío = sin restricción (desarrollo y pruebas).
    admin_host: str = "admin.example.com"

    # /docs, /redoc y /openapi.json describen toda la API: solo en desarrollo.
    exponer_docs: bool = False

    # Panel de administración (/admin, /flare) — login propio, SEPARADO del
    # JWT de las usuarias (nunca mezclar: un admin NO debe poder usar su
    # sesión de panel para llamar a los endpoints de negocio, y viceversa).
    admin_username: str = "admin"
    admin_password: str = Field(default="", validate_default=True)
    admin_secret_key: str = Field(default="", validate_default=True)
    # Cuenta opcional de SOLO LECTURA para colaboradores (ve todo, no edita nada).
    # Si ADMIN_LECTOR_USERNAME está vacío, la cuenta no existe.
    admin_lector_username: str = ""
    admin_lector_password: str = ""

    @field_validator("jwt_secret")
    @classmethod
    def _jwt_secret_real(cls, v: str) -> str:
        # Un secreto vacío o de plantilla permitiría forjar sesiones: mejor no arrancar.
        if v.strip() in ("", "CAMBIAME", "dev-secret-change-me"):
            raise ValueError("JWT_SECRET falta o es un placeholder: define uno aleatorio en .env")
        return v

    @field_validator("admin_password", "admin_secret_key")
    @classmethod
    def _admin_credenciales_reales(cls, v: str) -> str:
        # Mismo riesgo que JWT_SECRET: un placeholder conocido deja /admin
        # (datos de TODAS las usuarias) y /flare abiertos con credenciales
        # públicas. Mejor no arrancar que arrancar inseguro.
        if v.strip() in ("", "CAMBIAME", "dev-admin-change-me", "dev-admin-secret-change-me"):
            raise ValueError(
                "ADMIN_PASSWORD / ADMIN_SECRET_KEY faltan o son un placeholder: "
                "define valores aleatorios en .env"
            )
        return v

    @field_validator("admin_lector_password")
    @classmethod
    def _lector_password_real(cls, v: str, info) -> str:
        if info.data.get("admin_lector_username") and len(v.strip()) < 16:
            raise ValueError("ADMIN_LECTOR_PASSWORD falta o es muy corta (mínimo 16 caracteres)")
        return v

    @property
    def allowed_emails_list(self) -> List[str]:
        return [e.strip().lower() for e in self.allowed_emails.split(",") if e.strip()]

    @property
    def google_callback_url(self) -> str:
        return self.google_redirect_uri or f"{self.api_base_url}/auth/google/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()
