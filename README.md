QueueCTL - Background Job Queue CLI

QueueCTL is a command-line background job queue system built in Node.js.
It allows users to enqueue background jobs, process them with multiple workers, retry failed jobs using exponential backoff, and manage a Dead Letter Queue (DLQ) for permanently failed jobs.
Language: Node.js (ES Modules)

Database: SQLite (via sqlite and sqlite3)

CLI Framework: Commander.js

Persistence: Local SQLite file (queuectl.db)



1. Setup Instructions

Clone the repository (or download the files).

git clone https://github.com/YOUR_USERNAME/QueueCTL.git
cd QueueCTL

Install Dependencies

npm install

Give Execute Permission (Mac/Linux)

chmod +x queuectl.js

Run a Clean Setup

rm -f queuectl.db config.json


2. Usage Examples

Enqueue a Job

./queuectl.js enqueue '{"id":"job1","command":"echo Hello QueueCTL"}'

Start Worker(s)

./queuectl.js worker --count 2

Check System Status

./queuectl.js status

Example Output

┌───────────┬───────┐
│ state     │ count │
├───────────┼───────┤
│ completed │ 1     │
│ dead      │ 0     │
│ pending   │ 0     │
└───────────┴───────┘

List Jobs

./queuectl.js list --state completed

Dead Letter Queue

./queuectl.js dlq --list
./queuectl.js dlq --retry job3

Configuration

./queuectl.js config --show
./queuectl.js config:set maxRetries 5



3. Architecture Overview

Job Lifecycle

pending → processing → completed / failed → dead (DLQ)

Components
	•	Jobs: Stored in a SQLite database (queuectl.db)
	•	Workers: Execute jobs concurrently based on commands
	•	Retry Mechanism: Retries failed jobs with exponential backoff
(delay = base^attempts seconds)
	•	DLQ: Stores permanently failed jobs for manual retry
	•	Config File: Stores settings like max retries and backoff base

⸻

4. Assumptions & Trade-offs
	•	Uses SQLite for lightweight persistence (no external setup needed)
	•	No distributed job locking (intended for single-machine usage)
	•	CLI-based design for simplicity and easy local testing
	•	Focused on core requirements: enqueue, worker, retry, DLQ
	•	Configuration stored in a simple JSON file


5. Testing Instructions

Automated Test

Run the included test script:

bash test.sh

Manual Verification
	1.	Open Terminal A: enqueue jobs
	2.	Open Terminal B: start a worker (./queuectl.js worker)
	3.	Open Terminal C: run status, list, and dlq commands

Expected behavior:
	•	Successful jobs move to completed
	•	Failed jobs retry with exponential delay
	•	After max retries, they move to dead
	•	Retried DLQ jobs reappear as pending



Author: Ashutosh Rai
B.Tech, Mechanical Engineering, MNIT Jaipur
Submission for: Flam – Backend Developer Internship Assignment

