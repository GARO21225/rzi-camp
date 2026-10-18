"""
Contenu de l'Induction Camp repris du document officiel
« CAMP INDUCTION » (Roxgold Sango, rév. 30/09/2026) : infrastructures,
services, code de conduite, bar, urgences médicales, contacts, quiz.

Chargé une fois par la migration 0034 ; ensuite entièrement modifiable par
l'admin (Induction Camp → gestion du contenu). L'ancien contenu n'est pas
supprimé : il est désactivé (actif=False) et peut être réactivé.
Les textes anglais d'origine sont dans le dictionnaire de traduction du
frontend (src/i18n/en.json), pour l'affichage en anglais.
"""

CONFIG = {"nom": "Camp d'opérations Roxgold Sango", "site": "Sango, Côte d'Ivoire"}

INFRAS = [
    ("Restaurant", "🍽️", "#ea580c",
     "Le restaurant sert trois repas par jour ; les horaires sont affichés à l'entrée. Le camp étant dans le périmètre de la mine, les règles HSE s'y appliquent.",
     ["Petit-déjeuner : 5h00 – 7h00 (le dimanche jusqu'à 8h00)",
      "Déjeuner : 11h45 – 13h00",
      "Dîner : 18h00 – 20h00",
      "Lavez-vous les mains avant d'entrer",
      "Régime alimentaire particulier : informez l'administration du camp",
      "Réclamations sur la qualité des repas : administration du camp",
      "Repas chauds et couverts ne sortent pas sans autorisation"]),
    ("Bar", "🍹", "#c9972b",
     "Les achats au bar se font avec des tickets vendus en carnet de 10 000 F CFA (un ticket = 500 F CFA). Certains articles se paient en F CFA. Aucun crédit n'est accordé.",
     ["Lundi au samedi : 17h00 – 21h00",
      "Dimanche : 12h00 – 22h00",
      "Interdit de fumer dans le bar",
      "Interdit : bagarres et jeux dangereux",
      "Interdit de passer derrière le comptoir",
      "Interdit : mauvais usage du matériel (ex. le billard)"]),
    ("Salle de sport", "🏋️", "#2563eb",
     "Une salle de sport est à la disposition des résidents.",
     ["Espace non-fumeur"]),
    ("Terrain de football", "⚽", "#16a34a",
     "Un terrain de football est accessible aux résidents.",
     []),
    ("Internet / Wi-Fi", "📶", "#0891b2",
     "Le Wi-Fi couvre l'ensemble du camp.",
     ["Réseau : ROX_CAMP", "Mot de passe : R0x2022seg!"]),
    ("Services aux résidents", "🧺", "#7c3aed",
     "Des sacs à linge marqués du numéro de chambre sont fournis : mettez-y le linge ou les serviettes sales, puis accrochez-le à la porte. Retour le jour même.",
     ["Linge taché de sang ou de selles : pré-nettoyage obligatoire par le résident",
      "Toilettes intérieures et extérieures séparées hommes / femmes",
      "Gardez toilettes et lavabos propres, sans déchets"]),
    ("Urgences médicales", "🚑", "#dc2626",
     "Une assistance médicale est disponible sur site 24h/24 et 7j/7. Des affiches sur les portes permettent de repérer les locaux.",
     ["Médecins MEDECIS : +225 07 69 67 18 51 — chambre B114",
      "Infirmiers MEDECIS : +225 05 46 07 03 60 — chambre B108",
      "Numéros d'urgence : (+225) 05 44 06 05 05 / (+225) 07 68 88 88 84",
      "Signalez au médecin vos antécédents (diabète, épilepsie, hypertension…)",
      "Urgence (ex. un reptile dans la chambre la nuit) : appelez les numéros d'urgence",
      "Au téléphone : parlez clairement, donnez votre nom et votre position, décrivez le danger"]),
    ("Contacts du camp", "📞", "#0f2a5c",
     "Vos interlocuteurs au camp.",
     ["Moulaye TAMBOURA — Coordinateur du camp — +225 05 02 08 16 30 — mtamboura@roxgold.com",
      "Ahmed TRAORE — Camp Officer 1 — +225 05 07 29 06 21 — atraore@roxgold.com",
      "Olivier BAHI — Camp Officer 2 — +225 05 66 51 65 31 — obahi@roxgold.com",
      "Dylan DABIRE — Responsable maintenance du camp — +225 05 09 701 393 — ddabire@roxgold.com",
      "Abdherahaman GHERBI — Chef de projet ATS — +225 07 79 29 30 65 — Samar@Tsebo.com"]),
]

