import React from 'react';

export function Logo({ size = 18 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="qcg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#14B8A6" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        {/* paperclip */}
        <path
          d="M14.5 6.5l-6 6a3 3 0 104.243 4.243l6.364-6.364a5 5 0 10-7.07-7.071L4.5 10.5"
          stroke="url(#qcg)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* speed lines */}
        <path d="M3 7h3M2 11h3M3 15h3" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="font-semibold tracking-tight">
        Quick<span className="text-qc-accent">Clip</span>
      </span>
    </div>
  );
}
