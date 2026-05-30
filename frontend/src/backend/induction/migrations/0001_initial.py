"""
Migration 0001_initial — Module Induction QHSE
Générée automatiquement — compatible PostgreSQL/PostGIS/Render
"""
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True
    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        # ── Site ──────────────────────────────────────
        migrations.CreateModel(
            name='Site',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('code', models.CharField(max_length=20, unique=True)),
                ('nom', models.CharField(max_length=200)),
                ('pays', models.CharField(default="Côte d'Ivoire", max_length=100)),
                ('region', models.CharField(blank=True, max_length=100)),
                ('adresse', models.TextField(blank=True)),
                ('latitude', models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ('longitude', models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ('quiz_score_min', models.PositiveIntegerField(default=80)),
                ('medical_validite_j', models.PositiveIntegerField(default=365)),
                ('badge_validite_j', models.PositiveIntegerField(default=365)),
                ('induction_obligatoire', models.BooleanField(default=True)),
                ('actif', models.BooleanField(default=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='site_created', to='auth.user')),
                ('superviseurs', models.ManyToManyField(blank=True, related_name='sites_supervises', to='auth.user')),
            ],
            options={'ordering': ['nom'], 'verbose_name': 'Site minier'},
        ),
        # ── Camp ──────────────────────────────────────
        migrations.CreateModel(
            name='Camp',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('nom', models.CharField(max_length=200)),
                ('code', models.CharField(max_length=20)),
                ('capacite', models.PositiveIntegerField(default=0)),
                ('actif', models.BooleanField(default=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='camp_created', to='auth.user')),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='camps', to='induction.site')),
            ],
            options={'ordering': ['nom'], 'verbose_name': 'Camp'},
        ),
        # ── Zone ──────────────────────────────────────
        migrations.CreateModel(
            name='Zone',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('nom', models.CharField(max_length=200)),
                ('type_zone', models.CharField(choices=[('open','Zone ouverte'),('restricted','Zone restreinte'),('hazardous','Zone dangereuse'),('admin','Zone administrative')], default='open', max_length=20)),
                ('description', models.TextField(blank=True)),
                ('induction_requise', models.BooleanField(default=True)),
                ('actif', models.BooleanField(default=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='zone_created', to='auth.user')),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='zones', to='induction.site')),
            ],
            options={'ordering': ['nom'], 'verbose_name': 'Zone'},
        ),
        # ── Contractor ────────────────────────────────
        migrations.CreateModel(
            name='Contractor',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('nom', models.CharField(max_length=200)),
                ('code', models.CharField(max_length=20, unique=True)),
                ('pays', models.CharField(blank=True, max_length=100)),
                ('contact_nom', models.CharField(blank=True, max_length=200)),
                ('contact_tel', models.CharField(blank=True, max_length=50)),
                ('contact_email', models.EmailField(blank=True)),
                ('actif', models.BooleanField(default=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='contractor_created', to='auth.user')),
                ('sites', models.ManyToManyField(blank=True, related_name='contractors', to='induction.site')),
            ],
            options={'ordering': ['nom'], 'verbose_name': 'Sous-traitant'},
        ),
        # ── Employee ──────────────────────────────────
        migrations.CreateModel(
            name='Employee',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('nom', models.CharField(max_length=150)),
                ('prenom', models.CharField(max_length=150)),
                ('genre', models.CharField(blank=True, max_length=1)),
                ('date_naissance', models.DateField(blank=True, null=True)),
                ('nationalite', models.CharField(blank=True, max_length=100)),
                ('email', models.EmailField(unique=True)),
                ('telephone', models.CharField(blank=True, max_length=50)),
                ('type_employe', models.CharField(choices=[('employe','Employé'),('soustraitant','Sous-traitant'),('visiteur','Visiteur'),('consultant','Consultant'),('stagiaire','Stagiaire')], default='employe', max_length=20)),
                ('matricule', models.CharField(blank=True, max_length=50, null=True, unique=True)),
                ('poste', models.CharField(blank=True, max_length=200)),
                ('departement', models.CharField(blank=True, max_length=200)),
                ('date_arrivee', models.DateField(blank=True, null=True)),
                ('date_depart_prevue', models.DateField(blank=True, null=True)),
                ('photo_base64', models.TextField(blank=True, default='')),
                ('statut', models.CharField(choices=[('en_attente','En attente'),('en_cours',"En cours d'induction"),('valide','Validé'),('refuse','Refusé'),('expire','Expiré'),('suspendu','Suspendu')], default='en_attente', max_length=20)),
                ('actif', models.BooleanField(default=True)),
                ('camp', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='residents', to='induction.camp')),
                ('contractor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='employes', to='induction.contractor')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='employee_created', to='auth.user')),
                ('site', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='employees', to='induction.site')),
                ('user', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='employee_profile', to='auth.user')),
            ],
            options={'ordering': ['nom', 'prenom'], 'verbose_name': 'Employé'},
        ),
        migrations.AddIndex(
            model_name='employee',
            index=models.Index(fields=['email'], name='emp_email_idx'),
        ),
        migrations.AddIndex(
            model_name='employee',
            index=models.Index(fields=['site','statut'], name='emp_site_statut_idx'),
        ),
    ]
