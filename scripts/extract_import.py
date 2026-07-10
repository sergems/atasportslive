#!/usr/bin/env python3
"""
Extract COPY blocks for specific tables from a pg_dump file
and write a ready-to-run SQL import script.
"""
import sys, re

BACKUP = "attached_assets/ata_backup_1783682021127.sql"
OUTPUT = "/tmp/ata_import.sql"

# Tables to replace (in dependency-safe import order)
TARGET_TABLES = [
    "users",
    "wallets",
    "transactions",
    "bets",
    "bonus_transactions",
    "streams",
    "games",
    "stream_access",
    "stream_comments",
]

def extract_copy_blocks(path):
    blocks = {}
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r'^COPY public\.(\w+)\s*\(', line)
        if m:
            tbl = m.group(1)
            if tbl in TARGET_TABLES:
                block_lines = [line]
                i += 1
                while i < len(lines):
                    block_lines.append(lines[i])
                    if lines[i].strip() == "\\.":
                        break
                    i += 1
                blocks[tbl] = "".join(block_lines)
        i += 1
    return blocks

def get_max_id_resets(blocks):
    """Return SELECT setval statements for each table that has an id column."""
    resets = []
    for tbl, block in blocks.items():
        # find data lines (not the COPY header or \.)
        data_lines = [l for l in block.splitlines()
                      if l and not l.startswith("COPY") and l != "\\."]
        ids = []
        for dl in data_lines:
            parts = dl.split("\t")
            if parts and parts[0].isdigit():
                ids.append(int(parts[0]))
        if ids:
            resets.append(
                f"SELECT setval(pg_get_serial_sequence('public.{tbl}', 'id'), {max(ids)}, true);"
            )
    return resets

blocks = extract_copy_blocks(BACKUP)
print(f"Extracted tables: {list(blocks.keys())}")

missing = [t for t in TARGET_TABLES if t not in blocks]
if missing:
    print(f"WARNING: no COPY block found for: {missing}", file=sys.stderr)

# Build the SQL script
sql_parts = [
    "BEGIN;\n",
    "-- Disable triggers temporarily for clean truncate\n",
    "SET session_replication_role = replica;\n\n",

    "-- Truncate target tables (dependent first)\n",
    "TRUNCATE public.stream_comments,\n"
    "         public.stream_access,\n"
    "         public.bets,\n"
    "         public.bonus_transactions,\n"
    "         public.wallets,\n"
    "         public.transactions,\n"
    "         public.users,\n"
    "         public.streams,\n"
    "         public.games\n"
    "  RESTART IDENTITY CASCADE;\n\n",

]

# Import order: parents first so FK constraints are satisfied
IMPORT_ORDER = [
    "users",
    "games",
    "streams",
    "transactions",
    "wallets",
    "bets",
    "bonus_transactions",
    "stream_access",
    "stream_comments",
]

for tbl in IMPORT_ORDER:
    if tbl in blocks:
        sql_parts.append(f"-- {tbl}\n")
        sql_parts.append(blocks[tbl])
        sql_parts.append("\n")

# Re-enable triggers AFTER all data is loaded
sql_parts.append("\n-- Re-enable triggers\n")
sql_parts.append("SET session_replication_role = DEFAULT;\n\n")

# Sequence resets
resets = get_max_id_resets(blocks)
if resets:
    sql_parts.append("-- Reset sequences to max imported id\n")
    sql_parts.extend(r + "\n" for r in resets)

sql_parts.append("\nCOMMIT;\n")

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.writelines(sql_parts)

print(f"Import SQL written to {OUTPUT}")
