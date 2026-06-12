// Client-side collaboration constants shared between the /join page and the
// app shell (kept out of both so neither pulls the other's bundle).

/** localStorage slot where /join parks an invite token while the visitor
 *  signs in / signs up; the app shell replays it on the next /app load. */
export const PENDING_JOIN_KEY = 'nodea_pending_join'
