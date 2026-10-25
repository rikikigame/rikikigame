# Journal des versions

Le jeu suit le [versionnage sémantique](https://semver.org/lang/fr/) : **MAJEUR.MINEUR.CORRECTIF**.

- **MAJEUR** : un changement qui casse la compatibilité (format des données, règles Firebase à recoller avant la mise en ligne, anciens clients inutilisables).
- **MINEUR** : une nouvelle fonction qui ne casse rien.
- **CORRECTIF** : la correction d'un bug.

Avant la 1.0.0, les versions étaient de simples numéros (v1 à v79). Pour les comparer, un ancien numéro N vaut 0.N.0.

## 1.0.8 — 25 octobre 2026

Quand un compte est supprimé, l'adresse technique gardée dans le profil vidé (qui contenait le pseudo) est remplacée par une adresse neutre « supprime@rikiki.invalid ». Aucun autre changement.

## 1.0.7 — 25 octobre 2026

Correctif : « Supprimer mon compte » ne faisait rien dans certains navigateurs, parce que la dernière confirmation passait par une fenêtre du navigateur qui peut être bloquée. La confirmation se fait maintenant dans la page (un second bouton « Oui, supprimer pour toujours »), un message « Suppression en cours… » s'affiche, et ce que tu écris dans les champs n'est plus effacé quand l'écran se redessine.

## 1.0.6 — 25 octobre 2026

Les pages légales (mentions légales, confidentialité, conditions, cookies) indiquent le pseudo « K.vroom » comme éditeur au lieu du nom réel. Elles précisent que l'identité complète est communiquée aux autorités sur demande. Aucun changement dans le jeu.

## 1.0.5 — 25 octobre 2026

Correctif : le nettoyage automatique ne supprime plus que les salles d'attente et les parties commencées puis abandonnées. Avant, il supprimait aussi d'anciennes parties terminées sans étiquette de statut (23 copies de parties, sans effet sur la ligue ni sur l'analyse).

## 1.0.4 — 25 octobre 2026

Correctif : le test automatique de GitHub attend plus longtemps le démarrage du navigateur et refait une partie jusqu'à 3 fois si le navigateur ne répond pas (il échouait au hasard sur la première partie). Aucun changement dans le jeu.

## 1.0.3 — 24 octobre 2026

Correctif : la fenêtre « Notes de version » (on y arrive en touchant le numéro en bas de l'accueil) affichait toujours « v64 » et d'anciennes nouveautés. Elle affiche maintenant le vrai numéro, ce qui a changé depuis la v64 en français simple, et une phrase pour lire le numéro.

## 1.0.2 — 24 octobre 2026

Correctif : un test de description des cartes dépendait de la langue du navigateur (français sur ton Mac, anglais chez GitHub). Le résultat des parties de robots s'affiche maintenant dans le résumé de chaque contrôle automatique. Aucun changement dans le jeu.

## 1.0.1 — 24 octobre 2026

Correctif : les tests automatiques de GitHub (parties de robots) ne trouvaient pas le dossier des polices. Aucun changement dans le jeu.

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
