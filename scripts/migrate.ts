import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);
  const schema = readFileSync('src/lib/schema.sql', 'utf-8');

  // Split on semicolons, filter empty and comment-only lines
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => {
      const withoutComments = s.replace(/--.*$/gm, '').trim();
      return withoutComments.length > 0;
    });

  for (const statement of statements) {
    try {
      await sql.query(statement);
      const preview = statement.replace(/--.*$/gm, '').trim().substring(0, 60);
      console.log('OK:', preview + '...');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('FAILED:', statement.substring(0, 60) + '...');
      console.error('  Error:', msg);
      throw err;
    }
  }

  console.log('\nMigration complete.');
}

migrate().catch(console.error);
