# Journal des versions

Le jeu suit le [versionnage sémantique](https://semver.org/lang/fr/) : **MAJEUR.MINEUR.CORRECTIF**.

- **MAJEUR** : un changement qui casse la compatibilité (format des données, règles Firebase à recoller avant la mise en ligne, anciens clients inutilisables).
- **MINEUR** : une nouvelle fonction qui ne casse rien.
- **CORRECTIF** : la correction d'un bug.

Avant la 1.0.0, les versions étaient de simples numéros (v1 à v79). Pour les comparer, un ancien numéro N vaut 0.N.0.

## 1.9.1 — 31 octobre 2026

Correctif : le bouton « Inviter un nouveau joueur » (ex-« Partager le lien ») ne faisait rien quand le navigateur refusait la copie ou n'avait pas de partage intégré (ordinateur, appli iPhone) : une fenêtre du navigateur, souvent bloquée, était la seule issue. Le lien est maintenant copié, ou affiché dans la page avec un bouton « Copier le lien ».

## 1.9.0 — 31 octobre 2026


Nouveau : **Mode frauduleux** 😈 (réglage du salon). La triche est permise : on peut jouer n'importe quelle carte, y compris ne pas fournir la couleur. Les autres voient seulement une carte posée, mais peuvent accuser (« 🕵️ J'accuse ») une carte du pli en cours ou du pli précédent. L'appareil de l'organisateur vérifie : tricheur pris = −5 points, fausse accusation = −5 points pour l'accusateur. Partie hors ligue et jamais analysée, pas de jeu automatique. Les robots sont acceptés (pour tester à deux, par exemple) mais ne trichent jamais : les accuser est une fausse accusation. Le mode va vite : en le cochant, la partie passe en format rapide (5 manches, 5 cartes au plus) avec 10 secondes par tour. Le salon affiche aussi la **durée estimée** de toute partie. Aucun changement de règles Firebase.

## 1.8.0 — 30 octobre 2026

