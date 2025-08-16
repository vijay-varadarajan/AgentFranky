# Deployment Configuration

## Backend (Render)

### Build Command:
```bash
pip install -r requirements.txt
```

### Start Command:
```bash
python api_server.py
```

### Environment Variables:
- `FLASK_ENV=production`
- `PORT=10000` (or whatever Render assigns)
- `GOOGLE_API_KEY=your_api_key`
- `TAVILY_API_KEY=your_api_key`
- `LANGSMITH_API_KEY=your_api_key` (optional)

### Required Files:
- `requirements.txt` - Dependencies
- `api_server.py` - Main application
- `Procfile` - Process configuration (optional)
- `wsgi.py` - WSGI entry point (alternative)

## Frontend (Vercel)

### Build Command:
```bash
npm run build
```

### Output Directory:
```
build
```

### Environment Variables:
- `REACT_APP_API_URL=https://your-render-backend.onrender.com`

## WebSocket Configuration

The backend now includes:
- Flask-SocketIO for WebSocket support
- CORS configuration for cross-origin requests
- Production-ready error handling
- Health check endpoints

## Troubleshooting

1. **WebSocket 404 errors**: Check that SocketIO is properly configured
2. **CORS issues**: Verify frontend domain is in CORS_ALLOWED_ORIGINS
3. **Port binding**: Ensure PORT environment variable is set correctly
4. **Dependencies**: Check all packages are in requirements.txt
