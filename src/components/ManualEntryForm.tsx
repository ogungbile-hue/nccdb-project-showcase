import React, { useState, useEffect, useMemo } from 'react';
import { X, PlusCircle, Trash2 } from 'lucide-react';
import { ApiService } from '../apiService';
import { CreatePriceSubmission } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single row in the bulk entry grid. */
interface BulkEntryRow {
  materialId: string;
  price: string;
  notes: string;
}

interface ManualEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newRecord: any) => void;
  availableMaterials: Array<{ id: string; name: string; unit: string }>;
  availableLocations: Array<{ id: string; city: string; zone: string }>;
}

// ---------------------------------------------------------------------------
// localStorage sticky-field keys
// ---------------------------------------------------------------------------
const STICKY_LOCATION_KEY = 'nccdb_sticky_location';
const STICKY_SOURCE_KEY   = 'nccdb_sticky_source';

// P2: Maximum realistic unit price ceiling for Nigerian construction materials.
// ₦25,000,000 covers heavy items (reinforced steel, structural concrete) without
// allowing clearly erroneous entries. Mirrored identically in prices.ts.
const MAX_UNIT_PRICE_NGN = 25_000_000;


type StickySourceType = 'QS_REPORT' | 'MANUAL_ENTRY' | 'TENDER_RETURN' | 'MARKET_BULLETIN';

const DEFAULT_ROW: BulkEntryRow = { materialId: '', price: '', notes: '' };

