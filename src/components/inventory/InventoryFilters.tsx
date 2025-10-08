import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

interface InventoryFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  itemGroupFilter: string;
  onItemGroupChange: (value: string) => void;
  itemTypeFilter: string;
  onItemTypeChange: (value: string) => void;
  stockStatusFilter: string;
  onStockStatusChange: (value: string) => void;
  itemGroups: string[];
  itemTypes: string[];
}

export function InventoryFilters({
  searchTerm,
  onSearchChange,
  itemGroupFilter,
  onItemGroupChange,
  itemTypeFilter,
  onItemTypeChange,
  stockStatusFilter,
  onStockStatusChange,
  itemGroups,
  itemTypes,
}: InventoryFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name, SKU, or code..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-group">Item Group</Label>
            <Select value={itemGroupFilter} onValueChange={onItemGroupChange}>
              <SelectTrigger id="item-group">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {itemGroups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-type">Item Type</Label>
            <Select value={itemTypeFilter} onValueChange={onItemTypeChange}>
              <SelectTrigger id="item-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {itemTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock-status">Stock Status</Label>
            <Select value={stockStatusFilter} onValueChange={onStockStatusChange}>
              <SelectTrigger id="stock-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="low-stock">Low Stock</SelectItem>
                <SelectItem value="out-of-stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
