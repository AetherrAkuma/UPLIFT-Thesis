import os
import re

search_dir = r"c:\Users\reyma\Desktop\UPLIFT-Thesis"
pattern = re.compile(r"uplift[-_ ]?ai", re.IGNORECASE)

ignore_dirs = {".git", "node_modules", "model_cache", "__pycache__", "dist", "build"}
ignore_files = {"search_uplift_ai.py"}

results = []

for root, dirs, files in os.walk(search_dir):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for file in files:
        if file in ignore_files:
            continue
        filepath = os.path.join(root, file)
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                for line_num, line in enumerate(f, 1):
                    if pattern.search(line):
                        results.append((filepath, line_num, line.strip()))
        except Exception as e:
            # Skip binary files or unreadable files
            pass

with open(r"c:\Users\reyma\Desktop\UPLIFT-Thesis\scratch\results.txt", "w", encoding="utf-8") as out:
    out.write(f"Found {len(results)} occurrences:\n")
    for filepath, line_num, line in results:
        relative_path = os.path.relpath(filepath, search_dir)
        out.write(f"{relative_path}:{line_num}: {line}\n")
print("Done! Results written to scratch/results.txt")
