# Phase 1 Google Login tests: ID-token verification + GoogleAccount model.
#
# No real Google calls are ever made: google's verify_oauth2_token is
# mocked at the library boundary, so these run fully offline. Existing
# password login/register behavior is untouched (separate test below
# exercises the unchanged registration path).
from unittest import mock

from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings

from accounts.google_oauth import (
    GoogleTokenVerificationError,
    verify_google_id_token,
)
from accounts.models import GoogleAccount, UserProfile

VALID_CLAIMS = {
    'iss': 'accounts.google.com',
    'sub': 'google-sub-123',
    'email': 'grower@example.com',
    'email_verified': True,
    'name': 'Test Grower',
    'aud': 'test-client-id',
}


def _mock_verify(return_value=None, side_effect=None):
    return mock.patch(
        'google.oauth2.id_token.verify_oauth2_token',
        return_value=return_value,
        side_effect=side_effect,
    )


@override_settings(GOOGLE_CLIENT_ID='test-client-id')
class GoogleTokenVerificationTests(TestCase):
    def test_valid_token_returns_verified_identity(self):
        with _mock_verify(return_value=dict(VALID_CLAIMS)):
            identity = verify_google_id_token('valid-id-token')
        self.assertEqual(identity['sub'], 'google-sub-123')
        self.assertEqual(identity['email'], 'grower@example.com')
        self.assertTrue(identity['email_verified'])

    def test_invalid_token_rejected(self):
        with _mock_verify(side_effect=ValueError('Invalid token')):
            with self.assertRaises(GoogleTokenVerificationError):
                verify_google_id_token('bogus-token')

    def test_expired_token_rejected(self):
        with _mock_verify(side_effect=ValueError('Token expired')):
            with self.assertRaises(GoogleTokenVerificationError):
                verify_google_id_token('expired-token')

    def test_wrong_audience_rejected(self):
        with _mock_verify(side_effect=ValueError('Wrong audience')):
            with self.assertRaises(GoogleTokenVerificationError):
                verify_google_id_token('other-audience-token')

    def test_unverified_email_rejected(self):
        claims = dict(VALID_CLAIMS, email_verified=False)
        with _mock_verify(return_value=claims):
            with self.assertRaises(GoogleTokenVerificationError):
                verify_google_id_token('unverified-email-token')

    def test_missing_sub_rejected(self):
        claims = dict(VALID_CLAIMS)
        del claims['sub']
        with _mock_verify(return_value=claims):
            with self.assertRaises(GoogleTokenVerificationError):
                verify_google_id_token('missing-sub-token')

    def test_missing_issuer_rejected(self):
        claims = dict(VALID_CLAIMS, iss='evil.example.com')
        with _mock_verify(return_value=claims):
            with self.assertRaises(GoogleTokenVerificationError):
                verify_google_id_token('bad-issuer-token')

    def test_missing_credential_rejected(self):
        with self.assertRaises(GoogleTokenVerificationError):
            verify_google_id_token('')
        with self.assertRaises(GoogleTokenVerificationError):
            verify_google_id_token(None)

    def test_frontend_claims_never_trusted_without_verification(self):
        # Verification failure must raise even though the caller "knows"
        # an email address - plain emails prove nothing.
        with _mock_verify(side_effect=ValueError('Invalid token')):
            with self.assertRaises(GoogleTokenVerificationError):
                verify_google_id_token('attacker-token-for-victim@example.com')


class GoogleClientIdConfigTests(TestCase):
    @override_settings(GOOGLE_CLIENT_ID='')
    def test_missing_client_id_fails_safely(self):
        with _mock_verify(return_value=dict(VALID_CLAIMS)):
            with self.assertRaises(ImproperlyConfigured):
                verify_google_id_token('any-token')


class GoogleAccountModelTests(TestCase):
    def _user(self, username='grower1'):
        user = User.objects.create_user(
            username=username, email='grower@example.com',
            password='Str0ng!pass')
        UserProfile.objects.create(
            user=user, full_name='Test Grower', mobile='9876543210')
        return user

    def test_link_stores_verified_identity(self):
        user = self._user()
        link = GoogleAccount.objects.create(
            user=user, sub='google-sub-123', email='grower@example.com')
        self.assertEqual(link.user_id, user.id)
        self.assertEqual(link.sub, 'google-sub-123')
        self.assertIsNotNone(link.linked_at)

    def test_sub_unique(self):
        user2 = self._user(username='grower2')
        GoogleAccount.objects.create(
            user=self._user(), sub='google-sub-123',
            email='grower@example.com')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                GoogleAccount.objects.create(
                    user=user2, sub='google-sub-123',
                    email='other@example.com')

    def test_one_link_per_user(self):
        user = self._user()
        GoogleAccount.objects.create(
            user=user, sub='google-sub-123', email='grower@example.com')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                GoogleAccount.objects.create(
                    user=user, sub='google-sub-999',
                    email='grower@example.com')

    def test_deleting_user_removes_link(self):
        user = self._user()
        GoogleAccount.objects.create(
            user=user, sub='google-sub-123', email='grower@example.com')
        user.delete()
        self.assertEqual(GoogleAccount.objects.count(), 0)

    def test_link_never_touches_admin_flags(self):
        user = self._user()
        GoogleAccount.objects.create(
            user=user, sub='google-sub-123', email='grower@example.com')
        user.refresh_from_db()
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)


class ExistingRegistrationUnaffectedTests(TestCase):
    def test_normal_registration_still_works(self):
        # Phase 1 is purely additive: the existing password-registration
        # path (serializer validation + user/profile creation) is
        # unchanged and covered here at the serializer level.
        from accounts.serializers import RegisterSerializer
        data = {
            'full_name': 'Test Grower',
            'last_name': 'Patil',
            'company_name': '',
            'email': 'newgrower@example.com',
            'mobile': '9876543210',
            'password': 'Str0ng!pass',
            'confirm_password': 'Str0ng!pass',
        }
        serializer = RegisterSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertTrue(User.objects.filter(username=user.username).exists())
        self.assertTrue(UserProfile.objects.filter(user=user).exists())
        self.assertFalse(
            GoogleAccount.objects.filter(user=user).exists())
