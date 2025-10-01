import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ProductList } from "@/components/bom/ProductList";
import { BomEditor } from "@/components/bom/BomEditor";
import { ComponentManager } from "@/components/bom/ComponentManager";

export default function BomManager() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    console.log("BomManager - Auth state:", { loading, profile: profile?.role });
    if (!loading && !profile) {
      console.log("BomManager - No profile, redirecting to login");
      navigate("/login");
    }
    if (!loading && profile && profile.role !== "Admin") {
      console.log("BomManager - Not admin, redirecting to dashboard. Role:", profile.role);
      navigate("/dashboard");
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">BOM Manager</h1>
          <p className="text-muted-foreground mt-2">
            Manage bills of materials for your products
          </p>
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList>
            <TabsTrigger value="products">Products & BOM</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <ProductList
                onSelectProduct={(product) =>
                  setSelectedProduct({ id: product.id, name: product.name })
                }
                selectedProductId={selectedProduct?.id}
              />
              <BomEditor
                productId={selectedProduct?.id}
                productName={selectedProduct?.name}
              />
            </div>
          </TabsContent>

          <TabsContent value="components" className="mt-6">
            <ComponentManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}