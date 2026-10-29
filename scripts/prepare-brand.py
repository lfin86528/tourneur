# Builds the brand images from the source logo (Nextcloud3/tourneur.ch/logo.png),
# whose transparency is a checkerboard painted into the picture: grey and white
# pixels (no colour) become transparent, the brown ribbon is kept.
#   python scripts/prepare-brand.py <logo.png> <signature.png>
import sys
from PIL import Image, ImageFilter

logo_src, signature_src = sys.argv[1], sys.argv[2]
im = Image.open(logo_src).convert('RGB')
r, g, b = [band.load() for band in im.split()]
w, h = im.size
alpha = Image.new('L', im.size)
a = alpha.load()
for y in range(h):
    for x in range(w):
        R, G, B = r[x, y], g[x, y], b[x, y]
        chroma = max(R, G, B) - min(R, G, B)
        dark = max(R, G, B) < 90
        # brown wood: clearly coloured; the dark outline: dark even if greyish.
        a[x, y] = 255 if chroma > 38 or dark else (0 if chroma < 18 else int((chroma - 18) / 20 * 255))
alpha = alpha.filter(ImageFilter.MedianFilter(3))
logo = im.copy(); logo.putalpha(alpha)
logo = logo.crop(logo.getbbox())
side = max(logo.size)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
square.paste(logo, ((side - logo.width) // 2, (side - logo.height) // 2), logo)
square.resize((512, 512), Image.LANCZOS).save('public/icons/logo-mark.png', optimize=True)

# App icons: the mark on the site's paper colour, with a margin (maskable safe zone).
def icon(size, margin):
    canvas = Image.new('RGBA', (size, size), (247, 243, 236, 255))
    inner = int(size * (1 - 2 * margin))
    mark = square.resize((inner, inner), Image.LANCZOS)
    canvas.paste(mark, ((size - inner) // 2, (size - inner) // 2), mark)
    return canvas
icon(192, .14).save('public/icons/icon-192.png', optimize=True)
icon(512, .14).save('public/icons/icon-512.png', optimize=True)
icon(180, .1).convert('RGB').save('public/icons/apple-touch-icon.png', optimize=True)
icon(32, .04).save('public/icons/favicon-32.png', optimize=True)
icon(48, .04).save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

# The signature (black on white) as a transparent brown stroke.
# Flattened on white first: the source may already have a transparent background.
source = Image.open(signature_src).convert('RGBA')
flat = Image.new('RGBA', source.size, (255, 255, 255, 255)); flat.alpha_composite(source)
sig = flat.convert('L')
mask = sig.point(lambda v: 255 - v)
stroke = Image.new('RGBA', sig.size, (74, 46, 27, 255)); stroke.putalpha(mask)
stroke = stroke.crop(stroke.getbbox())
stroke.thumbnail((520, 300)); stroke.save('public/images/signature.png', optimize=True)
print('ok')
