export const DEFAULT_SYSTEM_AUDITOR_ID = 'MOD-SYS-88';

// 🔒 STRICT PRIVILEGE FILTER: Only highly credible, professional data sources allowed
export const VALID_SOURCE_TYPES = [
  'QS_REPORT',      // Highest Priority: Bill of Quantities & Official Project Audits
  'MANUAL_ENTRY',   // High Priority: Verified Field Surveys by Professionals
  'TENDER_RETURN',  // High Priority: Actual competitive contractor bids
  'BULLETIN'        // Medium Priority: Institutional Market Bulletins/Indices
];