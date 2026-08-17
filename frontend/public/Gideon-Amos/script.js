const journalItems = [
  {
    src: "assets/images/football-polished.jpg",
    category: "community",
    label: "GAADU football",
    title: "The team gathers",
    alt: "Footballers and community members gathered at a GAADU tournament",
  },
  {
    src: "assets/images/community-outreach.jpg",
    category: "community",
    label: "Grassroots outreach",
    title: "Listening in the room",
    alt: "Gideon Amos and community members gathered during a grassroots visit",
  },
  {
    src: "assets/images/faith-fellowship.jpg",
    category: "faith",
    label: "Fellowship",
    title: "Together in faith",
    alt: "Gideon Amos with members of his church community",
  },
  {
    src: "assets/images/family-polished.jpg",
    category: "family",
    label: "Family",
    title: "Side by side",
    alt: "Gideon Amos and his wife standing together beneath a tree",
  },
  {
    src: "assets/images/journey-reflection.jpg",
    category: "journey",
    label: "Journey",
    title: "A moment by the water",
    alt: "Gideon Amos seated beside the water during a journey",
  },
  {
    src: "assets/images/community-cup-presentation.jpg",
    category: "community",
    label: "Sport",
    title: "Presenting the prize",
    alt: "A trophy presentation at the GAADU football tournament",
  },
  {
    src: "assets/images/family-moment.jpg",
    category: "family",
    label: "Everyday life",
    title: "Time shared",
    alt: "Gideon Amos sharing a relaxed meal with his wife",
  },
  {
    src: "assets/images/faith-ministration.jpg",
    category: "faith",
    label: "Worship",
    title: "A song of fellowship",
    alt: "Church worshippers during a ministration",
  },
  {
    src: "assets/images/grassroots-gathering.jpg",
    category: "community",
    label: "Grassroots",
    title: "Community in the frame",
    alt: "A large grassroots community gathering with Gideon Amos",
  },
  {
    src: "assets/images/wedding-memory.jpg",
    category: "family",
    label: "Wedding memory",
    title: "The beginning of a chapter",
    alt: "A wedding portrait of Gideon Amos and his wife",
  },
  {
    src: "assets/images/friends-airport.jpg",
    category: "journey",
    label: "Friendship",
    title: "Friends along the way",
    alt: "Gideon Amos with friends at an airport",
  },
  {
    src: "assets/images/gideon-and-wife.jpg",
    category: "family",
    label: "Partnership",
    title: "A shared adventure",
    alt: "Gideon Amos and his wife during a day out together",
  },
  {
    src: "assets/images/family-mother.jpg",
    category: "family",
    label: "Family roots",
    title: "A treasured portrait",
    alt: "Portrait of Gideon Amos's late mother",
  },
  {
    src: "assets/images/family-son.jpg",
    category: "family",
    label: "Next generation",
    title: "A proud milestone",
    alt: "Gideon Amos's son at a graduation celebration",
  },
  {
    src: "assets/images/journey-with-wife.jpg",
    category: "journey",
    label: "On the road",
    title: "Travelling together",
    alt: "Gideon Amos and his wife seated together on a flight",
  },
  {
    src: "assets/images/family-winter.jpg",
    category: "journey",
    label: "A new season",
    title: "Winter memories",
    alt: "A family moment outdoors during winter",
  },
];

const header = document.querySelector("[data-header]");
const progress = document.querySelector(".page-progress span");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const revealItems = [...document.querySelectorAll("[data-reveal]")];
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const journalGrid = document.querySelector("[data-journal-grid]");
const journalCount = document.querySelector("[data-journal-count]");
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const lightboxTitle = document.querySelector("[data-lightbox-title]");
const lightboxCategory = document.querySelector("[data-lightbox-category]");
const lightboxPosition = document.querySelector("[data-lightbox-position]");
const hero = document.querySelector(".hero");
const heroVisual = document.querySelector(".hero-visual");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let visibleItems = [...journalItems];
let activeLightboxIndex = 0;
let scrollTicking = false;
let touchStartX = 0;
let filterTimer;

const parallaxTargets = [
  document.querySelector(".hero-image-wrap"),
  document.querySelector(".closing"),
].filter(Boolean);

function updateParallax() {
  if (prefersReducedMotion.matches) return;

  const viewportCenter = window.innerHeight / 2;
  parallaxTargets.forEach((target) => {
    const rect = target.getBoundingClientRect();
    if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;

    const elementCenter = rect.top + rect.height / 2;
    const travelRange = viewportCenter + rect.height / 2;
    const normalized = Math.max(-1, Math.min(1, (elementCenter - viewportCenter) / travelRange));
    target.style.setProperty("--image-shift", `${(-normalized * 12).toFixed(2)}px`);
  });
}

function updateScrollUi() {
  const scrollTop = window.scrollY;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = scrollable > 0 ? Math.min(scrollTop / scrollable, 1) : 0;

  header?.classList.toggle("is-scrolled", scrollTop > 24);
  if (progress) progress.style.transform = `scaleX(${ratio})`;
  updateParallax();
  scrollTicking = false;
}

