"""Подключает фото блюд к меню.

Положите фото в assets/img/menu/ с именем, равным id блюда из menu.js
(например philadelphia-with-avocado.webp), и запустите:

    python3 tools/link_photos.py

Скрипт пропишет поле image всем блюдам, для которых нашлось фото,
и уберёт его у тех, чьё фото удалили.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MENU = os.path.join(ROOT, 'assets', 'js', 'menu.js')
PHOTOS = os.path.join(ROOT, 'assets', 'img', 'menu')
EXT = ('.webp', '.jpg', '.jpeg', '.png', '.avif')

photos = {}
for name in sorted(os.listdir(PHOTOS)):
    base, ext = os.path.splitext(name)
    if ext.lower() in EXT:
        photos.setdefault(base, f'assets/img/menu/{name}')

src = open(MENU, encoding='utf-8').read()
ids, linked = set(), 0

def update(m):
    global linked
    line, item_id = m.group(0), m.group(1)
    ids.add(item_id)
    line = re.sub(r', image: "[^"]*"', '', line)
    if item_id in photos:
        linked += 1
        line = line[:-2] + f', image: "{photos[item_id]}" }}'
    return line

src = re.sub(r'\{ id: "([^"]+)",.*? \}', update, src)
open(MENU, 'w', encoding='utf-8').write(src)

unknown = sorted(set(photos) - ids)
print(f'Фото подключено: {linked} из {len(ids)} блюд')
if unknown:
    print('Нет блюда с таким id (проверьте имя файла):', ', '.join(unknown))
