const MIGRATION_PREFIX = "supabase/migrations/";
const DATABASE_TEST_PREFIX = "supabase/tests/database/";

export function parseNameStatusZ(raw) {
  const fields = raw.split("\0");
  if (fields.at(-1) === "") fields.pop();

  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!status) continue;
    const kind = status[0];
    if (kind === "R" || kind === "C") {
      const oldPath = fields[index++];
      const path = fields[index++];
      if (!oldPath || !path) throw new Error(`Malformed git name-status record: ${status}`);
      changes.push({ status, kind, oldPath, path });
    } else {
      const path = fields[index++];
      if (!path) throw new Error(`Malformed git name-status record: ${status}`);
      changes.push({ status, kind, path });
    }
  }
  return changes;
}

export function evaluateMigrationPolicy(changes, exemptions = {}) {
  const errors = [];
  const added = [];

  for (const change of changes) {
    const pathIsMigration = change.path.startsWith(MIGRATION_PREFIX);
    const oldPathIsMigration = change.oldPath?.startsWith(MIGRATION_PREFIX) ?? false;
    if (!pathIsMigration && !oldPathIsMigration) continue;

    if (
      (["R", "C"].includes(change.kind) && oldPathIsMigration) ||
      (pathIsMigration && !["A", "C", "R"].includes(change.kind))
    ) {
      errors.push(
        `Existing migration is immutable: ${change.oldPath ?? change.path} (${change.status}).`,
      );
    }
    if (
      pathIsMigration &&
      (change.kind === "A" || change.kind === "C" || (change.kind === "R" && !oldPathIsMigration))
    ) {
      added.push(change.path);
    }
  }

  if (added.length > 1) {
    errors.push(
      `A change may add at most one migration; found ${added.length}: ${added.join(", ")}.`,
    );
  }

  if (added.length === 1) {
    const migrationName = added[0].slice(MIGRATION_PREFIX.length);
    const hasDatabaseTest = changes.some(
      ({ kind, path }) => kind !== "D" && path.startsWith(DATABASE_TEST_PREFIX),
    );
    const exemption = exemptions[migrationName];
    const validExemption =
      exemption &&
      typeof exemption.rationale === "string" &&
      exemption.rationale.trim().length >= 20 &&
      typeof exemption.reviewed_by === "string" &&
      exemption.reviewed_by.trim().length > 0;
    if (!hasDatabaseTest && !validExemption) {
      errors.push(
        `New migration ${migrationName} needs a changed database test or a reviewed entry in policy/migration-test-exemptions.json.`,
      );
    }
  }

  return { errors, added };
}
