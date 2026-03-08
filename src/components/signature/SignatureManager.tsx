import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SignatureCanvas } from "./SignatureCanvas";
import { SignatureUpload } from "./SignatureUpload";
import { SignatureDisplay } from "./SignatureDisplay";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Trash2, Pen, Upload } from "lucide-react";

export function SignatureManager() {
  const { user, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const uploadSignature = async (blob: Blob, type: "drawn" | "uploaded") => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const filePath = `${user.id}/signature.png`;

      // Delete old file first (ignore error if doesn't exist)
      await supabase.storage.from("user-signatures").remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from("user-signatures")
        .upload(filePath, blob, { contentType: "image/png", upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("user-signatures")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          signature_url: urlData.publicUrl,
          signature_type: type,
          signature_updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      await refreshProfile?.();
      toast.success("Signature saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save signature");
    } finally {
      setSaving(false);
    }
  };

  const handleCanvasSave = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await uploadSignature(blob, "drawn");
  };

  const handleUploadSave = async (file: File) => {
    await uploadSignature(file, "uploaded");
  };

  const handleDelete = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await supabase.storage
        .from("user-signatures")
        .remove([`${user.id}/signature.png`]);

      const { error } = await supabase
        .from("user_profiles")
        .update({
          signature_url: null,
          signature_type: null,
          signature_updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;

      await refreshProfile?.();
      toast.success("Signature removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove signature");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Saving signature...
        </div>
      )}

      {profile?.signature_url ? (
        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-sm font-medium mb-2">Current Signature</p>
            <div className="bg-white rounded p-4 flex items-center justify-center">
              <SignatureDisplay
                signatureUrl={profile.signature_url}
                className="max-h-24 w-auto"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Type: {profile.signature_type === "drawn" ? "Hand-drawn" : "Uploaded"}
              {profile.signature_updated_at && (
                <> · Updated: {new Date(profile.signature_updated_at).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remove Signature
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No signature on file. Create one below to use on printed documents.
        </p>
      )}

      <Tabs defaultValue="draw" className="w-full">
        <TabsList>
          <TabsTrigger value="draw" className="flex items-center gap-1.5">
            <Pen className="h-3.5 w-3.5" /> Draw
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload
          </TabsTrigger>
        </TabsList>
        <TabsContent value="draw" className="mt-4">
          <SignatureCanvas onSave={handleCanvasSave} />
        </TabsContent>
        <TabsContent value="upload" className="mt-4">
          <SignatureUpload onSave={handleUploadSave} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
