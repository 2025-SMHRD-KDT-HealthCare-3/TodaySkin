const CYCLE_DURATION = 3200; // ms — bloom in + hold + fade out, then restart

function LoadingScreen({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("피부 이미지를 읽고 있어요");
  const [cycle, setCycle] = useState(0);
  const doneRef = useRef(false);

  // Progress counter
  useEffect(() => {
    const msgs = [
      { at:0, text:"분석을 위해 피부 이미지를 정밀하게 스캔하고 있어요" },
      { at:25, text:"피부 표면의 세부 특징들을 탐색하고 있어요" },
      { at:50, text:"추출된 데이터를 바탕으로 집중 분석을 진행 중이에요" },
      { at:75, text:"분석된 정보를 종합하여 컨디션을 체크하고 있어요" },
      { at:95, text:"당신만을 위한 맞춤형 결과를 정리하고 있어요" },
    ];
    const interval = setInterval(() => {
      setProgress(p => {
        const next = Math.min(p + 1, 100);
        const msg = [...msgs].reverse().find(m => next >= m.at);
        if (msg) setStatusText(msg.text);
        if (next >= 100 && !doneRef.current) {
          doneRef.current = true;
          clearInterval(interval);
          setTimeout(() => onDone?.(), 800);
        }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [onDone]);

  // Cycle the flower animation by remounting the SVG via key change
  useEffect(() => {
    if (doneRef.current) return;
    const timer = setInterval(() => {
      if (!doneRef.current) setCycle(c => c + 1);
    }, CYCLE_DURATION);
    return () => clearInterval(timer);
  }, []);

  const petals = [
    { angle:0,   delay:0.0,  color:`${T.cta}CC` },
    { angle:45,  delay:0.08, color:`${T.secondary}CC` },
    { angle:90,  delay:0.16, color:`${T.cta}99` },
    { angle:135, delay:0.24, color:`${T.accent}BB` },
    { angle:180, delay:0.32, color:`${T.cta}CC` },
    { angle:225, delay:0.40, color:`${T.secondary}BB` },
    { angle:270, delay:0.48, color:`${T.cta}99` },
    { angle:315, delay:0.56, color:`${T.accent}CC` },
  ];

  // Animation durations inside one cycle:
  // Outer petals bloom: 0–1.0s (staggered 0–0.56s start, 0.8s each)
  // Inner petals bloom: 0.6–1.6s
  // Center: 1.2–1.6s
  // Hold: 1.6–2.2s
  // Fade out entire SVG: 2.2–3.0s (via wrapper opacity)
  // Gap: 3.0–3.2s

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background: `linear-gradient(160deg, ${T.bgMain} 0%, ${T.bgSub} 100%)`,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    }}>
      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position:"absolute",
          width: 6 + i * 2, height: 6 + i * 2,
          borderRadius:"50%",
          background: [T.cta, T.secondary, T.accent, T.positive, T.nav, T.cta][i],
          opacity:0.15,
          left: `${15 + i * 14}%`,
          bottom: `${20 + (i%3)*20}%`,
          animation: `floatUp ${3 + i*0.5}s ${i*0.8}s ease-in infinite`,
        }}/>
      ))}

      {/* Flower — key={cycle} forces remount → restarts all CSS animations */}
      <div key={cycle} style={{
        marginBottom: 40,
        animation: `flowerCycle ${CYCLE_DURATION}ms ease both`,
      }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ overflow:"visible" }}>
          {/* Outer petals */}
          {petals.map((p, i) => {
            const rad = (p.angle - 90) * Math.PI / 180;
            const cx = 70 + Math.cos(rad) * 30;
            const cy = 70 + Math.sin(rad) * 30;
            return (
              <g key={i} style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: `petalScale 0.8s ${p.delay}s cubic-bezier(0.34,1.56,0.64,1) both`,
              }}>
                <ellipse cx={cx} cy={cy} rx="14" ry="24"
                  fill={p.color}
                  transform={`rotate(${p.angle}, ${cx}, ${cy})`}/>
              </g>
            );
          })}
          {/* Inner petals */}
          {petals.map((p, i) => {
            const offsetAngle = p.angle + 22.5;
            const rad = (offsetAngle - 90) * Math.PI / 180;
            const cx = 70 + Math.cos(rad) * 18;
            const cy = 70 + Math.sin(rad) * 18;
            return (
              <g key={`inner-${i}`} style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: `petalScale 0.7s ${p.delay + 0.5}s cubic-bezier(0.34,1.56,0.64,1) both`,
              }}>
                <ellipse cx={cx} cy={cy} rx="10" ry="17"
                  fill={p.color} opacity="0.5"
                  transform={`rotate(${offsetAngle}, ${cx}, ${cy})`}/>
              </g>
            );
          })}
          {/* Center */}
          <circle cx="70" cy="70" r="12" fill={T.accent}
            style={{ transformOrigin:"70px 70px", animation:"petalScale 0.6s 1.0s ease both" }}/>
          <circle cx="70" cy="70" r="6" fill={`${T.accent}88`}
            style={{ transformOrigin:"70px 70px", animation:"petalScale 0.5s 1.2s ease both" }}/>
        </svg>
      </div>

      {/* Status */}
      <div style={{ textAlign:"center", animation:"fadeIn 0.8s 0.3s ease both", opacity:0 }}>
        <p style={{
          fontSize:16, color:T.title, fontWeight:500, marginBottom:6,
          fontFamily:"'Noto Serif KR',serif",
        }}>AI가 피부를 분석 중이에요</p>
        <p style={{ fontSize:13, color:T.textLight, marginBottom:24, minHeight:20 }}>
          {statusText}
          <span style={{ animation:"dotPulse 1.5s infinite" }}>...</span>
        </p>

        {/* Progress bar */}
        <div style={{ width:200, height:4, background:T.border, borderRadius:4, overflow:"hidden", margin:"0 auto" }}>
          <div style={{
            height:"100%", background:`linear-gradient(90deg, ${T.cta}, ${T.accent})`,
            borderRadius:4, transition:"width 0.3s ease",
            width:`${progress}%`,
          }}/>
        </div>
        <span style={{ fontSize:11, color:T.textLight, marginTop:8, display:"block" }}>{progress}%</span>
      </div>
    </div>
  );
}