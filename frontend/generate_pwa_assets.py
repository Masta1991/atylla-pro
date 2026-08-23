import os, json
from PIL import Image

SIZES = {
    'apple-touch-icon.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
    'favicon.png': 32,
}

src = Image.open('assets/dog-home-transparent2.png').convert('RGBA')

for name, size in SIZES.items():
    resized = src.resize((size, size), Image.LANCZOS)
    resized.save(f'assets/{name}', 'PNG')
    print(f'Created {name} ({size}x{size})')

# manifest.json
manifest = {
    "name": "Atylla Pro",
    "short_name": "Atylla Pro",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0d1117",
    "theme_color": "#0d1117",
    "icons": [
        {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}
    ]
}

with open('assets/manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)
print('Created manifest.json')

# custom index.html
index_html = '''<!DOCTYPE html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
    <meta name="theme-color" content="#0d1117" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Atylla Pro" />
    <title>Atylla Pro</title>
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <style id="expo-reset">
      html, body { height: 100%; background-color: #0d1117; }
      body { overflow: hidden; }
      #root { display: flex; height: 100%; flex: 1; background-color: #0d1117; }
    </style>
  </head>
  <body style="background-color: #0d1117;">
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
'''

with open('public/index.html', 'w') as f:
    f.write(index_html)
print('Created public/index.html')
