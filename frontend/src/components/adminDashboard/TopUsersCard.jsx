import AdminAvatar from "./AdminAvatar";

const formatNumber = (value) => Number(value || 0).toLocaleString();

export default function TopUsersCard({ items = [] }) {
  return (
    <section className="tdash-panel tdash-panel--top-users">
      <div className="tdash-panel__head">
        <div className="tdash-panel__heading">
          <span className="tdash-panel__eyebrow">Community leaders</span>
          <h3 className="tdash-panel__title">Top users</h3>
          <p>Ranked by audience and engagement performance.</p>
        </div>
        <span className="tdash-panel__count">Top {items.length || 0}</span>
      </div>

      <div className="tdash-top-users">
        <div className="tdash-top-users__header">
          <span>Rank</span>
          <span>User</span>
          <span>Followers</span>
          <span>Engagement</span>
          <span>Change</span>
        </div>

        {!items.length ? <div className="tdash-empty">No approved user activity is available yet.</div> : null}
        {items.map((item, index) => {
          const growth = Number(item.growthPercent || 0);
          return (
          <div key={item.id} className="tdash-top-users__row">
            <div className="tdash-top-users__rank">{String(index + 1).padStart(2, "0")}</div>
            <div className="tdash-top-users__identity">
              <AdminAvatar name={item.displayName} src={item.avatarUrl} size={42} />
              <div>
                <div className="tdash-top-users__name">{item.displayName}</div>
                <div className="tdash-top-users__descriptor">{item.descriptor}</div>
              </div>
            </div>

            <div className="tdash-top-users__metric" data-label="Followers">{formatNumber(item.followersCount)}</div>
            <div className="tdash-top-users__metric" data-label="Engagement">{formatNumber(item.engagementCount)}</div>
            <div className={`tdash-top-users__growth ${growth < 0 ? "is-negative" : growth === 0 ? "is-neutral" : ""}`} data-label="Change">
              {growth > 0 ? "+" : ""}{growth.toFixed(1)}%
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}
