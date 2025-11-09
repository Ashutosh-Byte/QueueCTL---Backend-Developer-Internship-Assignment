#!/usr/bin/env bash
set -e
rm -f queuectl.db
node queuectl.js enqueue '{"command":"echo Hello"}'
node queuectl.js enqueue '{"command":"bash -c \"exit 1\""}'
node queuectl.js worker &
PID=$!
sleep 3
kill -INT $PID || true
node queuectl.js status
