import { ReactNode, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileDataCardProps {
  children: ReactNode;
  actions?: ReactNode;
  expandableContent?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function MobileDataCard({
  children,
  actions,
  expandableContent,
  className,
  onClick,
}: MobileDataCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        onClick && "cursor-pointer active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {children}
      </CardContent>

      {expandableContent && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-none border-t"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <span className="text-xs text-muted-foreground">
              {isExpanded ? "Show Less" : "Show More"}
            </span>
            <ChevronDown
              className={cn(
                "ml-2 h-3 w-3 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </Button>

          {isExpanded && (
            <CardContent className="pt-4 pb-4 border-t bg-muted/30 animate-accordion-down">
              {expandableContent}
            </CardContent>
          )}
        </>
      )}

      {actions && (
        <CardFooter className="p-3 pt-0 flex gap-2">
          {actions}
        </CardFooter>
      )}
    </Card>
  );
}

interface MobileDataRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function MobileDataRow({ label, value, className }: MobileDataRowProps) {
  return (
    <div className={cn("flex justify-between items-center py-2", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
