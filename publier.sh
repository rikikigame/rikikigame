#!/bin/zsh
# Envoie le contenu de "1 - À publier" vers GitHub (le site se met à jour tout seul en ~1 minute).
cd "$(dirname "$0")" || exit 1
P="$HOME/Downloads/Rikiki/1 - À publier"
cp "$P/index.html" index.html || exit 1
rsync -a --delete --exclude .DS_Store "$P/src/" src/
cp "$P/build.py" build.py
cp "$P/README-GITHUB.md" README.md
printf '.DS_Store\n' > .gitignore
git rm -q --cached rikiki-sons-demo.html 2>/dev/null
V=$(grep -o "APP_VERSION = '[0-9]*'" index.html | grep -o "[0-9]*")
git add -A
if git diff --cached --quiet && [ -z "$(git log origin/main..HEAD)" ]; then echo "Rien de nouveau : GitHub a déjà cette version (v$V)."; exit 0; fi
git diff --cached --quiet || git commit -q -m "Version $V"
if git push origin HEAD; then echo "Terminé : version $V envoyée."; else echo "ÉCHEC : rien n'est parti sur GitHub."; exit 1; fi