REGLES = [
    ("Le camp est dans le périmètre de la mine", "🦺", "critique",
     "Les règles HSE de la mine s'appliquent aussi au camp."),
    ("Respect et courtoisie", "🤝", "critique",
     "Chacun doit se comporter avec respect et courtoisie. Le harcèlement ou l'intimidation ne seront tolérés en aucune circonstance."),
    ("Jeux d'argent, bagarres et délits", "🚫", "critique",
     "Jeux d'argent, jeux dangereux, disputes, infractions ou activités criminelles feront l'objet d'un rapport et peuvent entraîner l'expulsion du camp."),
    ("Interdiction de fumer à l'intérieur", "🚭", "important",
     "Il est interdit de fumer à l'intérieur, notamment au restaurant, en salle de réunion et à la salle de sport. Utilisez les zones fumeurs prévues."),
    ("Badge obligatoire", "🪪", "important",
     "Le badge doit être porté en permanence. La sécurité peut contrôler les bagages au départ."),
    ("Départ du camp", "🔑", "important",
     "Les résidents quittent le camp à la fin de leur période de travail, sauf autorisation de l'administration. Au départ, remettez la clé de votre chambre à l'administration du camp."),
    ("Heures de calme", "🤫", "important",
     "Silence au camp après 21h00. Les chambres ne sont pas insonorisées : soyez courtois envers vos voisins. Heures calmes : jour 9h00 – 16h00, nuit 21h00 – 6h00."),
    ("Tenue correcte", "👕", "standard",
     "Une tenue appropriée est obligatoire dans tous les espaces communs."),
    ("Animaux interdits", "🐾", "standard",
     "Les animaux de compagnie ne sont pas admis au camp."),
]

QUIZ = [
    ("À partir de quelle heure le silence est-il de rigueur au camp ?",
     ["20h00", "21h00", "22h00", "23h00"], 1,
     "Silence après 21h00 ; heures calmes de nuit : 21h00 – 6h00."),
    ("Combien vaut un ticket du bar ?",
     ["250 F CFA", "500 F CFA", "1 000 F CFA", "10 000 F CFA"], 1,
     "Les tickets sont vendus en carnet de 10 000 F CFA ; un ticket vaut 500 F CFA. Aucun crédit."),
    ("Où peut-on fumer ?",
     ["Au restaurant", "À la salle de sport", "Dans les zones fumeurs prévues", "Au bar"], 2,
     "Interdit de fumer à l'intérieur (restaurant, salle de réunion, salle de sport, bar)."),
    ("Que faire de la clé de votre chambre au départ ?",
     ["La garder pour la prochaine rotation", "La laisser dans la chambre", "La remettre à l'administration du camp", "La confier à un collègue"], 2,
     "La clé est remise à l'administration du camp à chaque départ."),
    ("Quel numéro appeler en cas d'urgence au camp ?",
     ["(+225) 05 44 06 05 05", "112", "185", "Le restaurant"], 0,
     "Numéros d'urgence : (+225) 05 44 06 05 05 / (+225) 07 68 88 88 84."),
    ("Le badge doit être porté…",
     ["Seulement au restaurant", "Seulement sur le site minier", "En permanence", "Uniquement le jour de l'arrivée"], 2,
     "Le badge se porte en permanence ; la sécurité peut contrôler les bagages au départ."),
    ("Un linge taché de sang doit être…",
     ["Déposé tel quel à la blanchisserie", "Pré-nettoyé par le résident avant la blanchisserie", "Laissé dans la chambre", "Jeté à la poubelle"], 1,
     "Le linge taché de sang ou de selles est pré-nettoyé par le résident."),
]

