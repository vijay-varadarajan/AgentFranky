#!/bin/bash

# Research Assistant Frontend Setup Script

echo "🔬 AI Research Assistant - Frontend Setup"
echo "=========================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Node.js is installed
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command_exists python; then
    echo "❌ Python is not installed. Please install Python from https://python.org/"
    exit 1
fi

echo "✅ Prerequisites found"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
pip install -r requirements.txt

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the application:"
echo "1. Start the backend API server:"
echo "   python api_server.py"
echo ""
echo "2. In a new terminal, start the frontend:"
echo "   npm start"
echo ""
echo "The application will be available at http://localhost:3000"
echo "The API will be available at http://localhost:5000"
