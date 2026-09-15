# Expense Amount validation tests.
# Amount accepts whole rupees only (>= Rs 1). Records stay locked but deletable.
from decimal import Decimal
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase


class ExpenseAmountValidationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='expval', email='expval@t.com', password='pw123456')
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

    def post_expense(self, amount):
        return self.client.post('/api/expenses/', {
            'expense_type': 'Diesel', 'amount': amount,
            'date': '2026-09-12', 'description': 'test',
        }, format='json')

    def test_whole_amount_accepted(self):
        for amount in ['1', '500', '1000', '2500']:
            res = self.post_expense(amount=amount)
            self.assertEqual(res.status_code, 201, amount)
            self.assertEqual(Decimal(res.data['amount']), Decimal(amount))

    def test_decimal_amount_rejected(self):
        for amount in ['500.50', '1000.25', '100.01', '1.5']:
            res = self.post_expense(amount=amount)
            self.assertEqual(res.status_code, 400, amount)
            self.assertIn('amount', res.data, amount)

    def test_zero_amount_rejected(self):
        for amount in ['0', '0.00']:
            res = self.post_expense(amount=amount)
            self.assertEqual(res.status_code, 400, amount)
            self.assertIn('amount', res.data, amount)

    def test_negative_amount_rejected(self):
        for amount in ['-1', '-500']:
            res = self.post_expense(amount=amount)
            self.assertEqual(res.status_code, 400, amount)
            self.assertIn('amount', res.data, amount)

    def test_edit_lock_still_works_and_delete_unchanged(self):
        res = self.post_expense(amount='2000')
        self.assertEqual(res.status_code, 201)
        exp = res.data['id']
        res = self.client.put(f'/api/expenses/{exp}/', {
            'expense_type': 'Diesel', 'amount': '9999',
            'date': '2026-09-12', 'description': 'tampered',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/expenses/{exp}/', {
            'amount': '9999',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/expenses/{exp}/')
        self.assertEqual(Decimal(res.data['amount']), Decimal('2000'))
        # Delete functionality is unchanged.
        res = self.client.delete(f'/api/expenses/{exp}/')
        self.assertEqual(res.status_code, 204)
        res = self.client.get(f'/api/expenses/{exp}/')
        self.assertEqual(res.status_code, 404)
