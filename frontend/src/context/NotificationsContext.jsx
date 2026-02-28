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
      if (!id || !user?._id) return false;

      let wasUnread = false;
      setNotifications((prev) =>
        prev.map((item) => {
          if (String(item?._id) !== String(id)) return item;
          wasUnread = !item?.read;
          return { ...item, read: true };
        })
      );
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
        return false;
      }
    },
    [user?._id]
  );

  const markAllRead = useCallback(
    async ({ optimistic = true } = {}) => {
      if (!user?._id) return false;
      if (optimistic) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      }

      if (markAllPromiseRef.current) {
        return markAllPromiseRef.current;
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
        .catch(() => true)
        .finally(() => {
          markAllPromiseRef.current = null;
        });

      return markAllPromiseRef.current;
    },
    [user?._id]
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
    const token = localStorage.getItem("token");
    if (!token || !user?._id) {
      return undefined;
    }

    const socket = connectSocket({ token, userId: user._id });
    if (!socket) {
      return undefined;
    }

    const onNewNotification = (payload) => {
      handleRealtimeNotification(payload);
    };
    const onLegacyNotification = (notification) => {
      handleRealtimeNotification({ notification });
    };

    socket.on("notifications:new", onNewNotification);
    socket.on("notification", onLegacyNotification);

    return () => {
      socket.off("notifications:new", onNewNotification);
      socket.off("notification", onLegacyNotification);
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
