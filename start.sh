#!/bin/bash

# Copy source files to the correct location
cp -r src/* ./

# Start the Flask server
cd frontend && python api_server.py
