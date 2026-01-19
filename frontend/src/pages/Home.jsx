import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <h3>Loading profile + feed...</h3>;
  }

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h3>You are not logged in</h3>
        <a href="/login">Go to Login</a>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome to Tengacion 🎉</h2>

      <div style={{
        border: "1px solid #ccc",
        padding: 10,
        marginTop: 10
      }}>
        <p><b>Name:</b> {user.name}</p>
        <p><b>Username:</b> @{user.username}</p>
        <p><b>Email:</b> {user.email}</p>
      </div>

      <button
        style={{ marginTop: 10 }}
        onClick={logout}
      >
        Logout
      </button>

      <hr />

      <h3>Your Feed (Next Phase)</h3>
      <p>This is where posts will appear.</p>
    </div>
  );
}
