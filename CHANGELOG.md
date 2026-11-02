# Journal des versions

Le jeu suit le [versionnage sémantique](https://semver.org/lang/fr/) : **MAJEUR.MINEUR.CORRECTIF**.

- **MAJEUR** : un changement qui casse la compatibilité (format des données, règles Firebase à recoller avant la mise en ligne, anciens clients inutilisables).
- **MINEUR** : une nouvelle fonction qui ne casse rien.
- **CORRECTIF** : la correction d'un bug.

Avant la 1.0.0, les versions étaient de simples numéros (v1 à v79). Pour les comparer, un ancien numéro N vaut 0.N.0.

## 1.15.1 — 2 novembre 2026

- L'atout se voit mieux : les cartes d'atout (dans ta main, dans le pli et sur la table, avec la carte d'atout retournée) sont encadrées en jaune brillant, avec un halo qui pulse et un petit éclat qui passe. Coupé si le téléphone demande moins d'animations.

## 1.15.0 — 2 novembre 2026

- Bonus quotidien : 250 jetons chaque jour pour tout joueur connecté avec son profil, ajoutés à sa première entrée à une table du jour. Les textes du casino le disent. La faillite garde sa règle (250 une fois par jour sans profil, sinon 100). Règles Firebase inchangées.

## 1.14.2 — 2 novembre 2026

- Les textes du casino (salon, nouveautés) disent maintenant : sous 100 jetons, 250 jetons offerts une fois par jour ; chaque victoire de ligue au Rikiki rapporte 500 jetons.

## 1.14.1 — 1er novembre 2026

- Cadeau : 250 jetons, plus les points de leurs parties, pour tous ceux qui ont fini une partie de ligue en ligne le 1er novembre. À l'entrée à une table de casino (avant le 9 novembre), une seule fois, avec un profil connecté. Règles Firebase inchangées.

## 1.14.0 — 1er novembre 2026

Le casino reste un bonus : c'est le Rikiki qui fait gagner des jetons. Règles Firebase inchangées.

- Faillite (moins de 100 jetons) : plus de retour au montant de la ligue. Une petite aide de 250 jetons, une fois par jour ; si on retombe à zéro le même jour, 100 jetons (de quoi s'asseoir). Le départ de la ligue ne sert plus que la toute première fois (et pour le bouton de l'organisateur).
- Chaque victoire en ligue (partie en ligne) donne 500 jetons, ajoutés à l'entrée à la table suivante. Les victoires passées ne sont pas rattrapées.
- Blackjack : quand « Doubler » ou « Séparer » manque faute de jetons, une phrase explique qu'il faut autant de jetons de côté que la mise.

## 1.13.1 — 1er novembre 2026

Nouveau bouton « Remettre mes jetons au départ » dans ⚙️ Paramètres, réservé à l'organisateur (le casino repart avec tes jetons de départ : ligue ou 750). Aucun changement de règles Firebase.

## 1.13.0 — 1er novembre 2026 (RÈGLES FIREBASE CHANGÉES : publier les règles AVANT le code)

**Jetons sauvegardés** : ce que tu gagnes ou perds au casino est enregistré à la fin de chaque main / manche / tour et tu repars avec au prochain lancement (avec un profil : nœud `wallets/{profil}`, sur tous les appareils ; sans profil : `rikiki_wallet` sur l'appareil). Les points de ligue ne servent plus que pour la toute première fois, ou après une faillite (moins de 100 jetons : la maison prête de quoi rejouer). **Rejoindre une table en cours de partie** (poker, blackjack, roulette) tant qu'elle n'est pas complète (5 au blackjack, 8 ailleurs) : le nouvel arrivant dépose une demande (`lateJoin/{code}__{compte}`), l'organisateur l'ajoute, et il s'assoit à la main / manche / tour suivant avec son solde ; les amis voient un bouton « Rejoindre » même quand leur ami est déjà en partie de casino. **Robots du poker** : ils calculent maintenant leurs chances de gagner par tirages au sort (`pkEquity`), tiennent compte du nombre d'adversaires, de la taille des mises et de leur tapis, relancent pour la valeur, bluffent parfois et se couchent face à une grosse mise (avant : une simple règle sur la catégorie de la main). Nouvelles règles Firebase : `wallets` (écrit et lu seulement par le propriétaire du profil) et `lateJoin` (chacun n'écrit que sa propre demande, seul l'organisateur de la table les lit).

## 1.12.1 — 1er novembre 2026

Nouveautés : la phrase « Tous les jetons sont faux… » est retirée du texte du Casino de Fredo (elle reste dans les salons et les règles).

## 1.12.0 — 1er novembre 2026

Le **Mini casino est ouvert à tout le monde** (poker, blackjack, roulette, paquet Casino de Fredo comme paquet par défaut). Plus besoin du lien secret `#casino` ; l'interrupteur est `CASINO_PUBLIC` dans `01-constantes.js`. Aucun changement de règles Firebase.

## 1.11.2 — 1er novembre 2026

Table de blackjack redessinée : jusqu'à 4 joueurs sur une rangée en arc de cercle (celui du milieu plus bas), même décor que la table du poker (vert sombre, bord doré, inscriptions vertes). Le blackjack est limité à 5 joueurs par table (le salon affiche « n / 5 »). Les As du paquet Casino ont le jeton de leur couleur au milieu. Le casino reste caché ; aucun changement de règles Firebase.

## 1.11.1 — 1er novembre 2026

Correctifs et finitions du Mini casino, d'après les retours des premiers tests : Cartes Casino : jetons des figures plus gros, avec un signe plus grand (cœur/carreau et trèfle/pique se distinguaient mal). Points expliqués : nouvelle diapo « Les points et la victoire » dans le tuto (contrat réussi = bonus + points par pli, raté = pénalité par pli d'écart, le plus de points gagne), même rappel dans les règles, et la précision (% de manches exactes) s'affiche à côté des points à la fin de la partie et dans le récap. Cartes Casino : figures sur fond blanc, sans contour doré (le noir et or ressemblait à l'atout), « Casino de Fredo » sur toutes les figures (plus de « Chez Colette »). L'atout est bien plus visible (cadre doré vif avec halo, étiquette « ATOUT » avec le symbole, nom de la couleur dessous). Le Casino est le paquet par défaut quand le casino est visible, et l'accueil reste toujours Casino même si on joue avec un autre paquet. Téléphone : tes jetons restants s'affichent en haut de l'écran (poker, blackjack, roulette), les 4 boutons du blackjack tiennent dans l'écran (avant, « Séparer » était coupé et caché par la pastille de chat, qui se range maintenant au-dessus), la table du blackjack et celle du poker à 2-4 joueurs sont plus courtes, le croupier et la roue prennent moins de place. Blackjack : le total du croupier, les gains et la phrase de Fredo n'apparaissent qu'après la révélation (carte cachée retournée, puis cartes tirées). Textes : « Tous les jetons sont faux : on ne joue jamais avec de l'argent » partout. Le casino reste caché (lien secret `#casino`) ; aucun changement de règles Firebase.

## 1.11.0 — 31 octobre 2026

Nouveau : **Mini casino** 🎰. Un bouton sur l'accueil ouvre un menu avec le **Poker**, le **Blackjack** et la **Roulette** (le mode frauduleux reste un réglage du salon). Jetons fictifs, hors ligue, robots possibles. **Roulette** européenne : 500 jetons, mise minimum 5, mises sur un numéro (35 contre 1), rouge / noir, pair / impair, 1-18 / 19-36 (1 contre 1), douzaines et colonnes (2 contre 1), le zéro fait perdre les mises simples, pas de nombre de tours fixé (on joue tant qu'il reste des jetons ; l'organisateur peut arrêter après le tour en cours), 30 s pour miser, solo possible. **Poker** (Texas Hold'em) : 1000 jetons, blindes croissantes toutes les 4 mains, pas de nombre de mains fixé (jusqu'au dernier jeton, ou arrêt demandé par l'organisateur), tapis et pots annexes, 30 s par tour, cartes privées dans `hands/` (pas de changement de règles). **Blackjack** : 500 jetons, mise 10–500, sabot de 6 jeux, blackjack 3:2, doublage, séparation des paires (une fois par manche, deux as = une carte chacun, la main en jeu est entourée d'or), assurance quand le croupier montre un as (moitié de la mise, paie 2 contre 1), le croupier reste sur tous les 17, pas de nombre de manches fixé (jusqu'à la fin des jetons, ou arrêt demandé par l'organisateur), jeu en solo possible. L'appareil de l'organisateur fait le croupier (reprise par un autre joueur après 70 s sans réponse). Nouveau paquet **Casino de Fredo** (jetons de casino, Albert en smoking, Fredo à lunettes, Colette au chignon). **La ligue repart de zéro chaque mois** (avant : chaque trimestre) : le classement du mois repart à 1000 le 1er de chaque mois ; la saison d'une partie se déduit de sa date, donc l'historique se range aussi par mois ; le classement « Général » et les stats ne changent pas. **Paquet Classique** : Roi, Dame et Valet redessinés en vectoriel (cartes à double tête, nettes à toute taille ; avant : petites images agrandies et floues) ; le choix du paquet commence par Casino de Fredo puis Café Jacquet. Panneau « Partie » plus clair (une ligne par réglage, interrupteurs, menus et champs de nombres avec − / +). **Jetons de départ au casino selon la ligue** : chaque joueur commence avec son Elo du classement en ligne du mois précédent (750 pour les nouveaux, sans profil ou pas assez classés), plus un petit bonus quotidien selon le temps passé en haut du classement du mois en cours (il grandit chaque jour ; 3 jetons par jour en 1re place, 2 par jour dans les 3 premiers, 1 par jour dans les 10 premiers, 150 au maximum) ; rien n'est enregistré, tout se recalcule depuis les parties de la ligue. Chaque table a son **croupier animé** : Albert au poker, Fredo au blackjack, Colette à la roulette (bulle qui commente le jeu). Les cartes du poker et du blackjack arrivent en glissant et se retournent (flop, turn, river, carte cachée du croupier). Poker en vue table (ovale), blackjack sur une table demi-lune avec cercles de mise, roulette avec un vrai plateau dont la bille s'arrête sur le numéro. **Casino de Fredo : ambiance et son** — fond de feutre avec stores de lumière, fumée de cigare, enseigne néon « La Maison », rideaux de velours, roue de roulette en fond, dés / cartes / jetons qui tombent ; **jazz de club à la trompette** (contrebasse, ride swing, piano, trompette bouchée, craquements de disque) pour tous les paquets sauf Halloween, à la place de la musique douce du café ; bruitages de jetons, de cartes et de bille de roulette. « Quitter » fonctionne aussi dans les navigateurs qui n'affichent pas la fenêtre de confirmation. **Site plus vivant et plus soigné** (hors Halloween, qui garde son fond) : symboles de cartes qui flottent doucement en fond, et au Casino de Fredo des jetons qui tombent ; titre « Rikiki » en or poli ; panneaux, barre du haut, boutons et fenêtres en « or sur vert feutre » (bordures dorées fines, relief, filet doré sous les titres). Les animations se coupent si l'appareil demande moins de mouvement. Salon : le bouton « Je suis prêt » pulse et un second bouton apparaît en bas. Aucun changement de règles Firebase.

Trouvé en testant à 3 joueurs : les mises à jour de la partie FUSIONNAIENT les objets, donc ce qui n'existait plus à la manche suivante restait (assurance du blackjack, 2e main d'un split). Les états du poker, du blackjack et de la roulette sont maintenant remplacés en entier à chaque écriture (`replaceWhole`, `07-reseau-local-et-firebase.js`). Poker : une blinde perdue par un joueur couché ne crée plus un faux « pot annexe » (deux pots disputés par les mêmes joueurs n'en font qu'un), et une mise que personne ne pouvait suivre est annoncée « récupère … : personne ne pouvait suivre cette mise ». Poker : table plus lisible sur téléphone (adversaires alignés en haut à 2-4 joueurs, 3 colonnes compactes à 7-8, plus de cartes cachées sous les joueurs à l'abattage).

## 1.10.0 — 31 octobre 2026

Le **mode frauduleux** est mis en avant : une carte « Nouveau : le mode frauduleux » sur l'accueil (bouton « Essayer » qui crée directement la partie, fermable) et une ligne dans les notes de version. Le mode se joue maintenant **sans aucun robot** : le bouton pour en ajouter disparaît et la partie ne se lance pas s'il y en a. Aucun changement de règles Firebase.

## 1.9.1 — 31 octobre 2026

Correctif : le bouton « Inviter un nouveau joueur » (ex-« Partager le lien ») ne faisait rien quand le navigateur refusait la copie ou n'avait pas de partage intégré (ordinateur, appli iPhone) : une fenêtre du navigateur, souvent bloquée, était la seule issue. Le lien est maintenant copié, ou affiché dans la page avec un bouton « Copier le lien ».

## 1.9.0 — 31 octobre 2026


Nouveau : **Mode frauduleux** 😈 (réglage du salon). La triche est permise : on peut jouer n'importe quelle carte, y compris ne pas fournir la couleur. Les autres voient seulement une carte posée, mais peuvent accuser (« 🕵️ J'accuse ») une carte du pli en cours ou du pli précédent. L'appareil de l'organisateur vérifie : tricheur pris = −5 points, fausse accusation = −5 points pour l'accusateur. Partie hors ligue et jamais analysée, pas de jeu automatique. Sans robot (entre vrais joueurs). Le mode va vite : en le cochant, la partie passe en format rapide (5 manches, 5 cartes au plus) avec 10 secondes par tour. Le salon affiche aussi la **durée estimée** de toute partie. Aucun changement de règles Firebase.

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
