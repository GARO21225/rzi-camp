from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework import status, viewsets
from django.contrib.auth.models import User
from .serializers import UserSerializer, RoleCustomSerializer, RapportPlanifieSerializer
from .models import Parametre, RoleCustom, Profile, RapportPlanifie, CodeOTP

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def liste_parametres(request):
    """Liste tous les paramètres. Lecture ouverte à tout utilisateur connecté
    (certains, comme la société par défaut, sont utilisés par des formulaires
    non-admin) ; seule l'écriture est réservée aux administrateurs."""
    defauts = {
        'sla_critique_h': ('2',  'Délai SLA — priorité Critique (heures)'),
        'sla_haute_h':    ('8',  'Délai SLA — priorité Haute (heures)'),
        'sla_moyenne_h':  ('24', 'Délai SLA — priorité Moyenne (heures)'),
        'sla_basse_h':    ('72', 'Délai SLA — priorité Basse (heures)'),
        'societe_defaut': ('ROXGOLD', 'Société par défaut (personnel Employé Roxgold)'),
        'nom_camp':       ('Roxgold Sango', 'Nom du camp affiché dans l\'application'),
        'mm_numero_om':   ('', 'Orange Money — numéro marchand du camp'),
        'mm_numero_wave': ('', 'Wave — numéro marchand du camp'),
        'mm_numero_mtn':  ('', 'MTN Mobile Money — numéro marchand du camp'),
        'mm_numero_moov': ('', 'Moov Money — numéro marchand du camp'),
        'theme_primaire':  ('#0F2A5C', 'Couleur primaire — headers, boutons principaux'),
        'theme_accent':    ('#C9972B', 'Couleur accent — mise en avant, alertes secondaires'),
        'theme_succes':    ('#16A34A', 'Couleur succès — statuts "libre/OK/validé"'),
        'theme_danger':    ('#DC2626', 'Couleur danger — statuts "occupé/erreur/critique"'),
        'theme_info':      ('#2563EB', 'Couleur info — statuts "réservé/information"'),
        'theme_police':    ('IBM Plex Sans', "Police de caractères de toute l'application"),
        'theme_fond_induction': ('#0F2A5C', 'Couleur de fond des pages Induction (dégradé généré automatiquement autour de cette couleur)'),
        'theme_fond_app': ('#f1f5f9', "Couleur de fond de toutes les autres pages de l'application"),
        'nom_application': ('Roxgold SiteLife', "Nom de l'application affiché dans la barre latérale, le titre d'onglet et l'écran de connexion"),
        # Plan de gestion de voyage (JMP) - numeros d'urgence et coordinateur
        # securite, fixes pour tout le camp, imprimes sur chaque document JMP
        # genere avant un voyage.
        'jmp_tel_satellite': ('', "JMP — Numéro de téléphone satellite d'urgence"),
        'jmp_tel_mtn': ('', "JMP — Numéro MTN du centre d'urgence"),
        'jmp_tel_orange': ('', "JMP — Numéro Orange du centre d'urgence"),
        'jmp_securite_nom': ('', "JMP — Nom du responsable sécurité qui approuve le document"),
        'jmp_securite_fonction': ('SECURITY COORDINATOR', "JMP — Fonction du responsable sécurité"),
        'jmp_logo_base64': ('', "JMP — Logo d'en-tête (image encodée base64) — pré-rempli via migration avec le logo Fortuna Mining/Roxgold Sango fourni"),
        'jmp_logo_mime': ('image/jpeg', "JMP — Type MIME du logo d'en-tête"),
        # Connexion par SMS (OTP) - 'test' n'envoie aucun SMS reel (journalise
        # seulement, code visible dans la reponse API en mode DEBUG) : permet
        # de valider tout le flux avant de payer/configurer un fournisseur.
        'sms_provider': ('test', "Fournisseur SMS pour la connexion par code OTP : test, orange, africastalking, prosms, hsms (bientôt)"),
        'canal_otp': ('sms', "Canal d'envoi du code OTP : sms ou whatsapp"),
        'whatsapp_provider': ('auto', "Fournisseur pour le canal WhatsApp spécifiquement : meta (API WhatsApp Business officielle) — vide/auto désactive le canal WhatsApp"),
        'meta_whatsapp_phone_number_id': ('', "API Meta WhatsApp — Phone Number ID (developers.facebook.com)"),
        'meta_whatsapp_access_token': ('', "API Meta WhatsApp — Access Token (permanent, généré depuis Meta Business Manager)"),
        'meta_whatsapp_template_name': ('', "API Meta WhatsApp — Nom du modèle de message approuvé (une seule variable {{1}})"),
        'meta_whatsapp_template_lang': ('fr', "API Meta WhatsApp — Code langue du modèle (ex: fr, fr_FR)"),
        'sms_orange_client_id': ('', 'Orange SMS API — Client ID (developer.orange.com)'),
        'sms_orange_client_secret': ('', 'Orange SMS API — Client Secret'),
        'sms_orange_from': ('', 'Orange SMS API — Numéro expéditeur court (ex: 225XXXXXXXX)'),
        'sms_prosms_client_id': ('', 'proSMS — Client ID (prosms.ci/api-credentials, confirmé et documenté)'),
        'sms_prosms_client_secret': ('', 'proSMS — Client Secret'),
        'sms_prosms_sender_id': ('', 'proSMS — Sender ID (doit être pré-approuvé sur prosms.ci, sinon rejeté)'),
        'sms_hsms_api_key': ('', 'HSMS — Clé API (hsms.ci, en attente de sa documentation technique)'),
        'sms_hsms_sender_id': ('', 'HSMS — Nom expéditeur'),
        'sms_at_username': ("", "Africa's Talking — Username"),
        'sms_at_api_key': ("", "Africa's Talking — API Key"),
        # Menus par role - configurable depuis Parametrage sans toucher au
        # Menus/lecture-seule par role : GERES DESORMAIS PAR LE MODELE
        # RoleCustom (voir accounts/models.py + RoleCustomViewSet), plus par
        # ce systeme cle/valeur - superseded, retire d'ici pour eviter la
        # confusion entre deux sources de verite. La migration 0007 a deja
        # transfere toute personnalisation existante vers RoleCustom.
    }
    existants = {p.cle: p for p in Parametre.objects.all()}
    out = []
    for cle, (defaut, desc) in defauts.items():
        p = existants.get(cle)
        out.append({
            'cle': cle,
            'valeur': p.valeur if p else defaut,
            'description': p.description if p else desc,
        })
    # Inclure aussi tout paramètre custom non listé ci-dessus
    for cle, p in existants.items():
        if cle not in defauts:
            out.append({'cle': p.cle, 'valeur': p.valeur, 'description': p.description})
    return Response(out)

