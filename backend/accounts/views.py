# Auth update: register + password-reset endpoints.
# Profile Management: view/update own profile + change password.
# Existing login/logout in api/views.py are preserved (login extended for email).
import logging
import re
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from api.throttles import (
    PasswordResetConfirmRateThrottle,
    PasswordResetRateThrottle,
    RegisterRateThrottle,
)
from .models import UserProfile
from .serializers import RegisterSerializer

logger = logging.getLogger(__name__)

token_generator = PasswordResetTokenGenerator()


def profile_dict(user):
    """Company/business info for Dashboard, Bills, Reports reuse."""
    try:
        p = user.profile
        return {'full_name': p.full_name, 'last_name': user.last_name or '',
                'company_name': p.company_name, 'mobile': p.mobile}
    except Exception:
        return {'full_name': user.first_name or '',
                'last_name': user.last_name or '',
                'company_name': '', 'mobile': ''}


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle])
def register_view(request):
    """Create a new account. Company name is optional."""
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST)
    user = serializer.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'username': user.username,
        'email': user.email,
        'profile': profile_dict(user),
        'message': 'Account created successfully.',
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRateThrottle])
def password_reset_request_view(request):
    """Step 1: user submits their registered email address; backend emails
    a single-use reset link.

    The reset token is ONLY sent to the registered email address and is
    NEVER included in the API response, logs, or UI. Anti-enumeration
    (no model/schema change): unknown AND ambiguous (duplicate) emails get
    the exact same 200 response as registered ones - no token is generated
    and no email is sent, but the caller cannot tell the difference.
    """
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'},
                        status=status.HTTP_400_BAD_REQUEST)
    from .validators import domain_typo_error, is_valid_email
    if not is_valid_email(email):
        return Response({'error': 'Please enter a valid email address.'},
                        status=status.HTTP_400_BAD_REQUEST)
    typo = domain_typo_error(email)
    if typo:
        return Response({'error': typo},
                        status=status.HTTP_400_BAD_REQUEST)
    # Single generic payload so status code and body never reveal whether
    # an account exists for the address.
    generic_response = {'message': 'If an account exists with this email '
                                   'address, a password reset link has '
                                   'been sent.'}
    try:
        user = User.objects.get(email__iexact=email)
    except (User.DoesNotExist, User.MultipleObjectsReturned):
        # Email is not DB-unique: unknown AND ambiguous addresses get the
        # same safe generic response - no token, no email, no existence
        # leak, and never an arbitrary account choice.
        return Response(generic_response)

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)
    frontend = getattr(settings, 'FRONTEND_URL',
                       'http://localhost:5173').rstrip('/')
    reset_link = f'{frontend}/reset-password?uid={uid}&token={token}'

    subject = 'Reset your AgriWorks Manager password'
    body = (f'Hello {user.first_name or user.username},\n\n'
            f'We received a request to reset your AgriWorks Manager '
            f'password.\n\n'
            f'Use the following link to create a new password:\n'
            f'{reset_link}\n\n'
            f'This link will expire after the configured password-reset '
            f'timeout.\n\n'
            f'If you did not request this password reset, you can safely '
            f'ignore this email.')
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email],
                  fail_silently=False)
    except Exception:
        # Never expose SMTP internals, credentials, or the token. The
        # failure is logged server-side without secrets for debugging.
        logger.warning('Password reset email could not be sent.')
        return Response(
            {'error': 'Could not send the password reset email. '
                      'Please try again later.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response(generic_response)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetConfirmRateThrottle])
def password_reset_confirm_view(request):
    """Step 2: set a new password using the uid/token from the reset link.

    All token failures share one generic message. A used token becomes
    invalid as soon as the password changes (single-use in practice)."""
    uid = request.data.get('uid') or ''
    token = request.data.get('token') or ''
    new_password = request.data.get('new_password') or ''
    confirm_password = request.data.get('confirm_password') or ''

    if not uid or not token:
        return Response({'error': 'Reset link is invalid or expired.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if not new_password:
        return Response({'error': 'New password is required.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if new_password != confirm_password:
        return Response({'error': 'Passwords do not match.'},
                        status=status.HTTP_400_BAD_REQUEST)
    from .validators import password_error
    pw_err = password_error(new_password)
    if pw_err:
        return Response({'error': pw_err},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except Exception:
        return Response({'error': 'Reset link is invalid or expired.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if not token_generator.check_token(user, token):
        return Response({'error': 'Reset link is invalid or expired.'},
                        status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    # Invalidate old tokens so all sessions must log in again.
    Token.objects.filter(user=user).delete()
    return Response({'message': 'Password has been reset. Please log in.'})


def _own_profile_response(user):
    """Profile payload: email is read-only, company optional."""
    return {
        'username': user.username,
        'email': user.email,
        'profile': profile_dict(user),
    }


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """View or update ONLY the logged-in user's own profile.

    GET returns Full Name, Last Name, Company/Business Name,
    Email (read-only), Mobile.
    PUT accepts full_name (required), last_name (required),
    company_name (optional), mobile (10 digits).
    P10: PATCH accepts any subset - missing fields keep their stored
    values, supplied fields follow the same rules as PUT.
    Any `email` sent is ignored - it stays read-only.
    """
    user = request.user
    if request.method == 'GET':
        return Response(_own_profile_response(user))

    data = request.data
    partial = request.method == 'PATCH'
    current = profile_dict(user) if partial else None

    def _resolve(name):
        if partial and name not in data:
            return current.get(name) or ''
        return data.get(name) or ''

    full_name = _resolve('full_name').strip()
    last_name = _resolve('last_name').strip()
    company_name = _resolve('company_name').strip()
    mobile = _resolve('mobile').strip()

    if not full_name and (not partial or 'full_name' in data):
        return Response({'error': 'Full Name is required.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if len(full_name) > 150:
        return Response({'error': 'Full Name is too long.'},
                        status=status.HTTP_400_BAD_REQUEST)
    # Same character rule as registration: Unicode letters with single
    # internal spaces only (checked against the raw submitted value so
    # leading, trailing and consecutive spaces are rejected, not silently
    # trimmed). On PATCH, only validate when a new value is actually
    # supplied, so a previously stored value can never block unrelated
    # updates.
    from .validators import (
        is_valid_company_name, is_valid_full_name, is_valid_last_name,
    )
    if not partial or 'full_name' in data:
        _raw_full = data.get('full_name', full_name)
        if not isinstance(_raw_full, str) or not is_valid_full_name(_raw_full):
            return Response(
                {'error': 'Full Name must contain only letters with single spaces between words.'},
                status=status.HTTP_400_BAD_REQUEST)
    if not last_name and (not partial or 'last_name' in data):
        return Response({'error': 'Last Name is required.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if len(last_name) > 150:
        return Response({'error': 'Last Name is too long.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if not partial or 'last_name' in data:
        _raw_last = data.get('last_name', last_name)
        if not isinstance(_raw_last, str) or not is_valid_last_name(_raw_last):
            return Response(
                {'error': 'Last Name must contain only letters without spaces.'},
                status=status.HTTP_400_BAD_REQUEST)
    if len(company_name) > 150:
        return Response({'error': 'Company / Business Name is too long.'},
                        status=status.HTTP_400_BAD_REQUEST)
    # Same company rule as registration: blank stays valid (optional),
    # otherwise Unicode letters, numbers, spaces and & . - ' only.
    # Checked against the raw submitted value so whitespace-only input
    # is rejected. On PATCH, only validate when a value is supplied.
    if not partial or 'company_name' in data:
        _raw_company = data.get('company_name', company_name)
        if not isinstance(_raw_company, str) or not is_valid_company_name(_raw_company):
            return Response(
                {'error': 'Company Name contains invalid characters.'},
                status=status.HTTP_400_BAD_REQUEST)
    # M1: same rule as registration/login - exactly 10 digits starting
    # with 6/7/8/9 (+91 stays UI-only, never stored). M2 (app-level only,
    # no schema change): another user's number cannot be taken, while
    # keeping your own number is always allowed. On PATCH the stored
    # number is left alone unless a new one is supplied.
    if not partial or 'mobile' in data:
        if not re.fullmatch(r'[6-9]\d{9}', mobile):
            return Response({'error': 'Mobile Number must be 10 digits.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if UserProfile.objects.filter(mobile=mobile).exclude(
                user=user).exists():
            return Response({'error': 'This mobile number cannot be used.'},
                            status=status.HTTP_400_BAD_REQUEST)

    profile, _ = UserProfile.objects.get_or_create(
        user=user, defaults={'full_name': full_name,
                             'company_name': company_name, 'mobile': mobile})
    profile.full_name = full_name
    profile.company_name = company_name
    profile.mobile = mobile
    profile.save()
    # PATCH pre-read the profile for fallbacks, caching the pre-update row
    # on the user - repoint the relation so the response shows saved values.
    user.profile = profile
    # Keep the display names in sync; email is never changed here.
    # Last name uses the built-in User.last_name column (no new column).
    if user.first_name != full_name or user.last_name != last_name:
        user.first_name = full_name
        user.last_name = last_name
        user.save(update_fields=['first_name', 'last_name'])
    return Response({**_own_profile_response(user),
                     'message': 'Profile updated successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """Change password for the logged-in user only.

    Validates the current password, then sets the new one (hashed).
    Returns a fresh token so the user stays logged in.
    """
    user = request.user
    current_password = request.data.get('current_password') or ''
    new_password = request.data.get('new_password') or ''
    confirm_password = request.data.get('confirm_password') or ''

    if not current_password:
        return Response({'error': 'Current Password is required.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if not user.check_password(current_password):
        return Response({'error': 'Current password is incorrect.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if not new_password:
        return Response({'error': 'New Password is required.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if new_password != confirm_password:
        return Response({'error': 'Passwords do not match.'},
                        status=status.HTTP_400_BAD_REQUEST)
    from .validators import password_error as _pw_error
    pw_err = _pw_error(new_password)
    if pw_err:
        return Response({'error': pw_err},
                        status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    # Rotate the token: old sessions stop working, current one continues.
    # M8: same atomic rotation as login so concurrent requests serialize.
    from api.token_rotation import rotate_auth_token
    token = rotate_auth_token(user)
    return Response({'token': token.key,
                     'message': 'Password changed successfully.'})
