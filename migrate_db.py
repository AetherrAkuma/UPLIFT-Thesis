import re
import os

SERVER_FILE = "server.py"

with open(SERVER_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
content = content.replace("import sqlite3", "import psycopg2\nfrom psycopg2.extras import RealDictCursor\nfrom pgvector.psycopg2 import register_vector")
content = content.replace("import faiss", "")

# 2. Database connection
db_setup_old = """DB_FILE = "uplift_prototype.db"

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn"""

db_setup_new = """DB_URI = "postgresql://postgres:postgres@localhost:5432/uplift" # Update this!

def get_db_connection():
    conn = psycopg2.connect(DB_URI)
    conn.autocommit = False
    register_vector(conn)
    return conn"""

content = content.replace(db_setup_old, db_setup_new)

# 3. Replace cursor creations
content = content.replace("conn.cursor()", "conn.cursor(cursor_factory=RealDictCursor)")

# 4. Replace init_db schemas
content = content.replace("embedding TEXT", "embedding vector(384)")
content = content.replace("created_at DATETIME", "created_at TIMESTAMP")
content = content.replace("expires_at DATETIME", "expires_at TIMESTAMP")
content = content.replace("timestamp DATETIME", "timestamp TIMESTAMP")

# 5. Fix applications table default uuid (randomblob in SQLite -> gen_random_uuid() in PG if extension pgcrypto is loaded, or we just drop the default and generate in code. Actually, let's just use a string from Python for id if not provided, or simple gen_random_uuid())
content = content.replace("DEFAULT (lower(hex(randomblob(16))))", "DEFAULT gen_random_uuid()::text")

# 6. Add CREATE EXTENSION IF NOT EXISTS vector;
content = content.replace('cursor.execute("""\n        CREATE TABLE IF NOT EXISTS jobs', 'cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")\n    cursor.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")\n    cursor.execute("""\n        CREATE TABLE IF NOT EXISTS jobs')

# 7. Parameter bindings
# We need to replace all `?` with `%s` in SQL queries.
# This requires a regex that only targets strings inside cursor.execute(
def replace_params(match):
    query = match.group(1)
    # Only replace ? if it's not inside quotes... Actually, simplest is just replacing all ? inside the execute string.
    # UPLIFT-Thesis queries don't use '?' as literal text.
    new_query = query.replace("?", "%s")
    return f"cursor.execute({new_query}"

content = re.sub(r'cursor\.execute\((.*?)(,\s*\(.*?\))?\)', lambda m: f"cursor.execute({m.group(1).replace('?', '%s')}{m.group(2) or ''})", content, flags=re.DOTALL)

# 8. FAISS Replacement
faiss_old = """    pwd_vector_np = model.encode(pwd_context, convert_to_numpy=True).astype('float32')
    pwd_vector_np = np.expand_dims(pwd_vector_np, axis=0) 
    faiss.normalize_L2(pwd_vector_np)

    # --- 2.5. BUILD FAISS INDEX DYNAMICALLY ---
    job_embeddings = []
    valid_jobs = []
    for job in approved_jobs:
        try:
            emb = json.loads(job['embedding'])
            if emb:
                job_embeddings.append(emb)
                valid_jobs.append(job)
        except:
            continue
            
    if not job_embeddings:
        return {"message": "No valid job embeddings found.", "matches": []}

    job_embeddings_np = np.array(job_embeddings).astype('float32')
    faiss.normalize_L2(job_embeddings_np)
    
    dimension = job_embeddings_np.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(job_embeddings_np)

    # --- 3. FAISS SEARCH EXECUTION (Retrieval) ---
    k = min(len(valid_jobs), 30)
    distances, indices = index.search(pwd_vector_np, k)

    # --- 3.5 CROSS-ENCODER RE-RANKING (Precision) ---
    print(f"[INFO] Re-ranking {k} candidates with Cross-Encoder...")
    pairs = []
    for i in range(k):
        job = valid_jobs[indices[0][i]]
        # We compare user context vs job requirements specifically
        pairs.append([pwd_context, job['physical_requirements']])"""

faiss_new = """    pwd_vector_np = model.encode(pwd_context, convert_to_numpy=True).astype('float32')
    pwd_vector_list = pwd_vector_np.tolist()
    
    # --- PGVECTOR SEARCH EXECUTION (Retrieval) ---
    k = min(len(approved_jobs), 30)
    
    # Let's query directly from DB using pgvector similarity (Cosine Distance)
    # Cosine distance operator is <=>. We order by it ASC.
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(\"\"\"
        SELECT *, 1 - (embedding <=> %s::vector) AS cos_sim
        FROM jobs 
        WHERE status = 'approved' AND embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector ASC
        LIMIT %s
    \"\"\", (json.dumps(pwd_vector_list), json.dumps(pwd_vector_list), k))
    
    top_candidates = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    if not top_candidates:
        return {"message": "No valid job embeddings found.", "matches": []}

    # --- 3.5 CROSS-ENCODER RE-RANKING (Precision) ---
    print(f"[INFO] Re-ranking {len(top_candidates)} candidates with Cross-Encoder...")
    pairs = []
    distances = [[c['cos_sim'] for c in top_candidates]]
    
    for job in top_candidates:
        pairs.append([pwd_context, job['physical_requirements']])
    
    # Fake indices array so the loop below doesn't break
    indices = [[i for i in range(len(top_candidates))]]
    valid_jobs = top_candidates
"""

content = content.replace(faiss_old, faiss_new)


with open("server_pg.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Created server_pg.py")
