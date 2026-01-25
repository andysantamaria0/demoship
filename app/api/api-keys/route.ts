import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-auth";

// GET /api/api-keys - List all API keys for the current user
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: apiKeys, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, created_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }

  return NextResponse.json(apiKeys);
}

// POST /api/api-keys - Create a new API key
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Check for existing keys limit (max 10 active keys per user)
  const { count } = await supabase
    .from("api_keys")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (count && count >= 10) {
    return NextResponse.json(
      { error: "Maximum of 10 active API keys allowed. Please revoke an existing key first." },
      { status: 400 }
    );
  }

  // Generate the API key
  const { key, hash, prefix } = generateApiKey();

  // Store in database
  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      name: name.trim(),
      key_hash: hash,
      key_prefix: prefix,
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }

  // Return the full key only on creation (it won't be retrievable later)
  return NextResponse.json(
    {
      ...apiKey,
      key, // Full key - show once to user
    },
    { status: 201 }
  );
}
