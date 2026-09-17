# Phase 1 health-check + Phase 2 user authentication views.
# Kept simple for B.Sc. IT student: Token Authentication.

from datetime import datetime
from decimal import Decimal
import logging
import re
from django.contrib.auth import authenticate
from django.db import connection
from django.db.models import Count, Sum
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from .throttles import LoginRateThrottle

logger = logging.getLogger(__name__)


class IsSuperUser(BasePermission):
    """AgriWorks admin = Django is_superuser (not is_staff)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.is_superuser)


def _client_ip(request):
    """Best-effort client IP for the login audit record.

    REMOTE_ADDR only (set by the server/WSGI layer); X-Forwarded-For and
    friends are ignored because the project has no proxy configuration.
    Returns None when missing or malformed so logging never breaks login.
    """
    from django.core.exceptions import ValidationError
    from django.core.validators import validate_ipv46_address
    raw = (request.META.get('REMOTE_ADDR') or '').strip()
    if not raw:
        return None
    try:
        validate_ipv46_address(raw)
    except ValidationError:
        return None
    return raw


# TEMPORARY production diagnostic (login 500 root-cause): redact anything
# that could be personal or secret before it reaches the logs.
_SCRUB_PATTERNS = (
    re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
    re.compile(r'(?<!\d)[6-9]\d{9}(?!\d)'),
    re.compile(r'\b[A-Za-z0-9]{32,}\b'),
)


def _scrubbed(text):
    """Replace emails, 10-digit mobiles and token-like strings."""
    cleaned = str(text or '')
    for pattern in _SCRUB_PATTERNS:
        cleaned = pattern.sub('[redacted]', cleaned)
    return cleaned


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Return backend status. React frontend calls this to verify connection."""
    # Check database connection
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        db_status = 'connected'
    except Exception as exc:
        db_status = f'error: {exc}'

    return Response({
        'project': 'AgriWorks Manager',
        'phase': 2,
        'backend': 'Django + DRF running',
        'database': db_status,
        'message': 'Frontend communicates with backend successfully',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    """Validate credentials and return auth token.

    Auth update: accepts Email OR Username OR Registered Mobile Number in
    the `username` (or `email`) field. Existing username/email logins keep
    working unchanged. Mobile login resolves via UserProfile and then uses
    the exact same password authentication (never mobile alone).
    """
    identifier = ((request.data.get('username')
                   or request.data.get('email') or '').strip())
    password = request.data.get('password') or ''

    # Simple validation: both fields required
    if not identifier or not password:
        return Response(
            {'error': 'Email and password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # TEMPORARY production diagnostic: any unexpected exception below is
    # logged (type + scrubbed message + traceback of code frames only —
    # never request data, credentials, tokens or personal data) and then
    # re-raised so the client still receives the existing generic 500.
    try:
        username = identifier
        if '@' in identifier:
            # Email login: resolve to the account username first. M6: email
            # is not DB-unique, so duplicate/case-variant records raise
            # MultipleObjectsReturned - never 500 and never pick a user
            # arbitrarily; any non-unique lookup gets the generic error.
            try:
                from django.contrib.auth.models import User
                username = User.objects.get(
                    email__iexact=identifier.lower()).username
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                return Response(
                    {'error': 'Invalid email or password.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            # Username or Registered Mobile Number login. An existing username
            # always wins so numeric usernames keep working as before.
            from django.contrib.auth.models import User
            if not User.objects.filter(username=identifier).exists():
                # Mobile fallback: M1 same rule as registration/profile -
                # exactly 10 digits starting with 6/7/8/9. Any other format
                # is never treated as a mobile identifier and simply fails
                # authentication with the generic error below.
                if (identifier.isdigit() and len(identifier) == 10
                        and identifier[0] in '6789'):
                    from accounts.models import UserProfile
                    matches = UserProfile.objects.filter(
                        mobile=identifier).select_related('user')
                    if matches.count() == 1:
                        username = matches[0].user.username
                    else:
                        # Unknown or ambiguously shared number: generic error,
                        # never pick a user arbitrarily.
                        return Response(
                            {'error': 'Invalid email or password.'},
                            status=status.HTTP_401_UNAUTHORIZED,
                        )

        user = authenticate(username=username, password=password)
        if user is None:
            return Response(
                {'error': 'Invalid email or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Single active session per user: invalidate any previous token so that
        # only this login stays valid (same rotate pattern as password change).
        # The authtoken table already holds at most one row per user, so no
        # model/migration change is needed. M8: rotated atomically (row-locked)
        # so concurrent logins serialize instead of colliding with HTTP 500.
        from .token_rotation import rotate_auth_token
        token = rotate_auth_token(user)
        # Immutable audit record (one NEW row per successful login; never
        # updated). M9: client IP from REMOTE_ADDR only (forwarded headers are
        # never trusted - no proxy setup) plus a bounded User-Agent. Both are
        # sanitized so audit logging can never break login or store secrets.
        from accounts.models import LoginHistory
        LoginHistory.objects.create(
            user=user,
            status='Successful',
            ip_address=_client_ip(request),
            user_agent=(request.META.get('HTTP_USER_AGENT') or '')[:255],
        )
        return Response({
            'token': token.key,
            'username': user.username,
            'email': user.email,
            'message': 'Login successful.',
        })
    except Exception as exc:
        logger.exception(
            'AgriWorks login internal error: %s: %s',
            type(exc).__name__, _scrubbed(exc))
        raise


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Delete current token so it cannot be reused."""
    # request.auth is the Token object when TokenAuthentication is used
    if request.auth:
        request.auth.delete()
    return Response({'message': 'Logout successful.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return current logged-in user. Used to verify token + protect routes.

    Auth update: also returns email + profile (full_name, last_name,
    company_name, mobile) so Dashboard/Bills/Reports can reuse the
    business info.
    Legacy accounts without a profile get empty profile fields.
    """
    from accounts.views import profile_dict
    return Response({
        'username': request.user.username,
        'email': request.user.email,
        'is_staff': request.user.is_staff,
        'is_superuser': request.user.is_superuser,
        'profile': profile_dict(request.user),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_view(request):
    """Phase 8: summary from actual DB records (no duplicates).

    Returns totals + recent work/payments/expenses for the logged-in user.
    Pending = Total billed - Total received.
    """
    from billing.models import Bill
    from expenses.models import Expense
    from payments.models import Payment
    from works.models import Work
    from farmers.models import Farmer
    from accounts.views import profile_dict

    user = request.user

    total_works = Work.objects.filter(user=user).count()
    total_farmers = Farmer.objects.filter(user=user).count()
    total_bills = Bill.objects.filter(user=user).count()

    total_income = Bill.objects.filter(user=user).aggregate(
        total=Sum('total_amount'))['total'] or 0
    total_received = Payment.objects.filter(user=user).aggregate(
        total=Sum('amount'))['total'] or 0
    pending = total_income - total_received
    total_expenses = Expense.objects.filter(user=user).aggregate(
        total=Sum('amount'))['total'] or 0

    recent_works = Work.objects.select_related('farmer').filter(
        user=user).order_by('-work_date', '-id')[:5]
    recent_payments = Payment.objects.select_related(
        'bill', 'bill__farmer').filter(user=user).order_by('-payment_date', '-id')[:5]
    recent_expenses = Expense.objects.filter(
        user=user).order_by('-date', '-id')[:5]

    return Response({
        'business': profile_dict(user),
        'totals': {
            'farmers': total_farmers,
            'works': total_works,
            'bills': total_bills,
            'income': str(total_income),
            'received': str(total_received),
            # Zero pending must read "0" on every database: MySQL SUM(decimal)
            # yields Decimal('0.00'). Non-zero values keep their exact
            # decimal representation.
            'pending': '0' if pending == 0 else str(pending),
            'expenses': str(total_expenses),
        },
        'recent_works': [
            {
                'id': w.id,
                'farmer_name': w.farmer.name,
                'work_type': w.work_type,
                'work_date': str(w.work_date),
                'amount': str(w.amount),
            }
            for w in recent_works
        ],
        'recent_payments': [
            {
                'id': p.id,
                'farmer_name': p.bill.farmer.name,
                'bill_id': p.bill_id,
                'payment_date': str(p.payment_date),
                'method': p.method,
                'amount': str(p.amount),
            }
            for p in recent_payments
        ],
        'recent_expenses': [
            {
                'id': e.id,
                'expense_type': e.expense_type,
                'date': str(e.date),
                'amount': str(e.amount),
            }
            for e in recent_expenses
        ],
    })


@api_view(['GET'])
@permission_classes([IsSuperUser])
def admin_overview_view(request):
    """Admin Dashboard statistics across ALL users (superuser only).

    Counts and sums only — no passwords, tokens or sensitive details.
    Only aggregates shown on the Admin Dashboard are computed.
    """
    from django.contrib.auth.models import User
    from support.models import ProblemReport

    total_users = User.objects.count()
    recent_users = User.objects.order_by('-date_joined', '-id')[:5]

    reports = ProblemReport.objects.all()
    recent_reports = ProblemReport.objects.select_related('user').order_by('-created_at', '-id')[:5]

    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        db_status = 'connected'
    except Exception:
        db_status = 'error'

    return Response({
        'totals': {
            'users': total_users,
            'problem_reports': reports.count(),
        },
        'problem_reports': {
            'pending': reports.filter(status='Pending').count(),
            'in_progress': reports.filter(status='In Progress').count(),
            'resolved': reports.filter(status='Resolved').count(),
        },
        'recent_users': [
            {
                'username': u.username,
                'email': u.email,
                'is_superuser': u.is_superuser,
                'date_joined': u.date_joined.date().isoformat() if u.date_joined else '',
            }
            for u in recent_users
        ],
        'recent_reports': [
            {
                'id': r.id,
                'username': r.user.username if r.user_id else '',
                'problem_type': r.problem_type,
                'status': r.status,
                'created_at': r.created_at.date().isoformat() if r.created_at else '',
            }
            for r in recent_reports
        ],
        'system': {'api': 'ok', 'database': db_status},
    })


@api_view(['GET'])
@permission_classes([IsSuperUser])
def admin_login_history_view(request):
    """Login History for the Admin Dashboard (superuser only, newest first).

    Exposes usernames/emails/timestamps plus the audit IP and User-Agent
    - never passwords, hashes, or tokens of any kind. P5: optional
    ?page=&page_size= pagination (defaults preserve the full list).
    """
    from django.utils import timezone
    from accounts.models import LoginHistory

    records = LoginHistory.objects.select_related('user').order_by('-created_at', '-id')
    total = records.count()
    try:
        page = max(int(request.query_params.get('page') or 1), 1)
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.query_params.get('page_size') or 0)
    except (TypeError, ValueError):
        page_size = 0
    paginated = bool(request.query_params.get('page') or request.query_params.get('page_size'))
    if paginated:
        page_size = min(max(page_size or 50, 1), 500)
        records = records[(page - 1) * page_size:page * page_size]
    items = []
    for h in records:
        logged_at = timezone.localtime(h.created_at) if h.created_at else None
        items.append({
            'id': h.id,
            'username': h.user.username if h.user_id else '',
            'email': h.user.email if h.user_id else '',
            'is_superuser': h.user.is_superuser if h.user_id else False,
            'login_date': logged_at.strftime('%d %b %Y') if logged_at else '',
            'login_time': logged_at.strftime('%I:%M %p') if logged_at else '',
            'status': h.status,
            'ip_address': h.ip_address or '',
            'user_agent': h.user_agent or '',
        })
    if paginated:
        return Response({'count': total, 'page': page,
                         'page_size': page_size, 'results': items})
    return Response(items)


def _parse_date(value):
    """Parse YYYY-MM-DD or return None (for report filters)."""
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except Exception:
        return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reports_view(request):
    """Phase 9: 6 reports from actual DB records with filters.

    Query params:
      type: work | billing | payment | pending | expense | performance
      farmer: farmer id, status: bill status, work_type, expense_type, method
      from: YYYY-MM-DD, to: YYYY-MM-DD, search: text
    """
    from billing.models import Bill
    from expenses.models import Expense
    from payments.models import Payment
    from works.models import Work

    user = request.user
    rtype = (request.query_params.get('type') or 'work').strip()
    # P9: unknown report types must not silently serve the wrong report.
    if rtype not in ('work', 'billing', 'payment', 'pending', 'expense',
                     'performance'):
        return Response({'error': 'Invalid report type.'},
                        status=status.HTTP_400_BAD_REQUEST)
    farmer_id = (request.query_params.get('farmer') or '').strip()
    # P9: malformed farmer id fails loudly instead of listing everything.
    if farmer_id and not farmer_id.isdigit():
        return Response({'error': 'Invalid farmer filter.'},
                        status=status.HTTP_400_BAD_REQUEST)
    status_f = (request.query_params.get('status') or '').strip()
    work_type = (request.query_params.get('work_type') or '').strip()
    expense_type = (request.query_params.get('expense_type') or '').strip()
    method = (request.query_params.get('method') or '').strip()
    search = (request.query_params.get('search') or '').strip()
    date_from = _parse_date(request.query_params.get('from') or '')
    date_to = _parse_date(request.query_params.get('to') or '')

    def farmer_filter(qs, field='farmer_id'):
        if farmer_id.isdigit():
            qs = qs.filter(**{field: int(farmer_id)})
        return qs

    if rtype == 'work':
        qs = Work.objects.select_related('farmer').filter(user=user)
        qs = farmer_filter(qs)
        if work_type:
            qs = qs.filter(work_type=work_type)
        if date_from:
            qs = qs.filter(work_date__gte=date_from)
        if date_to:
            qs = qs.filter(work_date__lte=date_to)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(work_type__icontains=search)
                | Q(farmer__name__icontains=search)
                | Q(farmer__village__icontains=search)
            )
        qs = qs.order_by('-work_date', '-id')
        agg = qs.aggregate(area=Sum('area'), amount=Sum('amount'))
        return Response({
            'type': 'work',
            'records': [
                {'id': w.id, 'farmer': w.farmer.name, 'village': w.farmer.village,
                 'work_type': w.work_type, 'date': str(w.work_date),
                 'field_location': w.field_location or '',
                 'remark': w.remark or '',
                 'work_description': w.work_description or '',
                 'area': str(w.area) if w.area is not None else '', 'amount': str(w.amount),
                 'hours': w.irrigation_hours if w.irrigation_hours is not None else '',
                 'minutes': w.irrigation_minutes if w.irrigation_minutes is not None else '',
                 'hourly_rate': str(w.hourly_rate) if w.hourly_rate is not None else '',
                 'rate_per_acre': str(w.rate_per_acre) if w.rate_per_acre is not None else ''}
                for w in qs
            ],
            'summary': {'count': qs.count(),
                        'total_area': str(agg['area'] or 0),
                        'total_amount': str(agg['amount'] or 0)},
        })

    if rtype == 'billing':
        qs = Bill.objects.select_related('farmer', 'work').filter(user=user)
        qs = farmer_filter(qs)
        if status_f in ('Unpaid', 'Partial', 'Paid'):
            qs = qs.filter(status=status_f)
        if date_from:
            qs = qs.filter(bill_date__gte=date_from)
        if date_to:
            qs = qs.filter(bill_date__lte=date_to)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(farmer__name__icontains=search)
                | Q(work__work_type__icontains=search)
            )
        qs = qs.order_by('-bill_date', '-id')
        # P5: one aggregate query for all paid sums instead of one per
        # bill (N+1). Same numbers, same response shape.
        bills = list(qs.annotate(paid_sum=Sum('payments__amount')))
        total = sum((b.total_amount for b in bills), Decimal('0'))
        paid = sum((b.paid_sum or Decimal('0') for b in bills),
                   Decimal('0'))
        return Response({
            'type': 'billing',
            'records': [
                {'id': b.id, 'farmer': b.farmer.name, 'work': b.work.work_type,
                 'bill_date': str(b.bill_date), 'total': str(b.total_amount),
                 'paid': str(b.paid_sum or Decimal('0')),
                 'pending': str(b.total_amount - (b.paid_sum or Decimal('0'))),
                 'status': b.status}
                for b in bills
            ],
            'summary': {'count': len(bills), 'total': str(total),
                        'paid': str(paid), 'pending': str(total - paid)},
        })

    if rtype == 'payment':
        qs = Payment.objects.select_related('bill', 'bill__farmer', 'bill__work').filter(user=user)
        if farmer_id.isdigit():
            qs = qs.filter(bill__farmer_id=int(farmer_id))
        if method:
            qs = qs.filter(method=method)
        if date_from:
            qs = qs.filter(payment_date__gte=date_from)
        if date_to:
            qs = qs.filter(payment_date__lte=date_to)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(bill__farmer__name__icontains=search)
                | Q(method__icontains=search)
            )
        qs = qs.order_by('-payment_date', '-id')
        agg = qs.aggregate(total=Sum('amount'))
        return Response({
            'type': 'payment',
            'records': [
                {'id': p.id, 'farmer': p.bill.farmer.name, 'bill_id': p.bill_id,
                 'work_type': p.bill.work.work_type,
                 'date': str(p.payment_date), 'method': p.method, 'amount': str(p.amount)}
                for p in qs
            ],
            'summary': {'count': qs.count(), 'total': str(agg['total'] or 0)},
        })

    if rtype == 'pending':
        qs = Bill.objects.select_related('farmer', 'work').filter(user=user)
        qs = farmer_filter(qs)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(farmer__name__icontains=search)
                | Q(farmer__mobile__icontains=search)
            )
        # P5: same single-query annotation as the billing branch.
        bills = list(qs.annotate(paid_sum=Sum('payments__amount')))
        for b in bills:
            b.pending_amt = b.total_amount - (b.paid_sum or Decimal('0'))
        pending_bills = [b for b in bills if b.pending_amt > 0]
        pending_bills.sort(key=lambda b: (str(b.bill_date), b.id), reverse=True)
        total_pending = sum((b.pending_amt for b in pending_bills), Decimal('0'))
        return Response({
            'type': 'pending',
            'records': [
                {'id': b.id, 'farmer': b.farmer.name, 'mobile': b.farmer.mobile,
                 'village': b.farmer.village, 'bill_date': str(b.bill_date),
                 'work_type': b.work.work_type,
                 'total': str(b.total_amount),
                 'paid': str(b.paid_sum or Decimal('0')),
                 'pending': str(b.pending_amt), 'status': b.status}
                for b in pending_bills
            ],
            'summary': {'count': len(pending_bills), 'total_pending': str(total_pending)},
        })

    if rtype == 'expense':
        qs = Expense.objects.filter(user=user)
        if expense_type:
            qs = qs.filter(expense_type=expense_type)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(expense_type__icontains=search)
                | Q(description__icontains=search)
            )
        qs = qs.order_by('-date', '-id')
        agg = qs.aggregate(total=Sum('amount'))
        return Response({
            'type': 'expense',
            'records': [
                {'id': e.id, 'expense_type': e.expense_type, 'date': str(e.date),
                 'amount': str(e.amount), 'description': e.description}
                for e in qs
            ],
            'summary': {'count': qs.count(), 'total': str(agg['total'] or 0)},
        })

    # performance (default for unknown type): business summary + breakdowns
    works = Work.objects.filter(user=user)
    bills = Bill.objects.filter(user=user)
    payments = Payment.objects.filter(user=user)
    expenses = Expense.objects.filter(user=user)
    if farmer_id.isdigit():
        works = works.filter(farmer_id=int(farmer_id))
        bills = bills.filter(farmer_id=int(farmer_id))
        payments = payments.filter(bill__farmer_id=int(farmer_id))
    if date_from:
        works = works.filter(work_date__gte=date_from)
        bills = bills.filter(bill_date__gte=date_from)
        payments = payments.filter(payment_date__gte=date_from)
        expenses = expenses.filter(date__gte=date_from)
    if date_to:
        works = works.filter(work_date__lte=date_to)
        bills = bills.filter(bill_date__lte=date_to)
        payments = payments.filter(payment_date__lte=date_to)
        expenses = expenses.filter(date__lte=date_to)

    income = bills.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
    received = payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    exp_total = expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    by_work = list(works.values('work_type').annotate(
        count=Count('id'), amount=Sum('amount')).order_by('-amount'))
    by_expense = list(expenses.values('expense_type').annotate(
        count=Count('id'), amount=Sum('amount')).order_by('-amount'))
    return Response({
        'type': 'performance',
        'records': [],
        'summary': {
            'income': str(income), 'received': str(received),
            'pending': str(income - received), 'expenses': str(exp_total),
            'profit_cash': str(received - exp_total),
            'profit_billed': str(income - exp_total),
            'counts': {'works': works.count(), 'bills': bills.count(),
                       'payments': payments.count(), 'expenses': expenses.count()},
            'by_work_type': [{'work_type': r['work_type'], 'count': r['count'],
                              'amount': str(r['amount'] or 0)} for r in by_work],
            'by_expense_type': [{'expense_type': r['expense_type'], 'count': r['count'],
                                 'amount': str(r['amount'] or 0)} for r in by_expense],
        },
    })
