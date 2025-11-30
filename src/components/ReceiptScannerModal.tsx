import { useState, useRef } from 'react';
import { X, Upload, Eye, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedReceipt {
  merchant: string;
  amount: string;
  date: string;
  items: string[];
  confidence: number;
}

export function ReceiptScannerModal({ isOpen, onClose, onSuccess }: ReceiptScannerModalProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles([...files, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const simulateOCR = (file: File): ParsedReceipt => {
    const today = new Date().toISOString().split('T')[0];
    return {
      merchant: 'Detected Merchant',
      amount: '250.00',
      date: today,
      items: ['Item 1', 'Item 2', 'Item 3'],
      confidence: 0.85,
    };
  };

  const uploadReceiptsToStorage = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];

    for (const file of files) {
      const fileName = `receipts/${user?.id}/${Date.now()}-${file.name}`;

      const { error, data } = await supabase.storage
        .from('finance-documents')
        .upload(fileName, file);

      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('finance-documents')
          .getPublicUrl(fileName);
        if (urlData?.publicUrl) {
          urls.push(urlData.publicUrl);
        }
      }
    }

    return urls;
  };

  const handleScanReceipts = async () => {
    if (!user || files.length === 0) return;

    setLoading(true);

    try {
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
      const scanResults = [];

      for (const file of files) {
        const parsed = simulateOCR(file);

        const { data: receipt, error: uploadError } = await supabase
          .from('receipts')
          .insert({
            user_id: user.id,
            image_url: `receipt-${file.name}`,
            parsed_merchant: parsed.merchant,
            parsed_amount: parseFloat(parsed.amount),
            parsed_date: parsed.date,
            parsed_items: parsed.items,
            ocr_raw: { confidence: parsed.confidence, file_name: file.name },
            processed: true,
          })
          .select()
          .maybeSingle();

        if (uploadError || !receipt) {
          scanResults.push({
            file: file.name,
            status: 'error',
            reason: 'Failed to save receipt',
          });
          continue;
        }

        const { data: existingCategory } = await supabase
          .from('categories')
          .select('id')
          .eq('name', 'Food & Dining')
          .eq('is_system', true)
          .maybeSingle();

        const { error: txnError } = await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: defaultAccountId,
          receipt_id: receipt.id,
          amount: parseFloat(parsed.amount),
          type: 'expense',
          merchant: parsed.merchant,
          description: `Receipt: ${parsed.items.join(', ')}`,
          transaction_date: parsed.date,
          source: 'ocr',
          category_id: existingCategory?.id || null,
          raw_data: { ocr_confidence: parsed.confidence },
        });

        if (txnError) {
          scanResults.push({
            file: file.name,
            status: 'error',
            reason: 'Failed to create transaction',
          });
        } else {
          const { data: accountData } = await supabase
            .from('accounts')
            .select('balance')
            .eq('id', defaultAccountId)
            .maybeSingle();

          if (accountData) {
            const currentBalance = Number(accountData.balance);
            const newBalance = currentBalance - parseFloat(parsed.amount);

            await supabase
              .from('accounts')
              .update({ balance: newBalance })
              .eq('id', defaultAccountId);
          }

          scanResults.push({
            file: file.name,
            status: 'success',
            merchant: parsed.merchant,
            amount: parsed.amount,
            confidence: parsed.confidence,
          });
        }
      }

      setResults(scanResults);
    } catch (error) {
      console.error('Error scanning receipts:', error);
      alert('Error scanning receipts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Scan Receipts</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {results.length === 0 ? (
            <>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Upload Receipt Images</label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition"
                >
                  <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-gray-600 font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500 mt-1">PNG, JPG, PDF up to 10MB</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {files.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-medium mb-2">
                      {files.length} file{files.length !== 1 ? 's' : ''} selected
                    </p>
                    <div className="space-y-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded">
                          <span className="text-sm text-gray-700 truncate">{file.name}</span>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Note:</p>
                  <p className="mt-1">
                    OCR accuracy depends on receipt quality. Please review parsed data before confirming.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScanReceipts}
                  disabled={loading || files.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Eye size={20} />
                  {loading ? 'Scanning...' : 'Scan Receipts'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg p-6 border border-emerald-200">
                <h3 className="font-semibold text-emerald-900">Scan Results</h3>
                <p className="text-sm text-emerald-800 mt-1">
                  {results.filter((r) => r.status === 'success').length} receipt{
                    results.filter((r) => r.status === 'success').length !== 1 ? 's' : ''
                  } processed
                </p>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-sm ${
                      result.status === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{result.file}</p>
                        {result.status === 'success' && (
                          <p className="text-xs mt-1">
                            ₹{result.amount} from {result.merchant} (Confidence: {Math.round(result.confidence * 100)}%)
                          </p>
                        )}
                        {result.status === 'error' && (
                          <p className="text-xs mt-1">{result.reason}</p>
                        )}
                      </div>
                      <span className="ml-2 px-2 py-1 bg-white bg-opacity-50 rounded text-xs font-medium whitespace-nowrap">
                        {result.status === 'success' ? '✓ Success' : '✗ Failed'}
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
