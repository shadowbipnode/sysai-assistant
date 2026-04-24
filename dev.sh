#!/bin/bash
# Avvia il proxy in background
node server.js &
PROXY_PID=$!

# Avvia Vite
npm run dev

# Alla chiusura, ferma il proxy
kill $PROXY_PID
