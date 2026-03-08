import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SignatureDisplayProps {
  signatureUrl: string | null;
  className?: string;
  fallbackText?: string;
}

export function SignatureDisplay({ signatureUrl, className = "h-16 w-auto", fallbackText }: SignatureDisplayProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!signatureUrl) return;

    // If it's already a full URL (public bucket), use directly
    if (signatureUrl.startsWith("http")) {
      setUrl(signatureUrl);
      return;
    }

    // Otherwise get public URL from storage
    const { data } = supabase.storage
      .from("user-signatures")
      .getPublicUrl(signatureUrl);
    if (data?.publicUrl) setUrl(data.publicUrl);
  }, [signatureUrl]);

  if (!url) {
    return fallbackText ? (
      <div className="border-b border-border w-full h-12" />
    ) : null;
  }

  return <img src={url} alt="Digital signature" className={className} />;
}

