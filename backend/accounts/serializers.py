# Auth update: registration serializer with all required validation.
import re
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import UserProfile
from .validators import domain_typo_error, is_valid_email, password_error


def _get_profile(user):
    try:
        return user.profile
    except UserProfile.DoesNotExist:
        return None


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    company_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default='')
    email = serializers.CharField(max_length=254)
    mobile = serializers.CharField(max_length=10)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        err = password_error(value)
        if err:
            raise serializers.ValidationError(err)
        return value

    def validate_full_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Full Name is required.')
        return value

    def validate_last_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Last Name is required.')
        return value

    def validate_email(self, value):
        value = (value or '').strip().lower()
        if not value:
            raise serializers.ValidationError('Email is required.')
        if not is_valid_email(value):
            raise serializers.ValidationError(
                'Please enter a valid email address.')
        typo = domain_typo_error(value)
        if typo:
            raise serializers.ValidationError(typo)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                'An account with this email already exists.')
        return value

    def validate_mobile(self, value):
        value = (value or '').strip()
        if not re.fullmatch(r'\d{10}', value):
            raise serializers.ValidationError(
                'Mobile Number must be 10 digits.')
        return value

    def validate(self, attrs):
        if not attrs.get('password'):
            raise serializers.ValidationError(
                {'password': 'Password is required.'})
        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match.'})
        # Company name stays optional - default to '' when missing.
        attrs['company_name'] = (attrs.get('company_name') or '').strip()
        return attrs

    def create(self, validated_data):
        email = validated_data['email'].strip().lower()
        # Username is derived from the email prefix; suffixed until unique.
        # Existing username logins (e.g. admin) keep working unchanged.
        base = email.split('@')[0][:140] or 'user'
        username = base
        counter = 1
        while User.objects.filter(username__iexact=username).exists():
            counter += 1
            username = f'{base}{counter}'

        # set_password() hashes the password - never stored as plain text.
        # Last name uses the built-in User.last_name column (no new column).
        user = User(username=username, email=email,
                    first_name=validated_data['full_name'].strip(),
                    last_name=validated_data['last_name'].strip())
        user.set_password(validated_data['password'])
        user.save()
        UserProfile.objects.create(
            user=user,
            full_name=validated_data['full_name'].strip(),
            company_name=validated_data.get('company_name', ''),
            mobile=validated_data['mobile'].strip(),
        )
        return user
