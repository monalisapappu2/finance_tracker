interface BudgetData {
  amount: number;
  spent: number;
  historicalAverage?: number;
}

export function calculateBudgetPercentage(budget: BudgetData): number {
  return (budget.spent / budget.amount) * 100;
}

export function getAlertLevel(percentage: number): 'safe' | 'warning' | 'danger' {
  if (percentage >= 100) return 'danger';
  if (percentage >= 80) return 'warning';
  return 'safe';
}

export function getAlertMessage(percentage: number, budgetName: string): string {
  if (percentage >= 100) {
    return `"${budgetName}" budget exceeded! You've spent ${percentage.toFixed(0)}% of your limit.`;
  }
  if (percentage >= 80) {
    return `"${budgetName}" budget is at ${percentage.toFixed(0)}% of limit. Only ${(100 - percentage).toFixed(0)}% remaining.`;
  }
  return `"${budgetName}" budget usage: ${percentage.toFixed(0)}% of limit.`;
}

export function suggestBudgetAdjustment(
  currentBudget: number,
  spent: number,
  historicalMonths: Array<{ expense: number }>
): { suggested: number; reason: string } {
  if (historicalMonths.length < 2) {
    return {
      suggested: currentBudget,
      reason: 'Insufficient data for adjustment',
    };
  }

  const avgSpending =
    historicalMonths.reduce((sum, month) => sum + month.expense, 0) /
    historicalMonths.length;

  const trend = historicalMonths.length >= 3
    ? (historicalMonths[historicalMonths.length - 1].expense -
        historicalMonths[0].expense) /
      historicalMonths[0].expense
    : 0;

  const suggestedAmount = Math.ceil(avgSpending * 1.1);

  let reason = '';
  if (trend > 0.2) {
    reason =
      'Expenses are increasing. Budget adjusted upward to accommodate the trend.';
  } else if (trend < -0.2) {
    reason =
      'Expenses are decreasing. Budget adjusted downward to maintain discipline.';
  } else {
    reason =
      'Budget adjusted based on historical spending average with 10% buffer.';
  }

  return {
    suggested: suggestedAmount,
    reason,
  };
}

export function getDaysRemainingInPeriod(
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
  startDate: string,
  endDate?: string
): number {
  const start = new Date(startDate);
  const now = new Date();
  let end: Date;

  if (endDate) {
    end = new Date(endDate);
  } else {
    end = new Date(start);
    switch (period) {
      case 'daily':
        end.setDate(end.getDate() + 1);
        break;
      case 'weekly':
        end.setDate(end.getDate() + 7);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'yearly':
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
  }

  const daysRemaining = Math.ceil(
    (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.max(0, daysRemaining);
}

export function estimateDailyBudget(
  totalBudget: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
  startDate: string,
  endDate?: string
): number {
  const daysRemaining = getDaysRemainingInPeriod(period, startDate, endDate);

  if (daysRemaining === 0) return 0;

  return totalBudget / daysRemaining;
}

export function warnIfOnTrackToExceed(
  spent: number,
  dailyBudget: number,
  daysRemaining: number,
  totalBudget: number
): { warning: boolean; message: string } {
  if (daysRemaining === 0) {
    return { warning: false, message: 'Budget period has ended' };
  }

  const projectedSpending = spent + dailyBudget * daysRemaining;
  const percentageProjected = (projectedSpending / totalBudget) * 100;

  if (projectedSpending > totalBudget) {
    return {
      warning: true,
      message: `At current pace, you'll exceed budget by ₹${Math.ceil(
        projectedSpending - totalBudget
      )} (projected ${percentageProjected.toFixed(0)}%)`,
    };
  }

  if (percentageProjected > 80) {
    return {
      warning: true,
      message: `At current pace, you'll use ${percentageProjected.toFixed(
        0
      )}% of budget`,
    };
  }

  return { warning: false, message: '' };
}

export function prioritizeBudgets(
  budgets: Array<{ id: string; name: string; spent: number; amount: number }>
): Array<{
  budget: { id: string; name: string; spent: number; amount: number };
  priority: number;
  reason: string;
}> {
  return budgets
    .map((budget) => {
      const percentage = (budget.spent / budget.amount) * 100;
      let priority = 0;
      let reason = '';

      if (percentage >= 100) {
        priority = 1;
        reason = 'Exceeded budget limit';
      } else if (percentage >= 90) {
        priority = 2;
        reason = 'Critical - nearing limit';
      } else if (percentage >= 75) {
        priority = 3;
        reason = 'Warning - approaching limit';
      } else {
        priority = 4;
        reason = 'On track';
      }

      return { budget, priority, reason };
    })
    .sort((a, b) => a.priority - b.priority);
}
