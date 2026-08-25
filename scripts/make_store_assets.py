# 플레이스토어 그래픽 자산 생성 — 피처 그래픽(1024×500)
# 아이콘 전경(assets/icon-foreground.png)을 재사용해 2배 크기로 그린 뒤 축소
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 2048, 1000  # 최종 1024×500


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


# 대각선 느낌의 가로 그라데이션
img = Image.new('RGB', (W, 1))
for x in range(W):
    img.putpixel((x, 0), lerp((29, 78, 216), (79, 141, 255), x / (W - 1)))
img = img.resize((W, H)).convert('RGBA')

# 은은한 장식 원
deco = Image.new('RGBA', (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
dd.ellipse([W * 0.62, -H * 0.7, W * 1.25, H * 0.75], fill=(255, 255, 255, 16))
dd.ellipse([-W * 0.12, H * 0.55, W * 0.22, H * 1.6], fill=(255, 255, 255, 14))
img.alpha_composite(deco)

# 왼쪽: 카드 스택 (아이콘 전경 재사용 — 실제 그림은 이미지 중앙 ~62%에만 있음)
cards = Image.open(os.path.join(ROOT, 'assets', 'icon-foreground.png')).convert('RGBA')
cards = cards.resize((int(H * 1.2), int(H * 1.2)), Image.LANCZOS)
img.alpha_composite(cards, (0, int(H * 0.5 - cards.height / 2)))

# 오른쪽: 텍스트 (반투명 요소는 레이어에 그려 알파 합성 — 픽셀 덮어쓰기 방지)
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
f_title = ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf', 180)
f_sub = ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf', 70)
f_tag = ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf', 45)

tx = int(W * 0.47)
d.text((tx, int(H * 0.17)), '보카3000', font=f_title, fill=(255, 255, 255, 255))
d.text((tx + 6, int(H * 0.44)), '초·중·고 필수 영단어 3,000', font=f_sub, fill=(219, 231, 255, 255))

# 태그 알약 3개
tags = ['암기 카드', '문제집 · 문법', '100% 오프라인']
x = tx + 6
y = int(H * 0.64)
for t in tags:
    l, tt, r, b = d.textbbox((0, 0), t, font=f_tag)
    pw, ph = (r - l) + 48, (b - tt) + 32
    d.rounded_rectangle([x, y, x + pw, y + ph], radius=ph // 2,
                        fill=(255, 255, 255, 45), outline=(255, 255, 255, 130), width=3)
    d.text((x + 24 - l, y + 16 - tt), t, font=f_tag, fill=(255, 255, 255, 255))
    x += pw + 20

img.alpha_composite(layer)

out_dir = os.path.join(ROOT, 'store', 'assets')
os.makedirs(out_dir, exist_ok=True)
img.convert('RGB').resize((1024, 500), Image.LANCZOS).save(os.path.join(out_dir, 'feature-graphic.png'))
print('done')