# Questions supplémentaires (toutes tirées du contenu ci-dessus) : à chaque tentative, le quiz tire au hasard
# NB_QUESTIONS_QUIZ questions dans l'ensemble des questions actives, avec les réponses mélangées.
QUIZ_COMPLEMENT = [
    ("Quelles sont les heures du petit-déjeuner ?", ["5h00 – 7h00", "6h00 – 9h00", "4h00 – 6h00", "7h00 – 10h00"], 0,
     "Petit-déjeuner : 5h00 – 7h00 (le dimanche jusqu'à 8h00)."),
    ("Jusqu'à quelle heure sert-on le petit-déjeuner le dimanche ?", ["7h00", "8h00", "9h00", "10h00"], 1,
     "Le dimanche, le petit-déjeuner est servi jusqu'à 8h00."),
    ("Quelles sont les heures du déjeuner ?", ["11h45 – 13h00", "12h00 – 14h00", "11h00 – 12h00", "13h00 – 15h00"], 0,
     "Déjeuner : 11h45 – 13h00."),
    ("Quelles sont les heures du dîner ?", ["19h00 – 21h00", "18h00 – 20h00", "17h00 – 19h00", "20h00 – 22h00"], 1,
     "Dîner : 18h00 – 20h00."),
    ("Vous suivez un régime alimentaire particulier. Qui informer ?", ["Le serveur à chaque repas", "L'administration du camp", "Personne", "Le barman"], 1,
     "Régime alimentaire particulier : informez l'administration du camp."),
    ("À qui adresser une réclamation sur la qualité des repas ?", ["Au barman", "À la sécurité", "À l'administration du camp", "Au médecin"], 2,
     "Les réclamations sur la qualité des repas vont à l'administration du camp."),
    ("Peut-on sortir du restaurant avec un repas chaud ou des couverts ?", ["Oui, toujours", "Non, pas sans autorisation", "Oui, après 20h00", "Oui, le dimanche"], 1,
     "Repas chauds et couverts ne sortent pas sans autorisation."),
    ("Quelles sont les heures d'ouverture du bar du lundi au samedi ?", ["17h00 – 21h00", "12h00 – 22h00", "18h00 – 23h00", "16h00 – 20h00"], 0,
     "Lundi au samedi : 17h00 – 21h00."),
    ("Quelles sont les heures d'ouverture du bar le dimanche ?", ["17h00 – 21h00", "12h00 – 22h00", "10h00 – 18h00", "Fermé"], 1,
     "Dimanche : 12h00 – 22h00."),
    ("Le bar accorde-t-il du crédit ?", ["Oui, jusqu'à la fin du mois", "Oui, aux habitués", "Non, aucun crédit n'est accordé", "Oui, le dimanche"], 2,
     "Aucun crédit n'est accordé au bar."),
    ("Que valent les carnets de tickets vendus au bar ?", ["1 000 F CFA", "5 000 F CFA", "10 000 F CFA", "50 000 F CFA"], 2,
     "Les tickets sont vendus en carnet de 10 000 F CFA (un ticket = 500 F CFA)."),
    ("Qu'est-ce qui est interdit au bar ?", ["Commander une boisson", "Passer derrière le comptoir", "S'asseoir", "Payer en tickets"], 1,
     "Il est interdit de passer derrière le comptoir, de se battre, de jouer dangereusement ou de mal utiliser le matériel (ex. le billard)."),
    ("Que fait-on de son linge sale ?", ["On le lave dans la chambre", "On le met dans le sac à linge marqué du numéro de chambre", "On le jette", "On le dépose au restaurant"], 1,
     "Un sac à linge marqué du numéro de chambre est fourni : mettez-y le linge sale."),
    ("Où accroche-t-on le sac à linge sale ?", ["À la fenêtre", "À la porte de la chambre", "Au restaurant", "À la réception du camp"], 1,
     "Le sac à linge se met à la porte de la chambre."),
    ("Quand le linge est-il rendu ?", ["Le jour même", "Sous 3 jours", "En fin de rotation", "Le lundi suivant"], 0,
     "Retour du linge le jour même."),
    ("L'assistance médicale sur site est disponible…", ["De 8h à 17h", "24h/24 et 7j/7", "Uniquement la nuit", "Du lundi au vendredi"], 1,
     "Une assistance médicale est disponible sur site 24h/24 et 7j/7."),
    ("Que devez-vous signaler au médecin ?", ["Votre salaire", "Vos antécédents (diabète, épilepsie, hypertension…)", "Vos horaires de repas", "Le numéro de votre chambre uniquement"], 1,
     "Signalez au médecin vos antécédents (diabète, épilepsie, hypertension…)."),
    ("Un reptile est dans votre chambre la nuit. Que faites-vous ?", ["Vous attendez le matin", "Vous appelez les numéros d'urgence", "Vous le chassez seul", "Vous prévenez un voisin"], 1,
     "Urgence : appelez les numéros d'urgence."),
    ("Au téléphone en cas d'urgence, que faut-il faire ?", ["Raccrocher dès que possible", "Parler clairement, donner son nom et sa position, décrire le danger", "Envoyer un SMS", "Rappeler plus tard"], 1,
     "Parlez clairement, donnez votre nom et votre position, décrivez le danger."),
    ("Le harcèlement ou l'intimidation sont…", ["Tolérés entre collègues", "Tolérés en dehors des heures de travail", "Tolérés en aucune circonstance", "Tolérés au bar"], 2,
     "Le harcèlement ou l'intimidation ne seront tolérés en aucune circonstance."),
    ("Que risque-t-on en cas de jeux d'argent, de bagarre ou de délit ?", ["Rien", "Un rapport et une possible expulsion du camp", "Une simple remarque orale", "Une amende au bar"], 1,
     "Ces faits font l'objet d'un rapport et peuvent entraîner l'expulsion du camp."),
    ("Quelles sont les heures calmes de jour ?", ["9h00 – 16h00", "12h00 – 14h00", "6h00 – 9h00", "16h00 – 21h00"], 0,
     "Heures calmes : jour 9h00 – 16h00, nuit 21h00 – 6h00."),
    ("Les chambres sont-elles insonorisées ?", ["Oui, totalement", "Non : soyez courtois envers vos voisins", "Seulement les étages", "Oui, la nuit"], 1,
     "Les chambres ne sont pas insonorisées : soyez courtois envers vos voisins."),
    ("Quelle tenue est exigée dans les espaces communs ?", ["Une tenue appropriée", "Aucune règle", "La tenue de travail uniquement", "Un uniforme du camp"], 0,
     "Une tenue appropriée est obligatoire dans tous les espaces communs."),
    ("Peut-on amener un animal de compagnie au camp ?", ["Oui, s'il est petit", "Oui, avec autorisation", "Non, les animaux ne sont pas admis", "Oui, pour les longues rotations"], 2,
     "Les animaux de compagnie ne sont pas admis au camp."),
    ("Les règles HSE de la mine s'appliquent-elles au camp ?", ["Non, seulement sur le site minier", "Oui, le camp est dans le périmètre de la mine", "Seulement la nuit", "Seulement pour les visiteurs"], 1,
     "Le camp est dans le périmètre de la mine : les règles HSE s'y appliquent aussi."),
    ("La salle de sport est…", ["Un espace non-fumeur", "Une zone fumeurs", "Réservée aux cadres", "Fermée le dimanche"], 0,
     "La salle de sport est un espace non-fumeur."),
    ("Qui quitte le camp à la fin de sa période de travail ?", ["Les résidents, sauf autorisation de l'administration", "Personne", "Seulement les visiteurs", "Seulement les sous-traitants"], 0,
     "Les résidents quittent le camp à la fin de leur période de travail, sauf autorisation de l'administration."),
    ("Que peut contrôler la sécurité au départ ?", ["Les bagages", "Les téléphones", "Les chaussures", "Rien"], 0,
     "La sécurité peut contrôler les bagages au départ."),
    ("Qui est le Coordinateur du camp ?", ["Moulaye TAMBOURA", "Ahmed TRAORE", "Olivier BAHI", "Dylan DABIRE"], 0,
     "Moulaye TAMBOURA est le Coordinateur du camp."),
    ("Qui est le Responsable maintenance du camp ?", ["Moulaye TAMBOURA", "Ahmed TRAORE", "Olivier BAHI", "Dylan DABIRE"], 3,
     "Dylan DABIRE est le Responsable maintenance du camp."),
]