@api_view(["POST"])
@permission_classes([IsAdminUser])
def sauver_parametres(request):
    """Sauvegarde en masse : {"parametres": [{"cle":..., "valeur":..., "description":...}, ...]}"""
    items = request.data.get('parametres', [])
    if not isinstance(items, list):
        return Response({'error': 'Format invalide : "parametres" doit être une liste'}, status=400)
    saved = 0
    for it in items:
        cle = (it.get('cle') or '').strip()
        if not cle:
            continue
        Parametre.objects.update_or_create(
            cle=cle,
            defaults={'valeur': it.get('valeur', ''), 'description': it.get('description', '')}
        )
        saved += 1
    return Response({'ok': True, 'message': f'{saved} paramètre(s) enregistré(s)'})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)

@api_view(["GET"])
@permission_classes([IsAdminUser])
def liste_users(request):
    """Liste tous les utilisateurs (admin seulement)"""
    users = User.objects.all().select_related("profile").order_by("username")
    return Response(UserSerializer(users, many=True).data)

@api_view(["POST"])
@permission_classes([IsAdminUser])
def toggle_user_active(request, user_id):
    """Activer/désactiver un compte utilisateur"""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Utilisateur non trouvé"}, status=404)
    if u.is_superuser and not request.user.is_superuser:
        return Response({"error": "Ne peut pas désactiver un superadmin"}, status=403)
    u.is_active = not u.is_active
    u.save(update_fields=["is_active"])
    return Response({
        "ok": True,
        "is_active": u.is_active,
        "message": f"Compte {'activé' if u.is_active else 'désactivé'} : {u.username}"
    })

@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def delete_user(request, user_id):
    """Supprimer un utilisateur"""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Utilisateur non trouvé"}, status=404)
    if u == request.user:
        return Response({"error": "Impossible de supprimer son propre compte"}, status=400)
    if u.is_superuser and not request.user.is_superuser:
        return Response({"error": "Non autorisé"}, status=403)
    username = u.username
    u.delete()
    return Response({"ok": True, "message": f"Utilisateur {username} supprimé"})

