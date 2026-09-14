# Tests for Contact & Report Problem (ProblemReport API).
# Covers user submission, admin management, privacy scoping and validation.
import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

TINY_GIF = (
    b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!'
    b'\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
)


def make_user(username, superuser=False, staff=False):
    user = User.objects.create_user(username=username, email=f'{username}@x.com',
                                    password='pw123456')
    user.is_staff = staff or superuser
    user.is_superuser = superuser
    user.save()
    token = Token.objects.create(user=user)
    return user, token.key


class ProblemReportTests(APITestCase):
    def setUp(self):
        # Keep screenshot uploads out of the real MEDIA_ROOT.
        self._media = tempfile.mkdtemp()
        self._override = override_settings(MEDIA_ROOT=self._media)
        self._override.enable()
        self.addCleanup(self._override.disable)
        self.addCleanup(shutil.rmtree, self._media, True)
        self.user, self.token = make_user('usera')
        self.other, self.other_token = make_user('userb')
        self.admin, self.admin_token = make_user('boss', superuser=True)
        # is_staff=true but is_superuser=false => NORMAL user in AgriWorks.
        self.staffer, self.staffer_token = make_user('staffer', staff=True)

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    def payload(self, **kw):
        data = {'name': 'User A', 'email': 'usera@x.com',
                'problem_type': 'Login Problem',
                'description': 'Cannot log in since morning.'}
        data.update(kw)
        return data

    def test_user_submit_and_defaults(self):
        self.auth(self.token)
        res = self.client.post('/api/problem-reports/', self.payload(), format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['status'], 'Pending')
        self.assertEqual(res.data['username'], 'usera')

    def test_user_cannot_set_status(self):
        self.auth(self.token)
        res = self.client.post('/api/problem-reports/',
                               self.payload(status='Resolved'), format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['status'], 'Pending')

    def test_validation(self):
        self.auth(self.token)
        res = self.client.post('/api/problem-reports/',
                               self.payload(description='  '), format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.post('/api/problem-reports/',
                               self.payload(email='not-an-email'), format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.post('/api/problem-reports/',
                               self.payload(problem_type='Nonsense'), format='json')
        self.assertEqual(res.status_code, 400)

    def test_unauthenticated_rejected(self):
        res = self.client.post('/api/problem-reports/', self.payload(), format='json')
        self.assertEqual(res.status_code, 401)

    def test_list_scoping(self):
        self.auth(self.token)
        self.client.post('/api/problem-reports/', self.payload(), format='json')
        self.auth(self.other_token)
        self.client.post('/api/problem-reports/', self.payload(name='User B'), format='json')
        # Normal user sees only their own report.
        res = self.client.get('/api/problem-reports/')
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], 'User B')
        # Staff sees all reports.
        self.auth(self.admin_token)
        res = self.client.get('/api/problem-reports/')
        self.assertEqual(len(res.data), 2)

    def test_admin_status_flow_persists(self):
        self.auth(self.token)
        res = self.client.post('/api/problem-reports/', self.payload(), format='json')
        rid = res.data['id']
        self.auth(self.admin_token)
        res = self.client.patch(f'/api/problem-reports/{rid}/',
                                {'status': 'In Progress'}, format='json')
        self.assertEqual(res.status_code, 200)
        res = self.client.patch(f'/api/problem-reports/{rid}/',
                                {'status': 'Resolved'}, format='json')
        self.assertEqual(res.data['status'], 'Resolved')
        res = self.client.get(f'/api/problem-reports/{rid}/')
        self.assertEqual(res.data['status'], 'Resolved')

    def test_staff_without_superuser_is_normal_user(self):
        # is_staff=true, is_superuser=false => scoped to own reports, no manage rights.
        self.auth(self.token)
        self.client.post('/api/problem-reports/', self.payload(), format='json')
        self.auth(self.staffer_token)
        self.client.post('/api/problem-reports/', self.payload(name='Staffer'), format='json')
        res = self.client.get('/api/problem-reports/')
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], 'Staffer')
        rid = res.data[0]['id']
        res = self.client.patch(f'/api/problem-reports/{rid}/',
                                {'status': 'Resolved'}, format='json')
        self.assertEqual(res.status_code, 403)
        res = self.client.delete(f'/api/problem-reports/{rid}/')
        self.assertEqual(res.status_code, 403)

    def test_me_reports_superuser_flag(self):
        self.auth(self.admin_token)
        res = self.client.get('/api/me/')
        self.assertTrue(res.data['is_superuser'])
        self.auth(self.staffer_token)
        res = self.client.get('/api/me/')
        self.assertFalse(res.data['is_superuser'])

    def test_non_staff_cannot_change_status_or_delete(self):
        self.auth(self.token)
        res = self.client.post('/api/problem-reports/', self.payload(), format='json')
        rid = res.data['id']
        res = self.client.patch(f'/api/problem-reports/{rid}/',
                                {'status': 'Resolved'}, format='json')
        self.assertEqual(res.status_code, 403)
        res = self.client.delete(f'/api/problem-reports/{rid}/')
        self.assertEqual(res.status_code, 403)

    def test_admin_can_delete(self):
        self.auth(self.token)
        res = self.client.post('/api/problem-reports/', self.payload(), format='json')
        rid = res.data['id']
        self.auth(self.admin_token)
        res = self.client.delete(f'/api/problem-reports/{rid}/')
        self.assertEqual(res.status_code, 204)

    def test_screenshot_optional_and_validated(self):
        self.auth(self.token)
        gif = SimpleUploadedFile('shot.gif', TINY_GIF, content_type='image/gif')
        res = self.client.post('/api/problem-reports/',
                               {**self.payload(), 'screenshot': gif}, format='multipart')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data['screenshot'])
        bad = SimpleUploadedFile('evil.exe', b'MZ fake', content_type='application/x-msdownload')
        res = self.client.post('/api/problem-reports/',
                               {**self.payload(), 'screenshot': bad}, format='multipart')
        self.assertEqual(res.status_code, 400)
