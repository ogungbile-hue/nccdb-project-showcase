import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, Database, CheckCircle2, FileSpreadsheet, AlertCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { ApiService } from '../../apiService';

export const OnboardSupplier: React.FC = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    preCopiedSheetId: '',
    phone: '',
    email: '',
    city: '',
    zone: 'North Central',
    rawText: ''
  });
  
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSyncingMaster, setIsSyncingMaster] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const rawLines = formData.rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (rawLines.length === 0) {
      setParsedItems([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSimulating(true);
      try {
        const results = await ApiService.simulateMapping(rawLines);
        setParsedItems(results);
      } catch (err) {
        console.error('Simulation error:', err);
      } finally {
        setIsSimulating(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.rawText, refreshTrigger]);

  const handleSyncMaster = async () => {
    setIsSyncingMaster(true);
    try {
      await ApiService.syncMasterRegistry();
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Failed to sync registry' });
    } finally {
      setIsSyncingMaster(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProvisioning(true);
    setStatus(null);
    try {
      const payload = {
        companyName: formData.companyName,
        preCopiedSheetId: formData.preCopiedSheetId,
        phone: formData.phone,
        email: formData.email,
        city: formData.city,
        zone: formData.zone,
        rawCatalog: parsedItems
      };
      
      const res = await ApiService.provisionSupplier(payload);
      await ApiService.syncMasterSheet(formData.preCopiedSheetId);
      setStatus({ type: 'success', message: `Sheet Provisioned & Synced: ${res.spreadsheetId || formData.preCopiedSheetId}` });
      setFormData({ companyName: '', preCopiedSheetId: '', phone: '', email: '', city: '', zone: 'North Central', rawText: '' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to provision sheet' });
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <Database className="w-8 h-8 text-indigo-600" />
          Automated Provisioning Engine
        </h1>
        <p className="text-slate-500 mt-2">
          Securely link pre-copied Google Sheets for new suppliers and automatically register their ID in our database tracker.
        </p>
      </div>

      <div className="p-4 mb-6 rounded-xl border bg-blue-50 border-blue-200 text-blue-900 shadow-sm">
        <h3 className="font-bold mb-1 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-600" /> Mandatory Security Step</h3>
        <p className="text-sm">Before linking, you MUST open your duplicated template in Google Sheets, click "Share", and explicitly grant <strong>Editor</strong> permissions to our Service Account: <br/><code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800 font-mono select-all">nccdb-sheet-sync@nccdb-platform.iam.gserviceaccount.com</code></p>
      </div>

      {status && (
        <div className={`p-4 mb-8 rounded-xl border flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {status.type === 'success' ? <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0" /> : <div className="w-6 h-6 text-red-600 flex-shrink-0">⚠</div>}
          <div className="font-medium">{status.message}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-800 text-lg">Supplier Profile</h2>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Pre-Copied Spreadsheet ID</label>
            <input
              required
              type="text"
              placeholder="e.g. 16vUDxt-D5qeft3u17JQvMCIS2mDyGTPUOdx8LqdvKgc"
              className="w-full px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
              value={formData.preCopiedSheetId}
              onChange={(e) => setFormData({...formData, preCopiedSheetId: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Company Name</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={formData.companyName}
              onChange={(e) => setFormData({...formData, companyName: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Email</label>
            <input
              required
              type="email"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">City</label>
              <input
                required
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Zone</label>
              <select
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={formData.zone}
                onChange={(e) => setFormData({...formData, zone: e.target.value})}
              >
                <option>North Central</option>
                <option>North East</option>
                <option>North West</option>
                <option>South East</option>
                <option>South South</option>
                <option>South West</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-800 text-lg flex items-center justify-between">
            Raw Material Catalog Dump
            <span className="text-xs font-medium px-2 py-1 bg-slate-200 text-slate-600 rounded">Format: One Material Name per line</span>
          </h2>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <textarea
              className="w-full h-64 px-4 py-3 bg-slate-900 text-slate-300 font-mono text-sm border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Paste raw list here...&#10;Portland Cement&#10;50mm PPR Pipe&#10;10mm diameter x 12m (tie beams)"
              value={formData.rawText}
              onChange={(e) => setFormData({...formData, rawText: e.target.value})}
            />
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-y-auto h-64">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              AI Material Mapping Simulation
              {isSimulating && <Loader2 className="w-3 h-3 animate-spin text-indigo-500 ml-auto" />}
              {!isSimulating && (
                <button
                  type="button"
                  onClick={handleSyncMaster}
                  disabled={isSyncingMaster}
                  className="ml-auto flex items-center gap-1 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  title="Pull latest materials from Google Sheets to ensure AI maps correctly"
                >
                  {isSyncingMaster ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {isSyncingMaster ? 'Syncing...' : 'Sync Master'}
                </button>
              )}
            </h3>
            {parsedItems.length === 0 ? (
              <div className="text-slate-400 text-sm text-center mt-10">
                {isSimulating ? 'Analyzing catalog...' : 'Awaiting raw input...'}
              </div>
            ) : (
              <div className="space-y-3">
                {parsedItems.map((item, idx) => {
                  let indicatorClass = "text-slate-400";
                  let Icon = HelpCircle;
                  if (item.confidence === 100) {
                    indicatorClass = "text-green-500";
                    Icon = CheckCircle2;
                  } else if (item.confidence > 85) {
                    indicatorClass = "text-yellow-500";
                    Icon = AlertCircle;
                  } else if (item.confidence > 0) {
                    indicatorClass = "text-red-500";
                    Icon = AlertCircle;
                  }

                  return (
                    <div key={idx} className="flex flex-col text-sm bg-white p-3 rounded border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-slate-800 line-clamp-1" title={item.rawString}>
                          {item.rawString}
                        </div>
                        <Icon className={`w-5 h-5 ${indicatorClass}`} />
                      </div>
                      {item.matchedCode ? (
                        <div className="text-xs text-slate-500 flex justify-between items-center">
                          <span>↳ {item.matchedName} ({item.matchedCode})</span>
                          <span className="font-mono bg-slate-100 px-1 rounded">{item.confidence}% {item.method}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-red-500">↳ Unmapped (0%)</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="submit"
            disabled={isProvisioning || !formData.companyName || !formData.email || !formData.preCopiedSheetId}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors focus:ring-4 focus:ring-indigo-500/30 disabled:opacity-50"
          >
            {isProvisioning ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Provisioning Secure Sheet...</>
            ) : (
              <><FileSpreadsheet className="w-5 h-5" /> Link Existing Sheet</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
