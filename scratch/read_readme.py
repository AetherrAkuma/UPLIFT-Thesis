try:
    with open("README.md", "rb") as f:
        raw_data = f.read()
    
    # Try different encodings
    for encoding in ['utf-16', 'utf-16le', 'utf-16be', 'utf-8', 'latin1']:
        try:
            text = raw_data.decode(encoding)
            print(f"--- Encoding: {encoding} ---")
            print(repr(text))
            break
        except Exception:
            pass
except Exception as e:
    print(f"Error: {e}")
