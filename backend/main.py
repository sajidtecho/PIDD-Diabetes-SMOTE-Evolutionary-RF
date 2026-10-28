from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from backend.api.routes import router as api_router
except ImportError:
    from api.routes import router as api_router

app = FastAPI(
    title="PIDD Diabetes Clinical AI Platform API",
    description="High-precision clinical decision support API using SMOTE-balanced Random Forest & Genetic Algorithm optimization.",
    version="1.0.0"
)

# Enable CORS for local Vite dev server and external clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "PIDD Diabetes Clinical Prediction Service",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
