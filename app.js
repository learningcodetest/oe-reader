// === Chapter manifest (one continuous book) ===
const CHAPTERS = [
  { id: "foreword",                file: "foreword.md",                title: "Foreword",                    label: "Foreword" },
  { id: "introduction",           file: "introduction.md",            title: "Introduction",                label: "Chapter 0" },
  { id: "introduction-continued", file: "introduction-continued.md",  title: "Introduction (continued)",    label: "Chapter 1" },
  { id: "discourses",             file: "discourses.md",              title: "Discourses",                  label: "Chapter 2" },
  { id: "heteronomy",             file: "heteronomy.md",              title: "Heteronomy",                  label: "Chapter 3" },
  { id: "normativity",            file: "normativity.md",             title: "Normativity",                 label: "Chapter 4" },
  { id: "india-bharat",           file: "india-bharat.md",            title: "India / Bharat",              label: "Chapter 5" },
  { id: "conclusion",             file: "conclusion.md",              title: "Conclusion",                  label: "Chapter 6" },
  { id: "references",             file: "references.md",              title: "References",                  label: "References" },
  { id: "glossary",               file: "glossary.md",                title: "Glossary",                    label: "Glossary" },
];

// === State ===
let currentChapter = null;
let mdCache = {};
let searchIndex = [];
let scrollSpyObserver = null;

