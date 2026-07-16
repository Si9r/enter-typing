import os
import re

html_dir = r"c:\Users\dowon\enter-typing\enter-typing\html"
files_updated = 0

for root, _, files in os.walk(html_dir):
    for file in files:
        if file.endswith(".html"):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # We want to change /assets/logo/logo-typo.svg to /assets/logo_icon.png
            if '/assets/logo/logo-typo.svg' in content:
                new_content = content.replace('/assets/logo/logo-typo.svg', '/assets/logo_icon.png')
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated: {file}")
                files_updated += 1

print(f"Total files updated to logo_icon.png: {files_updated}")
