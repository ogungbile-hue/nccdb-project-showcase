import React, { useState } from 'react';
import { Search, Loader2, MapPin, Tag, TrendingUp } from 'lucide-react';
import { ApiService } from '../../apiService';
import { MaterialDetailsModal } from './MaterialDetailsModal';
import { EightyTwoBadge } from '../ui/EightyTwoBadge';

import { formatCurrency } from './formatCurrency';

export const PublicPortal: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<{ id: string; name: string } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await ApiService.searchPublicMaterials(query);
      setResults(data || []);
    } catch (err) {
      console.error('Failed to search public materials:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f1f5f9', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <header
        className="bg-[#0a0f1c] shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Brand stripe */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #ff6b35 0%, rgba(255,107,53,0.15) 55%, transparent 100%)' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo + name */}
          <div className="flex items-center gap-3">
            <div style={{ filter: 'drop-shadow(0 0 10px rgba(255,107,53,0.35))' }}>
              <EightyTwoBadge size={30} speed={0.7} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold text-white tracking-wide">NCCDB</span>
              <span className="text-[10px] text-slate-500 font-medium hidden sm:block">Public Price Portal</span>
            </div>
          </div>

          <div
            className="text-[10px] font-semibold tracking-widest uppercase hidden sm:block"
            style={{ color: '#ff6b35', background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)', padding: '3px 10px', borderRadius: 6 }}
          >
            Verified Price Intelligence
          </div>
        </div>
      </header>

      {/* ── Hero / Search ── */}
      <main className="flex-1 flex flex-col items-center">

        {/* Hero section — collapses when searching */}
        <div className={`w-full max-w-3xl px-4 sm:px-6 flex flex-col items-center transition-all duration-500 ${hasSearched ? 'pt-8' : 'pt-20 sm:pt-28'}`}>

          {!hasSearched && (
            <div className="text-center mb-8 animate-fade-slide-up">
              <div style={{ filter: 'drop-shadow(0 0 24px rgba(255,107,53,0.3))' }} className="flex justify-center mb-6">
                <EightyTwoBadge size={72} speed={0.6} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 tracking-tight">
                Search Approved Material Rates
              </h2>
              <p className="text-slate-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                Access verified pricing data for construction materials across Nigeria's geopolitical zones.
              </p>
            </div>
          )}

          {/* Search bar */}
          <form onSubmit={handleSearch} className="w-full relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              {isSearching
                ? <Loader2 className="w-5 h-5 text-[#ff6b35] animate-spin" />
                : <Search className="w-5 h-5 text-slate-400 group-focus-within:text-[#ff6b35] transition-colors" />
              }
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-28 sm:pr-36 py-4 sm:py-5 bg-white text-slate-900 placeholder-slate-400 text-sm sm:text-base rounded-2xl shadow-sm focus:outline-none transition-all"
              style={{
                border: '2px solid #e2e8f0',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#ff6b35'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(255,107,53,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.06)'; }}
              placeholder="e.g. Portland Cement, PPR pipe, Roofing Sheet…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="absolute inset-y-2 right-2 flex items-center px-4 sm:px-6 py-2 font-semibold text-sm text-white rounded-xl transition-all disabled:opacity-40"
              style={{ background: '#ff6b35' }}
              onMouseEnter={e => !isSearching && (e.currentTarget.style.background = '#e85c28')}
              onMouseLeave={e => !isSearching && (e.currentTarget.style.background = '#ff6b35')}
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="w-full max-w-7xl px-4 sm:px-6 pb-16 mt-10">

          {/* Empty state */}
          {hasSearched && !isSearching && results.length === 0 && (
            <div
              className="text-center py-16 rounded-2xl animate-fade-slide-up"
              style={{ background: 'white', border: '2px dashed #e2e8f0' }}
            >
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-semibold mb-1">No results for "{query}"</p>
              <p className="text-slate-400 text-sm">Try a broader term or a different material category.</p>
            </div>
          )}

          {/* Results grid */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 animate-fade-slide-up">
              {results.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedMaterial({ id: record.materialId, name: record.material.name })}
                  className="text-left bg-white rounded-2xl overflow-hidden flex flex-col group cursor-pointer w-full transition-all"
                  style={{
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {/* Card body */}
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-[#ff6b35] transition-colors flex-1">
                        {record.material.name}
                      </h3>
                      <span
                        className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}
                      >
                        Approved
                      </span>
                    </div>

                    {record.material.specification && (
                      <p className="text-xs text-slate-400 mb-3 line-clamp-1">{record.material.specification}</p>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="font-medium">{record.location.city}</span>
                        <span className="text-slate-300">·</span>
                        <span>{record.location.zone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Tag className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>{record.material.category?.name || 'Uncategorized'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div
                    className="px-5 py-4 flex items-center justify-between"
                    style={{ borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Verified Rate</p>
                      <p className="text-xl font-bold text-slate-900">
                        {record.price !== null ? formatCurrency(Number(record.price)) : 'N/A'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">per {record.material.unitOfMeasurement || 'unit'}</p>
                    </div>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0"
                      style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.15)', color: '#ff6b35' }}
                    >
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="bg-white py-5 px-4 sm:px-6 mt-auto"
        style={{ borderTop: '1px solid #e2e8f0' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div style={{ filter: 'drop-shadow(0 0 8px rgba(255,107,53,0.2))' }}>
              <EightyTwoBadge size={22} speed={0.6} />
            </div>
            <span className="font-semibold text-slate-600">An <span style={{ color: '#ff6b35' }}>Eighty-Two Limited</span> product</span>
          </div>
          <p className="text-center sm:text-right">
            National Construction Cost Database · Verified Material &amp; Labour Intelligence
          </p>
        </div>
      </footer>

      <MaterialDetailsModal
        isOpen={!!selectedMaterial}
        onClose={() => setSelectedMaterial(null)}
        materialId={selectedMaterial?.id || ''}
        materialName={selectedMaterial?.name || ''}
      />
    </div>
  );
};
