// Sprint P1, Section 5 (Import Workflow): recognizes matching basenames
// (`spring-garden-001.svg` + `.png` + `.json`) and groups them into one
// candidate asset — pure grouping logic, no I/O, so it's trivially
// testable against a plain list of `{ name }` file descriptors.

export interface GroupableFile {
  name: string;
}

export interface FileGroup<T extends GroupableFile> {
  basename: string;
  files: T[];
}

function basenameOf(filename: string): string {
  const withoutPath = filename.split(/[/\\]/).pop() ?? filename;
  const dot = withoutPath.lastIndexOf('.');
  return dot > 0 ? withoutPath.slice(0, dot) : withoutPath;
}

export function extensionOf(filename: string): string {
  const withoutPath = filename.split(/[/\\]/).pop() ?? filename;
  const dot = withoutPath.lastIndexOf('.');
  return dot > 0 ? withoutPath.slice(dot + 1).toLowerCase() : '';
}

/** Groups a flat file list by shared basename, preserving first-seen
 * order for both groups and files-within-a-group (so a deterministic
 * import always produces the same grouping and the same resulting
 * "primary" file selection downstream). Files with a basename that no
 * other file shares still get their own single-file group — grouping
 * never drops a file. */
export function groupFilesByBasename<T extends GroupableFile>(files: T[]): FileGroup<T>[] {
  const order: string[] = [];
  const groups = new Map<string, T[]>();
  for (const file of files) {
    const key = basenameOf(file.name);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(file);
  }
  return order.map((basename) => ({ basename, files: groups.get(basename)! }));
}
