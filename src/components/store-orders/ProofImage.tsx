import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ProofImageProps {
  filePath: string;
  bucket?: string;
}

export function ProofImage({ filePath, bucket = "payment-proofs" }: ProofImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUrl = async () => {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600);
      if (data?.signedUrl) setUrl(data.signedUrl);
      setLoading(false);
    };
    fetchUrl();
  }, [filePath]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!url) return <p className="text-sm text-muted-foreground">Unable to load image</p>;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt="Proof of payment"
        className="max-h-96 rounded-lg border object-contain w-full"
      />
    </a>
  );
}
