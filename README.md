# MorgesDartsConnect

MorgesDartsConnect est une application de scoring de darts pensée d'abord pour
les matchs a domicile des Jedis, puis etendue vers une petite plateforme de
club: matchs d'entrainement, rencontres de championnat, statistiques joueurs,
equipes, live public et mode PWA.

Le coeur du projet est volontairement simple: un match stocke une configuration
et une liste d'evenements. Les scores, legs, moyennes, checkouts et statistiques
sont recalcules par le moteur TypeScript pur a partir de ces evenements.

## Fonctionnalites

- Scoring X01 en 501 ou 601, sortie double.
- Ecran de scoring a gros chiffres, lisible depuis le board (environ 3 metres):
  scores restants des deux joueurs en grand et score du joueur actif en tres
  grand au centre.
- Etoile discrete a cote du nom, dans la carte de score du joueur qui commence
  le leg.
- Saisie au clavier tactile inverse, et au clavier physique sur ordinateur
  (chiffres, Entree, Retour arriere, Echap).
- Matchs simples et doubles.
- Mode entrainement public et rapide, utilisable sans connexion.
- Connexion / deconnexion directement depuis l'accueil, avec page dediee `#/login`.
- Mode championnat protege par connexion admin.
- Rencontre de championnat par equipes: 4 simples, 2 doubles, 4 simples.
- Preselection de l'equipe Jedis a domicile, avec choix manuel toujours possible.
- Sauvegarde et reprise des matchs en cours.
- Live public en lecture seule, avec QR code depuis l'accueil.
- Mode TV club pour afficher les matchs en direct.
- Gestion admin des joueurs, equipes, saisons et resultats.
- Statistiques joueurs et championnat, avec export CSV.
- Interface FR/EN via un dictionnaire local.
- PWA installable avec favicon et icones dedies.

## Modes de donnees

L'application peut tourner dans deux modes.

### Mode local

Si aucune variable Supabase n'est configuree, l'application utilise le stockage
local du navigateur. C'est pratique pour tester, developper ou faire une demo
hors ligne.

### Mode cloud

Si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont definies, l'application
utilise Supabase pour les joueurs, equipes, saisons, matchs et rencontres.

La cle anon Supabase est publique par nature. La protection repose sur les
policies RLS cote base de donnees:

- lecture publique des donnees utiles au live et aux stats;
- creation/scoring d'un match d'entrainement possible sans compte;
- suppression de match reservee a l'admin;
- joueurs, equipes, saisons, stats admin et championnat reserves a l'admin;
- rencontres de championnat et matchs lies a une rencontre reserves a l'admin.

## Stack

- React 18
- TypeScript
- Vite 6
- TailwindCSS 4
- React Router 6 en `HashRouter`
- Supabase: Postgres, Auth, RLS, Realtime
- Vitest
- vite-plugin-pwa

## Demarrage

```bash
npm install
npm run dev
npm test
npm run build
```

Commandes utiles:

```bash
npm run dev        # serveur local Vite
npm run build      # verification TypeScript + build production
npm test           # tests unitaires du domaine
npm run preview    # preview du build
```

## Configuration Supabase

Le backend cloud est optionnel. Pour l'activer:

1. Creer un projet Supabase.
2. Executer les migrations SQL dans `supabase/migrations/`, dans l'ordre.
3. Creer un utilisateur admin dans Supabase Auth.
4. Copier `.env.example` vers `.env.local`.
5. Renseigner:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

Voir [SUPABASE_SETUP.md](SUPABASE_SETUP.md) pour le detail.

## Documentation utilisateur

- [MODE_D_EMPLOI.md](MODE_D_EMPLOI.md): guide d'utilisation pour lancer un
  match, scorer, suivre le live, gerer le championnat et consulter les stats.
- [TEST_PLAN.md](TEST_PLAN.md): checklist de verification manuelle.
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md): configuration du backend cloud.

## Parcours principaux

### Nouvelle partie d'entrainement

Route: `#/new`

Le joueur choisit le type de partie, les participants, le nombre de legs et le
starter. Le match est sauvegarde automatiquement et peut etre repris depuis
l'accueil.

### Match de championnat

Route: `#/championship/new`

