interface TransactionData {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
}

interface MonthlyMetrics {
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
}

export interface FinancialInsights {
  summary: string;
  topCategories: Array<{ category: string; amount: number; percentage: number }>;
  monthlyTrend: string;
  budgetStatus: string;
  recommendations: string[];
  riskFactors: string[];
}

export function generateFinancialReport(
  currentMonth: MonthlyMetrics,
  previousMonth: MonthlyMetrics,
  categorySpending: Record<string, number>,
  totalExpense: number
): FinancialInsights {
  const insights: FinancialInsights = {
    summary: '',
    topCategories: [],
    monthlyTrend: '',
    budgetStatus: '',
    recommendations: [],
    riskFactors: [],
  };

  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const incomeTrend = currentMonth.income - previousMonth.income;
  const expenseTrend = currentMonth.expense - previousMonth.expense;
  const savingsTrend = currentMonth.savings - previousMonth.savings;

  insights.summary = generateSummary(currentMonth, monthName, incomeTrend, savingsTrend);

  const topCats = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / totalExpense) * 100,
    }));

  insights.topCategories = topCats;

  insights.monthlyTrend = generateTrendAnalysis(currentMonth, previousMonth, incomeTrend, expenseTrend);

  insights.budgetStatus = generateBudgetStatus(currentMonth.savingsRate);

  insights.recommendations = generateRecommendations(
    currentMonth,
    topCats,
    currentMonth.savingsRate,
    expenseTrend
  );

  insights.riskFactors = generateRiskFactors(currentMonth, previousMonth, expenseTrend);

  return insights;
}

function generateSummary(metrics: MonthlyMetrics, month: string, incomeTrend: number, savingsTrend: number): string {
  let summary = `In ${month}, you earned ₹${formatAmount(metrics.income)} and spent ₹${formatAmount(metrics.expense)}.`;

  summary += ` Your net savings were ₹${formatAmount(metrics.savings)}.`;

  if (metrics.savingsRate > 30) {
    summary += ` Excellent job maintaining a savings rate of ${metrics.savingsRate.toFixed(1)}%! Keep up this disciplined approach.`;
  } else if (metrics.savingsRate > 20) {
    summary += ` Your savings rate of ${metrics.savingsRate.toFixed(1)}% is solid. You're on the right track.`;
  } else if (metrics.savingsRate > 10) {
    summary += ` Your savings rate is ${metrics.savingsRate.toFixed(1)}%. Consider increasing it for better financial security.`;
  } else if (metrics.savingsRate >= 0) {
    summary += ` Your savings rate is only ${metrics.savingsRate.toFixed(1)}%. Focus on reducing discretionary spending.`;
  } else {
    summary += ` Warning: You spent more than you earned! Start reviewing your expenses.`;
  }

  if (incomeTrend > 0) {
    summary += ` Income increased by ₹${formatAmount(incomeTrend)}.`;
  } else if (incomeTrend < 0) {
    summary += ` Income decreased by ₹${formatAmount(Math.abs(incomeTrend))}.`;
  }

  return summary;
}

function generateTrendAnalysis(current: MonthlyMetrics, previous: MonthlyMetrics, incomeTrend: number, expenseTrend: number): string {
  let analysis = 'Month-over-Month Analysis: ';

  if (expenseTrend > 0 && Math.abs(expenseTrend / previous.expense) > 0.1) {
    analysis += `Expenses increased by ${((expenseTrend / previous.expense) * 100).toFixed(1)}%. `;
  } else if (expenseTrend < 0 && Math.abs(expenseTrend / previous.expense) > 0.1) {
    analysis += `Expenses decreased by ${(Math.abs(expenseTrend / previous.expense) * 100).toFixed(1)}%. `;
  }

  if (current.savingsRate > previous.savingsRate) {
    analysis += `Your savings improved by ${(current.savingsRate - previous.savingsRate).toFixed(1)} percentage points.`;
  } else if (current.savingsRate < previous.savingsRate) {
    analysis += `Your savings decreased by ${(previous.savingsRate - current.savingsRate).toFixed(1)} percentage points.`;
  } else {
    analysis += 'Your savings rate remained stable.';
  }

  return analysis;
}

