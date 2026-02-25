import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";

export interface DocumentMeta {
  name: string;
  title: string;
  description: string;
  recommended_for: string[];
}

export interface Document {
  meta: DocumentMeta;
  content: string;
  rawMarkdown: string;
}

export interface SearchResult {
  document_name: string;
  section: string;
  snippet: string;
}

export class DocumentStore {
  private documents: Map<string, Document> = new Map();
  private docsPath: string;
  private loaded = false;

  constructor(docsPath: string) {
    this.docsPath = docsPath;
  }

  async load(): Promise<void> {
    this.documents.clear();

    let files: string[];
    try {
      files = await readdir(this.docsPath);
    } catch {
      // Directory doesn't exist or is inaccessible — that's OK
      this.loaded = true;
      return;
    }

    const mdFiles = files.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
      const filePath = join(this.docsPath, file);
      const raw = await readFile(filePath, "utf-8");
      const { data, content } = matter(raw);
      const name = file.replace(/\.md$/, "");

      const meta: DocumentMeta = {
        name,
        title: typeof data.title === "string" ? data.title : name,
        description:
          typeof data.description === "string" ? data.description : "",
        recommended_for: Array.isArray(data.recommended_for)
          ? data.recommended_for
          : [],
      };

      this.documents.set(name, {
        meta,
        content,
        rawMarkdown: raw,
      });
    }

    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }

  async listDocuments(): Promise<DocumentMeta[]> {
    await this.ensureLoaded();
    return Array.from(this.documents.values()).map((doc) => doc.meta);
  }

  async getDocument(name: string): Promise<Document | undefined> {
    await this.ensureLoaded();
    return this.documents.get(name);
  }

  async searchDocuments(query: string): Promise<SearchResult[]> {
    await this.ensureLoaded();

    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (terms.length === 0) {
      return [];
    }

    const results: SearchResult[] = [];

    for (const [name, doc] of this.documents) {
      const lines = doc.content.split("\n");
      let currentSection = doc.meta.title;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track current section heading
        const headingMatch = line.match(/^#{1,6}\s+(.+)/);
        if (headingMatch) {
          currentSection = headingMatch[1].trim();
        }

        // Check if any term matches this line (OR search)
        const lineLower = line.toLowerCase();
        const matches = terms.some((term) => lineLower.includes(term));

        if (matches) {
          // Build snippet with surrounding context (2 lines before/after)
          const start = Math.max(0, i - 2);
          const end = Math.min(lines.length - 1, i + 2);
          const snippet = lines.slice(start, end + 1).join("\n");

          results.push({
            document_name: name,
            section: currentSection,
            snippet,
          });
        }
      }
    }

    return results;
  }
}
