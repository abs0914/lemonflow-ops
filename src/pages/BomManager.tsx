import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ProductList } from "@/components/bom/ProductList";
import { BomEditor } from "@/components/bom/BomEditor";

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
      navigate("/login");
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
      </div>
    </DashboardLayout>
  );
}