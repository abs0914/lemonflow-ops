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
    let cancelled = false;
    if (!signatureUrl) {
      setUrl(null);
      return;
    }

    // Extract storage object path. Supports both bare paths and full public URLs.
    let path = signatureUrl;
    const marker = "/user-signatures/";
    const idx = signatureUrl.indexOf(marker);
    if (idx !== -1) path = signatureUrl.substring(idx + marker.length);

    supabase.storage
      .from("user-signatures")
      .createSignedUrl(path, 300)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [signatureUrl]);

  if (!url) {
    return fallbackText ? (
      <div className="border-b border-border w-full h-12" />
    ) : null;
  }

  return <img src={url} alt="Digital signature" className={className} />;
}
