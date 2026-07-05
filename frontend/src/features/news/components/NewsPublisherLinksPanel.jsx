const EXTERNAL_NEWS_LINK_GROUPS = [
  {
    id: "nigeria",
    title: "Nigeria",
    description: "Established Nigerian publisher sites you can open directly for daily coverage.",
    links: [
      {
        label: "Linda Ikeji's Blog",
        href: "https://www.lindaikejisblog.com",
        note: "Local headlines, entertainment, and lifestyle",
      },
      {
        label: "Channels TV",
        href: "https://www.channelstv.com",
        note: "Breaking news from Nigeria and around the world",
      },
      {
        label: "Premium Times",
        href: "https://www.premiumtimesng.com",
        note: "News, investigations, politics, and business",
      },
      {
        label: "Punch",
        href: "https://punchng.com",
        note: "Breaking news, Nigerian news, and top stories",
      },
      {
        label: "Vanguard",
        href: "https://www.vanguardngr.com",
        note: "Nigerian politics, business, sports, and updates",
      },
      {
        label: "TheCable",
        href: "https://www.thecable.ng",
        note: "National news, policy, and business coverage",
      },
      {
        label: "Daily Trust",
        href: "https://dailytrust.com",
        note: "National reporting with strong northern coverage",
      },
    ],
  },
  {
    id: "nigeria-sports",
    title: "Nigeria Sports",
    description: "Free-to-read Nigerian sports reporting, from local leagues to Nigerians competing abroad.",
    links: [
      {
        label: "Complete Sports",
        href: "https://www.completesports.com/",
        note: "Super Eagles, NPFL, Nigerian athletes, and world sport",
      },
      {
        label: "Brila",
        href: "https://brila.net/",
        note: "Nigerian sports news, analysis, interviews, and radio",
      },
      {
        label: "Soccernet Nigeria",
        href: "https://soccernet.ng/",
        note: "Super Eagles, NPFL, transfers, and Nigerians abroad",
      },
      {
        label: "Sports247",
        href: "https://www.sports247.ng/",
        note: "Football, athletics, basketball, and grassroots sport",
      },
      {
        label: "ACLSports",
        href: "https://www.aclsports.com/",
        note: "Nigerian and African football, leagues, and tournaments",
      },
    ],
  },
  {
    id: "international",
    title: "International",
    description: "Free global publisher homepages for world, business, and breaking news.",
    links: [
      {
        label: "Reuters",
        href: "https://www.reuters.com",
        note: "World, markets, technology, and business",
      },
      {
        label: "AP News",
        href: "https://apnews.com",
        note: "Breaking headlines, video, and global updates",
      },
      {
        label: "The Guardian",
        href: "https://www.theguardian.com",
        note: "World news, analysis, culture, and opinion",
      },
      {
        label: "Al Jazeera",
        href: "https://www.aljazeera.com",
        note: "International coverage, live updates, and analysis",
      },
    ],
  },
  {
    id: "international-sports",
    title: "International Sports",
    description: "Free sports news pages covering major leagues, competitions, scores, and analysis worldwide.",
    links: [
      {
        label: "BBC Sport",
        href: "https://www.bbc.com/sport",
        note: "Global sports news, live scores, fixtures, and results",
      },
      {
        label: "Sky Sports",
        href: "https://www.skysports.com/",
        note: "Football, Formula 1, cricket, tennis, rugby, and more",
      },
      {
        label: "ESPN",
        href: "https://www.espn.com/",
        note: "International scores, headlines, leagues, and analysis",
      },
      {
        label: "Yahoo Sports",
        href: "https://sports.yahoo.com/news/",
        note: "Breaking sports news, scores, schedules, and features",
      },
      {
        label: "Goal",
        href: "https://www.goal.com/",
        note: "International football news, transfers, scores, and teams",
      },
    ],
  },
];

export default function NewsPublisherLinksPanel() {
  return (
    <section className="news-link-directory-panel card" aria-label="External news and sports publisher links">
      <div className="news-highlights-header">
        <div>
          <span className="news-highlights-kicker">Open publisher sites</span>
          <h2>Daily news and sports links</h2>
        </div>
        <span className="news-location-pill">External sites open in a new tab</span>
      </div>

      <div className="news-link-directory-grid">
        {EXTERNAL_NEWS_LINK_GROUPS.map((group) => (
          <section key={group.id} className="news-link-directory-group" aria-labelledby={`news-link-group-${group.id}`}>
            <div className="news-highlight-label-row">
              <h3 id={`news-link-group-${group.id}`}>{group.title}</h3>
              <span>{group.description}</span>
            </div>

            <div className="news-link-directory-list">
              {group.links.map((link) => (
                <a
                  key={link.href}
                  className="news-link-directory-item"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="news-topic-link-title">{link.label}</span>
                  <span className="news-topic-link-meta">{link.note}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
