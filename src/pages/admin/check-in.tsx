import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/lib/supabaseClient';

export default function CheckInScanner() {
  const router = useRouter();
  // Redirect if not logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/admin/login');
      }
    });
  }, [router]);
  const scannerRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [loadingCheckIn, setLoadingCheckIn] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [attendee, setAttendee] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [manualResults, setManualResults] = useState<any[]>([]);
  const [scannedId, setScannedId] = useState<string | null>(null);

  useEffect(() => {
    const scannerId = 'qr-scanner';
    if (!scannerRef.current || scannedId) return;

    const html5QrCode = new Html5Qrcode(scannerId);

    Html5Qrcode.getCameras().then(cameras => {
      if (cameras && cameras.length) {
        const cameraId = cameras[0].id;

        html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: 250,
          },
          async (decodedText: string) => {
            if (decodedText === scannedId) return; // avoid duplicate scans
            setScannedId(decodedText);
            await handleCheckIn(decodedText);
            html5QrCode.stop().then(() => {
              console.log('Scanner stopped');
            });
          },
          error => {
            console.warn('QR scan error', error);
          }
        );
      }
    });

    return () => {
      html5QrCode.stop().catch(() => {});
    };
  }, [scannedId]);

  const handleCheckIn = async (data: string) => {
    setMessage('');
    setLoadingCheckIn(true);
    try {
      const extractedId = data.replace('wedding-attendee:', '');
      const { data: match, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('id', extractedId)
        .single();

      if (error || !match) {
        setMessage('Attendee not found ❌');
        setLoadingCheckIn(false);
        return;
      }

      if (match.status === 'checked_in') {
        setMessage(`${match.name} has already been checked in ❗`);
        setAttendee(match);
        setLoadingCheckIn(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('attendees')
        .update({ status: 'checked_in' })
        .eq('id', extractedId);

      if (updateError) {
        setMessage('Check-in failed ⚠️');
      } else {
        setMessage(`${match.name} is now checked in ✅`);
        setAttendee(match);
      }
    } catch (e) {
      console.error(e);
      setMessage('Network or server error. Please try again.');
    } finally {
      setLoadingCheckIn(false);
    }
  };

  const resetScanner = () => {
    setAttendee(null);
    setMessage('');
    setScannedId(null);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Check-in Scanner</h1>

      {!scannedId && (
        <div className="max-w-md mx-auto" ref={scannerRef}>
          <div id="qr-scanner" className="w-full aspect-square rounded overflow-hidden shadow" />
        </div>
      )}

      {message && (
        <div className="mt-4 text-center text-sm font-medium">
          {loadingCheckIn ? (
            <p className="text-blue-600">Processing...</p>
          ) : message.includes('✅') ? (
            <p className="text-green-600">{message}</p>
          ) : (
            <p className="text-red-600">{message}</p>
          )}
        </div>
      )}

      {attendee && (
        <div className="mt-4 border p-3 rounded bg-white text-sm max-w-md mx-auto">
          <div><strong>Name:</strong> {attendee.name}</div>
          <div><strong>Email:</strong> {attendee.email}</div>
          <div><strong>Phone:</strong> {attendee.phone || 'N/A'}</div>
          <div><strong>Plus One:</strong> {attendee.plus_one ? 'Yes' : 'No'}</div>

          <button
            onClick={resetScanner}
            className="mt-4 bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
          >
            Scan Next
          </button>
        </div>
      )}
      <hr className="my-8" />

<div className="max-w-md mx-auto">
  <h2 className="text-xl font-semibold mb-2">Manual Check-in</h2>
  <input
    type="text"
    placeholder="Search name or email"
    onChange={async (e) => {
      const query = e.target.value.toLowerCase();
      if (!query) {
        setManualResults([]);
        return;
      }

      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`);

      if (error) {
        console.error(error);
        setManualResults([]);
      } else {
        setManualResults(data || []);
      }
    }}
    className="w-full border px-3 py-2 rounded mb-3"
  />

  {manualResults.length > 0 ? (
    <ul className="space-y-3">
      {manualResults.map((a) => (
        <li key={a.id} className="bg-white p-3 border rounded shadow-sm text-sm">
          <div className="font-semibold">{a.name}</div>
          <div className="text-gray-500 text-xs">{a.email}</div>
          <div>Status: {a.status}</div>

          {a.status !== 'checked_in' ? (
            <button
              className="mt-2 bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
              disabled={loadingCheckIn}
              onClick={async () => {
                setLoadingCheckIn(true);
                setMessage('');
                try {
                  const { error } = await supabase
                    .from('attendees')
                    .update({ status: 'checked_in' })
                    .eq('id', a.id);
                  if (!error) {
                    setMessage(`${a.name} checked in manually ✅`);
                    setAttendee(a);
                  } else {
                    setMessage('Error checking in');
                  }
                } catch (e) {
                  console.error(e);
                  setMessage('Network or server error. Please try again.');
                } finally {
                  setLoadingCheckIn(false);
                }
              }}
            >
              {loadingCheckIn ? 'Checking in...' : 'Check In'}
            </button>
          ) : (
            <div className="text-red-500 text-xs mt-1">Already checked in</div>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-gray-500">No results yet.</p>
  )}
</div>

    </div>
  );
}
