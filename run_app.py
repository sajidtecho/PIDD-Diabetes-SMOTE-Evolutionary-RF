import subprocess
import sys
import time
import os

root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, "backend")
frontend_dir = os.path.join(root_dir, "frontend")

print("=" * 60)
print("  DiaGuard AI — Launching Full-Stack Platform")
print("=" * 60)

# Start FastAPI backend
print("\n[1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...")
backend_cmd = [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"]
backend_proc = subprocess.Popen(backend_cmd, cwd=backend_dir)

time.sleep(1.5)

# Start Vite React frontend
print("[2/2] Starting Vite React Frontend on http://localhost:5173 ...")
npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir)

print("\n" + "=" * 60)
print("  Both services are running!")
print("  - Frontend UI : http://localhost:5173")
print("  - Backend API : http://127.0.0.1:8000")
print("  - API Docs    : http://127.0.0.1:8000/docs")
print("=" * 60)
print("\nPress Ctrl+C to terminate both servers...\n")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nShutting down services...")
    frontend_proc.terminate()
    backend_proc.terminate()
    print("All servers stopped successfully.")
