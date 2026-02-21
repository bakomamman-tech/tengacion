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
    return user;
  } catch {
    localStorage.removeItem("token");
    setUser(null);
    return null;
  }
}
