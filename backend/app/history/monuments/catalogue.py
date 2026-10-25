"""Canonical registry, shipped inside the History service without remote lookups."""
import json
from pathlib import Path

_entries = json.loads(Path(__file__).with_name("catalogue.json").read_text(encoding="utf-8"))
CATALOGUE = {entry["id"]: entry for entry in _entries}
if len(CATALOGUE) != len(_entries):
    raise ValueError("Duplicate monument IDs in the canonical registry")


def find_monument(monument_id: str):
    return CATALOGUE.get(monument_id)
