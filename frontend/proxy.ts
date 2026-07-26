import { NextRequest, NextResponse } from 'next/server';

// Next.js 16 renamed Middleware to "Proxy" (same functionality). This runs on
// every matched request and performs an OPTIMISTIC auth check only: if the
// httpOnly session cookie is absent on a protected route, redirect to /login
// before the page renders. Real authorization is still enforced server-side by
// the API (JWT verification + role checks); per the Next.js auth guide, Proxy
// should only read the cookie, never do database or session-validation work.
const PROTECTED_PREFIXES = ['/dashboard'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  // httpOnly cookies are still sent to the server, so the proxy can read the
  // session even though page JavaScript cannot.
  const hasSession = Boolean(request.cookies.get('token')?.value);
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
