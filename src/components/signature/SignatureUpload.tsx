import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

interface SignatureUploadProps {
  onSave: (file: File) => void;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

export function SignatureUpload({ onSave }: SignatureUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error("Only PNG and JPG files are allowed");
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error("File must be less than 2MB");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative border rounded-lg p-4 bg-white">
          <img src={preview} alt="Signature preview" className="max-h-40 mx-auto object-contain" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Click to upload signature image</span>
          <span className="text-xs text-muted-foreground mt-1">PNG or JPG, max 2MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}
      {file && (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => onSave(file)}>
            Use This Signature
          </Button>
        </div>
      )}
    </div>
  );
}
