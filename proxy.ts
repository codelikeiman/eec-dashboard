import { NextResponse, type NextRequest } from "next/server";

// Next 16's name for middleware. Visitors without a session cookie go straight
// to the login page. This is only a convenience: the API checks every request.
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || request.cookies.has("eec_rt")) return NextResponse.next();
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next internals, the API proxy, files (icons, images, …) and the
  // link-preview images, which crawlers fetch without a session.
  matcher: "/((?!api|_next|opengraph-image|twitter-image|.*\\..*).*)",
};
