# Supabase Local — Daily Backups & PITR WAL Archive

A local PostgreSQL setup using Docker with automated daily backups and Point-in-Time Recovery (PITR) using WAL archiving. Built and tested on WSL2 / Ubuntu.

---

## What This Project Does

- Runs PostgreSQL 15 locally using Docker
- Populates the database with dummy data (users, products, orders)
- Takes automatic daily backups using `pg_dump` and `pg_basebackup` via cron
- Archives WAL segments continuously for Point-in-Time Recovery
- Allows you to recover data to any exact second in time

---

## Project Structure

```
supabase-test2/
├── docker-compose.yml        # Postgres container with WAL archiving enabled
├── .env.example              # Template for environment variables
├── .gitignore                # Excludes pg_data, wal_archive, backups, .env
├── scripts/
│   ├── populate.sh           # Creates tables and inserts dummy data
│   └── daily_backups.sh      # Automated backup script (pg_dump + pg_basebackup)
└── README.md                 # This file
```

---

## Prerequisites

- WSL2 running Ubuntu 20.04 or 22.04
- Docker Desktop with WSL2 backend enabled
- Docker Compose v2 (`docker compose` command)
- User added to docker group:
  ```bash
  sudo usermod -aG docker $USER
  ```

---

## Setup

**1. Clone the repository**
```bash
git clone <your-repo-url>
cd supabase-test2
```

**2. Create required directories**
```bash
mkdir -p pg_data wal_archive backups/daily scripts
```

**3. Create your .env file**
```bash
cp .env.example .env
```

Open `.env` and set your user ID:
```
MY_UID=1000
MY_GID=1000
```

To find your exact UID and GID run:
```bash
id -u
id -g
```

**4. Start the container**
```bash
docker compose up -d
```

**5. Verify it is running**
```bash
docker logs ram_postgres --tail 10
```

You should see:
```
database system is ready to accept connections
```

---

## Populate Database with Dummy Data

Run the populate script to create tables and insert test records:

```bash
chmod +x scripts/populate.sh
./scripts/populate.sh
```

This creates three tables:

| Table    | Description              |
|----------|--------------------------|
| users    | 5 dummy users            |
| products | 3 dummy products         |
| orders   | 4 dummy orders           |

Verify data was inserted:
```bash
docker exec ram_postgres psql -U ram -d ramdb -c "SELECT * FROM users;"
```

---

## Daily Automatic Backups

The backup script does three things every time it runs:

1. **pg_dump snapshot** — exports entire database as compressed SQL file
2. **pg_basebackup** — takes physical copy of database files (required for PITR)
3. **Cleanup** — deletes backups older than 7 days automatically

**Run manually to test:**
```bash
chmod +x scripts/daily_backups.sh
./scripts/daily_backups.sh
```

**Schedule with cron (runs at midnight every day):**
```bash
crontab -e
```

Add this line:
```
0 0 * * * /home/<your-username>/supabase-test2/scripts/daily_backups.sh >> /home/<your-username>/supabase-test2/backups/backup.log 2>&1
```

**Verify backups were saved:**
```bash
ls -lh ~/supabase-test2/backups/daily/
```

You should see:
```
basebackup_YYYYMMDD_HHMMSS/      ← for PITR
snapshot_YYYYMMDD_HHMMSS.sql.gz  ← for simple restore
```

---

## WAL Archiving

WAL (Write-Ahead Log) archiving is enabled automatically when the container starts. Every database change is continuously archived to the `wal_archive/` folder.

**Check WAL files are being archived:**
```bash
ls -lh ~/supabase-test2/wal_archive/
```

**Force immediate WAL archive:**
```bash
docker exec ram_postgres psql -U ram -d ramdb -c "SELECT pg_switch_wal();"
```

---

## Point-in-Time Recovery (PITR)

PITR lets you restore the database to any exact moment in time. You need:
- A base backup (taken by daily_backups.sh)
- WAL segments archived after that base backup
- The timestamp you want to recover to

### Step by step recovery

