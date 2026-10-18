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
    for ordre, (question, options, bonne, explication) in enumerate(QUIZ, 1):
        Quiz.objects.update_or_create(question=question, defaults=dict(options=options, bonne_reponse=bonne,
                                                                       explication=explication, ordre=ordre, actif=True))
