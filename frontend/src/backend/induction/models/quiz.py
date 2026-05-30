"""
Quiz QHSE — Questions, Tentatives, Résultats
"""
import uuid
from django.db import models
from django.utils import timezone
from .base import Site, TimeStampMixin
from .training import Training
from .employee import Employee


class QuizQuestion(models.Model):
    """Question à choix multiples pour un quiz QHSE."""
    NIVEAUX = [
        ('facile',  'Facile'),
        ('moyen',   'Moyen'),
        ('difficile','Difficile'),
    ]
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    formation   = models.ForeignKey(Training, on_delete=models.CASCADE,
                    related_name='questions', null=True, blank=True)
    sites       = models.ManyToManyField(Site, blank=True)
    texte       = models.TextField(help_text="Texte de la question")
    explication = models.TextField(blank=True, help_text="Explication de la bonne réponse")
    points      = models.PositiveIntegerField(default=1)
    niveau      = models.CharField(max_length=15, choices=NIVEAUX, default='moyen')
    image       = models.ImageField(upload_to='induction/quiz/', blank=True, null=True)
    ordre       = models.PositiveIntegerField(default=0)
    actif       = models.BooleanField(default=True)

    class Meta:
        app_label = 'induction'
        ordering = ['ordre', 'id']
        verbose_name = 'Question quiz'

    def __str__(self):
        return f"Q{self.ordre}: {self.texte[:80]}..."


class QuizChoice(models.Model):
    """Choix de réponse pour une question."""
    question    = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE,
                    related_name='choix')
    texte       = models.CharField(max_length=500)
    est_correcte = models.BooleanField(default=False)
    ordre       = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = 'induction'
        ordering = ['ordre']
        verbose_name = 'Choix de réponse'

    def __str__(self):
        return f"{'✅' if self.est_correcte else '❌'} {self.texte[:50]}"


class QuizAttempt(TimeStampMixin):
    """Tentative de quiz par un employé."""
    STATUTS = [
        ('en_cours', 'En cours'),
        ('reussi',   'Réussi'),
        ('echoue',   'Échoué'),
    ]
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee    = models.ForeignKey(Employee, on_delete=models.CASCADE,
                    related_name='quiz_attempts')
    formation   = models.ForeignKey(Training, on_delete=models.CASCADE,
                    related_name='tentatives')
    site        = models.ForeignKey(Site, on_delete=models.CASCADE,
                    null=True, blank=True)
    numero_tentative = models.PositiveIntegerField(default=1)
    # Résultats
    score       = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                    help_text="Score en %")
    points_obtenus = models.PositiveIntegerField(default=0)
    points_total   = models.PositiveIntegerField(default=0)
    statut      = models.CharField(max_length=20, choices=STATUTS, default='en_cours')
    score_minimum = models.PositiveIntegerField(default=80,
                    help_text="Score minimum requis pour réussir (%)")
    # Timing
    date_debut  = models.DateTimeField(default=timezone.now)
    date_fin    = models.DateTimeField(null=True, blank=True)
    duree_secondes = models.PositiveIntegerField(null=True, blank=True)
    # Superviseur
    supervise_par = models.ForeignKey('auth.User', null=True, blank=True,
                    on_delete=models.SET_NULL, related_name='quiz_supervises')

    class Meta:
        app_label = 'induction'
        ordering = ['-created_at']
        verbose_name = 'Tentative quiz'
        indexes = [
            models.Index(fields=['employee', 'statut']),
            models.Index(fields=['formation', 'employee']),
        ]

    def __str__(self):
        return (f"{self.employee.nom_complet} — {self.formation.code} "
                f"Tentative #{self.numero_tentative} — {self.score}%")

    @property
    def reussi(self):
        return self.score >= self.score_minimum

    def calculer_score(self):
        """Calculer le score à partir des réponses soumises."""
        reponses = self.reponses.select_related('question', 'choix_selectionne')
        total_points = sum(r.question.points for r in reponses)
        points_ok    = sum(
            r.question.points for r in reponses
            if r.choix_selectionne and r.choix_selectionne.est_correcte
        )
        self.points_obtenus = points_ok
        self.points_total   = total_points
        self.score = (points_ok / total_points * 100) if total_points else 0
        self.statut = 'reussi' if self.reussi else 'echoue'
        self.date_fin = timezone.now()
        if self.date_debut:
            self.duree_secondes = int((self.date_fin - self.date_debut).total_seconds())
        self.save(update_fields=['score','points_obtenus','points_total',
                                  'statut','date_fin','duree_secondes'])
        return self.score


class QuizAnswer(models.Model):
    """Réponse donnée pour une question d'une tentative."""
    tentative   = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE,
                    related_name='reponses')
    question    = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE)
    choix_selectionne = models.ForeignKey(QuizChoice, on_delete=models.CASCADE,
                    null=True, blank=True)
    est_correcte = models.BooleanField(default=False)
    temps_reponse_s = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        app_label = 'induction'
        unique_together = ('tentative', 'question')
        verbose_name = 'Réponse quiz'

    def __str__(self):
        return (f"Réponse — Q: {self.question.texte[:40]} | "
                f"{'✅' if self.est_correcte else '❌'}")

    def save(self, *args, **kwargs):
        if self.choix_selectionne:
            self.est_correcte = self.choix_selectionne.est_correcte
        super().save(*args, **kwargs)