**1. Note the time before data loss (important)**
```bash
date '+%Y-%m-%d %H:%M:%S'
```

**2. Stop the container**
```bash
docker compose down
```

**3. Clear pg_data**
```bash
sudo rm -rf ~/supabase-test2/pg_data/*
```

**4. Extract base backup**
```bash
tar -xf ~/supabase-test2/backups/daily/basebackup_YYYYMMDD_HHMMSS/base.tar \
  -C ~/supabase-test2/pg_data/
```

**5. Create recovery signal**
```bash
touch ~/supabase-test2/pg_data/recovery.signal
```

**6. Add recovery config to postgresql.conf**
```bash
nano ~/supabase-test2/pg_data/postgresql.conf
```

Add these lines at the bottom:
```
restore_command = 'cp /wal_archive/%f %p'
recovery_target_time = 'YYYY-MM-DD HH:MM:SS'
recovery_target_action = 'promote'
```

Replace `YYYY-MM-DD HH:MM:SS` with the timestamp from step 1.

**7. Start the container**
```bash
docker compose up -d
```

**8. Watch recovery logs**
```bash
docker logs ram_postgres --tail 30
```

Look for:
```
starting point-in-time recovery to YYYY-MM-DD HH:MM:SS
restored log file from archive
database system is ready to accept connections
```

**9. Verify data is restored**
```bash
docker exec ram_postgres psql -U ram -d ramdb -c "SELECT * FROM users;"
```

---

## Restore from pg_dump Snapshot

For a simple full restore without PITR:

```bash
# List available snapshots
ls -lh ~/supabase-test2/backups/daily/snapshot_*.sql.gz

# Restore latest snapshot
SNAP=$(ls -t ~/supabase-test2/backups/daily/snapshot_*.sql.gz | head -1)
gunzip -c "$SNAP" | docker exec -i ram_postgres psql -U ram -d ramdb
```

---

## How It All Works

```
Container starts
      ↓
pg_data/ initialized (all database files stored here)
      ↓
WAL archiving begins → every change copied to wal_archive/
      ↓
populate.sh → creates tables and inserts dummy data
      ↓
daily_backups.sh (midnight) → pg_dump + pg_basebackup saved to backups/daily/
      ↓
Data loss happens
      ↓
PITR recovery:
  extract base backup → pg_data/
  add recovery.signal
  set recovery_target_time
  start postgres → replays WAL from wal_archive/
  stops at target time → data restored
```

---

## Docker Compose Configuration

Key settings in `docker-compose.yml`:

| Setting | Value | Purpose |
|---------|-------|---------|
| wal_level | replica | Enables WAL archiving |
| archive_mode | on | Activates archive_command |
| archive_command | cp %p /wal_archive/%f | Copies WAL to wal_archive/ |
| archive_timeout | 60 | Forces archive every 60 seconds |
| restore_command | cp /wal_archive/%f %p | Fetches WAL during recovery |

---

## Troubleshooting

**Container not starting:**
```bash
docker logs ram_postgres --tail 50
```

**WAL files not archiving:**
```bash
ls -lh ~/supabase-test2/wal_archive/
docker exec ram_postgres psql -U ram -d ramdb -c "SHOW archive_mode;"
```

**Recovery target not reached:**
- Make sure your `recovery_target_time` is between the base backup time and the delete time
- Check WAL archive has segments covering that time period

**Permission errors on pg_data:**
- Make sure `MY_UID` and `MY_GID` in `.env` match your actual user ID
- Run `id -u` and `id -g` to verify

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| MY_UID | Your WSL user ID | 1000 |
| MY_GID | Your WSL group ID | 1000 |
| POSTGRES_USER | Database username | ram |
| POSTGRES_PASSWORD | Database password | ram123 |
| POSTGRES_DB | Database name | ramdb |

---

## Database Connection

| Parameter | Value |
|-----------|-------|
| Host | localhost |
| Port | 5434 |
| Database | ramdb |
| Username | ram |
| Password | ram123 |

Connect via psql:
```bash
docker exec -it ram_postgres psql -U ram -d ramdb
```

