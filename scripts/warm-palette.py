# One-off: turns the green palette inherited from ART sur bois into wood tones.
# Every green or grey-green colour (hue 50°–200°) gets a walnut/honey hue with
# the same lightness and saturation; reds, ambers and purples are left alone.
#   python scripts/warm-palette.py src/styles.css
import colorsys, re, sys

def warm(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s < 0.02 or not (50 / 360 <= h <= 200 / 360):
        return r, g, b
    target = 34 / 360 if l > 0.55 else 26 / 360
    r2, g2, b2 = colorsys.hls_to_rgb(target, l, min(1, s * 1.05))
    return round(r2 * 255), round(g2 * 255), round(b2 * 255)

def hex_color(match):
    value = match.group(1)
    if len(value) == 3:
        value = ''.join(c * 2 for c in value)
    r, g, b = warm(int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))
    return '#%02x%02x%02x' % (r, g, b)

def rgba(match):
    r, g, b = warm(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    return f'rgba({r},{g},{b},{match.group(4)})'

path = sys.argv[1]
css = open(path, encoding='utf-8').read()
css = re.sub(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b', hex_color, css)
css = re.sub(r'rgba\((\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\)', rgba, css)
open(path, 'w', encoding='utf-8').write(css)
print('ok')
