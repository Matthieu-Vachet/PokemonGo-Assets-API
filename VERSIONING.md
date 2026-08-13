# Versionning PokemonGo-Assets-API

`version.json` est l’autorité de version de ce dépôt statique.

- `version` suit SemVer : PATCH pour une correction compatible, MINOR pour une nouvelle famille ou capacité rétrocompatible, MAJOR pour une rupture de chemins ou de contrat public.
- `assetVersion` suit `YYYY.MM.DD.N` et change dès que le contenu canonique publié change, indépendamment des versions de PokemonGo-Data et PokemonGo-API.
- `generatedAt` date la release de l’inventaire d’assets.

Une modification limitée à la documentation, aux tests ou à la CI ne nécessite pas de release. Les tags n’étaient pas utilisés historiquement dans ce dépôt ; la politique ne crée donc pas de tag automatiquement.
