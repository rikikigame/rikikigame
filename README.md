# Rikiki 🃏

Jeu de cartes **Rikiki** (jeu de plis à annonces) en ligne, jouable sur navigateur et iPhone.
Jouer : https://rikikigame.github.io/rikikigame/

## Où est quoi ?

| Dossier / fichier | Contenu |
|---|---|
| `index.html` | **Le jeu complet**, fabriqué automatiquement à partir de `src/`. C'est ce fichier que le site charge. Ne pas le modifier à la main. |
| `src/css/style.css` | Tout l'habillage (couleurs, cartes, écrans). |
| `src/index.modele.html` | Le squelette de la page. |
| `src/js/` | Le code, découpé par sujet et numéroté dans l'ordre de lecture (voir ci-dessous). |
| `build.py` | Recolle `src/` en `index.html` : `python3 build.py`. |

## Les fichiers de `src/js/`

1. `01-constantes` — réglages de base, version.
2. `02-outils` — petites fonctions utiles (dates, aléatoire…).
3. `03-robots` — l'intelligence des robots (annonces, jeu des cartes).
4. `04-biere` — le lien discret « Offrir une bière ».
5. `05-langues` — français / anglais.
6. `06-cartes-cafe` — le jeu de cartes illustré « Café Jacquet ».
7. `07-reseau-local-et-firebase` — stockage : mode local de test et base en ligne (Firebase).
8. `08-etat-et-demarrage` — l'état du jeu et son initialisation.
9. `09-actions-de-jeu` — créer, rejoindre, annoncer, jouer une carte.
10. `10-relais-hote` — le relais automatique quand l'hôte est parti.
11. `11-rejouer-minuteur-chat` — rejouer, minuteur, chat avec GIF.
12. `12-profils-et-codes` — pseudos, codes, code oublié.
13. `13-analyse-des-bots` — analyse des parties, niveau des robots.
14. `14-coach` — le coach Albert.
15. `15-sauvegarde-ligue-et-entretien` — sauvegarde de la ligue, outils d'entretien.
16. `16-comptes-et-amis` — vrais comptes, amis, invitations.
17. `17-donne-secrete` — donne secrète et historique.
18. `18-accueil-et-tuto` — écran d'accueil, tuto des règles.
19. `19-affichage` — dessin des écrans.
20. `20-sons-et-musique` — bruitages et musique de café (tout est synthétisé).
21. `21-verification-et-confirmation-ligue` — contrôle des scores, confirmation des parties de ligue.
22. `22-cartes-reelles` — feuille de score pour les parties aux vraies cartes.
23. `23-ligue-classement` — la ligue et le classement Elo.
24. `24-evenements-et-demarrage` — clics et démarrage du jeu.

## Modifier le jeu

1. Modifier le bon fichier dans `src/`.
2. `python3 build.py` pour reconstruire `index.html`.
3. Envoyer sur GitHub : le site se met à jour tout seul en une minute environ.

Les règles de sécurité de la base de données (Firebase) ne sont pas dans ce dépôt : elles se collent dans la console Firebase.
