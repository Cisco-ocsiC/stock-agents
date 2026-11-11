@echo off
cd /d "%~dp0"
echo Starting Stock Agents API server on port 8766 ...
echo Open http://localhost:8766 in your browser
echo Press Ctrl+C to stop
node server.js
pause
