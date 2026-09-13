# Auth update: register + password-reset endpoints.
# Profile Management: view/update own profile + change password.
# Existing login/logout in api/views.py are preserved (login extended for email).
import re
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import UserProfile
from .serializers import RegisterSerializer

token_generator = PasswordResetTokenGenerator()


def profile_dict(user):
    """Company/business info for Dashboard, Bills, Reports reuse."""
    try:
        p = user.profile
        return {'full_name': p.full_name, 'company_name': p.company_name,
                'mobile': p.mobile}
    except Exception:
        return {'full_name': user.first_name or '',
                'company_name': '', 'mobile': ''}


@api_view(['POST'])
@permission_classes([AllowAny])
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
def password_reset_request_view(request):
    """Step 1: user submits email; backend emails a reset link.

    The reset link/token is ONLY sent to the registered email address and is
    NEVER included in the API response, console output for the website, or UI.
    Unknown emails get an error (no token is generated, no email is sent).
    Email-service config still required for production (see .env.example):
      EMAIL_BACKEND=smtp, EMAIL_HOST/PORT/USER/PASSWORD, DEFAULT_FROM_EMAIL.
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
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({'error': 'No account found with this email address.'},
                        status=status.HTTP_404_NOT_FOUND)

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)
    frontend = getattr(settings, 'FRONTEND_URL',
                       'http://localhost:5173').rstrip('/')
    reset_link = f'{frontend}/reset-password?uid={uid}&token={token}'

    subject = 'AgriWorks Manager - Password Reset'
    body = (f'Hello {user.first_name or user.username},\n\n'
            f'Reset your password using this link:\n{reset_link}\n\n'
            f'If you did not request this, please ignore this email.')
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email],
                  fail_silently=False)
    except Exception:
        return Response(
            {'error': 'Could not send the reset email. '
                      'Please try again later.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'message': 'Password reset link has been sent '
                                'to your registered email address.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm_view(request):
    """Step 2: set a new password using the uid/token from the reset link."""
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


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """View or update ONLY the logged-in user's own profile.

    GET returns Full Name, Company/Business Name, Email (read-only), Mobile.
    PUT accepts full_name (required), company_name (optional),
    mobile (10 digits). Any `email` sent is ignored - it stays read-only.
    """
    user = request.user
    if request.method == 'GET':
        return Response(_own_profile_response(user))

    full_name = (request.data.get('full_name') or '').strip()
    company_name = (request.data.get('company_name') or '').strip()
    mobile = (request.data.get('mobile') or '').strip()

    if not full_name:
        return Response({'error': 'Full Name is required.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if len(full_name) > 150:
        return Response({'error': 'Full Name is too long.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if len(company_name) > 150:
        return Response({'error': 'Company / Business Name is too long.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if not re.fullmatch(r'\d{10}', mobile):
        return Response({'error': 'Mobile Number must be 10 digits.'},
                        status=status.HTTP_400_BAD_REQUEST)

    profile, _ = UserProfile.objects.get_or_create(
        user=user, defaults={'full_name': full_name,
                             'company_name': company_name, 'mobile': mobile})
    profile.full_name = full_name
    profile.company_name = company_name
    profile.mobile = mobile
    profile.save()
    # Keep the display name in sync; email is never changed here.
    if user.first_name != full_name:
        user.first_name = full_name
        user.save(update_fields=['first_name'])
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
    Token.objects.filter(user=user).delete()
    token = Token.objects.create(user=user)
    return Response({'token': token.key,
                     'message': 'Password changed successfully.'})
