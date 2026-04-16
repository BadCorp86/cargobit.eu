#!/bin/bash
cd /home/z/my-project

# Start Next.js
HOSTNAME=0.0.0.0 node node_modules/.bin/next dev -p 3000 &
SERVER_PID=$!

# Wait for server
for i in {1..30}; do
    if curl -s -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
        break
    fi
    sleep 1
done

# Start cloudflared
./bin/cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate --protocol http2

# Wait for server
wait $SERVER_PID
