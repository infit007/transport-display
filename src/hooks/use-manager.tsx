import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useManager = () => {
  const [isManager, setIsManager] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) {
        setIsManager(false);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["manager", "admin"]);
      
      const hasManagerRole = data?.some(role => role.role === "manager");
      const hasAdminRole = data?.some(role => role.role === "admin");
      
      setIsManager(hasManagerRole || hasAdminRole);
      setIsAdmin(hasAdminRole);
      setLoading(false);
    };
    load();
  }, []);

  return { isManager, isAdmin, loading };
};