export const ManualEntryForm: React.FC<ManualEntryFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  availableMaterials,
  availableLocations,
}) => {
  // -- Sticky batch-level fields (persist across entries) --
  const [locationId, setLocationId] = useState<string>(
    () => localStorage.getItem(STICKY_LOCATION_KEY) || ''
  );
  const [sourceType, setSourceType] = useState<StickySourceType>(
    () => (localStorage.getItem(STICKY_SOURCE_KEY) as StickySourceType) || 'QS_REPORT'
  );

  // -- Bulk row array --
  const [rows, setRows] = useState<BulkEntryRow[]>([{ ...DEFAULT_ROW }]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError]               = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);


  // -- Initialise sticky defaults from available lists on open --
  useEffect(() => {
    if (isOpen) {
      setRows([{
        materialId: '',
        price: '',
        notes: '',
      }]);
      setError(null);
      setSuccessCount(null);

      // Seed locationId from cache, or fall back to first available
      const cachedLoc = localStorage.getItem(STICKY_LOCATION_KEY);
      setLocationId(cachedLoc || availableLocations[0]?.id || '');

      const cachedSrc = localStorage.getItem(STICKY_SOURCE_KEY) as StickySourceType | null;
      setSourceType(cachedSrc || 'QS_REPORT');
    }
  }, [isOpen, availableMaterials, availableLocations]);

  if (!isOpen) return null;

  // -- Sticky field change handlers (write-through to localStorage) --
  const handleLocationChange = (value: string) => {
    setLocationId(value);
    localStorage.setItem(STICKY_LOCATION_KEY, value);
  };

  const handleSourceChange = (value: StickySourceType) => {
    setSourceType(value);
    localStorage.setItem(STICKY_SOURCE_KEY, value);
  };

  // -- Row mutation helpers --
  const updateRow = (index: number, field: keyof BulkEntryRow, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { materialId: '', price: '', notes: '' },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // -- Bulk submission --
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessCount(null);

    if (!locationId) {
      setError('Please select a target survey location.');
      return;
    }

    // Duplicate material check: collect all non-empty materialIds that appear more than once
    const seenIds = new Set<string>();
    const hasDuplicates = rows.some((row) => {
      if (!row.materialId) return false;
      if (seenIds.has(row.materialId)) return true;
      seenIds.add(row.materialId);
      return false;
    });

    if (hasDuplicates) {
      setError('Duplicate material detected. Please ensure each row selects a unique material before submitting.');
      return;
    }

    // P2: Collect only rows with a valid positive price
    const validRows = rows.filter((row) => {
      const parsed = Number(row.price);
      return row.materialId && !isNaN(parsed) && parsed > 0;
    });

    if (validRows.length === 0) {
      setError('At least one row must have a valid material selected and a price greater than zero.');
      return;
    }

    // P2 Ceiling guard: block unrealistic unit prices above ₦25,000,000
    const ceilingViolation = validRows.find((row) => Number(row.price) > MAX_UNIT_PRICE_NGN);
    if (ceilingViolation) {
      const formatted = Number(ceilingViolation.price).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
      setError(`Price ceiling exceeded: ${formatted} is above the ₦25,000,000 maximum allowed per unit. Please verify the entry.`);
      return;
    }

    setIsSubmitting(true);

    const savedUserStr = localStorage.getItem('nccdb_user');
    const savedUser    = savedUserStr ? JSON.parse(savedUserStr) : null;
    void savedUser; // resolved server-side from JWT; kept for future client logging

    try {
      const selectedLoc = availableLocations.find(l => l.id === locationId);
      const adminPhone = savedUser?.phoneNumber || 'NoPhone';
      const adminName = savedUser?.name || savedUser?.fullName || 'Admin';
      const adminEmail = savedUser?.email || 'admin@nccdb.com';
      const compositeContributorId = `${adminPhone} - ${adminName} - ${adminEmail}`;

      const payloads = validRows.map((row) => ({
        materialId: row.materialId,
        locationId: locationId as string,
        materialName: availableMaterials.find(m => m.id === row.materialId)?.name || 'Unknown Material',
        city: selectedLoc?.city || 'Unknown',
        zone: selectedLoc?.zone || 'Unknown',
        price: Number(row.price),
        currency: 'NGN',
        sourceType: sourceType as any,
        notes: row.notes.trim(),
        contributorId: compositeContributorId,
        status: 'PENDING'
      } as unknown as CreatePriceSubmission));

      const results = await ApiService.createSubmission(payloads);

      // Backend now returns an array for array payloads
      const resultsArray = Array.isArray(results) ? results : [results];
      
      setSuccessCount(resultsArray.length);
      resultsArray.forEach((record) => onSuccess(record));

      // Reset row grid after successful batch, keep sticky fields
      setRows([{ materialId: '', price: '', notes: '' }]);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Generic 400';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-white rounded-lg border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-fade-in">

        {/* Header Block */}
        <div className="bg-[#0f172a] text-white px-4 py-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider">
            Bulk Price Entry — Batch Submission
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">

          {/* ── Sticky Batch-Level Fields ── */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 grid grid-cols-2 gap-4 text-[11px]">
            {/* Location (sticky) */}
            <div className="space-y-1">
              <label className="block font-bold uppercase text-slate-600 tracking-wide">
                Target Survey Location Base *
              </label>
              <select
                id="sticky-locationId"
                value={locationId}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:border-blue-500 focus:outline-none text-slate-800 font-medium cursor-pointer"
                required
              >
                <option value="">— Select Location —</option>
                {availableLocations.map((loc) => {
                  const readableZone = loc.zone.replace(/_/g, ' ').toLowerCase();
                  return (
                    <option key={loc.id} value={loc.id}>
                      {loc.city} — ({readableZone})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Source Type (sticky) */}
            <div className="space-y-1">
              <label className="block font-bold uppercase text-slate-600 tracking-wide">
                Survey Source Verification Type
              </label>
              <select
                id="sticky-sourceType"
                value={sourceType}
                onChange={(e) => handleSourceChange(e.target.value as StickySourceType)}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:border-blue-500 focus:outline-none text-slate-800 font-medium cursor-pointer"
              >
                <option value="QS_REPORT">Professional QS Report (BOQ / Audits)</option>
                <option value="MANUAL_ENTRY">Verified Field Survey (Market Check)</option>
                <option value="TENDER_RETURN">Contractor Tender Return (Bids)</option>
                <option value="MARKET_BULLETIN">Verified Supplier Feed</option>
              </select>
            </div>
          </div>

          {/* ── Multi-Row Entry Table ── */}
          <div className="overflow-auto flex-1 p-4">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                  <th className="py-1.5 px-2 text-left w-6">#</th>
                  <th className="py-1.5 px-2 text-left">Material Selection *</th>
                  <th className="py-1.5 px-2 text-right w-[160px]">Price (NGN) *</th>
                  <th className="py-1.5 px-2 text-left">Notes / Remarks</th>
                  <th className="py-1.5 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  // Build a Set of materialIds that appear more than once across all non-empty rows
                  const allIds = rows
                    .map((r) => r.materialId)
                    .filter((id) => id !== '');
                  const duplicateIds = new Set(
                    allIds.filter((id, i, arr) => arr.indexOf(id) !== i)
                  );
                  const isDuplicate = row.materialId !== '' && duplicateIds.has(row.materialId);

                  return (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    {/* Row index */}
                    <td className="py-1.5 px-2 text-slate-400 font-mono font-bold">{idx + 1}</td>

                    {/* Material dropdown — red border + warning text when a duplicate materialId is detected */}
                    <td className="py-1.5 px-2">
                      <select
                        id={`row-materialId-${idx}`}
                        value={row.materialId}
                        onChange={(e) => updateRow(idx, 'materialId', e.target.value)}
                        className={`w-full bg-white border rounded px-2 py-1 focus:outline-none text-slate-800 font-medium ${
                          isDuplicate
                            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                            : 'border-slate-200 focus:border-blue-500'
                        }`}
                        required
                      >
                        <option value="">— Select Material —</option>
                        {availableMaterials.map((mat) => (
                          <option key={mat.id} value={mat.id}>
                            {mat.name} {mat.unit ? `(${mat.unit})` : ''}
                          </option>
                        ))}
                      </select>
                      {isDuplicate && (
                        <p className="text-xs text-red-500 mt-1">Duplicate material selected</p>
                      )}
                    </td>

                    {/* Price input */}
                    <td className="py-1.5 px-2">
                      <input
                        id={`row-price-${idx}`}
                        type="number"
                        value={row.price}
                        onChange={(e) => updateRow(idx, 'price', e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0.01"
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:border-blue-500 focus:outline-none text-slate-800 font-medium text-right"
                        required
                      />
                    </td>

                    {/* Notes input */}
                    <td className="py-1.5 px-2">
                      <input
                        id={`row-notes-${idx}`}
                        type="text"
                        value={row.notes}
                        onChange={(e) => updateRow(idx, 'notes', e.target.value)}
                        placeholder="Optional audit remarks..."
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:border-blue-500 focus:outline-none text-slate-800 font-medium"
                      />
                    </td>

                    {/* Remove row */}
                    <td className="py-1.5 px-2 text-center">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-rose-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Add Row Control */}
            <button
              type="button"
              onClick={addRow}
              className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer uppercase tracking-wide"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Add Material Row
            </button>
          </div>

          {/* ── Error / Success Banners ── */}
          <div className="px-4 space-y-2">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-900 font-medium flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successCount !== null && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-emerald-900 font-medium flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{successCount} record{successCount !== 1 ? 's' : ''} submitted successfully.</span>
              </div>
            )}
          </div>

          {/* ── Control Footer ── */}
          <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-medium">
              {rows.length} row{rows.length !== 1 ? 's' : ''} — only rows with a price &gt; 0 will be submitted
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 font-bold uppercase tracking-wide rounded hover:bg-slate-50 transition-colors cursor-pointer text-[11px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wide rounded shadow-sm transition-colors text-[11px] ${
                  isSubmitting
                    ? 'opacity-70 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                {isSubmitting && (
                  <svg
                    className="animate-spin h-3 w-3 text-white shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {isSubmitting
                  ? 'Submitting Batch...'
                  : `Submit ${rows.filter(r => Number(r.price) > 0).length || ''} Entr${rows.filter(r => Number(r.price) > 0).length === 1 ? 'y' : 'ies'}`
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};