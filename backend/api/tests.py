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
        self.assertEqual(res.status_code, 400)
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
        res = self.client.post('/api/bills/', {'work': self.work, 'bill_date': '2026-09-11', 'total_amount': '10000.00'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.bill = res.data['id']
        res = self.client.post('/api/payments/', {'bill': self.bill, 'payment_date': '2026-09-12', 'method': 'Cash', 'amount': '3000.00'}, format='json')
        self.assertEqual(res.status_code, 201)

    def test_lower_total_below_paid_rejected(self):
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-11', 'total_amount': '2000.00'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('total_amount', res.data)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')
        self.assertEqual(res.data['status'], 'Partial')

    def test_zero_total_rejected_on_create_and_update(self):
        res = self.client.post('/api/works/', {'farmer': self.farmer, 'work_type': 'Other', 'work_date': '2026-09-10', 'area': '1.00', 'amount': '500.00', 'field_location': 'X', 'work_description': 'Y'}, format='json')
        work2 = res.data['id']
        res = self.client.post('/api/bills/', {'work': work2, 'bill_date': '2026-09-11', 'total_amount': '0'}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-11', 'total_amount': '0'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_raise_total_keeps_status_correct(self):
        # Locked totals: raising the total of a generated bill is rejected
        # and the stored bill is left untouched.
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-11', 'total_amount': '12000.00'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('total_amount', res.data)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')
        self.assertEqual(res.data['status'], 'Partial')

    def test_negative_total_rejected_on_create_and_update(self):
        res = self.client.post('/api/works/', {'farmer': self.farmer, 'work_type': 'Other', 'work_date': '2026-09-10', 'area': '1.00', 'amount': '500.00', 'field_location': 'X', 'work_description': 'Y'}, format='json')
        work2 = res.data['id']
        res = self.client.post('/api/bills/', {'work': work2, 'bill_date': '2026-09-11', 'total_amount': '-100'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('total_amount', res.data)
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-11', 'total_amount': '-100'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('total_amount', res.data)
        # Bill untouched by the rejected updates.
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')

    def test_total_equal_to_paid_accepted(self):
        # Lock allows resubmitting the SAME total (normal full-object PUTs
        # that edit other fields, e.g. bill_date) while any real change,
        # even down to exactly the paid amount, is rejected as locked.
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-12', 'total_amount': '10000.00'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['bill_date'], '2026-09-12')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')
        res = self.client.put(f'/api/bills/{self.bill}/', {'work': self.work, 'bill_date': '2026-09-11', 'total_amount': '3000.00'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('total_amount', res.data)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')

    def test_bill_total_stored_and_locked(self):
        # Generate bill -> amount is stored; changing unrelated Work data
        # must NOT silently modify the generated bill total.
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        res = self.client.put(f'/api/works/{self.work}/', {'farmer': self.farmer, 'work_type': 'Ploughing', 'work_date': '2026-09-10', 'area': '2.00', 'rate_per_acre': '5000.00', 'amount': '10000.00', 'field_location': 'North Field', 'remark': 'Changed remark'}, format='json')
        self.assertEqual(res.status_code, 200)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['total_amount'], '10000.00')
        self.assertEqual(res.data['pending_amount'], '7000.00')
