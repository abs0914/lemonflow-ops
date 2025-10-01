import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function SetupDemoButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-demo-users");

      if (error) throw error;

      console.log("Demo users setup result:", data);
      
      setIsComplete(true);
      toast({
        title: "Demo users created!",
        description: "You can now log in with the demo credentials.",
      });
    } catch (error: any) {
      console.error("Error setting up demo users:", error);
      toast({
        variant: "destructive",
        title: "Setup failed",
        description: error.message || "Could not create demo users. They may already exist.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isComplete) {
    return (
      <Button variant="outline" disabled className="w-full">
        <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
        Demo Users Created
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSetup}
      variant="outline"
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Setting up demo users...
        </>
      ) : (
        "Setup Demo Users"
      )}
    </Button>
  );
}
