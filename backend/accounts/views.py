from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .serializers import UserSerializer

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
    """Générer un token de reset (retourne token pour email/SMS)"""
    username = request.data.get("username", "").strip()
    if not username:
        return Response({"error": "Identifiant requis"}, status=400)

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
                subject="🔐 Réinitialisation de mot de passe — RZI Camp",
                message=f"""Bonjour {user.first_name},

Votre lien de réinitialisation (valide 1h) :
{app_url}/reset-password?token={token}

Si vous n\'avez pas demandé cette réinitialisation, ignorez ce message.

L\'équipe RZI Camp""",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[dest],
                fail_silently=True,
            )
            email_sent = True
    except Exception:
        pass

    # Admin: afficher le token dans la réponse si pas d'email configuré
    resp = {"message": "Lien de réinitialisation généré."}
    if not email_sent:
        resp["token"] = token
        resp["note"] = "Email non configuré. Transmettez ce token à l\'utilisateur ou contactez l\'admin."

    return Response(resp)


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
@permission_classes([AllowAny])
def diagnostic_status(request):
    """Diagnostic public — état de la base de données"""
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
    """Initialiser/réinitialiser les données de base (secret requis)"""
    secret = request.data.get('secret', '')
    if secret != 'roxgold2026':
        return Response({'error': 'Secret invalide'}, status=403)

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
            # Vérifier si la table existe (compatible SQLite + PostgreSQL)
            try:
                cur.execute("SELECT COUNT(*) FROM restauration_articleboutique")
                table_exists = True
            except Exception:
                table_exists = False

            if not table_exists:
                # Créer via Django migrations executor
                from django.db.migrations.executor import MigrationExecutor
                executor = MigrationExecutor(connection)
                plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
                for mig, _ in plan:
                    if mig.app_label == 'restauration':
                        executor.apply_migration(executor.loader.project_state(), mig)
                # Re-check
                try:
                    cur.execute("SELECT COUNT(*) FROM restauration_articleboutique")
                    table_exists = True
                except Exception:
                    pass

        from restauration.models import ArticleBoutique
        articles = [
            ('Castel 65cl', 'boisson', 600, 100, 'bouteille'),
            ('Flag Special 65cl', 'boisson', 600, 100, 'bouteille'),
            ('Heineken 33cl', 'boisson', 700, 60, 'canette'),
            ('Bock 33cl', 'boisson', 500, 80, 'canette'),
            ('Beaufort 65cl', 'boisson', 700, 80, 'bouteille'),
            ('Ivoire Beer 65cl', 'boisson', 550, 60, 'bouteille'),
            ('Sodabi (verre)', 'boisson', 1000, 30, 'verre'),
            ('Whisky JW Black (verre)', 'boisson', 2500, 15, 'verre'),
            ('Rhum Bologne (verre)', 'boisson', 1500, 20, 'verre'),
            ('Vin rouge 75cl', 'boisson', 3500, 20, 'bouteille'),
            ('Coca-Cola 33cl', 'boisson', 300, 200, 'canette'),
            ('Fanta Orange 33cl', 'boisson', 300, 150, 'canette'),
            ('Malta Guinness 33cl', 'boisson', 400, 100, 'canette'),
            ('Eau Olgane 1.5L', 'boisson', 200, 300, 'bouteille'),
            ('Eau Olgane 50cl', 'boisson', 100, 400, 'bouteille'),
            ('Jus d orange Pur Fruit', 'boisson', 500, 60, 'bouteille'),
            ('Cafe Nescafe (tasse)', 'boisson', 150, 100, 'tasse'),
            ('Chips Lay s 50g', 'snack', 300, 100, 'sachet'),
            ('Biscuits Prince', 'snack', 500, 80, 'paquet'),
            ('Biscuits Delices', 'snack', 250, 80, 'paquet'),
            ('Cacahuetes grillees 50g', 'snack', 200, 150, 'sachet'),
            ('Noix de cajou 50g', 'snack', 500, 50, 'sachet'),
            ('Pain fourre chocolat', 'snack', 200, 120, 'piece'),
            ('Savon Lux 100g', 'hygiene', 300, 50, 'barre'),
            ('Dentifrice Colgate', 'hygiene', 500, 40, 'tube'),
            ('Deodorant Rexona', 'hygiene', 1500, 30, 'spray'),
            ('Cigarette Marlboro (u)', 'cigarette', 200, 100, 'piece'),
            ('Cigarette Dunhill (u)', 'cigarette', 250, 100, 'piece'),
            ('Cigarette Marlboro px', 'cigarette', 3500, 20, 'paquet'),
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

    return Response({
        'ok':      len(errors) == 0,
        'results': results,
        'errors':  errors,
        'summary': f"{len(results)} succès, {len(errors)} erreurs"
    })
