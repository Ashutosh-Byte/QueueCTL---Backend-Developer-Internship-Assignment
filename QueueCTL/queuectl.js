#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { Command } from "commander";

const DB_PATH = path.join(process.cwd(), "queuectl.db");
const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
const program = new Command();

await db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending','processing','completed','failed','dead')),
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  run_at TEXT NOT NULL,
  last_error TEXT,
  output TEXT
);
`);

function nowISO() {
  return new Date().toISOString();
}

async function enqueue(job) {
  const id = job.id || "job-" + Date.now();
  await db.run(
    "INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    job.command,
    "pending",
    0,
    3,
    nowISO(),
    nowISO(),
    nowISO(),
    null,
    null
  );
  console.log("Enqueued:", id);
}

async function nextJob() {
  const row = await db.get("SELECT * FROM jobs WHERE state='pending' LIMIT 1");
  if (row)
    await db.run("UPDATE jobs SET state='processing' WHERE id=?", row.id);
  return row;
}

async function complete(id, output) {
  await db.run(
    "UPDATE jobs SET state='completed', output=?, updated_at=? WHERE id=?",
    output,
    nowISO(),
    id
  );
}

async function fail(job, err) {
  const attempts = job.attempts + 1;

  if (attempts > job.max_retries) {
    await db.run(
      "UPDATE jobs SET state='dead', last_error=?, updated_at=? WHERE id=?",
      err,
      nowISO(),
      job.id
    );
    console.log(`Job ${job.id} moved to DLQ after ${attempts - 1} retries`);
  } else {
    await db.run(
      "UPDATE jobs SET state='failed', attempts=?, updated_at=? WHERE id=?",
      attempts,
      nowISO(),
      job.id
    );

    const delay = getBackoffDelay(attempts);
    console.log(`Retrying job ${job.id} after ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));

    await db.run(
      "UPDATE jobs SET state='pending', updated_at=? WHERE id=?",
      nowISO(),
      job.id
    );
  }
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, { shell: true });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (out += d.toString()));
    proc.on("close", (code) => (code === 0 ? resolve(out) : reject(out)));
  });
}

function getBackoffDelay(attempts, base = 2) {
  return Math.pow(base, attempts) * 1000;
}

async function worker() {
  console.log("👷 Worker started and waiting for jobs...");
  while (true) {
    const job = await nextJob();
    if (!job) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    console.log(`Processing job ${job.id}: ${job.command}`);
    try {
      const out = await runCommand(job.command);
      await complete(job.id, out);
      console.log(`Completed job ${job.id}`);
    } catch (err) {
      await fail(job, err.toString());

      const updated = await db.get("SELECT state FROM jobs WHERE id=?", job.id);
      if (updated.state === "dead") {
        console.log(`💀 Job ${job.id} moved to DLQ, stopping retries.`);
        continue;
      }

      console.log(`❌ Failed job ${job.id}: ${err}`);
      const delay = getBackoffDelay(job.attempts + 1);
      console.log(`⏳ Retrying job ${job.id} after ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function workerSingle() {
  await worker();
}

program
  .command("enqueue <json>")
  .action(async (j) => await enqueue(JSON.parse(j)));

program
  .command("worker")
  .option("--count <n>", "number of worker processes to spawn", parseInt)
  .action(async (opts) => {
    const count = opts.count || 1;
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        spawn("node", [path.resolve(process.argv[1]), "worker-single"], {
          stdio: "inherit",
        });
      }
    } else {
      await worker();
    }
  });

program.command("worker-single").action(async () => await workerSingle());

program.command("status").action(async () => {
  const rows = await db.all(
    "SELECT state, COUNT(*) as count FROM jobs GROUP BY state"
  );
  console.table(rows);
});

program
  .command("dlq")
  .option("--list", "List all dead jobs")
  .option("--retry <id>", "Retry a dead job by id")
  .action(async (opts) => {
    if (opts.list) {
      const deadJobs = await db.all("SELECT * FROM jobs WHERE state='dead'");
      console.table(deadJobs);
    } else if (opts.retry) {
      const job = await db.get(
        "SELECT * FROM jobs WHERE id=? AND state='dead'",
        opts.retry
      );
      if (!job) {
        console.error(`No dead job found with id ${opts.retry}`);
        process.exit(1);
      }
      await db.run(
        "UPDATE jobs SET state='pending', attempts=0, last_error=NULL, updated_at=? WHERE id=?",
        nowISO(),
        opts.retry
      );
      console.log(`Retried dead job ${opts.retry}`);
    } else {
      console.log("Please specify --list or --retry <id>");
    }
  });

const configPath = path.join(process.cwd(), "config.json");

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    const defaultConfig = { maxRetries: 3, backoffBase: 2 };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    console.error("Invalid config.json file");
    process.exit(1);
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

program
  .command("config")
  .option("--show", "Show current config")
  .action((opts) => {
    const config = loadConfig();
    if (opts.show) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log(
        "Use 'config --show' to display config, or 'config:set <key> <value>' to update."
      );
    }
  });

program
  .command("config:set <key> <value>")
  .description("Set config key to value")
  .action((key, value) => {
    const config = loadConfig();
    let val = value;
    if (!isNaN(value) && value.trim() !== "") {
      val = Number(value);
    }
    config[key] = val;
    saveConfig(config);
    console.log(`Set config ${key} = ${val}`);
  });

program
  .command("list")
  .option("--state <state>", "Filter jobs by state")
  .action(async (opts) => {
    let rows;
    if (opts.state) {
      rows = await db.all("SELECT * FROM jobs WHERE state=?", opts.state);
    } else {
      rows = await db.all("SELECT * FROM jobs");
    }
    console.table(rows);
  });

program.parse(process.argv);
