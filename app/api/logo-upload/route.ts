import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/logo-upload
 * Upload a team logo to Supabase Storage bucket "team-logos".
 * Requires authenticated user session.
 * Returns the public URL of the uploaded logo.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const teamId = formData.get("teamId") as string | null;

    if (!file || !teamId) {
      return NextResponse.json(
        { error: "file and teamId are required" },
        { status: 400 }
      );
    }

    // Validate file type — images only
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Please upload an image (JPG, PNG, WebP, or SVG)" },
        { status: 400 }
      );
    }

    // Validate file size (2MB max for logos)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Logo must be under 2MB" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const ext = file.name.split(".").pop() ?? "png";
    const filePath = `${teamId}/logo.${ext}`;

    // Convert File to Buffer for server-side upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from("team-logos")
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
    } = supabase.storage.from("team-logos").getPublicUrl(filePath);

    // Update team record with logo URL
    const { error: dbErr } = await supabase
      .from("teams")
      .update({ brand_logo_url: publicUrl })
      .eq("id", teamId);

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
