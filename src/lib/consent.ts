// Terms/privacy consent versioning. Client-safe — no server imports.
//
// Bump TERMS_VERSION whenever /terms or /privacy change materially; users who
// accepted an older version are re-prompted by the in-app ConsentGate (the
// gate blocks on a missing acceptance, and shows a lighter re-accept for a
// version mismatch). The accepted version + server timestamp live on
// user_profiles (terms_accepted_at / terms_version), written only by
// service-role API routes so the record carries an honest clock.
export const TERMS_VERSION = '2026-08-06'

export interface ConsentState {
  termsAccepted: boolean
  termsVersion: string | null
  marketingOptIn: boolean
}
