import { NextResponse } from 'next/server';

// Middleware deshabilitado - sin autenticación requerida
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