function generateBudgetStatus(savingsRate: number): string {
  if (savingsRate > 35) {
    return 'Budget Status: Excellent – You are on track to meet your financial goals. Consider allocating surplus towards investments or emergency fund.';
  } else if (savingsRate > 25) {
    return 'Budget Status: Good – Your spending is well-controlled. Maintain this discipline.';
  } else if (savingsRate > 15) {
    return 'Budget Status: Fair – You have room to optimize. Review discretionary expenses.';
  } else if (savingsRate > 0) {
    return 'Budget Status: Needs Attention – Cut non-essential expenses to improve your financial health.';
  } else {
    return 'Budget Status: Critical – Your expenses exceed income. Immediate action required to address deficit spending.';
  }
}

function generateRecommendations(
  metrics: MonthlyMetrics,
  topCategories: Array<{ category: string; amount: number; percentage: number }>,
  savingsRate: number,
  expenseTrend: number
): string[] {
  const recommendations: string[] = [];

  if (topCategories[0] && topCategories[0].percentage > 30) {
    recommendations.push(
      `Your top spending category (${topCategories[0].category}) accounts for ${topCategories[0].percentage.toFixed(1)}% of expenses. Consider setting a strict limit for this category.`
    );
  }

  if (expenseTrend > 0) {
    recommendations.push('Your monthly expenses are increasing. Review recent transactions to identify unnecessary spending patterns.');
  }

  if (savingsRate < 20) {
    recommendations.push('Aim to save at least 20% of your income. Start by tracking and reducing discretionary spending.');
  }

  if (metrics.income < 50000) {
    recommendations.push('Consider building a 3-month emergency fund as a priority before major investments.');
  }

  recommendations.push('Review subscriptions and recurring expenses monthly to eliminate unused services.');

  return recommendations;
}

function generateRiskFactors(current: MonthlyMetrics, previous: MonthlyMetrics, expenseTrend: number): string[] {
  const risks: string[] = [];

  if (current.savings < 0) {
    risks.push('Deficit spending detected – spending exceeds income');
  }

  if (expenseTrend > previous.expense * 0.2) {
    risks.push('Sharp increase in expenses – possible unusual spending');
  }

  if (current.savingsRate < 0) {
    risks.push('Zero savings rate – no financial cushion being built');
  }

  if (current.expense > current.income * 1.2) {
    risks.push('Expenses significantly exceed income – requires attention');
  }

  return risks;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateFinancialScore(metrics: MonthlyMetrics, expenseVariance: number): number {
  let score = 100;

  if (metrics.savingsRate < 15) score -= 30;
  else if (metrics.savingsRate < 25) score -= 15;
  else if (metrics.savingsRate >= 35) score += 10;

  if (expenseVariance > 0.3) score -= 10;
  if (expenseVariance < -0.2) score -= 5;

  if (metrics.expense > metrics.income * 1.1) score -= 25;

  return Math.max(0, Math.min(100, score));
}

export function predictFutureSpending(monthlyData: MonthlyMetrics[]): MonthlyMetrics {
  if (monthlyData.length === 0) {
    return { income: 0, expense: 0, savings: 0, savingsRate: 0 };
  }

  const avgIncome = monthlyData.reduce((sum, m) => sum + m.income, 0) / monthlyData.length;
  const avgExpense = monthlyData.reduce((sum, m) => sum + m.expense, 0) / monthlyData.length;

  const recentData = monthlyData.slice(-3);
  const trend =
    recentData.length > 1
      ? (recentData[recentData.length - 1].expense - recentData[0].expense) / recentData[0].expense
      : 0;

  const predictedExpense = avgExpense * (1 + trend * 0.5);
  const predictedIncome = avgIncome;
  const predictedSavings = predictedIncome - predictedExpense;
  const predictedRate = predictedIncome > 0 ? (predictedSavings / predictedIncome) * 100 : 0;

  return {
    income: predictedIncome,
    expense: predictedExpense,
    savings: predictedSavings,
    savingsRate: predictedRate,
  };
}
