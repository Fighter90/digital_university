#!/usr/bin/env bash
# Swarm supervisor: restarts the orchestrator after crashes (OOM SIGKILL — the
# recurring failure mode of this machine under parallel agent load).
# One task per orchestrator invocation; a task stuck In Progress is left for
# the human (Linear is the source of truth). Runs until killed or queue empty.
# Usage: nohup bash scripts/swarm/supervisor.sh > /tmp/swarm-supervisor.log 2>&1 &
set -u
cd "$(dirname "$0")/../.."
MAX_ROUNDS="${SWARM_ROUNDS:-3}"

while true; do
  # stale-lock cleanup is built into the orchestrator (acquireLock)
  node scripts/swarm/orchestrator.mjs --max 1 --rounds "$MAX_ROUNDS" 2>&1 | tee -a /tmp/swarm-orch-digital-university.log
  code=$?
  if grep -q "queue empty" <(tail -3 /tmp/swarm-orch-digital-university.log); then
    echo "[supervisor] queue empty — exiting"
    break
  fi
  echo "[supervisor] cycle exited code=$code — restarting in 60s"
  sleep 60
done
