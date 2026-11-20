import { NextResponse } from "next/server";

const chatworkEndpoint = "https://api.chatwork.com/v2/rooms";

export async function POST(request: Request) {
  const token = process.env.CHATWORK_API_TOKEN?.trim();
  const configuredRoomId = process.env.CHATWORK_ROOM_ID?.trim() || "";
  if (!token) {
    return NextResponse.json(
      { error: "CHATWORK_API_TOKEN chưa được cấu hình trên server." },
      { status: 503 },
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
