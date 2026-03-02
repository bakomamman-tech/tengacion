import { getProfile } from "../api";

/**
 * Restore authenticated user from token
 */
export async function restoreSession(setUser) {
  const token = localStorage.getItem("token");
  if (!token) {return null;}

  try {
    const user = await getProfile();
    setUser(user);
    try {
      localStorage.setItem("user", JSON.stringify(user));
    } catch {
      // ignore
    }
    return user;
  } catch {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    return null;
  }
}
