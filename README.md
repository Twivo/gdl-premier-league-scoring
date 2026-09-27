# GDL Premier League Scoring

GDL Premier League Scoring est la **station de scoring** des soirées Premier
League GDL : une tablette posée à côté de chaque board (cible), sur laquelle le
marqueur choisit son board, voit les matchs qui y sont affectés et les score en
501 Double Out. Chaque match peut être suivi en direct, en lecture seule.

L'application est publiée sur GitHub Pages :
<https://twivo.github.io/gdl-premier-league-scoring/>

La création de la compétition, l'affectation des matchs aux boards et
l'administration du tournoi se font sur le **site externe du tournoi**.
L'application de scoring lit ces données et y renvoie les résultats.

Le cœur du projet est volontairement simple : un match stocke une configuration
et une liste d'événements (volées, busts, forfaits). Les scores, legs, moyennes,
checkouts et statistiques sont recalculés par un moteur TypeScript pur à partir
de ces événements.

## Fonctionnalités publiées

- **Station de board** : choix du numéro de board (mémorisé sur l'appareil),
  liste des matchs affectés classés par état (en cours, disponibles, bloqués,
  terminés), mise en avant du prochain match, mise à jour en temps réel.
- **Démarrage d'un match** : connexion obligatoire, choix du joueur qui lance
  en premier puis confirmation ; alternance automatique à chaque leg. Le
  démarrage est idempotent : jamais deux matchs pour la même fixture.
- **Écran de scoring** pensé tablette, lisible à environ 3 mètres :
  - pavé numérique tactile et raccourcis 26, 41, 45, 59, 60, 81, 99, 100, 140,
    180 ;
  - un raccourci supérieur ou égal au score restant est refusé sur place, et
    les raccourcis sont désactivés pendant une saisie au pavé ;
  - clavier physique sur ordinateur (chiffres, Entrée, Retour arrière, Échap) ;
  - checkout confirmé avec le nombre de fléchettes (appui long sur 1, 2 ou 3),
    Miss, Bust, abandon du leg ou du match ;
  - annulation et correction d'une ancienne volée avec le même pavé, puis
    recalcul complet du match ;
  - bouton pour changer le joueur qui commence, tant qu'aucune fléchette n'a
    été lancée.
- **Règles vérifiées** : 0 à 180, totaux impossibles refusés (172, 173, 175,
  176, 178, 179), interdiction de laisser 1, sortie double obligatoire
  (checkout maximum 170, bull compris).
- **Format Premier League** : 8 joueurs, 7 soirées (quarts, demies, finale en
  Best of 5), points 5/3/2, classement avec départages, Top 4 qualifié pour la
  Finals Night (demies en Best of 9, finale en Best of 11). Les vainqueurs
  avancent automatiquement dans le tableau.
- **Live** en lecture seule par match (`#/live/:id`), avec QR code de partage.
  Un deuxième appareil qui ouvre un match déjà en cours de scoring est bloqué
  et redirigé vers ce live.
- **Fiabilité** : sauvegarde après chaque volée, nouvelle tentative
  automatique toutes les 2,5 s en cas de coupure, verrou « un seul marqueur par
  match ».
- Interface FR/EN, PWA installable.

L'inventaire détaillé, à jour, est dans [FONCTIONNALITES.md](FONCTIONNALITES.md).

## Routes publiées

| Route | Rôle |
| --- | --- |
| `#/` | Station de scoring : choix du board et liste de ses matchs |
| `#/login` | Connexion du marqueur ou de l'organisateur |
| `#/game/:id` | Scoring d'un match |
| `#/live/:id` | Suivi public, en lecture seule, d'un match |
| toute autre route | Redirection vers la station |

## Modules historiques (présents mais non publiés)

Le projet a commencé comme une application de club plus large. Ces écrans sont
toujours dans le code mais leurs routes ont été retirées de `src/App.tsx` le
19 juillet 2026 :

- accueil de club, matchs d'entraînement (501/601, simple ou double) ;
- championnat par équipes (4 simples, 2 doubles, 4 simples) ;
- liste générale du live et mode TV ;
- administration des joueurs, équipes et saisons ; statistiques et export
  CSV/Excel ;
- écrans d'organisation Premier League (création, tableaux, dérogations).

Ils ne doivent pas être considérés comme disponibles sans réactivation et
nouvelle vérification complète. Voir la section 11 de
[FONCTIONNALITES.md](FONCTIONNALITES.md).

## Stack

- React 18, TypeScript, Vite 6
- TailwindCSS 4
- React Router 6 en `HashRouter`
- Supabase : Postgres, Auth, RLS, Realtime
- Vitest
- vite-plugin-pwa

## Démarrage

```bash
npm install
npm run dev        # serveur local Vite
npm test           # tests unitaires du domaine
npm run build      # vérification TypeScript + build production
npm run preview    # preview du build
```

## Modes de données

- **Mode cloud** : si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont
  définies, l'application utilise Supabase. C'est le mode de production, requis
  pour la station Premier League (compétition, fixtures, temps réel).
- **Mode local** : sans ces variables, l'application utilise le stockage du
  navigateur. Pratique pour développer ou tester le moteur de scoring hors
  ligne ; la station affiche alors « Mode de scoring local ».

La clé anon Supabase est publique par nature. La protection repose sur les
policies RLS côté base : lectures publiques nécessaires au live, écritures
Premier League réservées aux utilisateurs authentifiés.

## Configuration Supabase

1. Créer un projet Supabase.
2. Exécuter les migrations de `supabase/migrations/`, dans l'ordre (`0001` à
   `0008`).
