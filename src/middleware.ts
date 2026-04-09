import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Never intercept the login page or API routes
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/api/admin/') ||
    !pathname.startsWith('/admin')
  ) return NextResponse.next()

  // Check admin token
  const token = req.cookies.get('admin_token')?.value
  if (!token || token !== process.env.ADMIN_SECRET_TOKEN) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*'] }
