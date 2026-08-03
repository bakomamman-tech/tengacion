import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../api";
import { useAuth } from "./AuthContext";
import { connectSocket } from "../socket";

const NotificationsContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationsContext);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const markAllPromiseRef = useRef(null);
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const resetState = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
    setError("");
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?._id) {
      setUnreadCount(0);
      return 0;
    }
    try {
      const payload = await getUnreadNotificationsCount();
      const next = Number(payload?.unreadCount) || 0;
      setUnreadCount(next);
      return next;
    } catch {
      return 0;
    }
  }, [user?._id]);

  const fetchNotifications = useCallback(
    async ({ page = 1, limit = 50 } = {}) => {
      if (!user?._id) {
        setNotifications([]);
        return [];
      }
      try {
        setLoading(true);
        setError("");
        const payload = await getNotifications(page, limit);
        const items = Array.isArray(payload?.data) ? payload.data : [];
        setNotifications(items);
        if (Number.isFinite(payload?.unreadCount)) {
          setUnreadCount(Number(payload.unreadCount) || 0);
        }
        return items;
      } catch (err) {
        setError(err?.message || "Failed to load notifications");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user?._id]
  );

  const markOneRead = useCallback(
    async (id) => {
      if (!id || !user?._id) {return false;}

      const previous = notificationsRef.current;
      const previousTarget = previous.find((item) => String(item?._id) === String(id));
      const wasUnread = Boolean(previousTarget && !previousTarget.read);
      const optimistic = previous.map((item) => {
          if (String(item?._id) !== String(id)) {return item;}
          return { ...item, read: true };
        });
      notificationsRef.current = optimistic;
      setNotifications(optimistic);
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      try {
        const payload = await markNotificationAsRead(id);
        if (Number.isFinite(payload?.unreadCount)) {
          setUnreadCount(Number(payload.unreadCount) || 0);
        }
        return true;
      } catch {
        const restored = notificationsRef.current.map((item) => {
          if (!previousTarget || String(item?._id) !== String(id)) {return item;}
          return { ...item, read: Boolean(previousTarget.read) };
        });
        notificationsRef.current = restored;
        setNotifications(restored);
        if (wasUnread) {
          setUnreadCount((prev) => prev + 1);
        }
        void fetchUnreadCount();
        return false;
      }
    },
    [fetchUnreadCount, user?._id]
  );

  const markAllRead = useCallback(
    async ({ optimistic = true } = {}) => {
      if (!user?._id) {return false;}
      if (markAllPromiseRef.current) {
        return markAllPromiseRef.current;
      }

      const previousReadState = new Map(
        notificationsRef.current.map((item) => [String(item?._id || ""), Boolean(item?.read)])
      );
      if (optimistic) {
        setUnreadCount(0);
        const optimisticNotifications = notificationsRef.current.map((item) => ({ ...item, read: true }));
        notificationsRef.current = optimisticNotifications;
        setNotifications(optimisticNotifications);
      }

      markAllPromiseRef.current = markAllNotificationsAsRead()
        .then((payload) => {
          if (Number.isFinite(payload?.unreadCount)) {
            setUnreadCount(Number(payload.unreadCount) || 0);
          } else {
            setUnreadCount(0);
          }
          return true;
        })
        .catch(() => {
          const restored = notificationsRef.current.map((item) => {
            const id = String(item?._id || "");
            return previousReadState.has(id)
              ? { ...item, read: previousReadState.get(id) }
              : item;
          });
          notificationsRef.current = restored;
          setNotifications(restored);
          setUnreadCount(restored.filter((item) => !item?.read).length);
          void fetchUnreadCount();
          return false;
        })
        .finally(() => {
          markAllPromiseRef.current = null;
        });

      return markAllPromiseRef.current;
    },
    [fetchUnreadCount, user?._id]
  );

  const handleRealtimeNotification = useCallback((payload) => {
    const incoming = payload?.notification || payload;
    if (!incoming?._id) {
      if (Number.isFinite(payload?.unreadCount)) {
        setUnreadCount(Number(payload.unreadCount) || 0);
      }
      return;
    }

    setNotifications((prev) => {
      const exists = prev.some((entry) => String(entry?._id) === String(incoming._id));
      if (exists) {
        return prev;
      }
      return [incoming, ...prev];
    });

    if (Number.isFinite(payload?.unreadCount)) {
      setUnreadCount(Number(payload.unreadCount) || 0);
      return;
    }

    if (!incoming.read) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    if (!user?._id) {
      resetState();
      return undefined;
    }

    fetchUnreadCount();

    const timer = window.setInterval(() => {
      fetchUnreadCount();
    }, 25000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchUnreadCount();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchUnreadCount, resetState, user?._id]);

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    const socket = connectSocket({ userId: user._id });
    if (!socket) {
      return undefined;
    }

    const onNewNotification = (payload) => {
      handleRealtimeNotification(payload);
    };
    const onLegacyNotification = (notification) => {
      handleRealtimeNotification({ notification });
    };
    const onNotificationNew = (payload) => {
      handleRealtimeNotification(payload);
    };

    socket.on("notifications:new", onNewNotification);
    socket.on("notification", onLegacyNotification);
    socket.on("notification:new", onNotificationNew);

    return () => {
      socket.off("notifications:new", onNewNotification);
      socket.off("notification", onLegacyNotification);
      socket.off("notification:new", onNotificationNew);
    };
  }, [handleRealtimeNotification, user?._id]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      fetchNotifications,
      fetchUnreadCount,
      markAllRead,
      markOneRead,
      handleRealtimeNotification,
      setNotifications,
    }),
    [
      error,
      fetchNotifications,
      fetchUnreadCount,
      handleRealtimeNotification,
      loading,
      markAllRead,
      markOneRead,
      notifications,
      unreadCount,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
