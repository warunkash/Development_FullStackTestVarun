import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  gradient: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, onBack, gradient }) => {
  return (
    <div style={{
      background: gradient,
      padding: '50px 20px 24px',
      color: 'white',
      position: 'relative',
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: '50px',
            left: '16px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '20px',
            color: 'white',
            padding: '6px 14px 6px 10px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backdropFilter: 'blur(10px)',
          }}
        >
          ‹ Home
        </button>
      )}
      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: onBack ? '30px' : '0',
        textShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}>{title}</h1>
      {subtitle && (
        <p style={{
          textAlign: 'center',
          opacity: 0.85,
          fontSize: '14px',
          marginTop: '4px',
        }}>{subtitle}</p>
      )}
    </div>
  );
};

export default Header;
