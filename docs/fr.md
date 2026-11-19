# IESO Ontario Grid

Les chiffres en direct du réseau électrique de l'Ontario dans Gladys, d'après
les rapports publics de l'IESO (Independent Electricity System Operator) : le
prix temps réel, la demande, la production par filière, la part bas carbone et
un taux de CO₂ estimé.

Les données sont publiques et ne demandent aucun compte : testée sur les vrais
rapports de l'IESO. Sans lien avec l'IESO.

## Ce que vous obtenez

- Un appareil **Réseau électrique de l'Ontario** : le prix zonal de l'Ontario
  ($/MWh), la demande de l'Ontario, le taux de CO₂ estimé, les parts bas
  carbone et renouvelable, la part du nucléaire, de l'hydraulique, du gaz
  naturel, de l'éolien, du solaire, des biocombustibles et des autres sources,
  et un résumé en une phrase.
- Trois déclencheurs de scène : prix au-dessus d'un seuil, prix en dessous
  d'un seuil (0 pour un prix négatif), part bas carbone au-dessus d'un seuil.
- Un widget de tableau de bord avec le prix, la part bas carbone, le CO₂, la
  demande, la courbe du prix sur 24 h et le mix en barres.

**Les prix sont des prix de gros** du marché temps réel de l'IESO, pas votre
tarif : les foyers de l'Ontario paient des tarifs réglementés (selon l'heure,
par paliers ou de nuit) plus l'acheminement et l'ajustement global. Le prix de
gros montre tout de même quand l'électricité abonde ou manque.

## Prérequis

- Gladys 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys (les rapports sont lus sur
  `reports-public.ieso.ca`). Ni compte, ni clé.

## Installation

Dans Gladys, **Intégrations → Installer depuis GitHub**, puis l'adresse du
dépôt : `https://github.com/guim31/gladys-ieso`.

## Configuration

- **Seuil de prix haut** et **Seuil de prix bas** ($/MWh) : pour les
  déclencheurs de prix. Vide : déclencheur désactivé. Un seuil bas de 0 se
  déclenche quand le prix devient négatif.
- **Seuil de part bas carbone** (%) : pour le déclencheur bas carbone. Vide :
  désactivé.
- **Langue des noms** : noms des fonctionnalités (figés à l'ajout de
  l'appareil), résumé et messages des actions. Français par défaut.

Puis, dans l'onglet **Découverte**, ajoutez l'appareil **Réseau électrique de
l'Ontario**.

## Appareils

### Réseau électrique de l'Ontario

| Fonctionnalité             | Unité | Rafraîchissement     |
| -------------------------- | ----- | -------------------- |
| Prix de l'Ontario          | $/MWh | toutes les 5 minutes |
| Demande de l'Ontario       | kW    | toutes les 5 minutes |
| Taux de CO₂, estimé        | g/kWh | toutes les heures    |
| Part bas carbone           | %     | toutes les heures    |
| Part renouvelable          | %     | toutes les heures    |
| Part de chaque filière (7) | %     | toutes les heures    |
| Résumé                     | texte | toutes les 5 minutes |

Gladys n'a pas d'unité mégawatt : la demande est en kW (17 GW s'affichent
17 000 000 kW). Le prix est en dollars canadiens, affiché avec l'unité dollar
de Gladys.

## Scènes

Les déclencheurs se déclenchent **une fois par passage** : il faut repasser le
seuil d'une marge (5 $/MWh, 2 points) pour qu'ils se déclenchent à nouveau. Un
redémarrage ne les déclenche pas de nouveau.

### Prix IESO au-dessus du seuil

Le prix passe au-dessus du seuil haut. Variables : `price`, `threshold`.

### Prix IESO en dessous du seuil

Le prix passe sous le seuil bas (0 : un prix négatif). Variables : `price`,
`threshold`.

### Réseau de l'Ontario : part bas carbone haute

La part bas carbone passe au-dessus de son seuil : le bon moment pour charger
une voiture ou lancer le chauffe-eau. Variables : `low_carbon_share`,
`renewable_share`, `carbon_intensity`, `threshold`.

## Tableau de bord

### Widget Réseau de l'Ontario

Le prix (en rouge au-dessus du seuil haut, en vert sous le seuil bas ou quand
il est négatif), la part bas carbone, le CO₂ et la demande, la courbe du prix
sur 24 h une fois l'appareil ajouté, et le mix en barres. La courbe et le mix
ont chacun un réglage pour les masquer.

## Actions

### Tester la connexion à l'IESO

Lit tout de suite le prix, la demande et le mix, et répond avec les chiffres,
ou avec ce qui a échoué (en rouge).

## Données et limites

- Sources : `RealtimeOntarioZonalPrice` (prix zonal de l'Ontario, toutes les
  cinq minutes ; il a remplacé le HOEP avec le renouvellement du marché de mai
  2025), `RealtimeTotals` (demande de l'Ontario, toutes les cinq minutes) et
  `GenOutputCapability` (production horaire de chaque centrale, publiée environ
  un quart d'heure après l'heure). Seuls les fichiers courants sont lus,
  jamais l'index du répertoire.
- Rythme : le prix et la demande toutes les cinq minutes, les centrales une
  fois par nouvelle heure (nouvel essai toutes les dix minutes jusqu'à sa
  parution). Hors une lecture au démarrage et l'action de test, rien n'est lu tant que l'appareil n'est pas ajouté, qu'aucun
  seuil n'est réglé et qu'aucun tableau de bord n'affiche le widget.
- Le mix couvre les centrales **raccordées au réseau de transport** : les
  importations et les petites centrales raccordées aux réseaux locaux (la
  plupart du solaire sur toiture) n'y figurent pas.
- Le taux de CO₂ est une **estimation** d'après le mix, avec les facteurs
  médians sur le cycle de vie (GIEC 2014) : nucléaire 12, hydraulique 24,
  éolien 11, solaire 45, biocombustibles 230, gaz 490, autres 700 g/kWh.
- Le marché de l'IESO vit à l'heure normale de l'Est toute l'année :
  l'intégration fait la conversion, y compris à l'heure d'été.
- Un chiffre de plus de 30 minutes (prix, demande) ou de 3 heures (mix) n'est
  pas publié : mieux vaut aucune valeur qu'une valeur périmée. Une valeur qui
  ne change pas est renvoyée toutes les 6 heures.
- Les rapports publics ne demandent aucune clé et l'IESO n'annonce aucun
  quota de requêtes : ils ne sont lus qu'au rythme de leur publication, avec
  un User-Agent honnête.

## Dépannage

- **Statut « illisible »** dans la configuration : les rapports de l'IESO
  sont injoignables ou en maintenance. L'intégration réessaie toute seule.
- **Aucune valeur sur l'appareil** : ajoutez l'appareil dans l'onglet
  Découverte, puis attendez une minute, ou lancez l'action de test.
- **Journaux** : une ligne quand une panne commence et une quand elle finit.
  Pour le détail, réglez `LOG_LEVEL=debug`.

## Crédits

Données : [IESO](https://www.ieso.ca/power-data), rapports publics. Facteurs
d'émission : GIEC AR5 (2014), comme Electricity Maps. Intégration par guim31,
sans lien avec l'IESO.
