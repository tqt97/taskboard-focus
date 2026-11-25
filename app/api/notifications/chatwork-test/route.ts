import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const chatworkEndpoint = "https://api.chatwork.com/v2/rooms";

export async function POST(request: Request) {
  const token = process.env.CHATWORK_API_TOKEN?.trim();
  const configuredRoomId = process.env.CHATWORK_ROOM_ID?.trim() || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerId = process.env.TASKBOARD_OWNER_ID;
  if (
    !token ||
    !configuredRoomId ||
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !ownerId
  ) {
    return NextResponse.json(
      {
        error:
          "Chatwork test cần cấu hình token, room, Supabase Auth và owner trên server.",
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Đăng nhập owner để gửi thông báo test." },
      { status: 401 },
    );
  }
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(
    authorization.slice("Bearer ".length).trim(),
  );
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Phiên đăng nhập không hợp lệ." },
      { status: 401 },
    );
  }
  if (authData.user.id !== ownerId) {
    return NextResponse.json(
      { error: "Chỉ owner được gửi thông báo test." },
      { status: 403 },
    );
  }

  let body: { roomId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
  }

  const requestedRoomId =
    typeof body.roomId === "string" && body.roomId.trim()
      ? body.roomId.trim()
      : configuredRoomId;
  if (!configuredRoomId) {
    return NextResponse.json(
      { error: "CHATWORK_ROOM_ID chưa được cấu hình trên server." },
      { status: 503 },
    );
  }
  if (requestedRoomId !== configuredRoomId) {
    return NextResponse.json(
      { error: "Room ID không khớp Room ID đã cấu hình trên server." },
      { status: 403 },
    );
  }
  const roomId = configuredRoomId;
  if (!/^\d+$/.test(roomId)) {
    return NextResponse.json(
      { error: "Room ID phải là chuỗi số hợp lệ." },
      { status: 400 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: allowed, error: rateLimitError } = await admin.rpc(
    "claim_notification_test",
    { p_owner_id: ownerId, p_cooldown_seconds: 60 },
  );
  if (rateLimitError) {
    return NextResponse.json(
      {
        error:
          "Không kiểm tra được giới hạn gửi. Hãy áp dụng schema Supabase mới nhất.",
      },
      { status: 503 },
    );
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "Vui lòng đợi 60 giây trước khi gửi thông báo test tiếp theo." },
      { status: 429 },
    );
  }

  const form = new URLSearchParams({
    body: `[Taskboard Focus] Thông báo test thành công · ${new Date().toLocaleString("vi-VN")}`,
    self_unread: "1",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${chatworkEndpoint}/${roomId}/messages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "x-chatworktoken": token,
      },
      body: form,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Chatwork từ chối request (HTTP ${response.status}).` },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const result = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, messageId: result.message_id || null });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Chatwork phản hồi quá lâu; vui lòng thử lại." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Không kết nối được Chatwork từ server." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
