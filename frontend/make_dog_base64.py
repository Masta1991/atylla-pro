import sys, base64, io
try:
    from PIL import Image
    img = Image.open('assets/dog-home.png').convert('RGBA')
    width, height = img.size
    pixels = img.load()

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            mx = max(r, g, b)
            mn = min(r, g, b)
            
            if mx > 150 and (mx - mn) < 40:
                alpha = min(255, max(0, int((mx - 150) / 105 * 255)))
                pixels[x, y] = (255, 255, 255, alpha)
            else:
                pixels[x, y] = (255, 255, 255, 0)

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    b64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')

    with open('src/components/DogIconData.js', 'w') as f:
        f.write(f'export const dogHomeBase64 = "data:image/png;base64,{b64_str}";\n')

    print('SUCCESS')
except Exception as e:
    print('ERROR:', e)
