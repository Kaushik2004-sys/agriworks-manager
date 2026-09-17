# Work Area / Rate per Acre validation tests.
# Area accepts decimals (> 0); Rate per Acre accepts whole rupees (>= Rs 1).
# Total = Area x Rate per Acre (whole-rupee billing). Work records stay locked.
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TransactionTestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase, APIClient


def make_farmer(client):
    res = client.post('/api/farmers/', {
        'name': 'Val Farmer', 'mobile': '9998887776', 'village': 'V',
    }, format='json')
    assert res.status_code == 201, res.content
    return res.data['id']


class WorkAreaRateValidationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='workval', email='workval@t.com', password='pw123456')
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        res = self.client.post('/api/farmers/', {
            'name': 'Val Farmer', 'mobile': '9998887776', 'village': 'V',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.farmer = res.data['id']

    def post_work(self, area, rate, work_type='Ploughing', amount='1',
                  work_date='2026-09-10'):
        return self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': work_type,
            'work_date': work_date, 'area': area,
            'rate_per_acre': rate, 'amount': amount,
            'field_location': 'North Field',
        }, format='json')

    def test_decimal_area_accepted(self):
        for i, area in enumerate(['0.5', '1', '1.25', '1.5', '2.75']):
            res = self.post_work(area=area, rate='1000',
                                 work_date='2026-09-%02d' % (10 + i))
            self.assertEqual(res.status_code, 201, area)
            self.assertEqual(Decimal(res.data['area']), Decimal(area))
            self.assertEqual(Decimal(res.data['rate_per_acre']), Decimal('1000'))

    def test_whole_number_rate_accepted(self):
        for i, rate in enumerate(['500', '1000', '1500']):
            res = self.post_work(area='2', rate=rate,
                                 work_date='2026-09-%02d' % (10 + i))
            self.assertEqual(res.status_code, 201, rate)
            self.assertEqual(Decimal(res.data['rate_per_acre']), Decimal(rate))

    def test_decimal_rate_rejected(self):
        for rate in ['1000.50', '1500.75', '100.01', '500.5']:
            res = self.post_work(area='2', rate=rate)
            self.assertEqual(res.status_code, 400, rate)
            self.assertIn('rate_per_acre', res.data, rate)

    def test_zero_negative_area_rejected(self):
        for area in ['0', '0.00', '-1', '-0.5', '', 'abc']:
            res = self.post_work(area=area, rate='1000')
            self.assertEqual(res.status_code, 400, repr(area))
            self.assertIn('area', res.data, repr(area))

    def test_zero_negative_rate_rejected(self):
        for rate in ['0', '0.00', '-1', '-500']:
            res = self.post_work(area='2', rate=rate)
            self.assertEqual(res.status_code, 400, rate)
            self.assertIn('rate_per_acre', res.data, rate)

    def test_total_calculation_with_decimal_area(self):
        cases = [
            ('1.5', '1000', '1500.00'),
            ('2.75', '1000', '2750.00'),
            ('1.25', '1500', '1875.00'),
            ('0.5', '500', '250.00'),
        ]
        for i, (area, rate, expected) in enumerate(cases):
            res = self.post_work(area=area, rate=rate, amount='1',
                                 work_date='2026-09-%02d' % (10 + i))
            self.assertEqual(res.status_code, 201, f'{area}x{rate}')
            # Server recomputes Total = Area x Rate (whole-rupee billing).
            self.assertEqual(Decimal(res.data['amount']), Decimal(expected))

    def test_existing_work_edit_lock_still_works(self):
        res = self.post_work(area='1.5', rate='1000')
        self.assertEqual(res.status_code, 201)
        work = res.data['id']
        res = self.client.put(f'/api/works/{work}/', {
            'farmer': self.farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-10', 'area': '1.5',
            'rate_per_acre': '1000', 'amount': '1500.00',
            'field_location': 'Changed',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/works/{work}/', {
            'field_location': 'Changed',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/works/{work}/')
        self.assertEqual(res.data['field_location'], 'North Field')
        self.assertEqual(Decimal(res.data['amount']), Decimal('1500.00'))


class WorkHourlyRateValidationTests(APITestCase):
    """Rate per Hour accepts whole rupees only (>= Rs 1), like Rate per Acre."""
    def setUp(self):
        self.user = User.objects.create_user(
            username='hourval', email='hourval@t.com', password='pw123456')
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        self.farmer = make_farmer(self.client)

    def post_irrigation(self, hourly_rate, hours='2', minutes='30',
                          work_date='2026-09-10'):
        return self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': 'Irrigation',
            'work_date': work_date,
            'irrigation_hours': hours, 'irrigation_minutes': minutes,
            'hourly_rate': hourly_rate, 'amount': '1',
            'field_location': 'North Field',
        }, format='json')

    def test_whole_hourly_rate_accepted(self):
        for i, rate in enumerate(['1', '500', '1000', '1500']):
            res = self.post_irrigation(hourly_rate=rate,
                                       work_date='2026-09-%02d' % (10 + i))
            self.assertEqual(res.status_code, 201, rate)
            self.assertEqual(Decimal(res.data['hourly_rate']), Decimal(rate))

    def test_decimal_hourly_rate_rejected(self):
        for rate in ['500.50', '1000.25', '100.01', '1.5']:
            res = self.post_irrigation(hourly_rate=rate)
            self.assertEqual(res.status_code, 400, rate)
            self.assertIn('hourly_rate', res.data, rate)

    def test_zero_negative_invalid_hourly_rate_rejected(self):
        for rate in ['0', '0.00', '-1', '-500', '', 'abc']:
            res = self.post_irrigation(hourly_rate=rate)
            self.assertEqual(res.status_code, 400, repr(rate))
            self.assertIn('hourly_rate', res.data, repr(rate))

    def test_irrigation_edit_lock_still_works(self):
        res = self.post_irrigation(hourly_rate='1000')
        self.assertEqual(res.status_code, 201)
        work = res.data['id']
        res = self.client.put(f'/api/works/{work}/', {
            'farmer': self.farmer, 'work_type': 'Irrigation',
            'work_date': '2026-09-10',
            'irrigation_hours': 2, 'irrigation_minutes': 30,
            'hourly_rate': '1000', 'amount': '2500.00',
            'field_location': 'Changed',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/works/{work}/', {
            'field_location': 'Changed',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/works/{work}/')
        self.assertEqual(res.data['field_location'], 'North Field')


class WorkIrrigationDurationTests(APITestCase):
    """Zero-duration irrigation (0h 0m) is rejected; any positive
    duration is allowed. Hour/minute range rules stay unchanged."""
    def setUp(self):
        self.user = User.objects.create_user(
            username='durval', email='durval@t.com', password='pw123456')
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        self.farmer = make_farmer(self.client)

    def post_irrigation(self, hours, minutes, work_date):
        return self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': 'Irrigation',
            'work_date': work_date,
            'irrigation_hours': hours, 'irrigation_minutes': minutes,
            'hourly_rate': '1000', 'amount': '1',
            'field_location': 'North Field',
        }, format='json')

    def test_zero_hours_zero_minutes_rejected(self):
        res = self.post_irrigation(0, 0, '2026-09-10')
        self.assertEqual(res.status_code, 400)
        self.assertIn('irrigation_minutes', res.data)

    def test_zero_hours_30_minutes_allowed(self):
        res = self.post_irrigation(0, 30, '2026-09-11')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Decimal(res.data['amount']), Decimal('500.00'))

    def test_1_hour_zero_minutes_allowed(self):
        res = self.post_irrigation(1, 0, '2026-09-12')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Decimal(res.data['amount']), Decimal('1000.00'))


