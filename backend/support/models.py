# Contact & Report Problem: stores user-submitted website problems
# so admin/staff can view and manage them. New table only;
# existing tables are untouched.
from django.conf import settings
from django.db import models


class ProblemReport(models.Model):
    PROBLEM_TYPES = [
        ('Login Problem', 'Login Problem'),
        ('Work Record Problem', 'Work Record Problem'),
        ('Billing Problem', 'Billing Problem'),
        ('Payment Problem', 'Payment Problem'),
        ('Report Problem', 'Report Problem'),
        ('Dashboard Problem', 'Dashboard Problem'),
        ('Language Problem', 'Language Problem'),
        ('Other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Resolved', 'Resolved'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='problem_reports',
    )
    name = models.CharField(max_length=150)
    email = models.EmailField()
    problem_type = models.CharField(max_length=30, choices=PROBLEM_TYPES)
    description = models.TextField()
    # Optional screenshot. Plain FileField (no Pillow dependency);
    # type/size are validated in the serializer. Served from MEDIA_ROOT.
    screenshot = models.FileField(upload_to='problem_screenshots/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.problem_type} by {self.name} ({self.status})'
