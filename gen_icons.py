from PIL import Image, ImageDraw
import math

def gradient_bg(size):
    img = Image.new("RGB", (size, size))
    top = (28, 42, 82)
    bottom = (11, 18, 36)
    for y in range(size):
        t = y / size
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        for x in range(size):
            img.putpixel((x, y), (r, g, b))
    return img

def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask

def draw_icon(size, content_scale, maskable):
    img = gradient_bg(size)
    draw = ImageDraw.Draw(img, "RGBA")
    cx, cy = size / 2, size / 2 * 0.96
    s = size * content_scale

    # Soleil (doré) légèrement en haut à droite du nuage.
    sun_r = s * 0.20
    sun_cx, sun_cy = cx + s * 0.14, cy - s * 0.30
    draw.ellipse([sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r], fill=(255, 200, 87, 255))

    # Nuage (blanc) : trois cercles + base rectangulaire arrondie.
    cloud_w = s * 0.62
    cloud_h = s * 0.34
    base_y = cy + s * 0.05
    draw.ellipse([cx - cloud_w * 0.55, base_y - cloud_h * 1.05, cx - cloud_w * 0.05, base_y + cloud_h * 0.25], fill=(255, 255, 255, 255))
    draw.ellipse([cx - cloud_w * 0.15, base_y - cloud_h * 1.5, cx + cloud_w * 0.45, base_y + cloud_h * 0.25], fill=(255, 255, 255, 255))
    draw.ellipse([cx + cloud_w * 0.05, base_y - cloud_h * 0.9, cx + cloud_w * 0.62, base_y + cloud_h * 0.25], fill=(255, 255, 255, 255))
    draw.rounded_rectangle([cx - cloud_w * 0.55, base_y - cloud_h * 0.3, cx + cloud_w * 0.62, base_y + cloud_h * 0.55], radius=cloud_h * 0.5, fill=(255, 255, 255, 255))

    if not maskable:
        mask = rounded_mask(size, size * 0.22)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img

for size in (192, 512):
    draw_icon(size, 0.62, maskable=False).save(f"icons/icon-{size}.png")
    draw_icon(size, 0.46, maskable=True).save(f"icons/icon-{size}-maskable.png")

print("icons ok")
