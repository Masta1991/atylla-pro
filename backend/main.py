import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from routers import clients, calendar, workouts, measurements, config_router, auth, trainer
import config as runtime_settings
from runtime_config import ConfigurationError, validate_config


@asynccontextmanager
async def lifespan(app):
    validate_config(runtime_settings)
    yield

app = FastAPI(
    title="Atylla Pro API",
    description="Backend API for Atylla Pro — Personal Trainer Management",
    version="2.1.13",
    lifespan=lifespan,
)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback
from postgrest.exceptions import APIError

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Check if the exception is a Supabase/PostgREST JWT error
    if isinstance(exc, APIError) and str(exc.code) in {'PGRST301', 'PGRST303'}:
        return JSONResponse(
            status_code=401,
            content={"detail": "Session expired (JWT expired or invalid)"},
        )
        
    # encoding=utf-8: traceback z polskimi znakami (np. w danych klienta)
    # nie może wywalić handlera pustą odpowiedzią (ciche puste UI na PWA).
    with open("error.log", "a", encoding="utf-8") as f:
        f.write("=== ERROR ===\n")
        f.write(traceback.format_exc())
        f.write("\n")
    # Celowo generyczny komunikat do klienta (bez wycieku szczegolow bledu).
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# CORS — jawna lista originów (wildcard + credentials odrzucaja przegladarki).
# 1.x: backend 8000 + Expo web 3001; prod: Railway + PWA.
ALLOWED_ORIGINS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
    "https://atylla-pro-production.up.railway.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(calendar.router)
app.include_router(trainer.router)
app.include_router(workouts.router)
app.include_router(measurements.router)
app.include_router(config_router.router)
# dayclose usuniety w 2.0 (decyzja 2026-09-07) — tabela day_approvals zostaje w bazie nietknieta.


STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@app.get("/health")
def health_check():
    try:
        validate_config(runtime_settings)
    except ConfigurationError:
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    return {"status": "healthy"}


@app.get("/version")
def version_check():
    return {"version": app.version}


if os.path.isdir(STATIC_DIR):
    expo_dir = os.path.join(STATIC_DIR, "_expo")
    assets_dir = os.path.join(STATIC_DIR, "assets")

    if os.path.isdir(expo_dir):
        app.mount("/_expo", StaticFiles(directory=expo_dir), name="_expo")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    def _static_file_or_404(filename: str, media_type: str):
        # Brak pliku (np. sw.js w buildzie bez PWA) ma dać 404, nie 500.
        path = os.path.join(STATIC_DIR, filename)
        if not os.path.isfile(path):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        return FileResponse(path, media_type=media_type)

    @app.get("/favicon.ico")
    async def favicon():
        return _static_file_or_404("favicon.ico", "image/x-icon")

    @app.get("/sw.js")
    async def service_worker():
        return _static_file_or_404("sw.js", "application/javascript")

    @app.get("/manifest.json")
    async def manifest():
        return _static_file_or_404("manifest.json", "application/json")

    @app.get("/")
    async def index():
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

    # API prefixes that should NOT be intercepted by SPA fallback
    API_PREFIXES = (
        "clients", "calendar", "workouts", "measurements",
        "config", "auth", "email", "health", "version",  # retired email paths must return 404, not SPA
    )

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, request: Request):
        # If it looks like an API call, skip SPA fallback (will 404 naturally)
        if any(full_path.startswith(p) for p in API_PREFIXES):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        # T1: block path traversal — resolved path must stay inside STATIC_DIR.
        # Anything outside (e.g. /%2e%2e/models.py) falls back to SPA shell.
        static_root = os.path.realpath(STATIC_DIR)
        candidate = os.path.realpath(os.path.join(static_root, full_path))
        try:
            inside = os.path.commonpath([static_root, candidate]) == static_root
        except ValueError:
            inside = False
        if not inside:
            return FileResponse(os.path.join(static_root, "index.html"))
        # Serve specific static file if it exists
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        # Otherwise return SPA shell
        return FileResponse(os.path.join(static_root, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)



















































