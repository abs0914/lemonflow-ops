import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileSettings } from "@/components/account/ProfileSettings";
import { PasswordSettings } from "@/components/account/PasswordSettings";
import { SignatureManager } from "@/components/signature/SignatureManager";
import { DashboardLayout } from "@/components/DashboardLayout";
import { User, Lock, PenTool, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

function PushSettings() {
  const { status, loading, subscribe, unsubscribe } = usePushSubscription();
  const { user } = useAuth();

  const enabled = status === "subscribed";
  const canToggle =
    status === "default" ||
    status === "granted-unsubscribed" ||
    status === "subscribed";

  const handleToggle = async (next: boolean) => {
    try {
      if (next) {
        await subscribe();
        toast({ title: "Push notifications enabled", description: "You'll receive alerts even when the app is closed." });
      } else {
        await unsubscribe();
        toast({ title: "Push notifications disabled" });
      }
    } catch (e: any) {
      toast({ title: "Could not enable push", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const sendTest = async () => {
    if (!user?.id) return;
    const { error } = await supabase.functions.invoke("send-push", {
      body: {
        user_ids: [user.id],
        title: "Test notification",
        body: "If you can see this, push is working.",
        url: "/dashboard",
      },
    });
    if (error) {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Test sent", description: "Check your device notifications." });
    }
  };

  const statusLabel: Record<typeof status, string> = {
    unsupported: "Your browser does not support push notifications.",
    blocked: "Notifications are blocked in your browser settings.",
    preview: "Push only works on the published app — open lemonflow-ops.lovable.app in a normal browser tab.",
    denied: "You blocked notifications. Re-enable them in your browser site settings.",
    default: "Not enabled.",
    "granted-unsubscribed": "Permission granted but not subscribed.",
    subscribed: "Enabled on this device.",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Browser push notifications</Label>
          <p className="text-sm text-muted-foreground">{statusLabel[status]}</p>
          <p className="text-xs text-muted-foreground">
            Get alerts even when the tab is closed (Chrome, Edge, Firefox, Safari 16.4+ as PWA).
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={loading || !canToggle}
          onCheckedChange={handleToggle}
        />
      </div>

      {status === "subscribed" && (
        <Button variant="outline" onClick={sendTest}>
          Send test notification
        </Button>
      )}
    </div>
  );
}

export default function MyAccount() {
  const { profile } = useAuth();

  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Account</h1>
            <p className="text-muted-foreground">
              Manage your profile and security settings
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="signature" className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Signature
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your account profile details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signature">
            <Card>
              <CardHeader>
                <CardTitle>Digital Signature</CardTitle>
                <CardDescription>
                  Create or update your digital signature for printed documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignatureManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Control how you get alerted about new orders, payments, stock and production events.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PushSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordSettings />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
