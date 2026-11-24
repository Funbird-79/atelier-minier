# Atelier minier · minage et salvage

Configurateurs communautaires Star Citizen 4.10.3 pour Nyx, Stanton et Pyro.

- [ARGO MOLE](https://funbird-79.github.io/atelier-minier/)
- [Gatac Hyūn](https://funbird-79.github.io/atelier-minier/hyun.html)
- [Flotte : Prospector, Golem, Vulture, Fortune, Salvation, MOTH et Reclaimer](https://funbird-79.github.io/atelier-minier/flotte.html)

Composition d’origine, composants compatibles, préréglage équilibré, comparaison des performances, pods, recettes de blueprint et qualité des matériaux. Site statique sans compte visiteur ni serveur à financer.

Le bloc **Mes configurations** permet d’enregistrer plusieurs profils nommés par vaisseau, puis de les charger ou de les mettre à jour. Les composants, modules, pods, peintures et qualités sont conservés. La dernière suppression peut être annulée, même après rechargement. Le bouton **Télécharger** exporte le montage actuel dans un fichier de configuration ; **Importer un fichier** enregistre une copie sur le vaisseau correspondant sans remplacer les profils existants. Les sauvegardes locales sont propres au navigateur ; le fichier permet de les conserver ailleurs ou de les partager. La reprise automatique du dernier montage reste indépendante des profils nommés.

Les équipements intégrés restent verrouillés. Les données de jeu et les recettes sont arrêtées à la révision `f182b7f111279c9193df81927c9b4dbc8c4f3291` de [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data). Le pied de chaque page et le lien de chaque visuel indiquent leurs sources. Projet communautaire indépendant de Cloud Imperium.

Vérifications : `node fleet.test.cjs` et `node configurations.test.cjs`. Pour régénérer le catalogue de flotte : `python build-fleet.py`. Le script récupère les fichiers de données manquants dans le dossier voisin `fleet-reference` ; ils ne sont pas nécessaires pour consulter le site.
