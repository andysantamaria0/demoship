import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApiKeysManager } from "@/components/api-keys-manager";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-sm">Settings</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your API keys and integrations
          </p>
        </div>

        {/* API Keys Section */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">API Keys</h2>
          <p className="text-muted-foreground mb-6">
            API keys allow you to integrate DemoShip with GitHub Actions and other automation tools.
            Keys are hashed and cannot be retrieved after creation.
          </p>
          <ApiKeysManager />
        </section>
      </div>
    </div>
  );
}
