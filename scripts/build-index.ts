#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * documents.json + テンプレートから index.html を生成する
 *
 * Usage:
 *   deno task build
 *   deno run --allow-read --allow-write scripts/build-index.ts
 */

interface Group {
  id: string;
  theme: string;
  label: string;
  title: string;
  description: string;
  order: number;
}

interface Document {
  title: string;
  path: string;
  group: string;
  icon: string;
  badges: string[];
  color: string;
  description: string;
  meta?: string[];
  order: number;
  comingSoon?: boolean;
}

interface Manifest {
  groups: Group[];
  documents: Document[];
}

function renderBadges(badges: string[]): string {
  return badges
    .map((b) => `<span class="doc-card-badge">${b}</span>`)
    .join("\n        ");
}

function renderCard(doc: Document): string {
  const badgesAttr = doc.badges.join(",");

  if (doc.comingSoon) {
    return `      <div class="doc-card coming-soon" data-color="${doc.color}" data-badges="${badgesAttr}">
        <span class="doc-card-icon">${doc.icon}</span>
        <div class="doc-card-badges">${renderBadges(doc.badges)}</div>
        <h3>${doc.title}</h3>
        <p>${doc.description}</p>
        <span class="coming-soon-tag">COMING SOON</span>
      </div>`;
  }

  const metaHtml = (doc.meta ?? [])
    .map((m) => `          <span>${m}</span>`)
    .join("\n");

  return `      <a class="doc-card" data-color="${doc.color}" data-badges="${badgesAttr}" href="${doc.path}">
        <span class="doc-card-icon">${doc.icon}</span>
        <div class="doc-card-badges">${renderBadges(doc.badges)}</div>
        <h3>${doc.title}</h3>
        <p>${doc.description}</p>
        <div class="doc-card-meta">
${metaHtml}
          <div class="doc-card-arrow">→</div>
        </div>
      </a>`;
}

function renderSection(group: Group, docs: Document[]): string {
  const sorted = [...docs].sort((a, b) => a.order - b.order);
  const cards = sorted.map(renderCard).join("\n\n");

  return `  <!-- ${group.title} -->
  <div class="section" data-theme="${group.theme}">
    <div class="section-header">
      <span class="section-label">${group.label}</span>
      <span class="section-title">${group.title}</span>
    </div>
    <p class="section-desc">${group.description}</p>
    <div class="doc-grid">

${cards}

    </div>
  </div>`;
}

function collectUniqueBadges(documents: Document[]): string[] {
  const set = new Set<string>();
  for (const doc of documents) {
    for (const b of doc.badges) {
      set.add(b);
    }
  }
  return [...set].sort();
}

function renderFilters(badges: string[]): string {
  const buttons = badges
    .map(
      (b) =>
        `    <button class="filter-btn" data-badge="${b}">${b}</button>`,
    )
    .join("\n");

  return `<div class="filter-bar">
    <button class="filter-btn active" data-badge="ALL">すべて</button>
${buttons}
  </div>`;
}

// --- Main ---

const manifest: Manifest = JSON.parse(
  await Deno.readTextFile("documents.json"),
);

const template = await Deno.readTextFile("scripts/index.template.html");

const sortedGroups = [...manifest.groups].sort((a, b) => a.order - b.order);

const sectionsHtml = sortedGroups
  .map((group) => {
    const docs = manifest.documents.filter((d) => d.group === group.id);
    return renderSection(group, docs);
  })
  .join("\n\n");

const animationDelays = sortedGroups
  .map(
    (_, i) =>
      `  .section:nth-child(${i + 1}) { animation-delay: ${(0.2 + i * 0.15).toFixed(2)}s; }`,
  )
  .join("\n");

const uniqueBadges = collectUniqueBadges(manifest.documents);
const filtersHtml = renderFilters(uniqueBadges);

const output = template
  .replace("{{SECTIONS}}", sectionsHtml)
  .replace("{{ANIMATION_DELAYS}}", animationDelays)
  .replace("{{FILTERS}}", filtersHtml);

await Deno.writeTextFile("index.html", output);

const docCount = manifest.documents.length;
const groupCount = manifest.groups.length;
console.log(
  `✅ index.html を生成しました（${groupCount} グループ、${docCount} ドキュメント、${uniqueBadges.length} バッジ）`,
);
