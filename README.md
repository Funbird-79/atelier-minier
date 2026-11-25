# Atelier minier · minage et salvage

Configurateurs communautaires Star Citizen 4.10.3 pour Nyx, Stanton et Pyro.

- [ARGO MOLE](https://funbird-79.github.io/atelier-minier/)
- [Gatac Hyūn](https://funbird-79.github.io/atelier-minier/hyun.html)
- [Flotte : Prospector, Golem, Vulture, Fortune, Salvation, MOTH et Reclaimer](https://funbird-79.github.io/atelier-minier/flotte.html)

Composition d’origine, composants compatibles, préréglage équilibré, comparaison des performances, pods, recettes de blueprint et qualité des matériaux. Site statique sans compte visiteur ni serveur à financer.

Le même sélecteur de vaisseau est disponible en haut de toutes les pages, y compris celles du MOLE et du Hyūn. Les changements de vaisseau passent par ce sélecteur ; les liens de navigation restants mènent aux sections de la page. Chaque vaisseau retrouve sa propre sauvegarde automatique lors du retour.

Le panneau **Capacités industrielles** est commun aux neuf vaisseaux : minerai réellement monté dans les pods, soute cargo et tampon de salvage lorsqu’il existe. Le total de minerai suit les changements de pods, les préréglages et le chargement des sauvegardes. Ces capacités restent séparées. Le MOLE conserve notamment ses 32 SCU de cargo en plus de ses pods de minerai ; le Hyūn affiche ses 32 SCU de cargo et son tampon de 40 SCU.

Le bloc **Mes configurations** permet d’enregistrer plusieurs profils nommés par vaisseau, puis de les charger ou de les mettre à jour. Les composants, modules, pods, peintures et qualités sont conservés. La dernière suppression peut être annulée, même après rechargement. Le bouton **Télécharger** exporte le montage actuel dans un fichier de configuration ; **Importer un fichier** enregistre une copie sur le vaisseau correspondant sans remplacer les profils existants. Les sauvegardes locales sont propres au navigateur ; le fichier permet de les conserver ailleurs ou de les partager. La reprise automatique du dernier montage reste indépendante des profils nommés.

Les modules de salvage Abrade, Cinch, Trawler et ReadyGrip peuvent être sélectionnés sur les Baler du Hyūn, Vulture, Fortune, MOTH et Reclaimer. Chaque tête regroupe ses deux modules indépendants. Sur le Hyūn, le deuxième emplacement de chaque bras est facultatif et vide d’origine ; son ajout en station est aussi décrit dans cet [essai du Hyūn](https://citizen-logbook.com/fr/vaisseaux/gama/gatac-hyun). Les anciennes sauvegardes et anciens exports récupèrent ces deux emplacements vides sans perdre les pièces existantes. Les modules de décapage fabriqués appliquent les courbes de qualité et sont sauvegardés avec le montage. Les coefficients des deux modules ne sont pas additionnés. ReadyGrip est un rayon tracteur : aucun débit de décapage ne lui est attribué. Les têtes et modules dédiés du Salvation restent fixes selon la [FAQ CIG](https://robertsspaceindustries.com/en/comm-link/engineering/20881-Q-A-RSI-Salvation). L’interchangeabilité des modules Baler est confirmée dans la [FAQ CIG du MOTH](https://robertsspaceindustries.com/en/comm-link/engineering/21011-Q-A-Argo-MOTH), malgré les indicateurs de verrouillage présents dans l’extraction.

Les autres équipements intégrés restent verrouillés. Les données de jeu et les recettes sont arrêtées à la révision `f182b7f111279c9193df81927c9b4dbc8c4f3291` de [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data). Le pied de chaque page et le lien de chaque visuel indiquent leurs sources. Projet communautaire indépendant de Cloud Imperium.

Vérifications : `node fleet.test.cjs`, `node salvage.test.cjs` et `node configurations.test.cjs`. Pour régénérer le catalogue de flotte : `python build-fleet.py --update-hyun-salvage` (le drapeau actualise aussi les modules Baler du Hyūn). Le script récupère les fichiers de données manquants dans le dossier voisin `fleet-reference` ; ils ne sont pas nécessaires pour consulter le site.
