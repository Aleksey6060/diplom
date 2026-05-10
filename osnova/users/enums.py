from django.db import models


class AccountType(models.TextChoices):
    OWNER = "owner", "Главный пользователь"
    UNIVERSITY_OWNER = "university_owner", "Владелец университета"
    EMPLOYEE = "employee", "Сотрудник"
    STUDENT = "student", "Учащийся"