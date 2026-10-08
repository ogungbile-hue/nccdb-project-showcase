import React from 'react';
import { FilterState, ModerationStatus } from '../types';
import { Search, RotateCcw, SlidersHorizontal, MapPin, Tag, Calendar, Globe, Layers, BookOpen } from 'lucide-react';

interface FilterToolbarProps {
  filters: FilterState;
  onChange: (updating: Partial<FilterState>) => void;
  onReset: () => void;
  currentStatus: ModerationStatus | 'ALL';
  onStatusChange: (status: ModerationStatus | 'ALL') => void;
  availableMaterialNames: string[];
  availableCities: string[];
  availableZones: string[];
  availableSourceTypes: string[];
  userRole?: string;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  onChange,
  onReset,
  currentStatus,
  onStatusChange,
  availableMaterialNames,
  availableCities,
  availableZones,
  availableSourceTypes,
  userRole,
}) => {
  return (
    <div 
      id="nccdb-filter-toolbar" 
      className="bg-white border border-slate-200 rounded p-2 px-3 shadow-xs font-sans"
    >
      {/* TOOLBAR HEADER CONTROLS */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Active Filter Parameters</h3>
        </div>
        <button
          id="btn-reset-filters"
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer py-0.5 px-2 rounded hover:bg-slate-50 border border-slate-200 uppercase tracking-tight"
          title="Reset all filter options"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          Clear FILTERS
        </button>
      </div>

      {/* MULTI-DIMENSIONAL FILTER MATRIX GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
        
        {/* 1. QUEUE LEDGER STATUS FILTER */}
        <div className="flex flex-col gap-1" id="filter-group-queue-status">
          <label htmlFor="select-queue-status" className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
            <Layers className="h-2.5 w-2.5 text-blue-500" /> Queue State
          </label>
          {userRole !== 'SUPER_ADMIN' ? (
            <div className="w-full text-xs bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 text-emerald-800 font-bold flex items-center gap-1 h-[34px]">
              ✅ Approved Baseline
            </div>
          ) : (
            <select
              id="select-queue-status"
              value={currentStatus}
              onChange={(e) => onStatusChange(e.target.value as ModerationStatus | 'ALL')}
              className="w-full text-xs bg-blue-50/60 hover:bg-blue-50 border border-blue-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-900 font-bold cursor-pointer transition-colors h-[34px]"
            >
              <option value="ALL" className="bg-white text-slate-900 font-medium">📋 All Statuses</option>
              <option value="PENDING" className="bg-white text-slate-900 font-medium">⏳ Pending</option>
              <option value="APPROVED" className="bg-white text-slate-900 font-medium">✅ Approved</option>
              <option value="FLAGGED" className="bg-white text-slate-900 font-medium">⚠️ Flagged</option>
              <option value="CORRUPTED" className="bg-white text-slate-900 font-medium">❌ Corrupted</option>
            </select>
          )}
        </div>

        {/* TEXT SEARCH */}
        <div className="flex flex-col gap-1 col-span-2 lg:col-span-2" id="filter-group-search">
          <label htmlFor="search-input" className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
            <Search className="h-2.5 w-2.5" /> Material/ID Search
          </label>
          <div className="relative">
            <input
              id="search-input"
              type="text"
              value={filters.searchQuery || ''}
              onChange={(e) => onChange({ searchQuery: e.target.value })}
              placeholder="Filter names..."
              className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 pr-6 font-medium"
            />
            {filters.searchQuery && (
              <button
                type="button"
                onClick={() => onChange({ searchQuery: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* MATERIAL NAME SELECT */}
        <div className="flex flex-col gap-1" id="filter-group-material">
          <label htmlFor="select-material" className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
            <Tag className="h-2.5 w-2.5" /> Material
          </label>
          <select
            id="select-material"
            value={filters.materialName || ''}
            onChange={(e) => onChange({ materialName: e.target.value })}
            className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium cursor-pointer"
          >
            <option value="" className="text-slate-800 bg-white">All Groups ({availableMaterialNames.length})</option>
            {availableMaterialNames.map((name) => (
              <option key={name} value={name} className="text-slate-800 bg-white py-1">
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* CITY SELECTION */}
        <div className="flex flex-col gap-1" id="filter-group-city">
          <label htmlFor="select-city" className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> City
          </label>
          <select
            id="select-city"
            value={filters.city || ''}
            onChange={(e) => onChange({ city: e.target.value })}
            className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium cursor-pointer"
          >
            <option value="" className="text-slate-800 bg-white">All Cities ({availableCities.length})</option>
            {availableCities.map((city) => (
              <option key={city} value={city} className="text-slate-800 bg-white py-1">
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* ZONE SELECTION */}
        <div className="flex flex-col gap-1" id="filter-group-zone">
          <label htmlFor="select-zone" className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
            <Globe className="h-2.5 w-2.5" /> Zone
          </label>
          <select
            id="select-zone"
            value={filters.zone || ''}
            onChange={(e) => onChange({ zone: e.target.value })}
            className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium cursor-pointer"
          >
            <option value="" className="text-slate-800 bg-white">All Zones ({availableZones.length})</option>
            {availableZones.map((zone) => {
              // Replaces all underscores globally and formats into clean Title Case
              const displayZone = zone.replace(/_/g, ' ')
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());
              return (
                <option key={zone} value={zone} className="text-slate-800 bg-white py-1">
                  {displayZone}
                </option>
              );
            })}
          </select>
        </div>

        {/* SOURCE TYPE REGISTRY MAPPING */}
        <div className="flex flex-col gap-1" id="filter-group-source">
          <label htmlFor="select-source" className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
            <BookOpen className="h-2.5 w-2.5 text-slate-500" /> Source
          </label>
          <select
            id="select-source"
            value={filters.sourceType || ''}
            onChange={(e) => onChange({ sourceType: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-700 font-semibold cursor-pointer"
          >
            <option value="" className="text-slate-800 bg-white py-2">All Sources ({availableSourceTypes.length})</option>
            {availableSourceTypes.map((source) => {
              let displayName = source;
              if (source === 'QS_REPORT') displayName = 'Professional QS Report';
              if (source === 'MANUAL_ENTRY') displayName = 'Verified Field Survey';
              if (source === 'TENDER_RETURN') displayName = 'Contractor Tender Return';
              if (source === 'MARKET_BULLETIN') displayName = 'Verified Supplier Feed';

              return (
                <option key={source} value={source} className="text-slate-900 bg-white py-3 font-semibold">
                  {displayName}
                </option>
              );
            })}
          </select>
        </div>

        {/* DATE RANGE: START DATE */}
        <div className="flex flex-col gap-1" id="filter-group-startdate">
          <label htmlFor="input-startdate" className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" /> From Date
          </label>
          <input
            id="input-startdate"
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-800 text-center cursor-pointer font-medium"
          />
        </div>

      </div>
    </div>
  );
};