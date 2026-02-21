import StoriesSkeleton from "./components/StoriesSkeleton";

export default function Stories({ loading }) {
  if (loading) {return <StoriesSkeleton />;}

  const stories = [
    { name: "Daniel", image: "/story1.jpg", avatar: "/me.jpg" },
    { name: "Anna", image: "/story2.jpg", avatar: "/a.jpg" },
    { name: "John", image: "/story3.jpg", avatar: "/b.jpg" }
  ];

  return (
    <div className="stories-bar">
      {/* Create Story */}
      <div className="story add-story">
        <div style={{ fontSize: "36px", marginBottom: "10px" }}>+</div>
        <div style={{ fontSize: "14px", fontWeight: "600" }}>
          Create Story
        </div>
      </div>

      {/* User Stories */}
      {stories.map((s, i) => (
        <div
          key={i}
          className="story"
          style={{ backgroundImage: `url(${s.image})` }}
        >
          <img
            src={s.avatar}
            className="story-avatar"
            alt={s.name}
          />
          <div className="story-name">{s.name}</div>
        </div>
      ))}
    </div>
  );
}
