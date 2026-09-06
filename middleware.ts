import { NextRequest, NextResponse } from "next/server";

const BLOCKED_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "CCBot",
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended",
  "FacebookBot",
  "Bytespider",
  "Applebot-Extended",
  "PerplexityBot",
  "Amazonbot",
  "Scrapy",
  "python-requests/",
];

const ALLOWED_USER_AGENTS = ["Googlebot", "bingbot"];

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";

  const isAllowed = ALLOWED_USER_AGENTS.some((ua) =>
    userAgent.toLowerCase().includes(ua.toLowerCase())
  );

  if (!isAllowed) {
    const isBlocked = BLOCKED_USER_AGENTS.some((ua) =>
      userAgent.toLowerCase().includes(ua.toLowerCase())
    );

    if (isBlocked) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!robots.txt|sitemap.xml).*)",
  ],
};
