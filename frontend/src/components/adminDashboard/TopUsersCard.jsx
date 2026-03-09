import AdminAvatar from "./AdminAvatar";

const formatNumber = (value) => Number(value || 0).toLocaleString();

export default function TopUsersCard({ items = [] }) {
  return (
    <section className="tdash-panel tdash-panel--top-users">
      <div className="tdash-panel__head">
        <h3 className="tdash-panel__title">Top Users</h3>
      </div>

      <div className="tdash-top-users">
        <div className="tdash-top-users__header">
          <span>User</span>
          <span>Followers</span>
          <span>Engagement</span>
          <span>Change</span>
        </div>

        {items.map((item) => (
          <div key={item.id} className="tdash-top-users__row">
            <div className="tdash-top-users__identity">
              <AdminAvatar name={item.displayName} src={item.avatarUrl} size={42} />
              <div>
                <div className="tdash-top-users__name">{item.displayName}</div>
                <div className="tdash-top-users__descriptor">{item.descriptor}</div>
              </div>
            </div>

            <div className="tdash-top-users__metric">{formatNumber(item.followersCount)}</div>
            <div className="tdash-top-users__metric">{formatNumber(item.engagementCount)}</div>
            <div className="tdash-top-users__growth">+{Number(item.growthPercent || 0).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </section>
  );
}
