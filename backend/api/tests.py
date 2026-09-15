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
        'full_name': 'Smoke Test', 'last_name': 'User', 'email': email,
        'mobile': '9998887776',
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
        make_user(user_b, email='userb@test.com')
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
            self.assertEqual(res.status_code, 400, identifier)
            self.assertNotIn('token', res.data, identifier)

    def test_unregistered_mobile_and_bad_username_rejected(self):
        for identifier in ('1112223334', 'nosuchuser'):
            res = self.client.post('/api/login/', {
                'username': identifier, 'password': STRONG,
            }, format='json')
            self.assertEqual(res.status_code, 400, identifier)
            self.assertNotIn('token', res.data, identifier)

    def test_duplicate_mobile_rejected_safely(self):
        # Mobile is not unique: a shared number must never pick a user.
        make_user(self.client, email='dupmob1@test.com')
        make_user(self.client, email='dupmob2@test.com')
        self.client.credentials()
        res = self.client.post('/api/login/', {
            'username': '9998887776', 'password': STRONG,
        }, format='json')
        self.assertEqual(res.status_code, 400)
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