// === Theme ===
(function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

document.getElementById("theme-toggle").addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

// === Mobile TOC toggle ===
const tocToggle = document.getElementById("toc-toggle");
const tocEl = document.getElementById("toc");
tocToggle.addEventListener("click", () => {
  tocEl.classList.toggle("open");
  tocToggle.setAttribute("aria-expanded", tocEl.classList.contains("open"));
});

// === Platform-aware shortcut label ===
if (navigator.platform.indexOf("Mac") > -1 || navigator.userAgent.indexOf("Mac") > -1) {
  document.getElementById("search-shortcut").textContent = "⌘K";
}

// === Reading progress bar & back-to-top ===
const progressBar = document.getElementById("progress-bar");
const backToTop = document.getElementById("back-to-top");
window.addEventListener("scroll", () => {
  if (!currentChapter) { progressBar.style.width = "0"; backToTop.classList.remove("visible"); return; }
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
  progressBar.style.width = pct + "%";
  backToTop.classList.toggle("visible", scrollTop > 400);
});
backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// === Lightweight Markdown → HTML ===
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parseMarkdown(md) {
  const sections = [];
  let currentSection = { id: "_top", title: "", html: "" };
  const lines = md.split("\n");
  let inBlockquote = false;
  let bqLines = [];

  function flushBlockquote() {
    if (bqLines.length) {
      currentSection.html += `<blockquote><p>${inlineFormat(bqLines.join(" "))}</p></blockquote>`;
      bqLines = [];
    }
    inBlockquote = false;
  }

  function inlineFormat(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H1 — chapter title (skip, we render it from manifest)
    if (/^# /.test(line)) {
      flushBlockquote();
      continue;
    }

    // H2 — section heading
    if (/^## /.test(line)) {
      flushBlockquote();
      const title = line.replace(/^## /, "").trim();
      const id = slugify(title);
      if (currentSection.html.trim() || currentSection.title) {
        sections.push(currentSection);
      }
      currentSection = { id, title, html: "" };
      continue;
    }

    // H3 — subsection
    if (/^### /.test(line)) {
      flushBlockquote();
      const title = line.replace(/^### /, "").trim();
      currentSection.html += `<h3>${escapeHtml(title)}</h3>`;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      inBlockquote = true;
      bqLines.push(line.replace(/^>\s?/, ""));
      continue;
    }

    // End of blockquote
    if (inBlockquote && line.trim() === "") {
      flushBlockquote();
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      flushBlockquote();
      continue;
    }

    // Regular paragraph line — detect glossary [category] tags
    flushBlockquote();
    const tagMatch = line.match(/\[(\w+)\]\s*$/);
    if (tagMatch) {
      const category = tagMatch[1];
      const cleanLine = line.replace(/\s*\[\w+\]\s*$/, "");
      currentSection.html += `<p data-category="${category}">${inlineFormat(cleanLine)}</p>`;
    } else {
      currentSection.html += `<p>${inlineFormat(line)}</p>`;
    }
  }

  flushBlockquote();
  if (currentSection.html.trim() || currentSection.title) {
    sections.push(currentSection);
  }

  return sections;
}

// === Fetch & cache Markdown ===
async function fetchChapter(id) {
  if (mdCache[id]) return mdCache[id];
  const ch = CHAPTERS.find(c => c.id === id);
  if (!ch) return null;
  const res = await fetch(`content/${ch.file}`);
  if (!res.ok) return null;
  const md = await res.text();
  const sections = parseMarkdown(md);
  const wordCount = md.split(/\s+/).length;
  mdCache[id] = { id, title: ch.title, label: ch.label, sections, wordCount };
  return mdCache[id];
}

// === Library ===
async function renderLibrary() {
  const list = document.getElementById("parts-list");
  list.innerHTML = CHAPTERS.map(ch => `
    <a class="part-row" href="#${ch.id}" data-chapter="${ch.id}">
      <span class="part-row-label">${escapeHtml(ch.label)}</span>
      <span class="part-row-title">${escapeHtml(ch.title)}</span>
      <span class="part-row-time" data-time-for="${ch.id}"></span>
    </a>
  `).join("");

  list.querySelectorAll(".part-row").forEach(row => {
    row.addEventListener("click", (e) => {
      e.preventDefault();
      openChapter(row.dataset.chapter);
    });
  });

  // Populate read times asynchronously
  for (const ch of CHAPTERS) {
    fetchChapter(ch.id).then(data => {
      if (!data) return;
      const mins = Math.max(1, Math.round(data.wordCount / 200));
      const el = list.querySelector(`[data-time-for="${ch.id}"]`);
      if (el) el.textContent = `~${mins} min`;
    });
  }
}

// === Reader ===
async function openChapter(chapterId, sectionId) {
  const chapter = await fetchChapter(chapterId);
  if (!chapter) return;
  currentChapter = chapter;

  history.pushState({ chapterId, sectionId }, "", `#${chapterId}${sectionId ? "/" + sectionId : ""}`);

  // Chapter navigation (prev/next)
  const idx = CHAPTERS.findIndex(c => c.id === chapterId);
  const prev = idx > 0 ? CHAPTERS[idx - 1] : null;
  const next = idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1] : null;

  // Render TOC
  const tocNav = document.getElementById("toc-nav");
  const tocLinks = chapter.sections
    .filter(s => s.title)
    .map(s => `<a class="toc-link" href="#section-${s.id}" data-section="${s.id}">${escapeHtml(s.title)}</a>`)
    .join("");

  tocNav.innerHTML = `
    <a class="toc-back" href="#" id="toc-back">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      All chapters
    </a>
    <div class="toc-title">Contents</div>
    ${tocLinks}
  `;

  document.getElementById("toc-back").addEventListener("click", (e) => {
    e.preventDefault();
    showLibrary();
  });

  // Close mobile TOC when a link is tapped
  tocNav.querySelectorAll(".toc-link").forEach(link => {
    link.addEventListener("click", () => tocEl.classList.remove("open"));
  });

  // Render content
  const content = document.getElementById("reader-content");
  const sectionsHtml = chapter.sections.map(s => {
    const heading = s.title ? `<h2 id="section-${s.id}">${escapeHtml(s.title)}</h2>` : "";
    return heading + s.html;
  }).join("");

  // Glossary filter bar with counts and inline search
  const GLOSSARY_CATEGORIES = {
    all: "All",
    term: "Terms",
    scholar: "Scholars & Figures",
    place: "Places",
    language: "Languages",
    linguistics: "Linguistics",
    culture: "Culture & Politics"
  };

  let filterHtml = "";
  if (chapterId === "glossary") {
    // Count entries per category from the rendered HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = sectionsHtml;
    const allEntries = tempDiv.querySelectorAll("p[data-category]");
    const counts = { all: allEntries.length };
    allEntries.forEach(p => {
      const cat = p.dataset.category;
      counts[cat] = (counts[cat] || 0) + 1;
    });

    filterHtml = `
      <div class="glossary-toolbar">
        <div class="glossary-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="glossary-search" id="glossary-search" placeholder="Filter glossary..." autocomplete="off" spellcheck="false">
        </div>
        <div class="glossary-filters" id="glossary-filters">
          ${Object.entries(GLOSSARY_CATEGORIES).map(([key, label]) =>
            `<button class="filter-btn${key === 'all' ? ' active' : ''}" data-filter="${key}">${label}<span class="filter-count">${counts[key] || 0}</span></button>`
          ).join("")}
        </div>
      </div>
    `;
  }

  const navHtml = `
    <nav class="chapter-nav">
      ${prev ? `<a class="chapter-nav-link prev" href="#${prev.id}" data-chapter="${prev.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        <span><small>${escapeHtml(prev.label)}</small>${escapeHtml(prev.title)}</span>
      </a>` : '<span></span>'}
      ${next ? `<a class="chapter-nav-link next" href="#${next.id}" data-chapter="${next.id}">
        <span><small>${escapeHtml(next.label)}</small>${escapeHtml(next.title)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>` : '<span></span>'}
    </nav>
  `;

  content.innerHTML = `
    <h1>${escapeHtml(chapter.title)}</h1>
    ${filterHtml}
    ${sectionsHtml}
    ${navHtml}
  `;

  // Wire up glossary filters and search
  if (chapterId === "glossary") {
    const glossaryEntries = content.querySelectorAll("p[data-category]");
    const glossaryHeadings = content.querySelectorAll("h2[id]");
    let activeFilter = "all";

    function applyGlossaryFilters() {
      const searchVal = (document.getElementById("glossary-search")?.value || "").toLowerCase().trim();
      glossaryEntries.forEach(p => {
        const matchesCategory = activeFilter === "all" || p.dataset.category === activeFilter;
        const matchesSearch = !searchVal || p.textContent.toLowerCase().includes(searchVal);
        p.style.display = (matchesCategory && matchesSearch) ? "" : "none";
      });
      glossaryHeadings.forEach(h2 => {
        let el = h2.nextElementSibling;
        let anyVisible = false;
        while (el && el.tagName !== "H2") {
          if (el.tagName === "P" && el.dataset.category && el.style.display !== "none") anyVisible = true;
          el = el.nextElementSibling;
        }
        h2.style.display = anyVisible ? "" : "none";
      });
    }

    content.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        content.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        applyGlossaryFilters();
      });
    });

    const glossarySearchInput = document.getElementById("glossary-search");
    if (glossarySearchInput) {
      let gsTimeout;
      glossarySearchInput.addEventListener("input", () => {
        clearTimeout(gsTimeout);
        gsTimeout = setTimeout(applyGlossaryFilters, 100);
      });
    }
  }

  // Wire up chapter nav links
  content.querySelectorAll(".chapter-nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openChapter(link.dataset.chapter);
    });
  });

  // Show reader, hide library
  document.getElementById("library").classList.add("hidden");
  document.getElementById("reader").classList.remove("hidden");

  if (sectionId) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`section-${sectionId}`);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
  } else {
    window.scrollTo(0, 0);
  }

  setupScrollSpy();
}

