import re

with open('frontend.html', 'r', encoding='utf-8') as f:
    html = f.read()

style = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
if style:
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(style.group(1).strip())
    html = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="style.css">', html, flags=re.DOTALL)

# There are multiple scripts. The first is tailwind cdn, the second is inside OCR modal, the third is main logic.
# Wait, the main logic script is at the end. Let's find the last script tag.
scripts = list(re.finditer(r'<script>(.*?)</script>', html, re.DOTALL))
if scripts:
    main_script = scripts[-1]
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(main_script.group(1).strip())
    
    # Replace just the last script tag
    start, end = main_script.span()
    html = html[:start] + '<script src="script.js"></script>' + html[end:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
