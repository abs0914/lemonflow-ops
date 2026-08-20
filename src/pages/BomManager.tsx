import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ProductList, BomParentItem } from "@/components/bom/ProductList";
import { BomEditor } from "@/components/bom/BomEditor";

export default function BomManager() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [parent, setParent] = useState<BomParentItem | null>(null);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/login");
    }
    if (!loading && profile && profile.role !== "Admin" && profile.role !== "Warehouse") {
      navigate("/dashboard");
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground">BOM Manager</h1>
            <p className="text-muted-foreground mt-2">
              Manage bills of materials for products and raw material recipes
            </p>
          </div>
          <ExportBomsButton />
        </div>


        <div className="grid gap-6 lg:grid-cols-2">
          <ProductList
            onSelectProduct={(item) => setParent(item)}
            selectedProductId={parent?.id}
          />
          <BomEditor
            parentId={parent?.id}
            parentName={parent?.name}
            parentType={parent?.type}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
