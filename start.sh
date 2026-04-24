#!/bin/bash

# Avvia il proxy in background
echo "🚀 Avvio proxy server..."
node server.js &
PROXY_PID=$!

# Aspetta che il proxy sia pronto
sleep 2

# Avvia Vite in background
echo "📦 Avvio Vite..."
npm run dev &
VITE_PID=$!

# Aspetta che Vite sia pronto
sleep 3

# Avvia Electron
echo "🖥️ Avvio Electron..."
NODE_ENV=development npx electron .

# Alla chiusura, ferma tutto
trap "kill $PROXY_PID $VITE_PID 2>/dev/null" EXIT
