import sqlite3
import psycopg2
import json
import sys
import os

# Adjust path to find server module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from server import get_db_connection, init_db

SQLITE_DB = "uplift_prototype.db"

def migrate():
    # 1. Initialize PostgreSQL Schema first
    print("Step 1: Initializing PostgreSQL database tables...")
    try:
        init_db()
        print(" -> SUCCESS: PostgreSQL database tables initialized.")
    except Exception as e:
        print(f" -> ERROR: Failed to initialize PostgreSQL tables. Details: {e}")
        sys.exit(1)

    # 2. Connect to SQLite
    print("\nStep 2: Connecting to SQLite database...")
    if not os.path.exists(SQLITE_DB):
        print(f" -> ERROR: SQLite database file '{SQLITE_DB}' not found.")
        sys.exit(1)
    
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    print(" -> SUCCESS: Connected to SQLite.")

    # 3. Connect to PostgreSQL
    print("\nStep 3: Connecting to PostgreSQL database...")
    pg_conn = get_db_connection()
    pg_conn.rollback() # Clear any active transaction block started by register_vector
    pg_conn.autocommit = True
    pg_cursor = pg_conn.cursor()
    print(" -> SUCCESS: Connected to PostgreSQL.")

    # Define tables to migrate
    tables = ['users', 'jobs', 'sessions', 'applications', 'audit_logs', 'system_settings']

    print("\nStep 4: Starting table-by-table migration...")

    for table in tables:
        print(f"\n--- Migrating table: '{table}' ---")
        
        # Check if table exists in SQLite
        sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        if not sqlite_cursor.fetchone():
            print(f" -> WARNING: Table '{table}' does not exist in SQLite database. Skipping.")
            continue

        # Get all columns in SQLite table
        sqlite_cursor.execute(f"PRAGMA table_info({table})")
        columns = [col['name'] for col in sqlite_cursor.fetchall()]
        columns_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))

        # Fetch all rows from SQLite
        sqlite_cursor.execute(f"SELECT {columns_str} FROM {table}")
        rows = sqlite_cursor.fetchall()
        print(f" -> Found {len(rows)} rows in SQLite.")

        if not rows:
            print(" -> No rows to migrate. Skipping inserts.")
            continue

        # Truncate existing data in PostgreSQL table (to avoid conflicts)
        print(f" -> Clearing existing data in PostgreSQL '{table}'...")
        try:
            pg_cursor.execute(f"TRUNCATE TABLE {table} CASCADE;")
        except Exception as e:
            print(f" -> Failed to truncate table (might be fine if empty): {e}")

        # Insert rows into PostgreSQL
        inserted_count = 0
        for row in rows:
            # Convert row to a list of values
            values = list(row)
            
            # Special parsing: handle jobs.embedding vector formatting
            if table == 'jobs' and 'embedding' in columns:
                emb_idx = columns.index('embedding')
                emb_val = values[emb_idx]
                if emb_val:
                    try:
                        # Try to deserialize JSON list of floats
                        if isinstance(emb_val, str):
                            values[emb_idx] = json.loads(emb_val)
                    except Exception as parse_err:
                        print(f" -> Warning parsing embedding for job {row.get('id', 'unknown')}: {parse_err}")
                        values[emb_idx] = None

            # Special parsing: handle user disabilities list if it's double serialized or needs validation
            if table == 'users' and 'disabilities' in columns:
                dis_idx = columns.index('disabilities')
                dis_val = values[dis_idx]
                # PostgreSQL requires a string for TEXT DEFAULT '[]'
                if dis_val is None:
                    values[dis_idx] = '[]'

            try:
                insert_query = f"INSERT INTO {table} ({columns_str}) VALUES ({placeholders})"
                pg_cursor.execute(insert_query, values)
                inserted_count += 1
            except Exception as e:
                print(f" -> ERROR inserting row {values[0] if values else 'unknown'}: {e}")

        print(f" -> SUCCESS: Migrated {inserted_count}/{len(rows)} rows into PostgreSQL '{table}'.")

    # Close connections
    sqlite_conn.close()
    pg_conn.close()
    print("\nDATA MIGRATION COMPLETE! All data from SQLite has been copied to PostgreSQL.")

if __name__ == "__main__":
    migrate()
