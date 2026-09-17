# Problem report API validation.
# Users can submit reports; only staff can change status/delete.
from rest_framework import serializers
from .models import ProblemReport

MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024
ALLOWED_SCREENSHOT_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
ALLOWED_SCREENSHOT_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}

IMAGE_MESSAGE = 'Screenshot must be an image (JPG, PNG, GIF or WebP).'


def sniffed_image_type(head):
    """Actual image kind from magic bytes (never trust client MIME/ext).

    Returns the matching allowed content type, else None. Dependency-free
    so no new package is needed. SVG/HTML/text have no allowed signature
    and are therefore rejected (stored-XSS prevention).
    """
    data = head or b''
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith((b'GIF87a', b'GIF89a')):
        return 'image/gif'
    if len(data) >= 12 and data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    return None


class ProblemReportSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ProblemReport
        fields = [
            'id', 'user', 'username', 'name', 'email',
            'problem_type', 'description', 'screenshot',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate_name(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError('Name is required.')
        return str(value).strip()

    def validate_description(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError('Description must not be empty.')
        return str(value).strip()

    def validate_screenshot(self, value):
        if value in (None, ''):
            return None
        # Empty files previously slipped past the falsy size check.
        size = getattr(value, 'size', 0) or 0
        if size <= 0:
            raise serializers.ValidationError('Screenshot file is empty.')
        if size > MAX_SCREENSHOT_BYTES:
            raise serializers.ValidationError('Screenshot must be smaller than 2 MB.')
        name = (getattr(value, 'name', '') or '').lower()
        if not any(name.endswith(ext) for ext in ALLOWED_SCREENSHOT_EXTS):
            raise serializers.ValidationError(IMAGE_MESSAGE)
        content_type = getattr(value, 'content_type', '') or ''
        if content_type not in ALLOWED_SCREENSHOT_TYPES:
            raise serializers.ValidationError(IMAGE_MESSAGE)
        # Authoritative check: sniff the actual bytes so spoofed MIME
        # types or renamed executables/HTML cannot pass. Rewind first so
        # the stored file keeps its full content.
        try:
            head = value.read(12)
        except Exception:
            raise serializers.ValidationError('Screenshot file could not be read.')
        try:
            value.seek(0)
        except Exception:
            raise serializers.ValidationError('Screenshot file could not be read.')
        if sniffed_image_type(head) != content_type:
            raise serializers.ValidationError(IMAGE_MESSAGE)
        return value
