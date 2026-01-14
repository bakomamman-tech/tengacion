import { useEffect, useState } from "react";

export default function Watch() {
  const [videos, setVideos] = useState([]);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/videos", {
      headers: { Authorization: localStorage.getItem("token") }
    })
      .then(r => r.json())
      .then(setVideos);
  }, []);

  const upload = async () => {
    if (!url) return;

    await fetch("http://localhost:5000/api/videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("token")
      },
      body: JSON.stringify({ videoUrl: url, caption })
    });

    setUrl("");
    setCaption("");

    const v = await fetch("http://localhost:5000/api/videos", {
      headers: { Authorization: localStorage.getItem("token") }
    }).then(r=>r.json());

    setVideos(v);
  };

  return (
    <div className="watch-feed">
      <div className="card">
        <input
          placeholder="Paste video URL (mp4 / youtube)"
          value={url}
          onChange={e=>setUrl(e.target.value)}
        />
        <input
          placeholder="Caption"
          value={caption}
          onChange={e=>setCaption(e.target.value)}
        />
        <button onClick={upload}>Upload</button>
      </div>

      {videos.map(v=>(
        <div key={v._id} className="video-card">
          <b>{v.name}</b>

          <video
            src={v.videoUrl}
            controls
            autoPlay
            loop
          />

          <p>{v.caption}</p>

          <button>❤️ {v.likes.length}</button>
        </div>
      ))}
    </div>
  );
}
