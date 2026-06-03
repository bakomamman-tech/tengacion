const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-book-preview-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "book_preview_test_secret_123456789012";

const app = require("../app");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter");
const CreatorProfile = require("../models/CreatorProfile");
const Entitlement = require("../models/Entitlement");
const User = require("../models/User");

let mongod;

const parseBinary = (res, callback) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

const createPdfDataUrl = async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const first = pdf.addPage([595, 842]);
  first.drawText("Chapter One - Preview Page", {
    x: 72,
    y: 720,
    size: 22,
    font,
  });
  const second = pdf.addPage([595, 842]);
  second.drawText("Paid-only second page", {
    x: 72,
    y: 720,
    size: 22,
    font,
  });

  const bytes = await pdf.save();
  return `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
};

const createCreatorProfile = async () => {
  const user = await User.create({
    name: "Preview Author",
    username: "preview_author",
    email: "preview-author@test.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
    emailVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Preview Author",
    creatorTypes: ["bookPublishing"],
    acceptedTerms: true,
    acceptedCopyrightDeclaration: true,
    status: "active",
  });

  return { user, profile };
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

const createViewer = async () => {
  const user = await User.create({
    name: "Paid Reader",
    username: "paid_reader",
    email: "paid-reader@test.com",
    password: "Password123!",
    role: "user",
    isVerified: true,
    emailVerified: true,
  });

  return { user, token: await issueSessionToken(user._id) };
};

describe("book preview access", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 },
    });

    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) {
        await mongod.stop();
      }
    }
  });

  test("GET /api/books/:bookId/preview serves the opening PDF preview section", async () => {
    const { profile } = await createCreatorProfile();
    const pdfDataUrl = await createPdfDataUrl();
    const book = await Book.create({
      creatorId: profile._id,
      title: "Paid Preview PDF",
      description: "Premium book release",
      price: 1800,
      priceNGN: 1800,
      contentUrl: pdfDataUrl,
      fileUrl: pdfDataUrl,
      fileFormat: "pdf",
      contentType: "pdf_book",
      publishedStatus: "published",
      isPublished: true,
    });

    const response = await request(app)
      .get(`/api/books/${book._id}/preview`)
      .buffer(true)
      .parse(parseBinary)
      .expect(200);

    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("inline;");

    const previewPdf = await PDFDocument.load(response.body);
    expect(previewPdf.getPageCount()).toBe(2);

    const streamResponse = await request(app)
      .get(`/api/stream/book/${book._id}`)
      .expect(200);

    expect(streamResponse.body.previewOnly).toBe(true);
    expect(streamResponse.body.streamUrl).toContain(`/api/books/${book._id}/preview`);
    expect(streamResponse.body.streamUrl).not.toContain("/api/media/delivery/");
  });

  test("GET /api/stream/book/:bookId serves paid full PDFs inline for the app reader", async () => {
    const { profile } = await createCreatorProfile();
    const { user, token } = await createViewer();
    const pdfDataUrl = await createPdfDataUrl();
    const book = await Book.create({
      creatorId: profile._id,
      title: "Paid Full PDF",
      description: "Premium book release",
      price: 1800,
      priceNGN: 1800,
      contentUrl: pdfDataUrl,
      fileUrl: pdfDataUrl,
      contentMedia: {
        originalFilename: "Paid Full PDF.pdf",
        format: "pdf",
      },
      fileFormat: "pdf",
      contentType: "pdf_book",
      publishedStatus: "published",
      isPublished: true,
    });

    await Entitlement.create({
      buyerId: user._id,
      itemType: "book",
      itemId: book._id,
    });

    const streamResponse = await request(app)
      .get(`/api/stream/book/${book._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(streamResponse.body.canAccessFull).toBe(true);
    expect(streamResponse.body.previewOnly).toBe(false);
    expect(streamResponse.body.streamUrl).toContain("/api/media/delivery/");

    const streamPath = new URL(streamResponse.body.streamUrl).pathname;
    const pdfResponse = await request(app)
      .get(streamPath)
      .buffer(true)
      .parse(parseBinary)
      .expect(200);

    expect(pdfResponse.headers["content-type"]).toContain("application/pdf");
    expect(pdfResponse.headers["content-disposition"]).toContain("inline;");
    expect(pdfResponse.headers["content-disposition"]).toContain("Paid Full PDF.pdf");

    const fullPdf = await PDFDocument.load(pdfResponse.body);
    expect(fullPdf.getPageCount()).toBe(2);
  });

  test("unpaid chapter reading exposes chapter one only", async () => {
    const { profile } = await createCreatorProfile();
    const book = await Book.create({
      creatorId: profile._id,
      title: "Paid Chapter Book",
      description: "Premium text release",
      price: 1800,
      priceNGN: 1800,
      contentUrl: "https://cdn.test/books/full.pdf",
      fileFormat: "pdf",
      contentType: "pdf_book",
      publishedStatus: "published",
      isPublished: true,
    });
    const firstChapter = await Chapter.create({
      bookId: book._id,
      title: "The Beginning",
      order: 1,
      isFree: true,
      content: "This is the first preview page.\n\nIt is readable before payment.\fPaid-only continuation starts here.",
    });
    const secondChapter = await Chapter.create({
      bookId: book._id,
      title: "The Secret",
      order: 2,
      isFree: true,
      content: "This chapter must remain locked until payment.",
    });

    const chaptersResponse = await request(app)
      .get(`/api/books/${book._id}/chapters`)
      .expect(200);

    expect(chaptersResponse.body).toEqual([
      expect.objectContaining({
        _id: firstChapter._id.toString(),
        locked: false,
        previewOnly: true,
        previewText: "This is the first preview page.\n\nIt is readable before payment.\fPaid-only continuation starts here.",
      }),
      expect.objectContaining({
        _id: secondChapter._id.toString(),
        locked: true,
        previewOnly: false,
      }),
    ]);

    const firstResponse = await request(app)
      .get(`/api/books/${book._id}/chapters/${firstChapter._id}`)
      .expect(200);

    expect(firstResponse.body.previewOnly).toBe(true);
    expect(firstResponse.body.content).toBe(
      "This is the first preview page.\n\nIt is readable before payment.\fPaid-only continuation starts here."
    );

    await request(app)
      .get(`/api/books/${book._id}/chapters/${secondChapter._id}`)
      .expect(402);
  });
});
