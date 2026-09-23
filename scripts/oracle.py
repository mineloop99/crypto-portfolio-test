#!/usr/bin/env python3
"""Independent reference implementation used to produce the golden numbers in tests/domain/golden.test.ts.

Written separately from the TypeScript engine (Python's decimal module, 50 significant digits, standard library
only) so the two implementations can check each other. It also prints a method-independent invariant:

    total P&L = current value + sum(SELL gross - fee) - sum(BUY gross + fee)

Usage: python3 scripts/oracle.py [data/trades.csv] [data/prices.csv]
"""
import csv
import json
import sys
from decimal import Decimal, getcontext

getcontext().prec = 50

trades_path = sys.argv[1] if len(sys.argv) > 1 else "data/trades.csv"
prices_path = sys.argv[2] if len(sys.argv) > 2 else "data/prices.csv"

with open(trades_path, newline="") as f:
    trades = sorted(csv.DictReader(f), key=lambda r: (r["timestamp"], r["trade_id"]))
with open(prices_path, newline="") as f:
    prices = {r["symbol"]: Decimal(r["price_usd"]) for r in csv.DictReader(f)}

state = {}
cash_in = cash_out = Decimal(0)
for t in trades:
    q, p, fee = Decimal(t["quantity"]), Decimal(t["price_usd"]), Decimal(t["fee_usd"])
    s = state.setdefault(t["symbol"], {"qty": Decimal(0), "cost": Decimal(0), "avg": Decimal(0),
                                       "realized": Decimal(0), "fees": Decimal(0), "closes": 0})
    s["fees"] += fee
    if t["side"] == "BUY":
        cash_in += q * p + fee
        s["qty"] += q
        s["cost"] += q * p + fee
        s["avg"] = s["cost"] / s["qty"]
    else:
        assert q <= s["qty"], f"short sell in {t['trade_id']}"
        cash_out += q * p - fee
        removed = s["cost"] if q == s["qty"] else s["avg"] * q
        s["realized"] += q * p - fee - removed
        s["qty"] -= q
        s["cost"] -= removed
        if s["qty"] == 0:
            s["cost"] = s["avg"] = Decimal(0)
            s["closes"] += 1

assets = {}
for sym, s in state.items():
    value = s["qty"] * prices[sym]
    assets[sym] = {"quantity": s["qty"], "averageCost": s["avg"], "costBasis": s["cost"], "currentValue": value,
                   "realizedPnl": s["realized"], "unrealizedPnl": value - s["cost"],
                   "totalPnl": s["realized"] + value - s["cost"], "feesPaid": s["fees"], "fullCloses": s["closes"]}

total_value = sum(a["currentValue"] for a in assets.values())
totals = {k: sum(a[k] for a in assets.values())
          for k in ("costBasis", "realizedPnl", "unrealizedPnl", "totalPnl", "feesPaid")}
totals["currentValue"] = total_value
for a in assets.values():
    a["allocation"] = a["currentValue"] / total_value

print(json.dumps({"assets": assets, "totals": totals,
                  "invariantTotalPnl": total_value + cash_out - cash_in}, default=str, indent=2))
