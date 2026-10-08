import React, { useState, useEffect, useMemo } from 'react';
import { PriceRecord, FilterState, ModerationPayload, ModerationStatus } from '../types';
import { ApiService } from '../apiService';
import { FilterToolbar } from './FilterToolbar';
import { SubmissionsTable, SortField, SortOrder } from './SubmissionsTable';
import { ModerationModal } from './ModerationModal';
import { Layers, RefreshCw, CheckCircle, AlertCircle, ShieldCheck, LogOut, Trash2, Pause, Play, Users, LayoutDashboard } from 'lucide-react';
import { ManualEntryForm } from './ManualEntryForm';
import { OnboardSupplier } from './admin/OnboardSupplier';
import { EightyTwoBadge } from './ui/EightyTwoBadge';

// 🚀 FIXED: Added incoming explicitly typed session props from App.tsx context
interface AdminDashboardProps {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  // 🚀 FIXED: Sync auditor profile naming dynamically to whichever account authenticated (Google or Manual Admin)
  const [moderatorId, setModeratorId] = useState(user.fullName || 'MOD-SYS-88');
  
  // Track the currently active Ledger Status filter (Defaults safely to 'APPROVED' for contributors)
  const [currentStatus, setCurrentStatus] = useState<ModerationStatus | 'ALL'>(user.role === 'SUPER_ADMIN' ? 'PENDING' : 'APPROVED');
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PriceRecord | null>(null);
  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false);
  // P1 Guard: tracks record IDs with in-flight PATCH requests to block concurrent double-clicks
  const [actionPendingIds, setActionPendingIds] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [newFeedId, setNewFeedId] = useState('');
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  
  // Ledger state for feeds
  const [feeds, setFeeds] = useState<any[]>([]);
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(false);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'onboard'>('dashboard');

  const fetchFeeds = async () => {
    setIsLoadingFeeds(true);
    try {
      const data = await ApiService.fetchFeeds();
      setFeeds(data);
    } catch (err) {
      console.error('Failed to fetch feeds:', err);
    } finally {
      setIsLoadingFeeds(false);
    }
  };

  useEffect(() => {
    if (user.role === 'SUPER_ADMIN') {
      fetchFeeds();
    }
  }, [user.role]);

  const [filters, setFilters] = useState<FilterState>({
    materialName: '',
    city: '',
    zone: '',
    startDate: '',
    endDate: '',
    searchQuery: '',
    sourceType: '',
  });

  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      await ApiService.triggerSync();
      setSuccessToast('External sheets successfully synchronized with database!');
      await loadQueueByStatus(); // Hot reload the grid
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error: Unable to trigger spreadsheet synchronization.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddFeed = async () => {
    if (!newFeedId.trim()) return;
    setIsAddingFeed(true);
    setErrorMsg(null);
    try {
      await ApiService.addSupplierFeed(newFeedId.trim());
      setSuccessToast('New Supplier Feed successfully added and synced!');
      setNewFeedId('');
      fetchFeeds(); // Refresh feed ledger
      await loadQueueByStatus(); // Reload grid
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error: Unable to add supplier feed.');
    } finally {
      setIsAddingFeed(false);
    }
  };

  const handleDeleteFeed = async (id: string) => {
    if (!window.confirm('Are you sure you want to completely remove this spreadsheet connection?')) return;
    try {
      await ApiService.deleteFeed(id);
      setSuccessToast('Supplier Feed deleted successfully.');
      fetchFeeds();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error: Unable to delete feed.');
    }
  };

  const handleToggleFeed = async (id: string, currentStatus: boolean) => {
    try {
      await ApiService.toggleFeedStatus(id, !currentStatus);
      setSuccessToast(`Supplier Feed ${currentStatus ? 'paused' : 'resumed'}.`);
      fetchFeeds();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error: Unable to toggle feed status.');
    }
  };

  // Dynamically stream historical cost records based on active select dropdown states
  const loadQueueByStatus = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await ApiService.fetchPrices(currentStatus);
      setRecords(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error: Unable to sync with active PostgreSQL pricing streams for state: ${currentStatus}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-trigger network data requests whenever current status tabs switch
  useEffect(() => {
    loadQueueByStatus();
  }, [currentStatus]);

  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  const [globalMaterials, setGlobalMaterials] = useState<any[]>([]);
  const [globalLocations, setGlobalLocations] = useState<any[]>([]);

  useEffect(() => {
    const fetchGlobals = async () => {
      try {
        const [mats, locs] = await Promise.all([
          ApiService.fetchMaterials(),
          ApiService.fetchLocations()
        ]);
        setGlobalMaterials(mats);
        setGlobalLocations(locs);
      } catch (err) {
        console.error("Error fetching globals", err);
      }
    };
    fetchGlobals();
  }, []);

  const availableMaterialNames = useMemo(() => Array.from(new Set(records.map(p => p.material.name))).sort(), [records]);
  const availableCities = useMemo(() => Array.from(new Set(records.map(p => p.location.zone))).sort(), [records]);
  const availableZones = useMemo(() => Array.from(new Set(records.map(p => p.location.city))).sort(), [records]);
  const availableSourceTypes = useMemo(() => Array.from(new Set(records.map(p => p.sourceType))).sort(), [records]);

  const filteredPrices = useMemo(() => {
    let result = [...records];

    if (filters.materialName) result = result.filter(p => p.material.name === filters.materialName);
    if (filters.city) result = result.filter(p => p.location.zone === filters.city);
    if (filters.zone) result = result.filter(p => p.location.city === filters.zone);
    if (filters.sourceType) result = result.filter(p => p.sourceType === filters.sourceType);
    
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      result = result.filter(p => new Date(p.timestamp).getTime() >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime() + 86400000;
      result = result.filter(p => new Date(p.timestamp).getTime() <= end);
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(p => 
        p.material.name.toLowerCase().includes(q) ||
        (p.material.specification && p.material.specification.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'materialName') {
        valA = a.material.name.toLowerCase();
        valB = b.material.name.toLowerCase();
      } else if (sortField === 'price') {
        valA = Number(a.price);
        valB = Number(b.price);
      } else if (sortField === 'timestamp') {
        valA = new Date(a.timestamp).getTime();
        valB = new Date(b.timestamp).getTime();
      } else if (sortField === 'location') {
        valA = `${a.location.city}-${a.location.zone}`.toLowerCase();
        valB = `${b.location.city}-${b.location.zone}`.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, filters, sortField, sortOrder]);

  const handleFilterChange = (updating: Partial<FilterState>) => {
    setFilters((prev: FilterState) => ({ ...prev, ...updating }));
  };

  const handleResetFilters = () => {
    setFilters({ materialName: '', city: '', zone: '', startDate: '', endDate: '', searchQuery: '', sourceType: '' });
  };

  const handleStatusSubmit = async (id: string, payload: ModerationPayload) => {
    // P1 Guard: bail immediately if a request for this record is already in-flight
    if (actionPendingIds.has(id)) return;

    setActionPendingIds((prev) => new Set(prev).add(id));
    try {
      await ApiService.updateStatus(id, payload);
      setRecords(prev => prev.filter(p => p.id !== id));
      setSuccessToast(`Record verified. Status updated to ${payload.status}.`);

      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Transaction Failure: Unable to save status adjustments.');
    } finally {
      // Always release the lock regardless of success or failure
      setActionPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (actionPendingIds.has(id)) return;
    if (!window.confirm("Are you sure you want to permanently delete this submission?")) return;

    setActionPendingIds((prev) => new Set(prev).add(id));
    try {
      await ApiService.deletePrice(id);
      setRecords(prev => prev.filter(p => p.id !== id));
      setSuccessToast(`Record successfully rejected and deleted.`);
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error: Unable to delete pricing record.');
    } finally {
      setActionPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSubmissionSuccess = (newRecord: PriceRecord) => {
    if (currentStatus === 'PENDING') {
      setRecords(prev => [newRecord, ...prev]);
    }
    setSuccessToast(`Ingestion success: New pending entry added directly to database ledger.`);
  };

  const handleQuickApprove = async (id: string) => {
    await handleStatusSubmit(id, { status: 'APPROVED', notes: 'Quick Approved via grid matrix control line.', moderatedById: moderatorId });
  };

  const handleQuickFlag = async (id: string) => {
    await handleStatusSubmit(id, { status: 'FLAGGED', notes: 'Quick Flagged via grid matrix control line.', moderatedById: moderatorId });
  };

  const handleQuickRevert = async (id: string) => {
    await handleStatusSubmit(id, { status: 'PENDING', notes: 'Reverted to pending queue via grid matrix control line.', moderatedById: moderatorId });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const selectMaterialOptions = useMemo(() => {
    return globalMaterials.map(m => ({
      id: m.id,
      name: m.name,
      unit: m.unitOfMeasurement || ''
    }));
  }, [globalMaterials]);

  const selectLocationOptions = useMemo(() => {
    return globalLocations.map(l => ({
      id: l.id,
      city: l.city,
      zone: l.zone
    }));
  }, [globalLocations]);

  // Determine dynamic label string based on queue tracking filter selection
  const getStatusDisplayLabel = () => {
    if (currentStatus === 'APPROVED') return 'Approved Cost Baseline';
    if (currentStatus === 'FLAGGED') return 'Flagged Inconsistency Logs';
    if (currentStatus === 'CORRUPTED') return 'Corrupted Data Logs';
    return 'Outstanding Submissions Queue';
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex flex-col font-sans">

      {/* ── Top Navigation Bar ── */}
      <header className="bg-[#0a0f1c] text-white shrink-0 relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Brand-orange accent stripe */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #ff6b35 0%, rgba(255,107,53,0.15) 50%, transparent 100%)' }} />
        
        <div className="flex items-center justify-between px-4 sm:px-6 h-13" style={{ height: 52 }}>
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <div style={{ filter: 'drop-shadow(0 0 10px rgba(255,107,53,0.35))' }}>
              <EightyTwoBadge size={26} speed={0.6} />
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-xs font-bold tracking-widest uppercase text-white">NCCDB</h1>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide hidden sm:block">Audit Dashboard</span>
            </div>
            {/* Role chip — orange only */}
            <span
              className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)', color: '#ff6b35' }}
            >
              {user.role.replace('_', ' ')}
            </span>
          </div>

          {/* Right: Session info + logout */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Online indicator + email — hidden on very small screens */}
            <div className="hidden md:flex items-center gap-2">
              <span className="status-dot" />
              <span className="text-[11px] text-slate-400 font-medium truncate max-w-[160px]">{user.email}</span>
            </div>

            {/* Divider */}
            <div className="hidden md:block h-4 w-px bg-white/10" />

            {/* Operator alias — editable */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Operator</span>
              <input
                type="text"
                value={moderatorId}
                onChange={(e) => setModeratorId(e.target.value)}
                className="bg-white/[0.06] border border-white/10 rounded-md text-white text-[11px] font-medium px-2 py-1 focus:outline-none focus:border-[#ff6b35]/50 w-[120px] text-center transition-colors"
              />
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-white/10" />

            {/* Logout */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white/[0.06]"
              title="End session"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Error bar */}
      {errorMsg && (
        <div className="bg-red-950/60 text-red-300 font-medium text-xs py-2 px-4 sm:px-6 flex items-center gap-2 border-b border-red-900/40">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success toast */}
      {successToast && (
        <div className="fixed bottom-5 right-4 sm:right-5 z-50 animate-fade-slide-up">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white max-w-xs"
            style={{ background: '#0a0f1c', border: '1px solid rgba(255,107,53,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <CheckCircle className="h-4 w-4 shrink-0" style={{ color: '#ff6b35' }} />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {/* Main workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-5 py-4 space-y-4">
        
        {/* Navigation tabs — Super Admin only */}
        {user.role === 'SUPER_ADMIN' && (
          <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 self-start shadow-sm">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#0a0f1c] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('onboard')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'onboard'
                  ? 'bg-[#0a0f1c] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Onboard Supplier
            </button>
          </div>
        )}

        {activeTab === 'onboard' ? (
          <OnboardSupplier />
        ) : (
          <>
            {/* ── Toolbar ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
              {/* Queue label */}
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-bold text-slate-900">{getStatusDisplayLabel()}</h2>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,107,53,0.1)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.2)' }}
                >
                  {records.length}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {user.role === 'SUPER_ADMIN' && (
                  <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50">
                    <input
                      type="text"
                      placeholder="Spreadsheet ID"
                      value={newFeedId}
                      onChange={(e) => setNewFeedId(e.target.value)}
                      className="text-xs bg-transparent outline-none w-36 placeholder-slate-400 text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={handleAddFeed}
                      disabled={isAddingFeed || !newFeedId.trim()}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                        isAddingFeed || !newFeedId.trim()
                          ? 'text-slate-400 cursor-not-allowed'
                          : 'bg-slate-800 text-white hover:bg-slate-700 cursor-pointer'
                      }`}
                    >
                      {isAddingFeed ? '…' : '+ Feed'}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsEntryFormOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white cursor-pointer transition-all"
                  style={{ background: '#ff6b35', boxShadow: '0 2px 8px rgba(255,107,53,0.25)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e85c28')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#ff6b35')}
                >
                  + Add Entry
                </button>

                <button
                  type="button"
                  onClick={handleTriggerSync}
                  disabled={isSyncing || isLoading}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition-all ${
                    isSyncing || isLoading
                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing || isLoading ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing…' : 'Sync'}
                </button>
              </div>
            </div>
          </div>

        {/* ACTIVE SUPPLIER FEEDS LEDGER */}
        {user.role === 'SUPER_ADMIN' && (
          <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-sm mt-2 mb-4">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-[10px] font-bold uppercase tracking-tight text-slate-600">Active Supplier Feeds Ledger</h3>
              <span className="text-[9px] text-slate-400 font-mono">{feeds.length} Connections</span>
            </div>
            {isLoadingFeeds ? (
              <div className="p-4 text-center text-slate-400 text-[10px]">Loading ledger...</div>
            ) : feeds.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-[10px]">No active feeds connected.</div>
            ) : (
              <table className="w-full text-left text-[10px]">
                <thead className="bg-slate-100 text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-1.5 font-bold border-b border-slate-200 w-[120px]">Status</th>
                    <th className="px-3 py-1.5 font-bold border-b border-slate-200">Spreadsheet ID</th>
                    <th className="px-3 py-1.5 font-bold border-b border-slate-200 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feeds.map(feed => (
                    <tr key={feed.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${feed.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {feed.isActive ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600 truncate max-w-[200px]" title={feed.spreadsheetId}>
                        {feed.spreadsheetId.substring(0, 15)}...{feed.spreadsheetId.slice(-5)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleFeed(feed.id, feed.isActive)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title={feed.isActive ? 'Pause Syncing' : 'Resume Syncing'}
                          >
                            {feed.isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleDeleteFeed(feed.id)}
                            className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                            title="Delete Feed Connection"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* REGISTRY FILTER SELECTION PANELS */}
        <FilterToolbar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          currentStatus={currentStatus}
          onStatusChange={setCurrentStatus}
          availableMaterialNames={availableMaterialNames}
          availableCities={availableCities}
          availableZones={availableZones}
          availableSourceTypes={availableSourceTypes}
          userRole={user.role}
        />

        {/* HIGH DENSITY DATA REGISTRY SUBMISSIONS TABLE */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
            <Layers className="h-3 w-3" />
            <span>Active View File Ledger ({filteredPrices.length} filtered records displayed)</span>
          </div>
          
          <SubmissionsTable
            prices={filteredPrices}
            onSelectRecord={(rec) => setSelectedRecord(rec)}
            selectedRecordId={selectedRecord?.id}
            onQuickApprove={handleQuickApprove}
            onQuickFlag={handleQuickFlag}
            onQuickRevert={handleQuickRevert}
            onQuickDelete={handleDeleteRecord}
            actionPendingIds={actionPendingIds}
            userRole={user.role}
            isLoading={isLoading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        </div>
        </>
        )}
      </main>

      {/* CORE FILE AUDITING DETAILED MODAL */}
      <ModerationModal
        record={selectedRecord}
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onSubmit={handleStatusSubmit}
        onDelete={handleDeleteRecord}
        allHistoricalPrices={records}
        moderatorId={moderatorId}
        userRole={user.role}
      />

      {/* MANUAL PRICE DATA ENTRY FORM POPUP MODAL */}
      <ManualEntryForm
        isOpen={isEntryFormOpen}
        onClose={() => setIsEntryFormOpen(false)}
        onSuccess={handleSubmissionSuccess}
        availableMaterials={selectMaterialOptions}
        availableLocations={selectLocationOptions}
      />
    </div>
  );
};