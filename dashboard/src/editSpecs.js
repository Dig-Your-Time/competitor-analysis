import { TIERS, RELIABILITIES, CONFIDENCE, CURRENCIES } from './editApi.js'

// Each field maps a display property (`key`, read from data.json) to the CSV
// column it writes (`col`). Only HAND columns appear here; anything omitted is
// preserved untouched by apply_edit's partial update.

const REGIONS = ['Finland', 'Nordics', 'EU-Other', 'UK', 'North America', 'Other']
const STATUSES = ['Active', 'Acquired', 'Closed', 'Dormant']
const SELFPUB = ['Yes', 'No', 'Mixed', 'TBD', 'Unknown']

export const companyFields = [
  { key: 'company_name', col: 'company_name', label: 'Studio name' },
  { key: 'country', col: 'country', label: 'Country' },
  { key: 'city', col: 'city', label: 'City' },
  { key: 'region', col: 'region_bucket', label: 'Region', type: 'select', options: REGIONS },
  { key: 'status', col: 'company_status', label: 'Status', type: 'select', options: STATUSES },
  { key: 'company_size', col: 'company_size', label: 'Team size', placeholder: 'Small (6-20)' },
  { key: 'self_published', col: 'self_published', label: 'Self-published', type: 'select', options: SELFPUB },
  { key: 'parent_company', col: 'parent_company', label: 'Parent company' },
  { key: 'founded_year', col: 'founded_year', label: 'Founded (year)', type: 'number' },
  { key: 'website', col: 'website', label: 'Website' },
  { key: 'src_registry', col: 'src_registry', label: 'Registry source id', placeholder: 'S001' },
  { key: 'src_headcount', col: 'src_headcount', label: 'Headcount source id', placeholder: 'S003' },
]

// company_id is the key: only offered on add, never editable in place
export const newCompanyFields = [
  { key: 'company_id', col: 'company_id', label: 'Studio id (slug)', hint: 'lowercase, permanent, e.g. bippinbits' },
  ...companyFields,
]

export const gameSeedFields = [
  { key: 'title', col: 'title', label: 'Title' },
  { key: 'company_id', col: 'company_id', label: 'Studio id (company_id)' },
  { key: 'tier', col: 'tier', label: 'Tier', type: 'select', options: TIERS },
  { key: 'comparable_class', col: 'comparable_class', label: 'Comparable class', placeholder: 'Mining/Digging' },
  { key: 'production_tier', col: 'production_tier', label: 'Production tier', placeholder: 'Small team' },
  { key: 'relevance_note', col: 'relevance_note', label: 'Relevance note', type: 'textarea' },
]

// est_units override — writes the HAND columns on gamalytic_stats.csv. Blank
// low/mid/high falls back to the modelled Boxleiter band in build_estimates.py.
export const estimateFields = [
  { key: 'est_units_low', col: 'units_low', label: 'Units — low', type: 'number', hint: 'from Gamalytic; blank = modelled band' },
  { key: 'est_units_mid', col: 'units_mid', label: 'Units — mid', type: 'number' },
  { key: 'est_units_high', col: 'units_high', label: 'Units — high', type: 'number' },
  { key: 'est_revenue_gross_mid', col: 'revenue_gross', label: 'Gross revenue (USD)', type: 'number', hint: 'Gamalytic gross, before Valve\u2019s cut' },
]

export const financialFields = [
  { key: 'fiscal_year', col: 'fiscal_year', label: 'Fiscal year', type: 'number' },
  { key: 'revenue', col: 'revenue', label: 'Revenue (native currency)', type: 'number' },
  { key: 'operating_profit', col: 'operating_profit', label: 'Operating profit', type: 'number' },
  { key: 'net_profit', col: 'net_profit', label: 'Net profit', type: 'number' },
  { key: 'employees_avg', col: 'employees_avg', label: 'Employees (avg)', type: 'number' },
  { key: 'currency', col: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
  { key: 'source_id', col: 'source_id', label: 'Source id', placeholder: 'S010' },
  { key: 'note', col: 'notes', label: 'Notes', type: 'textarea' },
]

export const fundingFields = [
  { key: 'round_date', col: 'round_date', label: 'Round date (YYYY-MM-DD)' },
  { key: 'funding_stage', col: 'funding_stage', label: 'Stage', placeholder: 'Seed / Grant / Acquisition' },
  { key: 'amount', col: 'amount', label: 'Amount (native currency)', type: 'number' },
  { key: 'currency', col: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
  { key: 'investors', col: 'investors', label: 'Investors' },
  { key: 'confidence', col: 'confidence', label: 'Confidence', type: 'select', options: CONFIDENCE },
  { key: 'source_id', col: 'source_id', label: 'Source id' },
  { key: 'note', col: 'notes', label: 'Notes', type: 'textarea' },
]

// source_type kept as free text so an unusual existing value is never clobbered
export const sourceFields = [
  { key: 'title', col: 'title', label: 'Title' },
  { key: 'source_type', col: 'source_type', label: 'Type', placeholder: 'Registry / News / Interview…' },
  { key: 'reliability', col: 'reliability', label: 'Reliability', type: 'select', options: RELIABILITIES },
  { key: 'url', col: 'url', label: 'URL' },
  { key: 'archive_url', col: 'archive_url', label: 'Archived URL', hint: 'web.archive.org copy for fragile pages' },
  { key: 'outlet', col: 'outlet', label: 'Outlet' },
  { key: 'author', col: 'author', label: 'Author' },
  { key: 'date_published', col: 'date_published', label: 'Date published (YYYY-MM-DD)' },
  { key: 'notes', col: 'notes', label: 'Notes', type: 'textarea' },
]

export const newSourceFields = [
  { key: 'source_id', col: 'source_id', label: 'Source id', hint: 'e.g. S051' },
  ...sourceFields,
]