QUIZ_TOUT = QUIZ + QUIZ_COMPLEMENT


def charger(apps=None):
    """Désactive le contenu existant et charge le contenu Roxgold. Idempotent :
    un élément déjà présent avec le même titre est réactivé et mis à jour."""
    if apps is None:
        from .models import InductionCampConfig as Config, InductionInfra as Infra, InductionRegle as Regle, InductionQuizQuestion as Quiz
    else:
        Config = apps.get_model("residences", "InductionCampConfig")
        Infra = apps.get_model("residences", "InductionInfra")
        Regle = apps.get_model("residences", "InductionRegle")
        Quiz = apps.get_model("residences", "InductionQuizQuestion")

    cfg = Config.objects.order_by("-id").first() or Config()
    cfg.nom, cfg.site = CONFIG["nom"], CONFIG["site"]
    cfg.save()

    Infra.objects.update(actif=False)
    for ordre, (titre, emoji, couleur, desc, details) in enumerate(INFRAS, 1):
        Infra.objects.update_or_create(titre=titre, defaults=dict(emoji=emoji, couleur=couleur, description=desc,
                                                                  details=details, ordre=ordre, actif=True))
    Regle.objects.update(actif=False)
    for ordre, (titre, emoji, niveau, texte) in enumerate(REGLES, 1):
        Regle.objects.update_or_create(titre=titre, defaults=dict(emoji=emoji, niveau=niveau, texte=texte, ordre=ordre, actif=True))
    Quiz.objects.update(actif=False)
    for ordre, (question, options, bonne, explication) in enumerate(QUIZ_TOUT, 1):
        Quiz.objects.update_or_create(question=question, defaults=dict(options=options, bonne_reponse=bonne,
                                                                       explication=explication, ordre=ordre, actif=True))
