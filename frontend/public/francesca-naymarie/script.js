const journalItems = [
  {
    src: "assets/images/kifc-team.jpg",
    category: "leadership",
    label: "KIFC leadership",
    title: "Partnerships for progress",
    alt: "Francesca Musa-Akande with KIFC colleagues and partners",
  },
  {
    src: "assets/images/maff-winner-1.jpg",
    category: "maff",
    label: "MAFF",
    title: "Backing a student founder",
    alt: "A student founder receiving a MAFF entrepreneurship grant",
  },
  {
    src: "assets/images/girl-child-audience.jpg",
    category: "advocacy",
    label: "Girl-child advocacy",
    title: "A room full of possibility",
    alt: "A community audience listening during a girl-child advocacy event",
  },
  {
    src: "assets/images/kifc-staff.jpg",
    category: "leadership",
    label: "KIFC leadership",
    title: "Celebrating the team",
    alt: "Francesca Musa-Akande recognizing staff members at KIFC",
  },
  {
    src: "assets/images/youth-summit-team.jpg",
    category: "advocacy",
    label: "Youth enterprise",
    title: "Kaduna's young entrepreneurs",
    alt: "Francesca Musa-Akande with participants at the Young Entrepreneurs Summit Kaduna",
  },
  {
    src: "assets/images/maff-winner-2.jpg",
    category: "maff",
    label: "MAFF",
    title: "The courage to begin",
    alt: "A MAFF Student Entrepreneurship Grant winner holding a ceremonial cheque",
  },
  {
    src: "assets/images/civic-journalists.jpg",
    category: "civic",
    label: "Civic life",
    title: "In conversation with the press",
    alt: "Francesca Musa-Akande answering questions from journalists",
  },
  {
    src: "assets/images/maff-community.jpg",
    category: "maff",
    label: "MAFF",
    title: "A community of believers",
    alt: "Francesca Musa-Akande with MAFF guests and supporters",
  },
  {
    src: "assets/images/health-clinic.jpg",
    category: "advocacy",
    label: "Community health",
    title: "Care, closer to home",
    alt: "The interior of the PHC Sabon Tasha community health facility",
  },
  {
    src: "assets/images/kifc-minister.jpg",
    category: "leadership",
    label: "KIFC leadership",
    title: "Public-sector partnership",
    alt: "A KIFC courtesy visit with public-sector leaders",
  },
  {
    src: "assets/images/honour-recipient.jpg",
    category: "recognition",
    label: "Recognition",
    title: "Honouring another's work",
    alt: "An honouree embracing Francesca Musa-Akande at an awards event",
  },
  {
    src: "assets/images/youth-market-1.jpg",
    category: "advocacy",
    label: "Youth enterprise",
    title: "Enterprise on the ground",
    alt: "Francesca Musa-Akande visiting a young entrepreneur's market stand",
  },
  {
    src: "assets/images/maff-winner-3.jpg",
    category: "maff",
    label: "MAFF",
    title: "Ideas meet opportunity",
    alt: "A student entrepreneur receiving a MAFF grant",
  },
  {
    src: "assets/images/kifc-vendors.jpg",
    category: "leadership",
    label: "KIFC leadership",
    title: "Listening to enterprise",
    alt: "KIFC hosting an International Vendors Hub delegation",
  },
  {
    src: "assets/images/life-generations.jpg",
    category: "life",
    label: "Life & family",
    title: "Across generations",
    alt: "A warm family moment across generations",
  },
  {
    src: "assets/images/girl-child-moment.jpg",
    category: "advocacy",
    label: "Girl-child advocacy",
    title: "Every girl, fully seen",
    alt: "Francesca Musa-Akande at a girl-child advocacy gathering",
  },
  {
    src: "assets/images/honour-plaque.jpg",
    category: "recognition",
    label: "Recognition",
    title: "A moment of recognition",
    alt: "Francesca Musa-Akande receiving a commemorative plaque",
  },
  {
    src: "assets/images/maff-winner-4.jpg",
    category: "maff",
    label: "MAFF",
    title: "Capital for the next step",
    alt: "A MAFF grant winner with Francesca Musa-Akande on stage",
  },
  {
    src: "assets/images/civic-community.jpg",
    category: "civic",
    label: "Civic life",
    title: "Community in the room",
    alt: "Francesca Musa-Akande with women at a civic gathering",
  },
  {
    src: "assets/images/kifc-document.jpg",
    category: "leadership",
    label: "KIFC leadership",
    title: "From agreement to action",
    alt: "Francesca Musa-Akande and partners presenting signed documents at KIFC",
  },
  {
    src: "assets/images/life-celebration.jpg",
    category: "life",
    label: "Life & family",
    title: "Joy in the everyday",
    alt: "Francesca Musa-Akande smiling at a family celebration",
  },
  {
    src: "assets/images/maff-winner-5.jpg",
    category: "maff",
    label: "MAFF",
    title: "A footprint begins",
    alt: "A young entrepreneur holding a MAFF grant cheque",
  },
  {
    src: "assets/images/youth-summit-panel.jpg",
    category: "advocacy",
    label: "Youth enterprise",
    title: "Speaking to the next generation",
    alt: "Francesca Musa-Akande speaking at the Young Entrepreneurs Summit Kaduna",
  },
  {
    src: "assets/images/life-wedding.jpg",
    category: "life",
    label: "Life & community",
    title: "Saturdays and celebration",
    alt: "A joyful community wedding moment",
  },
  {
    src: "assets/images/honour-presentation.jpg",
    category: "recognition",
    label: "Recognition",
    title: "Celebrating public spirit",
    alt: "Francesca Musa-Akande presenting an honour at an awards gathering",
  },
  {
    src: "assets/images/health-facility.jpg",
    category: "advocacy",
    label: "Community health",
    title: "Infrastructure that cares",
    alt: "The exterior of a revitalised primary health care facility",
  },
  {
    src: "assets/images/kifc-conversation.jpg",
    category: "leadership",
    label: "KIFC leadership",
    title: "Open doors, open dialogue",
    alt: "Francesca Musa-Akande during a creative-sector courtesy visit to KIFC",
  },
  {
    src: "assets/images/life-milestone.jpg",
    category: "life",
    label: "Life & family",
    title: "A milestone shared",
    alt: "Francesca Musa-Akande at a milestone birthday celebration",
  },
  {
    src: "assets/images/maff-mentors.jpg",
    category: "maff",
    label: "MAFF",
    title: "A circle of encouragement",
    alt: "Francesca Musa-Akande with guests at a MAFF celebration",
  },
  {
    src: "assets/images/kifc-meeting.jpg",
    category: "leadership",
    label: "KIFC leadership",
    title: "The work around the table",
    alt: "A working meeting led by Francesca Musa-Akande at KIFC",
  },
  {
    src: "assets/images/civic-network.jpg",
    category: "civic",
    label: "Civic life",
    title: "Young voices in public life",
    alt: "Francesca Musa-Akande with members of a youth civic network",
  },
  {
    src: "assets/images/portrait-kaduna.jpg",
    category: "life",
    label: "Portrait",
    title: "At home in Kaduna",
    alt: "Portrait of Francesca Musa-Akande overlooking Kaduna",
  },
  {
    src: "assets/images/family/dr-dare-akande-birthday.jpg",
    category: "life",
    label: "Dr. Dare Akande",
    title: "A joyful celebration",
    alt: "Portrait of Dr. Dare Akande smiling at a family birthday celebration",
  },
  {
    src: "assets/images/family/francesca-dare-birthday-moment.jpg",
    category: "life",
    label: "Family moments",
    title: "Side by side",
    alt: "Francesca Naymarie Musa-Akande with her husband, Dr. Dare Akande, at a birthday gathering",
  },
  {
    src: "assets/images/family/francesca-dare-birthday-address.jpg",
    category: "life",
    label: "Family moments",
    title: "Words for the moment",
    alt: "Dr. Dare Akande speaking with Francesca Naymarie Musa-Akande beside him",
  },
  {
    src: "assets/images/family/francesca-dare-birthday-gratitude.jpg",
    category: "life",
    label: "Family moments",
    title: "Celebrating together",
    alt: "Francesca Naymarie Musa-Akande speaking with Dr. Dare Akande standing beside her",
  },
  {
    src: "assets/images/family/francesca-dare-celebration-pink.jpg",
    category: "life",
    label: "Francesca & Dr. Dare",
    title: "A shared celebration",
    alt: "Francesca Naymarie Musa-Akande and Dr. Dare Akande sharing a celebration",
  },
  {
    src: "assets/images/family/francesca-dare-at-home.jpg",
    category: "life",
    label: "Francesca & Dr. Dare",
    title: "At home, together",
    alt: "Francesca Naymarie Musa-Akande and Dr. Dare Akande at home together",
  },
  {
    src: "assets/images/family/francesca-dare-evening.jpg",
    category: "life",
    label: "Francesca & Dr. Dare",
    title: "An evening together",
    alt: "Francesca Naymarie Musa-Akande and Dr. Dare Akande at an evening gathering",
  },
  {
    src: "assets/images/family/dr-dare-akande-formal.jpg",
    category: "life",
    label: "Dr. Dare Akande",
    title: "A formal moment",
    alt: "Dr. Dare Akande wearing a white dinner jacket and burgundy bow tie",
  },
  {
    src: "assets/images/family/francesca-wedding-portrait.jpg",
    category: "life",
    label: "Wedding memory",
    title: "The beginning of a chapter",
    alt: "A black-and-white bridal portrait of Francesca Naymarie Musa-Akande",
  },
  {
    src: "assets/images/family/dr-dare-akande-arrival.jpg",
    category: "life",
    label: "Dr. Dare Akande",
    title: "A portrait in motion",
    alt: "Dr. Dare Akande arriving in traditional attire",
  },
  {
    src: "assets/images/family/francesca-dare-shared-adventure.jpg",
    category: "life",
    label: "Francesca & Dr. Dare",
    title: "Shared adventures",
    alt: "Dr. Dare Akande and Francesca Naymarie Musa-Akande enjoying an outing together",
  },
  {
    src: "assets/images/family/francesca-dare-together.jpg",
    category: "life",
    label: "Life & family",
    title: "Together in the everyday",
    alt: "Francesca Naymarie Musa-Akande and Dr. Dare Akande posing together",
  },
];

