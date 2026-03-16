import { useEffect } from "react";

import { useAuth } from "../context/AuthContext";
import { connectSocket } from "../socket";

export default function useEntitlementSocket({ enabled = true, onEntitlement }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id || "";

  useEffect(() => {
    if (!enabled || !userId || typeof onEntitlement !== "function") {
      return undefined;
    }

    const socket = connectSocket({ userId });
    if (!socket) {
      return undefined;
    }

    const handleEntitlementGranted = (payload = {}) => {
      onEntitlement(payload);
    };

    socket.on("entitlement:granted", handleEntitlementGranted);

    return () => {
      socket.off("entitlement:granted", handleEntitlementGranted);
    };
  }, [enabled, onEntitlement, userId]);
}
