import React from 'react';

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label, value, onChange, prefix, suffix, placeholder, type = 'number', min, max, step
}) => {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: '600',
        color: '#8e8e93',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>{label}</label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'white',
        borderRadius: '12px',
        padding: '0 14px',
        border: '1px solid #e5e5ea',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {prefix && <span style={{ color: '#8e8e93', fontSize: '17px', marginRight: '6px', fontWeight: '500' }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '17px',
            padding: '14px 0',
            background: 'transparent',
            color: '#1c1c1e',
            fontFamily: 'inherit',
          }}
        />
        {suffix && <span style={{ color: '#8e8e93', fontSize: '17px', marginLeft: '6px', fontWeight: '500' }}>{suffix}</span>}
      </div>
    </div>
  );
};

export default InputField;
