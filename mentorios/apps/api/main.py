import structlog
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import make_asgi_app

from core.config import get_settings
from core.database import Base, close_neo4j, engine
from routers import auth, chat, mentors, search, videos, wisdom

log = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "mentorios.startup", version=settings.app_version, env=settings.environment
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            traces_sample_rate=0.1,
            environment=settings.environment,
        )

    yield

    await close_neo4j()
    await engine.dispose()
    log.info("mentorios.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="MentorOS API",
        description="Human Wisdom Intelligence Platform — Action · Intent · Principle · Wisdom",
        version=settings.app_version,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(o) for o in settings.allowed_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(videos.router, prefix=settings.api_prefix)
    app.include_router(wisdom.router, prefix=settings.api_prefix)
    app.include_router(chat.router, prefix=settings.api_prefix)
    app.include_router(mentors.router, prefix=settings.api_prefix)
    app.include_router(search.router, prefix=settings.api_prefix)

    if settings.prometheus_enabled:
        metrics_app = make_asgi_app()
        app.mount("/metrics", metrics_app)

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "version": settings.app_version}

    return app


app = create_app()
