import { rewrite } from '@vercel/functions';

const HARDENED_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
};

const SOURCE_ONLY_PREFIXES = [
  '/server/',
  '/tests/',
  '/docs/',
  '/apps-script/',
  '/supabase/',
  '/.github/',
];

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: HARDENED_HEADERS,
  });
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/server/:path*',
    '/tests/:path*',
    '/docs/:path*',
    '/apps-script/:path*',
    '/supabase/:path*',
    '/.github/:path*',
  ],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (SOURCE_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return notFound();
  }

  if (pathname === '/admin' || pathname === '/admin/') {
    return rewrite(new URL('/admin-login.html', request.url));
  }

  if (pathname === '/admin/app' || pathname === '/admin/app/') {
    const destination = new URL('/api/kk-admin-snapshot-v6', request.url);
    destination.searchParams.set('__kk_gate', 'app');
    return rewrite(destination);
  }

  if (pathname.startsWith('/admin/')) {
    const relativePath = pathname.slice('/admin/'.length);
    if (!relativePath) {
      return rewrite(new URL('/admin-login.html', request.url));
    }
    const destination = new URL('/api/kk-admin-snapshot-v6', request.url);
    destination.searchParams.set('__kk_gate', 'asset');
    destination.searchParams.set('path', relativePath);
    return rewrite(destination);
  }

  return notFound();
}
