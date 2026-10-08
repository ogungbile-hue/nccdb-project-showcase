// ✅ FIXED: Added UnitRateCalculation to the imports block
import { PriceRecord, ModerationPayload, CreatePriceSubmission, ModerationStatus, UnitRateCalculation } from './types';

// 🚀 FIXED: Set the base to use relative proxy routing so Vite handles local vs network origins fluidly
const API_BASE_URL = '/api';

export class ApiService {
  /**
   * Transmits credentials to the server to establish an administrative session.
   */
  public static async adminLogin(payload: any): Promise<string> {
    const resp = await fetch(`${API_BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.message || `Authentication Failed: HTTP status ${resp.status}`);
    }

    const data = await resp.json();
    return data.token;
  }

  /**
   * Fetches target price records directly from the live database stream.
   * ✅ UPGRADED: Explicitly typed to handle ModerationStatus values safely.
   */
  public static async fetchPrices(status: ModerationStatus | 'ALL' = 'PENDING'): Promise<PriceRecord[]> {
    // 🚀 FIXED: Use unified token key matching your App component setup
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    
    const query = status === 'ALL' ? '' : `?status=${status}`;
    const resp = await fetch(`${API_BASE_URL}/prices${query}`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        // 🚀 FIXED: Passes authorization check seamlessly
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
    });

    if (!resp.ok) {
      throw new Error(`Database Error: HTTP transaction failed with status ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Commits definitive administrative status updates directly to PostgreSQL. Injects admin JWT token.
   */
  public static async updateStatus(id: string, payload: ModerationPayload): Promise<PriceRecord> {
    // 🚀 FIXED: Use unified token key matching your App component setup
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');

    const resp = await fetch(`${API_BASE_URL}/prices/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // 🚀 FIXED: Passes authorization check seamlessly
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Database Error: Failed to patch status field. Code: ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Hard deletes a price record (Rejection).
   */
  public static async deletePrice(id: string): Promise<void> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/admin/submissions/${id}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Database Error: Failed to delete price record.`);
    }
  }

  /**
   * Transmits a new price entry record straight to the live database stream.
   * Kept open for standard/unauthenticated submission logging.
   */
  public static async createSubmission(payload: CreatePriceSubmission | CreatePriceSubmission[]): Promise<any> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      const errorMsg = errorData.error || errorData.message || `Database Error: Ingestion failed with HTTP status ${resp.status}`;
      throw new Error(errorMsg);
    }
    return resp.json();
  }

  /**
   * Streams calculated composite unit rates from the backend compilation engine.
   * Pulls structural material constants merged with live approved market rates.
   */
  public static async fetchUnitRates(): Promise<UnitRateCalculation[]> {
    // 🚀 FIXED: Use unified token key matching your App component setup
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');

    const resp = await fetch(`${API_BASE_URL}/unit-rates`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // 🚀 FIXED: Passes authorization check seamlessly
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
    });

    if (!resp.ok) {
      throw new Error(`Database Error: Computational engine failed with status ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Fetches the global material dictionary for filter decoupling.
   */
  public static async fetchMaterials(): Promise<any[]> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/materials`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
    });
    if (!resp.ok) {
      throw new Error(`Database Error: Failed to fetch materials with status ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Fetches the global location dictionary for filter decoupling.
   */
  public static async fetchLocations(): Promise<any[]> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/locations`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
    });
    if (!resp.ok) {
      throw new Error(`Database Error: Failed to fetch locations with status ${resp.status}`);
    }
    return resp.json();
  }

  public static async fetchPublicMaterialTrends(): Promise<any[]> {
    const resp = await fetch(`${API_BASE_URL}/public/materials/trends`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch public material trends with status ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Simulate AI mapping against the Master Material Registry
   */
  public static async simulateMapping(rawLines: string[]): Promise<any[]> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/materials/simulate-mapping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ rawLines }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `Simulation failed with HTTP status ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Syncs the Master Material Registry Google Sheet.
   */
  public static async syncMasterSheet(spreadsheetId: string): Promise<any> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/materials/sync-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ spreadsheetId }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `Sync failed with HTTP status ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Syncs the Master Material Registry Google Sheet directly using the server's env ID.
   */
  public static async syncMasterRegistry(): Promise<any> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/materials/sync-master`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `Sync failed with HTTP status ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Manually triggers the automated sheet synchronization engine.
   */
  public static async triggerSync(): Promise<any> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/admin/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
    });
    if (!resp.ok) {
      throw new Error(`Sync Error: Failed to execute manual sync. Code: ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * Registers a new Google Spreadsheet ID to the database tracking list and triggers its first sync.
   */
  public static async addSupplierFeed(spreadsheetId: string): Promise<any> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/admin/supplier-feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ spreadsheetId })
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to add supplier feed. Code: ${resp.status}`);
    }
    return resp.json();
  }

  public static async fetchFeeds(): Promise<any[]> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/admin/feeds`, {
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!resp.ok) throw new Error('Failed to fetch supplier feeds');
    const data = await resp.json();
    return data.feeds;
  }

  public static async deleteFeed(id: string): Promise<void> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/admin/feeds/${id}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!resp.ok) throw new Error('Failed to delete feed');
  }

  public static async toggleFeedStatus(id: string, isActive: boolean): Promise<any> {
    const token = localStorage.getItem('nccdb_admin_token') || localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/admin/feeds/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ isActive })
    });
    if (!resp.ok) throw new Error('Failed to toggle feed status');
    return resp.json();
  }

  // ==========================================
  // PUBLIC PORTAL / ANALYTICS ENDPOINTS
  // ==========================================

  static async searchPublicMaterials(query: string) {
    const resp = await fetch(`${API_BASE_URL}/public/search?q=${encodeURIComponent(query)}`);
    if (!resp.ok) throw new Error('Failed to search public materials');
    return resp.json();
  }

  static async getRegionalVariance(materialId: string) {
    const resp = await fetch(`${API_BASE_URL}/public/analytics/regional/${materialId}`);
    if (!resp.ok) throw new Error('Failed to fetch regional variance');
    return resp.json();
  }

  static async getTrendAnalytics(materialId: string) {
    const resp = await fetch(`${API_BASE_URL}/public/analytics/trends/${materialId}`);
    if (!resp.ok) throw new Error('Failed to fetch trend analytics');
    return resp.json();
  }

  // ==========================================
  // SECURE SPREADSHEET PROVISIONING
  // ==========================================
  static async provisionSupplier(supplierData: any) {
    const token = localStorage.getItem('nccdb_token');
    const resp = await fetch(`${API_BASE_URL}/admin/suppliers/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(supplierData)
    });
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => null);
      throw new Error(errorData?.error || 'Failed to provision custom supplier sheet');
    }
    return resp.json();
  }
}