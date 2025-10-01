import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Factory, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Production() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/login");
    }
    if (!loading && profile && !["Admin", "Production"].includes(profile.role)) {
      navigate("/dashboard");
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Production</h1>
            <p className="text-muted-foreground mt-2">
              Manage assembly orders and production workflow
            </p>
          </div>
          <Button 
            onClick={() => navigate("/dashboard/production/create")}
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Assembly Order
          </Button>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Open Assembly Orders</CardTitle>
            <CardDescription>
              View and manage your production orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center space-y-4">
                <Factory className="h-12 w-12 mx-auto" />
                <div>
                  <p className="font-medium">No open assembly orders</p>
                  <p className="text-sm">Create your first production order to get started</p>
                </div>
                <Button 
                  onClick={() => navigate("/dashboard/production/create")}
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Order
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
