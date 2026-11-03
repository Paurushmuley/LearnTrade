'use client';

import React from 'react';
import { FastForward, Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react';

interface ReplayControlBarProps {
  isPlaying: boolean;
  speed: 1 | 2 | 5 | 10;
  currentIndex: number;
  totalCandles: number;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onRewindToStart: () => void;
  onChangeSpeed: (speed: 1 | 2 | 5 | 10) => void;
  onScrub: (index: number) => void;
  onExitReplay: () => void;
}

export const ReplayControlBar: React.FC<ReplayControlBarProps> = ({
  isPlaying,
  speed,
  currentIndex,
  totalCandles,
  onTogglePlay,
  onStepForward,
  onRewindToStart,
  onChangeSpeed,
  onScrub,
  onExitReplay,
}) => {
  const speeds: (1 | 2 | 5 | 10)[] = [1, 2, 5, 10];

  return (
    <div className="bg-[#0F141F] border border-blue-600/50 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-blue-900/20 text-xs animate-in slide-in-from-top-2">
      {/* Playhead Badge & Status */}
      <div className="flex items-center gap-2">
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
        </span>
        <div className="font-sans">
          <span className="font-bold text-slate-100 flex items-center gap-1.5">
            Bar Replay Mode Active
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Bar {currentIndex + 1} of {totalCandles} (Future bars shielded)
          </span>
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onRewindToStart}
          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition"
          title="Rewind to beginning of replay"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onTogglePlay}
          className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition shadow-md ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
          }`}
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-white" />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <button
          onClick={onStepForward}
          disabled={isPlaying || currentIndex >= totalCandles - 1}
          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 rounded-lg border border-slate-700 font-medium flex items-center gap-1 transition"
          title="Step 1 bar forward"
        >
          <SkipForward className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-[11px]">Step</span>
        </button>

        {/* Speed Toggles */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 ml-1">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                speed === s
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber Slider */}
      <div className="flex items-center gap-2 flex-1 max-w-xs min-w-[120px]">
        <input
          type="range"
          min={5}
          max={Math.max(6, totalCandles - 1)}
          value={currentIndex}
          onChange={(e) => onScrub(parseInt(e.target.value, 10))}
          className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
        />
      </div>

      {/* Exit Button */}
      <button
        onClick={onExitReplay}
        className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 rounded-lg border border-slate-800 transition flex items-center gap-1 text-[11px]"
      >
        <X className="h-3.5 w-3.5" />
        <span>Exit Replay</span>
      </button>
    </div>
  );
};
