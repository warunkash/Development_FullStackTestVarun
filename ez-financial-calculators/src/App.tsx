import React, { useState } from 'react';
import HomeScreen from './components/HomeScreen';
import LoanCalculator from './components/calculators/LoanCalculator';
import MortgageCalculator from './components/calculators/MortgageCalculator';
import InvestmentCalculator from './components/calculators/InvestmentCalculator';
import SavingsCalculator from './components/calculators/SavingsCalculator';
import RetirementCalculator from './components/calculators/RetirementCalculator';
import CompoundInterestCalculator from './components/calculators/CompoundInterestCalculator';
import CurrencyConverter from './components/calculators/CurrencyConverter';
import CreditCardCalculator from './components/calculators/CreditCardCalculator';
import AutoLoanCalculator from './components/calculators/AutoLoanCalculator';
import TaxCalculator from './components/calculators/TaxCalculator';
import SIPCalculator from './components/calculators/SIPCalculator';
import BMICalculator from './components/calculators/BMICalculator';
import './App.css';

export type Screen =
  | 'home'
  | 'loan'
  | 'mortgage'
  | 'investment'
  | 'savings'
  | 'retirement'
  | 'compound'
  | 'currency'
  | 'credit-card'
  | 'auto-loan'
  | 'tax'
  | 'sip'
  | 'bmi';

function App() {
  const [screen, setScreen] = useState<Screen>('home');

  const navigate = (s: Screen) => setScreen(s);
  const goHome = () => setScreen('home');

  const renderScreen = () => {
    switch (screen) {
      case 'loan': return <LoanCalculator onBack={goHome} />;
      case 'mortgage': return <MortgageCalculator onBack={goHome} />;
      case 'investment': return <InvestmentCalculator onBack={goHome} />;
      case 'savings': return <SavingsCalculator onBack={goHome} />;
      case 'retirement': return <RetirementCalculator onBack={goHome} />;
      case 'compound': return <CompoundInterestCalculator onBack={goHome} />;
      case 'currency': return <CurrencyConverter onBack={goHome} />;
      case 'credit-card': return <CreditCardCalculator onBack={goHome} />;
      case 'auto-loan': return <AutoLoanCalculator onBack={goHome} />;
      case 'tax': return <TaxCalculator onBack={goHome} />;
      case 'sip': return <SIPCalculator onBack={goHome} />;
      case 'bmi': return <BMICalculator onBack={goHome} />;
      default: return <HomeScreen onNavigate={navigate} />;
    }
  };

  return <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>{renderScreen()}</div>;
}

export default App;
