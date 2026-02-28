#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * 未登録の HTML ファイルを検出し、documents.json に自動追加する
 *
 * - docs/, work/, references/ 直下の HTML ファイルが対象
 * - <title> と <meta name="description"> からメタデータを抽出
 * - 3層フォールバック: ファイル単位 → ディレクトリ単位 → スクリプト全体
 *
 * Usage:
 *   deno task auto-register
 *   deno run --allow-read --allow-write scripts/auto-register.ts
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

/** ディレクトリごとのデフォルト設定 */
const DIR_DEFAULTS: Record<string, { badges: string[]; groupFallback: string }> = {
  docs: { badges: ["DOC"], groupFallback: "dev" },
  work: { badges: ["WORK"], groupFallback: "" }, // 最新スプリントを動的に決定
  references: { badges: ["INFO"], groupFallback: "" },
};

const SCAN_DIRS = ["docs", "work", "references"];

/** <title> タグからタイトルを抽出 */
function extractTitle(html: string, fileName: string): string {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (match && match[1].trim()) {
    return match[1].trim();
  }
  // ファイル名からタイトルを生成（拡張子除去、ハイフン/アンダースコアをスペースに）
  return fileName
    .replace(/\.html?$/i, "")
    .replace(/[-_]/g, " ");
}

/** <meta name="description"> から説明文を抽出 */
function extractDescription(html: string): string {
  const match = html.match(
    /<meta\s+name=["']description["']\s+content=["'](.*?)["']/is,
  );
  if (match && match[1].trim()) {
    return match[1].trim();
  }
  return "自動登録されたドキュメントです。説明文は documents.json で編集できます。";
}

/** 最新（最大 order）のスプリントグループ ID を取得 */
function getLatestSprintGroupId(groups: Group[]): string {
  const sprintGroups = groups.filter(
    (g) => g.theme === "reference" && /sprint/i.test(g.id),
  );
  if (sprintGroups.length === 0) return "sprint0";
  sprintGroups.sort((a, b) => b.order - a.order);
  return sprintGroups[0].id;
}

/** グループ内の最大 order を取得（次の order 値算出用） */
function getNextOrder(docs: Document[], groupId: string): number {
  const groupDocs = docs.filter((d) => d.group === groupId);
  if (groupDocs.length === 0) return 1;
  return Math.max(...groupDocs.map((d) => d.order)) + 1;
}

/** ディレクトリ直下の HTML ファイル一覧を取得 */
async function listHtmlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && /\.html?$/i.test(entry.name)) {
        files.push(entry.name);
      }
    }
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.log(`⏭️  ディレクトリが存在しません: ${dir}/（スキップ）`);
    } else {
      console.warn(`⚠️  ${dir}/ の読み込みに失敗しました: ${err}`);
    }
  }
  return files;
}

// --- Main ---
try {
  const manifestText = await Deno.readTextFile("documents.json");
  const manifest: Manifest = JSON.parse(manifestText);

  // 登録済みパスの Set を作成
  const registeredPaths = new Set(
    manifest.documents.map((d) => d.path).filter(Boolean),
  );

  const latestSprintId = getLatestSprintGroupId(manifest.groups);
  const newEntries: Document[] = [];

  for (const dir of SCAN_DIRS) {
    const files = await listHtmlFiles(dir);

    for (const fileName of files) {
      const relativePath = `./${dir}/${fileName}`;

      if (registeredPaths.has(relativePath)) {
        continue;
      }

      // ファイル単位のフォールバック: 読み込み失敗時はスキップ
      try {
        const html = await Deno.readTextFile(`${dir}/${fileName}`);
        const title = extractTitle(html, fileName);
        const description = extractDescription(html);

        const defaults = DIR_DEFAULTS[dir];
        const groupId =
          defaults.groupFallback || latestSprintId;

        const entry: Document = {
          title,
          path: relativePath,
          group: groupId,
          icon: "📄",
          badges: defaults.badges,
          color: "sky",
          description,
          meta: ["📄"],
          order: getNextOrder(
            [...manifest.documents, ...newEntries],
            groupId,
          ),
        };

        newEntries.push(entry);
        console.log(`➕ 追加: ${relativePath} → グループ "${groupId}"`);
      } catch (err) {
        console.warn(
          `⚠️  ${relativePath} の処理をスキップしました: ${err}`,
        );
      }
    }
  }

  if (newEntries.length === 0) {
    console.log("✅ 未登録のHTMLファイルはありません");
    Deno.exit(0);
  }

  manifest.documents.push(...newEntries);

  await Deno.writeTextFile(
    "documents.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );

  console.log(
    `✅ ${newEntries.length} 件のドキュメントを documents.json に追加しました`,
  );
} catch (err) {
  // スクリプト全体のフォールバック: エラーログ出力して exit 0
  console.error(`❌ auto-register でエラーが発生しましたが、ビルドに進みます: ${err}`);
  Deno.exit(0);
}
