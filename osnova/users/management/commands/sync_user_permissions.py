from django.core.management.base import BaseCommand

from users.models import PermissionAction, PermissionModule
from users.permission_catalog import PERMISSION_CATALOG


class Command(BaseCommand):
    help = "Синхронизирует каталог пользовательских прав."

    def handle(self, *args, **options):
        active_module_codes = []
        active_action_codes = []

        for pos, module_data in enumerate(PERMISSION_CATALOG, start=1):
            actions = module_data["actions"]

            module, _ = PermissionModule.objects.update_or_create(
                code=module_data["code"],
                defaults={
                    "title": module_data["title"],
                    "position": pos,
                    "allow_partial_permissions": module_data["allow_partial_permissions"],
                    "is_active": True,
                },
            )
            active_module_codes.append(module.code)

            for pos, action_data in enumerate(actions, start=1):
                PermissionAction.objects.update_or_create(
                    code=action_data["code"],
                    defaults={
                        "module": module,
                        "title": action_data["title"],
                        "position": pos,
                        "description": action_data.get("description", ""),
                        "is_active": True,
                    },
                )
                active_action_codes.append(action_data["code"])

        PermissionModule.objects.exclude(code__in=active_module_codes).update(is_active=False)
        PermissionAction.objects.exclude(code__in=active_action_codes).update(is_active=False)

        self.stdout.write(self.style.SUCCESS("Каталог прав успешно синхронизирован."))
