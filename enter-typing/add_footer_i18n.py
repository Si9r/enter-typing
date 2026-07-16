import json

def add_translations():
    with open("c:/Users/dowon/enter-typing/enter-typing/locales.json", "r", encoding="utf-8") as f:
        translations = json.load(f)
        
    missing_keys = {
        "서비스": {"en": "Services", "ja": "サービス"},
        "타이핑 연습": {"en": "Typing Practice", "ja": "タイピング練習"},
        "단어 퀴즈": {"en": "Word Quiz", "ja": "単語クイズ"},
        "멀티플레이": {"en": "Multiplayer", "ja": "マルチプレイ"},
        "커뮤니티": {"en": "Community", "ja": "コミュニティ"},
        "고객지원": {"en": "Support", "ja": "サポート"},
        "문의하기": {"en": "Contact Us", "ja": "お問い合わせ"}
    }
    
    # Since locales.json format is: 
    # {
    #   "ko_key": {
    #       "en": "...",
    #       "ja": "..."
    #   }
    # }
    for key, val in missing_keys.items():
        if key not in translations:
            translations[key] = val
        else:
            translations[key].update(val)
            
    with open("c:/Users/dowon/enter-typing/enter-typing/locales.json", "w", encoding="utf-8") as f:
        json.dump(translations, f, ensure_ascii=False, indent=4)
        
if __name__ == "__main__":
    add_translations()
    print("Translations added successfully.")
