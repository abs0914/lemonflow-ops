import { useState, useEffect } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ConversionHelperProps {
  baseUnit: string;
  onApply: (convertedValue: string) => void;
}

// Weight conversions (base: g)
const weightUnits: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
};

// Liquid conversions (base: ml)
const liquidUnits: Record<string, number> = {
  ml: 1,
  cl: 10,
  l: 1000,
};

const getUnitType = (unit: string): "weight" | "liquid" | "unknown" => {
  const normalizedUnit = unit.toLowerCase().trim();
  if (Object.keys(weightUnits).includes(normalizedUnit)) return "weight";
  if (Object.keys(liquidUnits).includes(normalizedUnit)) return "liquid";
  return "unknown";
};

const getConversionUnits = (unitType: "weight" | "liquid" | "unknown") => {
  if (unitType === "weight") return weightUnits;
  if (unitType === "liquid") return liquidUnits;
  return null;
};

export function ConversionHelper({ baseUnit, onApply }: ConversionHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [fromUnit, setFromUnit] = useState("");
  const [convertedValue, setConvertedValue] = useState("");

  const unitType = getUnitType(baseUnit);
  const conversionUnits = getConversionUnits(unitType);
  const normalizedBaseUnit = baseUnit.toLowerCase().trim();

  useEffect(() => {
    // Reset when base unit changes
    setInputValue("");
    setFromUnit("");
    setConvertedValue("");
  }, [baseUnit]);

  useEffect(() => {
    if (!inputValue || !fromUnit || !conversionUnits) {
      setConvertedValue("");
      return;
    }

    const inputNum = parseFloat(inputValue);
    if (isNaN(inputNum)) {
      setConvertedValue("");
      return;
    }

    // Convert input to base (g or ml), then to target unit
    const fromFactor = conversionUnits[fromUnit];
    const toFactor = conversionUnits[normalizedBaseUnit];

    if (fromFactor && toFactor) {
      const result = (inputNum * fromFactor) / toFactor;
      setConvertedValue(result.toFixed(4).replace(/\.?0+$/, ""));
    }
  }, [inputValue, fromUnit, conversionUnits, normalizedBaseUnit]);

  if (unitType === "unknown") {
    return null; // Don't show converter for non-weight/liquid units
  }

  const unitOptions = Object.keys(conversionUnits || {}).filter(
    (u) => u !== normalizedBaseUnit
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
          <Calculator className="h-3 w-3" />
          Unit Converter
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 p-3 border rounded-md bg-muted/30 space-y-3">
        <div className="text-xs text-muted-foreground">
          Convert to {baseUnit.toUpperCase()}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs">Value</Label>
            <Input
              type="number"
              step="0.001"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter value"
              className="h-8 text-sm"
            />
          </div>
          <div className="w-24">
            <Label className="text-xs">From</Label>
            <Select value={fromUnit} onValueChange={setFromUnit}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {convertedValue && (
          <div className="flex items-center justify-between p-2 bg-background rounded border">
            <span className="text-sm">
              = <strong>{convertedValue}</strong> {baseUnit.toUpperCase()}
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => {
                onApply(convertedValue);
                setIsOpen(false);
                setInputValue("");
                setFromUnit("");
              }}
            >
              Use Value
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
