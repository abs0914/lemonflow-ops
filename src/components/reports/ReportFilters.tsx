import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ReportFiltersProps {
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
}

export function ReportFilters({ dateRange, onDateRangeChange }: ReportFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label>Start date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal w-full sm:w-[160px]",
              !dateRange.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.from ? (
              format(dateRange.from, "LLL dd, y")
            ) : (
              <span>Start date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateRange.from}
            onSelect={(date) => {
              if (date) {
                onDateRangeChange({
                  from: date,
                  to: date > dateRange.to ? date : dateRange.to,
                });
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <span className="hidden sm:inline text-muted-foreground">—</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal w-full sm:w-[160px]",
              !dateRange.to && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.to ? (
              format(dateRange.to, "LLL dd, y")
            ) : (
              <span>End date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateRange.to}
            onSelect={(date) => {
              if (date) {
                onDateRangeChange({
                  from: date < dateRange.from ? date : dateRange.from,
                  to: date,
                });
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
