# Smoke tests for AgriWorks Manager core flows.
# Runs on an isolated test database - never touches the dev database.
from django.contrib.auth.models import User
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

STRONG = 'Pass1234!'


def make_user(client, email='smoke@test.com', password=STRONG):
    res = client.post('/api/register/', {
        'full_name': 'Smoke Test', 'email': email, 'mobile': '9998887776',
        'password': password, 'confirm_password': password,
    }, format='json')
    assert res.status_code == 201, res.content
    token = res.data['token']
    client.credentials(HTTP_AUTHORIZATION='Token ' + token)
    return User.objects.get(email=email)


class AuthSmokeTests(APITestCase):
    def test_register_login_profile(self):
        res = self.client.post('/api/register/', {
            'full_name': 'Smoke Test', 'email': 'smoke@test.com',
            'mobile': '9998887776', 'password': STRONG,
            'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertIn('token', res.data)
        # Duplicate email blocked.
        res = self.client.post('/api/register/', {
            'full_name': 'Dup', 'email': 'smoke@test.com',
            'mobile': '8887776665', 'password': STRONG,
            'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Weak password blocked.
        res = self.client.post('/api/register/', {
            'full_name': 'Weak', 'email': 'weak@test.com',
            'mobile': '8887776665', 'password': 'pass1234',
            'confirm_password': 'pass1234',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Login via email and via username both work.
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': 'smoke@test.com', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        res = self.client.post('/api/login/', {
            'username': 'smoke', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        # Invalid credentials rejected.
        res = self.client.post('/api/login/', {
            'username': 'smoke@test.com', 'password': 'Wrong1@x',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_protected_endpoints_require_auth(self):
        res = self.client.get('/api/farmers/')
        self.assertEqual(res.status_code, 401)
        res = self.client.get('/api/me/')
        self.assertEqual(res.status_code, 401)

    def test_forgot_reset_flow(self):
        make_user(self.client)
        self.client.credentials()
        # Unregistered email -> error, no token fields.
        res = self.client.post('/api/password-reset/request/',
                               {'email': 'nobody@nowhere.com'}, format='json')
        self.assertEqual(res.status_code, 404)
        self.assertNotIn('token', res.data)
        self.assertNotIn('reset_link', res.data)
        # Registered email -> confirmation only, never the link.
        res = self.client.post('/api/password-reset/request/',
                               {'email': 'smoke@test.com'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(list(res.data.keys()), ['message'])
        # Confirm with a real token, then reuse must fail (single-use).
        from accounts.views import token_generator
        user = User.objects.get(email='smoke@test.com')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)
        res = self.client.post('/api/password-reset/confirm/', {
            'uid': uid, 'token': token,
            'new_password': 'Brand1@new', 'confirm_password': 'Brand1@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        res = self.client.post('/api/password-reset/confirm/', {
            'uid': uid, 'token': token,
            'new_password': 'Other1@x', 'confirm_password': 'Other1@x',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Login works with the new password.
        res = self.client.post('/api/login/', {
            'username': 'smoke@test.com', 'password': 'Brand1@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)

    def test_profile_and_change_password(self):
        user = make_user(self.client)
        res = self.client.get('/api/profile/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['email'], 'smoke@test.com')
        # Email is read-only: sent value is ignored.
        res = self.client.put('/api/profile/', {
            'full_name': 'Smoke Updated', 'company_name': 'Acme',
            'mobile': '8887776665', 'email': 'hacker@evil.com',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.email, 'smoke@test.com')
        self.assertEqual(user.profile.company_name, 'Acme')
        # Bad mobile blocked.
        res = self.client.put('/api/profile/', {
            'full_name': 'Smoke', 'mobile': '123',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Wrong current password blocked; correct one rotates token.
        res = self.client.post('/api/change-password/', {
            'current_password': 'Wrong1@x', 'new_password': 'Newpass1!',
            'confirm_password': 'Newpass1!',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.post('/api/change-password/', {
            'current_password': STRONG, 'new_password': 'Newpass1!',
            'confirm_password': 'Newpass1!',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
        self.assertFalse(Token.objects.filter(
            user=user).exclude(key=res.data['token']).exists())


class BusinessSmokeTests(APITestCase):
    def setUp(self):
        make_user(self.client)

    def test_farmer_work_bill_payment_expense_chain(self):
        # Farmer.
        res = self.client.post('/api/farmers/', {
            'name': 'Test Farmer', 'mobile': '9998887776',
            'village': 'Testville', 'address': 'Addr',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        farmer = res.data['id']
        res = self.client.post('/api/farmers/', {
            'name': '', 'mobile': '123', 'village': '',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.get('/api/farmers/')
        self.assertEqual(len(res.data), 1)
        # Work linked to farmer.
        res = self.client.post('/api/works/', {
            'farmer': farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-10', 'area': '2.00', 'amount': '10000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        work = res.data['id']
        res = self.client.post('/api/works/', {
            'farmer': 99999, 'work_type': 'Ploughing',
            'work_date': '2026-09-10', 'area': '1.00', 'amount': '100.00',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Bill from work; duplicate blocked.
        res = self.client.post('/api/bills/', {
            'work': work, 'bill_date': '2026-09-11', 'total_amount': '10000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        bill = res.data['id']
        self.assertEqual(res.data['status'], 'Unpaid')
        res = self.client.post('/api/bills/', {
            'work': work, 'bill_date': '2026-09-11', 'total_amount': '5.00',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Partial payments then overpay blocked then full.
        res = self.client.post('/api/payments/', {
            'bill': bill, 'payment_date': '2026-09-12',
            'method': 'Cash', 'amount': '3000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        res = self.client.post('/api/payments/', {
            'bill': bill, 'payment_date': '2026-09-12',
            'method': 'UPI', 'amount': '8000.00',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.post('/api/payments/', {
            'bill': bill, 'payment_date': '2026-09-12',
            'method': 'Cash', 'amount': '7000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        res = self.client.get(f'/api/bills/{bill}/')
        self.assertEqual(res.data['status'], 'Paid')
        self.assertEqual(res.data['pending_amount'], '0.00')
        # Expense valid + invalid.
        res = self.client.post('/api/expenses/', {
            'expense_type': 'Diesel', 'amount': '2000.00',
            'date': '2026-09-12', 'description': 'test',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        res = self.client.post('/api/expenses/', {
            'expense_type': 'Bad', 'amount': '-5', 'date': '2030-01-01',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Dashboard reflects the chain.
        res = self.client.get('/api/dashboard/')
        self.assertEqual(res.data['totals']['pending'], '0')
