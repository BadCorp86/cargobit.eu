#!/bin/bash
# CargoBit Cloudflare Tunnel Starter
# Run this script to start both the Next.js server and Cloudflare tunnel

cd /home/z/my-project

# Kill any existing processes
pkill -f cloudflared 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2

echo "=========================================="
echo "  CargoBit - Cloudflare Tunnel Starter"
echo "=========================================="
echo ""

# Start Next.js server
echo "Starting Next.js server..."
HOSTNAME=0.0.0.0 node node_modules/.bin/next dev -p 3000 &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server..."
for i in {1..30}; do
    if curl -s -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
        echo "✓ Server is ready!"
        break
    fi
    sleep 1
done

echo ""
echo "Starting Cloudflare tunnel..."
echo ""

# Start cloudflared and show output
./bin/cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate --protocol http2 2>&1

# If tunnel exits, wait for server
wait $SERVER_PID