class WorkOtherRatePerAcreTests(APITestCase):
    """Work Type 'Other': Rate per Acre is optional; when entered it must
    be whole rupees (>= Rs 1). Total Amount stays manual but whole rupees."""
    def setUp(self):
        self.user = User.objects.create_user(
            username='otherval', email='otherval@t.com', password='pw123456')
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        self.farmer = make_farmer(self.client)

    def post_other(self, amount='1500', rate=None, area='1.5',
                   work_date='2026-09-10'):
        payload = {
            'farmer': self.farmer, 'work_type': 'Other',
            'work_date': work_date, 'area': area,
            'amount': amount, 'field_location': 'North Field',
            'work_description': 'Custom work',
        }
        if rate is not None:
            payload['rate_per_acre'] = rate
        return self.client.post('/api/works/', payload, format='json')

    def test_other_blank_rate_accepted(self):
        res = self.post_other(amount='1500')
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.data['rate_per_acre'])

    def test_other_whole_rate_accepted(self):
        for i, rate in enumerate(['1', '500', '1000', '1500']):
            res = self.post_other(amount='1500', rate=rate,
                                  work_date='2026-09-%02d' % (10 + i))
            self.assertEqual(res.status_code, 201, rate)
            self.assertEqual(Decimal(res.data['rate_per_acre']), Decimal(rate))

    def test_other_decimal_rate_rejected(self):
        for rate in ['500.50', '1000.25', '100.01']:
            res = self.post_other(amount='1500', rate=rate)
            self.assertEqual(res.status_code, 400, rate)
            self.assertIn('rate_per_acre', res.data, rate)

    def test_other_zero_negative_rate_rejected(self):
        for rate in ['0', '0.00', '-1', '-500']:
            res = self.post_other(amount='1500', rate=rate)
            self.assertEqual(res.status_code, 400, rate)
            self.assertIn('rate_per_acre', res.data, rate)

    def test_other_total_is_whole_rupees(self):
        res = self.post_other(amount='1500', rate='1000')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data['amount']), Decimal('1500'))
        # Decimal area still works for Other.
        res = self.post_other(amount='2750', rate='1000', area='2.75',
                              work_date='2026-09-11')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data['area']), Decimal('2.75'))
        # Decimal totals are rejected for Other.
        for amount in ['1500.50', '0', '-100']:
            res = self.post_other(amount=amount)
            self.assertEqual(res.status_code, 400, amount)
            self.assertIn('amount', res.data, amount)

    def test_other_malformed_total_rejected_without_500(self):
        # Garbage numeric input is a 400 validation error, never a 500.
        for amount in ['abc', '12a3', '  ', '--5']:
            res = self.post_other(amount=amount)
            self.assertEqual(res.status_code, 400, repr(amount))
            self.assertIn('amount', res.data, repr(amount))

    def test_other_edit_lock_still_works(self):
        res = self.post_other(amount='1500', rate='1000')
        self.assertEqual(res.status_code, 201)
        work = res.data['id']
        res = self.client.put(f'/api/works/{work}/', {
            'farmer': self.farmer, 'work_type': 'Other',
            'work_date': '2026-09-10', 'area': '1.5',
            'amount': '1500', 'field_location': 'Changed',
            'work_description': 'Custom work',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/works/{work}/', {
            'field_location': 'Changed',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.get(f'/api/works/{work}/')
        self.assertEqual(res.data['field_location'], 'North Field')


class DuplicateWorkTests(APITestCase):
    """Same user + same work type + same work date is rejected (400).
    Application-level check only — no schema change."""
    def setUp(self):
        self.user = User.objects.create_user(
            username='dupval', email='dupval@t.com', password='pw123456')
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        self.farmer = make_farmer(self.client)

    def post_work(self, work_type='Ploughing', work_date='2026-09-15'):
        return self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': work_type,
            'work_date': work_date, 'area': '2.00',
            'rate_per_acre': '1000', 'amount': '2000.00',
            'field_location': 'North Field',
        }, format='json')

    def test_duplicate_same_type_same_date_rejected(self):
        res = self.post_work()
        self.assertEqual(res.status_code, 201)
        res = self.post_work()
        self.assertEqual(res.status_code, 400)
        self.assertIn('work_date', res.data)

    def test_same_type_different_date_allowed(self):
        res = self.post_work(work_date='2026-09-15')
        self.assertEqual(res.status_code, 201)
        res = self.post_work(work_date='2026-09-16')
        self.assertEqual(res.status_code, 201)

    def test_different_type_same_date_allowed(self):
        res = self.post_work(work_type='Ploughing')
        self.assertEqual(res.status_code, 201)
        res = self.post_work(work_type='Harvesting')
        self.assertEqual(res.status_code, 201)

    def test_different_farmer_same_type_same_date_allowed(self):
        res = self.client.post('/api/farmers/', {
            'name': 'Second Farmer', 'mobile': '8887776665', 'village': 'W',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        other_farmer = res.data['id']
        res = self.post_work(work_type='Ploughing', work_date='2026-09-15')
        self.assertEqual(res.status_code, 201)
        res = self.client.post('/api/works/', {
            'farmer': other_farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-15', 'area': '1.00',
            'rate_per_acre': '1000', 'amount': '1000.00',
            'field_location': 'South Field',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        # Same farmer + same type + same date is still a duplicate.
        res = self.post_work(work_type='Ploughing', work_date='2026-09-15')
        self.assertEqual(res.status_code, 400)
        self.assertIn('work_date', res.data)

    def test_different_user_same_type_same_date_allowed(self):
        from rest_framework.test import APIClient
        res = self.post_work()
        self.assertEqual(res.status_code, 201)
        other = User.objects.create_user(
            username='dupval2', email='dupval2@t.com', password='pw123456')
        token = Token.objects.create(user=other)
        client2 = APIClient()
        client2.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        res = client2.post('/api/farmers/', {
            'name': 'Other Farmer', 'mobile': '8887776665', 'village': 'W',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        res = client2.post('/api/works/', {
            'farmer': res.data['id'], 'work_type': 'Ploughing',
            'work_date': '2026-09-15', 'area': '1.00',
            'rate_per_acre': '1000', 'amount': '1000.00',
            'field_location': 'South Field',
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_edit_lock_still_returns_405(self):
        res = self.post_work()
        self.assertEqual(res.status_code, 201)
        work = res.data['id']
        res = self.client.put(f'/api/works/{work}/', {
            'farmer': self.farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-15', 'area': '2.00',
            'rate_per_acre': '1000', 'amount': '2000.00',
            'field_location': 'Changed',
        }, format='json')
        self.assertEqual(res.status_code, 405)
        res = self.client.patch(f'/api/works/{work}/', {
            'field_location': 'Changed',
        }, format='json')
        self.assertEqual(res.status_code, 405)

    def test_zero_amount_rejected(self):
        res = self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-15', 'area': '2.00',
            'rate_per_acre': '1000', 'amount': '0',
            'field_location': 'North Field',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('amount', res.data)

    def test_validation_and_bill_flow_unchanged(self):
        # Existing area validation still rejects bad values.
        res = self.client.post('/api/works/', {
            'farmer': self.farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-15', 'area': '0',
            'rate_per_acre': '1000', 'amount': '1',
            'field_location': 'North Field',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('area', res.data)
        # Work -> Bill flow still works for the accepted record.
        res = self.post_work()
        self.assertEqual(res.status_code, 201)
        res = self.client.post('/api/bills/', {'work': res.data['id']},
                               format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['total_amount'], '2000.00')


def run_threaded(count, func):
    """Run func(i) on count barrier-synced threads; return statuses."""
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
    return threads, results


class WorkConcurrencyTests(TransactionTestCase):
    """P2: concurrent duplicate works serialize on the DB constraint -
    one 201, the rest friendly 400s, never HTTP 500."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='workrace', email='workrace@t.com', password='pw123456')
        self.token = Token.objects.create(user=self.user).key
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + self.token)
        res = client.post('/api/farmers/', {
            'name': 'Race Farmer', 'mobile': '9998887776', 'village': 'V',
        }, format='json')
        assert res.status_code == 201, res.content
        self.farmer = res.data['id']
        res = client.post('/api/farmers/', {
            'name': 'Race Farmer 2', 'mobile': '8887776665', 'village': 'W',
        }, format='json')
        assert res.status_code == 201, res.content
        self.farmer2 = res.data['id']

    def _post_status(self, _i, farmer):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + self.token)
        res = client.post('/api/works/', {
            'farmer': farmer, 'work_type': 'Ploughing',
            'work_date': '2026-09-15', 'area': '2.00',
            'rate_per_acre': '1000', 'amount': '2000.00',
            'field_location': 'North Field',
        }, format='json')
        return res.status_code

    def test_concurrent_duplicates_one_wins_rest_400(self):
        from works.models import Work
        threads, results = run_threaded(
            3, lambda i: self._post_status(i, self.farmer))
        self.assertEqual([t for t in threads if t.is_alive()], [])
        self.assertEqual(len(results), 3)
        for result in results:
            self.assertIn(result, (201, 400), result)
        self.assertEqual(sorted(results), [201, 400, 400])
        self.assertEqual(Work.objects.filter(
            user=self.user, farmer_id=self.farmer,
            work_type='Ploughing', work_date='2026-09-15').count(), 1)

    def test_concurrent_different_farmers_both_succeed(self):
        threads, results = run_threaded(
            2, lambda i: self._post_status(
                i, self.farmer if i == 0 else self.farmer2))
        self.assertEqual([t for t in threads if t.is_alive()], [])
        self.assertEqual(sorted(results), [201, 201])


class BillConcurrencyTests(TransactionTestCase):
    """P2: concurrent double bills for one work serialize on the locked
    work row - one 201, the rest friendly 400s, never HTTP 500."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='billrace', email='billrace@t.com', password='pw123456')
        self.token = Token.objects.create(user=self.user).key
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + self.token)
        res = client.post('/api/farmers/', {
            'name': 'Bill Race', 'mobile': '9998887776', 'village': 'V',
        }, format='json')
        assert res.status_code == 201, res.content
        res = client.post('/api/works/', {
            'farmer': res.data['id'], 'work_type': 'Ploughing',
            'work_date': '2026-09-15', 'area': '2.00',
            'rate_per_acre': '1000', 'amount': '2000.00',
            'field_location': 'North Field',
        }, format='json')
        assert res.status_code == 201, res.content
        self.work = res.data['id']

    def _bill_status(self, _i):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Token ' + self.token)
        res = client.post('/api/bills/', {'work': self.work}, format='json')
        return res.status_code

    def test_concurrent_double_bill_one_wins_rest_400(self):
        from billing.models import Bill
        threads, results = run_threaded(3, self._bill_status)
        self.assertEqual([t for t in threads if t.is_alive()], [])
        self.assertEqual(len(results), 3)
        for result in results:
            self.assertIn(result, (201, 400), result)
        self.assertEqual(sorted(results), [201, 400, 400])
        self.assertEqual(
            Bill.objects.filter(work_id=self.work).count(), 1)
