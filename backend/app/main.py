from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    assets,
    auth,
    dashboard,
    entries,
    health,
    ocr,
    portfolio,
    receipts,
    search,
    users,
    vault,
)
from app.api.routes import settings as settings_routes
from app.core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix=settings.api_v1_prefix, tags=["health"])
    app.include_router(auth.router, prefix=f"{settings.api_v1_prefix}/auth", tags=["auth"])
    app.include_router(users.router, prefix=f"{settings.api_v1_prefix}/users", tags=["users"])
    app.include_router(assets.router, prefix=f"{settings.api_v1_prefix}/assets", tags=["assets"])
    app.include_router(entries.router, prefix=f"{settings.api_v1_prefix}/entries", tags=["entries"])
    app.include_router(
        receipts.router,
        prefix=f"{settings.api_v1_prefix}/receipts",
        tags=["receipts"],
    )
    app.include_router(vault.router, prefix=f"{settings.api_v1_prefix}/vault", tags=["vault"])
    app.include_router(
        dashboard.router,
        prefix=f"{settings.api_v1_prefix}/dashboard",
        tags=["dashboard"],
    )
    app.include_router(ocr.router, prefix=f"{settings.api_v1_prefix}/ocr", tags=["ocr"])
    app.include_router(
        portfolio.router,
        prefix=f"{settings.api_v1_prefix}/portfolio",
        tags=["portfolio"],
    )
    app.include_router(search.router, prefix=f"{settings.api_v1_prefix}/search", tags=["search"])
    app.include_router(
        settings_routes.router,
        prefix=f"{settings.api_v1_prefix}/settings",
        tags=["settings"],
    )

    return app


app = create_app()
