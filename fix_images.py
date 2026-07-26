import re, pathlib

root = pathlib.Path(".")
image_dir = pathlib.Path("public/images")

real_files = {f.name for f in image_dir.iterdir() if f.is_file()}

pattern = re.compile(
    r'((?:\.\./|\./)*)(?:public/)?images/([^"\'\)\s]+)'
)

changed = []

for filepath in root.rglob("*"):
    if filepath.suffix.lower() not in (".html", ".css"):
        continue
    if "node_modules" in filepath.parts:
        continue

    text = filepath.read_text(encoding="utf-8")

    def repl(m):
        filename = m.group(2)
        if filename not in real_files:
            return m.group(0)
        return f"/public/images/{filename}"

    new_text = pattern.sub(repl, text)

    if new_text != text:
        filepath.write_text(new_text, encoding="utf-8")
        changed.append(str(filepath))

print(f"Updated {len(changed)} files:")
for c in changed:
    print(" -", c)
