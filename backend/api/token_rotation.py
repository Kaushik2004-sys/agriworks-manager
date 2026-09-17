# M8: atomic single-session token rotation (no model/schema change).
# Shared by login and password-change so every rotation path is
# protected identically.
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.authtoken.models import Token


def rotate_auth_token(user):
    """Delete the user's old token and create a fresh one, atomically.

    Returns the new token. Concurrent rotations serialize on the locked
    user row: the second waiter proceeds only after the first commits,
    then replaces the just-created token with its own. The authtoken
    one-to-one unique key can therefore never collide (no
    IntegrityError/HTTP 500, nothing caught and ignored), exactly one
    token ever remains, and single-session semantics are preserved -
    only the latest token stays usable.
    """
    user_model = get_user_model()
    with transaction.atomic():
        locked_user = user_model.objects.select_for_update().get(pk=user.pk)
        Token.objects.filter(user=locked_user).delete()
        return Token.objects.create(user=locked_user)
