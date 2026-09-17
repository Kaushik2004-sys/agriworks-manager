# Smoke tests for AgriWorks Manager core flows.
# Runs on an isolated test database - never touches the dev database.
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TransactionTestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

STRONG = 'Pass1234!'


def make_user(client, email='smoke@test.com', password=STRONG,
              mobile='9998887776'):
    res = client.post('/api/register/', {
        'full_name': 'Smoke Test', 'last_name': 'User', 'email': email,
        'mobile': mobile,
        'password': password, 'confirm_password': password,
    }, format='json')
    assert res.status_code == 201, res.content
    token = res.data['token']
    client.credentials(HTTP_AUTHORIZATION='Token ' + token)
    return User.objects.get(email=email)


class AuthSmokeTests(APITestCase):
    def test_register_login_profile(self):
        res = self.client.post('/api/register/', {
            'full_name': 'Smoke Test', 'last_name': 'User',
            'email': 'smoke@test.com',
            'mobile': '9998887776', 'password': STRONG,
            'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertIn('token', res.data)
        # Duplicate email blocked.
        res = self.client.post('/api/register/', {
            'full_name': 'Dup', 'last_name': 'User', 'email': 'smoke@test.com',
            'mobile': '8887776665', 'password': STRONG,
            'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Weak password blocked.
        res = self.client.post('/api/register/', {
            'full_name': 'Weak', 'last_name': 'User', 'email': 'weak@test.com',
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
        # Invalid credentials rejected with 401 + generic error.
        res = self.client.post('/api/login/', {
            'username': 'smoke@test.com', 'password': 'Wrong1@x',
        }, format='json')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data.get('error'),
                         'Invalid email or password.')
        self.assertNotIn('token', res.data)
        # Unknown user gets the identical 401 + generic error.
        res = self.client.post('/api/login/', {
            'username': 'ghost@nowhere.com', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data.get('error'),
                         'Invalid email or password.')
        self.assertNotIn('token', res.data)

    def test_protected_endpoints_require_auth(self):
        res = self.client.get('/api/farmers/')
        self.assertEqual(res.status_code, 401)
        res = self.client.get('/api/me/')
        self.assertEqual(res.status_code, 401)

    def test_forgot_reset_flow(self):
        from django.test import override_settings
        make_user(self.client)
        self.client.credentials()
        # Unregistered email -> identical generic response (no account
        # enumeration), no token fields.
        with override_settings(
                EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            from django.core import mail
            mail.outbox = []
            res_unknown = self.client.post('/api/password-reset/request/',
                                           {'email': 'nobody@nowhere.com'},
                                           format='json')
            self.assertEqual(res_unknown.status_code, 200)
            self.assertNotIn('token', res_unknown.data)
            self.assertNotIn('reset_link', res_unknown.data)
            # Registered email -> confirmation only, never the link/token.
            res = self.client.post('/api/password-reset/request/',
                                   {'email': 'smoke@test.com'}, format='json')
            self.assertEqual(res.status_code, 200)
            self.assertEqual(list(res.data.keys()), ['message'])
            # Both responses are indistinguishable: same status, same body.
            self.assertEqual(res_unknown.status_code, res.status_code)
            self.assertEqual(res_unknown.data, res.data)
            # Exactly one email went out, containing the reset link.
            self.assertEqual(len(mail.outbox), 1)
            self.assertIn('/reset-password?uid=', mail.outbox[0].body)
        # Confirm with a real token, then reuse must fail (single-use).
        from accounts.views import token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
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
            'full_name': 'Smoke Updated', 'last_name': 'User',
            'company_name': 'Acme',
            'mobile': '8887776665', 'email': 'hacker@evil.com',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.email, 'smoke@test.com')
        self.assertEqual(user.profile.company_name, 'Acme')
        # Bad mobile blocked.
        res = self.client.put('/api/profile/', {
            'full_name': 'Smoke', 'last_name': 'User', 'mobile': '123',
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
        # Work linked to farmer (area-based auto total: 2.00 x 5000 = 10000.00).
        res = self.client.post('/api/works/', {
            'farmer': farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-10', 'area': '2.00',
            'rate_per_acre': '5000.00', 'amount': '10000.00',
            'field_location': 'North Field', 'remark': 'Soil was slightly wet',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        work = res.data['id']
        res = self.client.post('/api/works/', {
            'farmer': 99999, 'work_type': 'Ploughing',
            'work_date': '2026-09-10', 'area': '1.00',
            'rate_per_acre': '100.00', 'amount': '100.00',
            'field_location': 'North Field',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Bill from work; duplicate blocked.
        res = self.client.post('/api/bills/', {
            'work': work, 'bill_date': '2026-09-10', 'total_amount': '10000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        bill = res.data['id']
        self.assertEqual(res.data['status'], 'Unpaid')
        res = self.client.post('/api/bills/', {
            'work': work, 'bill_date': '2026-09-10', 'total_amount': '5.00',
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


class AdminOverviewTests(APITestCase):
    def auth_as(self, username, superuser=False, staff=False):
        user = User.objects.create_user(username=username, email=f'{username}@t.com', password='pw123456')
        user.is_staff = staff or superuser
        user.is_superuser = superuser
        user.save()
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        return user

    def test_overview_permissions(self):
        self.auth_as('normal')
        self.assertEqual(self.client.get('/api/admin/overview/').status_code, 403)
        self.auth_as('staffer', staff=True)
        self.assertEqual(self.client.get('/api/admin/overview/').status_code, 403)
        self.client.credentials()
        res = self.client.get('/api/admin/overview/')
        self.assertEqual(res.status_code, 401)

    def test_overview_values(self):
        self.auth_as('admin', superuser=True)
        res = self.client.get('/api/admin/overview/')
        self.assertEqual(res.status_code, 200)
        totals = res.data['totals']
        for key in ('users', 'problem_reports'):
            self.assertIn(key, totals)
        body = res.data
        self.assertIn('pending', body['problem_reports'])
        self.assertIn('recent_users', body)
        self.assertIn('recent_reports', body)
        self.assertEqual(body['system']['api'], 'ok')
        self.assertNotIn('password', str(res.data))
        self.assertNotIn('token', str(res.data).lower())


class LoginHistoryTests(APITestCase):
    def make_login_user(self, username, superuser=False, staff=False):
        user = User.objects.create_user(username=username, email=f'{username}@t.com', password='pw123456')
        user.is_staff = staff or superuser
        user.is_superuser = superuser
        user.save()
        return user

    def do_login(self, username, password='pw123456'):
        return self.client.post('/api/login/', {'username': username, 'password': password}, format='json')

    def test_login_creates_exactly_one_record(self):
        from accounts.models import LoginHistory
        self.make_login_user('hist1')
        self.assertEqual(LoginHistory.objects.count(), 0)
        res = self.do_login('hist1')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
        self.assertEqual(LoginHistory.objects.count(), 1)
        rec = LoginHistory.objects.get()
        self.assertEqual(rec.user.username, 'hist1')
        self.assertEqual(rec.status, 'Successful')
        self.assertIsNotNone(rec.created_at)

    def test_repeat_login_appends_and_keeps_previous(self):
        from accounts.models import LoginHistory
        self.make_login_user('hist2')
        self.do_login('hist2')
        first = LoginHistory.objects.get()
        first_created = first.created_at
        self.do_login('hist2')
        self.assertEqual(LoginHistory.objects.count(), 2)
        first.refresh_from_db()
        self.assertEqual(first.created_at, first_created)

    def test_logout_keeps_history_and_failed_login_skipped(self):
        from accounts.models import LoginHistory
        self.make_login_user('hist3')
        res = self.do_login('hist3')
        token = res.data['token']
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token)
        self.client.post('/api/logout/')
        self.assertEqual(LoginHistory.objects.count(), 1)
        self.client.credentials()
        res = self.do_login('hist3', password='wrong')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(LoginHistory.objects.count(), 1)

    def test_history_endpoint_permissions_and_order(self):
        from accounts.models import LoginHistory
        admin = self.make_login_user('boss', superuser=True)
        self.make_login_user('normal')
        staffer = self.make_login_user('staffer', staff=True)
        self.do_login('normal')
        self.do_login('normal')
        self.do_login('boss')
        self.assertEqual(LoginHistory.objects.count(), 3)
        token = Token.objects.get(user=admin)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        res = self.client.get('/api/admin/login-history/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 3)
        ids = [r['id'] for r in res.data]
        self.assertEqual(ids, sorted(ids, reverse=True))
        row = res.data[0]
        for key in ('username', 'email', 'login_date', 'login_time', 'status'):
            self.assertIn(key, row)
        blob = str(res.data)
        self.assertNotIn('password', blob)
        self.assertNotIn('token', blob.lower())
        token2 = Token.objects.get(user__username='normal')
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token2.key)
        self.assertEqual(self.client.get('/api/admin/login-history/').status_code, 403)
        token3, _ = Token.objects.get_or_create(user=staffer)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token3.key)
        self.assertEqual(self.client.get('/api/admin/login-history/').status_code, 403)
        self.client.credentials()
        self.assertEqual(self.client.get('/api/admin/login-history/').status_code, 401)


class BillTotalValidationTests(APITestCase):
    def setUp(self):
        make_user(self.client)
        res = self.client.post('/api/farmers/', {'name': 'Bill Test', 'mobile': '9998887776', 'village': 'V'}, format='json')
        self.assertEqual(res.status_code, 201)
        farmer = res.data['id']
        self.farmer = farmer
        res = self.client.post('/api/works/', {'farmer': farmer, 'work_type': 'Ploughing', 'work_date': '2026-09-10', 'area': '2.00', 'rate_per_acre': '5000.00', 'amount': '10000.00', 'field_location': 'North Field'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.work = res.data['id']
        res = self.client.post('/api/bills/', {'work': self.work, 'bill_date': '2026-09-10', 'total_amount': '10000.00'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.bill = res.data['id']
        res = self.client.post('/api/payments/', {'bill': self.bill, 'payment_date': '2026-09-12', 'method': 'Cash', 'amount': '3000.00'}, format='json')
        self.assertEqual(res.status_code, 201)

    def test_finalized_bill_rejects_updates(self):
        # Finalized bills reject PUT and PATCH with 405; the record is untouched.
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-10', 'total_amount': '2000.00'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/bills/{self.bill}/', {'total_amount': '2000.00'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')
        self.assertEqual(res.data['status'], 'Partial')

    def test_bill_date_locked_to_work_date(self):
        # Bill date defaults to the work date; a different date is rejected
        # on create and on update, and the work record is never modified.
        res = self.client.post('/api/works/', {'farmer': self.farmer, 'work_type': 'Other', 'work_date': '2026-09-10', 'area': '1.00', 'amount': '500.00', 'field_location': 'X', 'work_description': 'Y'}, format='json')
        self.assertEqual(res.status_code, 201)
        work2 = res.data['id']
        res = self.client.post('/api/bills/', {'work': work2, 'bill_date': '2026-09-11', 'total_amount': '500.00'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('bill_date', res.data)
        res = self.client.post('/api/bills/', {'work': work2, 'total_amount': '500.00'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['bill_date'], '2026-09-10')
        self.assertEqual(res.data['total_amount'], '500.00')
        bill2 = res.data['id']
        res = self.client.put(f'/api/bills/{bill2}/', {'work': work2, 'bill_date': '2026-09-12', 'total_amount': '500.00'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/bills/{bill2}/')
        self.assertEqual(res.data['bill_date'], '2026-09-10')
        res = self.client.get(f'/api/works/{work2}/')
        self.assertEqual(res.data['work_date'], '2026-09-10')
        self.assertEqual(res.data['amount'], '500.00')

    def test_zero_total_rejected_on_create(self):
        res = self.client.post('/api/works/', {'farmer': self.farmer, 'work_type': 'Other', 'work_date': '2026-09-10', 'area': '1.00', 'amount': '500.00', 'field_location': 'X', 'work_description': 'Y'}, format='json')
        work2 = res.data['id']
        res = self.client.post('/api/bills/', {'work': work2, 'bill_date': '2026-09-10', 'total_amount': '0'}, format='json')
        self.assertEqual(res.status_code, 400)
        # Finalized bills reject updates with 405.
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-10', 'total_amount': '0'}, format='json')
        self.assertEqual(res.status_code, 405)

    def test_raise_total_rejected_as_finalized(self):
        # Finalized bills reject total changes with 405
        # and the stored bill is left untouched.
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-10', 'total_amount': '12000.00'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')
        self.assertEqual(res.data['status'], 'Partial')

    def test_negative_total_rejected_on_create(self):
        res = self.client.post('/api/works/', {'farmer': self.farmer, 'work_type': 'Other', 'work_date': '2026-09-10', 'area': '1.00', 'amount': '500.00', 'field_location': 'X', 'work_description': 'Y'}, format='json')
        work2 = res.data['id']
        res = self.client.post('/api/bills/', {'work': work2, 'bill_date': '2026-09-10', 'total_amount': '-100'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('total_amount', res.data)
        # Finalized bills reject updates with 405.
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-10', 'total_amount': '-100'}, format='json')
        self.assertEqual(res.status_code, 405)
        # Bill untouched by the rejected updates.
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')

    def test_malformed_total_rejected_without_500(self):
        # Garbage numeric input on bill create is a 400, never a 500.
        res = self.client.post('/api/works/', {'farmer': self.farmer, 'work_type': 'Other', 'work_date': '2026-09-10', 'area': '1.00', 'amount': '500.00', 'field_location': 'X', 'work_description': 'Y'}, format='json')
        work2 = res.data['id']
        res = self.client.post('/api/bills/', {'work': work2, 'bill_date': '2026-09-10', 'total_amount': 'abc'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('total_amount', res.data)

    def test_finalized_bill_rejects_patch(self):
        # Even a same-value PATCH is rejected: finalized means no updates.
        res = self.client.patch(f'/api/bills/{self.bill}/', {'total_amount': '10000.00'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')

    def test_locked_work_rejects_updates(self):
        # Saved work records are locked (source of truth for billing):
        # PUT and PATCH are rejected with 405 and the bill is untouched.
        res = self.client.put(f'/api/works/{self.work}/', {'farmer': self.farmer, 'work_type': 'Ploughing', 'work_date': '2026-09-10', 'area': '2.00', 'rate_per_acre': '5000.00', 'amount': '10000.00', 'field_location': 'North Field', 'remark': 'Changed remark'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/works/{self.work}/', {'remark': 'Changed remark'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/works/{self.work}/')
        self.assertEqual(res.data['work_date'], '2026-09-10')
        self.assertEqual(res.data['amount'], '10000.00')
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')

class PaymentLockValidationTests(APITestCase):
    def setUp(self):
        make_user(self.client, email='paylock@test.com')
        res = self.client.post('/api/farmers/', {'name': 'Pay Lock', 'mobile': '9998887776', 'village': 'V'}, format='json')
        self.assertEqual(res.status_code, 201)
        farmer = res.data['id']
        res = self.client.post('/api/works/', {'farmer': farmer, 'work_type': 'Other', 'work_date': '2026-09-10', 'area': '1.00', 'amount': '2500.00', 'field_location': 'X', 'work_description': 'Y'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.work = res.data['id']
        res = self.client.post('/api/bills/', {'work': self.work}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['total_amount'], '2500.00')
        self.assertEqual(res.data['bill_date'], '2026-09-10')
        self.bill = res.data['id']

    def test_saved_payment_rejects_updates(self):
        # Saved payment records are locked: PUT and PATCH give 405.
        res = self.client.post('/api/payments/', {'bill': self.bill, 'payment_date': '2026-09-11', 'method': 'Cash', 'amount': '1000'}, format='json')
        self.assertEqual(res.status_code, 201)
        pay = res.data['id']
        res = self.client.put(f'/api/payments/{pay}/', {'bill': self.bill, 'payment_date': '2026-09-11', 'method': 'Cash', 'amount': '500'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/payments/{pay}/', {'amount': '500'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/payments/{pay}/')
        self.assertEqual(res.data['amount'], '1000.00')
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['status'], 'Partial')
        self.assertEqual(res.data['pending_amount'], '1500.00')

    def test_whole_rupee_amounts_accepted(self):
        res = self.client.post('/api/payments/', {'bill': self.bill, 'payment_date': '2026-09-11', 'method': 'Cash', 'amount': '1'}, format='json')
        self.assertEqual(res.status_code, 201)
        res = self.client.post('/api/payments/', {'bill': self.bill, 'payment_date': '2026-09-11', 'method': 'UPI', 'amount': '100'}, format='json')
        self.assertEqual(res.status_code, 201)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['pending_amount'], '2399.00')
        self.assertEqual(res.data['status'], 'Partial')

    def test_fractional_and_nonpositive_amounts_rejected(self):
        for amt in ['0', '-1', '-500', '1.5', '10.50', '999.99']:
            res = self.client.post('/api/payments/', {'bill': self.bill, 'payment_date': '2026-09-11', 'method': 'Cash', 'amount': amt}, format='json')
            self.assertEqual(res.status_code, 400, amt)
            self.assertIn('amount', res.data, amt)

    def test_payment_above_balance_rejected(self):
        res = self.client.post('/api/payments/', {'bill': self.bill, 'payment_date': '2026-09-11', 'method': 'Cash', 'amount': '1000'}, format='json')
        self.assertEqual(res.status_code, 201)
        res = self.client.post('/api/payments/', {'bill': self.bill, 'payment_date': '2026-09-12', 'method': 'Cash', 'amount': '1501'}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['pending_amount'], '1500.00')
        self.assertEqual(res.data['status'], 'Partial')

class ExpenseLockValidationTests(APITestCase):
    def setUp(self):
        make_user(self.client, email='explock@test.com')
        res = self.client.post('/api/expenses/', {'expense_type': 'Diesel', 'amount': '2000.00', 'date': '2026-09-12', 'description': 'test'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.exp = res.data['id']

    def test_saved_expense_rejects_updates(self):
        # Saved expense records are locked: PUT and PATCH give 405.
        res = self.client.put(f'/api/expenses/{self.exp}/', {'expense_type': 'Diesel', 'amount': '9999.00', 'date': '2026-09-12', 'description': 'tampered'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/expenses/{self.exp}/', {'amount': '9999.00'}, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/expenses/{self.exp}/')
        self.assertEqual(res.data['amount'], '2000.00')
        self.assertEqual(res.data['description'], 'test')

class APINoCacheTests(APITestCase):
    def test_protected_api_responses_are_no_store(self):
        # Protected API responses must not be cached by the browser, so
        # Back/forward restores cannot render stale user-specific data.
        make_user(self.client, email='nocache@test.com')
        res = self.client.get('/api/me/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('no-store', res['Cache-Control'])


class SingleSessionTests(APITestCase):
    """One active session per user: a new login rotates the token so the
    previous device session is rejected. Server is the source of truth."""

    def login(self, client, username, password=STRONG):
        res = client.post('/api/login/', {
            'username': username, 'password': password,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        client.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        return res.data['token']

    def test_second_login_invalidates_first(self):
        from rest_framework.test import APIClient
        make_user(self.client, email='single@test.com')
        # Laptop login works.
        laptop = APIClient()
        laptop_token = self.login(laptop, 'single@test.com')
        self.assertEqual(laptop.get('/api/me/').status_code, 200)
        # Same user logs in on a second device (phone).
        phone = APIClient()
        phone_token = self.login(phone, 'single@test.com')
        self.assertNotEqual(phone_token, laptop_token)
        # Old laptop session is rejected; phone session works.
        self.assertEqual(laptop.get('/api/me/').status_code, 401)
        self.assertEqual(phone.get('/api/me/').status_code, 200)

    def test_different_users_stay_logged_in(self):
        from rest_framework.test import APIClient
        make_user(self.client, email='usera@test.com')
        user_a = self.client
        user_b = APIClient()
        make_user(user_b, email='userb@test.com', mobile='8887776665')
        # User B logging in/out does not affect User A's session.
        self.assertEqual(user_a.get('/api/me/').status_code, 200)
        self.assertEqual(user_b.get('/api/me/').status_code, 200)

    def test_logout_invalidates_session(self):
        make_user(self.client)
        self.assertEqual(self.client.get('/api/me/').status_code, 200)
        res = self.client.post('/api/logout/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client.get('/api/me/').status_code, 401)

    def test_admin_login_works(self):
        from django.contrib.auth.models import User
        admin = User.objects.create_user(
            username='singleboss', email='singleboss@t.com',
            password='pw123456')
        admin.is_superuser = True
        admin.save()
        res = self.client.post('/api/login/', {
            'username': 'singleboss', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        res = self.client.get('/api/admin/overview/')
        self.assertEqual(res.status_code, 200)


class ReportWorkTypeTests(APITestCase):
    """Payment/billing/pending reports expose Work Type from the actual
    related Work record (Payment -> Bill -> Work, Bill -> Work)."""

    def setUp(self):
        make_user(self.client, email='reportwt@test.com')
        res = self.client.post('/api/farmers/', {
            'name': 'Report WT', 'mobile': '9998887776', 'village': 'V',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.farmer = res.data['id']
        res = self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': 'Harvesting',
            'work_date': '2026-09-10', 'area': '2.00',
            'rate_per_acre': '1000', 'amount': '2000.00',
            'field_location': 'North Field',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.work = res.data['id']
        res = self.client.post('/api/bills/', {'work': self.work}, format='json')
        self.assertEqual(res.status_code, 201)
        self.bill = res.data['id']
        res = self.client.post('/api/payments/', {
            'bill': self.bill, 'payment_date': '2026-09-12',
            'method': 'Cash', 'amount': '500',
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_payment_report_has_work_type(self):
        res = self.client.get('/api/reports/', {'type': 'payment'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['records']), 1)
        self.assertEqual(res.data['records'][0]['work_type'], 'Harvesting')

    def test_billing_report_has_work_type(self):
        res = self.client.get('/api/reports/', {'type': 'billing'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['records']), 1)
        # Billing report carries the work type in its existing 'work' field.
        self.assertEqual(res.data['records'][0]['work'], 'Harvesting')

    def test_pending_report_has_work_type(self):
        res = self.client.get('/api/reports/', {'type': 'pending'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['records']), 1)
        rec = res.data['records'][0]
        self.assertEqual(rec['work_type'], 'Harvesting')
        self.assertEqual(rec['pending'], '1500.00')


class MobileLoginTests(APITestCase):
    """Login accepts Username OR Registered Mobile Number with the same
    password authentication, generic errors, and single-session rotation."""

    def test_username_login_succeeds(self):
        make_user(self.client, email='mobuser@test.com')
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': 'mobuser', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(self.client.get('/api/me/').status_code, 200)

    def test_mobile_login_succeeds(self):
        make_user(self.client, email='mobuser2@test.com')
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': '9998887776', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['email'], 'mobuser2@test.com')
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(self.client.get('/api/me/').status_code, 200)

    def test_wrong_password_rejected(self):
        make_user(self.client, email='mobuser3@test.com')
        self.client.credentials()
        for identifier in ('mobuser3', '9998887776'):
            res = self.client.post('/api/login/', {
                'username': identifier, 'password': 'Wrong1@x',
            }, format='json')
            self.assertEqual(res.status_code, 401, identifier)
            self.assertNotIn('token', res.data, identifier)

    def test_unregistered_mobile_and_bad_username_rejected(self):
        for identifier in ('1112223334', 'nosuchuser'):
            res = self.client.post('/api/login/', {
                'username': identifier, 'password': STRONG,
            }, format='json')
            self.assertEqual(res.status_code, 401, identifier)
            self.assertNotIn('token', res.data, identifier)

    def test_duplicate_mobile_rejected_safely(self):
        # Mobile is not unique at the DB level: a shared number must never
        # pick a user. Fresh duplicate registrations are rejected (M2), so
        # the legacy duplicate here is built directly via the ORM.
        from accounts.models import UserProfile
        make_user(self.client, email='dupmob1@test.com')
        legacy = User.objects.create_user(
            username='dupmob2', email='dupmob2@test.com', password=STRONG)
        UserProfile.objects.create(
            user=legacy, full_name='Dup Mob', mobile='9998887776')
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': '9998887776', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 401)
        self.assertNotIn('token', res.data)

    def test_admin_username_login_still_works(self):
        from django.contrib.auth.models import User
        admin = User.objects.create_user(
            username='mobadmin', email='mobadmin@t.com',
            password='pw123456')
        admin.is_superuser = True
        admin.save()
        res = self.client.post('/api/login/', {
            'username': 'mobadmin', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(
            self.client.get('/api/admin/overview/').status_code, 200)

    def test_mobile_login_rotates_session_and_logout_works(self):
        from rest_framework.test import APIClient
        make_user(self.client, email='mobuser4@test.com')
        laptop = APIClient()
        res = laptop.post('/api/login/', {
            'username': 'mobuser4', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        laptop.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(laptop.get('/api/me/').status_code, 200)
        # Same user logs in via mobile on a second device.
        phone = APIClient()
        res = phone.post('/api/login/', {
            'username': '9998887776', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        phone.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(laptop.get('/api/me/').status_code, 401)
        self.assertEqual(phone.get('/api/me/').status_code, 200)
        # Logout invalidates the active session.
        self.assertEqual(phone.post('/api/logout/').status_code, 200)
        self.assertEqual(phone.get('/api/me/').status_code, 401)


class LoginHistoryRoleTests(APITestCase):
    """Login-history records expose the actual is_superuser role so the
    Admin Panel can badge Admin vs User activity. Additive field only."""

    def test_role_present_for_admin_and_user(self):
        from django.contrib.auth.models import User
        make_user(self.client, email='roleuser@test.com')
        admin = User.objects.create_user(
            username='roleboss', email='roleboss@t.com',
            password='pw123456')
        admin.is_superuser = True
        admin.save()
        # Normal user login creates its own history row.
        res = self.client.post('/api/login/', {
            'username': 'roleuser', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        # Drop the rotated (now dead) token: DRF rejects even public
        # endpoints when a bad token is attached.
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': 'roleboss', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        res = self.client.get('/api/admin/login-history/')
        self.assertEqual(res.status_code, 200)
        by_user = {r['username']: r for r in res.data}
        self.assertTrue(by_user['roleboss']['is_superuser'])
        self.assertFalse(by_user['roleuser']['is_superuser'])
        # Existing fields still present for every record.
        for r in res.data:
            for key in ('username', 'email', 'login_date', 'login_time',
                        'status'):
                self.assertIn(key, r)


class DeleteProtectionTests(APITestCase):
    """Delete guards (no model/schema change): billed works, paid bills
    and worked farmers reject DELETE with 400 and keep all linked
    records; unlinked records still delete normally."""

    def setUp(self):
        make_user(self.client)

    def make_farmer(self, mobile='9998887776'):
        res = self.client.post('/api/farmers/', {
            'name': 'Guard Farmer', 'mobile': mobile, 'village': 'V',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.data['id']

    def make_work(self, farmer, work_type='Ploughing',
                  work_date='2026-09-10'):
        res = self.client.post('/api/works/', {
            'farmer': farmer, 'work_type': work_type,
            'work_date': work_date, 'area': '2.00',
            'rate_per_acre': '5000.00', 'amount': '10000.00',
            'field_location': 'North Field',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.data['id']

    def make_bill(self, work):
        res = self.client.post('/api/bills/', {
            'work': work, 'bill_date': '2026-09-10',
            'total_amount': '10000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.data['id']

    def make_payment(self, bill, amount='3000.00'):
        res = self.client.post('/api/payments/', {
            'bill': bill, 'payment_date': '2026-09-12',
            'method': 'Cash', 'amount': amount,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.data['id']

    def payments_for(self, bill):
        res = self.client.get(f'/api/payments/?bill={bill}')
        self.assertEqual(res.status_code, 200)
        return res.data if isinstance(res.data, list) else res.data.get(
            'results', [])

    # Work rule: deletable only when no bill exists.
    def test_work_without_bill_delete_succeeds(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        res = self.client.delete(f'/api/works/{work}/')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(
            self.client.get(f'/api/works/{work}/').status_code, 404)

    def test_work_with_bill_delete_blocked(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        self.make_bill(work)
        res = self.client.delete(f'/api/works/{work}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('bill', str(res.data).lower())

    def test_work_with_bill_and_payment_delete_blocked(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        bill = self.make_bill(work)
        self.make_payment(bill)
        res = self.client.delete(f'/api/works/{work}/')
        self.assertEqual(res.status_code, 400)

    def test_protected_work_delete_keeps_bill_and_payment(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        bill = self.make_bill(work)
        self.make_payment(bill)
        self.assertEqual(
            self.client.delete(f'/api/works/{work}/').status_code, 400)
        # Bill and payment both survive the blocked work delete.
        self.assertEqual(
            self.client.get(f'/api/bills/{bill}/').status_code, 200)
        self.assertEqual(len(self.payments_for(bill)), 1)

    # Bill rule: deletable only when no payment exists.
    def test_bill_without_payment_delete_succeeds(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        bill = self.make_bill(work)
        res = self.client.delete(f'/api/bills/{bill}/')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(
            self.client.get(f'/api/bills/{bill}/').status_code, 404)

    def test_bill_with_payment_delete_blocked(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        bill = self.make_bill(work)
        self.make_payment(bill)
        res = self.client.delete(f'/api/bills/{bill}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('payment', str(res.data).lower())

    def test_protected_bill_delete_keeps_payment(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        bill = self.make_bill(work)
        self.make_payment(bill)
        self.assertEqual(
            self.client.delete(f'/api/bills/{bill}/').status_code, 400)
        self.assertEqual(len(self.payments_for(bill)), 1)

    # Farmer rule: deletable only when no work records exist.
    def test_farmer_without_work_delete_succeeds(self):
        farmer = self.make_farmer()
        res = self.client.delete(f'/api/farmers/{farmer}/')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(
            self.client.get(f'/api/farmers/{farmer}/').status_code, 404)

    def test_farmer_with_work_delete_blocked(self):
        farmer = self.make_farmer()
        self.make_work(farmer)
        res = self.client.delete(f'/api/farmers/{farmer}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('work', str(res.data).lower())

    def test_protected_farmer_delete_keeps_chain(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        bill = self.make_bill(work)
        self.make_payment(bill)
        self.assertEqual(
            self.client.delete(f'/api/farmers/{farmer}/').status_code,
            400)
        # Farmer, work, bill and payment all survive.
        self.assertEqual(
            self.client.get(f'/api/farmers/{farmer}/').status_code, 200)
        self.assertEqual(
            self.client.get(f'/api/works/{work}/').status_code, 200)
        self.assertEqual(
            self.client.get(f'/api/bills/{bill}/').status_code, 200)
        self.assertEqual(len(self.payments_for(bill)), 1)

    def test_cross_user_delete_blocked(self):
        from rest_framework.test import APIClient
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        bill = self.make_bill(work)
        other_user = User.objects.create_user(
            username='guard2', email='guard2@t.com', password='pw123456')
        other = APIClient()
        other.credentials(HTTP_AUTHORIZATION='Token ' + Token.objects.create(
            user=other_user).key)
        # Another user's records are invisible: 404, never 400 or 204.
        for url in (f'/api/farmers/{farmer}/', f'/api/works/{work}/',
                    f'/api/bills/{bill}/'):
            self.assertEqual(other.delete(url).status_code, 404, url)
        # Owner's records are untouched and still reachable.
        for url in (f'/api/farmers/{farmer}/', f'/api/works/{work}/',
                    f'/api/bills/{bill}/'):
            self.assertEqual(
                self.client.get(url).status_code, 200, url)

    def test_edit_lock_rules_unchanged(self):
        farmer = self.make_farmer()
        work = self.make_work(farmer)
        bill = self.make_bill(work)
        # Saved works and generated bills stay locked: PUT/PATCH -> 405.
        for url in (f'/api/works/{work}/', f'/api/bills/{bill}/'):
            for method in ('put', 'patch'):
                res = getattr(self.client, method)(
                    url, {}, format='json')
                self.assertEqual(res.status_code, 405, f'{method} {url}')


class MobileConsistencyTests(APITestCase):
    """M1: one mobile rule (^[6-9]\\d{9}$) across registration, profile
    update and mobile login. M2: application-level duplicate prevention
    with no schema change; login stays safe and generic."""

    def register(self, email, mobile):
        return self.client.post('/api/register/', {
            'full_name': 'Mob Test', 'last_name': 'User', 'email': email,
            'mobile': mobile,
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')

    def login(self, identifier, password=STRONG):
        return self.client.post('/api/login/', {
            'username': identifier, 'password': password,
        }, format='json')

    # M1: registration accepts 6/7/8/9 leading digits.
    def test_register_accepts_6_leading(self):
        res = self.register('m6@test.com', '6123456789')
        self.assertEqual(res.status_code, 201, res.content)

    def test_register_accepts_7_leading(self):
        res = self.register('m7@test.com', '7123456789')
        self.assertEqual(res.status_code, 201, res.content)

    def test_register_accepts_8_leading(self):
        res = self.register('m8@test.com', '8123456789')
        self.assertEqual(res.status_code, 201, res.content)

    def test_register_accepts_9_leading(self):
        res = self.register('m9@test.com', '9876543210')
        self.assertEqual(res.status_code, 201, res.content)
        # Only the 10 digits are stored - never +91.
        user = User.objects.get(email='m9@test.com')
        self.assertEqual(user.profile.mobile, '9876543210')

    def test_register_rejects_0_leading(self):
        res = self.register('m0@test.com', '0123456789')
        self.assertEqual(res.status_code, 400)

    def test_register_rejects_1_to_5_leading(self):
        for mobile in ('1234567890', '2123456789', '5123456789'):
            res = self.register(f'r{mobile[0]}@test.com', mobile)
            self.assertEqual(res.status_code, 400, mobile)

    def test_register_rejects_9_digit_number(self):
        res = self.register('short@test.com', '987654321')
        self.assertEqual(res.status_code, 400)

    def test_register_rejects_11_digit_number(self):
        res = self.register('long@test.com', '98765432101')
        self.assertEqual(res.status_code, 400)

    def test_register_rejects_plus91_input(self):
        for mobile in ('+919876543210', '+918765432109'):
            res = self.register('plus@test.com', mobile)
            self.assertEqual(res.status_code, 400, mobile)

    # M1: profile update uses the same rule.
    def test_profile_update_accepts_valid_number(self):
        make_user(self.client)
        res = self.client.put('/api/profile/', {
            'full_name': 'Smoke Test', 'last_name': 'User',
            'mobile': '8765432109',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['profile']['mobile'], '8765432109')

    def test_profile_update_rejects_invalid_leading_digit(self):
        user = make_user(self.client)
        for mobile in ('0123456789', '5123456789'):
            res = self.client.put('/api/profile/', {
                'full_name': 'Smoke Test', 'last_name': 'User',
                'mobile': mobile,
            }, format='json')
            self.assertEqual(res.status_code, 400, mobile)
        # Stored number is untouched by the rejected updates.
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.mobile, '9998887776')

    # M1: mobile login with a valid stored number still succeeds;
    # invalid formats never authenticate and stay generic.
    def test_mobile_login_with_valid_stored_mobile_succeeds(self):
        make_user(self.client, email='m1login@test.com')
        self.client.credentials()
        res = self.login('9998887776')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)

    def test_invalid_mobile_format_does_not_bypass_auth(self):
        make_user(self.client, email='m1bypass@test.com')
        self.client.credentials()
        for identifier in ('5123456789', '0123456789', '12345',
                           '+919998887776'):
            res = self.login(identifier)
            self.assertEqual(res.status_code, 401, identifier)
            self.assertNotIn('token', res.data, identifier)
            self.assertEqual(res.data.get('error'),
                             'Invalid email or password.', identifier)

    # M2: two users cannot register with the same mobile; the rejected
    # registration must not partially create a user or profile.
    def test_duplicate_mobile_registration_rejected_atomically(self):
        from accounts.models import UserProfile
        res = self.register('dupA@test.com', '9876543210')
        self.assertEqual(res.status_code, 201, res.content)
        users_before = User.objects.count()
        profiles_before = UserProfile.objects.count()
        res = self.register('dupB@test.com', '9876543210')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(email='dupB@test.com').exists())
        self.assertEqual(User.objects.count(), users_before)
        self.assertEqual(UserProfile.objects.count(), profiles_before)

    # M2: profile cannot take another user's number, but keeping your
    # own number always works.
    def test_profile_cannot_take_other_users_mobile(self):
        from rest_framework.test import APIClient
        make_user(self.client, email='profA@test.com')
        other = APIClient()
        res = other.post('/api/register/', {
            'full_name': 'Prof B', 'last_name': 'User',
            'email': 'profB@test.com', 'mobile': '8765432109',
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        other.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        res = other.put('/api/profile/', {
            'full_name': 'Prof B', 'last_name': 'User',
            'mobile': '9998887776',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        res = other.get('/api/profile/')
        self.assertEqual(res.data['profile']['mobile'], '8765432109')

    def test_profile_can_retain_own_mobile(self):
        make_user(self.client, email='profOwn@test.com')
        res = self.client.put('/api/profile/', {
            'full_name': 'Smoke Updated', 'last_name': 'User',
            'company_name': 'Acme', 'mobile': '9998887776',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)

    # M2: login with exactly one matching profile succeeds; legacy
    # duplicates fail safely with the generic error.
    def test_mobile_login_single_match_succeeds(self):
        make_user(self.client, email='m1single@test.com')
        self.client.credentials()
        res = self.login('9998887776')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['email'], 'm1single@test.com')

    def test_mobile_login_legacy_duplicate_fails_safely(self):
        from accounts.models import UserProfile
        make_user(self.client, email='legA@test.com')
        legacy = User.objects.create_user(
            username='legacyB', email='legB@test.com', password=STRONG)
        UserProfile.objects.create(
            user=legacy, full_name='Legacy B', mobile='9998887776')
        self.client.credentials()
        res = self.login('9998887776')
        self.assertEqual(res.status_code, 401)
        self.assertNotIn('token', res.data)
        self.assertEqual(res.data.get('error'),
                         'Invalid email or password.')

    # M2: username/email login unaffected; users stay isolated.
    def test_username_email_login_unaffected(self):
        user = make_user(self.client, email='m1both@test.com')
        self.client.credentials()
        for identifier in (user.username, 'm1both@test.com'):
            res = self.login(identifier)
            self.assertEqual(res.status_code, 200, identifier)
            self.assertIn('token', res.data, identifier)

    def test_different_users_remain_isolated(self):
        from rest_framework.test import APIClient
        make_user(self.client, email='isoA@test.com')
        other = APIClient()
        res = other.post('/api/register/', {
            'full_name': 'Iso B', 'last_name': 'User',
            'email': 'isoB@test.com', 'mobile': '8765432109',
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        other.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        res = self.client.post('/api/farmers/', {
            'name': 'Iso Farmer', 'mobile': '9998887776', 'village': 'V',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        farmer = res.data['id']
        # B sees none of A's data and cannot fetch A's farmer.
        self.assertEqual(other.get('/api/farmers/').data, [])
        self.assertEqual(
            other.get(f'/api/farmers/{farmer}/').status_code, 404)


class PasswordResetEmailEnumerationTests(APITestCase):
    """Password-reset requests never reveal whether an email is
    registered. Same generic response for known and unknown addresses."""

    def request_reset(self, email):
        return self.client.post('/api/password-reset/request/',
                                {'email': email}, format='json')

    def test_registered_email_returns_normal_response(self):
        make_user(self.client, email='enum@test.com')
        self.client.credentials()
        res = self.request_reset('enum@test.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {
            'message': 'If an account exists with this email address, '
                       'a password reset link has been sent.'})
        self.assertNotIn('token', res.data)
        self.assertNotIn('reset_link', res.data)

    def test_unregistered_email_returns_identical_response(self):
        make_user(self.client, email='enum2@test.com')
        self.client.credentials()
        known = self.request_reset('enum2@test.com')
        unknown = self.request_reset('ghost@nowhere.com')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.status_code, known.status_code)
        self.assertEqual(unknown.data, known.data)
        self.assertEqual(list(unknown.data.keys()), ['message'])

    def test_invalid_email_format_still_rejected(self):
        for email in ('', 'not-an-email', 'abc@.com', 'a b@c.com'):
            res = self.request_reset(email)
            self.assertEqual(res.status_code, 400, repr(email))
            self.assertIn('error', res.data, repr(email))

    def test_reset_link_flow_still_works(self):
        make_user(self.client, email='enum3@test.com')
        self.client.credentials()
        res = self.request_reset('enum3@test.com')
        self.assertEqual(res.status_code, 200)
        from accounts.views import token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        user = User.objects.get(email='enum3@test.com')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)
        res = self.client.post('/api/password-reset/confirm/', {
            'uid': uid, 'token': token,
            'new_password': 'Brand2@new', 'confirm_password': 'Brand2@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        res = self.client.post('/api/login/', {
            'username': 'enum3@test.com', 'password': 'Brand2@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)
class DuplicateEmailSafetyTests(APITestCase):
    """M6: duplicate/case-variant email records never cause HTTP 500.
    Login stays generic; reset stays generic (M5 preserved)."""

    def login(self, identifier, password=STRONG):
        return self.client.post('/api/login/', {
            'username': identifier, 'password': password,
        }, format='json')

    def request_reset(self, email):
        return self.client.post('/api/password-reset/request/',
                                {'email': email}, format='json')

    def test_login_single_email_match_succeeds(self):
        make_user(self.client, email='m6one@test.com')
        self.client.credentials()
        res = self.login('m6one@test.com')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)

    def test_login_unknown_email_generic_error(self):
        res = self.login('absent@nowhere.com')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data.get('error'),
                         'Invalid email or password.')
        self.assertNotIn('token', res.data)

    def test_login_duplicate_email_no_500_generic_error(self):
        make_user(self.client, email='m6dup@test.com')
        User.objects.create_user(
            username='m6dup2', email='m6dup@test.com', password=STRONG)
        self.client.credentials()
        res = self.login('m6dup@test.com')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data.get('error'),
                         'Invalid email or password.')
        self.assertNotIn('token', res.data)

    def test_login_case_variant_duplicate_no_500(self):
        User.objects.create_user(
            username='m6case1', email='CaseM6@t.com', password=STRONG)
        User.objects.create_user(
            username='m6case2', email='casem6@t.com', password=STRONG)
        res = self.login('CASEM6@T.COM')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data.get('error'),
                         'Invalid email or password.')
        self.assertNotIn('token', res.data)

    def test_reset_single_email_generic_200(self):
        make_user(self.client, email='m6r@test.com')
        self.client.credentials()
        res = self.request_reset('m6r@test.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(list(res.data.keys()), ['message'])
        self.assertNotIn('token', res.data)
        self.assertNotIn('reset_link', res.data)

    def test_reset_unknown_email_same_generic_200(self):
        res = self.request_reset('void@nowhere.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {
            'message': 'If an account exists with this email address, '
                       'a password reset link has been sent.'})

    def test_reset_duplicate_email_no_500_same_response(self):
        make_user(self.client, email='m6rdup@test.com')
        User.objects.create_user(
            username='m6rdup2', email='m6rdup@test.com', password=STRONG)
        self.client.credentials()
        res = self.request_reset('m6rdup@test.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {
            'message': 'If an account exists with this email address, '
                       'a password reset link has been sent.'})
        self.assertNotIn('token', res.data)
        self.assertNotIn('reset_link', res.data)

class AuthThrottleTests(APITestCase):
    """M7: login + password-reset request are rate limited (HTTP 429),
    while auth logic, M5/M6 behavior and authenticated use are unchanged."""

    def setUp(self):
        from api.throttles import LoginRateThrottle, PasswordResetRateThrottle
        # Throttle counters live in the shared test cache - reset them so
        # every test starts with a clean bucket. DRF binds
        # DEFAULT_THROTTLE_RATES at import time, so override_settings cannot
        # change them: patch low test-only rates at runtime and restore
        # afterwards. Production limits stay untouched and higher.
        cache.clear()
        for cls, rates in (
                (LoginRateThrottle, {'login': '5/min'}),
                (PasswordResetRateThrottle, {'password_reset': '5/min'})):
            had_own = 'THROTTLE_RATES' in cls.__dict__
            old = cls.__dict__.get('THROTTLE_RATES')
            cls.THROTTLE_RATES = rates
            if had_own:
                self.addCleanup(setattr, cls, 'THROTTLE_RATES', old)
            else:
                self.addCleanup(delattr, cls, 'THROTTLE_RATES')
        make_user(self.client, email='throttle@test.com')

    def login(self, identifier, password=STRONG):
        return self.client.post('/api/login/', {
            'username': identifier, 'password': password,
        }, format='json')

    def request_reset(self, email):
        return self.client.post('/api/password-reset/request/',
                                {'email': email}, format='json')

    def test_login_succeeds_under_limit(self):
        self.client.credentials()
        res = self.login('throttle@test.com')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)

    def test_repeated_failed_logins_eventually_throttled(self):
        self.client.credentials()
        for _ in range(5):
            res = self.login('throttle@test.com', password='Wrong1@x')
            self.assertEqual(res.status_code, 401)
        res = self.login('throttle@test.com', password='Wrong1@x')
        self.assertEqual(res.status_code, 429)
        self.assertIn('detail', res.data)

    def test_successful_login_behavior_unchanged(self):
        self.client.credentials()
        res = self.login('throttle@test.com')
        self.assertEqual(res.status_code, 200)
        for key in ('token', 'username', 'email', 'message'):
            self.assertIn(key, res.data)

    def test_reset_works_normally_under_limit(self):
        self.client.credentials()
        res = self.request_reset('throttle@test.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(list(res.data.keys()), ['message'])

    def test_repeated_resets_eventually_throttled(self):
        self.client.credentials()
        for _ in range(5):
            res = self.request_reset('throttle@test.com')
            self.assertEqual(res.status_code, 200)
        res = self.request_reset('throttle@test.com')
        self.assertEqual(res.status_code, 429)
        self.assertIn('detail', res.data)

    def test_reset_enumeration_protection_intact(self):
        self.client.credentials()
        known = self.request_reset('throttle@test.com')
        unknown = self.request_reset('ghost@nowhere.com')
        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.data, known.data)

    def test_mobile_login_still_works(self):
        self.client.credentials()
        res = self.login('9998887776')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)

    def test_username_email_login_still_work(self):
        user = User.objects.get(email='throttle@test.com')
        self.client.credentials()
        for identifier in (user.username, 'throttle@test.com'):
            res = self.login(identifier)
            self.assertEqual(res.status_code, 200, identifier)
            self.assertIn('token', res.data, identifier)

    def test_single_session_rotation_unchanged(self):
        from rest_framework.test import APIClient
        first = APIClient()
        res = first.post('/api/login/', {
            'username': 'throttle@test.com', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        first.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        second = APIClient()
        res = second.post('/api/login/', {
            'username': 'throttle@test.com', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(first.get('/api/me/').status_code, 401)
        second.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(second.get('/api/me/').status_code, 200)

    def test_authenticated_business_requests_not_throttled(self):
        # Far beyond the anonymous 5/min budget: authenticated calls to
        # unthrottled business endpoints must all keep working.
        for _ in range(8):
            res = self.client.get('/api/farmers/')
            self.assertEqual(res.status_code, 200)


class RegisterConfirmThrottleTests(APITestCase):
    """P4: registration + password-reset confirmation are rate limited
    (HTTP 429) while validation and M5 behavior stay intact."""

    def setUp(self):
        from api.throttles import (
            PasswordResetConfirmRateThrottle,
            RegisterRateThrottle,
        )
        # Same runtime-patch isolation as AuthThrottleTests: DRF binds
        # rates at import time, so patch low test-only budgets and
        # restore afterwards. Production budgets stay untouched.
        cache.clear()
        for cls, rates in (
                (RegisterRateThrottle, {'register': '3/min'}),
                (PasswordResetConfirmRateThrottle,
                 {'password_reset_confirm': '3/min'})):
            had_own = 'THROTTLE_RATES' in cls.__dict__
            old = cls.__dict__.get('THROTTLE_RATES')
            cls.THROTTLE_RATES = rates
            if had_own:
                self.addCleanup(setattr, cls, 'THROTTLE_RATES', old)
            else:
                self.addCleanup(delattr, cls, 'THROTTLE_RATES')

    def register(self, i):
        return self.client.post('/api/register/', {
            'full_name': 'Throttle Reg', 'last_name': 'User',
            'email': f'threg{i}@t.com', 'mobile': f'61{i:08d}',
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')

    def test_register_succeeds_under_limit(self):
        res = self.register(1)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIn('token', res.data)

    def test_repeated_registrations_eventually_throttled(self):
        for i in range(1, 4):
            res = self.register(i)
            self.assertEqual(res.status_code, 201, res.content)
        res = self.register(4)
        self.assertEqual(res.status_code, 429)
        self.assertIn('detail', res.data)

    def test_register_validation_unchanged(self):
        res = self.client.post('/api/register/', {
            'full_name': 'X', 'last_name': 'Y', 'email': 'bad-email',
            'mobile': '6123456789',
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_reset_confirm_succeeds_under_limit(self):
        make_user(self.client, email='thconf@t.com')
        from accounts.views import token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        user = User.objects.get(email='thconf@t.com')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)
        res = self.client.post('/api/password-reset/confirm/', {
            'uid': uid, 'token': token,
            'new_password': 'Brand4@new', 'confirm_password': 'Brand4@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)

    def test_repeated_confirms_eventually_throttled(self):
        for _ in range(3):
            res = self.client.post('/api/password-reset/confirm/', {
                'uid': 'MQ', 'token': 'bad-token',
                'new_password': 'Brand4@new',
                'confirm_password': 'Brand4@new',
            }, format='json')
            self.assertEqual(res.status_code, 400)
        res = self.client.post('/api/password-reset/confirm/', {
            'uid': 'MQ', 'token': 'bad-token',
            'new_password': 'Brand4@new', 'confirm_password': 'Brand4@new',
        }, format='json')
        self.assertEqual(res.status_code, 429)
        self.assertIn('detail', res.data)

    def test_reset_request_enumeration_intact(self):
        make_user(self.client, email='thconf2@t.com')
        self.client.credentials()
        known = self.client.post('/api/password-reset/request/',
                                 {'email': 'thconf2@t.com'}, format='json')
        unknown = self.client.post('/api/password-reset/request/',
                                   {'email': 'void@nowhere.com'},
                                   format='json')
        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.data, known.data)

class TokenRotationConcurrencyTests(TransactionTestCase):
    """M8: concurrent token rotations serialize - never HTTP 500 and
    exactly one token remains. Uses real threads (TransactionTestCase,
    so threads see committed rows) with a barrier for maximum overlap."""

    def setUp(self):
        # Fresh throttle bucket: logins below share one test IP.
        cache.clear()
        self.user = User.objects.create_user(
            username='raceuser', email='race@t.com', password='pw123456')

    def _run_threads(self, count, func):
        import threading
        barrier = threading.Barrier(count)
        results = []

        def wrap(i):
            try:
                barrier.wait(timeout=30)
            except Exception as exc:
                results.append(exc)
                return
            try:
                results.append(func(i))
            except Exception as exc:
                results.append(exc)

        threads = [threading.Thread(target=wrap, args=(i,))
                   for i in range(count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=120)
        self.assertEqual([t for t in threads if t.is_alive()], [])
        self.assertEqual(len(results), count)
        return results

    def _login_status(self, _i):
        from rest_framework.test import APIClient
        res = APIClient().post('/api/login/', {
            'username': 'raceuser', 'password': 'pw123456',
        }, format='json')
        return res.status_code

    def test_concurrent_logins_no_500_single_token(self):
        from rest_framework.authtoken.models import Token
        results = self._run_threads(5, self._login_status)
        for result in results:
            self.assertEqual(result, 200, result)
        self.assertEqual(
            Token.objects.filter(user=self.user).count(), 1)

    def test_concurrent_password_change_no_500_single_token(self):
        from rest_framework.authtoken.models import Token
        from rest_framework.test import APIClient
        res = APIClient().post('/api/login/', {
            'username': 'raceuser', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        original = res.data['token']

        def attempt(i):
            client = APIClient()
            client.credentials(
                HTTP_AUTHORIZATION='Token ' + original)
            res = client.post('/api/change-password/', {
                'current_password': 'pw123456',
                'new_password': f'Newpass{i}@x1',
                'confirm_password': f'Newpass{i}@x1',
            }, format='json')
            return res.status_code

        # 200 (rotated) is normal; 400/401 only if the sibling request
        # changed the password or rotated the token first. Never 500.
        results = self._run_threads(3, attempt)
        for result in results:
            self.assertIn(result, (200, 400, 401), result)
        self.assertEqual(
            Token.objects.filter(user=self.user).count(), 1)

    def test_single_login_rotation_invalidates_old_token(self):
        from rest_framework.test import APIClient
        first = APIClient().post('/api/login/', {
            'username': 'raceuser', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(first.status_code, 200)
        second = APIClient().post('/api/login/', {
            'username': 'raceuser', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(second.status_code, 200)
        self.assertNotEqual(first.data['token'], second.data['token'])
        old, new = APIClient(), APIClient()
        old.credentials(
            HTTP_AUTHORIZATION='Token ' + first.data['token'])
        new.credentials(
            HTTP_AUTHORIZATION='Token ' + second.data['token'])
        self.assertEqual(old.get('/api/me/').status_code, 401)
        self.assertEqual(new.get('/api/me/').status_code, 200)

    def test_mobile_username_email_login_and_logout(self):
        from rest_framework.test import APIClient
        res = APIClient().post('/api/register/', {
            'full_name': 'Race Mob', 'last_name': 'User',
            'email': 'racemob@t.com', 'mobile': '9876543210',
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        for identifier in ('9876543210', 'racemob', 'racemob@t.com'):
            res = APIClient().post('/api/login/', {
                'username': identifier, 'password': STRONG,
            }, format='json')
            self.assertEqual(res.status_code, 200, identifier)
            self.assertIn('token', res.data, identifier)
        authed = APIClient()
        authed.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(authed.post('/api/logout/').status_code, 200)
        self.assertEqual(authed.get('/api/me/').status_code, 401)

    def test_password_change_rotation_sequential(self):
        from rest_framework.authtoken.models import Token
        from rest_framework.test import APIClient
        res = APIClient().post('/api/login/', {
            'username': 'raceuser', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        old_token = res.data['token']
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + old_token)
        res = client.post('/api/change-password/', {
            'current_password': 'pw123456',
            'new_password': 'Brand3@new', 'confirm_password': 'Brand3@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
        self.assertEqual(
            Token.objects.filter(user=self.user).count(), 1)
        stale, fresh = APIClient(), APIClient()
        stale.credentials(HTTP_AUTHORIZATION='Token ' + old_token)
        self.assertEqual(stale.get('/api/me/').status_code, 401)
        fresh.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(fresh.get('/api/me/').status_code, 200)


class InvalidFilterTests(APITestCase):
    """P9: malformed ID filters and unknown report types return 400
    instead of silently listing everything. Empty/valid filters work."""

    def setUp(self):
        make_user(self.client, email='filter@t.com')

    def test_non_numeric_farmer_filter_400(self):
        for url in ('/api/works/?farmer=abc', '/api/bills/?farmer=xyz',
                    '/api/reports/?type=work&farmer=abc'):
            res = self.client.get(url)
            self.assertEqual(res.status_code, 400, url)
            self.assertIn('error', res.data, url)

    def test_non_numeric_bill_filter_400(self):
        res = self.client.get('/api/payments/?bill=abc')
        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.data)

    def test_unknown_report_type_400(self):
        res = self.client.get('/api/reports/?type=bogus')
        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.data)

    def test_valid_and_empty_filters_still_work(self):
        for url in ('/api/works/', '/api/works/?farmer=',
                    '/api/bills/', '/api/bills/?farmer=1',
                    '/api/payments/', '/api/payments/?bill=1',
                    '/api/reports/?type=work',
                    '/api/reports/?type=performance'):
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, url)


class FutureDateBoundaryTests(APITestCase):
    """P8: Asia/Kolkata local today is accepted, tomorrow is rejected -
    for works, payments and expenses (bills inherit the work date)."""

    def setUp(self):
        from django.utils import timezone
        make_user(self.client, email='boundary@t.com')
        res = self.client.post('/api/farmers/', {
            'name': 'Boundary Farmer', 'mobile': '9998887776',
            'village': 'V',
        }, format='json')
        assert res.status_code == 201, res.content
        self.farmer = res.data['id']
        self.today = timezone.localdate()
        self.tomorrow = self.today + timezone.timedelta(days=1)

    def make_work(self, day, work_type='Ploughing'):
        return self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': work_type,
            'work_date': str(day), 'area': '2.00',
            'rate_per_acre': '5000.00', 'amount': '10000.00',
            'field_location': 'North Field',
        }, format='json')

    def test_work_today_accepted_tomorrow_rejected(self):
        res = self.make_work(self.today)
        self.assertEqual(res.status_code, 201, res.content)
        res = self.make_work(self.tomorrow, work_type='Harvesting')
        self.assertEqual(res.status_code, 400)
        self.assertIn('work_date', res.data)

    def test_payment_today_accepted_tomorrow_rejected(self):
        work = self.make_work(self.today).data['id']
        bill = self.client.post(
            '/api/bills/', {'work': work}, format='json').data['id']
        res = self.client.post('/api/payments/', {
            'bill': bill, 'payment_date': str(self.today),
            'method': 'Cash', 'amount': '1000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        res = self.client.post('/api/payments/', {
            'bill': bill, 'payment_date': str(self.tomorrow),
            'method': 'Cash', 'amount': '1000.00',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('payment_date', res.data)

    def test_expense_today_accepted_tomorrow_rejected(self):
        res = self.client.post('/api/expenses/', {
            'expense_type': 'Diesel', 'amount': '2000.00',
            'date': str(self.today), 'description': 't',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        res = self.client.post('/api/expenses/', {
            'expense_type': 'Diesel', 'amount': '2000.00',
            'date': str(self.tomorrow), 'description': 't',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('date', res.data)


class ReportPerformanceTests(APITestCase):
    """P5: paid-sum annotations keep report numbers identical while the
    query count stays flat as bills grow; login history paginates."""

    def setUp(self):
        make_user(self.client, email='perf@t.com')
        res = self.client.post('/api/farmers/', {
            'name': 'Perf Farmer', 'mobile': '9998887776', 'village': 'V',
        }, format='json')
        assert res.status_code == 201, res.content
        self.farmer = res.data['id']
        self.n_works = 0

    def make_bill(self, day, work_type='Ploughing', pay=None):
        self.n_works += 1
        res = self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': work_type,
            'work_date': f'2026-09-{day:02d}', 'area': '2.00',
            'rate_per_acre': '5000.00', 'amount': '10000.00',
            'field_location': 'North Field',
        }, format='json')
        assert res.status_code == 201, res.content
        work = res.data['id']
        res = self.client.post('/api/bills/', {'work': work}, format='json')
        assert res.status_code == 201, res.content
        bill = res.data['id']
        if pay:
            res = self.client.post('/api/payments/', {
                'bill': bill, 'payment_date': f'2026-09-{day:02d}',
                'method': 'Cash', 'amount': pay,
            }, format='json')
            assert res.status_code == 201, res.content
        return bill

    def report_queries(self, rtype):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get(f'/api/reports/?type={rtype}')
            assert res.status_code == 200, res.content
        return len(ctx), res.data

    def test_billing_numbers_and_flat_queries(self):
        for day in (10, 11, 12):
            self.make_bill(day)
        n_small, small = self.report_queries('billing')
        self.assertEqual(small['summary']['count'], 3)
        self.assertEqual(small['summary']['total'], '30000.00')
        for day in (13, 14, 15, 16, 17):
            self.make_bill(day)
        n_big, big = self.report_queries('billing')
        self.assertEqual(big['summary']['count'], 8)
        self.assertEqual(big['summary']['total'], '80000.00')
        # Five more bills must not add per-bill queries (N+1 gone).
        self.assertEqual(n_big, n_small)

    def test_pending_numbers_with_partial_payment(self):
        self.make_bill(10, pay='3000.00')
        self.make_bill(11)
        _n, data = self.report_queries('pending')
        self.assertEqual(data['summary']['count'], 2)
        self.assertEqual(data['summary']['total_pending'], '17000.00')
        by_id = {r['id']: r for r in data['records']}
        partial = [r for r in by_id.values() if r['paid'] == '3000.00']
        self.assertEqual(len(partial), 1)
        self.assertEqual(partial[0]['pending'], '7000.00')

    def test_login_history_pagination(self):
        from django.contrib.auth.models import User
        admin = User.objects.create_user(
            username='perfboss', email='perfboss@t.com', password='pw123456')
        admin.is_superuser = True
        admin.save()
        # Drop the registration token: rotated-away tokens are rejected
        # before the login view runs, like any stale client session.
        self.client.credentials()
        for _ in range(3):
            res = self.client.post('/api/login/', {
                'username': 'perf', 'password': STRONG,
            }, format='json')
            assert res.status_code == 200, res.content
        from rest_framework.authtoken.models import Token as AuthToken
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + AuthToken.objects.create(
            user=admin).key)
        res = self.client.get('/api/admin/login-history/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(isinstance(res.data, list))
        self.assertEqual(len(res.data), 3)
        res = self.client.get(
            '/api/admin/login-history/?page=1&page_size=2')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 3)
        self.assertEqual(len(res.data['results']), 2)
        res = self.client.get(
            '/api/admin/login-history/?page=2&page_size=2')
        self.assertEqual(len(res.data['results']), 1)


class LoginHistoryAuditTests(APITestCase):
    """M9: immutable login-event audit with IP/User-Agent that survives
    user deletion. Failed logins stay unrecorded (existing behavior)."""

    def setUp(self):
        # Fresh throttle bucket: logins below share one test IP.
        cache.clear()

    def test_successful_login_creates_event_with_ip_and_ua(self):
        from accounts.models import LoginHistory
        User.objects.create_user(
            username='audit1', email='audit1@t.com', password='pw123456')
        res = self.client.post('/api/login/', {
            'username': 'audit1', 'password': 'pw123456',
        }, format='json', HTTP_USER_AGENT='M9AuditAgent/1.0')
        self.assertEqual(res.status_code, 200)
        rec = LoginHistory.objects.get()
        self.assertEqual(rec.user.username, 'audit1')
        self.assertEqual(rec.status, 'Successful')
        self.assertEqual(rec.ip_address, '127.0.0.1')
        self.assertEqual(rec.user_agent, 'M9AuditAgent/1.0')
        self.assertIsNotNone(rec.created_at)
        # Immutable event: no updated_at column anymore.
        self.assertFalse(hasattr(rec, 'updated_at'))
        # Long User-Agent values are bounded, never rejected.
        res = self.client.post('/api/login/', {
            'username': 'audit1', 'password': 'pw123456',
        }, format='json', HTTP_USER_AGENT='A' * 300)
        self.assertEqual(res.status_code, 200)
        newest = LoginHistory.objects.order_by('-id').first()
        self.assertEqual(len(newest.user_agent), 255)

    def test_timestamp_immutable_across_repeat_logins(self):
        from accounts.models import LoginHistory
        User.objects.create_user(
            username='audit2', email='audit2@t.com', password='pw123456')
        self.client.post('/api/login/', {
            'username': 'audit2', 'password': 'pw123456',
        }, format='json')
        first = LoginHistory.objects.get()
        created = first.created_at
        self.client.post('/api/login/', {
            'username': 'audit2', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(LoginHistory.objects.count(), 2)
        first.refresh_from_db()
        self.assertEqual(first.created_at, created)

    def test_missing_ip_and_ua_do_not_error(self):
        from accounts.models import LoginHistory
        User.objects.create_user(
            username='audit3', email='audit3@t.com', password='pw123456')
        res = self.client.post('/api/login/', {
            'username': 'audit3', 'password': 'pw123456',
        }, format='json', REMOTE_ADDR='')
        self.assertEqual(res.status_code, 200)
        rec = LoginHistory.objects.get()
        self.assertIsNone(rec.ip_address)
        self.assertEqual(rec.user_agent, '')

    def test_failed_login_records_nothing_and_stores_no_secrets(self):
        from accounts.models import LoginHistory
        User.objects.create_user(
            username='audit4', email='audit4@t.com', password='pw123456')
        res = self.client.post('/api/login/', {
            'username': 'audit4', 'password': 'wrong',
        }, format='json')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(LoginHistory.objects.count(), 0)
        # The audit table has no column that could hold secrets.
        names = {f.name for f in LoginHistory._meta.get_fields()}
        self.assertTrue(names.isdisjoint(
            {'password', 'password_hash', 'token', 'key',
             'reset_token', 'auth_token'}))

    def test_user_deletion_preserves_history(self):
        from accounts.models import LoginHistory
        user = User.objects.create_user(
            username='auditdel', email='auditdel@t.com', password='pw123456')
        res = self.client.post('/api/login/', {
            'username': 'auditdel', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        user_pk = user.pk
        User.objects.filter(pk=user_pk).delete()
        # The audit row survives with an emptied user reference.
        self.assertEqual(LoginHistory.objects.count(), 1)
        rec = LoginHistory.objects.get()
        self.assertIsNone(rec.user)
        self.assertIsNone(rec.user_id)
        self.assertIn('deleted user', str(rec))

    def test_admin_endpoint_shows_ip_ua_and_deleted_users(self):
        from accounts.models import LoginHistory
        admin = User.objects.create_user(
            username='auditboss', email='auditboss@t.com',
            password='pw123456')
        admin.is_superuser = True
        admin.save()
        doomed = User.objects.create_user(
            username='auditdoom', email='auditdoom@t.com',
            password='pw123456')
        self.client.post('/api/login/', {
            'username': 'auditdoom', 'password': 'pw123456',
        }, format='json', HTTP_USER_AGENT='DoomAgent/2.0')
        User.objects.filter(pk=doomed.pk).delete()
        res = self.client.post('/api/login/', {
            'username': 'auditboss', 'password': 'pw123456',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        res = self.client.get('/api/admin/login-history/')
        self.assertEqual(res.status_code, 200)
        rows = [r for r in res.data if r['username'] == '']
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['ip_address'], '127.0.0.1')
        self.assertEqual(rows[0]['user_agent'], 'DoomAgent/2.0')
        self.assertEqual(rows[0]['status'], 'Successful')
        blob = str(res.data)
        self.assertNotIn('password', blob)
        self.assertNotIn('token', blob.lower())
        # Non-admin isolation still holds.
        plain = User.objects.create_user(
            username='auditplain', email='auditplain@t.com',
            password='pw123456')
        from rest_framework.authtoken.models import Token as AuthToken
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + AuthToken.objects.create(
            user=plain).key)
        self.assertEqual(
            self.client.get('/api/admin/login-history/').status_code, 403)
        # Exactly the two real logins: doom (user since deleted) + boss.
        self.assertEqual(LoginHistory.objects.count(), 2)


class ProfilePatchTests(APITestCase):
    """P10: PATCH partially updates the profile; PUT behavior unchanged."""

    def test_patch_company_only_keeps_rest(self):
        make_user(self.client, email='patch1@t.com')
        res = self.client.patch('/api/profile/', {
            'company_name': 'Patch Co',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        profile = res.data['profile']
        self.assertEqual(profile['company_name'], 'Patch Co')
        self.assertEqual(profile['full_name'], 'Smoke Test')
        self.assertEqual(profile['mobile'], '9998887776')

    def test_patch_mobile_valid_and_invalid(self):
        make_user(self.client, email='patch2@t.com')
        res = self.client.patch('/api/profile/', {
            'mobile': '8765432109',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['profile']['mobile'], '8765432109')
        res = self.client.patch('/api/profile/', {
            'mobile': '5123456789',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_patch_blank_name_rejected(self):
        make_user(self.client, email='patch3@t.com')
        res = self.client.patch('/api/profile/', {
            'full_name': '  ',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_patch_duplicate_mobile_rejected(self):
        from rest_framework.test import APIClient
        make_user(self.client, email='patchA@t.com')
        other = APIClient()
        res = other.post('/api/register/', {
            'full_name': 'Patch B', 'last_name': 'User',
            'email': 'patchB@t.com', 'mobile': '8765432109',
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')
        assert res.status_code == 201, res.content
        other.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        res = other.patch('/api/profile/', {'mobile': '9998887776'},
                          format='json')
        self.assertEqual(res.status_code, 400)

    def test_put_still_requires_full_object(self):
        make_user(self.client, email='patch4@t.com')
        res = self.client.put('/api/profile/', {
            'full_name': 'Put Full', 'last_name': 'User',
            'mobile': '8765432109',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        res = self.client.put('/api/profile/', {
            'full_name': 'Put Full', 'last_name': '',
            'mobile': '8765432109',
        }, format='json')
        self.assertEqual(res.status_code, 400)


class ProfileErrorContractTests(APITestCase):
    """M11: backend response shapes the Profile page parses - field
    errors, generic error payloads, and 401 for missing auth."""

    def test_profile_loads_successfully(self):
        make_user(self.client, email='m11load@test.com')
        res = self.client.get('/api/profile/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('profile', res.data)

    def test_profile_save_succeeds(self):
        make_user(self.client, email='m11save@test.com')
        res = self.client.put('/api/profile/', {
            'full_name': 'M Eleven', 'last_name': 'User',
            'mobile': '8765432109',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['profile']['mobile'], '8765432109')

    def test_field_validation_error_shape(self):
        make_user(self.client, email='m11field@test.com')
        res = self.client.put('/api/profile/', {
            'full_name': 'M Eleven', 'last_name': 'User',
            'mobile': '123',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Usable message under a stable key for the UI to display.
        self.assertIn('error', res.data)
        self.assertIn('Mobile Number must be 10 digits.',
                      str(res.data['error']))

    def test_missing_field_rejected(self):
        make_user(self.client, email='m11missing@test.com')
        res = self.client.put('/api/profile/', {
            'full_name': 'M Eleven', 'last_name': '',
            'mobile': '8765432109',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.data)

    def test_duplicate_mobile_error_shape(self):
        from rest_framework.test import APIClient
        make_user(self.client, email='m11dupA@test.com')
        other = APIClient()
        res = other.post('/api/register/', {
            'full_name': 'M Dup', 'last_name': 'User',
            'email': 'm11dupB@test.com', 'mobile': '8765432109',
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        other.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        res = other.put('/api/profile/', {
            'full_name': 'M Dup', 'last_name': 'User',
            'mobile': '9998887776',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('This mobile number cannot be used.',
                      str(res.data))

    def test_unauthenticated_profile_is_401_not_network(self):
        self.client.credentials()
        res = self.client.get('/api/profile/')
        self.assertEqual(res.status_code, 401)
        res = self.client.put('/api/profile/', {
            'full_name': 'X', 'last_name': 'Y', 'mobile': '8765432109',
        }, format='json')
        self.assertEqual(res.status_code, 401)

    def test_change_password_error_shape(self):
        make_user(self.client, email='m11pw@test.com')
        res = self.client.post('/api/change-password/', {
            'current_password': 'Wrong1@x', 'new_password': 'Newpass1!',
            'confirm_password': 'Newpass1!',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.data)


class UsernameSanitizationTests(APITestCase):
    """M14: email prefixes containing characters Django forbids in
    usernames ('%' is the only email-valid one) still register with a
    valid derived username. Email validation itself is unchanged."""

    def assert_valid_username(self, username):
        from django.contrib.auth.validators import UnicodeUsernameValidator
        UnicodeUsernameValidator()(username)  # raises when invalid
        self.assertNotIn('%', username)

    def register(self, email, mobile):
        return self.client.post('/api/register/', {
            'full_name': 'Pct Test', 'last_name': 'User', 'email': email,
            'mobile': mobile,
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')

    def login(self, identifier, password=STRONG):
        return self.client.post('/api/login/', {
            'username': identifier, 'password': password,
        }, format='json')

    def test_normal_email_keeps_prefix_username(self):
        res = self.register('sanenorm@test.com', '6123456789')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['username'], 'sanenorm')
        self.assert_valid_username(res.data['username'])

    def test_percent_prefix_sanitized_to_valid_username(self):
        res = self.register('user%test@example.com', '7123456789')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['username'], 'user_test')
        self.assert_valid_username(res.data['username'])
        user = User.objects.get(email='user%test@example.com')
        self.assertEqual(user.profile.mobile, '7123456789')

    def test_other_valid_prefix_specials_preserved(self):
        res = self.register('a.b_c+d-e@test.com', '8123456789')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['username'], 'a.b_c+d-e')
        self.assert_valid_username(res.data['username'])

    def test_sanitized_collision_suffixed_safely(self):
        res = self.register('user%test@a.com', '6123456789')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['username'], 'user_test')
        res = self.register('user_test@b.com', '7123456789')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data['username'], 'user_test2')
        self.assert_valid_username(res.data['username'])

    def test_percent_user_all_logins_work(self):
        self.register('logpct%user@test.com', '9123456789')
        user = User.objects.get(email='logpct%user@test.com')
        self.client.credentials()
        for identifier in (user.username, 'logpct%user@test.com',
                           '9123456789'):
            res = self.login(identifier)
            self.assertEqual(res.status_code, 200, identifier)
            self.assertIn('token', res.data, identifier)

    def test_invalid_emails_still_rejected(self):
        for email in ('not-an-email', 'a!b@test.com', 'x y@test.com',
                      'abc@.com'):
            res = self.register(email, '6123456789')
            self.assertEqual(res.status_code, 400, email)


class TokenExpiryTests(APITestCase):
    """Absolute 24-hour server-side token expiry (api.authentication).

    Uses controlled Token.created timestamps (test DB only) instead of
    waiting 24 hours. Rotation/logout/password flows must keep working.
    """

    def make_token(self, email='exp@test.com', mobile='6123456789'):
        res = self.client.post('/api/register/', {
            'full_name': 'Exp Test', 'last_name': 'User', 'email': email,
            'mobile': mobile,
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        token = res.data['token']
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token)
        return token

    def age_token(self, token_key, **kwargs):
        from datetime import timedelta
        from django.utils import timezone
        Token.objects.filter(key=token_key).update(
            created=timezone.now() - timedelta(**kwargs))

    def test_fresh_token_accepted(self):
        self.make_token()
        res = self.client.get('/api/me/')
        self.assertEqual(res.status_code, 200)

    def test_token_younger_than_24h_accepted(self):
        token = self.make_token()
        self.age_token(token, hours=23, minutes=59)
        res = self.client.get('/api/me/')
        self.assertEqual(res.status_code, 200)

    def test_token_exactly_24h_rejected(self):
        token = self.make_token()
        self.age_token(token, hours=24)
        res = self.client.get('/api/me/')
        self.assertEqual(res.status_code, 401)

    def test_token_older_than_24h_rejected(self):
        token = self.make_token()
        self.age_token(token, hours=25)
        res = self.client.get('/api/me/')
        self.assertEqual(res.status_code, 401)

    def test_expired_token_blocked_from_protected_endpoint(self):
        token = self.make_token()
        self.age_token(token, days=2)
        res = self.client.get('/api/farmers/')
        self.assertEqual(res.status_code, 401)

    def test_valid_token_reaches_protected_endpoint(self):
        self.make_token()
        res = self.client.get('/api/farmers/')
        self.assertEqual(res.status_code, 200)

    def test_rotation_still_works(self):
        old = self.make_token()
        res = self.client.post('/api/login/', {
            'username': 'exp@test.com', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        new = res.data['token']
        self.assertNotEqual(new, old)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + new)
        self.assertEqual(self.client.get('/api/me/').status_code, 200)

    def test_logout_still_works(self):
        self.make_token()
        res = self.client.post('/api/logout/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client.get('/api/me/').status_code, 401)

    def test_password_change_rotation_still_works(self):
        self.make_token()
        res = self.client.post('/api/change-password/', {
            'current_password': STRONG, 'new_password': 'Newpass1!',
            'confirm_password': 'Newpass1!',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + res.data['token'])
        self.assertEqual(self.client.get('/api/me/').status_code, 200)

    def test_password_reset_invalidation_still_works(self):
        self.make_token()
        from accounts.views import token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        user = User.objects.get(email='exp@test.com')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        res = self.client.post('/api/password-reset/confirm/', {
            'uid': uid, 'token': token_generator.make_token(user),
            'new_password': 'Brand1@new', 'confirm_password': 'Brand1@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        # Old login token was wiped by the reset: must re-login.
        self.assertEqual(self.client.get('/api/me/').status_code, 401)
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': 'exp@test.com', 'password': 'Brand1@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)

    def test_admin_auth_with_valid_token(self):
        from django.contrib.auth.models import User as AuthUser
        admin = AuthUser.objects.create_superuser(
            username='expadmin', email='expadmin@test.com',
            password=STRONG)
        token = Token.objects.create(user=admin)
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + token.key)
        res = self.client.get('/api/admin/overview/')
        self.assertEqual(res.status_code, 200)
        from datetime import timedelta
        from django.utils import timezone
        Token.objects.filter(pk=token.pk).update(
            created=timezone.now() - timedelta(hours=25))
        res = self.client.get('/api/admin/overview/')
        self.assertEqual(res.status_code, 401)

    def test_user_scoping_intact(self):
        self.make_token()
        res = self.client.post('/api/farmers/', {
            'name': 'Exp Farmer', 'mobile': '7123456789',
            'village': 'Expville',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        res = self.client.get('/api/farmers/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        # A second user sees none of the first user's records.
        self.client.credentials()
        self.make_token(email='exp2@test.com', mobile='7123456790')
        res = self.client.get('/api/farmers/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, [])



class EmailPasswordResetTests(APITestCase):
    """Email reset-link flow. The mail backend is locmem - no real email
    is ever sent."""

    GENERIC = {'message': 'If an account exists with this email address, '
                          'a password reset link has been sent.'}
    LINK_BAD = 'Reset link is invalid or expired.'

    def setUp(self):
        # Isolate throttle buckets per test.
        cache.clear()

    def tearDown(self):
        cache.clear()

    def register(self, email, mobile):
        res = self.client.post('/api/register/', {
            'full_name': 'Email Test', 'last_name': 'User',
            'email': email, 'mobile': mobile,
            'password': STRONG, 'confirm_password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res

    def request(self, email):
        return self.client.post('/api/password-reset/request/',
                                {'email': email}, format='json')

    def confirm(self, uid, token, new='Brand9@new', confirm='Brand9@new'):
        return self.client.post('/api/password-reset/confirm/', {
            'uid': uid, 'token': token,
            'new_password': new, 'confirm_password': confirm,
        }, format='json')

    def reset_token_for(self, email):
        from accounts.views import token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        user = User.objects.get(email=email)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        return uid, token_generator.make_token(user)

    def test_valid_email_request_succeeds(self):
        from django.test import override_settings
        self.register('em1@t.com', '6123456901')
        self.client.credentials()
        with override_settings(
                EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            from django.core import mail
            mail.outbox = []
            res = self.request('em1@t.com')
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.data, self.GENERIC)
            self.assertEqual(len(mail.outbox), 1)
            self.assertIn('/reset-password?uid=', mail.outbox[0].body)

    def test_unknown_email_identical_response(self):
        self.register('em2@t.com', '6123456902')
        self.client.credentials()
        known = self.request('em2@t.com')
        unknown = self.request('ghost@nowhere.com')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.data, known.data)
        self.assertEqual(unknown.data, self.GENERIC)

    def test_case_variation_identical_response(self):
        self.register('emcase@t.com', '6123456903')
        self.client.credentials()
        res = self.request('EMCASE@T.COM')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, self.GENERIC)

    def test_invalid_format_rejected(self):
        for email in ('', 'not-an-email', 'abc@.com', 'a b@c.com'):
            res = self.request(email)
            self.assertEqual(res.status_code, 400, repr(email))
            self.assertIn('error', res.data, repr(email))

    def test_missing_email_rejected(self):
        res = self.client.post('/api/password-reset/request/', {},
                               format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('error'), 'Email is required.')

    def test_smtp_failure_generic_500(self):
        from unittest import mock
        self.register('emfail@t.com', '6123456904')
        self.client.credentials()
        with mock.patch('accounts.views.send_mail') as sender:
            sender.side_effect = Exception('SMTP boom')
            res = self.request('emfail@t.com')
            self.assertEqual(res.status_code, 500)
            self.assertEqual(res.data, {
                'error': 'Could not send the password reset email. '
                         'Please try again later.'})
            body = str(res.content)
            self.assertNotIn('smtp', body.lower())
            self.assertNotIn('token', res.data)

    def test_request_throttled(self):
        from api.throttles import PasswordResetRateThrottle
        had_own = 'THROTTLE_RATES' in PasswordResetRateThrottle.__dict__
        old = PasswordResetRateThrottle.__dict__.get('THROTTLE_RATES')
        PasswordResetRateThrottle.THROTTLE_RATES = {'password_reset': '2/min'}
        try:
            self.register('emth@t.com', '6123456905')
            self.client.credentials()
            self.assertEqual(self.request('emth@t.com').status_code, 200)
            self.assertEqual(self.request('emth@t.com').status_code, 200)
            res = self.request('emth@t.com')
            self.assertEqual(res.status_code, 429)
            self.assertIn('detail', res.data)
        finally:
            if had_own:
                PasswordResetRateThrottle.THROTTLE_RATES = old
            else:
                delattr(PasswordResetRateThrottle, 'THROTTLE_RATES')

    def test_valid_token_confirm_succeeds(self):
        self.register('emtok@t.com', '6123456906')
        self.client.credentials()
        uid, token = self.reset_token_for('emtok@t.com')
        res = self.confirm(uid, token)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {
            'message': 'Password has been reset. Please log in.'})

    def test_invalid_token_rejected(self):
        self.register('emti@t.com', '6123456907')
        self.client.credentials()
        uid, _token = self.reset_token_for('emti@t.com')
        res = self.confirm(uid, 'bad-token-value')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('error'), self.LINK_BAD)

    def test_expired_token_rejected(self):
        from django.test import override_settings
        self.register('emex@t.com', '6123456908')
        self.client.credentials()
        uid, token = self.reset_token_for('emex@t.com')
        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            res = self.confirm(uid, token)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('error'), self.LINK_BAD)

    def test_invalid_uid_rejected(self):
        self.register('emuid@t.com', '6123456909')
        self.client.credentials()
        for uid in ('!!!not-base64!!!', '999999'):
            res = self.confirm(uid, 'whatever-token')
            self.assertEqual(res.status_code, 400, repr(uid))
            self.assertEqual(res.data.get('error'), self.LINK_BAD)

    def test_mismatch_rejected(self):
        self.register('emmm@t.com', '6123456910')
        self.client.credentials()
        uid, token = self.reset_token_for('emmm@t.com')
        res = self.confirm(uid, token,
                           new='Brand9@new', confirm='Other1@x')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('error'), 'Passwords do not match.')

    def test_weak_password_rejected(self):
        self.register('emwk@t.com', '6123456911')
        self.client.credentials()
        uid, token = self.reset_token_for('emwk@t.com')
        res = self.confirm(uid, token, new='weakpass1', confirm='weakpass1')
        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.data)

    def test_tokens_invalidated_and_old_password_dead(self):
        from rest_framework.authtoken.models import Token as AuthToken
        self.register('emki@t.com', '6123456912')
        user = User.objects.get(email='emki@t.com')
        uid, token = self.reset_token_for('emki@t.com')
        res = self.confirm(uid, token)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(AuthToken.objects.filter(user=user).count(), 0)
        self.assertEqual(self.client.get('/api/me/').status_code, 401)
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': 'emki@t.com', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 401)

    def test_login_new_password_works(self):
        self.register('emlg@t.com', '6123456913')
        uid, token = self.reset_token_for('emlg@t.com')
        self.assertEqual(self.confirm(uid, token).status_code, 200)
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': 'emlg@t.com', 'password': 'Brand9@new',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)

    def test_token_not_in_response(self):
        self.register('emnr@t.com', '6123456914')
        self.client.credentials()
        uid, token = self.reset_token_for('emnr@t.com')
        res = self.request('emnr@t.com')
        self.assertEqual(list(res.data.keys()), ['message'])
        self.assertNotIn(token, str(res.content))
        res = self.confirm(uid, token)
        self.assertEqual(list(res.data.keys()), ['message'])
        self.assertNotIn(token, str(res.content))
        self.assertNotIn(uid, str(res.content))

    def test_smtp_error_hides_details(self):
        import logging
        from unittest import mock
        records = []

        class Capture(logging.Handler):
            def emit(self, record):
                records.append(record.getMessage())

        handler = Capture()
        logger = logging.getLogger('accounts.views')
        logger.addHandler(handler)
        try:
            self.register('emlog@t.com', '6123456915')
            self.client.credentials()
            with mock.patch('accounts.views.send_mail') as sender:
                sender.side_effect = Exception('SMTP auth failed: secret')
                res = self.request('emlog@t.com')
                self.assertEqual(res.status_code, 500)
            for message in records:
                self.assertNotIn('secret', message)
                self.assertNotIn('smtp', message.lower())
        finally:
            logger.removeHandler(handler)

    def test_duplicate_email_stays_generic(self):
        self.register('emdup@t.com', '6123456916')
        User.objects.create_user(
            username='emdup2', email='emdup@t.com', password=STRONG)
        self.client.credentials()
        res = self.request('emdup@t.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, self.GENERIC)

    def test_mobile_payload_rejected(self):
        res = self.client.post('/api/password-reset/request/',
                               {'mobile': '9998887776'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('error'), 'Email is required.')
        res = self.client.post('/api/password-reset/confirm/', {
            'mobile': '9998887776', 'otp': '123456',
            'new_password': 'Brand9@new', 'confirm_password': 'Brand9@new',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('error'), self.LINK_BAD)
