from inspect import isclass
from enum import StrEnum


class PermissionMapMixin:
    class Methods(StrEnum):
        GET = "GET"
        POST = "POST"
        UPDATE = "UPDATE"
        DELETE = "DELETE"

    method_map = {}
    action_map = {}

    def get_method_permission(self):
        method = self.request.method
        # Маппим PATCH и PUT на одну логику обновления
        if method in ["PUT", "PATCH"]:
            lookup_method = self.Methods.UPDATE
        else:
            lookup_method = method

        method_perms = self.method_map.get(lookup_method, [])

        return [
            perm() if isclass(perm) else perm
            for perm in method_perms
        ]

    def get_action_permission(self):
        lookup_action = self.action
        action_perms = self.action_map.get(lookup_action, [])

        return [
            perm() if isclass(perm) else perm
            for perm in action_perms
        ]

    def get_permissions(self):
        extra_permissions = [
            *self.get_method_permission(),
            *self.get_action_permission()
        ]

        return super().get_permissions() + extra_permissions
