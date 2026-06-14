import React from 'react';

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  format?: (v: number) => string;
  color?: string;
}

const SliderInput: React.FC<SliderInputProps> = ({
  label, value, onChange, min, max, step, prefix, suffix, format, color = '#007AFF'
}) => {
  const display = format ? format(value) : `${prefix || ''}${value.toLocaleString()}${suffix || ''}`;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</label>
        <span style={{ fontSize: '15px', fontWeight: '700', color }}>{display}</span>
      </div>
      <div style={{ position: 'relative', height: '28px', display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          height: '4px',
          background: '#e5e5ea',
          borderRadius: '2px',
        }} />
        <div style={{
          position: 'absolute',
          left: 0,
          width: `${pct}%`,
          height: '4px',
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: '2px',
        }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute',
            left: 0, right: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            zIndex: 1,
          }}
        />
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 12px)`,
          width: '24px',
          height: '24px',
          background: 'white',
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          border: `3px solid ${color}`,
          pointerEvents: 'none',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', color: '#aeaeb2' }}>{prefix}{min.toLocaleString()}{suffix}</span>
        <span style={{ fontSize: '11px', color: '#aeaeb2' }}>{prefix}{max.toLocaleString()}{suffix}</span>
      </div>
    </div>
  );
};

export default SliderInput;
