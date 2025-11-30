import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { parseSMSTransaction, detectDuplicateTransaction } from '../services/smsParser';

interface SMSImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SMSImportModal({ isOpen, onClose, onSuccess }: SMSImportModalProps) {
  const { user } = useAuth();
  const [smsList, setSmsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [imported, setImported] = useState(0);

  if (!isOpen) return null;

  const handlePasteSMS = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const messages = text
      .split('\n\n')
      .map((msg) => msg.trim())
      .filter((msg) => msg.length > 0);
    setSmsList(messages);
  };

  const handleImport = async () => {
    if (!user || smsList.length === 0) return;

    setLoading(true);

    try {
      const { data: existingTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('source', 'sms')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!accounts || accounts.length === 0) {
        alert('Please create at least one account first');
        setLoading(false);
        return;
      }

      const defaultAccountId = accounts[0].id;

      const parseResults = [];
      let successCount = 0;

      for (const sms of smsList) {
        const parsed = parseSMSTransaction(sms);

        if (!parsed) {
          parseResults.push({ sms: sms.substring(0, 50), status: 'failed', reason: 'Could not parse' });
          continue;
        }

        const isDuplicate = detectDuplicateTransaction(parsed, existingTransactions || []);
        if (isDuplicate) {
          parseResults.push({
            sms: sms.substring(0, 50),
            status: 'duplicate',
            reason: 'Similar transaction found',
          });
          continue;
        }

        const { data: existingCategory } = await supabase
          .from('categories')
          .select('id')
          .eq('type', parsed.type)
          .eq('is_system', true)
          .limit(1)
          .maybeSingle();

        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: defaultAccountId,
          amount: parsed.amount,
          type: parsed.type,
          merchant: parsed.merchant,
          description: parsed.description,
          transaction_date: new Date().toISOString().split('T')[0],
          source: 'sms',
          raw_data: parsed.raw_data,
          category_id: existingCategory?.id || null,
        });

        if (error) {
          parseResults.push({
            sms: sms.substring(0, 50),
            status: 'error',
            reason: 'Database error',
          });
        } else {
          successCount++;
          parseResults.push({
            sms: sms.substring(0, 50),
            status: 'success',
            amount: parsed.amount,
            type: parsed.type,
          });

          const { data: accountData } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', defaultAccountId)
            .maybeSingle();

          if (accountData) {
            const currentBalance = Number(accountData.balance);
            const newBalance =
              parsed.type === 'income'
                ? currentBalance + parsed.amount
                : currentBalance - parsed.amount;

            await supabase
              .from('accounts')
              .update({ balance: newBalance })
              .eq('id', defaultAccountId);
          }
        }
      }

      setResults(parseResults);
      setImported(successCount);
    } catch (error) {
      console.error('Error importing SMS:', error);
      alert('Error importing SMS transactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Import SMS Transactions</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {results.length === 0 ? (
            <>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Paste SMS Messages (one per line, separated by blank lines)
                </label>
                <textarea
                  onChange={handlePasteSMS}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
                  placeholder="PhonePe: You paid ₹500 to Merchant Name on...
Paytm: Payment of ₹1000 received from...

Google Pay: ₹250 sent to John Doe..."
                />
              </div>

              {smsList.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    Found {smsList.length} SMS message{smsList.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || smsList.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload size={20} />
                  {loading ? 'Importing...' : 'Import SMS'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg p-6 border border-emerald-200">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="text-emerald-600" size={24} />
                  <div>
                    <h3 className="font-semibold text-emerald-900">Import Complete</h3>
                    <p className="text-sm text-emerald-800 mt-1">
                      {imported} transaction{imported !== 1 ? 's' : ''} successfully imported
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-sm ${
                      result.status === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : result.status === 'duplicate'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 truncate">
                        <p className="font-medium">{result.sms}</p>
                        <p className="text-xs mt-1">
                          {result.status === 'success'
                            ? `Imported ₹${result.amount} (${result.type})`
                            : result.reason}
                        </p>
                      </div>
                      <span className="ml-2 px-2 py-1 bg-white bg-opacity-50 rounded text-xs font-medium whitespace-nowrap">
                        {result.status === 'success'
                          ? '✓ Success'
                          : result.status === 'duplicate'
                            ? 'ℹ Duplicate'
                            : '✗ Failed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-blue-600 transition"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
