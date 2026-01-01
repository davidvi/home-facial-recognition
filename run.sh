#!/bin/bash

# Face Recognition Server Startup Script

echo "Starting Face Recognition Server..."

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "Creating virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing dependencies..."
    pip install -r requirements.txt
    cd ..
fi

# Activate virtual environment
echo "Activating virtual environment..."
source backend/venv/bin/activate

# Check if frontend is built
if [ ! -d "backend/static" ] || [ ! -f "backend/static/index.html" ]; then
    echo "Building React frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

# Start the server
echo "Starting FastAPI server..."
cd backend
python -m app.main

