# Convention de nommage des icônes Pokémon

## Format général

Toutes les icônes utilisent des noms en minuscules, sans accent, sans espace et
avec l'extension `.png`.

```text
{dex_sur_4_chiffres}_{pokemon}_{forme_ou_evenement}_{etat}_{chromatique}.png
```

Les éléments inutiles sont omis. Le numéro Pokédex et le nom anglais du Pokémon
sont toujours présents.

Exemples :

```text
0001_bulbasaur_normal.png
0001_bulbasaur_normal_chromatique.png
0001_bulbasaur_shadow.png
0001_bulbasaur_event_fall_2019_chromatique.png
0003_venusaur_gigantamax.png
0006_charizard_mega_x.png
0019_rattata_alola_shadow.png
```

## Ordre des éléments

Après `{dex}_{pokemon}`, respecter cet ordre :

1. forme régionale, forme spéciale ou événement ;
2. genre, si l'icône dépend du genre ;
3. transformation : `mega`, `mega_x`, `mega_y`, `primal`, `dynamax` ou
   `gigantamax` ;
4. état : `shadow` ou `purified` ;
5. `chromatique`, toujours en dernier.

Utiliser `normal` uniquement lorsque l'icône n'a aucune forme, transformation
ou état spécial. Ainsi, écrire `0001_bulbasaur_shadow.png`, et non
`0001_bulbasaur_normal_shadow.png`.

## Vocabulaire réservé

| Élément | Signification |
| --- | --- |
| `normal` | apparence normale |
| `chromatique` | apparence shiny |
| `shadow` | Pokémon obscur |
| `purified` | Pokémon purifié |
| `femelle` | apparence femelle différente |
| `dynamax` | forme Dynamax |
| `gigantamax` | forme Gigamax |
| `mega`, `mega_x`, `mega_y` | Méga-Évolution |
| `primal` | Primo-Résurgence |
| `alola`, `galar`, `hisui`, `paldea` | forme régionale |
| `event_{nom}` | costume ou apparence d'événement |

Une forme officielle conserve un nom descriptif, par exemple
`zygarde_ten_percent`, `oricorio_sensu` ou `ursaluna_bloodmoon`.

## Événements

Tous les costumes et apparences temporaires commencent par `event_`.

```text
0025_pikachu_event_belle.png
0025_pikachu_event_summer_2018_chromatique.png
```

Préférer le nom officiel ou l'année de l'événement à un simple numéro.

## Doublons

Une seule icône doit être conservée par variante canonique. Si plusieurs
sources donnent le même Pokémon, la même forme et les mêmes états, vérifier
visuellement les fichiers puis conserver le nom canonique sans suffixe.

```text
0001_bulbasaur_normal.png
```

Les suffixes temporaires `_2`, `_3`, etc. servent uniquement pendant la revue
des collisions. Après confirmation, supprimer les doublons et consigner
l'opération dans `dedupe-manifest.json`.

## Anciens codes reconnus

| Ancien suffixe | Nouveau terme |
| --- | --- |
| `_s` | `chromatique` |
| `_a1` | `shadow` |
| `_a2` | `purified` |
| `_b1` | `dynamax` |
| `_b2` | `gigantamax` |
| `_g2` | `femelle` |
| `_e1` | `mega` |
| `_e2` | `mega_x` |
| `_e3` | `mega_y` |
| `_e4` | `primal` |
| `_cN` ou ancien `_N` | événement numéro `N` |
| `_fN` | forme Pokémon GO numéro `N` |

`_b3` est conservé sous le nom `max_unknown_b3` tant que sa signification
officielle n'est pas confirmée.

## Ajouter une future icône

1. Identifier le numéro Pokédex et le nom anglais du Pokémon.
2. Identifier précisément la forme, l'événement, la transformation et l'état.
3. Construire le nom selon l'ordre défini ci-dessus.
4. Vérifier qu'aucun fichier existant ne porte ce nom.
5. En cas de doute, utiliser `form_unknown_{code}` ou
   `event_unknown_{code}` et documenter le code dans le manifeste au lieu de
   deviner.
6. Mettre à jour `index.json` et le manifeste associé.

Pour importer un lot encore nommé avec les anciens codes, lancer d'abord la
simulation, contrôler `rename-plan.json`, puis appliquer le renommage :

```bash
node rename-pokemon-shuffle.js
node rename-pokemon-shuffle.js --write
```

Le script ignore les fichiers déjà canoniques et refuse les collisions.
