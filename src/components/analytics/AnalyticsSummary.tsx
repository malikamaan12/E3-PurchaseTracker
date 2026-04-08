"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface AnalyticsSummaryProps {
  data: {
    kpis: {
      totalPaid: number;
      byStatus: Array<{ status: string; count: number; totalValue: number }>;
    };
    variations: Array<{ dept: string; count: number; overrun: number }>;
  };
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function AnalyticsSummary({ data }: AnalyticsSummaryProps) {
  const byStatus = data?.kpis?.byStatus || [];
  const variations = data?.variations || [];
  
  const pendingRequests = byStatus.find(s => s.status === 'pending')?.count || 0;
  const approvedValue = byStatus.find(s => s.status === 'approved')?.totalValue || 0;
  const variationOverrun = variations.reduce((sum, v) => sum + (v.overrun || 0), 0);

  const stats = [
    {
      title: "Total Disbursed",
      value: `${(data.kpis.totalPaid / 1000).toFixed(1)}k`,
      unit: "QAR",
      icon: DollarSign,
      color: "text-[#2FB7B2]",
      bg: "bg-[#2FB7B2]/10",
      trend: "+12.5%",
      isPositive: true
    },
    {
      title: "Approved Pipeline",
      value: `${(Number(approvedValue) / 1000).toFixed(1)}k`,
      unit: "QAR",
      icon: TrendingUp,
      color: "text-[#5B4B8A]",
      bg: "bg-[#5B4B8A]/10",
      trend: "+8.2%",
      isPositive: true
    },
    {
      title: "Pending Actions",
      value: pendingRequests,
      unit: "Requests",
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      trend: "-3",
      isPositive: true
    },
    {
      title: "Budget Overruns",
      value: `${(variationOverrun / 1000).toFixed(1)}k`,
      unit: "QAR",
      icon: AlertTriangle,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      trend: "+4.1%",
      isPositive: false
    }
  ];

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
    >
      {stats.map((stat, i) => (
        <motion.div key={i} variants={item} className="glass-card p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div className={`flex items-center gap-1 text-xs font-bold ${stat.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stat.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {stat.trend}
            </div>
          </div>
          
          <div className="mt-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h2 className="text-3xl font-bold text-foreground tracking-tight font-serif">{stat.value}</h2>
              <span className="text-xs text-muted-foreground font-medium">{stat.unit}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
