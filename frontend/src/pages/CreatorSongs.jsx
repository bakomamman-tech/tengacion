import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCreator, getCreatorTracks, getTrackStream } from "../api";
import styles from "./creatorSongs/CreatorSongs.module.css";
import CreatorSongsHeader from "./creatorSongs/CreatorSongsHeader";
import PopularSongsList from "./creatorSongs/PopularSongsList";
import DiscographySection from "./creatorSongs/DiscographySection";
import NowPlayingSidebar from "./creatorSongs/NowPlayingSidebar";

const trackScore = (track) => {
  const playCount = Number(track.playCount || 0);
  const likes = Number(track.likesCount ?? track.likes ?? 0);
  const recency = new Date(track.createdAt || 0).getTime() || 0;
  return playCount * 10 + likes * 3 + recency / 100000;
};

export default function CreatorSongs() {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [creator, setCreator] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [currentTrackId, setCurrentTrackId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [streamMap, setStreamMap] = useState({});

  const popularTracks = useMemo(
    () => [...tracks].sort((a, b) => trackScore(b) - trackScore(a)).slice(0, 5),
    [tracks]
  );

  const currentTrack = useMemo(
    () => tracks.find((track) => track._id === currentTrackId) || null,
    [currentTrackId, tracks]
  );

  const audienceCount = useMemo(() => {
    const raw =
      Number(creator?.user?.followersCount || 0) ||
      Number(creator?.followersCount || 0);
    if (raw > 0) {
      return raw;
    }
    return Math.max(1, tracks.length * 113);
  }, [creator?.followersCount, creator?.user?.followersCount, tracks.length]);

  const loadSongsPage = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [creatorRes, tracksRes] = await Promise.all([
        getCreator(creatorId),
        getCreatorTracks(creatorId),
      ]);
      setCreator(creatorRes || null);
      setTracks(Array.isArray(tracksRes) ? tracksRes : []);
    } catch (err) {
      setLoadError(err.message || "Failed to load creator songs");
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    loadSongsPage();
  }, [loadSongsPage]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setPlaybackError("Unable to play this track right now.");
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const playTrack = useCallback(
    async (track) => {
      const audio = audioRef.current;
      if (!audio || !track?._id) {
        return;
      }

      try {
        setPlaybackError("");
        let streamUrl = streamMap[track._id];
        if (!streamUrl) {
          const stream = await getTrackStream(track._id);
          streamUrl = stream?.streamUrl || "";
          if (streamUrl) {
            setStreamMap((prev) => ({ ...prev, [track._id]: streamUrl }));
          }
        }

        if (!streamUrl) {
          throw new Error("Track stream is unavailable.");
        }

        const isCurrentTrack = currentTrackId === track._id;
        if (isCurrentTrack && !audio.paused) {
          audio.pause();
          return;
        }

        if (audio.src !== streamUrl) {
          audio.src = streamUrl;
        }
        setCurrentTrackId(track._id);
        await audio.play();
      } catch (err) {
        setPlaybackError(err.message || "Playback failed");
      }
    },
    [currentTrackId, streamMap]
  );

  const toggleCurrentTrack = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }
    if (audio.paused) {
      await playTrack(currentTrack);
      return;
    }
    audio.pause();
  }, [currentTrack, playTrack]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <div className={styles.loadingCard}>Loading uploaded songs...</div>
        </div>
      </div>
    );
  }

  if (loadError || !creator) {
    return (
      <div className={styles.page}>
        <div className={styles.errorWrap}>
          <div className={styles.errorCard}>{loadError || "Creator not found"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <CreatorSongsHeader
          styles={styles}
          creator={creator}
          audienceCount={audienceCount}
          onPlayTopTrack={() => playTrack(popularTracks[0])}
          onToggleFollow={() => setIsFollowing((prev) => !prev)}
          isFollowing={isFollowing}
          canPlay={Boolean(popularTracks[0])}
        />

        <div className={styles.layout}>
          <main className={styles.main}>
            {playbackError ? (
              <div className={styles.errorCard}>{playbackError}</div>
            ) : null}
            <PopularSongsList
              styles={styles}
              tracks={popularTracks}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              onPlayTrack={playTrack}
              onOpenTrack={(track) => navigate(`/tracks/${track._id}`)}
            />

            <DiscographySection
              styles={styles}
              tracks={tracks}
              onOpenTrack={(track) => navigate(`/tracks/${track._id}`)}
            />
          </main>

          <NowPlayingSidebar
            styles={styles}
            creator={creator}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayPause={toggleCurrentTrack}
          />
        </div>
      </div>
    </div>
  );
}
