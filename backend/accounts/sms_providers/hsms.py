"""
Fournisseur HSMS (hsms.ci) - API v2 (documentation officielle fournie par
l'utilisateur, hsms.ci/api-docs, version 2.0.0 - Legacy /api/ est marquée
"deprecated" dans cette documentation, migration vers /api/v2/ demandée).

Authentification (verifiee dans la doc v2) :
- Un jeton Bearer, obtenu via POST /api/v2/sms/token/ avec email+mot de
  passe du compte HSMS ("Le jeton expire automatiquement selon la
  politique du serveur" - la doc ne precise pas la duree). On supporte
  donc DEUX façons de le fournir :
    1. Token statique copié depuis le tableau de bord (ce que
       l'utilisateur a fourni : CLIENT ID / CLIENT SECRET / TOKEN) —
       utilisé tel quel tant qu'il est valide.
    2. Email + mot de passe (optionnels) — si le token statique est
       rejeté (401) ET que email/mot de passe sont configurés, on
       obtient un nouveau jeton automatiquement et on le met en cache
       dans Parametre pour les envois suivants.
- clientid + clientsecret (par application HSMS) envoyes dans le CORPS
  de chaque requete SMS/statut/solde, en plus du token.

Important - vérifié dans la doc v2 fournie (section "Envoyer un SMS",
schéma complet de /api/v2/sms/send/) : AUCUN champ sender_id / sender_name
n'existe dans cette API HTTP. Un "sender ID" (source_addr) n'existe QUE
côté SMPP (protocole séparé, à accès sur demande/validation, pour les
intégrations à fort volume) - il n'est ni requis ni utilisé ici.

BASE_URL: https://hsms.ci/api/v2
Jeton : POST /api/v2/sms/token/       (email, password) -> token
Envoi : POST /api/v2/sms/send/        (clientid, clientsecret, message, telephone, unicode, scheduled_time)
Statut: POST /api/v2/sms/status/      (clientid, clientsecret, tickets: [...])
Solde : POST /api/v2/sms/check-balance/ (clientid, clientsecret) -> balance
Format telephone attendu : indicatif pays SANS le "+" (ex: 2250700000001),
plusieurs numeros separes par des virgules pour un envoi groupe.
"""
from .base import SMSProvider
from ..models import Parametre
from ..phone import vers_international


