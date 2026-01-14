import { useEffect, useState } from "react";
import Watch from "./Watch";
import CreatePostModal from "./CreatePostModal";

import {
  login,
  getProfile,
  getFeed,
  createPost,
  likePost,
  getStories,
  createStory
} from "./api";

import Layout from "./Layout";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Messenger from "./Messenger";
import Register from "./Register";
import ProfileEditor from "./ProfileEditor";
import StoryModal from "./StoryModal";

export default function App() {
  const [mode, setMode] = useState("login");
  const [page, setPage] = useState("home");

  const [chatOpen, setChatOpen] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [profile, setProfile] = useState(null);

  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyText, setStoryText] = useState("");

  const [storyOpen, setStoryOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);

  const loadAll = async () => {
    const p = await getProfile();
    setProfile(p);
    setPosts(await getFeed());
    setStories(await getStories());
  };

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setProfile(null);
    setMode("login");
  };

  /* ================= AUTH ================= */

  if (!user) {
    return (
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
        <div className="card" style={{ width: 420 }}>
          {mode === "login" ? (
            <>
              <h2>🔥 Tengacion</h2>
              <input placeholder="Email" onChange={e=>setEmail(e.target.value)} />
              <input type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} />

              <button onClick={async ()=>{
                const d = await login(email,password);
                if(d.token){
                  localStorage.setItem("token", d.token);
                  localStorage.setItem("user", JSON.stringify(d.user));
                  setUser(d.user);
                } else {
                  alert("Invalid login");
                }
              }}>Login</button>

              <p>No account? <button onClick={()=>setMode("register")}>Create one</button></p>
            </>
          ) : <Register onBack={()=>setMode("login")} />}
        </div>
      </div>
    );
  }

  if (!profile) return <div>Loading…</div>;

  /* ================= CENTER ================= */

  const renderCenter = () => {
    if (page === "watch") return <Watch />;
    if (page === "groups") return <div className="card"><h2>👥 Groups</h2></div>;
    if (page === "market") return <div className="card"><h2>🛒 Marketplace</h2></div>;
    if (page === "games") return <div className="card"><h2>🎮 Gaming</h2></div>;

    return (
      <>
        {showProfileEditor && (
          <div className="card">
            <ProfileEditor
              user={profile}
              onSaved={u => {
                setProfile(u);
                setShowProfileEditor(false);
              }}
            />
          </div>
        )}

        {/* STORIES */}
        <div className="card">
          <div className="stories-bar">
            <div className="story add-story">
              <div className="plus">+</div>
              <span>Add Story</span>
            </div>

            {stories.map((s, i) => (
              <div key={s._id} className="story" onClick={()=>{
                setStoryIndex(i);
                setStoryOpen(true);
              }}>
                <div className="story-avatar">
                  <img src={s.avatar || `https://ui-avatars.com/api/?name=${s.username}`} />
                </div>
                <span>{s.username}</span>
              </div>
            ))}
          </div>

          <div className="flex">
            <input
              value={storyText}
              onChange={e=>setStoryText(e.target.value)}
              placeholder="Share a story..."
            />
            <button onClick={async ()=>{
              if(!storyText) return;
              await createStory(storyText);
              setStoryText("");
              loadAll();
            }}>Post</button>
          </div>
        </div>

        {/* CREATE POST TRIGGER */}
        <div className="card" onClick={()=>setShowPostModal(true)} style={{ cursor:"pointer" }}>
          <input placeholder="What's on your mind?" />
        </div>

        {/* FEED */}
        {posts.map(p=>(
          <div key={p._id} className="card">
            <b>{p.name}</b> @{p.username}
            <p>{p.text}</p>
            <button onClick={()=>likePost(p._id).then(loadAll)}>❤️ {p.likes.length}</button>
          </div>
        ))}
      </>
    );
  };

  return (
    <>
      <Navbar user={profile} page={page} setPage={setPage} onLogout={logout} />

      <Layout
        left={
          <Sidebar
            user={profile}
            openChat={()=>setChatOpen(true)}
            openProfile={()=>setShowProfileEditor(true)}
          />
        }
        center={renderCenter()}
        right={chatOpen ? <Messenger user={profile} onClose={()=>setChatOpen(false)} /> : null}
      />

      {storyOpen && (
        <StoryModal
          stories={stories}
          index={storyIndex}
          onClose={()=>setStoryOpen(false)}
          user={profile}
        />
      )}

      {showPostModal && (
        <CreatePostModal
          onClose={()=>setShowPostModal(false)}
          onPost={async ({ text, file })=>{
            await createPost(text, file);
            setShowPostModal(false);
            loadAll();
          }}
        />
      )}
    </>
  );
}
