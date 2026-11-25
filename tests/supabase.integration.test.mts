import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const env = {
  url: process.env.TASKBOARD_TEST_SUPABASE_URL,
  anonKey: process.env.TASKBOARD_TEST_SUPABASE_ANON_KEY,
  ownerEmail: process.env.TASKBOARD_TEST_OWNER_EMAIL,
  ownerPassword: process.env.TASKBOARD_TEST_OWNER_PASSWORD,
  memberEmail: process.env.TASKBOARD_TEST_MEMBER_EMAIL,
  memberPassword: process.env.TASKBOARD_TEST_MEMBER_PASSWORD,
  viewerEmail: process.env.TASKBOARD_TEST_VIEWER_EMAIL,
  viewerPassword: process.env.TASKBOARD_TEST_VIEWER_PASSWORD,
};
const enabled = Object.values(env).every(Boolean);

test(
  "Supabase workspace roles isolate viewer writes and allow shared member CRUD",
  {
    skip: !enabled ? "Set TASKBOARD_TEST_* credentials to run integration test" : false,
  },
  async () => {
    const owner = createClient(env.url!, env.anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const member = createClient(env.url!, env.anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const viewer = createClient(env.url!, env.anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const ownerAuth = await owner.auth.signInWithPassword({
      email: env.ownerEmail!,
      password: env.ownerPassword!,
    });
    const memberAuth = await member.auth.signInWithPassword({
      email: env.memberEmail!,
      password: env.memberPassword!,
    });
    const viewerAuth = await viewer.auth.signInWithPassword({
      email: env.viewerEmail!,
      password: env.viewerPassword!,
    });
    if (ownerAuth.error || !ownerAuth.data.user) throw ownerAuth.error;
    if (memberAuth.error || !memberAuth.data.user) throw memberAuth.error;
    if (viewerAuth.error || !viewerAuth.data.user) throw viewerAuth.error;

    let workspaceId = "";
    let secondWorkspaceId = "";
    let taskId = "";
    let attachmentPath = "";
    try {
      const workspace = await owner
        .from("workspaces")
        .insert({ name: `integration-${Date.now()}`, owner_id: ownerAuth.data.user.id })
        .select("id")
        .single();
      if (workspace.error || !workspace.data) throw workspace.error;
      workspaceId = workspace.data.id;
      const memberships = await owner.from("workspace_members").upsert([
        { workspace_id: workspaceId, user_id: ownerAuth.data.user.id, role: "owner" },
        { workspace_id: workspaceId, user_id: memberAuth.data.user.id, role: "member" },
        { workspace_id: workspaceId, user_id: viewerAuth.data.user.id, role: "viewer" },
      ]);
      if (memberships.error) throw memberships.error;

      attachmentPath = `${workspaceId}/integration-${Date.now()}.txt`;
      const uploaded = await owner.storage
        .from("taskboard-attachments")
        .upload(
          attachmentPath,
          new Blob(["Taskboard integration attachment"], { type: "text/plain" }),
          { contentType: "text/plain", upsert: false },
        );
      if (uploaded.error) throw uploaded.error;
      const signed = await owner.storage
        .from("taskboard-attachments")
        .createSignedUrl(attachmentPath, 60);
      if (signed.error || !signed.data?.signedUrl) throw signed.error;

      const created = await owner
        .from("tasks")
        .insert({
          workspace_id: workspaceId,
          owner_id: ownerAuth.data.user.id,
          code: "INTEGRATION-1",
          title: "Shared task",
          description: "",
          status: "todo",
          priority: "medium",
          severity: "medium",
          next_action: "",
          review_note: "",
          blocked_by: [],
          activity: [],
          primary_links: [],
          secondary_links: [],
          links: [],
        })
        .select("id, owner_id")
        .single();
      if (created.error || !created.data) throw created.error;
      taskId = created.data.id;

      const memberRead = await member
        .from("tasks")
        .select("id, owner_id")
        .eq("workspace_id", workspaceId)
        .eq("id", taskId)
        .single();
      if (memberRead.error || !memberRead.data) throw memberRead.error;
      assert.equal(memberRead.data.owner_id, ownerAuth.data.user.id);

      const memberUpdate = await member
        .from("tasks")
        .update({ title: "Edited by member" })
        .eq("workspace_id", workspaceId)
        .eq("id", taskId)
        .select("id, owner_id, title")
        .single();
      if (memberUpdate.error || !memberUpdate.data) throw memberUpdate.error;
      assert.equal(memberUpdate.data.owner_id, ownerAuth.data.user.id);
      assert.equal(memberUpdate.data.title, "Edited by member");

      const memberCatalogEntry = await owner
        .from("members")
        .insert({
          workspace_id: workspaceId,
          owner_id: ownerAuth.data.user.id,
          name: "Owner catalog entry",
          role: "Developer",
          color: "blue",
        })
        .select("id")
        .single();
      if (memberCatalogEntry.error || !memberCatalogEntry.data)
        throw memberCatalogEntry.error;
      const memberCatalogUpdate = await member
        .from("members")
        .update({ name: "Member must not manage catalog" })
        .eq("id", memberCatalogEntry.data.id)
        .select("id")
        .maybeSingle();
      assert.ok(
        memberCatalogUpdate.error || !memberCatalogUpdate.data,
        "workspace member should not mutate the member catalog",
      );

      const viewerRead = await viewer
        .from("tasks")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("id", taskId)
        .single();
      if (viewerRead.error || !viewerRead.data) throw viewerRead.error;
      const viewerUpdate = await viewer
        .from("tasks")
        .update({ title: "Viewer must not write" })
        .eq("workspace_id", workspaceId)
        .eq("id", taskId)
        .select("id")
        .maybeSingle();
      assert.ok(viewerUpdate.error || !viewerUpdate.data);

      const secondWorkspace = await owner
        .from("workspaces")
        .insert({ name: `integration-isolation-${Date.now()}` })
        .select("id")
        .single();
      if (secondWorkspace.error || !secondWorkspace.data) throw secondWorkspace.error;
      secondWorkspaceId = secondWorkspace.data.id;
      const foreignMember = await owner
        .from("members")
        .insert({
          workspace_id: secondWorkspaceId,
          owner_id: ownerAuth.data.user.id,
          name: "Foreign member",
          role: "Developer",
          color: "blue",
        })
        .select("id")
        .single();
      if (foreignMember.error || !foreignMember.data) throw foreignMember.error;
      const crossWorkspaceAssignment = await owner
        .from("task_assignees")
        .insert({ task_id: taskId, member_id: foreignMember.data.id });
      assert.ok(
        crossWorkspaceAssignment.error,
        "cross-workspace assignment should be rejected",
      );
    } finally {
      if (attachmentPath)
        await owner.storage.from("taskboard-attachments").remove([attachmentPath]);
      if (secondWorkspaceId)
        await owner.from("workspaces").delete().eq("id", secondWorkspaceId);
      if (workspaceId) await owner.from("workspaces").delete().eq("id", workspaceId);
      await Promise.all([
        owner.auth.signOut(),
        member.auth.signOut(),
        viewer.auth.signOut(),
      ]);
    }
  },
);
