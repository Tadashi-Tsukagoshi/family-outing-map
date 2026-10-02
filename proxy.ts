import { NextRequest, NextResponse } from "next/server";

const BLOCKED_USER_AGENTS = [
  "GPTBot",
  "CCBot",
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended",
  "FacebookBot",
  "Bytespider",
  "Applebot-Extended",
  "Amazonbot",
  "Scrapy",
  "python-requests/",
];

const ALLOWED_USER_AGENTS = ["Googlebot", "bingbot"];

export function proxy(request: NextRequest) {
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

  // イベント用の内部ページ（/top-event/〇〇）への外部からの直接アクセスは 404 にする。
  // 下の振り分け（rewrite）で届くアクセスは Proxy を再度通らないため、ここで塞いでも影響しない。
  // 存在しない URL に振り替えて、サイトの「ページが見つかりません」を返す
  if (request.nextUrl.pathname === "/top-event" || request.nextUrl.pathname.startsWith("/top-event/")) {
    return NextResponse.rewrite(new URL("/_not-found-top-event", request.url));
  }

  // トップページに ?event={イベントID} が付いたときだけ、そのイベントの OGP を返す内部ページに振り分ける
  // （アドレスバーの URL は /?event=... のまま。画面はトップページと同じ）。
  // ?event= なしのトップページは静的ページのまま配信し、性能・キャッシュに影響させない
  if (request.nextUrl.pathname === "/") {
    const eventId = request.nextUrl.searchParams.get("event");
    if (eventId) {
      const url = request.nextUrl.clone();
      url.pathname = `/top-event/${encodeURIComponent(eventId)}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!robots.txt|sitemap.xml).*)",
  ],
};