Ce parcours demande une connexion admin. Les Jedis sont selectionnes par defaut
comme equipe a domicile, mais l'utilisateur peut choisir une autre equipe si un
match exceptionnel l'exige. Une rencontre contient 10 matchs: 4 simples, 2
doubles, puis 4 simples.

### Live

Route: `#/live`

Le live est public et en lecture seule. Il permet de suivre les matchs en cours
depuis un telephone, une tablette ou le QR code affiche sur l'accueil.

### Statistiques

Route: `#/admin/stats`

La zone statistiques est protegee par login admin. Elle affiche les stats
championnat, les profils joueurs, l'historique des matchs et un export CSV
securise contre l'injection de formules tableur.

## Architecture

```text
src/
  App.tsx                     Routes principales
  main.tsx                    Bootstrap React, providers, HashRouter
  components/                 Composants partages
  components/ui/              UI generique: Button, Modal, Loading, ConfirmProvider
  data/                       Contrats repository/auth + backends local/Supabase
  domain/                     Moteur pur: scoring, validation, stats
  domain/championship/        Moteur pur des rencontres par equipes
  features/                   Ecrans par domaine fonctionnel
    admin/                    Joueurs, equipes, stats, championnat admin
    championship/             Creation et deroulement des rencontres
    game/                     Scoring en cours
    home/                     Accueil
    live/                     Watch live
    setup/                    Nouvelle partie d'entrainement
    stats/                    Ecran de fin de match
  hooks/                      Hooks React reutilisables
  lib/                        Helpers transverses
  store/                      Contextes, persistence et orchestration UI
supabase/
  migrations/                 Schema, RLS, realtime, championnat
  seed_gdl_2025-2026.sql      Donnees optionnelles de depart
public/
  app-icon.png                Icone PWA
  favicon.png                 Favicon
  home-logo.png               Logo d'accueil
```

## Modeles importants

- `GameConfig`: configuration initiale d'un match.
- `GameEvent`: evenement ajoute au journal du match.
- `MatchRecord`: match persiste avec `config`, `events`, statut et metadata.
- `TeamRecord` / `TeamWithPlayers`: equipes de championnat.
- `EncounterRecord`: rencontre de championnat complete.
- `DartsRepository`: interface commune aux backends local et Supabase.

Principe cle: les composants UI ne doivent pas reimplementer les regles de
darts. Les regles restent dans `src/domain`, puis l'UI consomme le resultat.

## Securite

Elements deja en place:

- Row-Level Security Supabase.
- Auth admin pour les zones sensibles.
- Live public en lecture seule.
- CSP dans `index.html`.
- Pas de secret requis dans le code source.
- Export CSV neutralisant les cellules pouvant etre interpretees comme formules.
- Verrou de scoring par appareil pour limiter les reprises concurrentes.

Points a garder en tete:

- Le mode entrainement est volontairement simple et publiquement scorables.
- Les donnees sensibles ne doivent jamais etre ajoutees dans `.env.example`,
  `README.md`, `agent.md` ou les migrations.
- Toute nouvelle table Supabase doit etre creee avec RLS et policies explicites.

## Tests et verification

Tests unitaires actuels:

- moteur de scoring;
- validation des scores;
- checkouts;
- statistiques joueurs;
- moteur championnat.

Avant une modification metier:

```bash
npm test
npm run build
```

Avant une modification UI simple:

```bash
npm run build
```

Pour une verification manuelle complete, voir [TEST_PLAN.md](TEST_PLAN.md).

## Deploiement GitHub Pages

Le workflow GitHub Actions construit l'application a chaque push sur `main`.

Pour le mode cloud en production, ajouter ces secrets ou variables dans le depot
GitHub:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Le routage utilise `HashRouter`, donc l'application fonctionne sous un chemin de
projet GitHub Pages sans configuration serveur supplementaire.

## Conseils de contribution

- Faire des changements scopes et comprehensibles.
- Ne pas casser la compatibilite des donnees deja stockees.
- Ajouter les textes visibles dans `src/store/LangContext.tsx`.
- Garder le moteur de scoring independant de React.
- Eviter les refactors globaux sans objectif clair.
- Lire [agent.md](agent.md) avant de travailler avec un assistant IA.
