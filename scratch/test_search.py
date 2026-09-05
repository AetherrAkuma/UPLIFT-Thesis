import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import psycopg2
import json
import jwt
import datetime
from server import app
from fastapi.testclient import TestClient

SECRET_KEY = 'uplift-thesis-secret-key-32bytes!!'
client = TestClient(app)

conn = psycopg2.connect('postgresql://postgres:yuichirokanade@localhost:5432/uplift')
cur = conn.cursor()
cur.execute("SELECT id, email FROM users WHERE role = 'user' LIMIT 1")
row = cur.fetchone()
user_id, email = row[0], row[1]
conn.close()

token = jwt.encode({
    'sub': user_id,
    'email': email,
    'role': 'user',
    'exp': datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)
}, SECRET_KEY, algorithm='HS256')

print(f"Testing search with user: {email}")

test_queries = ['', 'Customer', 'Makati', 'Encoder', 'Assistant', 'Remote', 'xyznonexistent']

for query in test_queries:
    for use_ctx in [False, True]:
        res = client.post(
            '/api/pwd/suitability-match',
            json={'search_query': query, 'use_profile_context': use_ctx},
            headers={'Authorization': f'Bearer {token}'}
        )
        if res.status_code != 200:
            print(f"ERROR for query '{query}', ctx={use_ctx}: {res.status_code} {res.text}")
            continue
        data = res.json()
        titles = [m['job_title'] for m in data.get('matches', [])]
        print(f"Query: '{query:15}', AI Context: {str(use_ctx):5} -> Found ({len(titles)}): {titles}")
