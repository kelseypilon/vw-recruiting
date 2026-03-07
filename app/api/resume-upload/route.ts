import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/resume-upload
 *
 * Uploads a resume file to Supabase storage (admin client, bypasses RLS).
 * Expects multipart/form-data with:
 *   - file: the resume file (PDF or Word, max 10MB)
 *   - candidateId: the candidate's ID
 *   - teamId: the team's ID
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const candidateId = formData.get("candidateId") as string | null;
    const teamId = formData.get("teamId") as string | null;

    if (!file || !candidateId || !teamId) {
      return NextResponse.json(
        { error: "file, candidateId, and teamId are required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Please upload a PDF or Word document" },
        { status: 400 }
      );
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 10MB" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const ext = file.name.split(".").pop() ?? "pdf";
    const filePath = `${teamId}/${candidateId}/resume.${ext}`;

    // Convert File to Buffer for server-side upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from("resumes")
      .upload(filePath, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: uploadErr.message },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("resumes").getPublicUrl(filePath);

    // Save URL to candidate record
    const { error: dbErr } = await supabase
      .from("candidates")
      .update({ resume_url: publicUrl })
      .eq("id", candidateId);

    if (dbErr) {
      return NextResponse.json(
        { error: dbErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
