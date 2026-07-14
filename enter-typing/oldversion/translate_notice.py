import json
import re
from html.parser import HTMLParser
from deep_translator import GoogleTranslator

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.texts = set()
        self.in_script_or_style = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.in_script_or_style = True
        
        if tag in ('input', 'textarea'):
            for name, value in attrs:
                if name == 'placeholder' and value and re.search(r'[가-힣]', value):
                    self.texts.add(value.strip())
                    
        for name, value in attrs:
            if name == 'title' and value and re.search(r'[가-힣]', value):
                self.texts.add(value.strip())

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self.in_script_or_style = False

    def handle_data(self, data):
        if not self.in_script_or_style:
            text = data.strip()
            if re.search(r'[가-힣]', text):
                self.texts.add(text)

def main():
    extractor = TextExtractor()
    with open('notice.html', 'r', encoding='utf-8') as file:
        extractor.feed(file.read())
        
    try:
        with open('locales.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except:
        data = {}

    en_translator = GoogleTranslator(source='ko', target='en')
    ja_translator = GoogleTranslator(source='ko', target='ja')

    added_count = 0
    for text in extractor.texts:
        if text not in data:
            try:
                print(f"Translating: {text}")
                en_trans = en_translator.translate(text)
                ja_trans = ja_translator.translate(text)
                data[text] = {
                    "en": en_trans if en_trans else "",
                    "ja": ja_trans if ja_trans else ""
                }
                added_count += 1
            except Exception as e:
                print(f"Error translating '{text}': {e}")
                
    if added_count > 0:
        with open('locales.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Added {added_count} new translations from notice.html")
    else:
        print("No new Korean text found to translate.")

if __name__ == '__main__':
    main()
