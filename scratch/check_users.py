import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect('postgresql://postgres:yuichirokanade@localhost:5432/uplift')
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT id, email, name, role, status FROM users")
rows = cur.fetchall()
print("\n=== ALL USERS ===")
for r in rows:
    print(dict(r))
conn.close()
