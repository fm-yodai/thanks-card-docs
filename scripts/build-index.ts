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
  badge: string;
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

function renderCard(doc: Document): string {
  if (doc.comingSoon) {
    return `      <div class="doc-card coming-soon" data-color="${doc.color}">
        <span class="doc-card-icon">${doc.icon}</span>
        <span class="doc-card-badge">${doc.badge}</span>
        <h3>${doc.title}</h3>
        <p>${doc.description}</p>
        <span class="coming-soon-tag">COMING SOON</span>
      </div>`;
  }

  const metaHtml = (doc.meta ?? [])
    .map((m) => `          <span>${m}</span>`)
    .join("\n");

  return `      <a class="doc-card" data-color="${doc.color}" href="${doc.path}">
        <span class="doc-card-icon">${doc.icon}</span>
        <span class="doc-card-badge">${doc.badge}</span>
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

const output = template
  .replace("{{SECTIONS}}", sectionsHtml)
  .replace("{{ANIMATION_DELAYS}}", animationDelays);

await Deno.writeTextFile("index.html", output);

const docCount = manifest.documents.length;
const groupCount = manifest.groups.length;
console.log(
  `✅ index.html を生成しました（${groupCount} グループ、${docCount} ドキュメント）`,
);
