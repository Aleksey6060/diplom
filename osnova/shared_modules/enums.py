from django.db import models
from enum import StrEnum

class AccountType(models.TextChoices):
    OWNER = "owner", "Главный пользователь"
    UNIVERSITY_OWNER = "university_owner", "Владелец университета"
    EMPLOYEE = "employee", "Сотрудник"
    TEACHER = "teacher", "Учитель"
    STUDENT = "student", "Учащийся"


class CourseType(models.TextChoices):
    FULL = "full", "Высшее образование"
    SIMPLE = "simple", "Дополнительное образование"
    
    
class FilterJSONFields(StrEnum):
    LOGIC = 'logic'
    ITEM  = 'item'
    CHILDREN = 'children'

class FilterJSONOps(StrEnum):
    NOT = 'NOT'
    AND = 'AND'
    OR  = 'OR'
