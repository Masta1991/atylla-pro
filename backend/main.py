from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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


@app.get("/")
def root():
    return {
        "name": "Atylla Pro API",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
