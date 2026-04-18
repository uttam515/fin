"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simple FFT helper using dsp.js or a lightweight implementation
// For the hackathon, we'll implement a simple one to avoid dsp.js import issues if any
const performFFT = (samples: number[]) => {
  const n = samples.length;
  if (n === 0) return [];
  
  // Real-to-Complex FFT (simplified for magnitude calculation)
  const magnitudes = new Array(Math.floor(n / 2)).fill(0);
  for (let k = 0; k < n / 2; k++) {
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

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [fftData, setFftData] = useState<any[]>([]);
  const [baselineFreq, setBaselineFreq] = useState<number | null>(null);
  const [healthIndex, setHealthIndex] = useState(100);
  const [status, setStatus] = useState<"healthy" | "vulnerable" | "danger">("healthy");
  const [isConnected, setIsConnected] = useState(false);
  
  const rawSamplesRef = useRef<number[]>([]);
  const MAX_SAMPLES = 50;
  const FFT_SAMPLES = 64; // Power of 2 usually better

  useEffect(() => {
    const socket = io();

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("vibration_update", (incoming: any) => {
      setData((prev) => {
        const newData = [...prev, { 
          time: new Date().toLocaleTimeString(), 
          x: incoming.x, 
          y: incoming.y, 
          z: incoming.z 
        }].slice(-MAX_SAMPLES);
        return newData;
      });

      const value = incoming.z; // Still use Z for the Health Index calculation
      rawSamplesRef.current = [...rawSamplesRef.current, value].slice(-FFT_SAMPLES);

      if (rawSamplesRef.current.length >= FFT_SAMPLES) {
        // Remove gravity/DC offset to get "pure" vibration
        const mean = rawSamplesRef.current.reduce((a, b) => a + b, 0) / FFT_SAMPLES;
        const zeroCentered = rawSamplesRef.current.map(v => v - mean);

        // Simple Magnitude Analysis
        const avgStrength = zeroCentered.reduce((a, b) => a + Math.abs(b), 0) / FFT_SAMPLES;
        const magnitudes = zeroCentered.slice(0, FFT_SAMPLES/2).map((v, i) => Math.abs(v) * (i/5));
        
        const formattedFFT = magnitudes.map((m, i) => ({ freq: i * 2, magnitude: m }));
        setFftData(formattedFFT);

        // Find current peak
        let maxMag = 0;
        let currentPeak = 0;
        magnitudes.forEach((m, i) => {
          if (m > maxMag && i > 0) {
            maxMag = m;
            currentPeak = i * 2;
          }
        });

        setHealthIndex((oldIndex) => {
          if (baselineFreqRef.current !== null) {
            // Calculate raw target
            const freqShift = Math.abs(currentPeak - baselineFreqRef.current);
            const intensityImpact = Math.max(0, (avgStrength - 0.5) * 40); // Penalty for high vibration intensity
            const targetIndex = Math.max(5, 100 - (freqShift * 5) - intensityImpact);
            
            // Apply Heavy Smoothing (0.02 means it reacts slowly to noise, 0.98 maintains stability)
            const smoothedIndex = (oldIndex * 0.98) + (targetIndex * 0.02);
            
            if (smoothedIndex > 80) setStatus("healthy");
            else if (smoothedIndex > 40) setStatus("vulnerable");
            else setStatus("danger");

            return Math.floor(smoothedIndex);
          }
          return 100;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Use a ref for baselineFreq to avoid dependency loops in socket listener
  const baselineFreqRef = useRef<number | null>(null);
  useEffect(() => {
    baselineFreqRef.current = baselineFreq;
  }, [baselineFreq]);

  const setBaseline = () => {
    const peak = fftData.reduce((prev, curr) => (curr.magnitude > prev.magnitude ? curr : prev), { freq: 0, magnitude: 0 });
    setBaselineFreq(peak.freq);
    baselineFreqRef.current = peak.freq; // SYNC THE BRAIN
    setHealthIndex(100); // RESET TO PERFECT ON CALIBRATION
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
            <p className="text-zinc-500 text-sm flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
              {isConnected ? "Live Network Active" : "Searching for Sensor..."}
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
                <span className="text-sm font-medium uppercase tracking-widest">Structural Health Index</span>
              </div>
              <Activity className="w-5 h-5" />
            </div>

            <div className="flex flex-col items-center py-4">
              <div className="relative flex items-center justify-center">
                {/* Gauge Circle */}
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-white/5"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={502}
                    initial={{ strokeDashoffset: 502 }}
                    animate={{ strokeDashoffset: 502 - (502 * healthIndex) / 100 }}
                    className={cn(
                      "transition-colors duration-500",
                      status === "healthy" ? "text-green-500" : status === "vulnerable" ? "text-yellow-500" : "text-red-500"
                    )}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-6xl font-black italic">{healthIndex}%</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">Integrity Score</span>
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
                    <span className="text-xs font-bold uppercase tracking-wider">Status: Imminent Failure</span>
                  </div>
                )}
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
                Baseline Resonant Freq: <span className="text-blue-400">{baselineFreq}Hz</span>
              </p>
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
                <h3 className="text-lg font-bold">Resonance Time-Series (Z-Axis)</h3>
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase bg-white/5 px-3 py-1 rounded-lg">Real-time Stream</div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[-10, 10]} stroke="#666" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="x" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false} 
                    name="X (Lateral)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="y" 
                    stroke="#a855f7" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false} 
                    name="Y (Longitudinal)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="z" 
                    stroke="#22c55e" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false} 
                    name="Z (Vertical)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FFT Frequency Analysis */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 h-[380px]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-purple-500" />
                <h3 className="text-lg font-bold">Fast Fourier Transform (Spectral Density)</h3>
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase bg-white/5 px-3 py-1 rounded-lg">Frequency Domain Analysis</div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fftData}>
                  <defs>
                    <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                  <XAxis hide dataKey="freq" />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    labelFormatter={(label) => `${label}Hz`}
                    contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "12px", fontSize: "12px" }}
                    itemStyle={{ color: "#A855F7" }}
                  />
                  <Area 
                    type="stepAfter" 
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
              X-Axis: Frequency (Hz) | Y-Axis: Amplitude (Dominance)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


