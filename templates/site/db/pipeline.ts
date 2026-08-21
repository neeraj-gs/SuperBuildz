/**
 * The pipeline: stages a lead moves through, and which form lands where.
 * Stage 4 of the build renames these for the business (a restaurant has
 * "Booking requested → Confirmed → Seated → No-show"; a SaaS has "Signed up →
 * Activated → Paying"). Keep ids stable; change labels freely.
 */

export interface Stage { id: string; label: string; /** Counts as a win for the KPIs. */ won?: boolean; /** Counts as lost. */ lost?: boolean }

export const STAGES: Stage[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'won', label: 'Won', won: true },
  { id: 'lost', label: 'Lost', lost: true },
];

/** Which stage each form's submissions start in, and how to title the lead. */
export const FORMS: Record<string, { stage: string; title: (f: Record<string, string>) => string; value?: number }> = {
  contact: { stage: 'new', title: (f) => f.name || f.email || 'Enquiry' },
  booking: { stage: 'new', title: (f) => `${f.name || 'Booking'}${f.date ? ` · ${f.date}` : ''}` },
  newsletter: { stage: 'contacted', title: (f) => f.email || 'Subscriber' },
  quote: { stage: 'qualified', title: (f) => f.name || 'Quote request' },
};

export function stageFor(id: string): Stage { return STAGES.find((s) => s.id === id) ?? STAGES[0]; }
