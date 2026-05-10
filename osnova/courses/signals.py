from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import TestMaterial


@receiver(post_delete, sender=TestMaterial)
def delete_grade_assignment_on_test_delete(sender, instance, **kwargs):
    assignment = getattr(instance, "grade_assignment", None)
    if assignment is not None:
        assignment.delete()