@api_view(["POST"])
@permission_classes([IsAdminUser])
def assigner_role(request, user_id):
    """Assigner un rôle à un utilisateur"""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Utilisateur non trouvé"}, status=404)
    role = request.data.get("role")
    valid = ["admin","agent","restauration","technicien","menage"]
    if role not in valid:
        return Response({"error": f"Rôle invalide. Valeurs: {valid}"}, status=400)
    profile = u.profile
    profile.role = role
    profile.save(update_fields=["role"])
    if role == "admin":
        u.is_staff = True
        u.save(update_fields=["is_staff"])
    return Response({"ok": True, "role": role})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Modifier son propre mot de passe"""
    user = request.user
    old_pwd  = request.data.get("ancien_mot_de_passe", "")
    new_pwd  = request.data.get("nouveau_mot_de_passe", "")
    confirm  = request.data.get("confirmer_mot_de_passe", "")

    if not user.check_password(old_pwd):
        return Response({"error": "Ancien mot de passe incorrect"}, status=400)
    if len(new_pwd) < 6:
        return Response({"error": "Le nouveau mot de passe doit faire au moins 6 caractères"}, status=400)
    if new_pwd != confirm:
        return Response({"error": "Les mots de passe ne correspondent pas"}, status=400)

    user.set_password(new_pwd)
    user.save()
    return Response({"message": "Mot de passe modifié avec succès ✅"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reset_user_password(request, user_id):
    """Admin: réinitialiser le mot de passe d'un utilisateur"""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({"error": "Admin requis"}, status=403)
    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Utilisateur non trouvé"}, status=404)
    new_pwd = request.data.get("mot_de_passe", "rzi2026!")
    target.set_password(new_pwd)
    target.save()
    return Response({"message": f"Mot de passe réinitialisé pour {target.username}"})


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    """Générer un token de reset — jamais exposé directement au client"""
    from django.core.cache import cache

    username = request.data.get("username", "").strip()
    if not username:
        return Response({"error": "Identifiant requis"}, status=400)

    # Rate limiting basique par IP : 5 tentatives / 15 min
    ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', 'unknown')).split(',')[0].strip()
    rl_key = f"forgot_pwd_rl:{ip}"
    attempts = cache.get(rl_key, 0)
    if attempts >= 5:
        return Response({"error": "Trop de tentatives. Réessayez dans 15 minutes."}, status=429)
    cache.set(rl_key, attempts + 1, timeout=900)

    user = User.objects.filter(username=username).first()
    if not user:
        # Sécurité: ne pas révéler si le compte existe
        return Response({"message": "Si ce compte existe, un message de réinitialisation a été envoyé."})

    # Générer un token temporaire (valide 1h)
    import secrets, datetime
    from django.core.cache import cache
    token = secrets.token_urlsafe(32)
    cache.set(f"reset:{token}", user.id, timeout=3600)

    # Essayer d'envoyer un email
    email_sent = False
    try:
        from django.core.mail import send_mail
        from django.conf import settings
        from residences.models import Personnel
        pers = Personnel.objects.filter(user=user).first()
        if user.email or (pers and pers.email):
            dest = user.email or pers.email
            app_url = getattr(settings, "APP_URL", "https://rzi-camp-frontend.onrender.com")
            send_mail(
                subject="🔐 Réinitialisation de mot de passe — Roxgold SiteLife",
                message=f"""Bonjour {user.first_name},

Votre lien de réinitialisation (valide 1h) :
{app_url}/reset-password?token={token}

Si vous n\'avez pas demandé cette réinitialisation, ignorez ce message.

L\'équipe Roxgold SiteLife""",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[dest],
                fail_silently=True,
            )
            email_sent = True
    except Exception:
        pass

    # SÉCURITÉ CRITIQUE : ne JAMAIS renvoyer le token dans la réponse HTTP,
    # même si l'email n'a pas pu être envoyé — sinon n'importe qui peut
    # prendre le contrôle de n'importe quel compte (y compris admin) en
    # appelant cet endpoint sans aucune authentification.
    if not email_sent:
        # Log côté serveur uniquement (visible par l'admin via les logs Render),
        # jamais transmis au client.
        import logging
        logging.getLogger('security').warning(
            f"Reset password demandé pour {username} mais email non envoyé "
            f"(SMTP non configuré). Token généré mais NON exposé à l'API. "
            f"Un admin doit utiliser reset_user_password pour ce compte."
        )

    return Response({
        "message": "Si ce compte existe, un lien de réinitialisation a été envoyé."
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password_confirm(request):
    """Confirmer le reset avec le token"""
    from django.core.cache import cache
    token    = request.data.get("token", "")
    new_pwd  = request.data.get("password", "")

    if not token or not new_pwd:
        return Response({"error": "Token et mot de passe requis"}, status=400)
    if len(new_pwd) < 6:
        return Response({"error": "Mot de passe trop court (6 caractères minimum)"}, status=400)

    user_id = cache.get(f"reset:{token}")
    if not user_id:
        return Response({"error": "Token invalide ou expiré (1h max)"}, status=400)

    try:
        user = User.objects.get(pk=user_id)
        user.set_password(new_pwd)
        user.save()
        cache.delete(f"reset:{token}")
        return Response({"message": "Mot de passe réinitialisé avec succès. Vous pouvez vous connecter."})
    except User.DoesNotExist:
        return Response({"error": "Utilisateur introuvable"}, status=404)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def diagnostic_status(request):
    """Diagnostic — état de la base de données (authentification requise :
    le nombre d'utilisateurs/personnel/bâtiments est une information interne,
    utile pour de la reconnaissance par un attaquant si exposée publiquement)."""
    from django.db import connection
    results = {}
    checks = {
        'batiments':  'SELECT COUNT(*) FROM residences_batiment',
        'personnel':  'SELECT COUNT(*) FROM residences_personnel',
        'users':      'SELECT COUNT(*) FROM auth_user',
        'migrations': "SELECT COUNT(*) FROM django_migrations",
    }
    for key, sql in checks.items():
        try:
            with connection.cursor() as cursor:
                cursor.execute(sql)
                results[key] = cursor.fetchone()[0]
        except Exception as e:
            results[key] = f"ERR: {str(e)[:50]}"
    
    from django.conf import settings
    results['db_engine'] = settings.DATABASES['default']['ENGINE'].split('.')[-1]
    results['status'] = 'ok' if results.get('batiments', 0) > 100 else 'empty_db'
    return Response(results)


@api_view(["POST"])
@permission_classes([AllowAny])
def force_seed(request):
    """Initialiser/réinitialiser les données de base — désactivé en prod par défaut"""
    import os
    # SÉCURITÉ : le secret vient OBLIGATOIREMENT d'une variable d'environnement,
    # jamais d'une valeur en dur dans le code source (visible publiquement sur GitHub).
    # Si la variable n'est pas définie sur Render, l'endpoint est désactivé.
    required_secret = os.environ.get('FORCE_SEED_SECRET', '')
    if not required_secret:
        return Response({'error': 'Endpoint désactivé (FORCE_SEED_SECRET non configuré)'}, status=403)
    secret = request.data.get('secret', '')
    if secret != required_secret:
        return Response({'error': 'Secret invalide'}, status=403)
    # Une fois les comptes de démo créés, ce endpoint NE DOIT PLUS recréer
    # le mot de passe admin par défaut — seulement la 1ère fois.
    from django.contrib.auth.models import User
    admin_exists = User.objects.filter(username='admin', is_superuser=True).exists()
    if admin_exists and request.data.get('force_admin_reset') != True:
        return Response({
            'error': 'Compte admin déjà initialisé. Ce endpoint ne peut plus réinitialiser '
                     'le mot de passe admin par défaut pour des raisons de sécurité. '
                     'Utilisez /api/auth/reset-password/<user_id>/ en tant qu\'admin connecté.'
        }, status=403)

    results = []
    errors  = []

    # 1. Créer les utilisateurs
    try:
        from django.contrib.auth.models import User
        from accounts.models import Profile
        users_data = [
            ('admin',       'admin123',       'Admin',       'RZI',    True,  True,  'admin'),
            ('agent',       'agent123',       'Agent',       'Camp',   False, False, 'agent'),
            ('resto',       'resto123',       'Responsable', 'Resto',  False, False, 'restauration'),
            ('technicien',  'tech123',        'Tech',        'Maint',  False, False, 'technicien'),
            ('menage',      'menage123',      'Service',     'Ménage', False, False, 'menage'),
        ]
        for username, pwd, fn, ln, is_staff, is_super, role in users_data:
            u, created = User.objects.get_or_create(username=username)
            if created or True:
                u.set_password(pwd)
                u.first_name = fn
                u.last_name  = ln
                u.is_staff   = is_staff
                u.is_superuser = is_super
                u.save()
            Profile.objects.get_or_create(user=u, defaults={'role': role})
        results.append(f"✅ {len(users_data)} utilisateurs créés/mis à jour")
    except Exception as e:
        errors.append(f"❌ Utilisateurs: {str(e)[:100]}")

    # 2. Créer le personnel de démo
    try:
        from residences.models import Personnel
        import random
        random.seed(42)
        demo = [
            ('ADAMA',   'KOUYATE',   'ROXGOLD',          '0707001122', 'roxgold'),
            ('JEAN',    'KOFFI',     'SGBCI Mining',      '0707003344', 'roxgold'),
            ('FATOUMA', 'DIALLO',    'SAPH Contractors',  '0707005566', 'sous_traitant'),
            ('ISSA',    'TRAORE',    'ROXGOLD',           '0707007788', 'roxgold'),
            ('MARIE',   'TOURE',     'ROXGOLD',           '0708887766', 'roxgold'),
            ('IBRAHIM', 'SANOGO',    'BRGM',              '0703334455', 'sous_traitant'),
        ]
        count_created = 0
        for nom, prenom, societe, numero, type_p in demo:
            # Vérifier si existe déjà
            existing = Personnel.objects.filter(nom=nom, prenom=prenom).first()
            if not existing:
                p = Personnel.objects.create(
                    nom=nom, prenom=prenom, societe=societe,
                    numero=numero, type_personnel=type_p
                )
                try: p.generer_qr()
                except: pass
                count_created += 1
        results.append(f"✅ Personnel: {Personnel.objects.count()} membres ({count_created} créés)")
    except Exception as e:
        errors.append(f"❌ Personnel: {str(e)[:150]}")

    # 3. Articles boutique — créer la table si elle n'existe pas
    try:
        from django.db import connection
        # Créer la table si elle n'existe pas (bypass migration)
        with connection.cursor() as cur:
            # Créer la table si elle n'existe pas
            try:
                cur.execute("SELECT COUNT(*) FROM restauration_articleboutique")
                table_exists = True
            except Exception:
                table_exists = False

            if not table_exists:
                from django.db.migrations.executor import MigrationExecutor
                executor = MigrationExecutor(connection)
                plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
                for mig, _ in plan:
                    if mig.app_label == 'restauration':
                        executor.apply_migration(executor.loader.project_state(), mig)
            else:
                # S'assurer que image_url existe (peut être absent sur ancienne DB)
                try:
                    cur.execute("SELECT image_url FROM restauration_articleboutique LIMIT 0")
                except Exception:
                    try:
                        cur.execute("ALTER TABLE restauration_articleboutique ADD COLUMN image_url TEXT NOT NULL DEFAULT ''")
                    except Exception:
                        pass

        from restauration.models import ArticleBoutique
        IMAGES_DEFAULT = {
            'Coca-Cola Classic':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Coca-Cola_glass_bottle.jpg/200px-Coca-Cola_glass_bottle.jpg',
            'Fanta Orange':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Fanta_Orange.jpg/200px-Fanta_Orange.jpg',
            'Sprite':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Sprite_can.jpg/200px-Sprite_can.jpg',
            'Malta Guinness':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Malta_Guinness.jpg/200px-Malta_Guinness.jpg',
            'Heineken':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Heineken_beer_bottle.jpg/200px-Heineken_beer_bottle.jpg',
            'Guinness Stout':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Guinness.jpg/200px-Guinness.jpg',
            'Red Bull Original':'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=300&h=300&fit=crop',
            'Monster Energy Green':'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=300&h=300&fit=crop',
            'Evian':'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300&h=300&fit=crop',
            'Cristaline':'https://images.unsplash.com/photo-1616118132534-381055fe2e4d?w=300&h=300&fit=crop',
            'JP Chenet Rouge':'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=300&h=300&fit=crop',
            'Mouton Cadet Rouge':'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=300&h=300&fit=crop',
            'Moet et Chandon Brut':'https://images.unsplash.com/photo-1548211091-0e8de7b28a0b?w=300&h=300&fit=crop',
            'Veuve Clicquot Brut':'https://images.unsplash.com/photo-1531401675083-f9e0abeef2c1?w=300&h=300&fit=crop',
            'Dom Perignon Vintage':'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300&h=300&fit=crop',
            'Hennessy VS':'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300&h=300&fit=crop',
            'Jack Daniel s Old N7':'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=300&h=300&fit=crop',
            'Johnnie Walker Black':'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=300&h=300&fit=crop',
            'Baileys Original':'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=300&h=300&fit=crop',
            'Malibu Coco':'https://images.unsplash.com/photo-1609951651556-5334e2706168?w=300&h=300&fit=crop',
            'Jagermeister':'https://images.unsplash.com/photo-1575650772417-e6b418b0d9bf?w=300&h=300&fit=crop',
            'Nescafe Classic':'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?w=300&h=300&fit=crop',
            'Lipton Yellow Label':'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&h=300&fit=crop',
        }
        articles = [
            # Boissons gazeuses
            ('Coca-Cola Classic','gazeuse',500,200,'33cl'), ('Coca-Cola 1.5L','gazeuse',1500,120,'1.5L'),
            ('Fanta Orange','gazeuse',500,180,'33cl'), ('Sprite','gazeuse',500,160,'33cl'),
            ('Schweppes Tonic','gazeuse',500,100,'33cl'), ('Pepsi','gazeuse',500,150,'33cl'), ('7 Up','gazeuse',500,130,'33cl'),
            # Jus & Softs
            ('Darci Mangue','jus',400,200,'25cl'), ('Pressea Orange','jus',1200,80,'1L'),
            ('Ceres Multifruits','jus',1800,60,'1L'), ('Minute Maid Orange','jus',500,150,'25cl'),
            ('Malta Guinness','jus',700,120,'33cl'),
            # Energisantes
            ('Red Bull Original','energie',2000,80,'25cl'), ('Monster Energy Green','energie',2500,60,'50cl'),
            # Eaux
            ('Evian','eau',1500,200,'1.5L'), ('Cristaline','eau',500,300,'1.5L'),
            # Bières
            ('Heineken','biere',1500,120,'50cl'), ('Desperados','biere',1800,80,'33cl'),
            ('Guinness Stout','biere',1800,90,'50cl'), ('Corona Extra','biere',2000,70,'33cl'),
            ('Beaufort 65cl','biere',1000,200,'65cl'), ('Ivoire Speciale','biere',1000,180,'65cl'),
            # Vins rouges
            ('JP Chenet Rouge','vin_rouge',5500,40,'75cl'), ('Mouton Cadet Rouge','vin_rouge',9500,25,'75cl'),
            ("Jacob s Creek Shiraz",'vin_rouge',8000,30,'75cl'),
            # Vins blancs
            ('JP Chenet Blanc','vin_blanc',5500,35,'75cl'), ('Mateus Blanc','vin_blanc',6500,25,'75cl'),
            # Vins rosés
            ('Mateus Rose','vin_rose',6500,30,'75cl'), ('JP Chenet Rose','vin_rose',5800,28,'75cl'),
            # Champagnes
            ('Moet et Chandon Brut','champagne',45000,10,'75cl'),
            ('Veuve Clicquot Brut','champagne',55000,8,'75cl'),
            ('Dom Perignon Vintage','champagne',120000,5,'75cl'),
            # Spiritueux
            ('Jack Daniel s Old N7','spiritueux',22000,20,'70cl'),
            ('Johnnie Walker Black','spiritueux',28000,15,'70cl'),
            ('Hennessy VS','spiritueux',35000,12,'70cl'),
            ('Bacardi Carta Blanca','spiritueux',18000,25,'70cl'),
            ('Absolut Vodka','spiritueux',20000,18,'70cl'),
            # Liqueurs
            ('Baileys Original','liqueur',18000,15,'70cl'), ('Malibu Coco','liqueur',15000,12,'70cl'),
            ('Jagermeister','liqueur',22000,10,'70cl'), ('Cointreau','liqueur',25000,8,'70cl'),
            ('Amarula Cream','liqueur',20000,10,'70cl'), ('Kahlua','liqueur',18000,10,'70cl'),
            ('Get 27','liqueur',15000,12,'70cl'),
            # Cafés
            ('Nescafe Classic','cafe',4500,50,'200g'), ('Nescafe Gold','cafe',3800,40,'100g'),
            # Thés
            ('Lipton Yellow Label','the',2500,60,'100 sachets'), ('Lipton Green Tea','the',1800,45,'20 sachets'),
            ('Twinings English Breakfast','the',3200,35,'50 sachets'), ('Twinings Camomille','the',2800,30,'20 sachets'),
        ]
        count = 0
        for nom, cat, prix, stock, unite in articles:
            _, created = ArticleBoutique.objects.get_or_create(
                nom=nom, defaults={'categorie':cat,'prix':prix,'stock':stock,'unite':unite}
            )
            if created: count += 1
        results.append(f"✅ Boutique: {ArticleBoutique.objects.count()} articles ({count} créés)")
        # Marquer les migrations boutique comme appliquées
        try:
            with connection.cursor() as cur:
                for mig in ['0003_add_boutique_models', '0004_add_image_url_boutique']:
                    cur.execute(
                        "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW()) ON CONFLICT DO NOTHING",
                        ['restauration', mig]
                    )
        except Exception:
            pass
    except Exception as e:
        errors.append(f"❌ Boutique: {str(e)[:100]}")

    # 4. BonCaisse — créer la table si elle n'existe pas
    try:
        from restauration.models import BonCaisse
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM restauration_boncaisse")
        except Exception:
            # Table absente → appliquer la migration
            from django.db.migrations.executor import MigrationExecutor
            executor = MigrationExecutor(connection)
            plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
            for mig, _ in plan:
                if mig.app_label == 'restauration' and 'bon' in mig.name:
                    try:
                        executor.apply_migration(executor.loader.project_state(), mig)
                    except Exception:
                        pass
        results.append(f"✅ BonCaisse: table OK ({BonCaisse.objects.count()} bons)")
    except Exception as e:
        errors.append(f"⚠️ BonCaisse: {str(e)[:100]}")

    # 5. Maintenance — s'assurer que les colonnes photo existent
    try:
        with connection.cursor() as cur:
            for col, dtype in [
                ('photo_base64','TEXT'), ('photo_mime','VARCHAR(50)'),
                ('photo_resolution_base64','TEXT'),('latitude','DECIMAL(10,7)'),('longitude','DECIMAL(10,7)')
            ]:
                try:
                    cur.execute(f"ALTER TABLE maintenance_incident ADD COLUMN IF NOT EXISTS {col} {dtype} DEFAULT ''")
                except Exception:
                    try:
                        cur.execute(f"SELECT {col} FROM maintenance_incident LIMIT 0")
                    except Exception:
                        cur.execute(f"ALTER TABLE maintenance_incident ADD COLUMN {col} {dtype}")
        results.append("✅ Maintenance: colonnes photo OK")
    except Exception as e:
        errors.append(f"⚠️ Maintenance: {str(e)[:80]}")

    # N. CRITIQUE: Appliquer migrations manquantes sur Render
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            db_vendor = connection.vendor
            if db_vendor == 'postgresql':
                # Créer toutes les colonnes optionnelles de maintenance_incident
                cols_sql = [
                    ("date_assignation",         "TIMESTAMP WITH TIME ZONE"),
                    ("date_debut",               "TIMESTAMP WITH TIME ZONE"),
                    ("date_cloture",             "TIMESTAMP WITH TIME ZONE"),
                    ("date_resolution",          "TIMESTAMP WITH TIME ZONE"),
                    ("photo_base64",             "TEXT DEFAULT ''"),
                    ("photo_mime",               "VARCHAR(50) DEFAULT 'image/jpeg'"),
                    ("photo_resolution_base64",  "TEXT DEFAULT ''"),
                    ("latitude",                 "DECIMAL(10,7)"),
                    ("longitude",                "DECIMAL(10,7)"),
                    ("sla_depasse",              "BOOLEAN DEFAULT FALSE"),
                    ("sla_echeance",             "TIMESTAMP WITH TIME ZONE"),
                    ("sla_notification_envoyee", "BOOLEAN DEFAULT FALSE"),
                    ("commentaire_resolution",   "TEXT DEFAULT ''"),
                    ("commentaire_cloture",      "TEXT DEFAULT ''"),
                ]
                added = []
                for col, dtype in cols_sql:
                    cursor.execute(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name='maintenance_incident' AND column_name=%s",
                        [col]
                    )
                    if not cursor.fetchone():
                        cursor.execute(f"ALTER TABLE maintenance_incident ADD COLUMN {col} {dtype}")
                        added.append(col)
                if added:
                    results.append(f"✅ Colonnes maintenance ajoutées: {', '.join(added)}")
                else:
                    results.append("✅ Colonnes maintenance: toutes présentes")
                # Colonne profil dans residences_personnel
                cursor.execute(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='residences_personnel' AND column_name='profil'"
                )
                if not cursor.fetchone():
                    cursor.execute(
                        "ALTER TABLE residences_personnel ADD COLUMN profil "
                        "VARCHAR(20) NOT NULL DEFAULT 'agent'"
                    )
                    results.append("✅ Colonne profil ajoutée à residences_personnel")
                    try:
                        cursor.execute(
                            "ALTER TABLE residences_historicalpersonnel ADD COLUMN profil "
                            "VARCHAR(20) NOT NULL DEFAULT 'agent'"
                        )
                    except Exception:
                        pass
                else:
                    results.append("✅ Colonne profil: présente en DB")
            else:
                results.append(f"ℹ️ DB {db_vendor}: skip colonnes PostgreSQL")
    except Exception as e:
        errors.append(f"⚠️ Migrations: {str(e)[:100]}")


    # Vérifier colonnes ArticleBoutique sur PostgreSQL
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            if connection.vendor == 'postgresql':
                cursor.execute(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='restauration_articleboutique' AND column_name='image_url'"
                )
                if not cursor.fetchone():
                    cursor.execute("ALTER TABLE restauration_articleboutique ADD COLUMN image_url VARCHAR(500) DEFAULT ''")
                    results.append("✅ Colonne image_url ajoutée à ArticleBoutique")
    except Exception as e:
        errors.append(f"⚠️ ArticleBoutique cols: {str(e)[:80]}")

    return Response({
        'ok':      len(errors) == 0,
        'results': results,
        'errors':  errors,
        'summary': f"{len(results)} succès, {len(errors)} erreurs"
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def ping(request):
    """Health check public — empêche le sleep Render"""
    from django.utils import timezone
    return Response({'pong': True, 'ts': timezone.now().isoformat(), 'status': 'alive'})


@api_view(['GET'])
@permission_classes([AllowAny])
def version(request):
    """Version endpoint — confirme que le bon backend est déployé"""
    return Response({
        'version': '1779680747',
        'built':   '2026-05-25',
        'fixes':   ['analyses-expressionwrapper','dashboard-direct-api',
                    'bons-roxgold','sous-traitants-masse'],
        'status':  'ok'
    })


class RoleCustomViewSet(viewsets.ModelViewSet):
    """
    Roles configurables depuis Parametrage -> Roles & Acces : lecture
    ouverte a tout utilisateur connecte (chacun doit pouvoir recuperer la
    configuration de SON PROPRE role pour construire son menu), ecriture
    reservee a l'admin.
    """
    queryset = RoleCustom.objects.all()
    serializer_class = RoleCustomSerializer

    def _is_admin(self, u):
        return u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")

    def create(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis"}, status=403)
        code = (request.data.get("code") or "").strip().lower()
        if not code or not code.replace("_","").replace("-","").isalnum():
            return Response({"error":"Le code du role doit être alphanumérique (tirets/underscores autorisés)."}, status=400)
        if RoleCustom.objects.filter(code=code).exists():
            return Response({"error":f"Le role '{code}' existe déjà."}, status=400)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis"}, status=403)
        role = self.get_object()
        if role.est_systeme and ("code" in request.data or "est_systeme" in request.data):
            return Response({"error":"Le rôle Administrateur ne peut pas être renommé."}, status=400)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis"}, status=403)
        role = self.get_object()
        if role.est_systeme:
            return Response({"error":"Le rôle Administrateur ne peut pas être supprimé."}, status=400)
        # Personne ne doit se retrouver avec un role qui n'existe plus -
        # repli automatique sur 'agent' pour tous les comptes concernes,
        # plutot que de les laisser avec une reference cassee.
        nb_reassignes = Profile.objects.filter(role=role.code).update(role="agent")
        self.perform_destroy(role)
        return Response({"ok":True,"comptes_reassignes_vers_agent":nb_reassignes})


class RapportPlanifieViewSet(viewsets.ModelViewSet):
    """Rapports envoyes automatiquement par email - admin-only de bout en bout,
    la configuration des destinataires est une action sensible."""
    queryset = RapportPlanifie.objects.all()
    serializer_class = RapportPlanifieSerializer

    def _is_admin(self, u):
        return u.is_staff or u.is_superuser or (hasattr(u,"profile") and getattr(u.profile,"role","")=="admin")

    def _check(self, request):
        if not self._is_admin(request.user):
            return Response({"error":"Admin requis"}, status=403)
        return None

    def get_queryset(self):
        # Ceinture-bretelles : meme si un appel direct contourne list(),
        # un non-admin ne recupere jamais rien ici (contient des adresses
        # email de destinataires, une info sensible).
        if not self._is_admin(self.request.user):
            return RapportPlanifie.objects.none()
        return RapportPlanifie.objects.all()

    def list(self, request, *args, **kwargs):
        err = self._check(request)
        return err or super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        err = self._check(request)
        if err: return err
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(cree_par=request.user)
        return Response(serializer.data, status=201)

    def update(self, request, *args, **kwargs):
        return self._check(request) or super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self._check(request) or super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        return self._check(request) or super().destroy(request, *args, **kwargs)


def construire_reponse_connexion(user):
    """
    Construit la reponse JWT + profil standard, partagee entre la
    connexion classique (identifiant/mot de passe, dans rzi_camp/urls.py)
    et la connexion par OTP SMS ci-dessous - pour que les deux chemins
    produisent EXACTEMENT la meme forme de reponse, consommee de la meme
    facon par le frontend.
    """
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    access = str(refresh.access_token)

    profile = {}
    try:
        p = Profile.objects.filter(user=user).first()
        if p:
            # is_staff/is_superuser (verite Django) prime TOUJOURS sur
            # Profile.role stocke - ce champ vaut 'agent' par defaut a la
            # creation et peut ne jamais avoir ete mis a jour pour un
            # compte promu admin autrement (createsuperuser, shell...).
            # Sans ca, un veritable admin peut se voir affiche "Agent
            # Terrain" indefiniment, meme apres connexion reussie.
            role_effectif = 'admin' if (user.is_staff or user.is_superuser) else p.role
            profile = {'id': p.id, 'role': role_effectif, 'nom': user.get_full_name() or user.username}
            try:
                from residences.models import Personnel
                pers = Personnel.objects.filter(user=user).first()
                if pers:
                    profile['personnel_id'] = pers.id
                    profile['personnel_nom'] = f'{pers.nom} {pers.prenom}'
            except Exception:
                pass
    except Exception:
        profile = {'role': 'admin' if (user.is_staff or user.is_superuser) else 'agent', 'nom': user.get_full_name() or user.username}

    return {
        'access': access, 'refresh': str(refresh),
        'user': {
            'id': user.id, 'username': user.username, 'email': user.email or '',
            'is_superuser': bool(user.is_superuser), 'is_staff': bool(user.is_staff),
            'profile': profile,
        }
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def demander_otp(request):
    """
    Etape 1 de la connexion par SMS : envoie un code a 6 chiffres au
    numero fourni, SI ce numero correspond a un Personnel ayant deja un
    compte utilisateur actif. Limite a 3 demandes / 10 min par numero
    pour eviter les abus/spam SMS (qui coutent de l'argent en production).
    """
    from django.conf import settings
    from django.utils import timezone
    from datetime import timedelta
    from residences.models import Personnel
    from .sms import envoyer_sms
    from .phone import normaliser

    telephone_saisi = (request.data.get('telephone') or '').strip()
    if not telephone_saisi:
        return Response({'error': 'Numéro de téléphone requis'}, status=400)
    # Normalise AVANT toute comparaison/stockage - le numero saisi peut
    # arriver sous plusieurs formats (+225.../225.../0...), mais
    # Personnel.telephone stocke toujours le format local (0XXXXXXXXX) -
    # sans cette normalisation, une demande avec l'indicatif ne trouvait
    # jamais le compte correspondant (trouve pendant l'audit SMS, jamais
    # signale car personne n'avait encore teste ce cas precis).
    telephone = normaliser(telephone_saisi)

    recentes = CodeOTP.objects.filter(telephone=telephone, date_creation__gte=timezone.now()-timedelta(minutes=10)).count()
    if recentes >= 3:
        return Response({'error': 'Trop de demandes pour ce numéro — réessayez dans 10 minutes.'}, status=429)

    pers = Personnel.objects.filter(telephone=telephone, user__isnull=False, actif=True).first()
    if not pers or not pers.user or not pers.user.is_active:
        return Response({'error': "Aucun compte actif associé à ce numéro."}, status=404)

    otp = CodeOTP.generer(telephone)
    nom_app = Parametre.get('nom_application', 'Roxgold SiteLife')
    ok, info = envoyer_sms(telephone, f"{nom_app} : votre code de connexion est {otp.code} (valable {CodeOTP.DUREE_VALIDITE_MIN} min).", type_message="otp")

    if not ok:
        return Response({'error': f"Échec d'envoi du SMS : {info}"}, status=502)

    reponse = {'ok': True, 'message': f"Code envoyé au {telephone}."}
    # Mode test uniquement (aucun fournisseur reel configure) : renvoie le
    # code directement pour valider le flux sans depenser un vrai SMS.
    if info == "mode_test" and settings.DEBUG:
        reponse['code_test'] = otp.code
    return Response(reponse)


@api_view(['POST'])
@permission_classes([AllowAny])
def verifier_otp(request):
    """Etape 2 : verifie le code et connecte, meme reponse que /api/auth/login/."""
    from django.utils import timezone
    from residences.models import Personnel
    from .phone import normaliser

    telephone = normaliser((request.data.get('telephone') or '').strip())
    code = (request.data.get('code') or '').strip()
    if not telephone or not code:
        return Response({'error': 'Numéro et code requis'}, status=400)

    otp = CodeOTP.objects.filter(telephone=telephone, utilise=False).order_by('-date_creation').first()
    if not otp:
        return Response({'error': 'Aucun code en attente pour ce numéro — redemandez-en un.'}, status=400)

    if not otp.est_valide():
        return Response({'error': 'Code expiré ou trop de tentatives — redemandez-en un.'}, status=400)

    if otp.code != code:
        otp.tentatives += 1
        otp.save(update_fields=['tentatives'])
        return Response({'error': 'Code incorrect.'}, status=400)

    otp.utilise = True
    otp.save(update_fields=['utilise'])

    pers = Personnel.objects.filter(telephone=telephone, user__isnull=False).first()
    if not pers or not pers.user:
        return Response({'error': 'Compte introuvable.'}, status=404)

    return Response(construire_reponse_connexion(pers.user))
