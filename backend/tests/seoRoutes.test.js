const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-seo-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";

const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const User = require("../models/User");

let mongod;
let server;

const frontendDistPath = path.resolve(__dirname, "..", "..", "frontend", "dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

const ensureFrontendTemplate = () => {
  if (fs.existsSync(frontendIndexPath)) {
    return;
  }

  fs.mkdirSync(frontendDistPath, { recursive: true });
  fs.writeFileSync(
    frontendIndexPath,
    `<!doctype html>
<html lang="en">
  <head>
    <title data-seo-key="title">Tengacion</title>
    <meta name="description" content="Tengacion" data-seo-key="description" />
    <link rel="canonical" href="https://tengacion.com/" data-seo-key="canonical" />
    <meta name="robots" content="index,follow" data-seo-key="robots" />
    <meta property="og:title" content="Tengacion" data-seo-key="og:title" />
    <meta property="og:description" content="Tengacion" data-seo-key="og:description" />
    <meta property="og:type" content="website" data-seo-key="og:type" />
    <meta property="og:url" content="https://tengacion.com/" data-seo-key="og:url" />
    <meta property="og:image" content="https://tengacion.com/tengacion_logo_1024.png" data-seo-key="og:image" />
    <meta property="og:image:alt" content="Tengacion preview image" data-seo-key="og:image:alt" />
    <meta name="twitter:card" content="summary_large_image" data-seo-key="twitter:card" />
    <meta name="twitter:title" content="Tengacion" data-seo-key="twitter:title" />
    <meta name="twitter:description" content="Tengacion" data-seo-key="twitter:description" />
    <meta name="twitter:image" content="https://tengacion.com/tengacion_logo_1024.png" data-seo-key="twitter:image" />
    <meta name="twitter:image:alt" content="Tengacion preview image" data-seo-key="twitter:image:alt" />
    <script type="application/ld+json" data-seo-key="structured-data">[]</script>
  </head>
  <body>
    <div id="root">
      <div id="boot-loader" data-seo-key="boot-preview">Loading Tengacion...</div>
    </div>
  </body>
</html>`,
    "utf8"
  );
};

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        sessions: {
          sessionId,
          createdAt: new Date(),
          lastSeenAt: new Date(),
        },
      },
    }
  );

  return jwt.sign(
    {
      id: userId.toString(),
      tv: 0,
      sid: sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

const createCreator = async () => {
  const user = await User.create({
    name: "SEO Creator",
    username: "seo_creator",
    email: "seo-creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "SEO Creator",
    fullName: "SEO Creator",
    phoneNumber: "08000000000",
    accountNumber: "1234567890",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    creatorTypes: ["music", "bookPublishing", "podcast"],
    acceptedTerms: true,
    acceptedCopyrightDeclaration: true,
    onboardingCompleted: true,
    onboardingComplete: true,
    status: "active",
    heroBannerUrl: "https://example.com/banner.jpg",
    bio: "Independent creator across music and books.",
  });

  return { user, profile, token: await issueSessionToken(user._id) };
};

describe("SEO routes", () => {
  beforeAll(async () => {
    ensureFrontendTemplate();

    mongod = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 },
    });

    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });

    server = require("../server");
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect().catch(() => null);
    if (mongod) {
      await mongod.stop();
    }
  });

  test("robots.txt is served with sitemap reference and private disallows", async () => {
    const response = await request(server).get("/robots.txt").expect(200);

    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("User-agent: *");
    expect(response.text).toContain("Disallow: /login");
    expect(response.text).toContain("Disallow: /admin");
    expect(response.text).toContain("Sitemap: https://tengacion.com/sitemap.xml");
  });

  test("public creators discovery route renders default crawlable metadata", async () => {
    const response = await request(server).get("/creators").expect(200);

    expect(response.text).toContain(
      '<title data-seo-key="title">Discover African Creators, Music, Books &amp; Podcasts | Tengacion</title>'
    );
    expect(response.text).toContain(
      'content="Browse Tengacion creators across music, books, and podcasts. Discover African artists, authors, and podcast hosts to follow and support."'
    );
    expect(response.text).toContain('href="https://tengacion.com/creators"');
    expect(response.text).toContain('content="index,follow"');
  });

  test("sitemap.xml lists public discovery, creator, and content routes", async () => {
    const { profile } = await createCreator();
    const track = await Track.create({
      creatorId: profile._id,
      title: "SEO Single",
      description: "Public music release",
      price: 0,
      audioUrl: "https://example.com/song.mp3",
      previewUrl: "https://example.com/song-preview.mp3",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });
    const book = await Book.create({
      creatorId: profile._id,
      title: "SEO Book",
      description: "Public book release",
      price: 0,
      contentUrl: "https://example.com/book.pdf",
      previewUrl: "https://example.com/book-preview.pdf",
      fileFormat: "pdf",
      publishedStatus: "published",
      isPublished: true,
    });
    const album = await Album.create({
      creatorId: profile._id,
      title: "SEO Album",
      description: "Public album release",
      price: 0,
      coverUrl: "https://example.com/album.jpg",
      tracks: [
        {
          title: "Track One",
          trackUrl: "https://example.com/album-track.mp3",
          previewUrl: "https://example.com/album-preview.mp3",
          order: 1,
        },
      ],
      totalTracks: 1,
      status: "published",
      publishedStatus: "published",
      isPublished: true,
    });

    const response = await request(server).get("/sitemap.xml").expect(200);

    expect(response.headers["content-type"]).toContain("application/xml");
    expect(response.text).toContain("<loc>https://tengacion.com/creators</loc>");
    expect(response.text).toContain(`<loc>https://tengacion.com/creators/${profile._id}</loc>`);
    expect(response.text).toContain(`<loc>https://tengacion.com/tracks/${track._id}</loc>`);
    expect(response.text).toContain(`<loc>https://tengacion.com/books/${book._id}</loc>`);
    expect(response.text).toContain(`<loc>https://tengacion.com/albums/${album._id}</loc>`);
  });

  test("public track pages render server-injected SEO tags", async () => {
    const { profile } = await createCreator();
    const track = await Track.create({
      creatorId: profile._id,
      title: "Meta Ready Single",
      description: "A track with SEO metadata",
      price: 0,
      audioUrl: "https://example.com/track.mp3",
      previewUrl: "https://example.com/track-preview.mp3",
      coverImageUrl: "https://example.com/cover.jpg",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });

    const response = await request(server).get(`/tracks/${track._id}`).expect(200);

    expect(response.text).toContain('<title data-seo-key="title">Meta Ready Single by SEO Creator | Tengacion</title>');
    expect(response.text).toContain('content="A track with SEO metadata"');
    expect(response.text).toContain(`href="https://tengacion.com/tracks/${track._id}"`);
    expect(response.text).toContain('content="music.song"');
  });

  test("private login and settings routes render noindex metadata", async () => {
    const loginResponse = await request(server).get("/login").expect(200);
    const settingsResponse = await request(server).get("/settings").expect(200);

    expect(loginResponse.text).toContain('content="noindex,nofollow"');
    expect(loginResponse.headers["x-robots-tag"]).toContain("noindex,nofollow");
    expect(settingsResponse.text).toContain('content="noindex,nofollow"');
    expect(settingsResponse.headers["x-robots-tag"]).toContain("noindex,nofollow");
  });
});