function showLibrary() {
  document.getElementById("reader").classList.add("hidden");
  document.getElementById("library").classList.remove("hidden");
  history.pushState({}, "", window.location.pathname);
  currentChapter = null;
  if (scrollSpyObserver) { scrollSpyObserver.disconnect(); scrollSpyObserver = null; }
  window.scrollTo(0, 0);
}

function setupScrollSpy() {
  if (scrollSpyObserver) scrollSpyObserver.disconnect();
  const headings = document.querySelectorAll(".reader-content h2[id]");
  const links = document.querySelectorAll(".toc-link");
  if (!headings.length) return;

  scrollSpyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace("section-", "");
        links.forEach(l => l.classList.toggle("active", l.dataset.section === id));
      }
    });
  }, { rootMargin: "-80px 0px -70% 0px" });

  headings.forEach(h => scrollSpyObserver.observe(h));
}

// === Search ===
const searchOverlay = document.getElementById("search-overlay");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

async function buildSearchIndex() {
  for (const ch of CHAPTERS) {
    const data = await fetchChapter(ch.id);
    if (!data) continue;
    for (const sec of data.sections) {
      // Index section headings as standalone search results
      if (sec.title) {
        searchIndex.push({ chapterId: ch.id, chapterTitle: ch.title, label: ch.label, sectionId: sec.id, sectionTitle: sec.title, text: sec.title, isHeading: true });
      }
      // Strip HTML tags for search text
      const text = sec.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!text) continue;
      // Split into ~200 char chunks at sentence boundaries for better results
      const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
      let chunk = "";
      for (const s of sentences) {
        if (chunk.length + s.length > 250 && chunk.length > 50) {
          searchIndex.push({ chapterId: ch.id, chapterTitle: ch.title, label: ch.label, sectionId: sec.id, sectionTitle: sec.title, text: chunk.trim() });
          chunk = "";
        }
        chunk += s;
      }
      if (chunk.trim()) {
        searchIndex.push({ chapterId: ch.id, chapterTitle: ch.title, label: ch.label, sectionId: sec.id, sectionTitle: sec.title, text: chunk.trim() });
      }
    }
  }
}

