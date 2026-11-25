import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const roles = new Set(["admin", "member", "viewer"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase Auth/Admin chưa được cấu hình trên server." },
      { status: 503 },
    );
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Thiếu phiên đăng nhập." }, { status: 401 });
  }
  const token = authorization.slice("Bearer ".length).trim();
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Phiên đăng nhập không hợp lệ." },
      { status: 401 },
    );
  }
  let body: { workspaceId?: unknown; email?: unknown; role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Body request không phải JSON hợp lệ." },
      { status: 400 },
    );
  }
  const workspaceId =
    typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "member";
  if (
    !uuidPattern.test(workspaceId) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !roles.has(role)
  ) {
    return NextResponse.json(
      { error: "Workspace, email hoặc role không hợp lệ." },
      { status: 400 },
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 });
  }
  if (!workspace) {
    return NextResponse.json({ error: "Không tìm thấy workspace." }, { status: 404 });
  }
  const { data: membership } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const callerRole =
    workspace.owner_id === authData.user.id ? "owner" : membership?.role || "";
  if (callerRole !== "owner" && callerRole !== "admin") {
    return NextResponse.json(
      { error: "Bạn không có quyền mời thành viên." },
      { status: 403 },
    );
  }
  const { data: invitation, error: invitationError } =
    await admin.auth.admin.inviteUserByEmail(email);
  if (invitationError || !invitation.user) {
    return NextResponse.json(
      { error: invitationError?.message || "Không thể gửi lời mời." },
      { status: 400 },
    );
  }
  const { error: memberError } = await admin.from("workspace_members").upsert({
    workspace_id: workspaceId,
    user_id: invitation.user.id,
    role,
  });
  if (memberError) {
    return NextResponse.json(
      { error: `Đã mời email nhưng không thể gán role: ${memberError.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, user_id: invitation.user.id, email, role });
}
