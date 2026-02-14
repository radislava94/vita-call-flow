import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { mockData } from '@/data/mockData';
import { PredictionList, PredictionEntry } from '@/types';
import { Upload, Eye, FileSpreadsheet, X, Check } from 'lucide-react';
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

export default function PredictionListsPage() {
  const [lists, setLists] = useState<PredictionList[]>(mockData.predictionLists);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<Omit<PredictionEntry, 'id' | 'status' | 'assignedAgentId' | 'assignedAgentName' | 'notes'>[]>([]);
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
        name: row['Name'] || row['name'] || row['Nom'] || '',
        telephone: row['Telephone'] || row['telephone'] || row['Phone'] || row['phone'] || row['Téléphone'] || '',
        address: row['Address'] || row['address'] || row['Adresse'] || '',
        city: row['City'] || row['city'] || row['Ville'] || '',
        product: row['Product'] || row['product'] || row['Produit'] || '',
      })).filter(r => r.name || r.telephone);

      setPreview(mapped);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = () => {
    if (!listName.trim() || preview.length === 0) return;

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
                <td className="px-4 py-3 font-medium flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  {list.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(list.uploadedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-semibold">{list.totalRecords}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${list.assignedCount === list.totalRecords && list.totalRecords > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
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
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Upload Prediction List</DialogTitle>
            <DialogDescription>Upload an Excel file with columns: Name, Telephone, Address, City, Product</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-auto">
            {preview.length === 0 ? (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-10 hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to select XLS/XLSX file</span>
                <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileUpload} />
              </label>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-muted-foreground">List Name</label>
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  <Check className="inline h-4 w-4 text-green-600 mr-1" />
                  {preview.length} records found in <span className="font-mono text-xs">{fileName}</span>
                </p>
                <div className="overflow-auto rounded-lg border max-h-64">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Telephone</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">City</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5">{row.name}</td>
                          <td className="px-3 py-1.5 font-mono">{row.telephone}</td>
                          <td className="px-3 py-1.5">{row.city}</td>
                          <td className="px-3 py-1.5">{row.product}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setPreview([]); setFileName(''); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={preview.length === 0 || !listName.trim()}>
              Save List ({preview.length} records)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
