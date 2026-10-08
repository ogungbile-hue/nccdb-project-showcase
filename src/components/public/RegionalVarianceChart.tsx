import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { formatCurrency } from './formatCurrency';

export interface VarianceData {
  zone: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  dataPoints: number;
}

export const RegionalVarianceChart: React.FC<{ data: VarianceData[] }> = ({ data }) => {
  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="zone" 
            tickLine={false} 
            axisLine={false} 
            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
            dy={10}
          />
          <YAxis 
            tickFormatter={(value) => `₦${(value / 1000)}k`} 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            dx={-10}
          />
          <Tooltip 
            formatter={(value: any, name: any) => [
              formatCurrency(Number(value)), 
              name === 'averagePrice' ? 'Average Rate' : name === 'minPrice' ? 'Lowest Rate' : 'Peak Rate'
            ]}
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="averagePrice" name="Average Rate" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
          <Bar dataKey="minPrice" name="Lowest Rate" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
          <Bar dataKey="maxPrice" name="Peak Rate" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
