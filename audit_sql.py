import re

with open('final_mega_resync.sql', 'r') as f:
    content = f.read()

# Find all function definitions
# Pattern matches from CREATE FUNCTION until end of statement (usually 14359; or 14359 LANGUAGE...)
functions = re.findall(r'CREATE OR REPLACE FUNCTION.*?$$.*?$$.*?;', content, re.DOTALL | re.IGNORECASE)

for func in functions:
    name_match = re.search(r'FUNCTION\s+([\w\.]+)', func, re.IGNORECASE)
    name = name_match.group(1) if name_match else "Unknown"
    
    # Count occurrences of keywords
    langs = re.findall(r'LANGUAGE\s+\w+', func, re.IGNORECASE)
    secs = re.findall(r'SECURITY\s+\w+', func, re.IGNORECASE)
    paths = re.findall(r'SET\s+search_path', func, re.IGNORECASE)
    
    if len(langs) > 1 or len(secs) > 1 or len(paths) > 1:
        print(f"CONFLICT in {name}:")
        print(f"  Languages: {langs}")
        print(f"  Security: {secs}")
        print(f"  Search Path: {paths}")
        # Print function start for context
        print(func[:200] + "...")
        print("-" * 40)
