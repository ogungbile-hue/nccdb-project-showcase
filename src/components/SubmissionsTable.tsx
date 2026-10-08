import React from 'react';
import { PriceRecord } from '../types';
import { ArrowUpDown, ArrowUp, ArrowDown, Construction, UserCheck, ShieldAlert, RotateCcw, Trash2 } from 'lucide-react';

export type SortField = 'materialName' | 'price' | 'timestamp' | 'location';
export type SortOrder = 'asc' | 'desc';

interface SubmissionsTableProps {
  prices: PriceRecord[];
  onSelectRecord: (record: PriceRecord) => void;
  selectedRecordId?: string;
  onQuickApprove?: (id: string) => void;
  onQuickFlag?: (id: string) => void;
  onQuickRevert?: (id: string) => void;
  onQuickDelete?: (id: string) => void;
  // P1 Guard: set of record IDs currently locked due to in-flight PATCH requests
  actionPendingIds?: Set<string>;
  // Fix 3: role of the authenticated user — Actions column only visible to SUPER_ADMIN
  userRole?: string;
  isLoading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

// --- Price Source Type Label & Style Helper ---
// Maps canonical PriceSourceType enum strings to a human-readable display
// label and a set of Tailwind border/background/text colour classes.
const getPriceSourceLabel = (
  sourceType: string
): { label: string; styles: string } => {
  switch (sourceType) {
    case 'QS_REPORT':
      return {
        label: 'Professional QS Report',
        styles: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      };
    case 'MANUAL_ENTRY':
      return {
        label: 'Verified Field Survey',
        styles: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    case 'TENDER_RETURN':
      return {
        label: 'Contractor Tender Return',
        styles: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'MARKET_BULLETIN':
      return {
        label: 'Verified Supplier Feed',
        styles: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    default:
      return {
        label: sourceType,
        styles: 'bg-slate-100 text-slate-600 border-slate-200',
      };
  }
};

// --- Geopolitical Zone Badge Helper ---
// Maps Nigeria's six geopolitical zone strings to a desaturated Tailwind
// colour palette. Each zone gets a unique hue for maximum regional contrast.
const getZoneBadge = (
  zone: string
): { label: string; styles: string } => {
  // Converts SNAKE_CASE to Title Case for the display label
  const label = zone
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  switch (zone) {
    case 'SOUTH_WEST':
      return { label, styles: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'SOUTH_EAST':
      return { label, styles: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'SOUTH_SOUTH':
      return { label, styles: 'bg-teal-50 text-teal-700 border-teal-200' };
    case 'NORTH_WEST':
      return { label, styles: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'NORTH_CENTRAL':
      return { label, styles: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'NORTH_EAST':
      return { label, styles: 'bg-rose-50 text-rose-700 border-rose-200' };
    default:
      return { label, styles: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
};

export const SubmissionsTable: React.FC<SubmissionsTableProps> = ({
  prices,
  onSelectRecord,
  selectedRecordId,
  onQuickApprove,
  onQuickFlag,
  onQuickRevert,
  onQuickDelete,
  actionPendingIds,
  userRole,
  isLoading,
  sortField,
  sortOrder,
  onSort,
}) => {
  // Fix 3: derive once — controls Actions column visibility throughout.
  // Must be SUPER_ADMIN and explicitly viewing the /admin route.
  const isSuperAdmin = userRole === 'SUPER_ADMIN' && window.location.pathname === '/admin';
  // Total column count: 6 base + 1 Status + 1 Evaluation + 1 Actions (if admin)
  const colSpanCount = isSuperAdmin ? 9 : 8;
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400 ml-1.5" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-slate-900 ml-1.5" />
    ) : (
      <ArrowDown className="h-3 w-3 text-slate-900 ml-1.5" />
    );
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-xs">
      <div className="overflow-x-auto min-h-[250px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              <th className="py-2 px-3 w-[260px]">
                <button
                  type="button"
                  onClick={() => onSort('materialName')}
                  className="flex items-center hover:text-slate-900 font-bold cursor-pointer border-0 p-0 bg-transparent text-left focus:outline-none"
                >
                  Material Specification
                  {getSortIcon('materialName')}
                </button>
              </th>
              <th className="py-2 px-3 w-[140px]">
                <button
                  type="button"
                  onClick={() => onSort('location')}
                  className="flex items-center hover:text-slate-900 font-bold cursor-pointer border-0 p-0 bg-transparent text-left focus:outline-none"
                >
                  Location / Zone
                  {getSortIcon('location')}
                </button>
              </th>
              <th className="py-2 px-3 w-[150px] text-right">
                <button
                  type="button"
                  onClick={() => onSort('price')}
                  className="flex items-center justify-end hover:text-slate-900 font-bold cursor-pointer border-0 p-0 bg-transparent text-right w-full focus:outline-none"
                >
                  {/* ✅ FIXED: Realigned the table header indicator currency bracket */}
                  Rate (₦ / NGN)
                  {getSortIcon('price')}
                </button>
              </th>
              <th className="py-2 px-3 w-[120px]">Contributor ID</th>
              <th className="py-2 px-3 w-[150px]">
                <button
                  type="button"
                  onClick={() => onSort('timestamp')}
                  className="flex items-center hover:text-slate-900 font-bold cursor-pointer border-0 p-0 bg-transparent text-left focus:outline-none"
                >
                  Submitted At
                  {getSortIcon('timestamp')}
                </button>
              </th>
              <th className="py-2 px-3 text-center w-[100px]">Status</th>
              <th className="py-2 px-3 text-center w-[180px]">Evaluation</th>
              {/* Fix 3: Actions column visible to SUPER_ADMIN only */}
              {isSuperAdmin && (
                <th className="py-2 px-3 text-center w-[90px] sticky right-0 bg-white z-10 border-l border-slate-200">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700 font-sans">
            {isLoading ? (
              <tr>
                <td colSpan={colSpanCount} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-b-slate-800"></div>
                    <span className="text-slate-400 font-semibold">Streaming Live Audit Data...</span>
                  </div>
                </td>
              </tr>
            ) : prices.length === 0 ? (
              <tr>
                <td colSpan={colSpanCount} className="text-center py-12 px-3">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <div className="bg-slate-50 p-2.5 rounded-full mb-2 text-slate-400">
                      <Construction className="h-5 w-5" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-700 mb-0.5">Queue Clean: No Pending Submissions</h3>
                    <p className="text-[10px] text-slate-400 text-center">
                      All structural entries are audited. Master ledger is fully verified.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              prices.map((record) => {
                const isSelected = selectedRecordId === record.id;
                // Safely convert Prisma Decimal objects or string fallbacks to numeric types
                const numericPrice = typeof record.price === 'number' ? record.price : parseFloat(record.price as any) || 0;
                const sourceLabel = getPriceSourceLabel(record.sourceType);

                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/40 font-medium' : ''}`}
                  >
                    <td className="py-2 px-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 truncate max-w-[240px]">{record.material.name}</span>
                        <span className="text-slate-400 text-[10px] truncate max-w-[240px]">{record.material.specification}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            Unit: {record.material.unitOfMeasurement || 'N/A'}
                          </span>
                          {/* Styled source type badge using the getPriceSourceLabel colour mapping */}
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${sourceLabel.styles}`}
                          >
                            Source: {sourceLabel.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-2 px-3 text-slate-900 font-medium">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{record.location.zone}</span>
                        {/* Geopolitical zone pill badge */}
                        {(() => {
                          const zone = getZoneBadge(record.location.city);
                          return (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${zone.styles}`}
                            >
                              {zone.label}
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    {/* ✅ FIXED: Applied the ₦ currency symbol wrapper with precise digit formatting */}
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {record.price === null ? (
                        <div className="flex flex-col items-end">
                          <span className="text-red-500 font-sans text-[10px] bg-red-50 px-2 py-0.5 rounded border border-red-100">CORRUPTED</span>
                          {record.rawPriceInput && <span className="text-[9px] text-slate-400 mt-0.5 max-w-[80px] truncate" title={record.rawPriceInput}>"{record.rawPriceInput}"</span>}
                        </div>
                      ) : (
                        <>
                          ₦{numericPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-[9px] text-slate-400 font-normal ml-1">NGN</span>
                        </>
                      )}
                    </td>

                    {/* Contributor ID */}
                    <td className="py-2 px-3 truncate max-w-[150px]">
                      {(() => {
                        const contributorId = record.submittedById;
                        if (contributorId && contributorId.includes(' - ')) {
                          const [phone, name, ...emailParts] = contributorId.split(' - ');
                          const email = emailParts.join(' - '); // in case email has a hyphen
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[11px] font-mono text-slate-700 truncate">{phone}</span>
                              <span className="text-[10px] font-sans text-slate-500 font-medium truncate">{name}</span>
                              {email && <span className="text-[9px] font-sans text-slate-400 truncate">{email}</span>}
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-mono text-slate-400 truncate">{contributorId || 'SYSTEM_GEN'}</span>
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-2 px-3 text-slate-500 font-mono text-right">{formatDate(record.timestamp)}</td>

                    {/* STATUS BADGE */}
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        record.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        record.status === 'FLAGGED' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {record.status}
                      </span>
                    </td>

                    {/* Evaluation cell — Audit File detail opener */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectRecord(record)}
                        className="px-2 py-0.5 font-bold text-[10px] text-white bg-slate-800 hover:bg-slate-900 rounded cursor-pointer uppercase tracking-wide transition-colors"
                      >
                        {isSuperAdmin ? 'Audit File' : 'View Details'}
                      </button>
                    </td>

                    {/* Fix 3: Sticky Actions cell — SUPER_ADMIN only */}
                    {isSuperAdmin && (
                      <td
                        className={`py-2 px-3 text-center sticky right-0 z-10 border-l border-slate-200 transition-colors ${
                          isSelected ? 'bg-blue-50/40' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {onQuickApprove && record.status === 'PENDING' && (() => {
                            const isPending = actionPendingIds?.has(record.id) ?? false;
                            return (
                              <button
                                type="button"
                                onClick={() => onQuickApprove(record.id)}
                                disabled={isPending}
                                className={`p-1 text-emerald-600 rounded transition-colors border border-transparent ${
                                  isPending
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer'
                                }`}
                                title={isPending ? 'Processing...' : 'Quick Approve'}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </button>
                            );
                          })()}

                          {onQuickFlag && record.status === 'PENDING' && (() => {
                            const isPending = actionPendingIds?.has(record.id) ?? false;
                            return (
                              <button
                                type="button"
                                onClick={() => onQuickFlag(record.id)}
                                disabled={isPending}
                                className={`p-1 text-rose-600 rounded transition-colors border border-transparent ${
                                  isPending
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:bg-rose-50 hover:border-rose-200 cursor-pointer'
                                }`}
                                title={isPending ? 'Processing...' : 'Quick Flag'}
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                              </button>
                            );
                          })()}

                          {onQuickRevert && (record.status === 'APPROVED' || record.status === 'FLAGGED') && (() => {
                            const isPending = actionPendingIds?.has(record.id) ?? false;
                            return (
                              <button
                                type="button"
                                onClick={() => onQuickRevert(record.id)}
                                disabled={isPending}
                                className={`p-1 text-amber-600 rounded transition-colors border border-transparent ${
                                  isPending
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:bg-amber-50 hover:border-amber-200 cursor-pointer'
                                }`}
                                title={isPending ? 'Processing...' : 'Revert to Pending'}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            );
                          })()}

                          {onQuickDelete && (() => {
                            const isPending = actionPendingIds?.has(record.id) ?? false;
                            return (
                              <button
                                type="button"
                                onClick={() => onQuickDelete(record.id)}
                                disabled={isPending}
                                className={`p-1 text-red-600 rounded transition-colors border border-transparent ${
                                  isPending
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:bg-red-50 hover:border-red-200 cursor-pointer'
                                }`}
                                title={isPending ? 'Processing...' : 'Delete Submission Permanently'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};