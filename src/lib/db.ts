import { neon } from '@neondatabase/serverless';

// Single shared SQL tagged-template client backed by Neon's serverless driver
// (HTTP — no pooling needed, ideal for Vercel functions). DATABASE_URL is set in
// .env.local locally and in Vercel project env for all environments.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export const sql = neon(url);
