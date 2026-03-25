import React, { useEffect, useState } from 'react';


interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  variant?: 'signin' | 'workspace' | 'overlay' | 'logout';
  steps?: string[];
}


/**
 * AquaNex LoadingScreen
 *
 * Variants:
 *   'signin'    — full page, bouncing drops + progress bar (use during login)
 *   'workspace' — full page, pipeline animation + step checklist (use when loading a workspace)
 *   'overlay'   — fixed overlay on top of existing page, ripple rings (use for quick transitions)
 *   'logout'    — full page, draining drops + farewell message (use during logout)
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message,
  submessage,
  variant = 'signin',
  steps,
}) => {
  const [visibleSteps, setVisibleSteps] = useState(0);


  const defaultSteps = steps ?? [
    'Workspace verified',
    'Sensor zones loaded',
    'Dashboard ready',
  ];


  useEffect(() => {
    if (variant !== 'workspace') return;
    setVisibleSteps(0);
    const timers = defaultSteps.map((_, i) =>
      setTimeout(() => setVisibleSteps(i + 1), (i + 1) * 700)
    );
    return () => timers.forEach(clearTimeout);
  }, [variant]);


  const defaults = {
    signin:    { msg: 'Signing you in…',         sub: 'Verifying your credentials' },
    workspace: { msg: 'Loading your workspace…', sub: 'Fetching sensors and zone data' },
    overlay:   { msg: 'Accessing workspace…',    sub: 'Setting up your dashboard' },
    logout:    { msg: 'Signing you out…',         sub: 'Clearing your session securely' },
  };


  const displayMessage    = message    ?? defaults[variant].msg;
  const displaySubmessage = submessage ?? defaults[variant].sub;


  // ── Sign-in ──────────────────────────────────────────────────────────────
  if (variant === 'signin') {
    return (
      <div className="relative min-h-screen flex items-center justify-center
        bg-[radial-gradient(ellipse_at_top_left,_#ecfeff_0%,_#f0fdfa_35%,_#e0f2fe_70%,_#f8fafc_100%)]
        dark:bg-[radial-gradient(ellipse_at_top_left,_#042f2e_0%,_#0c1a2e_40%,_#061220_70%,_#020d18_100%)]">


        <div className="relative w-80 bg-white/70 dark:bg-slate-900/70
          border border-cyan-200/80 dark:border-cyan-800/40
          rounded-2xl shadow-2xl shadow-cyan-100/60 dark:shadow-cyan-950/60
          p-10 backdrop-blur-xl flex flex-col items-center gap-5">


          {/* animated top accent bar */}
          <div className="absolute top-0 left-8 right-8 h-[3px] rounded-full opacity-80
            bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500
            [background-size:200%_100%] animate-shimmer" />


          {/* bouncing water drops */}
          <div className="flex gap-2 items-end h-5">
            {[
              { color: '#22d3ee', delay: '0s' },
              { color: '#14b8a6', delay: '0.2s' },
              { color: '#0891b2', delay: '0.4s' },
            ].map(({ color, delay }, i) => (
              <span
                key={i}
                className="block animate-dropBounce"
                style={{ animationDelay: delay }}
              >
                <svg viewBox="0 0 10 14" className="w-2.5 h-3.5">
                  <path
                    d="M5 0 C5 0 0 6 0 9 a5 5 0 0 0 10 0 C10 6 5 0 5 0z"
                    fill={color}
                  />
                </svg>
              </span>
            ))}
          </div>


          {/* text */}
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-1
              bg-gradient-to-r from-cyan-600 via-teal-500 to-cyan-700
              dark:from-cyan-300 dark:via-teal-300 dark:to-cyan-400
              bg-clip-text text-transparent">
              {displayMessage}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {displaySubmessage}
            </p>
          </div>


          {/* progress bar */}
          <div className="w-44 h-[3px] rounded-full overflow-hidden
            bg-cyan-100/60 dark:bg-cyan-900/40">
            <div className="h-full rounded-full
              bg-gradient-to-r from-cyan-400 to-teal-500
              animate-progressFlow" />
          </div>
        </div>
      </div>
    );
  }


  // ── Workspace ────────────────────────────────────────────────────────────
  if (variant === 'workspace') {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center gap-10
        bg-[radial-gradient(ellipse_at_top_left,_#ecfeff_0%,_#f0fdfa_35%,_#e0f2fe_70%,_#f8fafc_100%)]
        dark:bg-[radial-gradient(ellipse_at_top_left,_#042f2e_0%,_#0c1a2e_40%,_#061220_70%,_#020d18_100%)]">


        {/* pipeline */}
        <div className="flex items-center">
          {[<HouseIcon />, <MonitorIcon />, <UsersIcon />].map((icon, i) => (
            <React.Fragment key={i}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
                bg-white/80 dark:bg-slate-900/80 border-[1.5px] transition-all duration-500
                ${i === 0
                  ? 'border-cyan-400 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]'
                  : 'border-cyan-200/50 dark:border-cyan-800/40'}`}>
                {icon}
              </div>
              {i < 2 && (
                <div className="relative w-10 h-1 mx-1 overflow-hidden
                  bg-cyan-100/60 dark:bg-cyan-900/30 rounded-full">
                  <div
                    className="absolute top-0 h-full w-1/2 rounded-full
                      bg-gradient-to-r from-transparent via-cyan-400 to-teal-400
                      animate-pipeFlow"
                    style={{ animationDelay: `${i * 0.35}s` }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>


        {/* text + step checklist */}
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-1
            bg-gradient-to-r from-cyan-600 via-teal-500 to-cyan-700
            dark:from-cyan-300 dark:via-teal-300 dark:to-cyan-400
            bg-clip-text text-transparent">
            {displayMessage}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {displaySubmessage}
          </p>


          <div className="flex flex-col gap-3 w-56 mx-auto">
            {defaultSteps.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400
                  transition-all duration-500
                  ${visibleSteps > i
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-3'}`}
              >
                <span className="w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-cyan-400 to-teal-500 shadow-sm shadow-cyan-300/40">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 10 10"
                    fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1.5,5 4,7.5 8.5,2.5" />
                  </svg>
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }


  // ── Logout ───────────────────────────────────────────────────────────────
  if (variant === 'logout') {
    return (
      <div className="relative min-h-screen flex items-center justify-center
        bg-[radial-gradient(ellipse_at_bottom_right,_#ecfeff_0%,_#f0fdfa_35%,_#e0f2fe_70%,_#f8fafc_100%)]
        dark:bg-[radial-gradient(ellipse_at_bottom_right,_#042f2e_0%,_#0c1a2e_40%,_#061220_70%,_#020d18_100%)]">


        <div className="relative w-80 bg-white/70 dark:bg-slate-900/70
          border border-cyan-200/80 dark:border-cyan-800/40
          rounded-2xl shadow-2xl shadow-cyan-100/60 dark:shadow-cyan-950/60
          p-10 backdrop-blur-xl flex flex-col items-center gap-5">


          {/* animated bottom accent bar (draining feel — bottom instead of top) */}
          <div className="absolute bottom-0 left-8 right-8 h-[3px] rounded-full opacity-80
            bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-400
            [background-size:200%_100%] animate-shimmer" />


          {/* draining water drops — fade out downward */}
          <div className="flex gap-2 items-end h-5">
            {[
              { color: '#22d3ee', delay: '0s' },
              { color: '#14b8a6', delay: '0.2s' },
              { color: '#0891b2', delay: '0.4s' },
            ].map(({ color, delay }, i) => (
              <span
                key={i}
                className="block animate-dropDrain"
                style={{ animationDelay: delay }}
              >
                <svg viewBox="0 0 10 14" className="w-2.5 h-3.5">
                  <path
                    d="M5 0 C5 0 0 6 0 9 a5 5 0 0 0 10 0 C10 6 5 0 5 0z"
                    fill={color}
                  />
                </svg>
              </span>
            ))}
          </div>


          {/* text */}
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-1
              bg-gradient-to-r from-cyan-600 via-teal-500 to-cyan-700
              dark:from-cyan-300 dark:via-teal-300 dark:to-cyan-400
              bg-clip-text text-transparent">
              {displayMessage}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {displaySubmessage}
            </p>
          </div>


          {/* draining progress bar — animates right to left */}
          <div className="w-44 h-[3px] rounded-full overflow-hidden
            bg-cyan-100/60 dark:bg-cyan-900/40">
            <div className="h-full rounded-full
              bg-gradient-to-l from-cyan-400 to-teal-500
              animate-progressDrain" />
          </div>
        </div>
      </div>
    );
  }


  // ── Overlay ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5
      bg-cyan-50/90 dark:bg-slate-950/90 backdrop-blur-md">


      {/* ripple rings */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        {[
          { size: 80, delay: '0s' },
          { size: 60, delay: '0.5s' },
          { size: 40, delay: '1s' },
        ].map(({ size, delay }, i) => (
          <span
            key={i}
            className="absolute rounded-full border-2 border-cyan-400/50 animate-ripple"
            style={{ width: size, height: size, animationDelay: delay }}
          />
        ))}
        <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center
          bg-gradient-to-br from-cyan-400 to-teal-500 shadow-lg shadow-cyan-300/40
          dark:shadow-cyan-900/50">
          <WaterIcon />
        </div>
      </div>


      {/* text */}
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-1
          bg-gradient-to-r from-cyan-600 via-teal-500 to-cyan-700
          dark:from-cyan-300 dark:via-teal-300 dark:to-cyan-400
          bg-clip-text text-transparent">
          {displayMessage}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {displaySubmessage}
        </p>
      </div>


      {/* pulsing dots */}
      <div className="flex gap-2">
        {['0s', '0.2s', '0.4s'].map((delay, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-cyan-400 animate-dotPulse"
            style={{ animationDelay: delay }}
          />
        ))}
      </div>
    </div>
  );
};


// ── Icon helpers ──────────────────────────────────────────────────────────────


const HouseIcon = () => (
  <svg className="w-6 h-6 text-cyan-500" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);


const MonitorIcon = () => (
  <svg className="w-6 h-6 text-teal-500" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path strokeLinecap="round" d="M8 21h8M12 17v4" />
  </svg>
);


const UsersIcon = () => (
  <svg className="w-6 h-6 text-cyan-600" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path strokeLinecap="round"
      d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);


const WaterIcon = () => (
  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 2c0 0-7 8-7 13a7 7 0 0014 0c0-5-7-13-7-13z" />
  </svg>
);


export default LoadingScreen;
