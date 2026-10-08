import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { ApiService } from '../../apiService';
import { RegionalVarianceChart, VarianceData } from './RegionalVarianceChart';
import { formatCurrency } from './formatCurrency';

interface ModalProps {
  materialId: string;
  materialName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const MaterialDetailsModal: React.FC<ModalProps> = ({ materialId, materialName, isOpen, onClose }) => {
  const [varianceData, setVarianceData] = useState<VarianceData[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [variance, trends] = await Promise.all([
          ApiService.getRegionalVariance(materialId),
          ApiService.getTrendAnalytics(materialId)
        ]);
        if (isMounted) {
          setVarianceData(variance || []);
          setTrendData(trends || []);
        }
      } catch (err) {
        console.error('Failed to load material insights:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    fetchData();
    return () => { isMounted = false; };
  }, [materialId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{materialName}</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Verified Analytical Insights</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">Compiling insights...</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Regional Variance Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  Regional Variance Map
                </h3>
                {varianceData.length > 0 ? (
                  <RegionalVarianceChart data={varianceData} />
                ) : (
                  <p className="text-slate-400 text-center py-10 font-medium">Insufficient regional data for this material.</p>
                )}
              </div>

              {/* Trend Analytics Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" /> Chronological Price Trend
                </h3>
                {trendData.length > 0 ? (
                  <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          tickLine={false} 
                          axisLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                          dy={10}
                        />
                        <YAxis 
                          tickFormatter={(val) => `₦${(val / 1000)}k`} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                          dx={-10}
                        />
                        <RechartsTooltip 
                          formatter={(val: any) => [formatCurrency(Number(val)), 'Verified Rate']}
                          cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '5 5' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#3b82f6" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#ffffff' }} 
                          activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-10 font-medium">Insufficient chronological data.</p>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
