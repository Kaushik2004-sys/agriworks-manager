"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/', include('accounts.urls')),
    path('api/', include('farmers.urls')),
    path('api/', include('works.urls')),
    path('api/', include('billing.urls')),
    path('api/', include('payments.urls')),
    path('api/', include('expenses.urls')),
    path('api/', include('support.urls')),
]

# Uploaded files are served by Django only in DEBUG (local use).
# Production deployments need separate media serving for MEDIA_ROOT.
# P3: problem screenshots are NEVER served anonymously - they are only
# available through the authenticated problem-screenshots API view, so
# the DEBUG static route explicitly excludes that directory.
from django.conf import settings

if settings.DEBUG:
    from django.urls import re_path
    from django.views.static import serve

    urlpatterns += [
        re_path(r'^media/(?!problem_screenshots/)(?P<path>.*)$', serve,
                {'document_root': settings.MEDIA_ROOT}),
    ]
