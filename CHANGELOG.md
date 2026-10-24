# Journal des versions

Le jeu suit le [versionnage sémantique](https://semver.org/lang/fr/) : **MAJEUR.MINEUR.CORRECTIF**.

- **MAJEUR** : un changement qui casse la compatibilité (format des données, règles Firebase à recoller avant la mise en ligne, anciens clients inutilisables).
- **MINEUR** : une nouvelle fonction qui ne casse rien.
- **CORRECTIF** : la correction d'un bug.

Avant la 1.0.0, les versions étaient de simples numéros (v1 à v79). Pour les comparer, un ancien numéro N vaut 0.N.0.

## 1.0.0 — 24 octobre 2026

Première version « officielle » : le jeu est servi sur **rikikigame.com** et la partie légale est active.

- Partie légale : pages de confidentialité, conditions, cookies et mentions légales ; bannière de consentement ; case des conditions à l'inscription.
- « Supprimer mon compte » dans le profil.
- Le profil de l'organisateur refuse toute demande « Code oublié ».
- Duels de fin de partie (pire ennemi, victime préférée) et fiche des joueurs réguliers.
- Jeu automatique quand une seule carte est jouable (réglable).
- « Reprendre ma partie », double validation avant de quitter une partie en cours, invitation à créer un profil pour les invités.
- Poignée ☰ pour réordonner les joueurs en mode « Vraies cartes », suggestions de prénoms.
- Nettoyage automatique des salles d'attente et des parties abandonnées (quand l'organisateur ouvre le jeu).
- Le tournoi du dimanche est prêt dans le code mais **désactivé** (`TOURNEY_READY = false`).
- Passage au versionnage sémantique.

## Avant 1.0.0

v73 à v79 : polices hébergées, accessibilité, comptes sécurisés à code de 4 chiffres, ligue (couronne, coupes), sondage du nom du paquet, paquet Halloween, nouveautés. Le détail est dans `CLAUDE.md`.
