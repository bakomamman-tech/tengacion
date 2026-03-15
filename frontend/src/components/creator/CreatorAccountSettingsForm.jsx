import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { COUNTRY_OPTIONS } from "../../constants/countries";
import CreatorTypeSelector from "./CreatorTypeSelector";

const socialHandleSchema = z.object({
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  x: z.string().optional(),
  threads: z.string().optional(),
  youtube: z.string().optional(),
});

const musicProfileSchema = z.object({
  primaryGenre: z.string().optional(),
  recordLabel: z.string().optional(),
  artistBio: z.string().optional(),
});

const booksProfileSchema = z.object({
  penName: z.string().optional(),
  primaryGenre: z.string().optional(),
  publisherName: z.string().optional(),
  authorBio: z.string().optional(),
});

const podcastsProfileSchema = z.object({
  podcastName: z.string().optional(),
  hostName: z.string().optional(),
  themeOrTopic: z.string().optional(),
  seriesTitle: z.string().optional(),
  description: z.string().optional(),
});

const settingsSchema = z.object({
  fullName: z.string().trim().min(2, "Full Name is required"),
  displayName: z.string().trim().min(2, "Artist stage name is required"),
  phoneNumber: z.string().trim().min(5, "Phone Number is required"),
  accountNumber: z.string().trim().min(5, "Bank Account Number is required"),
  country: z.string().trim().min(2, "Country is required"),
  countryOfResidence: z.string().trim().min(2, "Country of Residence is required"),
  tagline: z.string().max(200, "Tagline cannot exceed 200 characters").optional(),
  bio: z.string().max(2000, "Bio cannot exceed 2000 characters").optional(),
  genresRaw: z.string().optional(),
  socialHandles: socialHandleSchema,
  creatorTypes: z.array(z.enum(["music", "books", "podcasts"])).min(1, "Select at least one creator category"),
  musicProfile: musicProfileSchema,
  booksProfile: booksProfileSchema,
  podcastsProfile: podcastsProfileSchema,
});

const DEFAULT_VALUES = {
  fullName: "",
  displayName: "",
  phoneNumber: "",
  accountNumber: "",
  country: "",
  countryOfResidence: "",
  tagline: "",
  bio: "",
  genresRaw: "",
  creatorTypes: [],
  socialHandles: {
    facebook: "",
    instagram: "",
    linkedin: "",
    x: "",
    threads: "",
    youtube: "",
  },
  musicProfile: {
    primaryGenre: "",
    recordLabel: "",
    artistBio: "",
  },
  booksProfile: {
    penName: "",
    primaryGenre: "",
    publisherName: "",
    authorBio: "",
  },
  podcastsProfile: {
    podcastName: "",
    hostName: "",
    themeOrTopic: "",
    seriesTitle: "",
    description: "",
  },
};

const toDefaultValues = (initialValues = {}) => ({
  ...DEFAULT_VALUES,
  ...initialValues,
  genresRaw: Array.isArray(initialValues?.genres) ? initialValues.genres.join(", ") : "",
  creatorTypes: Array.isArray(initialValues?.creatorTypes) ? initialValues.creatorTypes : [],
  socialHandles: {
    ...DEFAULT_VALUES.socialHandles,
    ...(initialValues?.socialHandles || {}),
  },
  musicProfile: {
    ...DEFAULT_VALUES.musicProfile,
    ...(initialValues?.musicProfile || {}),
  },
  booksProfile: {
    ...DEFAULT_VALUES.booksProfile,
    ...(initialValues?.booksProfile || {}),
  },
  podcastsProfile: {
    ...DEFAULT_VALUES.podcastsProfile,
    ...(initialValues?.podcastsProfile || {}),
  },
});

const normalizeGenres = (value = "") =>
  [...new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  )].slice(0, 12);

