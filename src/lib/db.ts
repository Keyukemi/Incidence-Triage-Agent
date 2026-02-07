import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { IncidentInput, IncidentClassification, IncidentReport, SimilarIncident } from '@/types/incident';

const DB_PATH = path.join(process.cwd(), 'db', 'incidents.db');

let db: Database.Database | null = null;

function getDB(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      model TEXT,
      error_code INTEGER,
      error_message TEXT,
      fault_domain TEXT,
      severity TEXT,
      report TEXT
    )
  `);

  return db;
}

export function saveIncident(
  input: IncidentInput,
  classification: IncidentClassification,
  report: IncidentReport
): string {
  const id = uuidv4();
  const database = getDB();

  database.prepare(`
    INSERT INTO incidents (id, model, error_code, error_message, fault_domain, severity, report)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.model ?? null,
    input.error.code,
    input.error.message,
    classification.faultDomain,
    classification.severity,
    JSON.stringify(report)
  );

  return id;
}

export function findSimilar(errorMessage: string, limit: number = 3): SimilarIncident[] {
  const database = getDB();

  const words = errorMessage
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (words.length === 0) return [];

  const pattern = `%${words[0]}%`;

  const rows = database.prepare(`
    SELECT id, created_at, error_message, fault_domain, severity
    FROM incidents
    WHERE error_message LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(pattern, limit) as Array<{
    id: string;
    created_at: string;
    error_message: string;
    fault_domain: string;
    severity: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    faultDomain: row.fault_domain,
    severity: row.severity,
  }));
}
