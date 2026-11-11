import React, { useState } from 'react';
import { Screen } from '../App';

interface CalcItem {
  id: Screen;
  emoji: string;
  title: string;
  subtitle: string;
  gradient: string;
}

const calculators: CalcItem[] = [
  { id: 'loan', emoji: '🏦', title: 'Loan', subtitle: 'EMI & Repayment', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { id: 'mortgage', emoji: '🏠', title: 'Mortgage', subtitle: 'Home Loan', gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { id: 'investment', emoji: '📈', title: 'Investment', subtitle: 'Returns & Growth', gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { id: 'sip', emoji: '💹', title: 'SIP', subtitle: 'Systematic Plan', gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
  { id: 'savings', emoji: '💰', title: 'Savings', subtitle: 'Goal Planner', gradient: 'linear-gradient(135deg, #fa709a, #fee140)' },
  { id: 'retirement', emoji: '🌴', title: 'Retirement', subtitle: 'Nest Egg', gradient: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
  { id: 'compound', emoji: '⚡', title: 'Compound', subtitle: 'Interest', gradient: 'linear-gradient(135deg, #ffecd2, #fcb69f)' },
  { id: 'credit-card', emoji: '💳', title: 'Credit Card', subtitle: 'Payoff Plan', gradient: 'linear-gradient(135deg, #ff9a9e, #fad0c4)' },
  { id: 'auto-loan', emoji: '🚗', title: 'Auto Loan', subtitle: 'Car Financing', gradient: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' },
  { id: 'tax', emoji: '📊', title: 'Tax', subtitle: 'Income Tax', gradient: 'linear-gradient(135deg, #d4fc79, #96e6a1)' },
  { id: 'currency', emoji: '💱', title: 'Currency', subtitle: 'Converter', gradient: 'linear-gradient(135deg, #f6d365, #fda085)' },
  { id: 'bmi', emoji: '⚖️', title: 'BMI', subtitle: 'Health Index', gradient: 'linear-gradient(135deg, #89f7fe, #66a6ff)' },
];

interface Props {
  onNavigate: (screen: Screen) => void;
}

const HomeScreen: React.FC<Props> = ({ onNavigate }) => {
  const [search, setSearch] = useState('');

  const filtered = calculators.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '54px 20px 28px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '44px', height: '44px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px',
            boxShadow: '0 4px 15px rgba(102,126,234,0.5)',
          }}>💰</div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>EZ Financial</h1>
            <p style={{ fontSize: '13px', opacity: 0.7 }}>Calculators</p>
          </div>
        </div>
        <p style={{ fontSize: '13px', opacity: 0.6, marginBottom: '16px' }}>
          12 powerful financial tools at your fingertips
        </p>
        {/* Search */}
        <div style={{
          background: 'rgba(255,255,255,0.12)',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backdropFilter: 'blur(10px)',
        }}>
          <span style={{ opacity: 0.6 }}>🔍</span>
          <input
            type="text"
            placeholder="Search calculators..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '15px',
              flex: 1,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '20px 16px 100px' }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
          {filtered.length} Calculators
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
        }}>
          {filtered.map(calc => (
            <button
              key={calc.id}
              onClick={() => onNavigate(calc.id)}
              style={{
                background: 'white',
                border: 'none',
                borderRadius: '18px',
                padding: '20px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                overflow: 'hidden',
                position: 'relative',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.96)')}
              onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div style={{
                position: 'absolute',
                top: '-20px', right: '-20px',
                width: '80px', height: '80px',
                background: calc.gradient,
                borderRadius: '50%',
                opacity: 0.12,
              }} />
              <div style={{
                width: '46px', height: '46px',
                background: calc.gradient,
                borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px',
                marginBottom: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}>
                {calc.emoji}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1c1c1e', marginBottom: '2px' }}>
                {calc.title}
              </div>
              <div style={{ fontSize: '12px', color: '#8e8e93', fontWeight: '500' }}>
                {calc.subtitle}
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8e8e93' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p style={{ fontSize: '17px', fontWeight: '600' }}>No results found</p>
            <p style={{ fontSize: '14px', marginTop: '4px' }}>Try a different search term</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)',
        padding: '12px 20px 20px',
        borderTop: '1px solid #e5e5ea',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '12px', color: '#aeaeb2' }}>EZ Financial Calculators © 2024</p>
      </div>
    </div>
  );
};

export default HomeScreen;
