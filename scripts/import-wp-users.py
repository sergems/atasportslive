#!/usr/bin/env python3
"""
WordPress/WooCommerce SQL → ATA Platform user importer.

Usage:
  python3 scripts/import-wp-users.py <path-to-dump.sql>

What it does:
  1. Streams through the SQL file line-by-line (no full file load)
  2. Extracts fh_users rows (ID, email, display_name)
  3. Extracts fh_usermeta rows for first_name, last_name, phone
  4. Inserts into our 'users' table with must_set_password = true
  5. Creates a wallet for each new user
  6. Skips users whose email already exists

Requires: psycopg2  (pip install psycopg2-binary)
"""

import os, re, sys
from datetime import datetime

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("ERROR: psycopg2 not found. Install it with:  pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is not set.")
    sys.exit(1)

if len(sys.argv) < 2:
    print(f"Usage: python3 {sys.argv[0]} <path-to-dump.sql>")
    sys.exit(1)

SQL_FILE = sys.argv[1]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def unquote(s: str) -> str:
    """Remove surrounding quotes and unescape MySQL string escapes."""
    if not s or s.upper() == "NULL":
        return ""
    s = s.strip()
    if s.startswith("'") and s.endswith("'"):
        s = s[1:-1]
    s = s.replace("\\'", "'")
    s = s.replace('\\"', '"')
    s = s.replace("\\\\", "\\")
    s = s.replace("\\n", "\n")
    s = s.replace("\\r", "\r")
    s = s.replace("\\t", "\t")
    return s


def parse_row(line: str) -> list[str] | None:
    """
    Parse a single SQL row line like:
      (1, 'foo', 'bar baz', NULL, 'x@y.com', ...),
    Returns a list of raw value strings, or None if line isn't a row.
    """
    line = line.strip()
    if not line.startswith("("):
        return None

    # Strip trailing comma/semicolon
    if line.endswith(";"):
        line = line[:-1].rstrip()
    if line.endswith(","):
        line = line[:-1].rstrip()

    # Must end with ) now
    if not line.endswith(")"):
        return None

    inner = line[1:-1]  # strip outer ( )

    row = []
    col = []
    in_str = False
    escaped = False

    for ch in inner:
        if escaped:
            col.append(ch)
            escaped = False
        elif ch == "\\":
            col.append(ch)
            escaped = True
        elif ch == "'" and not in_str:
            in_str = True
            col.append(ch)
        elif ch == "'" and in_str:
            in_str = False
            col.append(ch)
        elif ch == "," and not in_str:
            row.append("".join(col).strip())
            col = []
        else:
            col.append(ch)

    row.append("".join(col).strip())
    return row


# ---------------------------------------------------------------------------
# Pass 1 — collect fh_users and fh_usermeta
# ---------------------------------------------------------------------------

print(f"[1/3] Streaming {SQL_FILE} ...")

# Detects the INSERT header lines (table prefix may vary: wp_, fh_, etc.)
USERS_HEADER_RE    = re.compile(r"INSERT INTO `[^`]*users`\s*\(", re.IGNORECASE)
USERMETA_HEADER_RE = re.compile(r"INSERT INTO `[^`]*usermeta`\s*\(", re.IGNORECASE)

# fh_users columns: ID, user_login, user_pass, user_nicename, user_email, user_url,
#                   user_registered, user_activation_key, user_status, display_name
# Indices:          0   1            2           3              4           5
#                   6                7                          8           9

fh_users: dict[str, dict] = {}    # keyed by user_id (str)
fh_meta:  dict[str, dict] = {}    # keyed by user_id → {first_name, last_name, phone}

PHONE_KEYS = {"billing_phone", "phone", "user_phone", "woo_billing_phone", "_billing_phone"}
FIRST_KEYS = {"first_name", "billing_first_name"}
LAST_KEYS  = {"last_name",  "billing_last_name"}

in_users    = False
in_usermeta = False

