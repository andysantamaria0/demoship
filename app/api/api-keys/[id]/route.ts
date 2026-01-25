import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/api-keys/[id] - Revoke an API key
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Soft delete by setting revoked_at timestamp
  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id, name, revoked_at")
    .single();

  if (error || !apiKey) {
    return NextResponse.json({ error: "API key not found or already revoked" }, { status: 404 });
  }

  return NextResponse.json({ message: "API key revoked", apiKey });
}
