import React from 'react';

interface ResultItem {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}

interface ResultCardProps {
  title: string;
  items: ResultItem[];
  gradient?: string;
}

const ResultCard: React.FC<ResultCardProps> = ({ title, items, gradient }) => {
  return (
    <div style={{
      background: gradient || 'white',
      borderRadius: '16px',
      padding: '20px',
      margin: '16px 0',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <h3 style={{
        fontSize: '13px',
        fontWeight: '600',
        color: gradient ? 'rgba(255,255,255,0.8)' : '#8e8e93',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '16px',
      }}>{title}</h3>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: i < items.length - 1 ? '10px 0' : '0',
          borderBottom: i < items.length - 1 ? `1px solid ${gradient ? 'rgba(255,255,255,0.15)' : '#f0f0f5'}` : 'none',
        }}>
          <span style={{
            fontSize: item.highlight ? '15px' : '14px',
            color: gradient ? 'rgba(255,255,255,0.85)' : '#3c3c43',
            fontWeight: item.highlight ? '600' : '400',
          }}>{item.label}</span>
          <span style={{
            fontSize: item.highlight ? '20px' : '16px',
            fontWeight: item.highlight ? '700' : '600',
            color: item.color || (gradient ? 'white' : '#1c1c1e'),
          }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
};

export default ResultCard;
