// Canonical "What do you use Nodea for?" survey definition. Client-safe.
//
// Answers live on user_profiles.use_cases — a text[] of option KEYS (plus
// 'other', with free text in use_cases_other). NULL use_cases means the user
// has never answered; the in-app survey popup keys off that, so an answered
// selection must always be written as an array (possibly empty), never NULL.
//
// Keys are stored in the DB — never rename one without migrating data.

export const USE_CASE_OTHER_KEY = 'other'

/** Max free-text length for the "Other" box — mirrors the DB check constraint. */
export const USE_CASES_OTHER_MAX = 280

/** localStorage flag set when a user skips the in-app survey popup. */
export const USE_CASE_SURVEY_DISMISSED_KEY = 'nodea_use_case_survey_dismissed_v1'

export const USE_CASE_OPTIONS = [
  { key: 'writing',       label: 'Writing & editing' },
  { key: 'research',      label: 'Research & learning' },
  { key: 'coding',        label: 'Coding & building' },
  { key: 'brainstorming', label: 'Brainstorming & ideas' },
  { key: 'school',        label: 'School & studying' },
  { key: 'work',          label: 'Work & business decisions' },
  { key: 'personal',      label: 'Personal projects & life' },
] as const