with open(SQL_FILE, "r", encoding="utf-8", errors="replace") as f:
    for lineno, line in enumerate(f, 1):
        line = line.rstrip("\r\n")

        # Detect header lines
        if USERS_HEADER_RE.search(line):
            in_users    = True
            in_usermeta = False
            continue

        if USERMETA_HEADER_RE.search(line):
            in_usermeta = True
            in_users    = False
            continue

        # Any non-row line ends the current INSERT block
        stripped = line.strip()
        if not stripped.startswith("("):
            if stripped and not stripped.startswith("--") and not stripped.startswith("/*"):
                in_users    = False
                in_usermeta = False
            continue

        if in_users:
            row = parse_row(line)
            if row and len(row) >= 10:
                uid   = unquote(row[0])
                email = unquote(row[4]).strip().lower()
                dname = unquote(row[9]).strip()
                if email and "@" in email:
                    fh_users[uid] = {"email": email, "display_name": dname}

        elif in_usermeta:
            row = parse_row(line)
            if row and len(row) >= 4:
                uid      = unquote(row[1])
                meta_key = unquote(row[2]).strip().lower()
                meta_val = unquote(row[3]).strip()
                if uid not in fh_meta:
                    fh_meta[uid] = {}
                if meta_key in FIRST_KEYS and "first_name" not in fh_meta[uid]:
                    fh_meta[uid]["first_name"] = meta_val
                elif meta_key in LAST_KEYS and "last_name" not in fh_meta[uid]:
                    fh_meta[uid]["last_name"] = meta_val
                elif meta_key in PHONE_KEYS and "phone" not in fh_meta[uid]:
                    fh_meta[uid]["phone"] = meta_val

        if lineno % 200_000 == 0:
            print(f"  ... {lineno:,} lines read, {len(fh_users):,} users found so far")

print(f"  Done. Found {len(fh_users):,} users, {len(fh_meta):,} meta records.")

# ---------------------------------------------------------------------------
# Build final user list
# ---------------------------------------------------------------------------

users_to_import = []
for uid, u in fh_users.items():
    meta  = fh_meta.get(uid, {})
    first = meta.get("first_name", "")
    last  = meta.get("last_name",  "")
    phone = meta.get("phone", "")

    if first or last:
        full_name = f"{first} {last}".strip()
    else:
        full_name = u["display_name"] or u["email"].split("@")[0]

    users_to_import.append({
        "email":     u["email"],
        "full_name": full_name,
        "phone":     phone or None,
    })

print(f"[2/3] Prepared {len(users_to_import):,} users for import.")

# ---------------------------------------------------------------------------
# Pass 2 — insert into PostgreSQL
# ---------------------------------------------------------------------------

print(f"[3/3] Connecting to database ...")
conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

PLACEHOLDER_HASH = "MUST_SET_PASSWORD"

imported = 0
skipped  = 0
failed   = 0

for user in users_to_import:
    try:
        cur.execute("SELECT id FROM users WHERE email = %s LIMIT 1", (user["email"],))
        if cur.fetchone():
            skipped += 1
            continue

        cur.execute(
            """
            INSERT INTO users (email, password_hash, full_name, phone, role, status,
                               must_set_password, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'user', 'active', true, NOW(), NOW())
            RETURNING id
            """,
            (user["email"], PLACEHOLDER_HASH, user["full_name"], user["phone"])
        )
        user_id = cur.fetchone()[0]

        cur.execute(
            "INSERT INTO wallets (user_id, balance, created_at, updated_at) VALUES (%s, 0, NOW(), NOW()) ON CONFLICT DO NOTHING",
            (user_id,)
        )

        conn.commit()
        imported += 1

        if imported % 100 == 0:
            print(f"  Imported {imported:,} users ...")

    except Exception as e:
        conn.rollback()
        print(f"  WARN: Failed to import {user['email']}: {e}")
        failed += 1

cur.close()
conn.close()

print()
print("=" * 50)
print(f"  Imported : {imported:,}")
print(f"  Skipped  : {skipped:,}  (email already exists)")
print(f"  Failed   : {failed:,}")
print("=" * 50)
print("Done! Imported users must set their password on first login.")
