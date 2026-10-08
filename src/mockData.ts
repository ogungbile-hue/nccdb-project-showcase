// src/mockData.ts
import { PriceRecord } from './types';

export const INITIAL_MOCK_PRICES: PriceRecord[] = [
  {
    id: "seed-mock-1",
    materialId: "mat-id-1",
    locationId: "loc-id-1",
    price: 420.00,
    currency: "NGN",
    timestamp: new Date().toISOString(),
    sourceType: "QS_REPORT",
    status: "PENDING",
    notes: "Seeded initial baseline cost record.",
    submittedById: "22ab8a0-df41-4db7-8d48-4f33c100d6f7",
    material: {
      id: "mat-id-1",
      name: "Vibrated Sandcrete Block 9-inch",
      specification: "Load-bearing vibrated sandcrete block 450x225x225mm",
      unitOfMeasurement: "Pcs"
    },
    location: {
      id: "loc-id-1",
      city: "Ibadan",
      zone: "SOUTH_WEST" // 🌟 Standardized to Macro Region
    }
  },
  {
    id: "seed-mock-2",
    materialId: "mat-id-2",
    locationId: "loc-id-2",
    price: 8500.00,
    currency: "NGN",
    timestamp: new Date().toISOString(),
    sourceType: "MANUAL_ENTRY", // 🌟 FIXED: Matches VALID_SOURCE_TYPES exactly
    status: "PENDING",
    notes: "Market data ingestion validation review.",
    submittedById: "22ab8a0-df41-4db7-8d48-4f33c100d6f7",
    material: {
      id: "mat-id-2",
      name: "Dangote Portland Cement 42.5R",
      specification: "Ordinary Portland Cement (OPC) 50kg bag",
      unitOfMeasurement: "Bag"
    },
    location: {
      id: "loc-id-2",
      city: "Abuja",
      zone: "NORTH_CENTRAL" // 🌟 Standardized to Macro Region
    }
  },
  {
    id: "seed-mock-3",
    materialId: "mat-id-1",
    locationId: "loc-id-3",
    price: 450.00,
    currency: "NGN",
    timestamp: new Date().toISOString(),
    sourceType: "BULLETIN",
    status: "PENDING",
    notes: "Seeded Eastern region geopolitical baseline cost index record.",
    submittedById: "22ab8a0-df41-4db7-8d48-4f33c100d6f7",
    material: {
      id: "mat-id-1",
      name: "Vibrated Sandcrete Block 9-inch",
      specification: "Load-bearing vibrated sandcrete block 450x225x225mm",
      unitOfMeasurement: "Pcs"
    },
    location: {
      id: "loc-id-3",
      city: "Enugu",
      zone: "SOUTH_EAST"
    }
  }
];