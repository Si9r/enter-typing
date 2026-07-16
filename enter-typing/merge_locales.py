import json
import re
import sys

def merge_locales():
    with open("locales.json", "r", encoding="utf-8") as f:
        content = f.read()
    
    # Check if conflicted
    if "<<<<<<< HEAD" not in content:
        print("locales.json is not conflicted.")
        return

    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [0-9a-fA-F]+', re.DOTALL)
    m = pattern.search(content)
    if not m:
        print("Could not find conflict blocks in locales.json")
        return
        
    ours_str = m.group(1).strip()
    theirs_str = m.group(2).strip()

    try:
        ours = json.loads(ours_str)
        theirs = json.loads(theirs_str)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return

    # Deep merge: ours + theirs
    merged = {}
    
    # Collect all languages
    all_langs = set(ours.keys()).union(set(theirs.keys()))
    
    for lang in all_langs:
        merged[lang] = {}
        if lang in ours:
            merged[lang].update(ours[lang])
        if lang in theirs:
            merged[lang].update(theirs[lang])
            
    with open("locales.json", "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=4)
        
    print("Merged locales.json successfully!")

def resolve_i18n_js():
    with open("i18n.js", "r", encoding="utf-8") as f:
        content = f.read()
    
    if "<<<<<<< HEAD" not in content:
        return
        
    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [0-9a-fA-F]+', re.DOTALL)
    # For i18n.js, we want THEIRS (group 2)
    new_content = pattern.sub(r'\2', content)
    
    with open("i18n.js", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Resolved i18n.js successfully (chose theirs).")

if __name__ == "__main__":
    merge_locales()
    resolve_i18n_js()
