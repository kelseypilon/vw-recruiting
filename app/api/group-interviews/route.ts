import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/group-interviews
 *
 * Actions:
 *   create_session   { team_id, title, session_date?, zoom_link?, created_by?, candidate_ids[] }
 *   list_sessions    { team_id }
 *   get_session      { session_id }
 *   update_session   { session_id, title?, session_date?, zoom_link?, summary?, general_notes? }
 *   save_note        { session_id, candidate_id, author_user_id, team_id, note_text, mentioned_ids? }
 *   add_candidate    { session_id, candidate_id }
 *   remove_candidate { session_id, candidate_id }
 *   list_prompts     { team_id }
 *   create_prompt    { team_id, prompt_text, order_index? }
 *   update_prompt    { prompt_id, prompt_text?, order_index?, is_active? }
 *   delete_prompt    { prompt_id }
 *   reorder_prompts  { team_id, ordered_ids[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();
    const { action, payload } = body;

    /* ── create_session ──────────────────────────────────────────── */
    if (action === "create_session") {
      const { team_id, title, session_date, zoom_link, created_by, candidate_ids } =
        payload ?? {};
      if (!team_id || !title) {
        return NextResponse.json(
          { error: "team_id and title are required" },
          { status: 400 }
        );
      }

      const { data: session, error: sessErr } = await supabase
        .from("group_interview_sessions")
        .insert({
          team_id,
          title,
          session_date: session_date || null,
          zoom_link: zoom_link || null,
          created_by: created_by || null,
        })
        .select()
        .single();

      if (sessErr)
        return NextResponse.json({ error: sessErr.message }, { status: 500 });

      // Link candidates
      if (Array.isArray(candidate_ids) && candidate_ids.length > 0) {
        const links = candidate_ids.map((cid: string) => ({
          session_id: session.id,
          candidate_id: cid,
        }));
        const { error: linkErr } = await supabase
          .from("group_interview_candidates")
          .insert(links);

        if (linkErr)
          return NextResponse.json(
            { error: linkErr.message },
            { status: 500 }
          );
      }

      return NextResponse.json({ data: session });
    }

    /* ── list_sessions ───────────────────────────────────────────── */
    if (action === "list_sessions") {
      const { team_id } = payload ?? {};
      if (!team_id) {
        return NextResponse.json(
          { error: "team_id is required" },
          { status: 400 }
        );
      }

      const { data: sessions, error } = await supabase
        .from("group_interview_sessions")
        .select("*, creator:users!group_interview_sessions_created_by_fkey(name)")
        .eq("team_id", team_id)
        .order("created_at", { ascending: false });

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      // Get candidate counts
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);
        const { data: links } = await supabase
          .from("group_interview_candidates")
          .select("session_id, candidate_id")
          .in("session_id", sessionIds);

        const countMap: Record<string, number> = {};
        for (const link of links ?? []) {
          countMap[link.session_id] = (countMap[link.session_id] || 0) + 1;
        }
        for (const s of sessions) {
          (s as Record<string, unknown>)._candidate_count =
            countMap[s.id] || 0;
        }
      }

      return NextResponse.json({ data: sessions ?? [] });
    }

    /* ── get_session ─────────────────────────────────────────────── */
    if (action === "get_session") {
      const { session_id } = payload ?? {};
      if (!session_id) {
        return NextResponse.json(
          { error: "session_id is required" },
          { status: 400 }
        );
      }

      // Get session
      const { data: session, error: sessErr } = await supabase
        .from("group_interview_sessions")
        .select("*, creator:users!group_interview_sessions_created_by_fkey(name)")
        .eq("id", session_id)
        .single();

      if (sessErr)
        return NextResponse.json(
          { error: sessErr.message },
          { status: 500 }
        );

      // Get linked candidates (expanded fields for quick-view)
      const { data: links } = await supabase
        .from("group_interview_candidates")
        .select("candidate_id, candidate:candidates(id, first_name, last_name, stage, role_applied, email, phone, current_brokerage, years_experience, is_licensed)")
        .eq("session_id", session_id);

      const candidates = (links ?? []).map(
        (l) => (l as unknown as { candidate: unknown }).candidate
      );

      // Get notes
      const { data: notes } = await supabase
        .from("group_interview_notes")
        .select("*, author:users(name)")
        .eq("session_id", session_id)
        .order("updated_at", { ascending: false });

      return NextResponse.json({
        data: {
          ...session,
          candidates,
          notes: notes ?? [],
        },
      });
    }

    /* ── update_session ──────────────────────────────────────────── */
    if (action === "update_session") {
      const { session_id, ...fields } = payload ?? {};
      if (!session_id) {
        return NextResponse.json(
          { error: "session_id is required" },
          { status: 400 }
        );
      }

      const allowedFields = ["title", "session_date", "zoom_link", "summary", "general_notes", "status"];
      const updateData: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in fields) updateData[key] = fields[key];
      }

      const { data, error } = await supabase
        .from("group_interview_sessions")
        .update(updateData)
        .eq("id", session_id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data });
    }

    /* ── save_note ───────────────────────────────────────────────── */
    if (action === "save_note") {
      const {
        session_id,
        candidate_id,
        author_user_id,
        team_id,
        note_text,
        mentioned_ids,
      } = payload ?? {};

      if (!session_id || !candidate_id || !author_user_id || !team_id) {
        return NextResponse.json(
          {
            error:
              "session_id, candidate_id, author_user_id, and team_id are required",
          },
          { status: 400 }
        );
      }

      // Check if note already exists for this author + session + candidate
      const { data: existing } = await supabase
        .from("group_interview_notes")
        .select("id")
        .eq("session_id", session_id)
        .eq("candidate_id", candidate_id)
        .eq("author_user_id", author_user_id)
        .maybeSingle();

      let data;
      let error;

      if (existing) {
        // Update existing note
        ({ data, error } = await supabase
          .from("group_interview_notes")
          .update({
            note_text: note_text ?? "",
            mentioned_ids: mentioned_ids ?? [],
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*, author:users(name)")
          .single());
      } else {
        // Create new note
        ({ data, error } = await supabase
          .from("group_interview_notes")
          .insert({
            session_id,
            candidate_id,
            author_user_id,
            team_id,
            note_text: note_text ?? "",
            mentioned_ids: mentioned_ids ?? [],
          })
          .select("*, author:users(name)")
          .single());
      }

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data });
    }

    /* ── list_team_candidates ─────────────────────────────────────── */
    if (action === "list_team_candidates") {
      const { team_id } = payload ?? {};
      if (!team_id) {
        return NextResponse.json(
          { error: "team_id is required" },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, stage, role_applied")
        .eq("team_id", team_id)
        .order("first_name");
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data ?? [] });
    }

    /* ── add_candidate ───────────────────────────────────────────── */
    if (action === "add_candidate") {
      const { session_id, candidate_id } = payload ?? {};
      if (!session_id || !candidate_id) {
        return NextResponse.json(
          { error: "session_id and candidate_id are required" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("group_interview_candidates")
        .upsert(
          { session_id, candidate_id },
          { onConflict: "session_id,candidate_id" }
        );

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      // Return the full candidate data so the client can optimistically update
      const { data: candidate } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, stage, role_applied, email, phone, current_brokerage, years_experience, is_licensed")
        .eq("id", candidate_id)
        .single();

      return NextResponse.json({ success: true, candidate });
    }

    /* ── remove_candidate ────────────────────────────────────────── */
    if (action === "remove_candidate") {
      const { session_id, candidate_id } = payload ?? {};
      if (!session_id || !candidate_id) {
        return NextResponse.json(
          { error: "session_id and candidate_id are required" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("group_interview_candidates")
        .delete()
        .eq("session_id", session_id)
        .eq("candidate_id", candidate_id);

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true });
    }

    /* ── list_prompts ──────────────────────────────────────────── */
    if (action === "list_prompts") {
      const { team_id } = payload ?? {};
      if (!team_id) {
        return NextResponse.json(
          { error: "team_id is required" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("group_interview_prompts")
        .select("*")
        .eq("team_id", team_id)
        .order("order_index");

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data: data ?? [] });
    }

    /* ── create_prompt ─────────────────────────────────────────── */
    if (action === "create_prompt") {
      const { team_id, prompt_text, order_index } = payload ?? {};
      if (!team_id || !prompt_text) {
        return NextResponse.json(
          { error: "team_id and prompt_text are required" },
          { status: 400 }
        );
      }

      // If no order_index, put at the end
      let nextOrder = order_index ?? 0;
      if (order_index == null) {
        const { data: maxRow } = await supabase
          .from("group_interview_prompts")
          .select("order_index")
          .eq("team_id", team_id)
          .order("order_index", { ascending: false })
          .limit(1)
          .maybeSingle();
        nextOrder = (maxRow?.order_index ?? -1) + 1;
      }

      const { data, error } = await supabase
        .from("group_interview_prompts")
        .insert({ team_id, prompt_text, order_index: nextOrder })
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data });
    }

    /* ── update_prompt ─────────────────────────────────────────── */
    if (action === "update_prompt") {
      const { prompt_id, ...fields } = payload ?? {};
      if (!prompt_id) {
        return NextResponse.json(
          { error: "prompt_id is required" },
          { status: 400 }
        );
      }

      const allowed = ["prompt_text", "order_index", "is_active"];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in fields) updates[key] = fields[key];
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: "No update fields provided" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("group_interview_prompts")
        .update(updates)
        .eq("id", prompt_id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data });
    }

    /* ── delete_prompt ─────────────────────────────────────────── */
    if (action === "delete_prompt") {
      const { prompt_id } = payload ?? {};
      if (!prompt_id) {
        return NextResponse.json(
          { error: "prompt_id is required" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("group_interview_prompts")
        .delete()
        .eq("id", prompt_id);

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true });
    }

    /* ── reorder_prompts ───────────────────────────────────────── */
    if (action === "reorder_prompts") {
      const { team_id, ordered_ids } = payload ?? {};
      if (!team_id || !Array.isArray(ordered_ids)) {
        return NextResponse.json(
          { error: "team_id and ordered_ids are required" },
          { status: 400 }
        );
      }

      // Update order_index for each prompt
      const updates = ordered_ids.map((id: string, index: number) =>
        supabase
          .from("group_interview_prompts")
          .update({ order_index: index })
          .eq("id", id)
          .eq("team_id", team_id)
      );

      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error);
      if (firstError?.error) {
        return NextResponse.json(
          { error: firstError.error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("group-interviews API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
