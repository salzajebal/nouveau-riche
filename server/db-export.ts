import pg from "pg";

const REPO = "salzajebal/npay-bisangjang";
const FILE_PATH = "db-seed.sql";
const BRANCH = "main";

// 세션 테이블 등 복원 불필요한 테이블 제외
const SKIP_TABLES = new Set(["session"]);

// 값을 SQL 문자열로 안전하게 이스케이프
function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  // 문자열: 작은따옴표 이스케이프
  return `'${String(val).replace(/'/g, "''")}'`;
}

export async function dumpDatabaseToSQL(): Promise<string> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const lines: string[] = [];

  lines.push("-- db-seed.sql (자동 생성)");
  lines.push(`-- 생성일시: ${new Date().toISOString()}`);
  lines.push("");

  // 테이블 목록 조회
  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'
     ORDER BY table_name`
  );
  const tables: string[] = tableRes.rows
    .map((r: any) => r.table_name)
    .filter((t: string) => !SKIP_TABLES.has(t));

  for (const table of tables) {
    const dataRes = await pool.query(`SELECT * FROM "${table}" ORDER BY 1`);
    if (dataRes.rows.length === 0) continue;

    const cols = dataRes.fields.map((f: any) => `"${f.name}"`).join(", ");
    lines.push(`-- ${table}`);
    lines.push(`DELETE FROM "${table}";`);
    for (const row of dataRes.rows) {
      const vals = dataRes.fields
        .map((f: any) => escapeValue(row[f.name]))
        .join(", ");
      lines.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals});`);
    }
    lines.push("");
  }

  await pool.end();
  return lines.join("\n");
}

export async function pushSQLToGitHub(sql: string): Promise<void> {
  const token = process.env.GITHUB_PERSONAL_TOKEN;
  if (!token) throw new Error("GITHUB_PERSONAL_TOKEN이 설정되지 않았습니다");

  const apiBase = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "npay-bisangjang-agent",
  };

  // 기존 파일 SHA 조회 (업데이트용)
  let sha: string | undefined;
  const getRes = await fetch(`${apiBase}?ref=${BRANCH}`, { headers });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  const body: any = {
    message: `db-seed.sql 업데이트 (${new Date().toISOString()})`,
    content: Buffer.from(sql).toString("base64"),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiBase, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub 업로드 실패: ${err}`);
  }
}

export async function restoreFromGitHub(): Promise<boolean> {
  const token = process.env.GITHUB_PERSONAL_TOKEN;
  if (!token) return false;

  try {
    const apiBase = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const res = await fetch(`${apiBase}?ref=${BRANCH}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "npay-bisangjang-agent",
      },
    });
    if (!res.ok) return false;

    const data = await res.json();
    const sql = Buffer.from(data.content, "base64").toString("utf-8");

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    // 문장 단위로 분리해서 실행
    const statements = sql
      .split(";\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--"));

    for (const stmt of statements) {
      if (stmt) await pool.query(stmt);
    }
    await pool.end();
    return true;
  } catch (e) {
    console.error("DB 복원 실패:", e);
    return false;
  }
}
