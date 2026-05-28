import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from routers import clients, calendar, workouts, measurements, config_router, auth, email_router

app = FastAPI(
    title="Atylla Pro API",
    description="Backend API for Atylla Pro — Personal Trainer Management",
    version="1.0.0",
)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    with open("error.log", "a") as f:
        f.write("=== ERROR ===\n")
        f.write(traceback.format_exc())
        f.write("\n")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )

# CORS — allow frontend (Expo dev + production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(calendar.router)
app.include_router(workouts.router)
app.include_router(measurements.router)
app.include_router(config_router.router)
app.include_router(email_router.router)


STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if os.path.isdir(STATIC_DIR):
    expo_dir = os.path.join(STATIC_DIR, "_expo")
    assets_dir = os.path.join(STATIC_DIR, "assets")

    if os.path.isdir(expo_dir):
        app.mount("/_expo", StaticFiles(directory=expo_dir), name="_expo")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/favicon.ico")
    async def favicon():
        return FileResponse(os.path.join(STATIC_DIR, "favicon.ico"))

    @app.get("/")
    async def index():
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
