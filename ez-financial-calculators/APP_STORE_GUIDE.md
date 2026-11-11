# EZ Financial Calculators — App Store Submission Guide

## App Overview
A comprehensive suite of 12 financial calculators with an iOS-native look and feel.

## Calculators Included
1. **Loan Calculator** — EMI calculation with principal/interest breakdown & pie chart
2. **Mortgage Calculator** — Home loan with amortization area chart
3. **Investment Calculator** — Compound growth with monthly additions & line chart
4. **SIP Calculator** — Systematic Investment Plan maturity value & bar chart
5. **Savings Calculator** — Goal-based savings planner with progress ring
6. **Retirement Calculator** — Corpus planner with area chart
7. **Compound Interest** — Compare compound vs simple interest with frequency selector
8. **Credit Card Payoff** — Debt elimination planner with payoff date
9. **Auto Loan** — Car financing with trade-in value support
10. **Tax Calculator** — India FY24-25 income tax (New & Old regime) with slab chart
11. **Currency Converter** — 12 currencies with live cross-rates
12. **BMI Calculator** — Body Mass Index with health insights & calorie needs

## Tech Stack
- React 18 + TypeScript
- Recharts (charts)
- iOS-style design system (inline styles, system fonts)

## To Publish on Apple App Store

### Prerequisites
- Apple Developer Account ($99/year) at developer.apple.com
- Mac with Xcode 15+
- React Native or Capacitor wrapper

### Option A: Capacitor (Recommended — reuse this web code)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "EZ Financial Calculators" com.yourname.ezfinancial
npm run build
npx cap add ios
npx cap copy ios
npx cap open ios
```
Then in Xcode: Product → Archive → Distribute App → App Store Connect

### Option B: React Native
Rebuild components using React Native primitives and submit via Xcode.

### App Store Metadata
- **Category:** Finance
- **Age Rating:** 4+
- **Keywords:** financial calculator, loan, mortgage, SIP, EMI, investment, tax, currency converter, retirement, compound interest
- **Description:** (see below)

### App Description
EZ Financial Calculators is your all-in-one financial toolkit. Whether you're planning a home loan, calculating SIP returns, tracking your retirement corpus, or converting currencies — we've got you covered with 12 powerful calculators.

**Features:**
• Loan & Mortgage EMI Calculator
• SIP & Investment Planner
• Retirement Corpus Calculator
• Income Tax Calculator (New & Old Regime)
• Credit Card Payoff Planner
• Auto Loan Calculator
• Compound Interest Calculator
• Currency Converter (12 currencies)
• Savings Goal Planner
• BMI & Health Calculator

All calculators feature beautiful charts, interactive sliders, and instant results.
