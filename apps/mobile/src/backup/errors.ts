export class ArchiveFormatError extends Error {
  constructor(reason: string) {
    super(`Not a valid backup file: ${reason}`);
    this.name = "ArchiveFormatError";
  }
}

export class ArchiveVersionError extends Error {
  constructor(reason: string) {
    super(`Backup is from a newer app version: ${reason}`);
    this.name = "ArchiveVersionError";
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("Wrong passphrase");
    this.name = "WrongPassphraseError";
  }
}

export class ArchiveIncompleteError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Backup is incomplete: ${missing.length} page(s) missing`);
    this.name = "ArchiveIncompleteError";
    this.missing = missing;
  }
}