const header = document.querySelector("[data-header]");
const progress = document.querySelector(".page-progress span");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = [...document.querySelectorAll(".site-nav a")];
const revealItems = document.querySelectorAll("[data-reveal]");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const journalGrid = document.querySelector("[data-journal-grid]");
const journalCount = document.querySelector("[data-journal-count]");
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const lightboxTitle = document.querySelector("[data-lightbox-title]");
const lightboxCategory = document.querySelector("[data-lightbox-category]");
const lightboxPosition = document.querySelector("[data-lightbox-position]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const hero = document.querySelector(".hero");
const heroVisual = document.querySelector(".hero-visual");
const parallaxTargets = [
  ...document.querySelectorAll(
    ".hero-image-wrap, .maff-hero-image, .impact-card, .recognition-gallery figure, .life-collage figure, .family-mosaic figure, .closing",
  ),
];

let visibleJournalItems = [...journalItems];
let activeLightboxIndex = 0;
let scrollTicking = false;
let touchStartX = 0;
let filterTimer;

parallaxTargets.forEach((target) => target.setAttribute("data-parallax", ""));

function updateParallax() {
  if (prefersReducedMotion.matches) return;
  const viewportCenter = window.innerHeight / 2;

  parallaxTargets.forEach((target) => {
    const rect = target.getBoundingClientRect();
    if (rect.bottom < -120 || rect.top > window.innerHeight + 120) return;

    const elementCenter = rect.top + rect.height / 2;
    const travelRange = viewportCenter + rect.height / 2;
    const normalized = Math.max(-1, Math.min(1, (elementCenter - viewportCenter) / travelRange));
    const intensity = target.classList.contains("hero-image-wrap") ? 12 : 20;
    target.style.setProperty("--image-shift", `${(-normalized * intensity).toFixed(2)}px`);
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
    if (!scrollTicking) {
      window.requestAnimationFrame(updateScrollUi);
      scrollTicking = true;
    }
  },
  { passive: true },
);
updateScrollUi();

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
  if (window.innerWidth > 900) closeMenu();
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
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 4, 3) * 60}ms`;
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
    { rootMargin: "-20% 0px -65%", threshold: [0, 0.1, 0.35] },
  );

  watchedSections.forEach((section) => navObserver.observe(section));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const countUpItems = [...document.querySelectorAll("[data-count-up]")];

function setCountUpValue(element, value) {
  const target = Number(element.dataset.countUp);
  const precision = Number.isInteger(target) ? 0 : 1;
  const prefix = element.dataset.prefix || "";
  const suffix = element.dataset.suffix || "";
  element.textContent = `${prefix}${value.toFixed(precision)}${suffix}`;
}

function animateCountUp(element) {
  const target = Number(element.dataset.countUp);
  const start = performance.now();
  const duration = 1100;

  function frame(now) {
    const progressValue = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progressValue, 4);
    setCountUpValue(element, target * eased);
    if (progressValue < 1) window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);
}

if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
  countUpItems.forEach((item) => setCountUpValue(item, Number(item.dataset.countUp)));
} else {
  const countObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCountUp(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.6 },
  );
  countUpItems.forEach((item) => {
    setCountUpValue(item, 0);
    countObserver.observe(item);
  });
}

function createJournalCard(item, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "journal-card";
  card.dataset.itemIndex = String(index);
  card.setAttribute("aria-label", `View ${item.title}`);
  card.innerHTML = `
    <img src="${item.src}" alt="${item.alt}" loading="lazy" />
    <span class="journal-card-copy">
      <span>${item.label}</span>
      <strong>${item.title}</strong>
    </span>
  `;
  return card;
}

function renderJournal(filter = "all") {
  visibleJournalItems = filter === "all"
    ? [...journalItems]
    : journalItems.filter((item) => item.category === filter);

  const fragment = document.createDocumentFragment();
  visibleJournalItems.forEach((item, index) => fragment.appendChild(createJournalCard(item, index)));
  journalGrid.replaceChildren(fragment);
  journalCount.textContent = String(visibleJournalItems.length).padStart(2, "0");
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((candidate) => {
      const isActive = candidate === button;
      candidate.classList.toggle("is-active", isActive);
      candidate.setAttribute("aria-pressed", String(isActive));
    });
    window.clearTimeout(filterTimer);
    journalGrid.classList.add("is-filtering");
    filterTimer = window.setTimeout(() => {
      renderJournal(button.dataset.filter);
      window.requestAnimationFrame(() => journalGrid.classList.remove("is-filtering"));
    }, prefersReducedMotion.matches ? 0 : 170);
  });
});

function showLightboxItem(index) {
  activeLightboxIndex = (index + visibleJournalItems.length) % visibleJournalItems.length;
  const item = visibleJournalItems[activeLightboxIndex];
  lightboxImage.classList.remove("lightbox-image-changing");
  void lightboxImage.offsetWidth;
  lightboxImage.src = item.src;
  lightboxImage.alt = item.alt;
  lightboxImage.classList.add("lightbox-image-changing");
  lightboxTitle.textContent = item.title;
  lightboxCategory.textContent = item.label;
  lightboxPosition.textContent = `${activeLightboxIndex + 1} / ${visibleJournalItems.length}`;

  const nextItem = visibleJournalItems[(activeLightboxIndex + 1) % visibleJournalItems.length];
  const preload = new Image();
  preload.src = nextItem.src;
}

journalGrid?.addEventListener("click", (event) => {
  const card = event.target.closest(".journal-card");
  if (!card) return;
  showLightboxItem(Number(card.dataset.itemIndex));
  if (typeof lightbox.showModal === "function") lightbox.showModal();
  else lightbox.setAttribute("open", "");
});

document.querySelector("[data-lightbox-close]")?.addEventListener("click", () => lightbox.close());
document.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => showLightboxItem(activeLightboxIndex - 1));
document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => showLightboxItem(activeLightboxIndex + 1));

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

lightbox?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showLightboxItem(activeLightboxIndex - 1);
  if (event.key === "ArrowRight") showLightboxItem(activeLightboxIndex + 1);
});

lightbox?.addEventListener("touchstart", (event) => {
  touchStartX = event.changedTouches[0].clientX;
}, { passive: true });

lightbox?.addEventListener("touchend", (event) => {
  const distance = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(distance) < 55) return;
  showLightboxItem(activeLightboxIndex + (distance < 0 ? 1 : -1));
}, { passive: true });

document.querySelector("[data-year]").textContent = new Date().getFullYear();
renderJournal();
