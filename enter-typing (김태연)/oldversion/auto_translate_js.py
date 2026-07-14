import json
import glob
import re
import concurrent.futures
from deep_translator import GoogleTranslator

def translate_key(key):
    try:
        if not any(c.isalpha() or '\uac00'<=c<='\ud7a3' for c in key):
            return key, "", ""
        en_trans = GoogleTranslator(source='ko', target='en').translate(key)
        ja_trans = GoogleTranslator(source='ko', target='ja').translate(key)
        return key, (en_trans if en_trans else ""), (ja_trans if ja_trans else "")
    except Exception:
        return key, "", ""

def main():
    try:
        with open('locales.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except:
        data = {}

    found_strings = set()
    files = glob.glob('*.html') + glob.glob('*.js')
    
    # Extract any string enclosed in single, double, or backticks containing Korean
    pattern = re.compile(r"""(['"`])([^'"`]*[가-힣][^'"`]*)\1""")
    
    for fname in files:
        with open(fname, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            for match in pattern.findall(content):
                text = match[1].strip()
                if text and text not in data:
                    found_strings.add(text)
    
    keys = list(found_strings)
    print(f"Found {len(keys)} new JS/HTML hidden strings to translate.", flush=True)
    
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_key = {executor.submit(translate_key, key): key for key in keys}
        for future in concurrent.futures.as_completed(future_to_key):
            key = future_to_key[future]
            try:
                k, en, ja = future.result()
                if en or ja:
                    data[k] = {'en': en, 'ja': ja}
                completed += 1
                if completed % 10 == 0:
                    print(f"Translated {completed}/{len(keys)} items...", flush=True)
            except Exception:
                pass

    with open('locales.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("JS Translation completed. Merged into locales.json.", flush=True)

if __name__ == '__main__':
    main()
