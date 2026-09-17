# P3: screenshot upload validation (magic-byte sniffing, empty/size
# limits) and authenticated media download (owner/superuser only).
# No model/schema change; legitimate image uploads keep working.
import os
import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase, APIClient

PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
JPEG = b'\xff\xd8\xff\xe0' + b'\x00' * 100
GIF = b'GIF89a' + b'\x00' * 100
WEBP = b'RIFF\x00\x00\x00\x00WEBP' + b'\x00' * 100
TEXT = b'hello world, not an image'
HTML = b'<html><body><script>alert(1)</script></body></html>'
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'


def upload(name, content, content_type):
    return SimpleUploadedFile(name, content, content_type=content_type)


class ScreenshotUploadSecurityTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Keep test uploads out of the real dev MEDIA_ROOT.
        cls._media_tmp = tempfile.mkdtemp(prefix='p3media')
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_tmp)
        cls._media_override.enable()
        cls.addClassCleanup(cls._media_override.disable)
        cls.addClassCleanup(shutil.rmtree, cls._media_tmp, True)

    def setUp(self):
        self.user = User.objects.create_user(
            username='shotuser', email='shot@t.com', password='pw123456')
        self.client.credentials(
            HTTP_AUTHORIZATION='Token ' + Token.objects.create(
                user=self.user).key)

    def post_report(self, screenshot=None):
        data = {'name': 'Shot Reporter', 'email': 'shot@t.com',
                'problem_type': 'Other', 'description': 'Screen broke.'}
        if screenshot is not None:
            data['screenshot'] = screenshot
            return self.client.post('/api/problem-reports/', data,
                                    format='multipart')
        return self.client.post('/api/problem-reports/', data, format='json')

    def test_valid_images_accepted_and_stored_intact(self):
        for name, content, ctype in (
                ('a.png', PNG, 'image/png'), ('b.jpg', JPEG, 'image/jpeg'),
                ('c.gif', GIF, 'image/gif'), ('d.webp', WEBP, 'image/webp')):
            res = self.post_report(upload(name, content, ctype))
            self.assertEqual(res.status_code, 201, name)
            stored = res.data['screenshot']
            self.assertIn('/media/problem_screenshots/', stored, name)
            rel = stored.split('/media/', 1)[1]
            disk = os.path.join(self._media_tmp, rel)
            self.assertTrue(os.path.exists(disk), name)
            # Rewound before save: full content persisted, not truncated.
            self.assertEqual(os.path.getsize(disk), len(content), name)

    def test_invalid_content_rejected(self):
        res = self.post_report(upload('evil.png', TEXT, 'image/png'))
        self.assertEqual(res.status_code, 400)

    def test_wrong_extension_rejected(self):
        res = self.post_report(upload('evil.txt', PNG, 'image/png'))
        self.assertEqual(res.status_code, 400)

    def test_spoofed_mime_rejected(self):
        res = self.post_report(upload('evil.png', PNG, 'text/html'))
        self.assertEqual(res.status_code, 400)

    def test_html_and_svg_rejected(self):
        res = self.post_report(upload('evil.html', HTML, 'text/html'))
        self.assertEqual(res.status_code, 400)
        res = self.post_report(
            upload('evil.svg', SVG, 'image/svg+xml'))
        self.assertEqual(res.status_code, 400)

    def test_zero_byte_rejected(self):
        res = self.post_report(upload('empty.png', b'', 'image/png'))
        self.assertEqual(res.status_code, 400)

    def test_oversized_rejected(self):
        from support.serializers import MAX_SCREENSHOT_BYTES
        big = b'\x89PNG\r\n\x1a\n' + b'\x00' * (MAX_SCREENSHOT_BYTES + 1)
        res = self.post_report(upload('big.png', big, 'image/png'))
        self.assertEqual(res.status_code, 400)

    def test_report_without_screenshot_still_works(self):
        res = self.post_report()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.client.get('/api/problem-reports/').data[0][
            'status'], 'Pending')


class ScreenshotDownloadAccessTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media_tmp = tempfile.mkdtemp(prefix='p3media')
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_tmp)
        cls._media_override.enable()
        cls.addClassCleanup(cls._media_override.disable)
        cls.addClassCleanup(shutil.rmtree, cls._media_tmp, True)

    def auth(self, username, superuser=False):
        user = User.objects.create_user(
            username=username, email=f'{username}@t.com',
            password='pw123456')
        if superuser:
            user.is_superuser = True
            user.save()
        client = APIClient()
        client.credentials(
            HTTP_AUTHORIZATION='Token ' + Token.objects.create(
                user=user).key)
        return client

    def upload_as(self, client):
        res = client.post('/api/problem-reports/', {
            'name': 'N', 'email': 'n@t.com', 'problem_type': 'Other',
            'description': 'D',
            'screenshot': upload('shot.png', PNG, 'image/png'),
        }, format='multipart')
        assert res.status_code == 201, res.content
        return res.data['screenshot'].split('/')[-1]

    def test_owner_can_download(self):
        owner = self.auth('shotowner')
        filename = self.upload_as(owner)
        res = owner.get(f'/api/problem-screenshots/{filename}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'image/png')
        self.assertEqual(res['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(b''.join(res.streaming_content), PNG)

    def test_other_user_gets_404(self):
        owner = self.auth('shotowner2')
        filename = self.upload_as(owner)
        stranger = self.auth('shotstranger')
        res = stranger.get(f'/api/problem-screenshots/{filename}')
        self.assertEqual(res.status_code, 404)

    def test_unauthenticated_gets_401(self):
        from rest_framework.test import APIClient as RawClient
        owner = self.auth('shotowner3')
        filename = self.upload_as(owner)
        res = RawClient().get(f'/api/problem-screenshots/{filename}')
        self.assertEqual(res.status_code, 401)

    def test_superuser_can_download(self):
        owner = self.auth('shotowner4')
        filename = self.upload_as(owner)
        boss = self.auth('shotboss', superuser=True)
        res = boss.get(f'/api/problem-screenshots/{filename}')
        self.assertEqual(res.status_code, 200)

    def test_missing_and_traversal_names_404(self):
        owner = self.auth('shotowner5')
        for bad in ('nope.png', 'a/b.png', '.hidden.png', 'x.txt'):
            res = owner.get(f'/api/problem-screenshots/{bad}')
            self.assertEqual(res.status_code, 404, bad)

    def test_anonymous_media_url_closed_in_debug(self):
        owner = self.auth('shotowner6')
        filename = self.upload_as(owner)
        from django.test import Client as DjangoClient
        res = DjangoClient().get(f'/media/problem_screenshots/{filename}')
        self.assertEqual(res.status_code, 404)
