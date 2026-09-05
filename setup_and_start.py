import os
import sys
import subprocess
import socket
import time
import shutil
import re

def print_banner(text):
    print("\n" + "=" * 65)
    print(f"  {text}")
    print("=" * 65 + "\n")

def read_env_file():
    """Reads .env variables into a dictionary without requiring external packages."""
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
                "# PostgreSQL Database Configuration\n"
                "DB_USER=postgres\n"
                "DB_PASSWORD=yuichirokanade\n"
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
    os.environ[key] = value

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def check_venv(venv_path=".venv"):
    """
    Validates the local virtual environment.
    If .venv is missing, broken, or copied from another machine with invalid paths,
    it automatically cleans up and creates a fresh virtual environment.
    """
    python_exe = os.path.join(venv_path, "Scripts", "python.exe")
    is_valid = False
    
    if os.path.exists(python_exe):
        try:
            # Test executing code inside the virtual environment
            test_res = subprocess.run(
                [python_exe, "-c", "import sys; sys.exit(0)"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=8
            )
            if test_res.returncode == 0:
                is_valid = True
        except Exception:
            is_valid = False

    if not is_valid:
        if os.path.exists(venv_path):
            print(f"[WARNING] Existing virtual environment at '{venv_path}' is corrupted or copied from another PC.")
            print("[INFO] Rebuilding clean virtual environment for this PC...")
            try:
                shutil.rmtree(venv_path, ignore_errors=True)
            except Exception as e:
                print(f"[WARNING] Could not fully remove old .venv directory: {e}")
        else:
            print("[INFO] Creating virtual environment (.venv)...")
            
        subprocess.run([sys.executable, "-m", "venv", venv_path], check=True)
        python_exe = os.path.join(venv_path, "Scripts", "python.exe")
        print("[SUCCESS] Virtual environment ready.")
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
        "    import sentence_transformers, pydparser, spacy, nltk, rendercv, dotenv\n"
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
        print(f"[INFO] Missing or incomplete dependency: {chk_proc.stdout.strip()}")

    if missing_deps:
        print_banner("Installing / Updating Dependencies in .venv")
        print("[INFO] Upgrading pip, setuptools (<82), and wheel...")
        subprocess.run([venv_python, "-m", "pip", "install", "--upgrade", "pip", "setuptools<82", "wheel"], check=False)
        
        print("[INFO] Installing dependencies from requirements.txt...")
        req_path = os.path.join(os.getcwd(), "requirements.txt")
        subprocess.run([venv_python, "-m", "pip", "install", "-r", req_path], check=True)
        print("[SUCCESS] Dependencies installed.")
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
        subprocess.run([venv_python, "-m", "pip", "install", whl_url], check=False)

    # 2. Verify NLTK corpora for pydparser
    try:
        subprocess.run(
            [venv_python, "-c", "import nltk; nltk.data.find('corpora/stopwords'); nltk.data.find('corpora/words')"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
    except subprocess.CalledProcessError:
        print("[INFO] Downloading required NLTK corpora (stopwords, words)...")
        subprocess.run(
            [venv_python, "-c", "import nltk; nltk.download('stopwords'); nltk.download('words')"],
            check=False
        )

def wait_for_postgres(venv_python):
    """
    Verifies PostgreSQL port and authentication.
    If port is closed, guides the user.
    If authentication fails, offers interactive password prompt and updates .env.
    Auto-creates the 'uplift' database if it doesn't exist yet.
    """
    while True:
        env_vars = read_env_file()
        db_user = env_vars.get("DB_USER", os.getenv("DB_USER", "postgres"))
        db_password = env_vars.get("DB_PASSWORD", os.getenv("DB_PASSWORD", "yuichirokanade"))
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
            print("\n" + "!" * 70)
            print(f" [WARNING] PostgreSQL service is unreachable on {db_host}:{db_port}.")
            print(" UPLIFT requires a local PostgreSQL instance to store data & vector embeddings.")
            print("\n Please ensure that:")
            print("   1. PostgreSQL is installed on this PC.")
            print("      Download: https://www.postgresql.org/download/windows/")
            print("   2. The PostgreSQL service is started (open Services app or run 'net start postgresql').")
            print("!" * 70 + "\n")
            input("Press [Enter] once you have started PostgreSQL to retry...")
            continue

        # Step 2: Test authentication with psycopg2
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
        if proc.returncode == 0:
            if "DB_CREATED" in out:
                print(f"[SUCCESS] Database '{db_name}' auto-created successfully!")
            print(f"[SUCCESS] PostgreSQL database connection verified ({db_host}:{db_port} as '{db_user}').")
            return
        elif proc.returncode == 2 or "AUTH_FAILED" in out:
            print("\n" + "!" * 70)
            print(f" [WARNING] PostgreSQL is running, but authentication failed for user '{db_user}'.")
            print(f" The password in '.env' did not match your PostgreSQL installation.")
            print("!" * 70)
            new_pw = input(f"Enter the PostgreSQL password for user '{db_user}' (or press Enter to retry default): ").strip()
            if new_pw:
                update_env_file("DB_PASSWORD", new_pw)
                print("[INFO] Updated DB_PASSWORD in '.env'. Retrying...")
            time.sleep(1)
        else:
            print(f"\n[WARNING] Database check encountered an issue: {proc.stderr.strip() or out}")
            input("Press [Enter] to retry connection...")

def check_and_build_frontend():
    """
    Checks if Node.js/npm is available.
    Installs frontend dependencies if node_modules is missing.
    Returns True if frontend is ready to launch, False otherwise.
    """
    npm_path = shutil.which("npm")
    if not npm_path:
        # Also check common npm install path
        common_npm = os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "nodejs", "npm.cmd")
        if os.path.exists(common_npm):
            npm_path = common_npm

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
    print_banner("UPLIFT System Launcher & Environment Setup")

    # 1. Ensure configuration file (.env)
    ensure_env_file()

    # 2. Virtual environment setup and verification
    venv_python = check_venv(".venv")

    # 3. Python dependencies and model verification
    verify_and_install_deps(venv_python)

    # 4. PostgreSQL verification and auto-recovery
    wait_for_postgres(venv_python)

    # 5. Frontend dependencies check
    frontend_ready = check_and_build_frontend()

    # 6. Determine network IP and workspace paths
    local_ip = get_local_ip()
    workspace_dir = os.getcwd()
    frontend_dir = os.path.join(workspace_dir, "frontend")

    # 7. Launch Backend in separate CMD window
    print("[INFO] Spawning Backend API in a separate Command Prompt...")
    backend_cmd = f'start "UPLIFT-Backend" /d "{workspace_dir}" cmd /k "\"{venv_python}\" main.py"'
    subprocess.run(backend_cmd, shell=True)

    # 8. Launch Frontend in separate CMD window if ready
    if frontend_ready:
        print("[INFO] Spawning Frontend in a separate Command Prompt...")
        frontend_cmd = f'start "UPLIFT-Frontend" /d "{frontend_dir}" cmd /k "npm run dev"'
        subprocess.run(frontend_cmd, shell=True)
    else:
        print("[INFO] Skipping frontend launch because Node.js / npm is not installed.")

    # 9. Summary and instructions
    print_banner("UPLIFT Services Started Successfully!")
    print(" Active Services:")
    print(f"   - Backend API:   http://localhost:8000  (LAN: http://{local_ip}:8000)")
    print(f"   - API Docs:      http://localhost:8000/docs")
    if frontend_ready:
        print(f"   - Frontend Web:  http://localhost:5173  (LAN: http://{local_ip}:5173)")
    else:
        print("   - Frontend Web:  [Unavailable - install Node.js from https://nodejs.org/]")

    print("\n [NOTE] The backend takes ~15-30 seconds to load local AI models into memory.")
    print(" Keep the spawned Command Prompt windows open to keep the application running.")
    print("=" * 65)
    input("\nPress [Enter] to close this launcher window...")

if __name__ == "__main__":
    main()