class HSMSProvider(SMSProvider):
    code = "hsms"
    BASE_URL = "https://hsms.ci/api/v2"

    # -- identifiants ---------------------------------------------------
    def _identifiants(self):
        return (
            Parametre.get("sms_hsms_token", ""),
            Parametre.get("sms_hsms_client_id", ""),
            Parametre.get("sms_hsms_client_secret", ""),
        )

    def _credentials_login(self):
        return (
            Parametre.get("sms_hsms_email", ""),
            Parametre.get("sms_hsms_password", ""),
        )

    def _sauver_token(self, token):
        Parametre.objects.update_or_create(
            cle="sms_hsms_token",
            defaults={"valeur": token, "description": "HSMS — Token API (rafraîchi automatiquement)"},
        )

    def _obtenir_nouveau_token(self):
        """POST /api/v2/sms/token/ avec email+mot de passe. Renvoie le
        token ou None si impossible (pas d'email/mdp configurés, ou
        échec de l'appel)."""
        email, password = self._credentials_login()
        if not (email and password):
            return None
        try:
            import requests
            resp = requests.post(
                f"{self.BASE_URL}/sms/token/",
                headers={"Content-Type": "application/json"},
                json={"email": email, "password": password},
                timeout=10,
            )
            data = resp.json() if resp.content else {}
            if resp.status_code == 200 and data.get("token"):
                self._sauver_token(data["token"])
                return data["token"]
        except Exception:
            pass
        return None

    def _requete(self, endpoint, token, payload):
        """POST authentifié vers un endpoint v2, avec UNE tentative de
        rafraîchissement du token (via email/mdp) si le token en place
        est rejeté (401)."""
        import requests
        resp = requests.post(
            f"{self.BASE_URL}/{endpoint}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        if resp.status_code == 401:
            nouveau_token = self._obtenir_nouveau_token()
            if nouveau_token and nouveau_token != token:
                resp = requests.post(
                    f"{self.BASE_URL}/{endpoint}",
                    headers={"Authorization": f"Bearer {nouveau_token}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=15,
                )
        return resp

    # -- envoi ------------------------------------------------------------
    def envoyer(self, numero, message, canal="sms"):
        if canal == "whatsapp":
            return False, "HSMS ne gère pas WhatsApp — configurez whatsapp_provider=meta pour ce canal."
        token, client_id, client_secret = self._identifiants()
        if not client_id or not client_secret:
            return False, "HSMS non configuré (Client ID / Client Secret manquant — tableau de bord hsms.ci, réglages de l'application)"
        if not token:
            token = self._obtenir_nouveau_token() or ""
        if not token:
            return False, "HSMS non configuré (Token manquant — copiez-le depuis le tableau de bord hsms.ci, ou renseignez email/mot de passe pour l'obtenir automatiquement)"

        # HSMS attend l'indicatif SANS le "+" (ex: 2250700000001) - phone.py
        # renvoie "+225..." par defaut, on retire juste le prefixe.
        numero_e164 = vers_international(numero).lstrip("+")
        try:
            resp = self._requete("sms/send/", token, {
                "clientid": client_id,
                "clientsecret": client_secret,
                "message": message,
                "telephone": numero_e164,
                "unicode": False,
            })
            try:
                data = resp.json()
            except ValueError:
                data = {}
            if resp.status_code == 401:
                return False, "HSMS : jeton ou identifiants d'application invalides — vérifiez Token / Client ID / Client Secret (ou email+mot de passe pour un renouvellement automatique)."
            if resp.status_code == 400:
                return False, f"HSMS : {data.get('message', 'requête invalide (numéro invalide ou solde insuffisant)')}"
            if resp.status_code >= 400:
                return False, f"Erreur HSMS ({resp.status_code}) : {data.get('message', resp.text[:200])}"
            if data.get("success") is False:
                return False, f"HSMS : {data.get('message', 'échec non précisé')}"
            tasks = data.get("tasks") or {}
            ticket = tasks.get(numero_e164) if isinstance(tasks, dict) else None
            info = "envoyé via HSMS"
            if isinstance(ticket, dict) and ticket.get("ticket"):
                info = f"envoyé via HSMS (ticket {ticket['ticket']})"
            return True, info
        except requests.exceptions.RequestException as e:
            return False, f"Erreur réseau HSMS : {e}"
        except Exception as e:
            return False, f"Erreur HSMS : {e}"

    # -- statut de livraison -----------------------------------------------
    def get_status(self, message_id: str):
        token, client_id, client_secret = self._identifiants()
        if not (client_id and client_secret):
            return False, "HSMS non configuré"
        if not token:
            token = self._obtenir_nouveau_token() or ""
        if not token:
            return False, "HSMS : token indisponible"
        try:
            resp = self._requete("sms/status/", token, {
                "clientid": client_id,
                "clientsecret": client_secret,
                "tickets": [message_id],
            })
            data = resp.json() if resp.content else {}
            if resp.status_code != 200 or not data.get("success"):
                return False, data.get("message", f"Erreur HSMS ({resp.status_code})")
            resultats = data.get("results") or []
            if resultats:
                libelle = resultats[0].get("status_label", "Statut inconnu")
                return True, libelle
            return False, "Aucun résultat pour ce ticket"
        except Exception as e:
            return False, f"Erreur HSMS : {e}"

    # -- solde --------------------------------------------------------------
    def get_balance(self):
        token, client_id, client_secret = self._identifiants()
        if not (client_id and client_secret):
            return None
        if not token:
            token = self._obtenir_nouveau_token() or ""
        if not token:
            return None
        try:
            resp = self._requete("sms/check-balance/", token, {
                "clientid": client_id,
                "clientsecret": client_secret,
            })
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("success"):
                return data.get("balance")
            return None
        except Exception:
            return None
