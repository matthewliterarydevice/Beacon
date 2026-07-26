import re, pathlib

image_dir = pathlib.Path("public/images")
# map lowercase filename -> actual correctly-cased filename
real_files = {f.name.lower(): f.name for f in image_dir.iterdir() if f.is_file()}

# matches src="...", href="...", and CSS url(...)
attr_pattern = re.compile(r'(src|href)=("|\')(.*?)\2')
css_url_pattern = re.compile(r'url\((["\']?)(.*?)\1\)')

changed = []

def resolve(path_value):
    """If the basename of this path matches a real image, return the
    correct /public/images/<name> path. Otherwise return None."""
    basename = path_value.rsplit("/", 1)[-1]
    real_name = real_files.get(basename.lower())
    if real_name:
        return f"/public/images/{real_name}"
    return None

for filepath in pathlib.Path("src").rglob("*"):
    if filepath.suffix.lower() not in (".html", ".css"):
        continue

    text = filepath.read_text(encoding="utf-8")
    original = text

    def attr_repl(m):
        attr, quote, value = m.group(1), m.group(2), m.group(3)
        new_value = resolve(value)
        if new_value:
            return f'{attr}={quote}{new_value}{quote}'
        return m.group(0)

    def css_repl(m):
        quote, value = m.group(1), m.group(2)
        new_value = resolve(value)
        if new_value:
            q = quote or ""
            return f'url({q}{new_value}{q})'
        return m.group(0)

    text = attr_pattern.sub(attr_repl, text)
    text = css_url_pattern.sub(css_repl, text)

    if text != original:
        filepath.write_text(text, encoding="utf-8")
        changed.append(str(filepath))

print(f"Updated {len(changed)} files:")
for c in changed:
    print(" -", c)
