import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Remembers the last processed paging token per account so a restart
 * resumes exactly where it left off: no missed alerts, no duplicates.
 * Writes go to a temp file first and are renamed into place atomically.
 */
export class CursorStore {
  private cursors: Record<string, string> = {};

  constructor(private readonly path?: string) {
    if (path && existsSync(path)) {
      this.cursors = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
    }
  }

  get(account: string): string {
    return this.cursors[account] ?? "now";
  }

  set(account: string, pagingToken: string): void {
    this.cursors[account] = pagingToken;
    if (this.path) {
      const tmp = `${this.path}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.cursors, null, 2));
      renameSync(tmp, this.path);
    }
  }
}
