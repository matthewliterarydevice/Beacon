import re, pathlib

pages_dir = pathlib.Path("src/front-end/pages")
page_names = [p.name.replace("-page", "") for p in pages_dir.iterdir() if p.is_dir()]

changed = []

for filepath in pages_dir.rglob("*.html"):
    text = filepath.read_text(encoding="utf-8")
    original = text

    # fix stylesheet link
    text = re.sub(r'href=["\'](\./)?style\.css["\']', 'href="../../styles/style.css"', text)

    # fix navigation.js script src
    text = re.sub(r'src=["\'](\./)?navigation\.js["\']', 'src="../../utils/navigation.js"', text)

    # fix each page's own stylesheet e.g. href="nudge.css" stays same-folder, skip
    # fix cross-page links like href="help.html"
    for name in page_names:
        text = re.sub(
            rf'href=["\'](\./)?{name}\.html["\']',
            f'href="../{name}-page/{name}.html"',
            text
        )

    if text != original:
        filepath.write_text(text, encoding="utf-8")
        changed.append(str(filepath))

print(f"Updated {len(changed)} files:")
for c in changed:
    print(" -", c)
