import shutil, os, re

DIST = 'dist'
PUBLIC = 'public'
ASSETS = 'assets'

# Odczytaj oryginalny index.html żeby wyciągnąć script tag
with open(f'{DIST}/index.html', 'r') as f:
    original = f.read()

script_match = re.search(r'<script[^>]*src="([^"]*)"[^>]*></script>', original)
script_tag = script_match.group(0) if script_match else ''

# Odczytaj custom index.html
with open(f'{PUBLIC}/index.html', 'r') as f:
    custom = f.read()

# Wstrzyknij script tag przed </body>
if script_tag:
    custom = custom.replace('</body>', f'  {script_tag}\n  </body>')

# Zapisz
with open(f'{DIST}/index.html', 'w') as f:
    f.write(custom)
print('Injected script tag into custom index.html')

# Skopiuj ikony i manifest
for f_name in ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon.png', 'manifest.json']:
    src = f'{ASSETS}/{f_name}'
    if os.path.exists(src):
        shutil.copy2(src, f'{DIST}/{f_name}')
        print(f'Copied {f_name}')

print('Done!')