Nouveau : **Découverte**, pour apprendre à se servir du site sans explication. (1) Une personne invitée par un lien et sans profil arrive sur un écran simplifié : son prénom et « Rejoindre ». (2) Dans le salon, le bouton devient « Inviter un nouveau joueur ». (3) Conseils d'une ligne, une seule fois par situation (je suis prêt, j'annonce, je joue), sans fenêtre qui bloque ; réglage « Conseils » dans ⚙️ Paramètres. (4) Un bouton ❓ dans la partie explique ce qu'il faut faire à ce moment-là. (5) Toucher une carte grisée dit pourquoi (« Tu dois jouer du pique »). (6) La **vue table** est activée d'office pour les nouveaux joueurs (ceux qui jouent déjà gardent leur réglage). (7) Le choix du paquet (« Tes cartes ») est aussi dans ⚙️ Paramètres, donc modifiable en pleine partie ; Halloween n'est plus le paquet par défaut à partir du 1er novembre (Café Jacquet à la place), mais reste disponible. (8) Pour un nouveau joueur, le jeu automatique (carte unique jouée toute seule) est éteint d'office, et quand il agit le message explique pourquoi (« Tu n'avais que du pique… »). (9) Un nouveau joueur ne reçoit plus la fenêtre « Nouveautés ». (10) **Visite de l'appli** : une visite guidée de l'accueil qui éclaire chaque vrai bouton (prénom, profil, partie rapide, rejoindre, créer, vraies cartes, ligue, amis, règles, réglages, langue) avec une bulle explicative, une main qui pointe et un bouton « Passer » ; elle se propose aux nouveaux appareils par une carte « Première fois ? » (fermable) et se rouvre depuis ⚙️ Paramètres sur l'accueil. (11) **Référencement** : trois nouvelles pages publiques (feuille de score du Rikiki à imprimer, « Rikiki, Ascenseur, Oh Hell : quelle différence ? », et la version anglaise « Oh Hell score sheet »), le mot « Ascenseur » ajouté aux titres et descriptions, une image d'aperçu pour les partages (WhatsApp, Reddit, Facebook) et les pages listées dans le plan du site. Aucun changement de règles Firebase.

## 1.7.1 — 29 octobre 2026

Correctif : dans le salon, le message « ⚠ ancienne version : doit recharger la page » s'affichait à côté de tous les autres joueurs, même ceux qui étaient à jour (la comparaison des versions ne marchait plus depuis les numéros « 1.x.x »). Il n'apparaît plus que pour un joueur réellement en retard.

## 1.7.0 — 26 octobre 2026

Nouveau : **Grandes cartes**. Une option dans ⚙️ Paramètres agrandit la main du bas, les cartes du pli, l'atout et les petites cartes (environ 30 %), pour les tablettes et les personnes qui voient moins bien. Elle est **activée d'office sur tablette et grand écran** (largeur d'au moins 768 px) et éteinte sur téléphone ; chacun peut la changer, le choix est gardé sur l'appareil. Aucun changement de règles Firebase.

## 1.6.1 — 26 octobre 2026

Vue table (test) : les cartes posées devant chaque joueur sont plus grandes (62 px, 50 px à 6 joueurs ou plus) et rapprochées du centre ; elles peuvent se chevaucher légèrement.

## 1.6.0 — 26 octobre 2026

Nouveau (en test) : **Vue table**. Une option dans ⚙️ Paramètres (« Vue table (test) », éteinte par défaut) affiche la partie avec les joueurs assis autour d'une table, toi en bas, chacun avec un avatar d'animal, sa carte du pli devant lui, ses annonces et son score ; le donneur porte un « D ». Même jeu, seul l'affichage change. Aucun changement de règles Firebase.

## 1.5.0 — 26 octobre 2026

Nouveau : le **tournoi du dimanche** est activé. Chaque dimanche (heure de Belgique), les parties de ligue en ligne jouées ce jour-là forment un tournoi (classé à partir de 2 parties), affiché en haut de Ligue › En ligne avec un palmarès. Le dimanche, un bandeau sur l'accueil invite à jouer, puis **annonce le résultat du soir à 21 h** (provisoire jusqu'à minuit). Aucun changement de règles Firebase.

## 1.4.0 — 26 octobre 2026

Nouveau : **Signaler un bug**. Un bouton dans ⚙️ Paramètres permet d'écrire une phrase ; le jeu y joint sa version, l'appareil, l'écran ou la partie en cours et les dernières erreurs (jamais le code secret ni les cartes). Si le jeu rencontre une erreur, il propose d'envoyer un rapport (jamais sans clic). Les signalements sont rangés dans Firebase (`bugReports`), lisibles par l'organisateur seulement dans Ligue › Entretien, et effacés automatiquement après 180 jours. **Règles Firebase modifiées : les publier AVANT le code.** Pages de confidentialité (FR/EN) mises à jour.

## 1.3.0 — 26 octobre 2026

Référencement : deux nouvelles pages publiques de règles, **Règles du Rikiki** (français) et **How to play Rikiki (Oh Hell)** (anglais), avec questions fréquentes et liens entre les deux langues. Le plan du site (`sitemap.xml`) les liste, un lien « Règles du Rikiki / How to play » apparaît en bas de l'accueil, et le titre, la description et la fiche de la page d'accueil visent les mots-clés français et anglais. Aucun changement dans le jeu lui-même.

## 1.2.1 — 26 octobre 2026

Référencement : l'adresse « officielle » donnée aux moteurs de recherche (balise canonique, aperçu de partage, fiche du jeu) est maintenant rikikigame.com au lieu de l'ancienne adresse github.io, et un fichier `robots.txt` indique où trouver le plan du site. Aucun changement dans le jeu.

## 1.2.0 — 25 octobre 2026

Petit réglage interne du profil. Aucun changement visible pour les joueurs. Règles Firebase inchangées.

## 1.1.2 — 25 octobre 2026

Correctif : le bandeau « Tu as quitté ta partie … / Reprendre ma partie » s'affichait aussi pour une salle d'attente où la partie n'avait pas commencé. Il n'apparaît plus que pour une partie commencée, et le jeu vérifie que la partie existe encore avant de l'afficher.

## 1.1.1 — 25 octobre 2026

Correctif : un test des liens légaux supposait que le navigateur parle français ; il vérifie maintenant les deux langues. Aucun changement dans le jeu.

## 1.1.0 — 25 octobre 2026

Nouveau : les 4 pages légales (confidentialité, conditions, cookies, mentions légales) existent aussi **en anglais** (`*.en.html`), avec un lien « English / Français » en haut de chaque page. Les liens du jeu (bannière, case des conditions, pied de page) mènent à la version dans la langue choisie. La version française fait foi. Le texte français sur la suppression de compte décrit maintenant le vrai bouton.

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
