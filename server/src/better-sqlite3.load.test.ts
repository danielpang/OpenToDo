import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

describe('better-sqlite3 native module', () => {
  it('loads and executes a database query', () => {
    const db = new Database(':memory:');
    try {
      db.exec('CREATE TABLE probe (value TEXT NOT NULL)');
      db.prepare('INSERT INTO probe (value) VALUES (?)').run('ready');
      expect(db.prepare('SELECT value FROM probe').get()).toEqual({ value: 'ready' });
    } finally {
      db.close();
    }
  });
});
