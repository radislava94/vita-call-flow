import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { mockData } from '@/data/mockData';
import { PredictionList, PredictionEntry } from '@/types';
import { Upload, Eye, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  normalizePhone,
  isValidPhone,
  findDuplicatePhoneInOrders,
  findDuplicatePhoneIndices,
  findDuplicatePhoneInPredictions,
  hasEmptyRequiredFields,
} from '@/lib/validation';

type PreviewRow = Omit<PredictionEntry, 'id' | 'status' | 'assignedAgentId' | 'assignedAgentName' | 'notes'>;

interface RowIssue {
  type: 'error' | 'warning';
  message: string;
}

export default function PredictionListsPage() {
  const [lists, setLists] = useState<PredictionList[]>(mockData.predictionLists);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [listName, setListName] = useState('');
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setListName(file.name.replace(/\.(xlsx?|csv)$/i, ''));

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      const mapped = json.map((row) => ({
        name: (row['Name'] || row['name'] || row['Nom'] || '').toString().trim(),
        telephone: (row['Telephone'] || row['telephone'] || row['Phone'] || row['phone'] || row['Téléphone'] || '').toString().trim(),
        address: (row['Address'] || row['address'] || row['Adresse'] || '').toString().trim(),
        city: (row['City'] || row['city'] || row['Ville'] || '').toString().trim(),
        product: (row['Product'] || row['product'] || row['Produit'] || '').toString().trim(),
      })).filter(r => r.name || r.telephone);

      setPreview(mapped);
    };
    reader.readAsArrayBuffer(file);
  };

  // Validate all rows
  const rowIssues = useMemo(() => {
    const issues = new Map<number, RowIssue[]>();
    const dupeIndices = findDuplicatePhoneIndices(preview.map(r => r.telephone));

    preview.forEach((row, i) => {
      const rowProblems: RowIssue[] = [];

      if (hasEmptyRequiredFields(row)) {
        rowProblems.push({ type: 'error', message: 'Missing name or phone' });
      }

      if (row.telephone && !isValidPhone(row.telephone)) {
        rowProblems.push({ type: 'error', message: 'Invalid phone format' });
      }

      if (dupeIndices.has(i)) {
        rowProblems.push({ type: 'warning', message: 'Duplicate phone in file' });
      }

      if (row.telephone && isValidPhone(row.telephone)) {
        const orderDupe = findDuplicatePhoneInOrders(row.telephone);
        if (orderDupe) {
          rowProblems.push({ type: 'warning', message: `Phone exists in order ${orderDupe}` });
        }
        const predDupe = findDuplicatePhoneInPredictions(row.telephone);
        if (predDupe) {
          rowProblems.push({ type: 'warning', message: `Phone exists in list "${predDupe}"` });
        }
      }

      if (rowProblems.length > 0) issues.set(i, rowProblems);
    });
    return issues;
  }, [preview]);

  const errorCount = useMemo(() => {
    let count = 0;
    rowIssues.forEach(issues => {
      if (issues.some(i => i.type === 'error')) count++;
    });
    return count;
  }, [rowIssues]);

  const warningCount = useMemo(() => {
    let count = 0;
    rowIssues.forEach(issues => {
      if (issues.some(i => i.type === 'warning') && !issues.some(i => i.type === 'error')) count++;
    });
    return count;
  }, [rowIssues]);

  const handleSave = () => {
    if (!listName.trim() || preview.length === 0) return;
    if (errorCount > 0) {
      toast({ title: 'Cannot save', description: `Fix ${errorCount} errors before saving.`, variant: 'destructive' });
      return;
    }

    const newList: PredictionList = {
      id: `pl-${Date.now()}`,
      name: listName,
      uploadedAt: new Date().toISOString(),
      totalRecords: preview.length,
      assignedCount: 0,
      entries: preview.map((entry, i) => ({
        ...entry,
        id: `pe-${Date.now()}-${i}`,
        status: 'not_contacted' as const,
        assignedAgentId: null,
        assignedAgentName: null,
        notes: '',
      })),
    };

    setLists(prev => [newList, ...prev]);
    setUploadOpen(false);
    setPreview([]);
    setListName('');
    setFileName('');
    toast({ title: 'List imported', description: `${newList.totalRecords} records saved.` });
  };

  const resetUpload = () => {
    setUploadOpen(false);
    setPreview([]);
    setFileName('');
    setListName('');
  };

  return (
    <AppLayout title="Prediction Lists">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{lists.length} prediction lists</p>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" /> Upload Excel
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">List Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date Uploaded</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total Records</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assigned</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lists.map(list => (
              <tr key={list.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    {list.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(list.uploadedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-semibold">{list.totalRecords}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-sm font-medium', list.assignedCount === list.totalRecords && list.totalRecords > 0 ? 'text-green-600' : 'text-muted-foreground')}>
                    {list.assignedCount}/{list.totalRecords}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/predictions/${list.id}`} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </td>
              </tr>
            ))}
            {lists.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No prediction lists yet. Upload an Excel file to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Upload Prediction List</DialogTitle>
            <DialogDescription>Upload an Excel file with columns: Name, Telephone, Address, City, Product</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-auto py-2">
            {preview.length === 0 ? (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-12 hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Click to select XLS/XLSX file</span>
                <span className="text-xs text-muted-foreground">Required columns: Name, Telephone</span>
                <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileUpload} />
              </label>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-muted-foreground shrink-0">List Name</label>
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter a name for this list"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-600" />
                    {preview.length} records found
                  </span>
                  {errorCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-destructive font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {errorCount} errors
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-warning font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {warningCount} warnings
                    </span>
                  )}
                </div>

                <div className="overflow-auto rounded-lg border max-h-72">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Telephone</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">City</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 100).map((row, i) => {
                        const issues = rowIssues.get(i);
                        const hasError = issues?.some(iss => iss.type === 'error');
                        return (
                          <tr key={i} className={cn('border-b last:border-0', hasError ? 'bg-destructive/5' : issues ? 'bg-warning/5' : '')}>
                            <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                            <td className={cn('px-3 py-1.5', !row.name.trim() && 'text-destructive italic')}>
                              {row.name || 'Empty'}
                            </td>
                            <td className={cn('px-3 py-1.5 font-mono', !row.telephone.trim() && 'text-destructive italic')}>
                              {row.telephone || 'Empty'}
                            </td>
                            <td className="px-3 py-1.5">{row.city}</td>
                            <td className="px-3 py-1.5">{row.product}</td>
                            <td className="px-3 py-1.5">
                              {issues && (
                                <div className="space-y-0.5">
                                  {issues.map((iss, j) => (
                                    <span key={j} className={cn('block text-[10px] leading-tight', iss.type === 'error' ? 'text-destructive' : 'text-warning')}>
                                      {iss.message}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={resetUpload}>Cancel</Button>
            <Button onClick={handleSave} disabled={preview.length === 0 || !listName.trim() || errorCount > 0}>
              {errorCount > 0 ? `Fix ${errorCount} errors to save` : `Save List (${preview.length} records)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
