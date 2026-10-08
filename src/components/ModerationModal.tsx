import React, { useState, useEffect } from 'react';
import { PriceRecord, ModerationStatus, ModerationPayload } from '../types';
import { X, CheckCircle2, AlertTriangle, RefreshCcw, Landmark, User, ShieldCheck, HelpCircle, FileText, Info, Trash2 } from 'lucide-react';

interface ModerationModalProps {
  record: PriceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, payload: ModerationPayload) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  allHistoricalPrices: PriceRecord[];
  moderatorId: string;
  userRole: string;
}

export const ModerationModal: React.FC<ModerationModalProps> = ({
  record,
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  allHistoricalPrices,
  moderatorId,
  userRole,
}) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSuperAdmin = userRole === 'SUPER_ADMIN' && window.location.pathname === '/admin';

  // Sync state when record opens
  useEffect(() => {
    if (record) {
      setNotes(record.notes || '');
      setErrorMsg(null);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  // Type-safely cast potential Prisma Decimal objects or strings to numbers
  const currentPriceNumeric = typeof record.price === 'number' ? record.price : parseFloat(record.price as any) || 0;

  // Calculate pricing norms & standard deviations
  const sameMaterialApproved = allHistoricalPrices.filter(
    (p) => p.material.id === record.material.id && p.status === 'APPROVED' && p.id !== record.id
  );

  const avgPrice = sameMaterialApproved.length > 0
    ? sameMaterialApproved.slice(0, 3).reduce((sum, item) => {
        const histPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price as any) || 0;
        return sum + histPrice;
      }, 0) / Math.min(sameMaterialApproved.length, 3)
    : 0;

  const priceDiffPct = avgPrice > 0 
    ? Math.abs(((currentPriceNumeric - avgPrice) / avgPrice) * 100)
    : 0;
    
  const isHigher = avgPrice > 0 && currentPriceNumeric > avgPrice;
  const isLower = avgPrice > 0 && currentPriceNumeric < avgPrice;

  // Dynamic color coding based on Variance Delta %
  let varianceColorClass = 'text-emerald-600'; // Default <= 10%
  let varianceBgClass = 'bg-emerald-50 border-emerald-200';
  if (priceDiffPct > 20) {
    varianceColorClass = 'text-red-600 animate-pulse font-extrabold';
    varianceBgClass = 'bg-red-50 border-red-200';
  } else if (priceDiffPct > 10) {
    varianceColorClass = 'text-amber-600 font-bold';
    varianceBgClass = 'bg-amber-50 border-amber-200';
  }

  // Statistical warnings
  const warnings: string[] = [];
  if (sameMaterialApproved.length >= 2) {
    if (priceDiffPct > 20) {
      warnings.push(
        `Critical: Price deviates by ${priceDiffPct.toFixed(1)}% from the historical baseline. This exceeds the safe variance threshold and will be flagged automatically if approved.`
      );
    } else if (priceDiffPct > 10) {
      warnings.push(
        `Caution: Price deviates by ${priceDiffPct.toFixed(1)}%. Administrator notes are required to approve this entry.`
      );
    }
  } else {
    warnings.push(`Caution: Thin audit trail. Only ${sameMaterialApproved.length} validated historical entries exist for this specific Material Group.`);
  }

  const handleAction = async (status: ModerationStatus) => {
    if (!moderatorId.trim()) {
      setErrorMsg('Required: Please input your Moderator Credentials (ID) to sign this ledger.');
      return;
    }
    
    // UI Validation mirroring server limits
    if (status === 'APPROVED' && priceDiffPct > 10 && priceDiffPct <= 20) {
      if (!notes.trim()) {
        setErrorMsg('Validation failed: Variance > 10%. Administrator notes are mandatory to justify this approval.');
        return;
      }
    }
    
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onSubmit(record.id, {
        status,
        notes: notes.trim(),
        moderatedById: moderatorId.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Failed to submit status update to remote REST service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAction = async () => {
    if (!onDelete) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onDelete(record.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Failed to delete record.');
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      id="nccdb-moderation-modal-overlay" 
      className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
    >
      <div 
        id="moderation-modal-container"
        className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-5xl w-full overflow-hidden text-slate-800 flex flex-col"
      >
        {/* HEADER */}
        <div className="bg-[#0f172a] text-white p-3 px-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-blue-400" />
            <h2 className="text-sm font-bold tracking-wide uppercase font-mono">Cost Ledger File Audit</h2>
            <span className="bg-blue-500/20 text-blue-300 font-bold text-[10px] uppercase px-1.5 py-0.5 border border-blue-500/30 rounded ml-2 font-mono">
              ID: {record.id.substring(0, 8)}
            </span>
          </div>
          <button 
            id="close-modal-x-btn"
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded transition-colors cursor-pointer focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* COMPLIANCE ERROR BLOCK */}
        {errorMsg && (
          <div className="bg-red-50 text-red-800 text-xs font-bold p-3 border-b border-red-200 flex gap-2 items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MODAL MAIN CONTENT BODY - SPLIT PANE */}
        <div className="flex flex-col md:flex-row bg-slate-50 font-sans max-h-[70vh] overflow-y-auto">
          
          {/* LEFT PANE: SUBMISSION DETAILS */}
          <div className="w-full md:w-1/2 p-5 border-b md:border-b-0 md:border-r border-slate-200 space-y-5 bg-white">
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <FileText className="h-3 w-3" /> Incoming Submission Details
              </h3>
              
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Material Specification</span>
                  <h4 className="text-sm font-bold text-slate-900">{record.material.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{record.material.specification}</p>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    <span className="bg-white text-slate-600 text-[10px] font-bold border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                      Unit: {record.material.unitOfMeasurement}
                    </span>
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 px-1.5 py-0.5 rounded shadow-sm uppercase">
                      Source: {record.sourceType === 'MARKET_BULLETIN' ? 'Verified Supplier Feed' : record.sourceType}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Proposed Price</span>
                    <span className="font-mono text-xl font-extrabold text-slate-900 block">
                      {record.price === null ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-red-500 text-lg font-sans">Corrupted Price</span>
                          {record.rawPriceInput && (
                            <span className="text-[10px] text-slate-500 font-mono font-normal">Raw: "{record.rawPriceInput}"</span>
                          )}
                        </div>
                      ) : (
                        `₦${currentPriceNumeric.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Submitted {new Date(record.timestamp).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Location Context</span>
                    <div className="text-xs font-bold text-slate-800">{record.location.city}</div>
                    <div className="text-[10px] text-slate-500">{record.location.zone} Zone</div>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1 mb-2">
                      <User className="h-3 w-3" /> Submitter Profile
                    </span>
                    <div className="space-y-1 text-xs text-slate-700">
                      <p><span className="font-semibold text-slate-900">Name:</span> {record.submittedBy?.name || 'Field Contributor'}</p>
                      <p><span className="font-semibold text-slate-900">Email:</span> {record.submittedBy?.email || 'N/A'}</p>
                      <p><span className="font-semibold text-slate-900">Phone:</span> {record.submittedBy?.phoneNumber || (record.submittedById?.startsWith('0') ? record.submittedById : 'No phone registered')}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-200">ID: {record.submittedById || 'SYSTEM_GEN'}</p>
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Submitter Notes</span>
                  <div className="text-xs italic text-slate-600 bg-white p-2 rounded border border-slate-100 min-h-[40px]">
                    {record.notes ? `"${record.notes}"` : 'No comments provided.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* RIGHT PANE: HISTORICAL CONTEXT & VARIANCE */}
          <div className="w-full md:w-1/2 p-5 space-y-5">
            <div>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                <Landmark className="h-3 w-3" /> System Context & Variance Analysis
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Historical Baseline</span>
                  <span className="font-mono text-lg font-bold text-slate-700 block">
                    {avgPrice > 0 ? `₦${avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'N/A'}
                  </span>
                  <span className="text-[9px] text-slate-400">Avg of last 3 approvals</span>
                </div>
                
                <div className={`p-3 rounded border shadow-sm text-center ${varianceBgClass}`}>
                  <span className="text-[9px] font-bold uppercase tracking-tight block mb-1 text-slate-500">Variance Delta</span>
                  <span className={`font-mono text-xl block ${varianceColorClass}`}>
                    {avgPrice > 0 ? `${isHigher ? '+' : isLower ? '-' : ''}${priceDiffPct.toFixed(1)}%` : '0.0%'}
                  </span>
                  <span className="text-[9px] font-medium text-slate-500">Deviation from norm</span>
                </div>
              </div>

              {/* COMPLIANCE WARNINGS */}
              {isSuperAdmin && warnings.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-slate-400" /> Automated Guards
                  </span>
                  <div className="space-y-1.5">
                    {warnings.map((warn, i) => (
                      <div key={i} className="flex gap-2 items-start bg-white text-slate-700 text-xs p-2.5 rounded border border-slate-200 shadow-sm">
                        <AlertTriangle className={`h-4 w-4 shrink-0 ${priceDiffPct > 20 ? 'text-red-500' : 'text-amber-500'}`} />
                        <span className="leading-snug">{warn}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MODERATION COMPLIANCE FORM */}
              {isSuperAdmin && (
                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm space-y-2 mb-4">
                  <label htmlFor="moderation-audit-input-note" className="text-xs font-bold text-slate-800 block">
                    Auditor Decision Notes
                  </label>
                  <textarea
                    id="moderation-audit-input-note"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Declare reasoning for Approving, Flagging, or Rejecting..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  ></textarea>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER ACTION CONTROLS */}
        {isSuperAdmin && (
          <div className="bg-[#f8fafc] px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Auditor ID:</span>
              <span className="font-mono text-xs text-slate-800 font-bold bg-white border border-slate-300 px-2 py-1 rounded shadow-sm">
                {moderatorId || 'N/A'}
              </span>
            </div>

            <div className="flex gap-2">
              {onDelete && (
                <button
                  id="btn-modal-reject"
                  disabled={isSubmitting}
                  type="button"
                  onClick={handleDeleteAction}
                  className="px-4 py-1.5 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 rounded text-xs font-bold text-slate-600 hover:text-rose-600 transition-colors flex items-center gap-1.5 uppercase tracking-wide focus:outline-none"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Reject (Delete)
                </button>
              )}

              <button
                id="btn-modal-flag"
                disabled={isSubmitting}
                type="button"
                onClick={() => handleAction('FLAGGED')}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 rounded text-xs font-bold text-white transition-colors flex items-center gap-1.5 uppercase tracking-wide focus:outline-none shadow-sm"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Flag Spike
              </button>

              <button
                id="btn-modal-approve"
                disabled={isSubmitting}
                type="button"
                onClick={() => handleAction('APPROVED')}
                className="px-5 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 uppercase tracking-wide focus:outline-none shadow-sm"
              >
                {isSubmitting ? (
                  <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
                Approve Cost
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};