import React, { useState, useMemo } from 'react';

interface Props { onBack: () => void; }

const BMICalculator: React.FC<Props> = ({ onBack }) => {
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(70);
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [age, setAge] = useState(30);

  const result = useMemo(() => {
    let h = height, w = weight;
    if (unit === 'imperial') {
      h = height * 2.54;
      w = weight * 0.453592;
    }
    const hm = h / 100;
    const bmi = w / (hm * hm);
    let category = '', color = '', emoji = '';
    if (bmi < 18.5) { category = 'Underweight'; color = '#4facfe'; emoji = '📉'; }
    else if (bmi < 25) { category = 'Normal Weight'; color = '#43e97b'; emoji = '✅'; }
    else if (bmi < 30) { category = 'Overweight'; color = '#f6d365'; emoji = '⚠️'; }
    else { category = 'Obese'; color = '#f5576c'; emoji = '🔴'; }

    const idealWeightMin = Math.round(18.5 * hm * hm);
    const idealWeightMax = Math.round(24.9 * hm * hm);
    const toIdeal = w > idealWeightMax ? `Lose ${(w - idealWeightMax).toFixed(1)} kg` :
      w < idealWeightMin ? `Gain ${(idealWeightMin - w).toFixed(1)} kg` : 'You\'re at ideal weight!';

    const bmr = 10 * w + 6.25 * h - 5 * age + 5;
    const tdee = bmr * 1.55;

    return { bmi: bmi.toFixed(1), category, color, emoji, idealWeightMin, idealWeightMax, toIdeal, bmr: Math.round(bmr), tdee: Math.round(tdee) };
  }, [height, weight, unit, age]);

  const pct = Math.min(100, Math.max(0, ((parseFloat(result.bmi) - 10) / 35) * 100));

  const SliderRow = ({ label, value, setValue, min, max, step, suffix }: any) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#66a6ff' }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#66a6ff', cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #89f7fe, #66a6ff)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>⚖️ BMI Calculator</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Body Mass Index & health metrics</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        {/* Unit Toggle */}
        <div style={{ display: 'flex', background: 'white', borderRadius: '12px', padding: '4px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {(['metric', 'imperial'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)} style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
              background: unit === u ? 'linear-gradient(135deg, #89f7fe, #66a6ff)' : 'transparent',
              color: unit === u ? 'white' : '#8e8e93',
              transition: 'all 0.2s',
            }}>
              {u === 'metric' ? '📏 Metric (cm/kg)' : '📐 Imperial (in/lbs)'}
            </button>
          ))}
        </div>

        {/* BMI Result */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '28px', textAlign: 'center', marginBottom: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: '60px', fontWeight: '900', color: result.color, lineHeight: 1.1 }}>{result.bmi}</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: result.color, marginBottom: '4px' }}>{result.emoji} {result.category}</p>

          {/* BMI Scale Bar */}
          <div style={{ position: 'relative', height: '12px', background: 'linear-gradient(90deg, #4facfe, #43e97b, #f6d365, #f5576c)', borderRadius: '6px', margin: '16px 0 8px' }}>
            <div style={{
              position: 'absolute',
              left: `${pct}%`,
              top: '-4px',
              width: '20px', height: '20px',
              background: 'white',
              borderRadius: '50%',
              border: `3px solid ${result.color}`,
              transform: 'translateX(-50%)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8e8e93' }}>
            <span>Under 18.5</span><span>18.5–25</span><span>25–30</span><span>30+</span>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Your Measurements</h3>
          <SliderRow label={`Height (${unit === 'metric' ? 'cm' : 'inches'})`} value={height} setValue={setHeight}
            min={unit === 'metric' ? 100 : 48} max={unit === 'metric' ? 220 : 96}
            step={1} suffix={unit === 'metric' ? ' cm' : '"'} />
          <SliderRow label={`Weight (${unit === 'metric' ? 'kg' : 'lbs'})`} value={weight} setValue={setWeight}
            min={unit === 'metric' ? 30 : 66} max={unit === 'metric' ? 200 : 440}
            step={0.5} suffix={unit === 'metric' ? ' kg' : ' lbs'} />
          <SliderRow label="Age" value={age} setValue={setAge} min={10} max={100} step={1} suffix=" years" />
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Health Insights</h3>
          {[
            { label: 'BMI Score', value: result.bmi, color: result.color },
            { label: 'Category', value: result.category, color: result.color },
            { label: 'Ideal Weight Range', value: `${result.idealWeightMin}–${result.idealWeightMax} kg` },
            { label: 'Goal', value: result.toIdeal, color: '#43e97b' },
            { label: 'Basal Metabolic Rate', value: `${result.bmr} kcal/day` },
            { label: 'Daily Calorie Need', value: `${result.tdee} kcal/day` },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 5 ? '1px solid #f0f0f5' : 'none' }}>
              <span style={{ fontSize: '14px', color: '#3c3c43' }}>{item.label}</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: item.color || '#1c1c1e', textAlign: 'right', maxWidth: '55%' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BMICalculator;
