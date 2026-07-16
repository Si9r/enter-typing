import os
import re

html_dir = r"c:\Users\dowon\enter-typing\enter-typing\html"
for root, _, files in os.walk(html_dir):
    for file in files:
        if file.endswith(".html"):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Regex to match the footer logo img tag regardless of what src it currently has
            new_content = re.sub(
                r'<img[^>]*alt="Enter Typing Logo"[^>]*>',
                r'<img src="/assets/logo_icon.png" alt="Enter Typing Logo" style="height: 36px; width: auto;">',
                content
            )
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated footer logo in {file}")
