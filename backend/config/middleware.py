# Prevent browsers/proxies from caching protected API responses, so
# Back/forward navigation always revalidates instead of rendering stale
# user-specific data. Authentication/authorization itself is unchanged.
class APINoCacheMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/'):
            response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response['Pragma'] = 'no-cache'
        return response
