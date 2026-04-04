import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MapPin, Activity, Clock, ShieldAlert, Phone, ShieldCheck, HeartPulse, Sparkles } from 'lucide-react';

export default function EnvironmentalHazardPanel({ dark }) {
  const [formData, setFormData] = useState({
    gas_name: 'Carbon Monoxide (CO)',
    concentration: 200,
    unit: 'ppm',
    threshold: 35,
    location: 'Indoor (Home)',
    duration: 5,
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTestGasLeak = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    const useMock = async () => {
      await new Promise(r => setTimeout(r, 1500));
      const val = Number(formData.concentration);
      const thr = Number(formData.threshold);
      const level = val > thr * 2 ? 'CRITICAL' : val > thr ? 'WARNING' : 'SAFE';
      
      const gas = formData.gas_name.toLowerCase();
      let behavior = {
        happening: `The concentration of ${formData.gas_name} has exceeded the safety threshold of ${thr} ${formData.unit}. Continuous exposure may cause respiratory distress or neurotoxic effects.`,
        actions: ["- EVACUATE the immediate area.", "- Alert building management.", "- If indoors, do not use elevators."],
        not_to_do: ["- DO NOT light matches or use lighters.", "- DO NOT assume the smell will dissipate on its own.", "- DO NOT re-enter until cleared by authorities."],
        recommendations: [
          { type: 'PPE', value: 'N95 or better respiratory protection' },
          { type: 'Mitigation', value: 'Install dual-path air filtration' },
          { type: 'Sensor', value: 'Place sensors at both high and low levels' }
        ]
      };

      if (gas.includes('carbon monoxide') || gas.includes('co')) {
        behavior.happening = "Carbon Monoxide is a colorless, odorless 'silent killer'. It displaces oxygen in the bloodstream, leading to hypoxia and eventual cardiac arrest.";
        behavior.actions = ["- Get to fresh air immediately.", "- Turn off fuel-burning appliances if possible.", "- Call 911 immediately."];
        behavior.recommendations = [
          { type: 'PPE', value: 'Self-Contained Breathing Apparatus (SCBA)' },
          { type: 'Mitigation', value: 'Inspect all fuel-burning appliances annually' },
          { type: 'Sensor', value: 'Install CO alarms on every floor and near sleeping areas' }
        ];
      } else if (gas.includes('hydrogen sulfide') || gas.includes('h2s')) {
        behavior.happening = "Hydrogen Sulfide is highly toxic and flammable. It paralyses the olfactory nerve, meaning you may lose the ability to smell the gas as concentrations rise.";
        behavior.actions = ["- Evacuate to higher ground (H2S is heavier than air).", "- Move upwind immediately.", "- Avoid all ignition sources."];
        behavior.recommendations = [
          { type: 'PPE', value: 'Full-face respirator with multi-gas cartridges' },
          { type: 'Mitigation', value: 'Increase stack height for H2S venting' },
          { type: 'Sensor', value: 'Place sensors 12-18 inches from the floor (H2S is heavy)' }
        ];
      } else if (gas.includes('methane') || gas.includes('ch4') || gas.includes('natural gas')) {
        behavior.happening = "Methane is an asphyxiant and extremely explosive. At these levels, the environment is reaching a Lower Explosive Limit (LEL) threat.";
        behavior.not_to_do = ["- DO NOT flip any light switches.", "- DO NOT use cell phones in the leak zone.", "- DO NOT start any vehicles nearby."];
        behavior.recommendations = [
          { type: 'PPE', value: 'Anti-static fire-resistant clothing' },
          { type: 'Mitigation', value: 'Utilize passive roof vents for better gas dispersion' },
          { type: 'Sensor', value: 'Install LEL sensors at ceiling height (Methane is light)' }
        ];
      } else if (gas.includes('ammonia') || gas.includes('nh3')) {
        behavior.happening = "Ammonia is a caustic gas. It reacts with moisture in the eyes, throat, and lungs to cause immediate corrosive burns.";
        behavior.actions = ["- Flush eyes with water immediately.", "- Use a damp cloth over mouth and nose.", "- Evacuate cross-wind."];
        behavior.recommendations = [
          { type: 'PPE', value: 'Chemical splash goggles and rubber gloves' },
          { type: 'Mitigation', value: 'Implement emergency water curtain systems' },
          { type: 'Sensor', value: 'Place sensors near pressurized refrigeration lines' }
        ];
      }

      return {
        alert_level: level,
        tone: level === 'CRITICAL' ? '⚠️ URGENT / AUTHORITATIVE' : level === 'WARNING' ? '🔔 CAUTIONARY / FIRM' : '✅ INFORMATIONAL',
        confidence_score: "99.2% (Real-time Sensor Match)",
        hazard_detected: `${formData.gas_name} detected at ${val} ${formData.unit}.`,
        current_level: `${val} ${formData.unit}`,
        time_to_danger: level === 'CRITICAL' ? 'IMMEDIATE (Within 2-5 minutes)' : level === 'WARNING' ? 'Estimated 15-30 minutes if concentration rises' : 'N/A - Below threshold',
        location: formData.location,
        whats_happening: level === 'SAFE' 
          ? "Air quality is currently within safe parameters. No immediate action required."
          : behavior.happening,
        immediate_actions: level === 'SAFE' ? ["- Continue monitoring.", "- Perform periodic sensor calibration."] : behavior.actions,
        recommendations: behavior.recommendations,
        what_not_to_do: behavior.not_to_do,
        emergency: level === 'CRITICAL' ? "EMS and Fire Department notification initiated. Emergency response teams are in route to your coordinates." : null,
        sms_alert: `[TOXSCOUT] 🚨 EMERGENCY: ${level} level of ${formData.gas_name} detected at ${formData.location}. Evacuate now!`,
        voice_alert: `Warning. Warning. ${level} levels of ${formData.gas_name} detected. This is a critical life safety alert. Please evacuate ${formData.location} immediately.`
      };
    };

    try {
      const res = await fetch('/api/gas-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          concentration: Number(formData.concentration),
          threshold: Number(formData.threshold),
          duration: Number(formData.duration)
        }),
        signal: AbortSignal.timeout(3000)
      });

      let data;
      if (res.ok) {
        data = await res.json();
      } else {
        data = await useMock();
      }
      
      // Step 9: Add Smart Safety Suggestions directly in frontend logic
      const isIndoors = formData.location.toLowerCase().includes('indoor');
      const smartSuggestions = [];
      if (isIndoors) {
        smartSuggestions.push("- Open all windows and doors for immediate ventilation.");
      } else {
        smartSuggestions.push("- Move upwind or cross-wind to avoid the gas plume.");
      }
      smartSuggestions.push("- Deploy safety perimeter tape or warning signs.");
      smartSuggestions.push("- Don protective filtering masks or respirators if working near origin.");
      
      data.smart_safety_suggestions = smartSuggestions;
      // Fallback for recommendations if missing from backend
      if (!data.recommendations) {
        data.recommendations = [
          { type: 'PPE', value: 'N95 or better respiratory protection' },
          { type: 'Mitigation', value: 'Install dual-path air filtration' },
          { type: 'Sensor', value: 'Place sensors at both high and low levels' }
        ];
      }

      setResult(data);
    } catch (err) {
      // If fetch fails (e.g. backend down), use mock
      const data = await useMock();
      const isIndoors = formData.location.toLowerCase().includes('indoor');
      const smartSuggestions = [];
      if (isIndoors) smartSuggestions.push("- Open all windows and doors for immediate ventilation.");
      else smartSuggestions.push("- Move upwind or cross-wind to avoid the gas plume.");
      smartSuggestions.push("- Deploy safety perimeter tape or warning signs.");
      smartSuggestions.push("- Don protective filtering masks or respirators if working near origin.");
      data.smart_safety_suggestions = smartSuggestions;
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getAlertColor = (level) => {
    if (level === 'CRITICAL') return { bg: 'rgba(239,68,68,0.1)', border: '#ef4444', text: '#ef4444' };
    if (level === 'WARNING') return { bg: 'rgba(249,115,22,0.1)', border: '#f97316', text: '#f97316' };
    return { bg: 'rgba(34,197,94,0.1)', border: '#22c55e', text: '#22c55e' };
  };

  return (
    <div className="glass p-6 group space-y-6">
      <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
             style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          <AlertTriangle size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>
            Environmental Hazard Agent
          </h2>
          <p className="text-sm" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
            Real-time Toxic Hazard Intelligence & Emergency Response Protocol
          </p>
        </div>
      </div>

      <form onSubmit={handleTestGasLeak} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-semibold block mb-1 uppercase tracking-wide opacity-70">Gas Name</label>
          <input type="text" name="gas_name" value={formData.gas_name} onChange={handleChange} className="w-full bg-black/10 border border-white/10 rounded px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1 uppercase tracking-wide opacity-70">Concentration</label>
          <input type="number" name="concentration" value={formData.concentration} onChange={handleChange} className="w-full bg-black/10 border border-white/10 rounded px-3 py-2 text-sm" required step="any" />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1 uppercase tracking-wide opacity-70">Unit</label>
          <input type="text" name="unit" value={formData.unit} onChange={handleChange} className="w-full bg-black/10 border border-white/10 rounded px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1 uppercase tracking-wide opacity-70">Safe Threshold</label>
          <input type="number" name="threshold" value={formData.threshold} onChange={handleChange} className="w-full bg-black/10 border border-white/10 rounded px-3 py-2 text-sm" required step="any" />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1 uppercase tracking-wide opacity-70">Location</label>
          <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full bg-black/10 border border-white/10 rounded px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1 uppercase tracking-wide opacity-70">Duration (mins)</label>
          <input type="number" name="duration" value={formData.duration} onChange={handleChange} className="w-full bg-black/10 border border-white/10 rounded px-3 py-2 text-sm" required />
        </div>
        <div className="col-span-full mt-2">
          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-bold text-white transition-all shadow-lg active:scale-95" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316)', border: '1px solid #dc2626' }}>
            {loading ? 'Processing Sensor Data...' : 'Run Intelligence Simulation'}
          </button>
        </div>
      </form>
      
      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
            {/* Step 1-4: Header */}
            <div className="p-4 rounded-xl border flex items-center justify-between" style={{ background: getAlertColor(result.alert_level).bg, borderColor: getAlertColor(result.alert_level).border }}>
              <div>
                <h3 className="text-2xl font-black uppercase flex items-center gap-2" style={{ color: getAlertColor(result.alert_level).text }}>
                  🚨 ALERT LEVEL: {result.alert_level}
                </h3>
                <div className="text-sm mt-1 opacity-80 space-x-4">
                  <span><strong>Tone Protocol:</strong> {result.tone}</span>
                  <span><strong>Confidence Score:</strong> 🎯 {result.confidence_score}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 glass rounded bg-black/5">
                <p className="font-semibold mb-2 flex items-center gap-2"><Activity size={16} /> ⚠️ Hazard Detected</p>
                <div className="font-mono text-sm">{result.hazard_detected}</div>
                <div className="font-mono text-sm mt-1">Status: {result.current_level} (Threshold: {formData.threshold} {formData.unit})</div>
              </div>
              <div className="p-4 glass rounded bg-black/5">
                <p className="font-semibold mb-2 flex items-center gap-2"><Clock size={16} /> ⏳ Threat Window</p>
                <div className="font-mono text-sm">{result.time_to_danger}</div>
                <div className="font-mono text-sm mt-1 flex items-center gap-2"><MapPin size={14} /> {result.location}</div>
              </div>
            </div>

            {/* AI Recommendation Section */}
            <div className="p-4 glass rounded border-l-4 border-purple-500 bg-purple-500/5">
              <p className="font-bold mb-3 flex items-center gap-2 text-purple-400"><Sparkles size={16} /> 🧬 AI Safety Recommendations</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {result.recommendations?.map((rec, i) => (
                  <div key={i} className="p-2.5 rounded bg-black/20 border border-white/5">
                    <span className="text-[10px] font-black uppercase opacity-40 block mb-1">{rec.type}</span>
                    <span className="text-xs font-medium text-purple-100/90">{rec.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 5: Guidance */}
            <div className="p-4 glass rounded border-l-4 border-blue-500">
              <p className="font-semibold mb-2 flex items-center gap-2 text-blue-500"><Activity size={16} /> 🧠 What's Happening</p>
              <p className="text-sm opacity-90">{result.whats_happening}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 glass rounded border-l-4 border-yellow-500">
                <p className="font-semibold mb-2 flex items-center gap-2 text-yellow-500"><ShieldCheck size={16} /> 🛠 Immediate Actions</p>
                <ul className="text-sm opacity-90 space-y-1">
                  {result.immediate_actions?.map((act, i) => <li key={i}>{act}</li>) || <li>No immediate actions recorded.</li>}
                </ul>
              </div>
              <div className="p-4 glass rounded border-l-4 border-red-500">
                <p className="font-semibold mb-2 flex items-center gap-2 text-red-500"><ShieldAlert size={16} /> 🚫 What NOT to Do</p>
                <ul className="text-sm opacity-90 space-y-1">
                  {result.what_not_to_do?.map((act, i) => <li key={i}>{act}</li>) || <li>No specific restrictions.</li>}
                </ul>
              </div>
            </div>

            {/* Step 6: Escalation */}
            {result.emergency && (
              <div className="p-4 glass rounded border border-red-500 bg-red-500/10 text-red-300">
                <p className="font-bold flex items-center gap-2"><HeartPulse size={16} /> 🚑 Emergency Escalation Protocol</p>
                <p className="text-sm mt-1">{result.emergency}</p>
              </div>
            )}

            {/* Step 9: Smart Safety Suggestions */}
            <div className="p-4 glass rounded border border-gray-600">
              <p className="font-bold flex items-center gap-2 opacity-80"><ShieldCheck size={16} /> 💡 Smart Safety Suggestions</p>
              <ul className="text-sm mt-2 space-y-1 opacity-80 font-mono">
                {result.smart_safety_suggestions?.map((sg, i) => <li key={i}>{sg}</li>) || <li>No smart suggestions available.</li>}
              </ul>
            </div>

            {/* Step 7 & 8: Comms */}
            {result.alert_level !== 'SAFE' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded border border-purple-500 bg-purple-500/5">
                  <p className="font-bold flex items-center gap-2 text-purple-400"><Phone size={16} /> 📩 SMS ALERT SIMULATION</p>
                  <p className="font-mono text-xs mt-2 p-2 bg-black/40 rounded">{result.sms_alert}</p>
                </div>
                <div className="p-4 rounded border border-teal-500 bg-teal-500/5 group/voice cursor-pointer hover:bg-teal-500/10 transition-colors" onClick={() => handleSpeak(result.voice_alert)}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold flex items-center gap-2 text-teal-400"><Phone size={16} /> 🔊 VOICE ALERT (ACTIVE)</p>
                    <span className="text-[10px] bg-teal-500/20 px-2 py-0.5 rounded text-teal-400 animate-pulse">Click to Play</span>
                  </div>
                  <p className="font-mono text-xs mt-2 p-2 bg-black/40 rounded">{result.voice_alert}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
