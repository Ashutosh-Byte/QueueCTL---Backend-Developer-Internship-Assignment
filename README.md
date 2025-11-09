# QueueCTL---Backend-Developer-Internship-Assignment

Perfect, Ashu 💪 — here’s a ready-to-paste, professional README.md that checks every box from Flam’s assignment instructions exactly and will look clean on GitHub.

You can copy this whole thing and paste it into your README.md file directly. 👇

⸻

🚀 QueueCTL - Background Job Queue System (Node.js CLI)

QueueCTL is a CLI-based background job queue system built in Node.js.
It allows you to enqueue background jobs, process them using multiple workers, retry failed jobs with exponential backoff, and manage a Dead Letter Queue (DLQ) for permanently failed jobs.

⸻

⚙️ Tech Stack
	•	Language: Node.js (ES Modules)
	•	Database: SQLite (via sqlite3)
	•	CLI Framework: Commander.js
	•	Persistence: Local SQLite file (queuectl.db)

⸻

🧩 Features

✅ Enqueue jobs via CLI
✅ Persistent job storage
✅ Multiple parallel workers
✅ Retry mechanism with exponential backoff
✅ Dead Letter Queue (DLQ) for failed jobs
✅ Configuration management (config.json)
✅ Graceful worker shutdown
✅ Simple testing script (test.sh)

⸻

🧰 1. Setup Instructions

🔹 Clone the repository

git clone https://github.com/YOUR_USERNAME/QueueCTL.git
cd QueueCTL

🔹 Install dependencies

npm install

🔹 Give execution permission (for Mac/Linux)

chmod +x queuectl.js

🔹 Initialize fresh database

rm -f queuectl.db


⸻

💻 2. Usage Examples

🔹 Enqueue a job

./queuectl.js enqueue '{"id":"job1","command":"echo Hello QueueCTL"}'

Output:

Enqueued: job1


⸻

🔹 Start worker(s)

./queuectl.js worker --count 2

Output:

👷 Started worker #1 (PID 2012)
👷 Started worker #2 (PID 2013)
➡️  Processing job job1: echo Hello QueueCTL
✅ Completed job job1


⸻

🔹 Check system status

./queuectl.js status

Output:

┌───────────┬───────┐
│ state     │ count │
├───────────┼───────┤
│ completed │ 1     │
│ dead      │ 0     │
│ pending   │ 0     │
└───────────┴───────┘


⸻

🔹 List jobs by state

./queuectl.js list --state completed


⸻

🔹 Dead Letter Queue

List all failed (dead) jobs:

./queuectl.js dlq --list

Retry a failed job:

./queuectl.js dlq --retry job3


⸻

🔹 Configuration Management

Show current config:

./queuectl.js config --show

Set max retries:

./queuectl.js config:set maxRetries 5


⸻

🏗️ 3. Architecture Overview

🔹 Job Lifecycle

A job passes through the following states:

State	Description
pending	Waiting to be picked by a worker
processing	Currently being executed
completed	Successfully executed
failed	Failed, but retryable
dead	Permanently failed (moved to DLQ)


⸻

🔹 System Components

Component	Description
queuectl.js	Main CLI file controlling enqueue, workers, DLQ, and config
SQLite Database	Stores all job data persistently
Workers	Independent processes that execute jobs concurrently
Config File (config.json)	Stores retry and backoff parameters
DLQ	Stores permanently failed jobs for later inspection or retry


⸻

🔹 Exponential Backoff Logic

Each failed job is retried after:

delay = base ^ attempts (in seconds)

Example: for base=2 → delays are 2s, 4s, 8s, etc.

⸻

🔹 Worker Management
	•	Multiple workers can be started with --count.
	•	Each worker picks one pending job at a time.
	•	Graceful shutdown ensures current job finishes before exit.

⸻

⚖️ 4. Assumptions & Trade-offs

Design Choice	Reason
SQLite	Lightweight, persistent, no external setup required
No job priority/scheduling	Simplified to core requirements
CLI-based design	Easier to test and portable
No job locking across distributed systems	Focused on single-host parallelism
File-based config	Keeps it simple for local testing


⸻

🧪 5. Testing Instructions

🔹 Run Automated Test Script

You can use the included test file:

bash test.sh

Expected Output:

🧪 Starting QueueCTL Test...
Enqueued: job1
👷 Worker started and waiting for jobs...
✅ Completed job job1
❌ Failed job job2 (retries applied)
Job moved to DLQ after max retries
✅ All core flows tested successfully!


⸻

🔹 Manual Verification

In three terminals:
	1.	Terminal A: Enqueue jobs
	2.	Terminal B: Start worker
	3.	Terminal C: Monitor with status, list, and dlq

⸻

📂 Project Structure

QueueCTL/
├── queuectl.js         # Main CLI file
├── package.json        # Project metadata and dependencies
├── package-lock.json   # Dependency lock file
├── README.md           # Documentation
├── test.sh             # Testing script
└── .gitignore          # Ignore files like node_modules/ and queuectl.db


⸻

🌟 Future Enhancements (Bonus Ideas)
	•	Job scheduling (run_at)
	•	Job prioritization
	•	Job timeout handling
	•	Execution logs per job
	•	Basic web dashboard for monitoring

⸻

🧑‍💻 Author

Ashu
B.Tech, Mechanical Engineering — MNIT Jaipur
(Developed for Flam Backend Developer Internship Assignment)

⸻

Would you like me to generate a clean test.sh script to go along with this README (matching exactly what’s mentioned under “Testing Instructions”)?
