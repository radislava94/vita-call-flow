import { useQuery } from '@tanstack/react-query';
import { apiGetMyShifts } from '@/lib/api';
import { AppLayout } from '@/layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CalendarIcon } from 'lucide-react';
import { format, isToday, isFuture, isPast } from 'date-fns';

interface Shift {
  id: string; name: string; date: string; start_time: string; end_time: string;
}

export default function MyShiftsPage() {
  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ['my-shifts'],
    queryFn: apiGetMyShifts,
  });

  const todayShifts = shifts.filter(s => isToday(new Date(s.date)));
  const upcomingShifts = shifts.filter(s => isFuture(new Date(s.date)));
  const pastShifts = shifts.filter(s => isPast(new Date(s.date)) && !isToday(new Date(s.date)));

  const ShiftCard = ({ shift, highlight }: { shift: Shift; highlight?: boolean }) => (
    <Card className={highlight ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">{shift.name}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{format(new Date(shift.date), 'EEE, MMM d, yyyy')}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</span>
          </div>
        </div>
        {isToday(new Date(shift.date)) && <Badge className="bg-primary text-primary-foreground">Today</Badge>}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout title="My Shifts">
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">My Shifts</h1>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : shifts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No shifts assigned to you</div>
        ) : (
          <>
            {todayShifts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Today</h2>
                <div className="space-y-2">{todayShifts.map(s => <ShiftCard key={s.id} shift={s} highlight />)}</div>
              </div>
            )}
            {upcomingShifts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h2>
                <div className="space-y-2">{upcomingShifts.map(s => <ShiftCard key={s.id} shift={s} />)}</div>
              </div>
            )}
            {pastShifts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past</h2>
                <div className="space-y-2">{pastShifts.map(s => <ShiftCard key={s.id} shift={s} />)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
