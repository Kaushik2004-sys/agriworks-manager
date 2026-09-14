# Problem report API validation.
# Users can submit reports; only staff can change status/delete.
from rest_framework import serializers
from .models import ProblemReport

MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024
ALLOWED_SCREENSHOT_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
ALLOWED_SCREENSHOT_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}


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
        content_type = getattr(value, 'content_type', '')
        if content_type not in ALLOWED_SCREENSHOT_TYPES:
            raise serializers.ValidationError('Screenshot must be an image (JPG, PNG, GIF or WebP).')
        if value.size and value.size > MAX_SCREENSHOT_BYTES:
            raise serializers.ValidationError('Screenshot must be smaller than 2 MB.')
        name = (getattr(value, 'name', '') or '').lower()
        if not any(name.endswith(ext) for ext in ALLOWED_SCREENSHOT_EXTS):
            raise serializers.ValidationError('Screenshot must be an image (JPG, PNG, GIF or WebP).')
        return value
