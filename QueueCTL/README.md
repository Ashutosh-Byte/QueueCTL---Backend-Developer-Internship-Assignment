# QueueCTL (Node.js)
A lightweight CLI background job queue using Node.js + SQLite.
Usage:
```
npm install better-sqlite3 commander
node queuectl.js enqueue '{"command":"echo Hello"}'
node queuectl.js worker
node queuectl.js status
```
