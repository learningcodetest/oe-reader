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

    // Regular paragraph line
    flushBlockquote();
    currentSection.html += `<p>${inlineFormat(line)}</p>`;
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
function renderLibrary() {
  const list = document.getElementById("parts-list");
  list.innerHTML = CHAPTERS.map(ch => `
    <a class="part-row" href="#${ch.id}" data-chapter="${ch.id}">
      <span class="part-row-label">${escapeHtml(ch.label)}</span>
      <span class="part-row-title">${escapeHtml(ch.title)}</span>
    </a>
  `).join("");

  list.querySelectorAll(".part-row").forEach(row => {
    row.addEventListener("click", (e) => {
      e.preventDefault();
      openChapter(row.dataset.chapter);
    });
  });
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

  // Render content
  const content = document.getElementById("reader-content");
  const sectionsHtml = chapter.sections.map(s => {
    const heading = s.title ? `<h2 id="section-${s.id}">${escapeHtml(s.title)}</h2>` : "";
    return heading + s.html;
  }).join("");

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
    ${sectionsHtml}
    ${navHtml}
  `;

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
    return `
      <div class="search-result" data-chapter="${r.chapterId}" data-section="${r.sectionId}">
        <div class="search-result-meta">${escapeHtml(r.label)} · ${escapeHtml(r.chapterTitle)}${r.sectionTitle ? " · " + escapeHtml(r.sectionTitle) : ""}</div>
        <div class="search-result-text">${highlighted}</div>
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
