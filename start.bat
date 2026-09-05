@echo off
setlocal enabledelayedexpansion
title UPLIFT System Setup and Startup
cd /d "%~dp0"

echo =======================================================================
echo   UPLIFT - Universal System Setup and Startup
echo =======================================================================

rem -----------------------------------------------------------------------
rem 1. Dynamically Detect Python Executable (v3.10+)
rem -----------------------------------------------------------------------
set "PYTHON_EXE="

rem Check "py -3"
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py -3"
    goto :python_found
)

rem Check "py"
py -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py"
    goto :python_found
)

rem Check "python"
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    goto :python_found
)

rem Check "python3"
python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python3"
    goto :python_found
)

rem Check common local app data python paths
for %%v in (312 311 310) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe" (
        "%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
        if !errorlevel! equ 0 (
            set PYTHON_EXE="%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe"
            goto :python_found
        )
    )
    if exist "C:\Python%%v\python.exe" (
        "C:\Python%%v\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
        if !errorlevel! equ 0 (
            set PYTHON_EXE="C:\Python%%v\python.exe"
            goto :python_found
        )
    )
)

:python_not_found
echo.
echo =======================================================================
echo   [ERROR] Python (version 3.10 or higher) was not detected on your system.
echo.
echo   To fix this:
echo     1. Download Python: https://www.python.org/downloads/
echo     2. Run the installer and check the box:
echo        "[X] Add python.exe to PATH"
echo     3. Complete installation and re-run start.bat.
echo =======================================================================
echo.
pause
exit /b 1

:python_found
echo [INFO] Detected Host Python: %PYTHON_EXE%

rem -----------------------------------------------------------------------
rem 2. Check Node.js and npm (Optional warning for frontend)
rem -----------------------------------------------------------------------
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [NOTICE] 'npm' was not detected in PATH.
    echo Node.js is recommended to run the web frontend (https://nodejs.org/).
)

rem -----------------------------------------------------------------------
rem 3. Launch Dynamic Setup and Startup Script
rem -----------------------------------------------------------------------
echo [INFO] Launching setup_and_start.py...
%PYTHON_EXE% setup_and_start.py
if %errorlevel% neq 0 (
    echo.
    echo =======================================================================
    echo   [ERROR] UPLIFT setup or startup encountered an error.
    echo   Review the diagnostic messages above.
    echo =======================================================================
    echo.
    pause
    exit /b %errorlevel%
)
