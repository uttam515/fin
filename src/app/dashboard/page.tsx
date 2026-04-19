"use client";

import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { 
  Activity, 
  Settings, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  RefreshCcw,
  BarChart3,
  Waves,
  Radio,
  ShieldCheck,
  TrendingUp,
  Clock
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend 
} from "recharts";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Configuration ---
const SAMPLE_RATE = 20; // 20 Hz
const FFT_SAMPLES = 32; // ~1.6 seconds of data
const FREQ_PER_BIN = SAMPLE_RATE / FFT_SAMPLES; // 0.625 Hz

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [fftData, setFftData] = useState<any[]>([]);
  const [healthIndex, setHealthIndex] = useState(100);
  const [vibrationRMS, setVibrationRMS] = useState(0);
  const [peakFreq, setPeakFreq] = useState(0);
  const [baselineFreq, setBaselineFreq] = useState<number | null>(null);
  const [modalShift, setModalShift] = useState(0);
  const [fatigueLevel, setFatigueLevel] = useState("Waiting for Baseline...");
  const [status, setStatus] = useState<"healthy" | "vulnerable" | "danger">("healthy");
  const [isConnected, setIsConnected] = useState(false);
  const [activeNodeCount, setActiveNodeCount] = useState(0);
  const [activeTab, setActiveTab] = useState("live");
  const [selectedAssetId, setSelectedAssetId] = useState("STR-882-B");
  const [diagnosis, setDiagnosis] = useState<string>("Waiting for Baseline...");
  
  // Fleet of Assets
  const assets = [
    { id: "STR-882-B", name: "Golden Gate Sector 4", type: "Bridge", status: "Healthy" },
    { id: "BLD-101-W", name: "Empire State West Wing", type: "Skyscraper", status: "Warning" },
    { id: "TUN-005-N", name: "Brooklyn Battery Tunnel", type: "Tunnel", status: "Healthy" }
  ];

  const assetProfile = assets.find(a => a.id === selectedAssetId) || assets[0];

  const incidentArchive = [
    { date: "14 APR", event: "Minor Resonant Shift", shift: "1.2%", risk: "Low" },
    { date: "02 APR", event: "High Amplitude Gust", shift: "0.4%", risk: "Low" },
    { date: "28 MAR", event: "Critical Seismic Event", shift: "15.4%", risk: "High" }
  ];

  const longTermTrend = [
    { month: "Nov", health: 98 }, { month: "Dec", health: 97 },
    { month: "Jan", health: 95 }, { month: "Feb", health: 94 },
    { month: "Mar", health: 88 }, { month: "Apr", health: 98 }
  ];
  
  const rawSamplesRef = useRef<number[]>([]);
  const displayMagnitudesRef = useRef<number[]>([]);
  const activeSensorsRef = useRef<{ [id: string]: { x: number, y: number, z: number, lastUpdate: number } }>({});
  const baselineFreqRef = useRef<number | null>(null);
  const historyCounterRef = useRef(0);
  const socketRef = useRef<any>(null);

  const [healthHistory, setHealthHistory] = useState<any[]>([]);
  const MAX_CHART_POINTS = 80;

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("vibration_update", (incoming: any) => {
      const id = incoming.sensorId || "unknown";
      activeSensorsRef.current[id] = {
        x: incoming.x,
        y: incoming.y,
        z: incoming.z,
        lastUpdate: Date.now()
      };
    });

    const pollInterval = setInterval(() => {
      const now = Date.now();
      let sumX = 0, sumY = 0, sumZ = 0;
      let validNodes = 0;

      for (const id in activeSensorsRef.current) {
        if (now - activeSensorsRef.current[id].lastUpdate < 2000) {
          sumX += activeSensorsRef.current[id].x;
          sumY += activeSensorsRef.current[id].y;
          sumZ += activeSensorsRef.current[id].z;
          validNodes++;
        } else {
          delete activeSensorsRef.current[id];
        }
      }
      
      setActiveNodeCount(validNodes);

      if (validNodes > 0) {
        const meanX = sumX / validNodes;
        const meanY = sumY / validNodes;
        const meanZ = sumZ / validNodes;

        setData((prev) => [...prev, { 
          time: new Date().toLocaleTimeString(), 
          x: parseFloat(meanX.toFixed(3)),
          y: parseFloat(meanY.toFixed(3)),
          z: parseFloat(meanZ.toFixed(3))
        }].slice(-MAX_CHART_POINTS));

        const magnitude = Math.sqrt(meanX * meanX + meanY * meanY + meanZ * meanZ);
        rawSamplesRef.current = [...rawSamplesRef.current, magnitude].slice(-FFT_SAMPLES);

        if (rawSamplesRef.current.length >= FFT_SAMPLES) {
          const dcOffset = rawSamplesRef.current.reduce((a, b) => a + b, 0) / FFT_SAMPLES;
          const zeroCentered = rawSamplesRef.current.map(v => v - dcOffset);
          const windowed = zeroCentered.map((v, i) => v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SAMPLES - 1))));

          const rawMagnitudes = performFFT(windowed);
          
          if (displayMagnitudesRef.current.length !== rawMagnitudes.length) {
            displayMagnitudesRef.current = [...rawMagnitudes];
          } else {
            rawMagnitudes.forEach((m, i) => displayMagnitudesRef.current[i] = (displayMagnitudesRef.current[i] * 0.8) + (m * 0.2));
          }
          
          setFftData(displayMagnitudesRef.current.map((m, i) => ({ 
            freq: parseFloat((i * FREQ_PER_BIN).toFixed(1)), 
            magnitude: parseFloat(m.toFixed(4)) 
          })));

          let maxMag = 0;
          let peakIdx = 0;
          rawMagnitudes.slice(1, FFT_SAMPLES / 2).forEach((m, i) => {
            if (m > maxMag) {
              maxMag = m;
              peakIdx = i + 1;
            }
          });

          const currentPeakHz = parseFloat((peakIdx * FREQ_PER_BIN).toFixed(2));
          setPeakFreq(currentPeakHz);

          const rmsEnergy = Math.sqrt(zeroCentered.reduce((a, b) => a + b * b, 0) / FFT_SAMPLES);
          setVibrationRMS(parseFloat(rmsEnergy.toFixed(3)));
          const cleanRMS = Math.max(0, rmsEnergy - 0.02);
          
          let freqPenalty = 0;
          const baseline = baselineFreqRef.current;
          if (baseline) {
            const shiftHz = Math.abs(currentPeakHz - baseline);
            const shiftPercent = (shiftHz / baseline) * 100;
            setModalShift(parseFloat(shiftPercent.toFixed(1)));
            freqPenalty = Math.min(90, shiftHz * 25);
            
            if (shiftPercent < 2) setDiagnosis("Structure Stable: No Significant Stiffness Loss.");
            else if (shiftPercent < 5) setDiagnosis("Warning: Minor Resonance Drift.");
            else setDiagnosis("CRITICAL: Structural Stiffness Loss Detected.");
          }

          const energyPenalty = Math.min(90, cleanRMS * 150);
          const targetIndex = Math.max(5, Math.round(100 - Math.max(energyPenalty, freqPenalty)));
          
          setHealthIndex(prev => (prev * 0.2) + (targetIndex * 0.8));
          setStatus(targetIndex > 85 ? "healthy" : targetIndex > 60 ? "vulnerable" : "danger");

          historyCounterRef.current++;
          if (historyCounterRef.current >= 40 || healthHistory.length === 0) {
            historyCounterRef.current = 0;
            setHealthHistory(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), health: targetIndex, peak: currentPeakHz, rms: rmsEnergy.toFixed(3) }].slice(-100));
          }
        }
      }
    }, 50);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [healthHistory.length]);

  const performFFT = (samples: number[]) => {
    const n = samples.length;
    const magnitudes = new Array(n).fill(0);
    for (let k = 0; k < n; k++) {
      let real = 0, imag = 0;
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * k * i) / n;
        real += samples[i] * Math.cos(angle);
        imag -= samples[i] * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(real * real + imag * imag) / n;
    }
    return magnitudes;
  };

  const setBaseline = () => {
    if (peakFreq > 0) {
      baselineFreqRef.current = peakFreq;
      setBaselineFreq(peakFreq);
      setDiagnosis("Baseline Calibrated Successfully.");
    }
  };

  const exportReport = () => {
    if (healthHistory.length === 0) return alert("No data recorded yet!");
    const csvContent = ["Timestamp,Health Index (%),Peak Freq (Hz),Vibration RMS (m/s2)", ...healthHistory.map(row => `${row.timestamp},${row.health},${row.peak},${row.rms}`)].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SHM_Report_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="flex min-h-screen bg-black text-white font-sans overflow-hidden">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-64 border-r border-white/5 flex flex-col bg-zinc-950/50 backdrop-blur-xl hidden lg:flex">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-blue-600 p-2 rounded-lg shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tighter uppercase">SHI Engine</span>
          </div>

          <nav className="space-y-6">
            <div>
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">Command</div>
              <div className="space-y-2">
                <button onClick={() => setActiveTab("live")} className={cn("w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold transition-all", activeTab === "live" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-500 hover:text-white")}>
                  <Activity className="w-4 h-4" /> Active Monitoring
                </button>
                <button onClick={() => setActiveTab("analytics")} className={cn("w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold transition-all", activeTab === "analytics" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-500 hover:text-white")}>
                  <BarChart3 className="w-4 h-4" /> Analytics
                </button>
                <button onClick={() => setActiveTab("alerts")} className={cn("w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold transition-all", activeTab === "alerts" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-500 hover:text-white")}>
                  <Bell className="w-4 h-4" /> Alerts
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">Assets</div>
              <div className="space-y-2">
                {assets.map(asset => (
                  <button key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className={cn("w-full flex items-center justify-between px-4 py-2 rounded-xl text-xs transition-all", selectedAssetId === asset.id ? "bg-white/5 border border-white/10 text-white" : "text-zinc-500 hover:bg-white/5")}>
                    <span className="truncate">{asset.name}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full", asset.status === "Healthy" ? "bg-green-500" : "bg-yellow-500")} />
                  </button>
                ))}
                <button onClick={() => setActiveTab("register")} className={cn("w-full flex items-center gap-2 px-4 py-3 mt-4 border border-dashed rounded-xl transition-all text-[10px] font-bold uppercase", activeTab === "register" ? "border-blue-500 text-blue-400 bg-blue-500/5" : "border-white/10 text-zinc-500 hover:border-white/20")}>
                  + Register Asset
                </button>
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 sticky top-0 bg-black/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
              <Radio className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Infrastructure Health Matrix</h1>
              <p className="text-zinc-500 text-sm flex items-center gap-2 mt-1">
                <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                {isConnected ? "System Uplink Active" : "Searching for Edge Nodes..."}
              </p>
            </div>
          </div>
        </header>

        <div className="p-10">
          {activeTab === "live" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-12 gap-10">
              {/* Asset Identity Bar */}
              <div className="col-span-12 flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px] bg-white/5 border border-white/10 p-6 rounded-[24px]">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Asset Identity</div>
                  <div className="text-lg font-bold italic tracking-tighter">{assetProfile.id} / {assetProfile.name}</div>
                </div>
                <div className="flex-1 min-w-[200px] bg-white/5 border border-white/10 p-6 rounded-[24px]">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Status</div>
                  <div className="text-lg font-bold text-green-400 flex items-center gap-2">LIVE MONITORING</div>
                </div>
              </div>

              {/* Metrics Column */}
              <div className="col-span-12 lg:col-span-4 space-y-10">
                <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px]" />
                  <div className="flex justify-between items-start mb-10 text-zinc-400">
                    <ShieldCheck className="w-8 h-8 text-blue-400" />
                    <Activity className="w-8 h-8" />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-64 h-64 transform -rotate-90">
                        <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-white/5" />
                        <motion.circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray={690} initial={{ strokeDashoffset: 690 }} animate={{ strokeDashoffset: 690 - (690 * healthIndex) / 100 }} className={cn(status === "healthy" ? "text-green-500" : status === "vulnerable" ? "text-yellow-500" : "text-red-500")} />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-7xl font-black italic">{Math.round(healthIndex)}%</span>
                        <span className="text-xs text-zinc-500 uppercase font-bold tracking-[0.3em] mt-2">Health Index</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[40px] p-10">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-8">Live Modal Parameters</h3>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-xs text-zinc-400 uppercase tracking-widest">Resonant Shift</span>
                      <span className={cn("text-lg font-bold font-mono", modalShift < 5 ? "text-green-400" : "text-red-400")}>{modalShift}%</span>
                    </div>
                    <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-xs text-zinc-400 uppercase tracking-widest">Intensity (RMS)</span>
                      <span className="text-lg font-bold text-blue-400 font-mono">{vibrationRMS}</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                      <span className="text-xs text-zinc-400 uppercase tracking-widest">Dominant Freq</span>
                      <span className="text-lg font-bold text-purple-400 font-mono">{peakFreq} Hz</span>
                    </div>
                  </div>
                </div>

                <button onClick={setBaseline} className="w-full bg-blue-600 py-8 rounded-[40px] font-black italic text-xl shadow-[0_0_50px_-10px_rgba(37,99,235,0.6)] hover:scale-[1.02] transition-all flex items-center justify-center gap-4 uppercase tracking-tighter">
                  <RefreshCcw className="w-6 h-6" /> Calibrate Baseline
                </button>
                <button onClick={exportReport} className="w-full bg-white/5 border border-white/10 py-6 rounded-[32px] font-bold text-xs text-zinc-400 hover:bg-white/10 transition-all uppercase tracking-widest">
                  Export Structural Report
                </button>
              </div>

              {/* Charts Column */}
              <div className="col-span-12 lg:col-span-8 space-y-10">
                <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 h-[450px]">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="text-xl font-bold italic tracking-tighter">VIBRATION TIME-SERIES</h3>
                  </div>
                  <ResponsiveContainer width="100%" height="80%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="time" hide />
                      <YAxis stroke="#333" fontSize={10} width={40} />
                      <Line type="monotone" dataKey="x" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="y" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="z" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 h-[450px]">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="text-xl font-bold italic tracking-tighter">FFT SPECTRAL DENSITY</h3>
                  </div>
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={fftData}>
                      <defs>
                        <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="freq" stroke="#333" fontSize={10} />
                      <Area type="monotone" dataKey="magnitude" stroke="#A855F7" fill="url(#colorFreq)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "analytics" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[40px] shadow-2xl shadow-blue-500/20">
                  <div className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mb-2">Portfolio Health Index</div>
                  <div className="text-6xl font-black italic text-white tracking-tighter">94.2%</div>
                  <div className="mt-4 flex items-center gap-2 text-white/80 text-xs font-bold bg-white/10 w-fit px-3 py-1 rounded-full border border-white/10">
                    <TrendingUp className="w-3 h-3" /> +1.4% from last month
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-8 rounded-[40px]">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-2">Active Alerts</div>
                  <div className="text-5xl font-black italic tracking-tighter text-yellow-500">01</div>
                  <div className="text-zinc-600 text-[10px] mt-4 font-bold uppercase">Sector: BLD-101-W</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-8 rounded-[40px]">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-2">Fleet Uptime</div>
                  <div className="text-5xl font-black italic tracking-tighter text-green-500">99.9</div>
                  <div className="text-zinc-600 text-[10px] mt-4 font-bold uppercase">System: Operational</div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-[0.3em] ml-4">Individual Asset Health</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   {assets.map(a => (
                     <div key={a.id} className="bg-white/5 border border-white/10 p-8 rounded-[32px] group hover:bg-white/[0.07] transition-all">
                        <div className="flex justify-between items-start mb-6">
                           <div>
                              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">{a.id}</div>
                              <div className="text-xl font-bold tracking-tight">{a.name}</div>
                           </div>
                           <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", a.status === "Healthy" ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20")}>
                              {a.status}
                           </div>
                        </div>
                        <div className="space-y-3">
                           <div className="flex justify-between items-end">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase">Health Score</span>
                              <span className="text-lg font-black italic">{a.status === "Healthy" ? "98.4%" : "72.1%"}</span>
                           </div>
                           <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all duration-1000", a.status === "Healthy" ? "bg-green-500 w-[98%]" : "bg-yellow-500 w-[72%]")} />
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "alerts" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black italic tracking-tighter">ALERT CENTER</h2>
                <div className="px-4 py-2 bg-red-500/10 text-red-500 rounded-full text-xs font-bold border border-red-500/20">
                  1 Critical Anomaly Unresolved
                </div>
              </div>
              {incidentArchive.map((inc, i) => (
                <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-[32px] flex justify-between items-center group hover:bg-white/10 transition-all">
                  <div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">{inc.date}</div>
                    <div className="text-xl font-bold">{inc.event}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-blue-400 mb-1">Resonant Shift: {inc.shift}</div>
                    <button className="text-[10px] font-bold text-zinc-600 hover:text-white uppercase tracking-widest font-black italic">View Investigation</button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === "register" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
              <div className="bg-white/5 border border-white/10 p-12 rounded-[48px]">
                <h2 className="text-3xl font-black italic mb-8 tracking-tighter text-center">REGISTER NEW ASSET</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-4">Asset Name</label>
                    <input type="text" placeholder="e.g. Hudson Tunnel North" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-all" />
                  </div>
                  <button className="w-full bg-blue-600 py-5 rounded-3xl font-black italic text-lg shadow-[0_0_40px_-10px_rgba(37,99,235,0.6)] hover:scale-[1.02] transition-all">
                    INITIALIZE MONITORING
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
