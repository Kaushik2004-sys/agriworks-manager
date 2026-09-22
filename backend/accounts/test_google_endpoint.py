# Phase 2 Google authentication endpoint tests.
#
# Google verification is mocked at `accounts.google_oauth.
# verify_google_id_token` (no real Google calls). Covers the endpoint
# contract: linked sign-in, controlled new-account creation, explicit
# no-auto-link by email, race-safe uniqueness, token/history behavior,
# and unchanged password login.
from unittest import mock

from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import GoogleAccount, UserProfile

URL = '/api/auth/google/'
CLAIMS = {
    'sub': 'google-sub-123',
    'email': 'grower@example.com',
    'name': 'Test Grower',
    'email_verified': True,
}


def _mock_claims(claims):
    return mock.patch(
        'accounts.google_oauth.verify_google_id_token',
        return_value=dict(claims),
    )


def _mock_failure(exc):
    return mock.patch(
        'accounts.google_oauth.verify_google_id_token',
        side_effect=exc,
    )


def _password_user(username='grower1', email='grower@example.com',
                   mobile='9876543210'):
    user = User.objects.create_user(
        username=username, email=email, password='Str0ng!pass')
    UserProfile.objects.create(
        user=user, full_name='Test Grower', mobile=mobile)
    return user


class GoogleAuthEndpointTests(APITestCase):
    def test_missing_credential_rejected(self):
        res = self.client.post(URL, {}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.post(
            URL, {'credential': '   '}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_invalid_token_rejected_safely(self):
        from accounts.google_oauth import GoogleTokenVerificationError
        with _mock_failure(
                GoogleTokenVerificationError('bad token')):
            res = self.client.post(
                URL, {'credential': 'bogus'}, format='json')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Token.objects.count(), 0)

    def test_existing_link_signs_in(self):
        user = _password_user()
        GoogleAccount.objects.create(
            user=user, sub='google-sub-123', email='grower@example.com')
        old_token = Token.objects.create(user=user)
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL, {'credential': 'valid-token'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], user.username)
        self.assertEqual(res.data['email'], 'grower@example.com')
        self.assertFalse(res.data['created'])
        self.assertIn('token', res.data)
        # Exactly one user, no new link, token rotated.
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(GoogleAccount.objects.count(), 1)
        self.assertFalse(
            Token.objects.filter(key=old_token.key).exists())
        me = self.client.get(
            '/api/me/',
            HTTP_AUTHORIZATION=f"Token {res.data['token']}")
        self.assertEqual(me.status_code, 200)

    def test_new_identity_with_valid_mobile_creates_account(self):
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL,
                {'credential': 'valid-token', 'mobile': '9123456780'},
                format='json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data['created'])
        self.assertIn('token', res.data)
        self.assertEqual(User.objects.count(), 1)
        user = User.objects.get()
        self.assertEqual(user.email, 'grower@example.com')
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.full_name, 'Test Grower')
        self.assertEqual(profile.mobile, '9123456780')
        link = GoogleAccount.objects.get(user=user)
        self.assertEqual(link.sub, 'google-sub-123')
        self.assertEqual(link.email, 'grower@example.com')
        me = self.client.get(
            '/api/me/',
            HTTP_AUTHORIZATION=f"Token {res.data['token']}")
        self.assertEqual(me.status_code, 200)

    def test_new_identity_missing_mobile_rejected(self):
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL, {'credential': 'valid-token'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(GoogleAccount.objects.count(), 0)

    def test_new_identity_invalid_mobile_rejected(self):
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL,
                {'credential': 'valid-token', 'mobile': '12345'},
                format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_new_identity_blank_mobile_rejected(self):
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL,
                {'credential': 'valid-token', 'mobile': '   '},
                format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(GoogleAccount.objects.count(), 0)

    def test_new_identity_non_numeric_mobile_rejected(self):
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL,
                {'credential': 'valid-token', 'mobile': 'abcdefghij'},
                format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(GoogleAccount.objects.count(), 0)

    def test_new_identity_duplicate_mobile_rejected(self):
        _password_user(mobile='9123456780')
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL,
                {'credential': 'valid-token', 'mobile': '9123456780'},
                format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(GoogleAccount.objects.count(), 0)

    def test_existing_email_never_auto_linked(self):
        existing = _password_user()
        other_claims = dict(
            CLAIMS, sub='google-sub-999', email='grower@example.com')
        with _mock_claims(other_claims):
            res = self.client.post(
                URL,
                {'credential': 'valid-token', 'mobile': '9123456780'},
                format='json')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(
            GoogleAccount.objects.filter(user=existing).count(), 0)
        self.assertEqual(GoogleAccount.objects.count(), 0)
        self.assertEqual(User.objects.count(), 1)
        # The password account keeps working unchanged.
        login = self.client.post(
            '/api/login/',
            {'username': 'grower1', 'password': 'Str0ng!pass'},
            format='json')
        self.assertEqual(login.status_code, 200)

    def test_duplicate_sub_resolves_without_duplicates(self):
        user = _password_user()
        GoogleAccount.objects.create(
            user=user, sub='google-sub-123', email='grower@example.com')
        with _mock_claims(CLAIMS):
            first = self.client.post(
                URL, {'credential': 'tok1'}, format='json')
            second = self.client.post(
                URL, {'credential': 'tok2'}, format='json')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(GoogleAccount.objects.count(), 1)

    def test_success_records_login_history(self):
        from accounts.models import LoginHistory
        user = _password_user()
        GoogleAccount.objects.create(
            user=user, sub='google-sub-123', email='grower@example.com')
        before = LoginHistory.objects.filter(user=user).count()
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL, {'credential': 'valid-token'}, format='json')
        self.assertEqual(res.status_code, 200)
        history = LoginHistory.objects.filter(user=user)
        self.assertEqual(history.count(), before + 1)
        self.assertEqual(history.latest('id').status, 'Successful')

    def test_token_rotation_on_google_login(self):
        user = _password_user()
        GoogleAccount.objects.create(
            user=user, sub='google-sub-123', email='grower@example.com')
        stale = Token.objects.create(user=user)
        with _mock_claims(CLAIMS):
            res = self.client.post(
                URL, {'credential': 'valid-token'}, format='json')
        self.assertEqual(res.status_code, 200)
        stale_check = self.client.get(
            '/api/me/', HTTP_AUTHORIZATION=f'Token {stale.key}')
        self.assertEqual(stale_check.status_code, 401)

    def test_password_login_unchanged(self):
        _password_user()
        res = self.client.post(
            '/api/login/',
            {'username': 'grower1', 'password': 'Str0ng!pass'},
            format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