function openSearch() {
  searchOverlay.classList.remove("hidden");
  searchInput.value = "";
  searchInput.focus();
  searchResults.innerHTML = '<div class="search-empty">Type to search across all chapters</div>';
}

function closeSearch() {
  searchOverlay.classList.add("hidden");
  searchInput.value = "";
}

document.getElementById("search-trigger").addEventListener("click", openSearch);
searchOverlay.addEventListener("click", (e) => {
  if (e.target === searchOverlay) closeSearch();
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    openSearch();
  }
  if (e.key === "Escape") closeSearch();
});

let searchTimeout;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => performSearch(searchInput.value), 150);
});

function performSearch(query) {
  if (!query || query.length < 2) {
    searchResults.innerHTML = '<div class="search-empty">Type to search across all chapters</div>';
    return;
  }

  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  if (!terms.length) return;

  const results = [];
  for (const item of searchIndex) {
    const lower = item.text.toLowerCase();
    if (terms.every(t => lower.includes(t))) {
      results.push(item);
      if (results.length >= 20) break;
    }
  }

  if (!results.length) {
    searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
    return;
  }

  searchResults.innerHTML = results.map(r => {
    const highlighted = highlightText(r.text, terms);
    const icon = r.isHeading ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.5"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 12h-4"/></svg> ` : "";
    return `
      <div class="search-result${r.isHeading ? ' search-result-heading' : ''}" data-chapter="${r.chapterId}" data-section="${r.sectionId}">
        <div class="search-result-meta">${escapeHtml(r.label)} · ${escapeHtml(r.chapterTitle)}${r.sectionTitle ? " · " + escapeHtml(r.sectionTitle) : ""}</div>
        <div class="search-result-text">${icon}${highlighted}</div>
      </div>
    `;
  }).join("");

  searchResults.querySelectorAll(".search-result").forEach(el => {
    el.addEventListener("click", () => {
      closeSearch();
      openChapter(el.dataset.chapter, el.dataset.section);
    });
  });
}

function highlightText(text, terms) {
  let result = escapeHtml(text);
  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
    result = result.replace(regex, "<mark>$1</mark>");
  }
  return result;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// === Logo/back navigation ===
document.getElementById("logo-link").addEventListener("click", (e) => {
  e.preventDefault();
  showLibrary();
});

// === URL routing ===
function handleRoute() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const [chapterId, sectionId] = hash.split("/");
  if (CHAPTERS.some(c => c.id === chapterId)) {
    openChapter(chapterId, sectionId);
  }
}

window.addEventListener("popstate", () => {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    showLibrary();
  } else {
    handleRoute();
  }
});

// === Init ===
renderLibrary();
buildSearchIndex().then(() => handleRoute());
