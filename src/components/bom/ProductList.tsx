import { useState } from "react";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ProductDialog } from "./ProductDialog";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  stock_quantity: number;
}

interface ProductListProps {
  onSelectProduct: (product: Product) => void;
  selectedProductId?: string;
}

export function ProductList({ onSelectProduct, selectedProductId }: ProductListProps) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as Product[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error deleting product", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  const handleAdjustStock = (product: Product) => {
    setAdjustingProduct(product);
    setStockDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Products</CardTitle>
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    className={`cursor-pointer ${
                      selectedProductId === product.id ? "bg-accent" : ""
                    }`}
                    onClick={() => onSelectProduct(product)}
                  >
                    <TableCell className="font-medium">{product.sku}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell className="text-right">
                      <span className={product.stock_quantity <= 0 ? "text-destructive font-medium" : ""}>
                        {product.stock_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustStock(product);
                          }}
                          title="Adjust Stock"
                        >
                          <Package className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(product);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this product?")) {
                              deleteMutation.mutate(product.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <ProductDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          product={editingProduct}
        />

        {adjustingProduct && (
          <StockAdjustmentDialog
            open={stockDialogOpen}
            onOpenChange={setStockDialogOpen}
            itemType="product"
            itemId={adjustingProduct.id}
            itemName={adjustingProduct.name}
            currentStock={adjustingProduct.stock_quantity}
          />
        )}
      </CardContent>
    </Card>
  );
}