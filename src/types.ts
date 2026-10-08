export type ModerationStatus = 'PENDING' | 'APPROVED' | 'FLAGGED' | 'CORRUPTED';

export interface Material {
  id: string;
  name: string;
  specification: string; // Made non-nullable to satisfy component template views
  unitOfMeasurement: string; // Aligned exactly with Prisma schema
  categoryId?: string | null;
  lastPriceUpdate?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
}

export interface Location {
  id: string;
  city: string;
  zone: string;
  createdAt?: string;
}

export interface PriceRecord {
  id: string;
  materialId: string;
  locationId: string;
  price: number | null;
  rawPriceInput?: string | null;
  currency: string;
  timestamp: string;
  deviationRate?: number | null;
  sourceType: string;
  status: ModerationStatus;
  notes: string | null;
  submittedById: string;
  // Fix 4: submitter contact metadata from the User relation
  submittedBy?: { name: string; email: string; phoneNumber: string | null } | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  material: Material;
  location: Location;
}

export interface FilterState {
  materialName: string; // Added to resolve object literal missing parameter checks
  city: string;
  zone: string;
  startDate: string;
  endDate: string;
  searchQuery: string;  // Added to clear FilterToolbar query text matching warnings
  sourceType: string;   // Added to satisfy advanced queue filtering selectors
}

export interface ModerationPayload {
  status: ModerationStatus;
  notes: string;
  moderatedById: string;
}

// Added for Phase 2: Manual Price Entry Form payloads
export interface CreatePriceSubmission {
  materialId: string;
  locationId: string;
  price: number;
  currency: string;
  // Updated: BULLETIN renamed to MARKET_BULLETIN to match the canonical PriceSourceType enum
  sourceType: 'QS_REPORT' | 'MANUAL_ENTRY' | 'TENDER_RETURN' | 'MARKET_BULLETIN';
  notes: string;
}

export interface ProcessedComponent {
  id: string;
  type: 'MATERIAL' | 'LABOR' | 'PLANT';
  name: string;
  constant: number;
  unit: string;
  unitPrice: number;
  computedCost: number;
}

export interface UnitRateCalculation {
  id: string;
  rateCode: string;
  description: string;
  unit: string;
  overheadPct: number;
  profitPct: number;
  breakdown: {
    materialSum: number;
    laborSum: number;
    plantSum: number;
    subTotal: number;
    overheadCost: number;
    profitCost: number;
    totalUnitRate: number;
  };
  components: ProcessedComponent[];
}