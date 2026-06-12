# 🔧 Garage de Rogué

Application web de gestion de maintenance de véhicules, partagée entre deux
comptes (toi et ton père) avec synchronisation automatique en temps réel.

- **Frontend** : HTML / CSS / JavaScript pur — aucun outil à installer,
  hébergeable gratuitement sur GitHub Pages.
- **Backend** : [Supabase](https://supabase.com) — base de données,
  authentification par email et stockage des photos.

## Fonctionnalités

- Véhicules : nom, type, année, immatriculation, km, statut, **coût total**.
- Par véhicule :
  - **Ordres de travail** (préventif / correctif / amélioratif), sous-ensemble,
    date, km, description, **pièces avec prix**, **photos multiples**,
    statut ouvert / en cours / clôturé.
  - **Échéances préventives** par km et/ou par date, avec code couleur
    (🟢 ok · 🟠 proche · 🔴 dépassée).
  - **Stock de pièces** (référence, quantité, prix).
  - **Fiche technique** (liste libre de caractéristiques).
- Si l'un de vous modifie quelque chose, l'écran de l'autre se met à jour
  tout seul (temps réel).

---

## Installation — à faire une seule fois

### Étape 1 — Récupérer ta clé publique Supabase

Dans le tableau de bord [supabase.com/dashboard](https://supabase.com/dashboard),
ouvre ton projet puis :

- **⚙ Project Settings → API Keys** → copie la **Publishable key**
  (elle commence par `sb_publishable_`).
- (L'URL du projet est dans **Project Settings → Data API → Project URL** ;
  elle est déjà renseignée dans ce projet.)

Colle la clé dans **`js/config.js`**, à la place de
`sb_publishable_COLLE_TA_CLE_ICI`.

> ⚠️ Ne mets jamais la clé **secret** (`sb_secret_…`) dans le code : elle
> contourne toute la sécurité. La clé *publishable*, elle, est faite pour être
> publique : ce sont les règles RLS (voir plus bas) qui protègent les données.

### Étape 2 — Créer la base de données

1. Tableau de bord Supabase → menu de gauche → **SQL Editor** → **New query**.
2. Copier-coller **tout** le contenu de [`supabase/01_schema.sql`](supabase/01_schema.sql).
3. Cliquer **Run**. Tu dois voir « Success ».

Ce script crée les tables, le bucket de photos, la synchro temps réel et
toutes les règles de sécurité. Il est réexécutable sans danger.

### Étape 3 — Simplifier la connexion (recommandé)

Par défaut, Supabase demande de confirmer son adresse email en cliquant un
lien. Comme l'accès est de toute façon verrouillé par la liste des membres,
tu peux désactiver cette étape :

- **Authentication → Sign In / Providers → Email** → décocher
  **Confirm email** → **Save**.

*(Si tu préfères la garder : il faudra aussi renseigner l'adresse du site dans
**Authentication → URL Configuration → Site URL** pour que le lien de
confirmation redirige au bon endroit.)*

### Étape 4 — Créer vos deux comptes

Ouvre l'application (voir « Tester en local » ci-dessous), touche
**« Créer un compte »** et crée ton compte. Ton père fait pareil avec son
adresse. À ce stade, vous verrez « ⛔ Accès non autorisé » : c'est normal,
la sécurité fonctionne !

### Étape 5 — Autoriser vos deux comptes

1. Ouvre [`supabase/02_membres.sql`](supabase/02_membres.sql) et remplace
   `EMAIL_DE_TON_PERE` par son adresse exacte.
2. Copie-colle le script dans **SQL Editor** → **Run**.
3. Dans l'application, touche **« Réessayer »** : le garage s'affiche. 🎉

---

## La sécurité, en deux mots (Row Level Security)

La clé publique étant visible par tous, **toute la sécurité se joue côté
serveur** :

1. **RLS activé** sur chaque table = par défaut, *personne* ne peut rien lire
   ni écrire, même connecté.
2. Une **règle (policy)** unique autorise l'accès : « être présent dans la
   table `garage_members` ». Cette table ne contient que vous deux.
3. Quelqu'un qui trouve l'adresse du site peut créer un compte… mais il ne
   verra **aucune donnée** et ne pourra **rien écrire** tant qu'il n'est pas
   membre. Idem pour les photos (bucket privé + liens signés temporaires).

---

## Tester en local (sur ce PC)

Les modules JavaScript exigent un vrai serveur web (ouvrir `index.html`
directement ne marche pas). Un mini-serveur est fourni :

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Puis ouvre **http://localhost:8080** dans ton navigateur.

## Mettre en ligne sur GitHub Pages

1. Crée un dépôt sur [github.com/new](https://github.com/new)
   (par ex. `garage-rogue`, public ou privé).
2. Dans ce dossier, en ligne de commande :

   ```powershell
   git init
   git add .
   git commit -m "Garage de Rogué"
   git branch -M main
   git remote add origin https://github.com/TON_PSEUDO/garage-rogue.git
   git push -u origin main
   ```

3. Sur GitHub : **Settings → Pages → Source : Deploy from a branch →
   Branch : `main` / `(root)` → Save**.
4. Après ~1 minute, le site est disponible sur
   `https://TON_PSEUDO.github.io/garage-rogue/`.
   Ajoute-le à l'écran d'accueil de vos iPhones
   (Safari → Partager → **Sur l'écran d'accueil**) : il se comporte comme une app.

> Note : le dépôt peut rester **public** sans risque — la clé publishable est
> faite pour ça et les données sont protégées par RLS. Si tu préfères un dépôt
> privé, GitHub Pages privé nécessite un compte payant ; le dépôt public est
> le plus simple.

## Structure du projet

```
index.html              Page unique de l'application
css/style.css           Thème sombre atelier (anthracite #17191B / jaune #F2B705)
js/config.js            ← URL + clé Supabase (à compléter)
js/app.js               Démarrage, navigation, synchro temps réel
js/db.js                Toutes les lectures/écritures Supabase
js/ui.js                Modales, toasts, formats, code couleur échéances
js/auth.js              Écrans de connexion / accès refusé
js/constants.js         Listes (statuts, types d'OT…) et champs de formulaires
js/views/vehicles.js    Liste des véhicules
js/views/vehicle.js     Fiche véhicule (OT / échéances / stock / fiche technique)
js/views/workorder.js   Détail d'un ordre de travail (pièces, photos)
supabase/01_schema.sql  Création de la base + sécurité (à exécuter en premier)
supabase/02_membres.sql Autorisation de vos deux comptes (à exécuter en dernier)
serve.ps1               Mini serveur local de test
```
