# 보카3000 앱 아이콘 생성 — 4배 크기로 그려서 다운스케일(안티앨리어싱)
# 디자인: 파랑 그라데이션 배경 + 흰 단어 카드 2장 스택(살짝 기울임)
#         카드 위에 A(영어)·가(한글), 하단에 3000 배지
# 출력:
#   public/icons/icon-512.png, icon-192.png     (PWA)
#   assets/icon-only.png, icon-foreground.png,  (안드로이드 — @capacitor/assets 입력)
#   assets/icon-background.png, splash.png, splash-dark.png
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 2048  # 작업 크기
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_bg(size, top, bottom):
    img = Image.new('RGB', (1, size))
    for y in range(size):
        img.putpixel((0, y), lerp(top, bottom, y / (size - 1)))
    return img.resize((size, size))


def rounded_card(w, h, radius, fill):
    card = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=fill)
    return card


def paste_rotated(base, img, angle, center):
    rot = img.rotate(angle, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(rot, (center[0] - rot.width // 2, center[1] - rot.height // 2))


def text_center(draw, xy, text, font, fill):
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    draw.text((xy[0] - (r - l) / 2 - l, xy[1] - (b - t) / 2 - t), text, font=font, fill=fill)


def make_background(size=S):
    """그라데이션 + 은은한 원 장식 배경"""
    bg = gradient_bg(size, (79, 141, 255), (29, 78, 216)).convert('RGBA')
    deco = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    dd.ellipse([size * 0.55, -size * 0.25, size * 1.35, size * 0.55], fill=(255, 255, 255, 18))
    dd.ellipse([-size * 0.3, size * 0.6, size * 0.45, size * 1.35], fill=(255, 255, 255, 14))
    bg.alpha_composite(deco)
    return bg


def make_cards(scale=1.0):
    """카드 스택 레이어(투명 배경). scale로 안전 영역에 맞게 축소 가능"""
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    cw, ch, cr = int(S * 0.56 * scale), int(S * 0.66 * scale), int(S * 0.09 * scale)

    # 그림자
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sc = rounded_card(cw, ch, cr, (13, 42, 110, 120))
    paste_rotated(shadow, sc, -6, (S // 2 + int(S * 0.015 * scale), S // 2 + int(S * 0.045 * scale)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.02 * scale))
    layer.alpha_composite(shadow)

    # 뒷카드 (반투명 흰색, 반대로 기울임)
    back = rounded_card(cw, ch, cr, (255, 255, 255, 110))
    paste_rotated(layer, back, 7, (S // 2 + int(S * 0.045 * scale), S // 2 - int(S * 0.01 * scale)))

    # 앞카드
    front = rounded_card(cw, ch, cr, (255, 255, 255, 255))
    fd = ImageDraw.Draw(front)
    f_a = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', int(S * 0.30 * scale))
    f_ga = ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf', int(S * 0.155 * scale))
    f_badge = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', int(S * 0.083 * scale))

    text_center(fd, (cw * 0.5, ch * 0.30), 'A', f_a, (23, 32, 58))
    text_center(fd, (cw * 0.5, ch * 0.60), '가', f_ga, (37, 99, 235))
    bw, bh = int(cw * 0.62), int(ch * 0.155)
    bx, by = int(cw * 0.5 - bw / 2), int(ch * 0.775)
    fd.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 2, fill=(255, 193, 7))
    text_center(fd, (cw * 0.5, ch * 0.775 + bh / 2 - ch * 0.004), '3000', f_badge, (63, 43, 0))

    paste_rotated(layer, front, -6, (S // 2 - int(S * 0.005 * scale), S // 2))
    return layer


# ---- PWA 아이콘 (전체 합성) ----
full = make_background()
full.alpha_composite(make_cards())
out = full.convert('RGB')

pwa_dir = os.path.join(ROOT, 'public', 'icons')
out.resize((512, 512), Image.LANCZOS).save(os.path.join(pwa_dir, 'icon-512.png'))
out.resize((192, 192), Image.LANCZOS).save(os.path.join(pwa_dir, 'icon-192.png'))

# ---- 안드로이드용 (assets/ — @capacitor/assets generate 입력) ----
assets = os.path.join(ROOT, 'assets')
os.makedirs(assets, exist_ok=True)
out.resize((1024, 1024), Image.LANCZOS).save(os.path.join(assets, 'icon-only.png'))
# 어댑티브 아이콘: 전경은 안전 영역(중앙 ~66%)에 들어가게 축소, 배경은 그라데이션
fg = make_cards(scale=0.62)
fg.resize((1024, 1024), Image.LANCZOS).save(os.path.join(assets, 'icon-foreground.png'))
make_background().convert('RGB').resize((1024, 1024), Image.LANCZOS) \
    .save(os.path.join(assets, 'icon-background.png'))

# 스플래시(2732×2732): 그라데이션 배경 중앙에 카드
splash = make_background()
splash.alpha_composite(make_cards(scale=0.5))
splash.convert('RGB').resize((2732, 2732), Image.LANCZOS).save(os.path.join(assets, 'splash.png'))
splash.convert('RGB').resize((2732, 2732), Image.LANCZOS).save(os.path.join(assets, 'splash-dark.png'))

print('done')
