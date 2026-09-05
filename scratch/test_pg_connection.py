import sys
import psycopg2
from psycopg2.extras import RealDictCursor

DB_URI_DEFAULT = "postgresql://postgres:yuichirokanade@localhost:5432/postgres"
DB_URI_UPLIFT = "postgresql://postgres:yuichirokanade@localhost:5432/uplift"

def test_connection():
    print("Step 1: Attempting to connect to PostgreSQL default database...")
    try:
        conn = psycopg2.connect(DB_URI_DEFAULT)
        conn.autocommit = True
        cursor = conn.cursor()
        print(" -> SUCCESS: Connected to default 'postgres' database.")
    except Exception as e:
        print(f" -> ERROR: Could not connect to PostgreSQL. Details: {e}")
        print("\nPlease ensure:")
        print(" 1. PostgreSQL is installed and running on port 5432.")
        print(" 2. The password for user 'postgres' is set to 'postgres'.")
        sys.exit(1)

    print("\nStep 2: Checking if 'uplift' database exists...")
    cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'uplift'")
    exists = cursor.fetchone()
    if not exists:
        print(" -> NOT FOUND: 'uplift' database does not exist. Creating it now...")
        try:
            cursor.execute("CREATE DATABASE uplift;")
            print(" -> SUCCESS: Created database 'uplift'.")
        except Exception as e:
            print(f" -> ERROR: Failed to create database 'uplift'. Details: {e}")
            conn.close()
            sys.exit(1)
    else:
        print(" -> SUCCESS: 'uplift' database exists.")
    conn.close()

    print("\nStep 3: Connecting to 'uplift' database...")
    try:
        conn = psycopg2.connect(DB_URI_UPLIFT)
        conn.autocommit = True
        cursor = conn.cursor()
        print(" -> SUCCESS: Connected to 'uplift' database.")
    except Exception as e:
        print(f" -> ERROR: Could not connect to 'uplift' database. Details: {e}")
        sys.exit(1)

    print("\nStep 4: Testing 'pgvector' and 'pgcrypto' extensions...")
    try:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        print(" -> SUCCESS: 'vector' extension is loaded/enabled.")
    except Exception as e:
        print(f" -> ERROR: Failed to load 'vector' extension. Details: {e}")
        print("\nPlease ensure you have installed the pgvector extension binaries.")
        conn.close()
        sys.exit(1)

    try:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        print(" -> SUCCESS: 'pgcrypto' extension is loaded/enabled.")
    except Exception as e:
        print(f" -> ERROR: Failed to load 'pgcrypto' extension. Details: {e}")
        conn.close()
        sys.exit(1)

    print("\nStep 5: Testing vector type support...")
    try:
        cursor.execute("CREATE TEMP TABLE test_vector (val vector(3));")
        cursor.execute("INSERT INTO test_vector VALUES ('[1, 2, 3]');")
        cursor.execute("SELECT * FROM test_vector;")
        res = cursor.fetchall()
        print(f" -> SUCCESS: Vector storage and retrieval works. Result: {res}")
    except Exception as e:
        print(f" -> ERROR: Vector type test failed. Details: {e}")
        conn.close()
        sys.exit(1)

    print("\n🎉 ALL TESTS PASSED! Your PostgreSQL database is fully configured and ready for UPLIFT.")
    conn.close()

if __name__ == "__main__":
    test_connection()
