#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCAL_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/myapp";
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const confirmed =
  process.argv.includes("--confirm") ||
  process.env.CONFIRM_DATA_MIGRATION === "YES";

function fail(message) {
  console.error(`오류: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error?.code === "ENOENT") {
    fail(`${command} 명령을 찾을 수 없습니다. PostgreSQL client 도구를 설치하세요.`);
  }
  if (result.status !== 0) {
    fail(`${command} 실행에 실패했습니다.`);
  }
}

if (!sourceUrl) {
  fail("SOURCE_DATABASE_URL을 원본 PostgreSQL 접속 문자열로 설정해야 합니다.");
}
if (sourceUrl === LOCAL_DATABASE_URL) {
  fail("원본과 대상 DATABASE_URL이 같습니다.");
}
if (!confirmed) {
  fail("대상 DB를 교체하려면 --confirm 옵션을 추가하세요.");
}

const workDir = mkdtempSync(join(tmpdir(), "npay-db-migration-"));
const dumpFile = join(workDir, "source.dump");

try {
  console.log("1/3 원본 PostgreSQL DB를 임시 덤프로 추출합니다.");
  run("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    dumpFile,
    sourceUrl,
  ]);

  console.log("2/3 로컬 PostgreSQL DB로 복원합니다.");
  run("pg_restore", [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    "--dbname",
    LOCAL_DATABASE_URL,
    dumpFile,
  ]);

  console.log("3/3 데이터 이전이 완료되었습니다.");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}