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

    return Response({
        'ok':      len(errors) == 0,
        'results': results,
        'errors':  errors,
        'summary': f"{len(results)} succès, {len(errors)} erreurs"
    })