window.addEventListener(
  "scroll",
  () => {
    if (scrollTicking) return;
    window.requestAnimationFrame(updateScrollUi);
    scrollTicking = true;
  },
  { passive: true },
);

function closeMenu() {
  document.body.classList.remove("nav-open");
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Open navigation");
}

menuToggle?.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("nav-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});

nav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 1180) closeMenu();
  updateScrollUi();
});

if (!prefersReducedMotion.matches && window.matchMedia("(pointer: fine)").matches) {
  hero?.addEventListener("pointermove", (event) => {
    const bounds = hero.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    heroVisual.style.transform = `translate3d(${(x * 8).toFixed(1)}px, ${(y * 6).toFixed(1)}px, 0)`;
  });

  hero?.addEventListener("pointerleave", () => {
    heroVisual.style.transform = "translate3d(0, 0, 0)";
  });
}

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -7%", threshold: 0.08 },
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 4, 3) * 55}ms`;
    revealObserver.observe(item);
  });

  const watchedSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const navObserver = new IntersectionObserver(
    (entries) => {
      const activeEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!activeEntry) return;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${activeEntry.target.id}`);
      });
    },
    { rootMargin: "-22% 0px -65%", threshold: [0, 0.12, 0.35] },
  );

  watchedSections.forEach((section) => navObserver.observe(section));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

function createJournalCard(item, index) {
  const card = document.createElement("button");
  const image = document.createElement("img");
  const copy = document.createElement("span");
  const label = document.createElement("span");
  const title = document.createElement("strong");

  card.type = "button";
  card.className = "journal-card";
  card.dataset.itemIndex = String(index);
  card.setAttribute("aria-label", `View ${item.title}`);

  image.src = item.src;
  image.alt = item.alt;
  image.loading = "lazy";
  image.decoding = "async";

  copy.className = "journal-card-copy";
  label.textContent = item.label;
  title.textContent = item.title;
  copy.append(label, title);
  card.append(image, copy);
  return card;
}

function renderJournal(filter = "all") {
  visibleItems = filter === "all"
    ? [...journalItems]
    : journalItems.filter((item) => item.category === filter);

  const fragment = document.createDocumentFragment();
  visibleItems.forEach((item, index) => fragment.appendChild(createJournalCard(item, index)));
  journalGrid?.replaceChildren(fragment);
  if (journalCount) journalCount.textContent = String(visibleItems.length).padStart(2, "0");
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((candidate) => {
      const isActive = candidate === button;
      candidate.classList.toggle("is-active", isActive);
      candidate.setAttribute("aria-pressed", String(isActive));
    });

    window.clearTimeout(filterTimer);
    journalGrid?.classList.add("is-filtering");
    filterTimer = window.setTimeout(() => {
      renderJournal(button.dataset.filter);
      window.requestAnimationFrame(() => journalGrid?.classList.remove("is-filtering"));
    }, prefersReducedMotion.matches ? 0 : 170);
  });
});

function showLightboxItem(index) {
  if (!visibleItems.length) return;
  activeLightboxIndex = (index + visibleItems.length) % visibleItems.length;
  const item = visibleItems[activeLightboxIndex];

  lightboxImage?.classList.remove("lightbox-image-changing");
  if (lightboxImage) {
    void lightboxImage.offsetWidth;
    lightboxImage.src = item.src;
    lightboxImage.alt = item.alt;
    lightboxImage.classList.add("lightbox-image-changing");
  }
  if (lightboxTitle) lightboxTitle.textContent = item.title;
  if (lightboxCategory) lightboxCategory.textContent = item.label;
  if (lightboxPosition) lightboxPosition.textContent = `${activeLightboxIndex + 1} / ${visibleItems.length}`;

  const nextItem = visibleItems[(activeLightboxIndex + 1) % visibleItems.length];
  const preload = new Image();
  preload.src = nextItem.src;
}

function openLightbox(index) {
  showLightboxItem(index);
  if (typeof lightbox?.showModal === "function") lightbox.showModal();
  else lightbox?.setAttribute("open", "");
}

function closeLightbox() {
  if (typeof lightbox?.close === "function") lightbox.close();
  else lightbox?.removeAttribute("open");
}

journalGrid?.addEventListener("click", (event) => {
  const card = event.target.closest(".journal-card");
  if (!card) return;
  openLightbox(Number(card.dataset.itemIndex));
});

document.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
document.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => showLightboxItem(activeLightboxIndex - 1));
document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => showLightboxItem(activeLightboxIndex + 1));

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

lightbox?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showLightboxItem(activeLightboxIndex - 1);
  if (event.key === "ArrowRight") showLightboxItem(activeLightboxIndex + 1);
});

lightbox?.addEventListener(
  "touchstart",
  (event) => {
    touchStartX = event.changedTouches[0].clientX;
  },
  { passive: true },
);

lightbox?.addEventListener(
  "touchend",
  (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) < 55) return;
    showLightboxItem(activeLightboxIndex + (distance < 0 ? 1 : -1));
  },
  { passive: true },
);

const year = document.querySelector("[data-year]");
if (year) year.textContent = new Date().getFullYear();

renderJournal();
updateScrollUi();
