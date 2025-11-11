# QueueCTL - Background Job Queue System (Node.js CLI)

QueueCTL is a CLI-based background job queue system built in Node.js and SQLite.

It allows you to enqueue background jobs, process them using multiple workers, retry failed jobs with exponential backoff, and manage a Dead Letter Queue (DLQ) for permanently failed jobs.

  * **Language**: Node.js (ES Modules)
  * **Database**: SQLite (via `sqlite` and `sqlite3`)
  * **CLI Framework**: Commander.js
  * **Persistence**: Local SQLite file (`queuectl.db`)

-----

## 1\. Setup Instructions

1.  **Clone the repository (or download the files).**

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Make the script executable (for Mac/Linux):**

    ```bash
    chmod +x queuectl.js
    ```

4.  **(Optional) Initialize a fresh database:**

    ```bash
    rm -f queuectl.db
    ```

-----

## 2\. Usage Examples

All commands are run using the `queuectl.js` script.

### 🔹 Enqueue a job

Jobs are enqueued in JSON format. The `command` field is required.

```bash
./queuectl.js enqueue '{"id":"job1","command":"echo Hello QueueCTL"}'
```

**Output:**

```
Enqueued: job1
```

### 🔹 Start worker(s)

You can run a single worker or multiple parallel workers using the `--count` flag.

```bash
./queuectl.js worker --count 2
```

**Output:**

```
👷 Worker started and waiting for jobs...
👷 Worker started and waiting for jobs...
➡️  Processing job job1: echo Hello QueueCTL
✅ Completed job job1
```

### 🔹 Check system status

Get a quick overview of all jobs grouped by their state.

```bash
./queuectl.js status
```



### 🔹 List jobs

List all jobs, or filter by a specific state.

```bash
./queuectl.js list --state completed
```

### 🔹 Manage the Dead Letter Queue (DLQ)

Jobs that fail more than `max_retries` (default 3) are moved to the `dead` state.

**List all dead jobs:**

```bash
./queuectl.js dlq --list
```

**Retry a specific dead job:**
This moves the job back to `pending` and resets its attempts.

```bash
./queuectl.js dlq --retry <job-id>
```

### 🔹 Configuration Management

The system can be configured via a `config.json` file.

**Show current config:**

```bash
./queuectl.js config --show
```

**Set a config value (e.g., max retries):**

```bash
./queuectl.js config:set maxRetries 5
```

-----

## 3\. Architecture Overview

### 🔹 Job Lifecycle

A job passes through the following states:

| State | Description |
| :--- | :--- |
| **pending** | Waiting to be picked up by a worker. |
| **processing** | Currently being executed by a worker. |
| **completed** | Successfully executed and finished. |
| **failed** | Failed, but will be retried. |
| **dead** | Permanently failed after exceeding `max_retries` (moved to DLQ). |

### 🔹 Data Persistence

All job data is stored persistently in a single SQLite database file (`queuectl.db`) created in the same directory. The `jobs` table holds the job's command, state, attempts, and output.

### 🔹 Worker Logic

  * Workers continuously poll the database for any job in the `pending` state.
  * When a job is found, it is atomically updated to `processing` to "lock" it.
  * The worker executes the job's `command` using a child process.
      * **On Success**: The job state is set to `completed` and the `output` is saved.
      * **On Failure**: The job's `attempts` counter is incremented.
          * If `attempts` \> `max_retries`, the state is set to `dead`.
          * Otherwise, the state is set to `failed`.

### 🔹 Exponential Backoff

When a job fails and is marked for retry, the worker applies an exponential backoff delay before the *next* retry attempt (it doesn't delay the current worker, but the failed job won't be picked up again immediately).

The delay is calculated as: `delay = (base ^ attempts) * 1000` (in milliseconds).

With a default base of 2, the delays are:

  * Attempt 1: 2s
  * Attempt 2: 4s
  * Attempt 3: 8s

-----


## Retry and Dead Letter Queue (DLQ) Logic

Each worker follows a robust retry flow with exponential backoff and a Dead Letter Queue (DLQ) for permanently failed jobs.

Job Retry Workflow
	1.	When a job fails (non-zero exit code or invalid command), it moves to the failed state.
	2.	The system applies exponential backoff before retrying:

delay = base ^ attempts * 1000 ms

Example (with base = 2): 2s → 4s → 8s.

	3.	After the delay, the worker automatically requeues the job by setting its state back to pending.
	4.	The worker picks it up again and retries execution.
	5.	This continues until the maxRetries value is reached.


  Dead Letter Queue Handling
	•	Once the number of attempts exceeds maxRetries, the job is marked as dead and moved to the DLQ.
	•	DLQ jobs are no longer retried automatically.
	•	They can be listed or retried manually using CLI commands:

./queuectl.js dlq --list      # View all dead jobs
./queuectl.js dlq --retry <id> # Move a dead job back to pending

When moved back to pending, the job can be picked up by a worker again.



Retry Safety Check

To prevent infinite retry loops, each worker checks the job’s state after each failure:

const updated = await db.get("SELECT state FROM jobs WHERE id=?", job.id);
if (updated.state === "dead") {
  console.log(`💀 Job ${job.id} moved to DLQ, stopping retries.`);
  continue; // stop retrying this job
}

This ensures that once a job is dead, it will never be retried again automatically.



Example Retry Flow

Attempt	State Change	Delay	Outcome
1	pending → processing → failed	2s	Retry scheduled
2	failed → pending → processing → failed	4s	Retry scheduled
3	failed → pending → processing → failed	8s	Moved to DLQ
-	dead	—	Retry manually via DLQ




Configurable Behavior

Both retry limit and backoff delay are configurable via the CLI:

./queuectl.js config:set maxRetries 5
./queuectl.js config:set backoffBase 3

Stored in config.json, these values make the system fully flexible — no hardcoded configuration values.



 Result:
This design guarantees:
	•	Safe job retry handling
	•	No infinite loops
	•	Persistent DLQ tracking
	•	Configurable retry behavior
 -----

## 4\. Assumptions & Trade-offs

| Design Choice | Reason |
| :--- | :--- |
| **SQLite** | Lightweight, persistent, and requires no external database server, making setup simple. |
| **No Job Priority** | Kept the design simple by processing jobs in a First-In, First-Out (FIFO) manner. |
| **CLI-based Design** | Easy to test, portable, and scriptable. |
| **Single-Host Parallelism** | The worker polling mechanism is simple and effective for parallel processing on a single machine. It is not designed for distributed locking across multiple hosts. |
| **File-based Config** | Using a `config.json` file is simple for a local CLI tool. |

-----

## 5\. Testing Instructions

An automated test script (`test.sh`) is included to verify core functionality. It will:

1.  Clear the old database.
2.  Enqueue a successful job (`echo Hello`).
3.  Enqueue a job designed to fail (`bash -c "exit 1"`).
4.  Run a worker in the background.
5.  Wait 3 seconds for processing, then stop the worker.
6.  Print the final status, showing 1 completed and 1 failed job.

**Run the test script:**

```bash
bash test.sh
```

**Expected Output:**

```
Enqueued: job-16...
Enqueued: job-16...
 Worker started and waiting for jobs...
 Processing job job-16...: echo Hello
Completed job job-16...
Processing job job-16...: bash -c "exit 1"
Failed job job-16...: Retrying job job-16... after 2000ms...
```


## 🎥 Demo Video

Watch the working demo here: [QueueCTL CLI Demo - Google Drive]-  https://drive.google.com/drive/folders/1mfeHwYyxHroSsP5G97igk8xZSWbjYzn1?usp=drive_link


