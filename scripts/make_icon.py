# 보카3000 앱 아이콘 생성 — 4배 크기로 그려서 다운스케일(안티앨리어싱)
# 디자인: 파랑 그라데이션 배경 + 흰 단어 카드 2장 스택(살짝 기울임)
#         카드 위에 A(영어)·가(한글), 하단에 3000 배지
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 2048  # 작업 크기 (최종 512/192로 축소)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_bg(size, top, bottom):
    img = Image.new('RGB', (1, size))
    for y in range(size):
        img.putpixel((0, y), lerp(top, bottom, y / (size - 1)))
    return img.resize((size, size))


def rounded_card(w, h, radius, fill, outline=None, ow=0):
    card = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=fill,
                        outline=outline, width=ow)
    return card


def paste_rotated(base, img, angle, center):
    rot = img.rotate(angle, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(rot, (center[0] - rot.width // 2, center[1] - rot.height // 2))


def text_center(draw, xy, text, font, fill):
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    draw.text((xy[0] - (r - l) / 2 - l, xy[1] - (b - t) / 2 - t), text, font=font, fill=fill)


# ---- 배경: 밝은 파랑 → 짙은 파랑 그라데이션 ----
bg = gradient_bg(S, (79, 141, 255), (29, 78, 216)).convert('RGBA')

# 은은한 장식: 큰 원 두 개 (아주 연하게)
deco = Image.new('RGBA', (S, S), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
dd.ellipse([S * 0.55, -S * 0.25, S * 1.35, S * 0.55], fill=(255, 255, 255, 18))
dd.ellipse([-S * 0.3, S * 0.6, S * 0.45, S * 1.35], fill=(255, 255, 255, 14))
bg.alpha_composite(deco)

# ---- 카드 스택 ----
cw, ch, cr = int(S * 0.56), int(S * 0.66), int(S * 0.09)

# 그림자
shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
sc = rounded_card(cw, ch, cr, (13, 42, 110, 120))
paste_rotated(shadow, sc, -6, (S // 2 + int(S * 0.015), S // 2 + int(S * 0.045)))
shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.02))
bg.alpha_composite(shadow)

# 뒷카드 (반투명 흰색, 반대로 기울임)
back = rounded_card(cw, ch, cr, (255, 255, 255, 110))
paste_rotated(bg, back, 7, (S // 2 + int(S * 0.045), S // 2 - int(S * 0.01)))

# 앞카드 (흰색)
front = rounded_card(cw, ch, cr, (255, 255, 255, 255))
fd = ImageDraw.Draw(front)

# 카드 내용: A / 가 / 3000 배지
f_a = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', int(S * 0.30))
f_ga = ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf', int(S * 0.155))
f_badge = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', int(S * 0.083))

text_center(fd, (cw * 0.5, ch * 0.30), 'A', f_a, (23, 32, 58))
text_center(fd, (cw * 0.5, ch * 0.60), '가', f_ga, (37, 99, 235))

# 3000 배지 (앰버 알약)
bw, bh = int(cw * 0.62), int(ch * 0.155)
bx, by = int(cw * 0.5 - bw / 2), int(ch * 0.775)
fd.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 2, fill=(255, 193, 7))
bd = ImageDraw.Draw(front)
text_center(bd, (cw * 0.5, ch * 0.775 + bh / 2 - ch * 0.004), '3000', f_badge, (63, 43, 0))

paste_rotated(bg, front, -6, (S // 2 - int(S * 0.005), S // 2))

# ---- 출력 ----
out = bg.convert('RGB')
base = r'C:\Users\jeond\영단어3000\vocab-3000\public\icons'
out.resize((512, 512), Image.LANCZOS).save(base + r'\icon-512.png')
out.resize((192, 192), Image.LANCZOS).save(base + r'\icon-192.png')
out.resize((512, 512), Image.LANCZOS).save(
    r'C:\yTemp\claude\C--Users-jeond----3000\e046d8b8-b575-47d4-aaa5-b2ceb8bbae06\scratchpad\icon-preview.png')
print('done')