export default function CreatorAccountSettingsForm({
  initialValues = {},
  submitLabel = "Save creator profile",
  loading = false,
  onSubmit,
}) {
  const form = useForm({
    resolver: zodResolver(settingsSchema),
    mode: "onChange",
    defaultValues: toDefaultValues(initialValues),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = form;

  useEffect(() => {
    reset(toDefaultValues(initialValues));
  }, [initialValues, reset]);

  const values = watch();
  const creatorTypes = Array.isArray(values.creatorTypes) ? values.creatorTypes : [];

  const categoryCards = useMemo(
    () => ({
      music: {
        title: "Music profile",
        caption: "Set the artist-facing details that should support your music releases and fan profile.",
        className: "music",
      },
      books: {
        title: "Book publishing profile",
        caption: "Add the identity and publishing details readers should see across your books.",
        className: "books",
      },
      podcasts: {
        title: "Podcast profile",
        caption: "Define the podcast name, host identity, and theme that should guide your spoken-word uploads.",
        className: "podcasts",
      },
    }),
    []
  );

  const handleFormSubmit = (payload) =>
    onSubmit({
      ...payload,
      genres: normalizeGenres(payload.genresRaw),
      acceptedTerms: Boolean(initialValues?.acceptedTerms),
      acceptedCopyrightDeclaration: Boolean(initialValues?.acceptedCopyrightDeclaration),
    });

  return (
    <form className="creator-settings-stack" onSubmit={handleSubmit(handleFormSubmit)}>
      <section className="creator-form-card">
        <div className="creator-form-block-head">
          <div>
            <h3>Public creator identity</h3>
            <p>Control the names, payout details, and fan-facing information shown across your creator workspace.</p>
          </div>
        </div>

        <div className="creator-form-grid">
          <label>
            <span>Full Name</span>
            <input {...register("fullName")} placeholder="Your legal or payout name" />
            {errors.fullName ? <em className="creator-field-error">{errors.fullName.message}</em> : null}
          </label>
          <label>
            <span>Artist stage name / public creator name</span>
            <input {...register("displayName")} placeholder="The name fans will see on Tengacion" />
            <small className="creator-field-hint">This is the fan-facing name used on your public profile and releases.</small>
            {errors.displayName ? <em className="creator-field-error">{errors.displayName.message}</em> : null}
          </label>
          <label>
            <span>Phone Number</span>
            <input {...register("phoneNumber")} placeholder="Reachable phone number" />
            {errors.phoneNumber ? <em className="creator-field-error">{errors.phoneNumber.message}</em> : null}
          </label>
          <label>
            <span>Bank Account Number</span>
            <input {...register("accountNumber")} placeholder="Payout account number" />
            {errors.accountNumber ? <em className="creator-field-error">{errors.accountNumber.message}</em> : null}
          </label>
          <label>
            <span>Country</span>
            <select {...register("country")}>
              <option value="">Select country</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            {errors.country ? <em className="creator-field-error">{errors.country.message}</em> : null}
          </label>
          <label>
            <span>Country of Residence</span>
            <select {...register("countryOfResidence")}>
              <option value="">Select country of residence</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            {errors.countryOfResidence ? (
              <em className="creator-field-error">{errors.countryOfResidence.message}</em>
            ) : null}
          </label>
          <label>
            <span>Creator tagline</span>
            <input {...register("tagline")} placeholder="Short line that introduces your creator brand" />
          </label>
          <label>
            <span>Genres / categories</span>
            <input {...register("genresRaw")} placeholder="Afrobeats, Romance, Lifestyle, Tech" />
            <small className="creator-field-hint">Separate multiple genres or topics with commas.</small>
          </label>
          <label className="creator-form-full">
            <span>Creator bio</span>
            <textarea {...register("bio")} placeholder="Tell fans and review teams about your creator profile." />
          </label>
        </div>
      </section>

      <section className="creator-form-card">
        <div className="creator-form-block-head">
          <div>
            <h3>Enabled creator lanes</h3>
            <p>Choose the content types this creator profile should support across uploads and dashboards.</p>
          </div>
        </div>

        <CreatorTypeSelector
          value={creatorTypes}
          onChange={(next) => setValue("creatorTypes", next, { shouldValidate: true, shouldDirty: true })}
          error={errors.creatorTypes?.message}
        />
      </section>

      <section className="creator-form-card">
        <div className="creator-form-block-head">
          <div>
            <h3>Social media handles</h3>
            <p>Paste handles or full profile URLs so fans and review teams can verify your presence.</p>
          </div>
        </div>

        <div className="creator-form-grid">
          <label>
            <span>Facebook</span>
            <input {...register("socialHandles.facebook")} placeholder="facebook handle or profile URL" />
          </label>
          <label>
            <span>Instagram</span>
            <input {...register("socialHandles.instagram")} placeholder="instagram handle or profile URL" />
          </label>
          <label>
            <span>LinkedIn</span>
            <input {...register("socialHandles.linkedin")} placeholder="linkedin profile or URL" />
          </label>
          <label>
            <span>X</span>
            <input {...register("socialHandles.x")} placeholder="x handle or profile URL" />
          </label>
          <label>
            <span>Threads</span>
            <input {...register("socialHandles.threads")} placeholder="threads handle or profile URL" />
          </label>
          <label>
            <span>YouTube</span>
            <input {...register("socialHandles.youtube")} placeholder="youtube handle or channel URL" />
          </label>
        </div>
      </section>

      {creatorTypes.includes("music") ? (
        <section className={`creator-form-card creator-category-form ${categoryCards.music.className}`}>
          <div className="creator-form-block-head">
            <div>
              <h3>{categoryCards.music.title}</h3>
              <p>{categoryCards.music.caption}</p>
            </div>
          </div>

          <div className="creator-form-grid">
            <label>
              <span>Primary music genre</span>
              <input {...register("musicProfile.primaryGenre")} placeholder="Afrobeats, Gospel, R&B" />
            </label>
            <label>
              <span>Record label / collective</span>
              <input {...register("musicProfile.recordLabel")} placeholder="Optional label or collective name" />
            </label>
            <label className="creator-form-full">
              <span>Artist bio</span>
              <textarea
                {...register("musicProfile.artistBio")}
                placeholder="Add the artist story fans should see around your music releases."
              />
            </label>
          </div>
        </section>
      ) : null}

      {creatorTypes.includes("books") ? (
        <section className={`creator-form-card creator-category-form ${categoryCards.books.className}`}>
          <div className="creator-form-block-head">
            <div>
              <h3>{categoryCards.books.title}</h3>
              <p>{categoryCards.books.caption}</p>
            </div>
          </div>

          <div className="creator-form-grid">
            <label>
              <span>Pen Name</span>
              <input {...register("booksProfile.penName")} placeholder="The author name readers should see" />
            </label>
            <label>
              <span>Primary book genre</span>
              <input {...register("booksProfile.primaryGenre")} placeholder="Romance, Thriller, Devotional" />
            </label>
            <label>
              <span>Publisher / imprint name</span>
              <input {...register("booksProfile.publisherName")} placeholder="Optional publisher or imprint" />
            </label>
            <label className="creator-form-full">
              <span>Author bio</span>
              <textarea
                {...register("booksProfile.authorBio")}
                placeholder="Introduce the author behind your book publishing profile."
              />
            </label>
          </div>
        </section>
      ) : null}

      {creatorTypes.includes("podcasts") ? (
        <section className={`creator-form-card creator-category-form ${categoryCards.podcasts.className}`}>
          <div className="creator-form-block-head">
            <div>
              <h3>{categoryCards.podcasts.title}</h3>
              <p>{categoryCards.podcasts.caption}</p>
            </div>
          </div>

          <div className="creator-form-grid">
            <label>
              <span>Podcast name</span>
              <input {...register("podcastsProfile.podcastName")} placeholder="The show name listeners should see" />
            </label>
            <label>
              <span>Host name</span>
              <input {...register("podcastsProfile.hostName")} placeholder="Main host or presenter name" />
            </label>
            <label>
              <span>Theme or topic</span>
              <input {...register("podcastsProfile.themeOrTopic")} placeholder="Culture, faith, business, lifestyle" />
            </label>
            <label>
              <span>Podcast series title</span>
              <input {...register("podcastsProfile.seriesTitle")} placeholder="Default series or season title" />
            </label>
            <label className="creator-form-full">
              <span>Podcast description</span>
              <textarea
                {...register("podcastsProfile.description")}
                placeholder="Describe your podcast, the audience, and what each episode covers."
              />
            </label>
          </div>
        </section>
      ) : null}

      <div className="creator-form-actions">
        <button type="submit" className="creator-primary-btn" disabled={!isValid || loading}>
          {loading ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
