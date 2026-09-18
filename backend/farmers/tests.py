# M15: Farmer mobile consistency with Signup/Profile (+91 UI-only,
# exactly 10 digits starting with 6/7/8/9, 10-digit DB value, no schema
# change). Regression lock for the already-consistent implementation.
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase


class FarmerMobileConsistencyTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='m15val', email='m15val@t.com', password='pw123456')
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

    def post_farmer(self, mobile, name='M Farmer'):
        return self.client.post('/api/farmers/', {
            'name': name, 'mobile': mobile, 'village': 'V',
        }, format='json')

    def test_valid_6_7_8_9_leading_accepted(self):
        for mobile in ('6123456789', '7123456789', '8123456789',
                       '9876543210'):
            res = self.post_farmer(mobile)
            self.assertEqual(res.status_code, 201, mobile)
            # Stored value is exactly the 10 digits - never +91.
            self.assertEqual(res.data['mobile'], mobile)
            self.assertNotIn('+', res.data['mobile'])

    def test_invalid_0_to_5_leading_rejected(self):
        for mobile in ('0123456789', '1234567890', '2123456789',
                       '5123456789'):
            res = self.post_farmer(mobile)
            self.assertEqual(res.status_code, 400, mobile)
            self.assertIn('mobile', res.data, mobile)

    def test_9_and_11_digit_numbers_rejected(self):
        for mobile in ('987654321', '98765432101'):
            res = self.post_farmer(mobile)
            self.assertEqual(res.status_code, 400, mobile)

    def test_plus91_in_value_rejected(self):
        for mobile in ('+919876543210', '+918765432109', '91 9876543210',
                       '98765-43210'):
            res = self.post_farmer(mobile)
            self.assertEqual(res.status_code, 400, mobile)

    def test_create_and_edit_behavior(self):
        res = self.post_farmer('9876543210')
        self.assertEqual(res.status_code, 201, res.content)
        farmer = res.data['id']
        # Edit to another valid number succeeds.
        res = self.client.put(f'/api/farmers/{farmer}/', {
            'name': 'M Farmer', 'mobile': '8765432109', 'village': 'V',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['mobile'], '8765432109')
        # Edit to an invalid number is rejected; stored value untouched.
        res = self.client.put(f'/api/farmers/{farmer}/', {
            'name': 'M Farmer', 'mobile': '5123456789', 'village': 'V',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.get(f'/api/farmers/{farmer}/')
        self.assertEqual(res.data['mobile'], '8765432109')

    def test_existing_functionality_intact(self):
        self.assertEqual(self.post_farmer('9876543210').status_code, 201)
        res = self.client.get('/api/farmers/?search=M')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['mobile'], '9876543210')
