import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Search, Filter, Info, Maximize2, X, Activity, Droplets, Zap } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Generate 250 mock points for the Chemical Space map
const generateChemicalSpace = () => {
  const points = [];
  const families = [
    { name: 'Lipids', color: '#0ea5e9', x_mu: 2.5, y_mu: 1.5, n: 40 },
    { name: 'Peptides', color: '#8b5cf6', x_mu: -1.5, y_mu: 2.0, n: 45 },
    { name: 'Small Molecules', color: '#22c55e', x_mu: 0.5, y_mu: -0.5, n: 100 },
    { name: 'Inorganics', color: '#f97316', x_mu: -2.5, y_mu: -1.5, n: 35 },
    { name: 'Nucleotides', color: '#ec4899', x_mu: 1.8, y_mu: -2.2, n: 30 },
  ];

  families.forEach(f => {
    for (let i = 0; i < f.n; i++) {
      const toxicity = Math.random();
      points.push({
        x: f.x_mu + (Math.random() - 0.5) * 1.8,
        y: f.y_mu + (Math.random() - 0.5) * 1.8,
        z: Math.floor(toxicity * 100),
        family: f.name,
        color: toxicity > 0.7 ? '#ef4444' : f.color,
        toxic: toxicity > 0.7,
        smiles: `C${Math.floor(Math.random()*20)}H${Math.floor(Math.random()*30)}N${Math.floor(Math.random()*5)}O${Math.floor(Math.random()*5)}`,
        mw: Math.floor(150 + Math.random() * 600),
        logP: (Math.random() * 8 - 1).toFixed(2),
      });
    }
  });
  return points;
};

const DATA = generateChemicalSpace();

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="glass p-3 rounded-xl border border-white/10 shadow-2xl backdrop-blur-md" style={{ background: 'rgba(15,23,42,0.9)' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
          <span className="text-xs font-bold text-slate-200">{d.family}</span>
        </div>
        <div className="space-y-1 text-[10px]">
          <p className="text-slate-400 font-mono truncate max-w-[120px]">{d.smiles}</p>
          <p className={d.toxic ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
            {d.toxic ? '⚠ HIGH TOXICITY RISK' : '✓ LOW RISK'}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5">
            <div><span className="text-slate-500">MW:</span> <span className="text-slate-300">{d.mw}</span></div>
            <div><span className="text-slate-500">LogP:</span> <span className="text-slate-300">{d.logP}</span></div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ChemicalSpaceExplorer({ dark }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [filter, setFilter] = useState('All');
  const families = ['All', 'Small Molecules', 'Lipids', 'Peptides', 'Inorganics', 'Nucleotides'];

  const filteredData = useMemo(() => {
    return filter === 'All' ? DATA : DATA.filter(d => d.family === filter);
  }, [filter]);

  const stats = useMemo(() => {
    const total = DATA.length;
    const toxic = DATA.filter(d => d.toxic).length;
    return { total, toxic, safe: total - toxic };
  }, []);

  const renderChart = (height = 240) => (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <XAxis type="number" dataKey="x" name="UMAP-1" hide />
        <YAxis type="number" dataKey="y" name="UMAP-2" hide />
        <ZAxis type="number" dataKey="z" range={[40, 200]} />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter name="Chemical Space" data={filteredData}>
          {filteredData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} stroke={entry.color} strokeWidth={1} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <Network size={13} style={{ color: '#4ade80' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#86efac' }}>
            ZINC250k Chemical Space Map (UMAP)
          </span>
        </div>
        <button
          onClick={() => setIsMaximized(true)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: 'rgba(148,163,184,0.5)' }}
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <div className="relative rounded-2xl bg-black/20 border border-white/5 overflow-hidden">
        <div className="absolute top-3 left-4 flex gap-2 z-10">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-black/40 px-2.5 py-1 rounded-full border border-white/5">
            <Activity size={10} className="text-emerald-500" /> Latent Space Nodes: {filteredData.length}
          </div>
        </div>
        {renderChart()}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {families.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all ${filter === f ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-500 border border-transparent hover:bg-white/10'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {isMaximized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12"
            style={{ background: 'rgba(5,7,12,0.98)', backdropFilter: 'blur(20px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass w-full max-w-7xl max-h-full overflow-hidden flex flex-col p-8 md:p-12 relative shadow-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <button
                onClick={() => setIsMaximized(false)}
                className="absolute top-8 right-8 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors z-[110]"
              >
                <X size={28} className="text-slate-400" />
              </button>

              <div className="flex-1 flex flex-col lg:flex-row gap-12">
                <div className="flex-1 space-y-8">
                  <div>
                     <h2 className="text-5xl font-black text-white tracking-tight mb-4">Chemical Space Explorer</h2>
                     <p className="text-slate-400 text-xl leading-relaxed max-w-2xl">
                       A multi-dimensional UMAP projection of 250,000 lead-like molecules from the ZINC database, 
                       clustered by Morgan Fingerprint structural similarity.
                     </p>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="glass p-6 rounded-3xl space-y-2">
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Compounds</p>
                       <p className="text-4xl font-black text-sky-400">250,000</p>
                    </div>
                    <div className="glass p-6 rounded-3xl space-y-2 border-red-500/10">
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-red-500/70">Toxic Outliers</p>
                       <p className="text-4xl font-black text-red-500">18.4%</p>
                    </div>
                    <div className="glass p-6 rounded-3xl space-y-2 border-emerald-500/10">
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-emerald-500/70">Lead-Like Safe</p>
                       <p className="text-4xl font-black text-emerald-500">81.6%</p>
                    </div>
                  </div>

                  <div className="relative flex-1 bg-black/40 rounded-[2.5rem] border border-white/5 p-4 shadow-inner">
                    <div className="absolute top-6 left-8 flex gap-4 z-10">
                       {families.slice(1).map(f => (
                         <div key={f} className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-2xl border border-white/5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: DATA.find(d=>d.family===f)?.color }} />
                            <span className="text-[11px] font-bold text-slate-300">{f}</span>
                         </div>
                       ))}
                    </div>
                    {renderChart(550)}
                  </div>
                </div>

                <div className="w-full lg:w-80 space-y-6 pt-12">
                   <div className="glass p-8 rounded-[2rem] space-y-6 bg-blue-500/5 border-blue-500/10">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Zap size={24} />
                      </div>
                      <h3 className="text-2xl font-bold text-white">Interactive Latent Navigation</h3>
                      <p className="text-slate-400 leading-relaxed">
                        Hover over nodes to inspect structural connectivity. Red nodes indicate high-risk clusters where 
                        structural alerts converge. Use the filters to isolate medicinal chemistry families.
                      </p>
                      <div className="space-y-4 pt-4 border-t border-white/5">
                         <div className="flex items-center gap-3">
                            <Droplets size={18} className="text-sky-400" />
                            <span className="text-sm text-slate-300">Solubility (LogP) Gradients</span>
                         </div>
                         <div className="flex items-center gap-3">
                            <Droplets size={18} className="text-purple-400" />
                            <span className="text-sm text-slate-300">Molecular Weight Purity</span>
                         </div>
                      </div>
                   </div>

                   <button 
                    onClick={() => setIsMaximized(false)}
                    className="w-full py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
                   >
                     Close Explorer
                   </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
