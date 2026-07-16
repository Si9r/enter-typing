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

            # The footer image was changed to /assets/logo.png
            # We want to change it back to /assets/logo/logo-typo.svg
            # Look for <img src="/assets/logo.png" alt="Enter Typing Logo"> in footer
            
            # Since we know the alt text is "Enter Typing Logo", we can specifically target that.
            if re.search(r'<img[^>]+src="/assets/logo\.png"[^>]*alt="Enter Typing Logo"[^>]*>', content):
                new_content = re.sub(
                    r'(<img[^>]+src=")/assets/logo\.png("[^>]*alt="Enter Typing Logo"[^>]*>)',
                    r'\1/assets/logo/logo-typo.svg\2',
                    content
                )
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated: {file}")
                    files_updated += 1
            # Also check if it doesn't have alt text just in case
            elif re.search(r'<img[^>]+src="/assets/logo\.png"[^>]*>', content):
                new_content = re.sub(
                    r'(<img[^>]+src=")/assets/logo\.png("[^>]*>)',
                    r'\1/assets/logo/logo-typo.svg\2',
                    content
                )
                
                if new_content != content:
                    # Double check if it's inside footer
                    if 'footer-col brand-col' in content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Updated (no alt): {file}")
                        files_updated += 1

print(f"Total files restored to logo-typo.svg: {files_updated}")
