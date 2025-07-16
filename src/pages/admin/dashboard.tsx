import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/router';

type Attendee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  plus_one: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'checked_in';
  created_at: string;
};


export default function AdminDashboard() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const router = useRouter();

  const handleLogout = async () => {
  await supabase.auth.signOut();
  router.push('/admin/login');
};

  // Redirect if not logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/admin/login');
      }
    });
  }, []);


  useEffect(() => {
    const fetchAttendees = async () => {
      let query = supabase
        .from('attendees')
        .select('*');

      // Filter by status
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Sort by registration date
      query = query.order('created_at', { ascending: sortOrder === 'asc' });

      const { data, error } = await query;
      if (error) console.error(error);
      else setAttendees(data as Attendee[]);
      setLoading(false);
    };
    setLoading(true);
    fetchAttendees();
  }, [statusFilter, sortOrder]);

  const updateStatus = async (id: string, newStatus: Attendee['status'], attendee?: Attendee) => {
    const { error } = await supabase
      .from('attendees')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error(error);
    } else {
      setAttendees(prev =>
        prev.map(a => (a.id === id ? { ...a, status: newStatus } : a))
      );

      // Send QR email only if accepted
      if (newStatus === 'accepted' && attendee) {
        await fetch('/api/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: attendee.id,
            name: attendee.name,
            email: attendee.email,
          }),
        });
      }
    }
  };


if (loading) return (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-lg text-gray-600">Loading...</div>
  </div>
);

  // Filter attendees by search
  const filteredAttendees = attendees.filter(att =>
    att.name.toLowerCase().includes(search.toLowerCase()) ||
    att.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 py-8 px-2">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 border border-amber-100">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold text-amber-600 tracking-tight">RSVP Dashboard</h1>
          <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg font-semibold shadow transition">Logout</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm"
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="checked_in">Checked In</option>
          </select>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm">
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
        {filteredAttendees.length === 0 ? (
          <div className="text-center text-gray-400 text-lg py-12">No RSVPs yet.</div>
        ) : (
          <div className="space-y-6">
            {filteredAttendees.map(att => (
              <div key={att.id} className="bg-gradient-to-br from-white to-amber-50 border border-amber-100 rounded-xl shadow p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-2 gap-2">
                  <span className="font-semibold text-lg text-gray-800">{att.name}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize shadow-sm 
                    ${att.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${att.status === 'accepted' ? 'bg-green-100 text-green-700' : ''}
                    ${att.status === 'rejected' ? 'bg-red-100 text-red-700' : ''}
                    ${att.status === 'checked_in' ? 'bg-blue-100 text-blue-700' : ''}
                  `}>{att.status.replace('_',' ')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-gray-700 text-sm mb-2">
                  <div>Email: <span className="font-medium">{att.email}</span></div>
                  <div>Phone: <span className="font-medium">{att.phone || 'N/A'}</span></div>
                  <div>Plus one: <span className="font-medium">{att.plus_one ? 'Yes' : 'No'}</span></div>
                  <div>RSVP at <span className="font-medium">{new Date(att.created_at).toLocaleString()}</span></div>
                </div>
                {att.status === 'pending' && (
                  <div className="flex gap-4 mt-4">
                    <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold shadow transition" onClick={() => updateStatus(att.id, 'accepted', att)}>Accept</button>
                    <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold shadow transition" onClick={() => updateStatus(att.id, 'rejected')}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
