interface Props {
  method: "GCASH" | "MAYA";
  size?: number;
}

export function QrPlaceholder({ method, size = 224 }: Props) {
  const isGcash = method === "GCASH";
  const color   = isGcash ? "#1d4ed8" : "#16a34a";
  const label   = isGcash ? "GCash" : "Maya";

  return (
    <svg width={size} height={size} viewBox="0 0 224 224" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="224" height="224" fill="white" />
      <rect x="16" y="16" width="56" height="56" rx="4" fill={color} />
      <rect x="24" y="24" width="40" height="40" rx="2" fill="white" />
      <rect x="32" y="32" width="24" height="24" rx="1" fill={color} />
      <rect x="152" y="16" width="56" height="56" rx="4" fill={color} />
      <rect x="160" y="24" width="40" height="40" rx="2" fill="white" />
      <rect x="168" y="32" width="24" height="24" rx="1" fill={color} />
      <rect x="16" y="152" width="56" height="56" rx="4" fill={color} />
      <rect x="24" y="160" width="40" height="40" rx="2" fill="white" />
      <rect x="32" y="168" width="24" height="24" rx="1" fill={color} />
      {[
        [88,16],[96,16],[104,16],[112,16],[120,16],[128,16],[136,16],
        [88,24],[104,24],[120,24],[136,24],
        [88,32],[96,32],[112,32],[128,32],[136,32],
        [88,40],[104,40],[120,40],
        [88,48],[96,48],[104,48],[112,48],[128,48],[136,48],
        [16,88],[24,88],[40,88],[48,88],[56,88],[72,88],
        [152,88],[168,88],[184,88],[200,88],[208,88],
        [16,96],[48,96],[72,96],[152,96],[184,96],[208,96],
        [16,104],[24,104],[32,104],[56,104],[64,104],[72,104],[152,104],[168,104],[176,104],[192,104],[208,104],
        [16,112],[48,112],[64,112],[72,112],[152,112],[160,112],[176,112],[200,112],
        [16,120],[32,120],[48,120],[56,120],[72,120],[160,120],[168,120],[184,120],[200,120],[208,120],
        [16,128],[24,128],[32,128],[48,128],[64,128],[152,128],[168,128],[184,128],
        [16,136],[40,136],[64,136],[72,136],[152,136],[160,136],[176,136],[192,136],[208,136],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="8" height="8" fill={color} />
      ))}
      <rect x="76" y="148" width="72" height="28" rx="14" fill={color} />
      <text x="112" y="167" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </svg>
  );
}
