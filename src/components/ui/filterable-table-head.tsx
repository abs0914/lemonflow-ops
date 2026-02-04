import { useState, useRef, useEffect } from "react";
import { TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterableTableHeadProps {
  children: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FilterableTableHead({
  children,
  value,
  onChange,
  placeholder = "Filter...",
  className,
}: FilterableTableHeadProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const hasFilter = value.length > 0;

  return (
    <TableHead className={cn("relative", className)}>
      <div className="flex items-center gap-1">
        <span>{children}</span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0 hover:bg-muted",
                hasFilter && "text-primary"
              )}
            >
              <Filter className={cn("h-3 w-3", hasFilter && "fill-current")} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setOpen(false);
                  }
                }}
              />
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </TableHead>
  );
}
