# ==========================================
# download_whymatched_model.py - Fetch the optional "Why matched?" GGUF model
# ==========================================
# Downloads the grounded "Why matched?" verbalizer (Qwen2.5-1.5B-Instruct,
# Q4_K_M quantized, ~1.07 GB) from ModelScope.
#
# The feature works WITHOUT this model (deterministic plain-language drafts).
# With it, the same facts get softly rephrased into warmer card text.
#
# Note on the engine: llama-cpp-python runs ANY GGUF-format model, Qwen
# included - "llama" in the package name is the inference engine's history,
# not the model. Alternatives tested and rejected on this project's real data
# (see tests/why_matched_bench_results.md):
#   - Llama-3.2-1B   -> invented employer voice, failed verification guard
#   - Qwen3.5-0.8B   -> assistant chatter, failed verification guard
#
# Usage:
#   .venv\Scripts\python.exe download_whymatched_model.py

import os
import sys
import urllib.request

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(
    REPO_DIR, "model_cache", "gguf", "Qwen2.5-1.5B-Instruct-GGUF",
    "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
)
URL = (
    "https://modelscope.cn/models/Qwen/Qwen2.5-1.5B-Instruct-GGUF/"
    "resolve/master/qwen2.5-1.5b-instruct-q4_k_m.gguf"
)
MIN_BYTES = 900 * 1024 * 1024  # sanity floor; the real file is ~1.07 GB


def main():
    os.makedirs(os.path.dirname(DEST), exist_ok=True)

    if os.path.isfile(DEST) and os.path.getsize(DEST) >= MIN_BYTES:
        print(f"[SKIP] Model already present: {DEST}")
        return 0

    part = DEST + ".part"
    resume_at = os.path.getsize(part) if os.path.isfile(part) else 0
    headers = {"User-Agent": "uplift-setup/1.0"}
    if resume_at > 0:
        headers["Range"] = f"bytes={resume_at}-"

    print("[INFO] Downloading Qwen2.5-1.5B-Instruct Q4_K_M (~1.07 GB, ModelScope)...")
    if resume_at > 0:
        print(f"  ... resuming at {resume_at // (1024 * 1024)} MB")

    try:
        req = urllib.request.Request(URL, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resume_at > 0 and resp.status != 206:
                resume_at = 0  # server ignored Range -> restart from scratch
            total = int(resp.headers.get("Content-Length") or 0) + resume_at
            with open(part, "ab" if resume_at else "wb") as fh:
                done = resume_at
                last_pct = -5
                while True:
                    chunk = resp.read(512 * 1024)
                    if not chunk:
                        break
                    fh.write(chunk)
                    done += len(chunk)
                    if total:
                        pct = int(done * 100 / total)
                        if pct >= last_pct + 5 or pct == 100:
                            last_pct = pct
                            print(f"  ... {pct:3d}%  ({done // (1024 * 1024)} MB)", flush=True)
    except KeyboardInterrupt:
        print("\n[ABORT] Download cancelled. Partial file kept - re-run to resume.")
        return 1
    except Exception as e:
        print(f"[ERROR] Download failed: {e}")
        print("        Partial file kept - re-run to resume.")
        return 1

    size = os.path.getsize(part)
    if size < MIN_BYTES:
        print(f"[ERROR] Downloaded file looks incomplete ({size} bytes); re-run to resume.")
        return 1

    os.replace(part, DEST)
    print(f"[SUCCESS] Model ready: {DEST}")
    print("[INFO] Restart the backend; it auto-detects the model on startup.")
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main())
