#!/usr/bin/env python3
"""
WordPress SQL → ATA Platform user importer.

Usage:
  python3 scripts/import-wp-users.py <path-to-wp-dump.sql>

What it does:
  1. Streams through the SQL file line-by-line (no full file load)
  2. Extracts wp_users rows (ID, email, display_name)
  3. Extracts wp_usermeta rows for first_name, last_name, billing_phone / phone
  4. Inserts into our 'users' table with must_set_password = true
  5. Creates a wallet for each new user
  6. Skips users whose email already exists

Requires: psycopg2  (pip install psycopg2-binary)
"""

import os, re, sys, json
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
    print(f"Usage: python3 {sys.argv[0]} <path-to-wp-dump.sql>")
    sys.exit(1)

SQL_FILE = sys.argv[1]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def unquote(s: str) -> str:
    """Remove surrounding quotes and unescape MySQL string escapes."""
    if not s or s == "NULL":
        return ""
    if s.startswith("'") and s.endswith("'"):
        s = s[1:-1]
    # MySQL escape sequences
    s = s.replace("\\'", "'")
    s = s.replace('\\"', '"')
    s = s.replace("\\\\", "\\")
    s = s.replace("\\n", "\n")
    s = s.replace("\\r", "\r")
    s = s.replace("\\t", "\t")
    return s


def parse_values_line(line: str) -> list[list[str]]:
    """
    Parse the VALUES (...), (...) portion of an INSERT statement.
    Returns a list of rows, each row being a list of raw value strings.
    Very lightweight — handles quoted strings with escaped chars.
    """
    rows = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] == '(':
            i += 1
            row = []
            col = []
            in_str = False
            escaped = False
            while i < n:
                ch = line[i]
                if escaped:
                    col.append(ch)
                    escaped = False
                elif ch == '\\':
                    col.append(ch)
                    escaped = True
                elif ch == "'" and not in_str:
                    in_str = True
                    col.append(ch)
                elif ch == "'" and in_str:
                    in_str = False
                    col.append(ch)
                elif ch == ',' and not in_str:
                    row.append("".join(col).strip())
                    col = []
                elif ch == ')' and not in_str:
                    row.append("".join(col).strip())
                    rows.append(row)
                    break
                else:
                    col.append(ch)
                i += 1
        i += 1
    return rows


# ---------------------------------------------------------------------------
# Pass 1 — collect wp_users and wp_usermeta
# ---------------------------------------------------------------------------

print(f"[1/3] Streaming {SQL_FILE} ...")

WP_USERS_RE   = re.compile(r"INSERT INTO `?wp_users`? VALUES", re.IGNORECASE)
WP_USERMETA_RE = re.compile(r"INSERT INTO `?wp_usermeta`? VALUES", re.IGNORECASE)

# wp_users columns (standard WP order):
# 0:ID, 1:user_login, 2:user_pass, 3:user_nicename, 4:user_email,
# 5:user_url, 6:user_registered, 7:user_activation_key, 8:user_status, 9:display_name

wp_users: dict[str, dict] = {}     # keyed by wp user_id (str)
wp_meta:  dict[str, dict] = {}     # keyed by wp user_id → {first_name, last_name, phone}

PHONE_KEYS  = {"billing_phone", "phone", "user_phone", "woo_billing_phone", "_billing_phone"}
FIRST_KEYS  = {"first_name", "billing_first_name"}
LAST_KEYS   = {"last_name",  "billing_last_name"}

with open(SQL_FILE, "r", encoding="utf-8", errors="replace") as f:
    for lineno, line in enumerate(f, 1):
        line = line.rstrip("\r\n")

        if WP_USERS_RE.search(line):
            # Could be INSERT INTO wp_users VALUES (...), (...);
            # Find the VALUES ( part
            idx = line.upper().find("VALUES")
            if idx == -1:
                continue
            values_part = line[idx + 6:].strip()
            if values_part.endswith(";"):
                values_part = values_part[:-1]
            for row in parse_values_line(values_part):
                if len(row) < 10:
                    continue
                uid   = unquote(row[0])
                email = unquote(row[4]).strip().lower()
                dname = unquote(row[9]).strip()
                if not email or "@" not in email:
                    continue
                wp_users[uid] = {"email": email, "display_name": dname}

        elif WP_USERMETA_RE.search(line):
            idx = line.upper().find("VALUES")
            if idx == -1:
                continue
            values_part = line[idx + 6:].strip()
            if values_part.endswith(";"):
                values_part = values_part[:-1]
            for row in parse_values_line(values_part):
                # umeta_id, user_id, meta_key, meta_value
                if len(row) < 4:
                    continue
                uid      = unquote(row[1])
                meta_key = unquote(row[2]).strip().lower()
                meta_val = unquote(row[3]).strip()
                if uid not in wp_meta:
                    wp_meta[uid] = {}
                if meta_key in FIRST_KEYS and "first_name" not in wp_meta[uid]:
                    wp_meta[uid]["first_name"] = meta_val
                elif meta_key in LAST_KEYS and "last_name" not in wp_meta[uid]:
                    wp_meta[uid]["last_name"] = meta_val
                elif meta_key in PHONE_KEYS and "phone" not in wp_meta[uid]:
                    wp_meta[uid]["phone"] = meta_val

        if lineno % 200_000 == 0:
            print(f"  ... {lineno:,} lines read, {len(wp_users):,} users found so far")

print(f"  Done. Found {len(wp_users):,} WP users, {len(wp_meta):,} meta records.")

# ---------------------------------------------------------------------------
# Build final user list
# ---------------------------------------------------------------------------

users_to_import = []
for uid, u in wp_users.items():
    meta   = wp_meta.get(uid, {})
    first  = meta.get("first_name", "")
    last   = meta.get("last_name",  "")
    phone  = meta.get("phone", "")

    # Build full name
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
        # Check if email already exists
        cur.execute("SELECT id FROM users WHERE email = %s LIMIT 1", (user["email"],))
        if cur.fetchone():
            skipped += 1
            continue

        # Insert user
        cur.execute(
            """
            INSERT INTO users (email, password_hash, full_name, phone, role, status, must_set_password, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'user', 'active', true, NOW(), NOW())
            RETURNING id
            """,
            (user["email"], PLACEHOLDER_HASH, user["full_name"], user["phone"])
        )
        user_id = cur.fetchone()[0]

        # Create wallet
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
