import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface FABAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

interface FloatingActionButtonProps {
  icon: LucideIcon;
  label?: string;
  onClick?: () => void;
  actions?: FABAction[];
  className?: string;
  children?: ReactNode;
}

export function FloatingActionButton({
  icon: Icon,
  label,
  onClick,
  actions,
  className,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isSpeedDial = actions && actions.length > 0;

  const handleMainClick = () => {
    if (isSpeedDial) {
      setIsOpen(!isOpen);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse items-end gap-3">
      {/* Speed dial actions */}
      {isSpeedDial && isOpen && (
        <div className="flex flex-col-reverse gap-2 animate-scale-in">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              variant="secondary"
              size="lg"
              className={cn(
                "h-12 shadow-lg hover:shadow-xl transition-all",
                "bg-background/95 backdrop-blur-sm border border-border"
              )}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <Button
        onClick={handleMainClick}
        size="icon"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg hover:shadow-xl",
          "transition-all duration-200 hover:scale-110 active:scale-95",
          "bg-primary text-primary-foreground",
          "animate-scale-in",
          isOpen && isSpeedDial && "rotate-45",
          className
        )}
      >
        <Icon className="h-6 w-6" />
        <span className="sr-only">{label || "Action"}</span>
      </Button>

      {/* Optional label */}
      {label && !isSpeedDial && (
        <span className="absolute bottom-16 right-0 text-xs font-medium text-muted-foreground whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  );
}
