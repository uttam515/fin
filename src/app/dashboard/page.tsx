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
  ShieldCheck
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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── True DFT Implementation ─────────────────────────────────
// Computes |X(k)| for k = 0 … N/2-1
const performFFT = (samples: number[]): number[] => {
  const n = samples.length;
  if (n === 0) return [];
  const half = Math.floor(n / 2);
  const magnitudes = new Array(half).fill(0);
  for (let k = 0; k < half; k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += samples[t] * Math.cos(angle);
      im -= samples[t] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(re * re + im * im) / n;
  }
  return magnitudes;
};

// 20 Hz poll × 32 samples = 1.6s buffer, 16 bins, 0.625 Hz/bin
const SAMPLE_RATE = 20;
const FFT_SAMPLES = 32;
const FREQ_PER_BIN = SAMPLE_RATE / FFT_SAMPLES; // 0.625 Hz

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [fftData, setFftData] = useState<any[]>([]);
  const [baselineFreq, setBaselineFreq] = useState<number | null>(null);
  const [healthIndex, setHealthIndex] = useState(100);
  const [modalShift, setModalShift] = useState(0);
  const [peakFreq, setPeakFreq] = useState(0);
  const [status, setStatus] = useState<"healthy" | "vulnerable" | "danger">("healthy");
  const [isConnected, setIsConnected] = useState(false);
  const [activeNodeCount, setActiveNodeCount] = useState(0);
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  
  const socketRef = useRef<any>(null);
  const rawSamplesRef = useRef<number[]>([]);
  const displayMagnitudesRef = useRef<number[]>([]);
  const activeSensorsRef = useRef<{ [id: string]: { x: number, y: number, z: number, lastUpdate: number } }>({});
  const baselineFreqRef = useRef<number | null>(null);

  const MAX_CHART_POINTS = 80;

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("vibration_update", (incoming: any) => {
      const sensorId = incoming.sensorId || "unknown";
      activeSensorsRef.current[sensorId] = {
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
      const currentActiveIds: string[] = [];

      for (const id in activeSensorsRef.current) {
        const sensor = activeSensorsRef.current[id];
        if (now - sensor.lastUpdate < 2000) {
          sumX += sensor.x;
          sumY += sensor.y;
          sumZ += sensor.z;
          validNodes++;
          currentActiveIds.push(id);
        } else {
          delete activeSensorsRef.current[id];
        }
      }
      
      setActiveNodeCount(validNodes);
      setActiveNodeIds(currentActiveIds);

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

        // Use MAGNITUDE of all 3 axes so vibration in ANY direction is detected
        const magnitude = Math.sqrt(meanX * meanX + meanY * meanY + meanZ * meanZ);
        rawSamplesRef.current = [...rawSamplesRef.current, magnitude].slice(-FFT_SAMPLES);

        if (rawSamplesRef.current.length >= FFT_SAMPLES) {
          const dcOffset = rawSamplesRef.current.reduce((a, b) => a + b, 0) / FFT_SAMPLES;
          const zeroCentered = rawSamplesRef.current.map(v => v - dcOffset);

          const windowed = zeroCentered.map((v, i) =>
            v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SAMPLES - 1)))
          );

          const rawMagnitudes = performFFT(windowed);
          
          // DISPLAY smoothing: heavy (80/20) so the purple graph is beautiful and stable
          if (displayMagnitudesRef.current.length !== rawMagnitudes.length) {
            displayMagnitudesRef.current = [...rawMagnitudes];
          } else {
            displayMagnitudesRef.current = rawMagnitudes.map((m, i) =>
              (displayMagnitudesRef.current[i] * 0.8) + (m * 0.2)
            );
          }
          
          setFftData(displayMagnitudesRef.current.map((m, i) => ({ 
            freq: parseFloat((i * FREQ_PER_BIN).toFixed(1)), 
            magnitude: parseFloat(m.toFixed(4)) 
          })));

          // Peak detection on RAW magnitudes (not smoothed) for responsiveness
          let maxMag = 0;
          let peakBin = 0;
          for (let i = 2; i < rawMagnitudes.length; i++) {
            if (rawMagnitudes[i] > maxMag) { maxMag = rawMagnitudes[i]; peakBin = i; }
          }
          setPeakFreq(parseFloat((peakBin * FREQ_PER_BIN).toFixed(2)));

          // ── OMA Integrity Score ──────────────────────────
          const rmsEnergy = Math.sqrt(zeroCentered.reduce((a, b) => a + b * b, 0) / FFT_SAMPLES);
          
          // With gravity-free acceleration: resting phone RMS ≈ 0.01-0.02
          // Noise floor = 0.03 (just above sensor noise)
          const cleanRMS = Math.max(0, rmsEnergy - 0.03);
          // Ultra sensitive: 0.1 above noise = 15 point drop
          const energyPenalty = Math.min(90, cleanRMS * 150);
          
          let freqPenalty = 0;
          const baseline = baselineFreqRef.current;
          if (baseline !== null && baseline > 0) {
            const shiftHz = Math.abs(peakBin * FREQ_PER_BIN - baseline);
            setModalShift(parseFloat(((shiftHz / baseline) * 100).toFixed(1)));
            freqPenalty = Math.min(90, shiftHz * 25);
          }
          
          const targetIndex = Math.max(5, Math.round(100 - Math.max(energyPenalty, freqPenalty)));
          
          // 65/35 gauge: responsive in ~0.3s, no flickering
          setHealthIndex(prev => {
            const smoothed = (prev * 0.65) + (targetIndex * 0.35);
            const rounded = Math.round(smoothed);
            if (rounded > 80) setStatus("healthy");
            else if (rounded > 40) setStatus("vulnerable");
            else setStatus("danger");
            return rounded;
          });
        }
      }
    }, 50); // 20 Hz

    return () => { clearInterval(pollInterval); socket.disconnect(); };
  }, []);

  // Keep the ref in sync with state
  useEffect(() => {
    baselineFreqRef.current = baselineFreq;
  }, [baselineFreq]);

  const kickNode = (id: string) => {
    if (socketRef.current) {
      socketRef.current.emit("kick_node", id);
      delete activeSensorsRef.current[id];
    }
  };

  const setBaseline = () => {
    if (fftData.length === 0) return;
    // Find the peak bin, skipping the first 2 bins (DC + sub-Hz noise)
    let best = { freq: 0, magnitude: 0 };
    for (const bin of fftData) {
      if (bin.freq > 0.5 && bin.magnitude > best.magnitude) {
        best = bin;
      }
    }
    setBaselineFreq(best.freq);
    baselineFreqRef.current = best.freq;
    setHealthIndex(100);
    setModalShift(0);
    setStatus("healthy");
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
            <Radio className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Structural Health Monitor</h1>
            <p className="text-zinc-500 text-sm flex items-center gap-2 mt-1">
              <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
              {isConnected ? (
                <>
                  <span className="text-green-400 font-bold">{activeNodeCount}</span> Active Sensor Node{activeNodeCount !== 1 && 's'}
                </>
              ) : "Searching for Sensor..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <Bell className="w-5 h-5 text-zinc-400" />
          </button>
          <button className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <Settings className="w-5 h-5 text-zinc-400" />
          </button>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-full flex items-center justify-center font-bold text-xs">NS</div>
            <span className="text-sm font-medium">Navpreet</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Metrics & Health */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {/* Health Index Card */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] group-hover:bg-blue-500/20 transition-all" />
            
            <div className="flex justify-between items-start mb-8 text-zinc-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium uppercase tracking-widest">OMA Integrity Score</span>
              </div>
              <Activity className="w-5 h-5" />
            </div>

            <div className="flex flex-col items-center py-4">
              <div className="relative flex items-center justify-center">
                {/* Gauge Circle */}
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                  <motion.circle
                    cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent"
                    strokeDasharray={502}
                    initial={{ strokeDashoffset: 502 }}
                    animate={{ strokeDashoffset: 502 - (502 * healthIndex) / 100 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn(
                      "transition-colors duration-500",
                      status === "healthy" ? "text-green-500" : status === "vulnerable" ? "text-yellow-500" : "text-red-500"
                    )}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-6xl font-black italic">{healthIndex}%</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">
                    Modal Shift: {modalShift.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-3">
                {status === "healthy" ? (
                  <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full border border-green-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Status: Optimal</span>
                  </div>
                ) : status === "vulnerable" ? (
                  <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full border border-yellow-500/20">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Status: Warning</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-4 py-2 rounded-full border border-red-500/20 animate-pulse">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Status: Critical</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Metrics Card */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Live Modal Parameters</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Dominant Frequency</span>
                <span className="text-sm font-bold text-blue-400 font-mono">{peakFreq} Hz</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Baseline Frequency</span>
                <span className="text-sm font-bold text-cyan-400 font-mono">{baselineFreq ? `${baselineFreq} Hz` : "Not Set"}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Modal Shift</span>
                <span className={cn(
                  "text-sm font-bold font-mono",
                  modalShift < 5 ? "text-green-400" : modalShift < 20 ? "text-yellow-400" : "text-red-400"
                )}>{modalShift.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Active Nodes</span>
                <span className="text-sm font-bold text-green-400 font-mono">{activeNodeCount}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Device Controls</h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={setBaseline}
                className="flex flex-col items-center gap-3 p-6 bg-blue-600 rounded-3xl hover:bg-blue-500 transition-all font-bold group shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)]"
              >
                <RefreshCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                <span className="text-xs uppercase tracking-tighter">Calibrate Baseline</span>
              </button>
              <button className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all">
                <BarChart3 className="w-6 h-6 text-zinc-400" />
                <span className="text-xs uppercase tracking-tighter text-zinc-400">Export Analysis</span>
              </button>
            </div>
            {baselineFreq && (
              <p className="mt-4 text-[10px] text-zinc-600 text-center uppercase tracking-widest">
                Baseline Resonant Freq: <span className="text-blue-400">{baselineFreq} Hz</span>
              </p>
            )}
          </div>

          {/* Node Management Card */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Mesh Network Management</h3>
            {activeNodeIds.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4 border border-white/5 rounded-xl border-dashed">No active nodes connected</p>
            ) : (
              <div className="space-y-3">
                {activeNodeIds.map(id => (
                  <div key={id} className="flex justify-between items-center bg-black/50 border border-white/10 rounded-xl p-3 px-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-mono text-zinc-300">Node_{id.substring(0,6)}</span>
                    </div>
                    <button 
                      onClick={() => kickNode(id)}
                      className="text-[10px] font-bold text-red-400 bg-red-400/10 hover:bg-red-400/20 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wider"
                    >
                      Eject
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visualization Charts */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Real-time Waves */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 h-[380px] relative">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <Waves className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-bold">Vibration Time-Series</h3>
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase bg-white/5 px-3 py-1 rounded-lg">Live Stream</div>
            </div>
            
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} stroke="#333" fontSize={10} width={35} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="x" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} name="X (Lateral)" />
                  <Line type="monotone" dataKey="y" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} name="Y (Longitudinal)" />
                  <Line type="monotone" dataKey="z" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} name="Z (Vertical)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FFT Frequency Analysis */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 h-[380px]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-purple-500" />
                <h3 className="text-lg font-bold">FFT Spectral Density</h3>
              </div>
              <div className="flex items-center gap-3">
                {baselineFreq && (
                  <div className="text-[10px] font-bold text-cyan-400 uppercase bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/20">
                    Baseline: {baselineFreq} Hz
                  </div>
                )}
                <div className="text-[10px] font-bold text-zinc-500 uppercase bg-white/5 px-3 py-1 rounded-lg">Frequency Domain</div>
              </div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fftData}>
                  <defs>
                    <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                  <XAxis dataKey="freq" stroke="#333" fontSize={10} tickFormatter={(v) => `${v}`} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    labelFormatter={(label) => `${label} Hz`}
                    contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "12px", fontSize: "12px" }}
                    itemStyle={{ color: "#A855F7" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="magnitude" 
                    stroke="#A855F7" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorFreq)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 text-[10px] text-zinc-600 uppercase tracking-widest">
              X-Axis: Frequency (Hz) — Bin Resolution: {FREQ_PER_BIN.toFixed(2)} Hz | Peak: <span className="text-purple-400">{peakFreq} Hz</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
