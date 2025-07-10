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
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .order('created_at', { ascending: false });
      console.log({ data });
      if (error) console.error(error);
      else setAttendees(data as Attendee[]);

      setLoading(false);
    };

    fetchAttendees();
  }, []);

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

  return (
    <div className="container">
      <div className="header">
        <h1>RSVP Dashboard</h1>
        <button onClick={handleLogout} className="danger">Logout</button>
      </div>
      {attendees.length === 0 ? (
        <div className="card" style={{textAlign: 'center', color: '#888'}}>No RSVPs yet.</div>
      ) : (
        attendees.map(att => (
          <div key={att.id} className="card">
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{fontWeight:'bold', fontSize:'1.1em'}}>{att.name}</span>
              <span className={`status ${att.status}`}>{att.status.replace('_',' ')}</span>
            </div>
            <div>Email: <b>{att.email}</b></div>
            <div>Phone: <b>{att.phone || 'N/A'}</b></div>
            <div>Plus one: <b>{att.plus_one ? 'Yes' : 'No'}</b></div>
            <div style={{fontSize:'0.9em', color:'#888'}}>RSVP at {new Date(att.created_at).toLocaleString()}</div>
            {att.status === 'pending' && (
              <div style={{marginTop:'1em', display:'flex', gap:'1em'}}>
                <button className="primary" onClick={() => updateStatus(att.id, 'accepted', att)}>Accept</button>
                <button className="danger" onClick={() => updateStatus(att.id, 'rejected')}>Reject</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
