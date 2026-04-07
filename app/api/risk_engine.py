#!/usr/bin/env python3
"""Simple portfolio risk analyzer.

Usage:
  python3 lib/backend/risk_engine.py --input positions.json

Input JSON format:
[
  {
    "symbol": "AAPL",
    "quantity": 120,
    "price": 189.84,
    "daily_change_pct": 2.34,
    "volatility": 0.28
  }
]
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class Position:
    symbol: str
    quantity: float
    price: float
    daily_change_pct: float
    volatility: float

    @property
    def market_value(self) -> float:
        return self.quantity * self.price


def parse_positions(raw: list[dict[str, Any]]) -> list[Position]:
    positions: list[Position] = []
    for item in raw:
        positions.append(
            Position(
                symbol=str(item["symbol"]),
                quantity=float(item["quantity"]),
                price=float(item["price"]),
                daily_change_pct=float(item["daily_change_pct"]),
                volatility=float(item["volatility"]),
            )
        )
    return positions


def weighted_average(values: list[float], weights: list[float]) -> float:
    total_weight = sum(weights)
    if total_weight == 0:
        return 0.0
    return sum(v * w for v, w in zip(values, weights)) / total_weight


def concentration_score(weights: list[float]) -> float:
    # Herfindahl-Hirschman style concentration index.
    return sum(w * w for w in weights)


def risk_label(weighted_volatility: float, concentration: float) -> str:
    if weighted_volatility >= 0.45 or concentration >= 0.35:
        return "high"
    if weighted_volatility >= 0.25 or concentration >= 0.22:
        return "medium"
    return "low"


def analyze(positions: list[Position]) -> dict[str, Any]:
    portfolio_value = sum(p.market_value for p in positions)
    if portfolio_value <= 0:
        return {
            "portfolio_value": 0.0,
            "daily_change_pct": 0.0,
            "weighted_volatility": 0.0,
            "concentration": 0.0,
            "risk": "low",
            "top_position": None,
        }

    weights = [p.market_value / portfolio_value for p in positions]
    daily_changes = [p.daily_change_pct for p in positions]
    volatilities = [p.volatility for p in positions]

    weighted_change = weighted_average(daily_changes, weights)
    weighted_vol = weighted_average(volatilities, weights)
    concentration = concentration_score(weights)
    top = max(positions, key=lambda p: p.market_value)

    return {
        "portfolio_value": round(portfolio_value, 2),
        "daily_change_pct": round(weighted_change, 2),
        "weighted_volatility": round(weighted_vol, 4),
        "concentration": round(concentration, 4),
        "risk": risk_label(weighted_vol, concentration),
        "top_position": {
            "symbol": top.symbol,
            "value": round(top.market_value, 2),
            "weight_pct": round((top.market_value / portfolio_value) * 100, 2),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze portfolio risk from JSON positions")
    parser.add_argument("--input", required=True, help="Path to JSON file with positions")
    args = parser.parse_args()

    input_path = Path(args.input)
    raw_data = json.loads(input_path.read_text(encoding="utf-8"))

    if not isinstance(raw_data, list):
        raise ValueError("Input JSON must be a list of position objects")

    positions = parse_positions(raw_data)
    report = analyze(positions)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
