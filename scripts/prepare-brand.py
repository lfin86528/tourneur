# Builds the brand images from the source logo (drawn on white) and the
# signature (black stroke, transparent background).
#   python scripts/prepare-brand.py <logo.png> <signature.png>
# Outputs: public/images/logo-tourneur.png (mark + "tourneur.ch"), public/icons/
# logo-mark.png (the mark alone) and the app icons, public/images/signature.png.
import sys
from PIL import Image

logo_src, signature_src = sys.argv[1], sys.argv[2]
PAPER = (247, 243, 236, 255)

def unwhite(image):
    """Removes the white background: alpha from how far a pixel is from white,
    colour recovered as if it had been drawn on white."""
    rgb = image.convert('RGB')
    out = Image.new('RGBA', rgb.size)
    src, dst = rgb.load(), out.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = src[x, y]
            a = 255 - min(r, g, b)
            if a < 8:
                dst[x, y] = (0, 0, 0, 0)
                continue
            f = a / 255
            un = lambda c: max(0, min(255, round((c - 255 * (1 - f)) / f)))
            dst[x, y] = (un(r), un(g), un(b), min(255, round(a * 1.08)))
    return out

logo = unwhite(Image.open(logo_src))
logo = logo.crop(logo.getbbox())
logo.save('public/images/logo-tourneur.png', optimize=True)

# The mark: the drawing above the lettering (first fully empty row from the bottom half).
alpha = logo.split()[3].load()
rows = [any(alpha[x, y] for x in range(logo.width)) for y in range(logo.height)]
gap = next(y for y in range(logo.height // 2, logo.height) if not rows[y])
mark = logo.crop((0, 0, logo.width, gap))
mark = mark.crop(mark.getbbox())
# For the icons, the circle alone: the horizon line runs far beyond it, which would
# shrink the drawing. Columns are taken from the rows the line does not fill.
a = mark.split()[3].load()
full = lambda y: sum(1 for x in range(mark.width) if a[x, y]) > mark.width * .6
cols = [x for x in range(mark.width) if any(a[x, y] for y in range(mark.height) if not full(y))]
mark = mark.crop((min(cols), 0, max(cols) + 1, mark.height))
# Thin, light strokes vanish at icon size: make them darker and more opaque.
mark = Image.merge('RGBA', [*Image.new('RGB', mark.size, (74, 46, 27)).split(), mark.split()[3].point(lambda v: min(255, int(v * 1.7)))])
side = max(mark.size)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
square.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2), mark)
square.resize((512, 512), Image.LANCZOS).save('public/icons/logo-mark.png', optimize=True)

# App icons: the mark on the site's paper colour, with a margin (maskable safe zone).
def icon(size, margin):
    canvas = Image.new('RGBA', (size, size), PAPER)
    inner = int(size * (1 - 2 * margin))
    scaled = square.resize((inner, inner), Image.LANCZOS)
    canvas.paste(scaled, ((size - inner) // 2, (size - inner) // 2), scaled)
    return canvas
icon(192, .12).save('public/icons/icon-192.png', optimize=True)
icon(512, .12).save('public/icons/icon-512.png', optimize=True)
icon(180, .08).convert('RGB').save('public/icons/apple-touch-icon.png', optimize=True)
icon(32, .02).save('public/icons/favicon-32.png', optimize=True)
icon(48, .02).save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

# The signature as a walnut-brown stroke, keeping its transparency.
source = Image.open(signature_src).convert('RGBA')
flat = Image.new('RGBA', source.size, (255, 255, 255, 255)); flat.alpha_composite(source)
stroke = Image.new('RGBA', source.size, (74, 46, 27, 255))
stroke.putalpha(flat.convert('L').point(lambda v: 255 - v))
stroke = stroke.crop(stroke.getbbox())
stroke.thumbnail((560, 260), Image.LANCZOS)
stroke.save('public/images/signature.png', optimize=True)
print('logo', logo.size, 'mark', mark.size, 'signature', stroke.size)
