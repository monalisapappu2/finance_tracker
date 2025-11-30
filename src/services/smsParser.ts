interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  merchant: string;
  description: string;
  source: 'sms';
  raw_data: {
    sms_text: string;
    source_app: string;
    parsed_at: string;
  };
}

const upiPatterns = {
  phonepe: {
    debit: /PhonePe.*?(?:paid|sent).*?₹([\d,]+\.?\d*)/i,
    credit: /PhonePe.*?(?:received|credited).*?₹([\d,]+\.?\d*)/i,
    merchant: /to\s+([A-Za-z\s]+?)(?:\s+on|$)/i,
  },
  googlepay: {
    debit: /Google Pay.*?(?:paid|sent).*?₹([\d,]+\.?\d*)/i,
    credit: /Google Pay.*?(?:received|credited).*?₹([\d,]+\.?\d*)/i,
    merchant: /to\s+([A-Za-z\s]+?)(?:\s+on|$)/i,
  },
  paytm: {
    debit: /Paytm.*?(?:payment|transferred).*?₹([\d,]+\.?\d*)/i,
    credit: /Paytm.*?(?:received|credited).*?₹([\d,]+\.?\d*)/i,
    merchant: /to\s+([A-Za-z\s]+?)(?:\s+on|$)/i,
  },
  bank: {
    debit: /(?:debited|withdrawn|transferred).*?₹([\d,]+\.?\d*)|Your\s+account\s+[A-Z0-9]+\s+debited\s+(?:with\s+)?₹([\d,]+\.?\d*)/i,
    credit: /(?:credited|deposited|received).*?₹([\d,]+\.?\d*)|Your\s+account\s+[A-Z0-9]+\s+credited\s+(?:with\s+)?₹([\d,]+\.?\d*)/i,
    merchant: /(?:from|to|at)\s+([A-Za-z\s&.]+?)(?:\s+on|\s+reference|$)/i,
  },
};

function cleanAmount(amountStr: string): number {
  return parseFloat(amountStr.replace(/,/g, ''));
}

function extractFromPattern(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? (match[1] || match[2] || match[0]).trim() : null;
}

export function parseSMSTransaction(smsText: string): ParsedTransaction | null {
  const text = smsText.toLowerCase();

  for (const [source, patterns] of Object.entries(upiPatterns)) {
    let isDebit = false;
    let isCredit = false;
    let amountStr = '';
    let merchant = '';

    const debitMatch = text.match(patterns.debit);
    const creditMatch = text.match(patterns.credit);

    if (debitMatch) {
      isDebit = true;
      amountStr = debitMatch[1] || debitMatch[2] || '';
    } else if (creditMatch) {
      isCredit = true;
      amountStr = creditMatch[1] || creditMatch[2] || '';
    }

    if (amountStr && (isDebit || isCredit)) {
      merchant = extractFromPattern(smsText, patterns.merchant) || source;

      try {
        const amount = cleanAmount(amountStr);

        return {
          amount,
          type: isDebit ? 'expense' : 'income',
          merchant,
          description: `${source.toUpperCase()} transaction`,
          source: 'sms',
          raw_data: {
            sms_text: smsText,
            source_app: source,
            parsed_at: new Date().toISOString(),
          },
        };
      } catch (error) {
        continue;
      }
    }
  }

  return null;
}

export function detectDuplicateTransaction(
  newTransaction: ParsedTransaction,
  existingTransactions: any[]
): boolean {
  const timeWindow = 5 * 60 * 1000;
  const now = new Date().getTime();

  return existingTransactions.some((txn) => {
    const txnTime = new Date(txn.created_at).getTime();
    const timeDiff = Math.abs(now - txnTime);

    return (
      txn.amount === newTransaction.amount &&
      txn.type === newTransaction.type &&
      txn.merchant === newTransaction.merchant &&
      timeDiff < timeWindow
    );
  });
}

export function parseMultipleSMS(smsList: string[]): ParsedTransaction[] {
  return smsList
    .map(parseSMSTransaction)
    .filter((txn): txn is ParsedTransaction => txn !== null);
}
