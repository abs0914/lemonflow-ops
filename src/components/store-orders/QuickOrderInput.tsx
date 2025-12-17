import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, Trash2 } from "lucide-react";

interface QuickOrderInputProps {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
  onClear: () => void;
  disabled?: boolean;
}

const PLACEHOLDER_TEXT = `Paste order message here...

Example format:
Branch: Rob.Galleria

BEVERAGE SKU's 
TLC00001 (LEMON)-150pcs
TLC00019( WATER) -3Gallons

"FOOD SERVICES"
TLC00024(22oz) -100pcs
TLC00050( Straw) - 2 packs

"FLAVORED"
TLC00003 CUCUMBER- 3 packs
TLC00004 GINGER- 4 Packs

Requested By: Khayran
Thank you.`;

export function QuickOrderInput({
  value,
  onChange,
  onParse,
  onClear,
  disabled = false,
}: QuickOrderInputProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="orderText">Order Message</Label>
        <span className="text-xs text-muted-foreground">
          {value.length > 0 ? `${value.split('\n').filter(l => l.trim()).length} lines` : ''}
        </span>
      </div>
      
      <Textarea
        id="orderText"
        placeholder={PLACEHOLDER_TEXT}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[300px] font-mono text-sm"
        disabled={disabled}
      />
      
      <div className="flex gap-2">
        <Button
          onClick={onParse}
          disabled={disabled || !value.trim()}
        >
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Parse Order
        </Button>
        <Button
          variant="outline"
          onClick={onClear}
          disabled={disabled || !value.trim()}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
