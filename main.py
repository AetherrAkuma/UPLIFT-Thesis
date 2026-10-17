# ==========================================
# main.py — Backend entrypoint spawned by start.bat / setup_and_start.py
# ==========================================
# NOTE: do NOT re-add `from server import app` and do NOT enable uvicorn's
# reload mode in this launcher:
#   1. Importing server here loads EVERY model (bi-encoder, cross-encoder,
#      local Qwen GGUF verbalizer) once in this supervisor process — which
#      never
#      serves requests — and uvicorn's reload child then imports server.py
#      again.  Result: the whole engine cluster loads twice (double RAM,
#      double startup time) and the "[INFO] Loading ..." banner appears
#      twice.
#   2. reload_dirs=["."] watches the entire repo, so any file write during
#      a demo (logs, model cache, __pycache__) can silently restart the
#      backend mid-session.
# The string import below loads server.py exactly once, inside the server
# process.  For hot-reload during development, use a separate command:
#   .venv\Scripts\python.exe -m uvicorn server:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000)
