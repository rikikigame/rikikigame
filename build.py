"""Recolle les dossiers src/ en un seul index.html (c'est ce fichier-là que le site charge).
Usage : python3 build.py   (écrit index.html à côté de ce script)"""
import glob, os
ici = os.path.dirname(os.path.abspath(__file__))
def lire(p): return open(os.path.join(ici, p), encoding='utf-8').read()
css = lire('src/css/style.css')
js = ''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(ici, 'src/js/*.js'))))
page = lire('src/index.modele.html')
page = page.replace('/*@CSS@*/', css.rstrip('\n'), 1).replace('/*@JS@*/', "(function(){\n'use strict';\n\n" + js.rstrip('\n') + "\n})();", 1)
open(os.path.join(ici, 'index.html'), 'w', encoding='utf-8').write(page)
print('index.html construit :', len(page), 'octets')
