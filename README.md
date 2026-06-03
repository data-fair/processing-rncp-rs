# <img alt="Data FAIR logo" src="https://cdn.jsdelivr.net/gh/data-fair/data-fair@master/ui/public/assets/logo.svg" width="30"> @data-fair/processing-rncp-rs

Plugin de traitement data-fair qui génère et met à jour des jeux de données à partir des exports
XML de **France Compétences** publiés sur [data.gouv.fr](https://www.data.gouv.fr/fr/datasets/repertoire-national-des-certifications-professionnelles-et-repertoire-specifique/) :

- **RNCP** — Répertoire national des certifications professionnelles
- **RS** — Répertoire spécifique

Le traitement cible le **flux V4-1** (le format courant). Il télécharge l'export le plus récent,
le transforme en CSV (parsing **en streaming**, pour supporter les fichiers de plusieurs centaines
de Mo) et crée ou met à jour le jeu de données *fichier* correspondant, schéma, description et
métadonnées (résumé, producteur, licence, source, fréquence, date de mise à jour de la source) inclus.

## Features

- **Téléchargement automatique** — récupère l'export le plus récent du flux V4-1 de France Compétences sur data.gouv.fr.
- **Parsing en streaming** — transforme l'XML en CSV via un parseur SAX, pour supporter les fichiers de plusieurs centaines de Mo.
- **RNCP & RS** — traite au choix le Répertoire national des certifications professionnelles ou le Répertoire spécifique.
- **Schéma figé** — produit un schéma curaté et stable, enrichi de titres, descriptions et concepts.
- **Métadonnées renseignées** — résumé, producteur (France compétences), licence (Licence Ouverte), origine (data.gouv.fr), fréquence (hebdomadaire) et date de mise à jour de la source. Les thématiques et jeux de données liés restent à renseigner manuellement (identifiants propres à l'instance data-fair).
- **Création / mise à jour** — crée un nouveau jeu de données *fichier* ou met à jour un jeu existant.

## Configuration

| Onglet | Champ | Description |
| --- | --- | --- |
| Jeu de données | `datasetMode` | `create` pour créer le jeu de données, `update` pour en mettre un à jour |
| Jeu de données | `dataset` | Le jeu de données cible (titre à la création, identifiant à la mise à jour) |
| Paramètres | `processFile` | Répertoire à traiter : `rncp` ou `rs` |
| Paramètres | `clearFiles` | Supprime les fichiers téléchargés en fin de traitement (activé par défaut) |

## Stabilité du schéma

Le schéma de sortie est **curaté et figé** dans le code (`lib/repertoires/{rncp,rs}.ts`). Toutes les
colonnes historiques sont conservées (mêmes clés), enrichies de titres, descriptions et concepts,
et complétées par les nouvelles colonnes du flux V4-1. Si un champ source disparaît, sa colonne est
émise vide plutôt que supprimée. Si la version du flux change (`VERSION_FLUX != 4.1`), un
avertissement est émis : le traitement doit alors être mis à jour.

## Développement

```sh
npm install
npm test          # tests sur fixtures XML réduites (test-it/)
npm run lint
npm run build-types
```

Pour tester localement contre une instance data-fair, créer un fichier `config/local-test.mjs`
(gitignoré) avec `dataFairUrl` et `dataFairAPIKey`.

## Architecture

```
index.ts                   exporte run / stop
lib/execute.ts             orchestration : download → process → upload
lib/download.ts            sélection de l'export V4-1 le plus récent + unzip
lib/process.ts             parsing XML streaming (sax) → CSV
lib/xml-stream.ts          émet un objet par <FICHE> sans charger tout le fichier
lib/upload.ts              envoi du CSV + schéma + description + métadonnées à data-fair
lib/repertoires/{rncp,rs}  schéma de sortie + extraction (mapping) par répertoire
```

## Release

La publication est gérée automatiquement par la CI : le plugin est poussé vers le registre data-fair (`@data-fair/registry`), pas vers le registre npm public — il n'y a plus de `npm publish` manuel. Un push sur `main`/`master` publie vers le registre de staging ; un tag `v*` publie en production :

```bash
npm version minor       # montée de version + tag v*
git push --follow-tags  # la CI publie vers le registre de production
```
