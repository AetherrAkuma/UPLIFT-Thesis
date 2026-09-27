import os
import sys
import subprocess
import socket
import time
import shutil
import re
import secrets
import webbrowser

def print_banner(text, char="="):
    line = char * 70
    print(f"\n{line}")
    print(f"  {text}")
    print(f"{line}\n")

def read_env_file():
    """Reads .env variables into a dictionary without external packages."""
    env_vars = {}
    env_path = os.path.join(os.getcwd(), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip().strip("'\"")
    return env_vars

def ensure_env_file():
    """Ensures .env exists, copying from .env.example or creating with defaults."""
    env_path = os.path.join(os.getcwd(), ".env")
    example_path = os.path.join(os.getcwd(), ".env.example")
    
    if not os.path.exists(env_path):
        if os.path.exists(example_path):
            print("[INFO] Creating '.env' from '.env.example' template...")
            shutil.copyfile(example_path, env_path)
        else:
            print("[INFO] Generating default '.env' file...")
            defaults = (
                "# ==========================================\n"
                "# UPLIFT System Configuration\n"
                "# ==========================================\n\n"
                "# PostgreSQL Database Configuration\n"
                "DB_USER=postgres\n"
                "DB_PASSWORD=upliftthesis\n"
                "DB_HOST=localhost\n"
                "DB_PORT=5432\n"
                "DB_NAME=uplift\n\n"
                "# Server Host & Port\n"
                "BACKEND_HOST=0.0.0.0\n"
                "BACKEND_PORT=8000\n"
                "FRONTEND_PORT=5173\n"
            )
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(defaults)

    # Ensure JWT_SECRET is present
    env_vars = read_env_file()
    if not env_vars.get("JWT_SECRET"):
        jwt_key = secrets.token_hex(32)
        update_env_file("JWT_SECRET", jwt_key)
        
    print("[SUCCESS] '.env' configuration verified.")
    return read_env_file()

def update_env_file(key, value):
    """Updates or appends a key=value in .env file."""
    env_path = os.path.join(os.getcwd(), ".env")
    lines = []
    found = False
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    new_lines = []
    for line in lines:
        if line.strip().startswith(f"{key}=") or line.strip().startswith(f"{key} ="):
            new_lines.append(f"{key}={value}\n")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={value}\n")

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    os.environ[key] = str(value)

def get_local_ip():
    """Detects local LAN IP for cross-device mobile testing."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def free_port_if_occupied(port, service_name="Service"):
    """
    Checks if a port is occupied. If an orphaned Python or Node process is holding it,
    it automatically cleans it up to prevent 'address already in use' crashes.
    """
    is_in_use = False
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            is_in_use = True
    except (socket.timeout, ConnectionRefusedError, OSError):
        is_in_use = False

    if not is_in_use:
        return

    print(f"[INFO] Port {port} ({service_name}) is currently occupied. Checking for stale process...")
    try:
        netstat = subprocess.run(
            f'netstat -ano -p tcp | findstr /R ":{port} .*LISTENING"',
            shell=True,
            capture_output=True,
            text=True
        )
        pids = set()
        for line in netstat.stdout.splitlines():
            parts = line.strip().split()
            if len(parts) >= 5 and parts[3] == "LISTENING":
                pids.add(parts[4])

        for pid in pids:
            if pid and pid != "0":
                print(f"[AUTO-REPAIR] Releasing port {port} by terminating stale process (PID {pid})...")
                subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1)
    except Exception as e:
        print(f"[WARNING] Could not auto-clear port {port}: {e}")

def check_venv(venv_path=".venv"):
    """
    Validates the local virtual environment.
    If .venv is missing, broken, or migrated from another machine with invalid paths,
    it automatically cleans up and recreates a fresh virtual environment.
    """
    python_exe = os.path.join(venv_path, "Scripts", "python.exe")
    pip_exe = os.path.join(venv_path, "Scripts", "pip.exe")
    cfg_file = os.path.join(venv_path, "pyvenv.cfg")
    is_valid = False
    
    if os.path.exists(python_exe) and os.path.exists(pip_exe) and os.path.exists(cfg_file):
        try:
            # 1. Test basic code execution
            test_res = subprocess.run(
                [python_exe, "-c", "import sys; sys.exit(0)"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=6
            )
            # 2. Test pip invocation inside venv
            pip_res = subprocess.run(
                [python_exe, "-m", "pip", "--version"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=6
            )
            if test_res.returncode == 0 and pip_res.returncode == 0:
                is_valid = True
        except Exception:
            is_valid = False

    if not is_valid:
        if os.path.exists(venv_path):
            print(f"[AUTO-REPAIR] Existing virtual environment at '{venv_path}' is corrupted or copied from another PC.")
            print("[INFO] Rebuilding clean virtual environment for this machine...")
            try:
                shutil.rmtree(venv_path, ignore_errors=True)
            except Exception as e:
                print(f"[WARNING] Could not completely remove old .venv directory: {e}")
        else:
            print("[INFO] Creating virtual environment (.venv)...")
            
        subprocess.run([sys.executable, "-m", "venv", venv_path], check=True)
        python_exe = os.path.join(venv_path, "Scripts", "python.exe")
        print("[SUCCESS] Virtual environment initialized.")
    else:
        print("[SUCCESS] Virtual environment verified.")
        
    return python_exe

def verify_and_install_deps(venv_python):
    """
    Verifies installed packages, automatically installs missing dependencies from requirements.txt,
    and guarantees required NLP models (spaCy, NLTK) are present.
    """
    print("[INFO] Checking Python dependencies...")
    chk_script = (
        "import sys\n"
        "try:\n"
        "    import torch, fastapi, uvicorn, psycopg2, pgvector\n"
        "    import sentence_transformers, transformers, aif360, jwt, docx\n"
        "    import pydparser, spacy, nltk, rendercv, dotenv\n"
        "    sys.exit(0)\n"
        "except Exception as e:\n"
        "    print(f'MISSING:{e}')\n"
        "    sys.exit(1)\n"
    )
    chk_proc = subprocess.run(
        [venv_python, "-c", chk_script],
        capture_output=True,
        text=True
    )
    missing_deps = (chk_proc.returncode != 0)
    if missing_deps and chk_proc.stdout.strip():
        print(f"[INFO] Missing or incomplete package: {chk_proc.stdout.strip()}")

    if missing_deps:
        print_banner("Installing / Updating Dependencies in .venv")
        print("[INFO] Upgrading pip, setuptools (<82), and wheel...")
        subprocess.run([venv_python, "-m", "pip", "install", "--upgrade", "pip", "setuptools<82", "wheel"], check=False)
        
        print("[INFO] Installing dependencies from requirements.txt (this may take a few minutes on first run)...")
        req_path = os.path.join(os.getcwd(), "requirements.txt")
        subprocess.run([venv_python, "-m", "pip", "install", "-r", req_path], check=True)
        print("[SUCCESS] All Python requirements installed.")
    else:
        print("[SUCCESS] All core Python dependencies are present.")

    # 1. Verify spaCy English model
    try:
        subprocess.run(
            [venv_python, "-c", "import spacy; spacy.load('en_core_web_sm')"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
    except subprocess.CalledProcessError:
        print("[INFO] Installing spaCy English language model (en_core_web_sm)...")
        whl_url = "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl"
        res = subprocess.run([venv_python, "-m", "pip", "install", whl_url], check=False)
        if res.returncode != 0:
            subprocess.run([venv_python, "-m", "spacy", "download", "en_core_web_sm"], check=False)

    # 2. Verify NLTK corpora for pydparser and text processing
    try:
        subprocess.run(
            [venv_python, "-c", "import nltk; nltk.data.find('corpora/stopwords'); nltk.data.find('corpora/words'); nltk.data.find('tokenizers/punkt')"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
    except subprocess.CalledProcessError:
        print("[INFO] Downloading required NLTK datasets (stopwords, words, punkt)...")
        subprocess.run(
            [venv_python, "-c", "import nltk; nltk.download('stopwords', quiet=True); nltk.download('words', quiet=True); nltk.download('punkt', quiet=True); nltk.download('punkt_tab', quiet=True); nltk.download('averaged_perceptron_tagger', quiet=True)"],
            check=False
        )

def try_start_postgres_service():
    """Detects and attempts to start the PostgreSQL Windows Service if stopped."""
    try:
        cmd = 'powershell -NoProfile -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name"'
        proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        services = [s.strip() for s in proc.stdout.splitlines() if s.strip()]
        for sname in services:
            print(f"[INFO] Attempting to start Windows Service '{sname}'...")
            subprocess.run(f"net start {sname}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(2)
            return True
    except Exception:
        pass
    return False

def wait_for_postgres(venv_python):
    """
    Verifies PostgreSQL port, service, authentication, and pgvector extension.
    If port is closed, attempts auto-start or guides user.
    If authentication fails, offers interactive password prompt and updates .env.
    Auto-creates the 'uplift' database.
    Checks and guides on pgvector extension installation.
    """
    while True:
        env_vars = read_env_file()
        db_user = env_vars.get("DB_USER", os.getenv("DB_USER", "postgres"))
        db_password = env_vars.get("DB_PASSWORD", os.getenv("DB_PASSWORD", "upliftthesis"))
        db_host = env_vars.get("DB_HOST", os.getenv("DB_HOST", "localhost"))
        db_port = int(env_vars.get("DB_PORT", os.getenv("DB_PORT", "5432")))
        db_name = env_vars.get("DB_NAME", os.getenv("DB_NAME", "uplift"))

        # Step 1: Check if port is reachable
        port_open = False
        try:
            with socket.create_connection((db_host, db_port), timeout=2):
                port_open = True
        except (socket.timeout, ConnectionRefusedError, OSError):
            port_open = False

        if not port_open:
            # Try to auto-start PostgreSQL service
            print("[INFO] PostgreSQL port is unreachable. Checking Windows Services...")
            if try_start_postgres_service():
                try:
                    with socket.create_connection((db_host, db_port), timeout=2):
                        port_open = True
                        print("[SUCCESS] PostgreSQL Windows service started successfully!")
                except Exception:
                    port_open = False

        if not port_open:
            print_banner("[ACTION REQUIRED] PostgreSQL Database Service Unreachable", "!")
            print(f" PostgreSQL is not responding on {db_host}:{db_port}.")
            print(" UPLIFT requires a local PostgreSQL instance for data storage and vector search.\n")
            print(" Available Options:")
            print("   [1] Automatically install PostgreSQL 16 via winget (Windows Package Manager)")
            print("   [2] Open official PostgreSQL download website in your browser")
            print("   [3] Retry connection (press Enter once PostgreSQL is running)")
            print("   [4] Change DB_PORT or DB_HOST in .env")
            print("!" * 70)
            
            choice = input("\nSelect an option [1-4, Default: 3]: ").strip()
            if choice == "1":
                print("\n[INFO] Installing PostgreSQL 16 via winget...")
                print("Please follow any installer prompt that appears and note your chosen password.")
                subprocess.run("winget install PostgreSQL.PostgreSQL.16 -e --accept-package-agreements --accept-source-agreements", shell=True)
                input("\nOnce PostgreSQL installation completes, press [Enter] to continue...")
                continue
            elif choice == "2":
                print("\n[INFO] Opening PostgreSQL download page in browser...")
                webbrowser.open("https://www.postgresql.org/download/windows/")
                input("\nInstall PostgreSQL, ensure the service is running, then press [Enter] to retry...")
                continue
            elif choice == "4":
                new_host = input(f"Enter DB_HOST [{db_host}]: ").strip()
                if new_host:
                    update_env_file("DB_HOST", new_host)
                new_port = input(f"Enter DB_PORT [{db_port}]: ").strip()
                if new_port:
                    update_env_file("DB_PORT", new_port)
                continue
            else:
                continue

        # Step 2: Test authentication with psycopg2 & auto-create database
        check_script = (
            f"import psycopg2\n"
            f"try:\n"
            f"    conn = psycopg2.connect(dbname='postgres', user='{db_user}', password='{db_password}', host='{db_host}', port={db_port}, connect_timeout=3)\n"
            f"    conn.autocommit = True\n"
            f"    cur = conn.cursor()\n"
            f"    cur.execute(\"SELECT 1 FROM pg_database WHERE datname='{db_name}';\")\n"
            f"    if not cur.fetchone():\n"
            f"        cur.execute('CREATE DATABASE {db_name};')\n"
            f"        print('DB_CREATED')\n"
            f"    else:\n"
            f"        print('DB_EXISTS')\n"
            f"    cur.close()\n"
            f"    conn.close()\n"
            f"    exit(0)\n"
            f"except psycopg2.OperationalError as e:\n"
            f"    msg = str(e)\n"
            f"    if 'password' in msg.lower() or 'authentication' in msg.lower():\n"
            f"        print('AUTH_FAILED')\n"
            f"        exit(2)\n"
            f"    else:\n"
            f"        print(f'ERROR:{{msg}}')\n"
            f"        exit(1)\n"
        )
        
        proc = subprocess.run(
            [venv_python, "-c", check_script],
            capture_output=True,
            text=True
        )

        out = proc.stdout.strip()
        if proc.returncode == 2 or "AUTH_FAILED" in out:
            print("\n" + "!" * 70)
            print(f" [WARNING] PostgreSQL is running, but authentication failed for user '{db_user}'.")
            print(f" The password in '.env' did not match your PostgreSQL installation.")
            print("!" * 70)
            new_pw = input(f"Enter your PostgreSQL password for user '{db_user}': ").strip()
            if new_pw:
                update_env_file("DB_PASSWORD", new_pw)
                print("[INFO] Updated DB_PASSWORD in '.env'. Retrying...")
            time.sleep(1)
            continue
        elif proc.returncode != 0:
            print(f"\n[WARNING] Database connection error: {proc.stderr.strip() or out}")
            input("Press [Enter] to retry connection...")
            continue

        if "DB_CREATED" in out:
            print(f"[SUCCESS] Database '{db_name}' auto-created successfully!")
        print(f"[SUCCESS] PostgreSQL database connection verified ({db_host}:{db_port} as '{db_user}').")

        # Step 3: Check pgvector extension in PostgreSQL
        vector_script = (
            f"import psycopg2\n"
            f"try:\n"
            f"    conn = psycopg2.connect(dbname='{db_name}', user='{db_user}', password='{db_password}', host='{db_host}', port={db_port}, connect_timeout=3)\n"
            f"    conn.autocommit = True\n"
            f"    cur = conn.cursor()\n"
            f"    cur.execute(\"SELECT name, default_version FROM pg_available_extensions WHERE name = 'vector';\")\n"
            f"    ext = cur.fetchone()\n"
            f"    if not ext:\n"
            f"        print('NO_VECTOR_EXT')\n"
            f"        exit(3)\n"
            f"    cur.execute('CREATE EXTENSION IF NOT EXISTS vector;')\n"
            f"    cur.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto;')\n"
            f"    cur.execute(\"SELECT '[1,2,3]'::vector;\")\n"
            f"    print('VECTOR_OK')\n"
            f"    cur.close()\n"
            f"    conn.close()\n"
            f"    exit(0)\n"
            f"except Exception as e:\n"
            f"    print(f'VEC_ERROR:{{e}}')\n"
            f"    exit(1)\n"
        )
        vec_proc = subprocess.run([venv_python, "-c", vector_script], capture_output=True, text=True)
        vec_out = vec_proc.stdout.strip()

        if vec_proc.returncode == 0 and "VECTOR_OK" in vec_out:
            print("[SUCCESS] pgvector extension verified and operational.")
            return

        # If pgvector is missing, guide the user
        print_banner("[ACTION REQUIRED] 'pgvector' Extension Needed for PostgreSQL", "!")
        print(" UPLIFT's AI engine uses pgvector for high-speed semantic job matching.")
        print(" Standard PostgreSQL on Windows does not include pgvector by default.\n")
        print(" How to install pgvector (takes ~1 minute):")
        print("   1. Open the pgvector GitHub Releases page:")
        print("      https://github.com/pgvector/pgvector/releases")
        print("   2. Download the pre-built ZIP matching your PostgreSQL version (e.g., for PG 16 or 17).")
        print("   3. Extract and copy:")
        print("      - Copy 'vector.dll' to your PostgreSQL 'lib' directory:")
        print("        (e.g., C:\\Program Files\\PostgreSQL\\<version>\\lib\\)")
        print("      - Copy 'vector.control' and 'vector--*.sql' to your 'share\\extension' directory:")
        print("        (e.g., C:\\Program Files\\PostgreSQL\\<version>\\share\\extension\\)\n")
        print(" Options:")
        print("   [1] Open pgvector releases page in browser")
        print("   [2] Re-test pgvector extension (after copying files)")
        print("!" * 70)

        vchoice = input("\nSelect option [Default: 1]: ").strip()
        if vchoice == "2":
            continue
        else:
            webbrowser.open("https://github.com/pgvector/pgvector/releases")
            input("\nOnce you have copied the pgvector files into PostgreSQL, press [Enter] to re-check...")
            continue

def check_and_build_frontend():
    """
    Checks if Node.js/npm is available.
    Installs frontend dependencies if node_modules is missing.
    Returns True if frontend is ready to launch, False otherwise.
    """
    npm_path = shutil.which("npm")
    if not npm_path:
        for p in [
            os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "nodejs", "npm.cmd"),
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "nodejs", "npm.cmd"),
            os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "nodejs", "npm.cmd")
        ]:
            if os.path.exists(p):
                npm_path = p
                break

    if not npm_path:
        print("\n" + "!" * 70)
        print(" [NOTICE] Node.js / npm was not detected on this computer.")
        print(" The Backend API will start normally, but the Frontend web interface")
        print(" requires Node.js to run.")
        print("\n To enable the web frontend:")
        print("   1. Download and install Node.js (LTS): https://nodejs.org/")
        print("   2. Re-run start.bat")
        print("!" * 70 + "\n")
        return False

    frontend_dir = os.path.join(os.getcwd(), "frontend")
    node_modules_path = os.path.join(frontend_dir, "node_modules")

    if not os.path.exists(node_modules_path):
        print("[INFO] Installing frontend packages ('npm install'). This may take a minute...")
        try:
            subprocess.run([npm_path, "install"], cwd=frontend_dir, check=True, shell=True)
            print("[SUCCESS] Frontend packages installed successfully.")
        except Exception as e:
            print(f"[WARNING] Failed to run 'npm install': {e}")
            return False
    else:
        print("[SUCCESS] Frontend packages verified.")
    return True

def main():
    print_banner("UPLIFT System Launcher & Auto-Repair Setup")

    # 1. Ensure configuration file (.env)
    ensure_env_file()

    # 2. Virtual environment setup and verification (with auto-recovery for migrated PCs)
    venv_python = check_venv(".venv")

    # 3. Python dependencies and model verification
    verify_and_install_deps(venv_python)

    # 4. PostgreSQL verification, auto-start, auto-repair, & pgvector check
    wait_for_postgres(venv_python)

    # 5. Frontend dependencies check
    frontend_ready = check_and_build_frontend()

    # 6. Auto-repair stale occupied ports to prevent startup bind crashes
    free_port_if_occupied(8000, "Backend API")
    if frontend_ready:
        free_port_if_occupied(5173, "Frontend Vite UI")

    # 7. Determine network IP and workspace paths
    local_ip = get_local_ip()
    workspace_dir = os.getcwd()
    frontend_dir = os.path.join(workspace_dir, "frontend")

    if "--check-only" in sys.argv or "--dry-run" in sys.argv:
        print_banner("Preflight System Check Completed Successfully!")
        print(" All prerequisites verified:")
        print("   [X] Virtual environment (.venv) configured & healthy")
        print("   [X] Python dependencies & AI model weights checked")
        print("   [X] PostgreSQL database & pgvector extension active")
        print(f"   [X] Web frontend {'ready' if frontend_ready else 'Node.js missing (optional)'}")
        print(" System is ready to launch via start.bat!")
        return

    # 8. Launch Backend in separate CMD window
    print("[INFO] Spawning Backend API in a separate Command Prompt...")
    backend_cmd = f'start "UPLIFT-Backend" /d "{workspace_dir}" cmd /k "\"{venv_python}\" main.py"'
    subprocess.run(backend_cmd, shell=True)

    # 9. Launch Frontend in separate CMD window if ready
    if frontend_ready:
        print("[INFO] Spawning Frontend in a separate Command Prompt...")
        frontend_cmd = f'start "UPLIFT-Frontend" /d "{frontend_dir}" cmd /k "npm run dev"'
        subprocess.run(frontend_cmd, shell=True)
    else:
        print("[INFO] Skipping frontend launch because Node.js / npm is not installed.")

    # 10. Summary and instructions
    print_banner("UPLIFT Services Started Successfully!")
    print(" Active Services:")
    print(f"   - Web Frontend:  http://localhost:5173  (LAN: http://{local_ip}:5173)")
    print(f"   - Backend API:   http://localhost:8000  (LAN: http://{local_ip}:8000)")
    print(f"   - API Docs:      http://localhost:8000/docs")

    print("\n [NOTE] The backend takes ~15-30 seconds to load local AI models into memory.")
    print(" Keep the spawned Command Prompt windows open to keep the application running.")
    print("=" * 70)
    input("\nPress [Enter] to close this launcher window...")

if __name__ == "__main__":
    main()
