#!/usr/bin/env python3
"""Smoke check for a running build: GET /api/portfolio must agree with scripts/oracle.py.

Compares every total and every per-asset figure the oracle produces to 1e-20, and the total P&L with the
method-independent cash-flow invariant. CI runs it against `next start`; it works against any deployment too.

Usage: python3 scripts/check-api.py [base_url]   (default http://127.0.0.1:3000)
"""
import json
import subprocess
import sys
import urllib.request
from decimal import Decimal

base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000").rstrip("/")
TOLERANCE = Decimal("1e-20")

with urllib.request.urlopen(f"{base}/api/portfolio", timeout=30) as response:
    api = json.load(response)
oracle = json.loads(
    subprocess.run([sys.executable, "scripts/oracle.py"], check=True, capture_output=True, text=True).stdout
)

failures = []


def compare(label, expected, actual):
    if actual is None or abs(Decimal(expected) - Decimal(actual)) > TOLERANCE:
        failures.append(f"{label}: expected {expected}, got {actual}")


for key, expected in oracle["totals"].items():
    compare(f"totals.{key}", expected, api["totals"].get(key))
compare("totals.totalPnl vs invariant", oracle["invariantTotalPnl"], api["totals"]["totalPnl"])

holdings = {h["symbol"]: h for h in api["holdings"]}
for symbol, figures in oracle["assets"].items():
    for key, expected in figures.items():
        if key != "fullCloses":
            compare(f"{symbol}.{key}", expected, holdings.get(symbol, {}).get(key))

if failures:
    print("API disagrees with the reference implementation:", *failures, sep="\n  ")
    sys.exit(1)
print(f"OK: totals, the invariant and {len(oracle['assets'])} assets match the reference to 1e-20")
