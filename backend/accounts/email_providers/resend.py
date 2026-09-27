"""
Fournisseur Resend (resend.com) - API HTTP simple, un seul endpoint POST,
pas de SDK necessaire (evite d'ajouter une dependance tierce en plus de
`requests`, deja dans requirements.txt - meme choix que les fournisseurs
SMS de ce projet, qui appellent tous leur API en HTTP brut).

BASE_URL: https://api.resend.com
Envoi   : POST /emails   (Authorization: Bearer <API key>)
          {"from": "Nom <adresse@domaine>", "to": ["dest@..."],
           "subject": "...", "html": "...", "text": "..."}
          -> 200 {"id": "..."} si accepte pour envoi.

Important - a propos du champ "from" (verifie contre le comportement
documente de Resend, stable depuis son lancement) :
- Une adresse email n'a JAMAIS de forme "utilisateur@IP:PORT" - le
  protocole email (SMTP) route uniquement par NOM DE DOMAINE (enregistrements
  DNS MX/SPF/DKIM), jamais par adresse IP brute. Resend, comme tout
  fournisseur d'envoi email serieux, EXIGE donc un domaine (verifie via 3
  enregistrements DNS ajoutes une seule fois dans le tableau de bord
  Resend) pour envoyer vers n'importe quel destinataire. Il n'existe
  aucun equivalent "IP+PORT" a la place d'un domaine - contrairement a un
  serveur web, ce n'est pas configurable ainsi cote email.
- SEULE exception : l'adresse sandbox fournie par Resend elle-meme,
  "onboarding@resend.dev", qui fonctionne SANS aucun domaine a configurer
  - mais UNIQUEMENT en mode test : Resend n'autorise l'envoi qu'a
  l'adresse email du compte Resend lui-meme (celle utilisee pour
  s'inscrire), jamais a un destinataire tiers (ici : le personnel du
  camp). Utile pour valider le code, pas utilisable en production.
- Pour envoyer reellement au personnel (n'importe quelle adresse), il
  faut donc un vrai domaine (ou sous-domaine) verifie dans Resend - pas
  forcement un site web, juste un nom de domaine dont on controle les
  enregistrements DNS (ex: un sous-domaine dedie comme
  "mail.roxgold-sitelife.com" si un domaine est deja possede par
  ailleurs, ou un domaine achete pour quelques euros/an rien que pour
  cet usage).
"""
import requests

from .base import EmailProvider
from ..models import Parametre


class ResendProvider(EmailProvider):
    code = "resend"
    BASE_URL = "https://api.resend.com"

    def envoyer(self, destinataire, sujet, corps_html, corps_texte=""):
        api_key = Parametre.get("resend_api_key", "")
        if not api_key:
            return False, "Resend non configuré (clé API manquante — tableau de bord resend.com/api-keys)"

        adresse_from = Parametre.get("resend_email_from", "onboarding@resend.dev") or "onboarding@resend.dev"
        nom_from = Parametre.get("resend_email_from_nom", "")
        expediteur = f"{nom_from} <{adresse_from}>" if nom_from else adresse_from

        payload = {
            "from": expediteur,
            "to": [destinataire],
            "subject": sujet,
            "html": corps_html,
        }
        if corps_texte:
            payload["text"] = corps_texte

        try:
            resp = requests.post(
                f"{self.BASE_URL}/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=15,
            )
            try:
                data = resp.json() if resp.content else {}
            except ValueError:
                data = {}
            if resp.status_code == 401:
                return False, "Resend : clé API invalide ou révoquée."
            if resp.status_code == 403:
                return False, (
                    "Resend : adresse expéditeur refusée — le domaine de "
                    f"« {adresse_from} » n'est pas vérifié dans Resend (ou vous "
                    "utilisez onboarding@resend.dev pour envoyer à un "
                    "destinataire autre que le compte Resend lui-même, ce que "
                    "Resend interdit hors mode test)."
                )
            if resp.status_code == 422:
                return False, f"Resend : requête invalide — {data.get('message', resp.text[:200])}"
            if resp.status_code == 429:
                return False, "Resend : limite de requêtes atteinte, réessayez plus tard."
            if resp.status_code >= 400:
                return False, f"Erreur Resend ({resp.status_code}) : {data.get('message', resp.text[:200])}"
            message_id = data.get("id", "")
            return True, f"envoyé via Resend (id {message_id})" if message_id else "envoyé via Resend"
        except requests.exceptions.RequestException as e:
            return False, f"Erreur réseau Resend : {e}"
        except Exception as e:
            return False, f"Erreur Resend : {e}"
