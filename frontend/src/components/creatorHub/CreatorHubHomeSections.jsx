import styles from "./CreatorHub.module.css";
import ContinueListeningRow from "./ContinueListeningRow";
import { TopTracksList } from "./TopTracksList";
import TopTracksWidget from "./TopTracksWidget";
import LatestPodcastsWidget from "./LatestPodcastsWidget";
import ComedyRow from "./ComedyRow";
import EbooksRow from "./EbooksRow";
import { buttonStyles, cx } from "../ui/buttonStyles";

const toPlayerItem = ({
  item,
  creator,
  type,
  lockedPreview = false,
}) => ({
  id: item.id || item.itemId,
  title: item.title,
  coverUrl: item.coverUrl,
  creatorName: creator.displayName,
  type,
  streamUrl: item.streamUrl || "",
  durationSec: item.durationSec,
  creatorId: creator.id,
  progressSec: Number(item.progressSec || 0),
  lockedPreview: Boolean(lockedPreview),
  previewStartSec: Math.max(0, Number(item.previewStartSec || 0)),
  previewLimitSec: Math.max(0, Number(item.previewLimitSec || 0)),
});

export default function CreatorHubHomeSections({
  sections,
  creator,
  currencyMode,
  onPlay,
  onViewTab,
  onCheckout,
  onDownload,
  onMenu,
}) {
  return (
    <div className={styles.mainGrid}>
      <div>
        <ContinueListeningRow
          items={sections.continueListening || []}
          onPlay={(item) => onPlay(toPlayerItem({
            item,
            creator,
            type: item.type,
            lockedPreview: item.lockedPreview,
          }))}
        />

        <div className={styles.tracksGrid} style={{ marginTop: "1rem" }}>
          <TopTracksList
            tracks={sections.topTracks || []}
            currencyMode={currencyMode}
            creatorName={creator.displayName}
            onPlay={(track, queue) => onPlay(
              toPlayerItem({
                item: track,
                creator,
                type: track.kind === "podcast" ? "podcast" : "song",
                lockedPreview: !track.isFree && !track.canDownload,
              }),
              queue.map((entry) => toPlayerItem({
                item: entry,
                creator,
                type: entry.kind === "podcast" ? "podcast" : "song",
                lockedPreview: !entry.isFree && !entry.canDownload,
              }))
            )}
            onViewAll={() => onViewTab("music")}
            onCheckout={onCheckout}
            onTrackMenu={onMenu}
          />
          <TopTracksWidget tracks={sections.topTracks || []} />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <ComedyRow
            items={sections.latestComedy || []}
            currencyMode={currencyMode}
            onViewAll={() => onViewTab("comedy")}
            onPlay={(video, queue) => onPlay(
              toPlayerItem({
                item: video,
                creator,
                type: "video",
                lockedPreview: !video.isFree,
              }),
              queue.map((entry) => toPlayerItem({
                item: entry,
                creator,
                type: "video",
                lockedPreview: !entry.isFree,
              }))
            )}
            onCheckout={onCheckout}
            onMenu={onMenu}
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <EbooksRow
            books={sections.ebooks || []}
            currencyMode={currencyMode}
            onViewAll={() => onViewTab("books")}
            onCheckout={onCheckout}
            onDownload={onDownload}
            onMenu={onMenu}
          />
        </div>

        <div style={{ marginTop: "1rem" }} className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h4>Albums</h4>
            <button type="button" className={cx(buttonStyles({ variant: "ghost", size: "sm" }), styles.viewAll)} onClick={() => onViewTab("albums")}>
              View all
            </button>
          </div>
          {(sections.latestAlbums || []).length ? (
            <div className={styles.rowScroller}>
              {(sections.latestAlbums || []).map((album) => (
                <article key={album.id} className={styles.itemCard}>
                  <img
                    src={album.coverUrl || "/avatar.png"}
                    alt={album.title}
                    className={styles.itemThumb}
                  />
                  <p className={styles.itemTitle}>{album.title}</p>
                  <p className={styles.itemMeta}>
                    {Number(album.totalTracks || 0)} songs {"\u2022"} {currencyMode === "GLOBAL" ? `$${Number(album.priceUSD || 0).toLocaleString()}` : `NGN ${Number(album.priceNGN || 0).toLocaleString()}`}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>No albums yet.</p>
          )}
        </div>
      </div>

      <div>
        <LatestPodcastsWidget
          podcasts={sections.latestPodcasts || []}
          currencyMode={currencyMode}
          onViewAll={() => onViewTab("podcasts")}
          onCheckout={onCheckout}
          onPlay={(podcast, queue) => onPlay(
            toPlayerItem({
              item: podcast,
              creator,
              type: "podcast",
              lockedPreview: !podcast.isFree && !podcast.canDownload,
            }),
            queue.map((entry) => toPlayerItem({
              item: entry,
              creator,
              type: "podcast",
              lockedPreview: !entry.isFree && !entry.canDownload,
            }))
          )}
        />
      </div>
    </div>
  );
}
