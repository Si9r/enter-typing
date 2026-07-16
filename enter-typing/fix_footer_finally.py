import os
import json

# 1. Add inline style to footer logo
html_dir = r"c:\Users\dowon\enter-typing\enter-typing\html"
for root, _, files in os.walk(html_dir):
    for file in files:
        if file.endswith(".html"):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            if '<img src="/assets/logo_icon.png" alt="Enter Typing Logo">' in content:
                content = content.replace(
                    '<img src="/assets/logo_icon.png" alt="Enter Typing Logo">',
                    '<img src="/assets/logo_icon.png" alt="Enter Typing Logo" style="height: 36px; width: auto;">'
                )
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)

# 2. Append to locales.json safely
locales_path = r"c:\Users\dowon\enter-typing\enter-typing\locales.json"
with open(locales_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Make sure we don't duplicate
if '"서비스": {' not in text:
    # Find the last closing brace
    last_brace_idx = text.rfind('}')
    
    new_keys = """    ,
    "서비스": {
        "en": "Services",
        "ja": "サービス"
    },
    "타이핑 연습": {
        "en": "Typing Practice",
        "ja": "タイピング練習"
    },
    "단어 퀴즈": {
        "en": "Word Quiz",
        "ja": "単語クイズ"
    },
    "멀티플레이": {
        "en": "Multiplayer",
        "ja": "マルチプレイ"
    },
    "커뮤니티": {
        "en": "Community",
        "ja": "コミュニティ"
    },
    "고객지원": {
        "en": "Support",
        "ja": "サポート"
    },
    "문의하기": {
        "en": "Contact Us",
        "ja": "お問い合わせ"
    }
}"""
    
    new_text = text[:last_brace_idx].rstrip() + new_keys
    with open(locales_path, 'w', encoding='utf-8') as f:
        f.write(new_text)
