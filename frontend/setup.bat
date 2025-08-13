@echo off
REM Research Assistant Frontend Setup Script for Windows

echo 🔬 AI Research Assistant - Frontend Setup
echo ==========================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python from https://python.org/
    pause
    exit /b 1
)

echo ✅ Prerequisites found

REM Install backend dependencies
echo 📦 Installing backend dependencies...
pip install -r requirements.txt

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
npm install

echo.
echo 🎉 Setup complete!
echo.
echo To start the application:
echo 1. Start the backend API server:
echo    python api_server.py
echo.
echo 2. In a new terminal, start the frontend:
echo    npm start
echo.
echo The application will be available at http://localhost:3000
echo The API will be available at http://localhost:5000
echo.
pause
