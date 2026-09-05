import re

file_path = r"c:\Users\reyma\Desktop\UPLIFT-Thesis\UPLIFT THESIS.md"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Define replacement rules preserving casing
def replace_match(match):
    matched_text = match.group(0)
    # Check casing of the first word "uplift"
    if matched_text.startswith("UPLIFT"):
        return "UPLIFT"
    elif matched_text.startswith("Uplift"):
        return "Uplift"
    elif matched_text.startswith("uplift"):
        return "uplift"
    else:
        # Fallback to whatever casing of uplift was matched, without the AI part
        # Extract the "uplift" part (up to the space or hyphen)
        uplift_part = re.split(r'[- ]', matched_text)[0]
        return uplift_part

# Pattern to match: case-insensitive "uplift" followed by optionally space/hyphen, followed by "ai"
pattern = re.compile(r'\buplift[- ]?ai\b', re.IGNORECASE)

new_content, count = pattern.subn(replace_match, content)

print(f"Total replacements made: {count}")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)
