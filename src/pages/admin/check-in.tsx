import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabaseClient';

export default function CheckInScanner() {
  const router = useRouter();
  type Attendee = {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    plus_one?: boolean | null;
    status: 'pending' | 'checked_in' | string;
  };
  // Redirect if not logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/admin/login');
      }
    });
  }, [router]);
  const [message, setMessage] = useState('');
  // const scannerRef = useRef<HTMLDivElement>(null);
  // const qrInstanceRef = useRef<Html5Qrcode | null>(null);
  // const [scannedId, setScannedId] = useState<string | null>(null);
  // const [scannerActive, setScannerActive] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(true);
  const [search, setSearch] = useState('');
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'pending'>('all');

  // Load all attendees initially so the list shows completely by default
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingAttendees(true);
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .order('name', { ascending: true });
      if (!mounted) return;
      if (error) {
        console.error(error);
        setAttendees([]);
      } else {
        setAttendees((data || []) as Attendee[]);
      }
      setLoadingAttendees(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredAttendees = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = attendees;
    if (q) {
      base = base.filter((a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      base = base.filter((a) => a.status === statusFilter);
    }
    return base;
  }, [attendees, search, statusFilter]);

  const stats = useMemo(() => {
    const total = attendees.length;
    const checked = attendees.filter((a) => a.status === 'checked_in').length;
    return { total, checked, pending: total - checked };
  }, [attendees]);

  // NOTE: QR scanner feature is disabled for now.
  // useEffect(() => { /* Scanner disabled */ }, []);

  // const handleCheckIn = async (data: string) => { /* Scanner disabled */ };

  const manualCheckIn = async (a: Attendee) => {
    setMessage('');
    setCheckingIds((s) => new Set(s).add(a.id));
    try {
      const { error } = await supabase
        .from('attendees')
        .update({ status: 'checked_in' })
        .eq('id', a.id);
      if (!error) {
        setMessage(`${a.name} checked in ✅`);
        setAttendees((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: 'checked_in' } : x)));
      } else {
        setMessage('Error checking in');
      }
    } catch (e) {
      console.error(e);
      setMessage('Network or server error. Please try again.');
    } finally {
      setCheckingIds((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }
  };
  const undoCheckIn = async (a: Attendee) => {
    setMessage('');
    setCheckingIds((s) => new Set(s).add(a.id));
    try {
      const { error } = await supabase
        .from('attendees')
        .update({ status: 'pending' })
        .eq('id', a.id);
      if (!error) {
        setMessage(`${a.name} reverted to pending ⏪`);
        setAttendees((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: 'pending' } : x)));
      } else {
        setMessage('Error undoing check-in');
      }
    } catch (e) {
      console.error(e);
      setMessage('Network or server error. Please try again.');
    } finally {
      setCheckingIds((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }
  };
  // const resetScanner = () => { /* Scanner disabled */ };
  // const closeScanner = () => { /* Scanner disabled */ };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Event Check-in</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="rounded-full bg-white px-3 py-1 shadow-sm">Total: <strong>{stats.total}</strong></span>
              <span className="rounded-full bg-green-50 text-green-700 px-3 py-1 shadow-sm">Checked in: <strong>{stats.checked}</strong></span>
              <span className="rounded-full bg-amber-50 text-amber-700 px-3 py-1 shadow-sm">Pending: <strong>{stats.pending}</strong></span>
            </div>
          </header>

          {message && (
            <div className="mb-4">
              <div className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${message.includes('✅') ? 'border-green-200 bg-green-50 text-green-700' : message.includes('❌') || message.includes('⚠️') ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                {checkingIds.size > 0 ? 'Processing...' : message}
              </div>
            </div>
          )}

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="text"
                  placeholder="Search by name, email, or phone"
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none ring-0 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                    aria-label="Clear search"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex shrink-0 rounded-lg border bg-gray-50 p-1 text-xs font-medium">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'checked_in', label: 'Checked In' }
                ].map(btn => (
                  <button
                    key={btn.key}
                    onClick={() => setStatusFilter(btn.key as 'all' | 'checked_in' | 'pending')}
                    className={`rounded-md px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      statusFilter === btn.key
                        ? 'bg-white shadow-sm text-blue-700'
                        : 'text-gray-600 hover:bg-white/70'
                    }`}
                    type="button"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingAttendees ? (
              <div className="py-10 text-center text-sm text-gray-500">Loading attendees…</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full table-auto border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="text-left text-xs text-gray-600">
                      <th className="border-b px-3 py-3 font-semibold">Name</th>
                      <th className="border-b px-3 py-3 font-semibold">Contact</th>
                      <th className="border-b px-3 py-3 font-semibold">Plus One</th>
                      <th className="border-b px-3 py-3 font-semibold">Status</th>
                      <th className="border-b px-3 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendees.map((a) => {
                      const isChecked = a.status === 'checked_in';
                      const isLoading = checkingIds.has(a.id);
                      return (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="border-b px-3 py-3 font-medium">{a.name}</td>
                          <td className="border-b px-3 py-3 text-gray-600">{a.email || a.phone || '—'}</td>
                          <td className="border-b px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${a.plus_one ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                              {a.plus_one ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="border-b px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${isChecked ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                              {isChecked ? 'Checked in' : 'Pending'}
                            </span>
                          </td>
                          <td className="border-b px-3 py-3">
                            {!isChecked ? (
                              <button
                                disabled={isLoading}
                                onClick={() => manualCheckIn(a)}
                                className={`rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm ${isLoading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                {isLoading ? 'Checking…' : 'Check In'}
                              </button>
                            ) : (
                              <button
                                disabled={isLoading}
                                onClick={() => undoCheckIn(a)}
                                className={`rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm ${isLoading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}`}
                              >
                                {isLoading ? 'Reverting…' : 'Undo'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAttendees.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-gray-500">No attendees match your search.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