3. Créer les comptes marqueurs / organisateur dans Supabase Auth.
4. Copier `.env.example` vers `.env.local` et renseigner :

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

Détails dans [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Architecture

```text
src/
  App.tsx                     Routes publiées
  main.tsx                    Bootstrap React, providers, HashRouter
  components/                 Composants partagés (ui/: Button, Modal, Loading…)
  data/                       Contrats repository/auth + backends local/Supabase
  domain/                     Moteur pur : scoring, validation, stats
  domain/premierLeague/       Format, tableaux et classement Premier League
  domain/championship/        Moteur des rencontres par équipes (historique)
  features/
    scoringStation/           Station de board et connexion  (publié)
    game/                     Écran de scoring               (publié)
    live/                     Live en lecture seule          (publié)
    admin/ championship/ home/ setup/ stats/ premierLeague/  (historiques)
  hooks/                      Hooks React réutilisables
  lib/                        Helpers transverses
  store/                      Contextes, persistance, verrou, dictionnaire FR/EN
supabase/
  migrations/                 Schéma, RLS, realtime, Premier League
public/                       Logo, favicon, icônes PWA
```

Principe clé : les composants UI ne réimplémentent pas les règles de
fléchettes. Les règles restent dans `src/domain` ; l'UI consomme le résultat.

## Sécurité

- Row-Level Security Supabase, connexion obligatoire pour scorer.
- Live public en lecture seule.
- CSP dans `index.html`.
- Aucun secret dans le code source ; jamais de clé `service_role` côté client.
- Verrou de scoring par appareil (heartbeat 8 s, expiration 20 s).
- Toute nouvelle table Supabase doit être créée avec RLS et des policies
  explicites.

## Tests et vérification

Tests unitaires (Vitest) : moteur de scoring, validation des scores, checkouts,
statistiques, format et classement Premier League, moteur championnat.

```bash
npm test
npm run build
```

Vérification manuelle : [TEST_PLAN.md](TEST_PLAN.md).

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit et publie l'application à
chaque push sur `main`. Les secrets `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY` doivent être définis dans le dépôt GitHub. Le
`HashRouter` permet de servir l'application sous un sous-chemin GitHub Pages
sans configuration serveur.

## Documentation

- [FONCTIONNALITES.md](FONCTIONNALITES.md) : inventaire fonctionnel complet.
- [MODE_D_EMPLOI.md](MODE_D_EMPLOI.md) : guide du marqueur un soir de match.
- [TEST_PLAN.md](TEST_PLAN.md) : checklist de vérification manuelle.
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) : configuration du backend.
- [REPRODUCTION_PREMIER_LEAGUE.md](REPRODUCTION_PREMIER_LEAGUE.md) : reproduire
  la couche Premier League dans une application sœur.
- [agent.md](agent.md) : consignes pour contributeurs et assistants IA.
