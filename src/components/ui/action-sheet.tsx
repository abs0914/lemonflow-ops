import { ReactNode } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionSheetProps {
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function ActionSheet({
  trigger,
  title,
  description,
  children,
  footer,
  open,
  onOpenChange,
  className,
}: ActionSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent className={cn("z-[70] max-h-[85vh]", className)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        
        <div className="overflow-y-auto px-4 pb-4">
          {children}
        </div>

        {footer && (
          <DrawerFooter className="pt-2">
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

interface ActionSheetActionProps {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  icon?: ReactNode;
  disabled?: boolean;
}

export function ActionSheetAction({
  label,
  onClick,
  variant = "default",
  icon,
  disabled,
}: ActionSheetActionProps) {
  return (
    <DrawerClose asChild>
      <Button
        onClick={onClick}
        variant={variant}
        disabled={disabled}
        className="w-full h-12 justify-start text-base"
      >
        {icon && <span className="mr-3">{icon}</span>}
        {label}
      </Button>
    </DrawerClose>
  );
}
