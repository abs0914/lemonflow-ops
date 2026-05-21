import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ProductList } from "@/components/bom/ProductList";
import { ParentRawMaterialList } from "@/components/bom/ParentRawMaterialList";
import { BomEditor, BomParentType } from "@/components/bom/BomEditor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface BomParent {
  id: string;
  name: string;
  type: BomParentType;
}

export default function BomManager() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [parent, setParent] = useState<BomParent | null>(null);
  const [tab, setTab] = useState<BomParentType>("product");

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
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground">BOM Manager</h1>
          <p className="text-muted-foreground mt-2">
            Manage bills of materials for products and raw material recipes
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as BomParentType);
              setParent(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="product">Products</TabsTrigger>
              <TabsTrigger value="raw_material">Raw Materials</TabsTrigger>
            </TabsList>
            <TabsContent value="product" className="mt-4">
              <ProductList
                onSelectProduct={(p) =>
                  setParent({ id: p.id, name: p.name, type: "product" })
                }
                selectedProductId={parent?.type === "product" ? parent.id : undefined}
              />
            </TabsContent>
            <TabsContent value="raw_material" className="mt-4">
              <ParentRawMaterialList
                onSelect={(rm) =>
                  setParent({ id: rm.id, name: rm.name, type: "raw_material" })
                }
                selectedId={parent?.type === "raw_material" ? parent.id : undefined}
              />
            </TabsContent>
          </Tabs>
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
