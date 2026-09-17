# P1: payment concurrency - the bill row is locked during creation so
# concurrent payments cannot bypass the remaining-amount check.
# No model/schema change; bill status stays consistent with paid totals.
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TransactionTestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient


def make_api_client(user):
    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION='Token ' + Token.objects.create(user=user).key)
    return client


class PaymentConcurrencyTests(TransactionTestCase):
    """Real-thread concurrency (TransactionTestCase so threads share
    committed rows) with a barrier for maximum overlap."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='payrace', email='payrace@t.com', password='pw123456')
        self.client = make_api_client(self.user)
        res = self.client.post('/api/farmers/', {
            'name': 'Race Farmer', 'mobile': '9998887776', 'village': 'V',
        }, format='json')
        assert res.status_code == 201, res.content
        self.farmer = res.data['id']
        res = self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-10', 'area': '2.00',
            'rate_per_acre': '5000.00', 'amount': '10000.00',
            'field_location': 'North Field',
        }, format='json')
        assert res.status_code == 201, res.content
        res = self.client.post('/api/bills/', {
            'work': res.data['id'], 'bill_date': '2026-09-10',
            'total_amount': '10000.00',
        }, format='json')
        assert res.status_code == 201, res.content
        self.bill = res.data['id']
        self.token_key = Token.objects.get(user=self.user).key

    def _pay_status(self, _i, amount):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + self.token_key)
        res = client.post('/api/payments/', {
            'bill': self.bill, 'payment_date': '2026-09-12',
            'method': 'Cash', 'amount': amount,
        }, format='json')
        return res.status_code

    def _run_threads(self, count, func, *args):
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
                results.append(func(i, *args))
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

    def _paid_total(self):
        from billing.models import Bill
        return Bill.objects.get(id=self.bill).get_paid_amount()

    def test_normal_payment(self):
        self.assertEqual(self._pay_status(0, '3000.00'), 201)
        self.assertEqual(self._paid_total(), Decimal('3000.00'))
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['status'], 'Partial')
        self.assertEqual(res.data['pending_amount'], '7000.00')

    def test_exact_remaining_payment_marks_paid(self):
        self.assertEqual(self._pay_status(0, '10000.00'), 201)
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['status'], 'Paid')
        self.assertEqual(res.data['pending_amount'], '0.00')

    def test_overpayment_rejected(self):
        res = self.client.post('/api/payments/', {
            'bill': self.bill, 'payment_date': '2026-09-12',
            'method': 'Cash', 'amount': '10001.00',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self._paid_total(), Decimal('0'))

    def test_concurrent_payments_never_overpay(self):
        # 3 x Rs 5000 against Rs 10000 pending: exactly two must succeed
        # and one must be rejected, in any thread order - never a 500.
        results = self._run_threads(3, self._pay_status, '5000.00')
        for result in results:
            self.assertIn(result, (201, 400), result)
        self.assertEqual(sorted(results), [201, 201, 400])
        self.assertEqual(self._paid_total(), Decimal('10000.00'))
        res = self.client.get(f'/api/bills/{self.bill}/')
        self.assertEqual(res.data['status'], 'Paid')
        self.assertEqual(res.data['pending_amount'], '0.00')
