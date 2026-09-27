@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title UPLIFT System Setup and Auto-Repair Launcher
cd /d "%~dp0"

echo =======================================================================
echo   UPLIFT - Universal System Setup, Auto-Repair and Startup
echo =======================================================================

:detect_python
set "PYTHON_EXE="

rem 1. Check py launcher with specific 3.11 / 3.12 / 3.10 versions
for %%v in (-3.11 -3.12 -3.10 -3) do (
    py %%v -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=py %%v"
        goto :python_found
    )
)

rem 2. Check general 'py' command
py -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py"
    goto :python_found
)

rem 3. Check 'python' command (ensuring it is not a Windows Store dummy alias)
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    goto :python_found
)

rem 4. Check 'python3' command
python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python3"
    goto :python_found
)

rem 5. Check common installation directories
for %%v in (312 311 310 313) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe" (
        "%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe"
            goto :python_found
        )
    )
    if exist "C:\Python%%v\python.exe" (
        "C:\Python%%v\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_EXE=C:\Python%%v\python.exe"
            goto :python_found
        )
    )
    if exist "%ProgramFiles%\Python%%v\python.exe" (
        "%ProgramFiles%\Python%%v\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_EXE=%ProgramFiles%\Python%%v\python.exe"
            goto :python_found
        )
    )
)

:python_not_found
echo.
echo =======================================================================
echo   [!] Python v3.10 or higher was not detected on this system.
echo =======================================================================
echo   UPLIFT requires Python 3.10 - 3.12 to run its AI services and API.
echo.

where winget >nul 2>&1
if %errorlevel% equ 0 (
    echo   [AUTO-REPAIR AVAILABLE]
    echo   Windows Package Manager winget is detected on your PC!
    echo.
    echo   [1] Automatically install Python 3.11 now via winget - Recommended
    echo   [2] Open Python official download page in browser
    echo   [3] Exit
    echo.
    set "CHOICE_PY=1"
    set /p "CHOICE_PY=Select an option [Default: 1]: "
    if "!CHOICE_PY!"=="1" goto :install_python_winget
    if "!CHOICE_PY!"=="2" goto :open_python_browser
    exit /b 1
) else (
    goto :open_python_browser
)

:install_python_winget
echo.
echo [INFO] Installing Python 3.11 via Windows Package Manager...
echo Please accept any Windows UAC administrator prompt if it appears.
echo.
winget install Python.Python.3.11 -e --scope currentuser --accept-package-agreements --accept-source-agreements
if %errorlevel% neq 0 (
    echo [WARNING] Winget installation encountered an issue or was cancelled.
    goto :open_python_browser
)
echo [SUCCESS] Python 3.11 installation completed!
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=!PATH!;%%b"
goto :detect_python

:open_python_browser
echo.
echo [INFO] Opening official Python 3.11 download page in your browser...
start https://www.python.org/downloads/release/python-3119/
echo.
echo =======================================================================
echo   MANUAL INSTALLATION GUIDE:
echo   1. Run the downloaded installer python-3.11.x-amd64.exe.
echo   2. *** CRITICAL STEP ***:
echo      At the very bottom of the installer window, check the box:
echo      [X] "Add python.exe to PATH"
echo   3. Click "Install Now".
echo   4. Once installation finishes, press any key below to continue.
echo =======================================================================
echo.
pause
goto :detect_python

:python_found
echo [SUCCESS] Detected Host Python: %PYTHON_EXE%

rem -----------------------------------------------------------------------
rem Check Node.js and npm (Required for web frontend)
rem -----------------------------------------------------------------------
set "NODE_OK=0"
where npm >nul 2>&1
if %errorlevel% equ 0 set "NODE_OK=1"
if exist "%ProgramFiles%\nodejs\npm.cmd" (
    set "NODE_OK=1"
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
)
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
    set "NODE_OK=1"
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\nodejs"
)

if "!NODE_OK!"=="0" (
    echo.
    echo -----------------------------------------------------------------------
    echo   [NOTICE] Node.js and npm were not detected on this PC.
    echo   The Backend API will work, but the Web Frontend requires Node.js.
    echo -----------------------------------------------------------------------
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        echo.
        set "INSTALL_NODE=Y"
        set /p "INSTALL_NODE=Would you like to install Node.js LTS now via winget? [Y/n]: "
        if /i "!INSTALL_NODE!"=="" set "INSTALL_NODE=Y"
        if /i "!INSTALL_NODE!"=="Y" (
            echo [INFO] Installing Node.js LTS via winget...
            winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
            if !errorlevel! equ 0 (
                echo [SUCCESS] Node.js installed! Updating session PATH...
                set "PATH=%PATH%;%ProgramFiles%\nodejs;%APPDATA%\npm"
            )
        )
    ) else (
        echo Node.js LTS can be downloaded from: https://nodejs.org/
    )
    echo -----------------------------------------------------------------------
)

rem -----------------------------------------------------------------------
rem Launch Dynamic Setup and Startup Python Script
rem -----------------------------------------------------------------------
echo.
echo [INFO] Launching setup_and_start.py...
echo =======================================================================
%PYTHON_EXE% setup_and_start.py %*
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
