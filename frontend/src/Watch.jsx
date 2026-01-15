import { useEffect, useState } from "react";
import { getVideos, uploadVideo } from "./api";

export default function Watch() {
  const [videos, setVideos] = useState([]);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  const load = () => getVideos().then(setVideos);

  useEffect(load, []);

  const upload = async () => {
    if (!url) return;
    await uploadVideo(url, caption);
    setUrl("");
    setCaption("");
    load();
  };

  return (
    <div className="watch-feed">
      <div className="card">
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Video URL" />
        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption" />
        <button onClick={upload}>Upload</button>
      </div>

      {videos.map(v => (
        <div key={v._id} className="video-card">
          <b>{v.name}</b>
          <video src={v.videoUrl} controls />
          <p>{v.caption}</p>
          <button>❤️ {v.likes.length}</button>
        </div>
      ))}
    </div>
  );
}
