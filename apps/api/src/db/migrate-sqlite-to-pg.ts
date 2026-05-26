import Database from "better-sqlite3";
import pg from "pg";

interface TableDef {
  name: string;
  columns: string[];
}

const TABLES: TableDef[] = [
  {
    name: "SysDataAreaTable",
    columns: ["Id", "Name", "Description", "IsPersonal", "CreatedAt"],
  },
  {
    name: "SysUserTable",
    columns: ["Id", "Login", "Email", "PasswordHash", "FirstName", "LastName", "IsActive", "EmailConfirmed", "DefaultDataAreaId", "CreatedAt"],
  },
  {
    name: "SysUserSettingsTable",
    columns: ["UserId", "CurrentDataAreaId", "UpdatedAt"],
  },
  {
    name: "SysUserDataArea",
    columns: ["UserId", "DataAreaId", "CanCreate", "CanRead", "CanUpdate", "CanDelete"],
  },
  {
    name: "TimelineTable",
    columns: ["Id", "Name", "Description", "IconUrl", "SortIndex", "DataAreaId", "CreatedDateTime"],
  },
  {
    name: "EventTable",
    columns: ["Id", "Name", "StartDate", "EndDate", "Notes", "DataAreaId", "CreatedDateTime"],
  },
  {
    name: "EventTimelineLink",
    columns: ["EventId", "TimelineId", "Description", "DataAreaId", "CreatedDateTime"],
  },
  {
    name: "TagTable",
    columns: ["Id", "Name", "Color", "PreviewUrl", "DataAreaId", "CreatedDateTime"],
  },
  {
    name: "TagEventLink",
    columns: ["EventId", "TagId", "DataAreaId", "CreatedDateTime"],
  },
  {
    name: "DocumentTable",
    columns: ["DocumentId", "Description", "OriginalLink", "StorageLink", "ResourceType", "DataAreaId", "CreatedDateTime"],
  },
  {
    name: "DocumentEventLink",
    columns: ["EventId", "DocumentId", "IsPrimary", "DataAreaId", "CreatedDateTime"],
  },
  {
    name: "UserPreferences",
    columns: ["Id", "UserId", "TimelineId", "Visible"],
  },
  {
    name: "AppSettings",
    columns: ["Key", "Value", "IsSecret", "UpdatedAt"],
  },
];

const BOOL_COLUMNS = new Set([
  "IsPersonal", "IsActive", "EmailConfirmed",
  "CanCreate", "CanRead", "CanUpdate", "CanDelete",
  "IsPrimary", "Visible", "IsSecret",
]);

const TS_COLUMNS = new Set([
  "CreatedAt", "UpdatedAt", "CreatedDateTime",
]);

function convertValue(column: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;

  if (BOOL_COLUMNS.has(column)) {
    return Number(value) === 1;
  }

  if (TS_COLUMNS.has(column)) {
    const s = String(value);
    if (s.includes("T") || s.includes("+") || s.includes("Z")) return s;
    if (s.includes(" ")) return s.replace(" ", "T") + "Z";
    return s;
  }

  return value;
}

async function main() {
  const sqlitePath = process.env.SQLITE_PATH ?? "./data/timeline.db";
  const pgUrl = process.env.DATABASE_URL;

  if (!pgUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log("Source SQLite:", sqlitePath);
  console.log("Target PostgreSQL:", pgUrl);

  const sqlite = new Database(sqlitePath);
  const pgPool = new pg.Pool({ connectionString: pgUrl });
  const client = await pgPool.connect();

  try {
    await client.query("SET session_replication_role = replica;");

    const reversedNames = [...TABLES].reverse().map((t) => `"${t.name}"`);
    await client.query(`TRUNCATE ${reversedNames.join(", ")} CASCADE;`);

    for (const { name, columns } of TABLES) {
      const quoted = columns.map((c) => `"${c}"`);
      const sqliteRows = sqlite.prepare(`SELECT ${columns.join(", ")} FROM "${name}"`).all();

      if (sqliteRows.length === 0) {
        console.log(`  ${name}: 0 rows (empty)`);
        continue;
      }

      const placeholders = columns.map((_, i) => `$${i + 1}`);
      const insertSql = `INSERT INTO "${name}" (${quoted.join(", ")}) VALUES (${placeholders.join(", ")})`;

      for (const row of sqliteRows as Record<string, unknown>[]) {
        const values = columns.map((col) => convertValue(col, row[col]));
        await client.query(insertSql, values);
      }

      console.log(`  ${name}: ${sqliteRows.length} rows migrated`);
    }

    const sequences: { table: string; col: string; seq: string }[] = [
      { table: "SysDataAreaTable", col: "Id", seq: "SysDataAreaTable_Id_seq" },
      { table: "SysUserTable", col: "Id", seq: "SysUserTable_Id_seq" },
      { table: "TimelineTable", col: "Id", seq: "TimelineTable_Id_seq" },
      { table: "EventTable", col: "Id", seq: "EventTable_Id_seq" },
      { table: "TagTable", col: "Id", seq: "TagTable_Id_seq" },
      { table: "DocumentTable", col: "DocumentId", seq: "DocumentTable_DocumentId_seq" },
      { table: "UserPreferences", col: "Id", seq: "UserPreferences_Id_seq" },
    ];

    for (const { table, col, seq } of sequences) {
      const result = await client.query(`SELECT COALESCE(MAX("${col}"), 0) as max FROM "${table}"`);
      const max = result.rows[0]?.max ?? 0;
      await client.query(`SELECT setval('"${seq}"', $1)`, [max]);
      console.log(`  ~ sequence ${seq} -> ${max}`);
    }

    await client.query("SET session_replication_role = origin;");
    console.log("\nMigration complete! SQLite file left intact for rollback.");
  } finally {
    client.release();
    await pgPool.end();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
