/**
 * The CRM's tables, once, for both dialects. Drizzle's sqlite-core and
 * pg-core are different modules, so the shape is declared here as data and
 * each dialect's table objects are built from it in index.ts. Queries use the
 * Drizzle query builder only — never string-built SQL.
 */

export interface Lead {
  id: string;
  createdAt: number;
  updatedAt: number;
  stage: string;
  source: string;      // which form
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  /** Every other field the form sent, as JSON. */
  fields: string;
  page: string;
  value: number;       // estimated value, for the pipeline totals
  tags: string;        // comma-separated
  archived: number;    // 0/1
}

export interface Activity {
  id: string;
  leadId: string;
  at: number;
  kind: string;        // 'created' | 'stage' | 'note' | 'email' | 'call' | 'system'
  text: string;
  by: string;          // 'site' | 'owner'
}

export interface Event {
  id: string;
  at: number;
  name: string;
  path: string;
  sid: string;
  ref: string;
  props: string;       // JSON
}

export type LeadInsert = Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Lead, 'id' | 'createdAt' | 'updatedAt'>>;
