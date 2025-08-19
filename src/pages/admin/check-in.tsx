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
  const [scannerActive, setScannerActive] = useState(false);

  useEffect(() => {
    if (!scannerActive) return;
    const scannerId = 'qr-scanner';
    if (!scannerRef.current || scannedId) return;

    const html5QrCode = new Html5Qrcode(scannerId);
    let selectedCameraId = null;
    let loadingTimeout: NodeJS.Timeout = setTimeout(() => {
      setLoadingCheckIn(false);
    }, 8000);

    setMessage('');
    setLoadingCheckIn(true);
    Html5Qrcode.getCameras().then(cameras => {
      if (cameras && cameras.length) {
        // Prefer back camera (environment facing)
        const backCam = cameras.find(cam => cam.label.toLowerCase().includes('back') || cam.label.toLowerCase().includes('environment'));
        selectedCameraId = backCam ? backCam.id : cameras[0].id;

        html5QrCode.start(
          selectedCameraId,
          {
            fps: 15,
            qrbox: { width: 250, height: 250 }, // square box
            aspectRatio: 1.0,
          },
          async (decodedText: string) => {
            if (decodedText === scannedId) return; // avoid duplicate scans
            setScannedId(decodedText);
            setLoadingCheckIn(true);
            await handleCheckIn(decodedText);
            // Only stop if scanner is running
            if (html5QrCode.getState && html5QrCode.getState() === 2) {
              html5QrCode.stop().then(() => {
                setLoadingCheckIn(false);
                setScannerActive(false);
                console.log('Scanner stopped');
              });
            }
          },
          error => {
            // Only show error if not loading
            if (!loadingCheckIn) setMessage('QR scan error. Try again.');
            console.warn('QR scan error', error);
          }
        );
      } else {
        setMessage('No camera found.');
        setLoadingCheckIn(false);
        setScannerActive(false);
      }
    }).catch(() => {
      setMessage('Unable to access camera.');
      setLoadingCheckIn(false);
      setScannerActive(false);
    });

    // Timeout loading state if camera takes too long
    loadingTimeout = setTimeout(() => {
      setLoadingCheckIn(false);
    }, 8000);

    return () => {
      clearTimeout(loadingTimeout);
      // Only stop if scanner is running
      if (html5QrCode.getState && html5QrCode.getState() === 2) {
        html5QrCode.stop().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerActive, scannedId, loadingCheckIn]);

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
    // Keep camera open after scan unless user closes it
    // setScannerActive(false); // Only close if user clicks 'Close Camera'
  };

  const closeScanner = () => {
    setScannerActive(false);
    setScannedId(null);
    setAttendee(null);
    setMessage('');
  };

  return (
    <div className="p-2 sm:p-4 min-h-screen bg-gray-50 flex flex-col items-center">
      <header className="w-full flex items-center justify-between mb-2 sm:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Check-in Scanner</h1>
        <button
          className="text-blue-600 text-sm px-3 py-1 rounded border border-blue-600 hover:bg-blue-50"
          onClick={() => router.push('/admin/dashboard')}
        >
          Home
        </button>
      </header>

      {!scannerActive && !scannedId && (
        <div className="w-full max-w-xs mx-auto flex flex-col items-center">
          <button
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg text-base font-semibold hover:bg-blue-700 mb-4"
            onClick={() => setScannerActive(true)}
          >
            Start Scanner
          </button>
        </div>
      )}

      {scannerActive && !scannedId && (
        <div className="w-full max-w-xs mx-auto flex flex-col items-center" ref={scannerRef}>
          <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-lg border-2 border-blue-600">
            <div id="qr-scanner" className="absolute inset-0 w-full h-full" />
            {/* Visual scan area overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="border-4 border-blue-500 rounded-lg w-48 h-48" style={{ boxSizing: 'border-box' }}></div>
            </div>
            {loadingCheckIn && (
              <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
                <span className="text-blue-600 font-semibold animate-pulse">Loading camera...</span>
              </div>
            )}
            {/* Close Camera Button */}
            <button
              className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-semibold z-20 shadow hover:bg-red-700"
              onClick={closeScanner}
            >
              Close Camera
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 text-center">Align QR code within the square</p>
        </div>
      )}

      {message && (
        <div className="mt-4 text-center text-base font-medium w-full max-w-xs">
          {loadingCheckIn ? (
            <p className="text-blue-600 animate-pulse">Processing...</p>
          ) : message.includes('✅') ? (
            <p className="text-green-600">{message}</p>
          ) : (
            <p className="text-red-600">{message}</p>
          )}
        </div>
      )}

      {attendee && (
        <div className="mt-4 border p-4 rounded-lg bg-white text-base max-w-xs w-full mx-auto shadow">
          <div className="mb-2"><strong>Name:</strong> {attendee.name}</div>
          <div className="mb-2"><strong>Email:</strong> {attendee.email}</div>
          <div className="mb-2"><strong>Phone:</strong> {attendee.phone || 'N/A'}</div>
          <div className="mb-2"><strong>Plus One:</strong> {attendee.plus_one ? 'Yes' : 'No'}</div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={resetScanner}
              className="w-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg text-base font-semibold hover:bg-blue-700"
            >
              Scan Next
            </button>
            <button
              onClick={closeScanner}
              className="w-1/2 bg-red-600 text-white px-4 py-2 rounded-lg text-base font-semibold hover:bg-red-700"
            >
              Close Camera
            </button>
          </div>
        </div>
      )}

      <hr className="my-8 w-full max-w-xs" />

      <div className="w-full max-w-xs mx-auto">
        <h2 className="text-lg font-semibold mb-2">Manual Check-in</h2>
        <input
          type="text"
          placeholder="Search name or email"
          onChange={async (e) => {
            const query = e.target.value.toLowerCase();
            if (!query) {
              setManualResults([]);
              return;
            }

            setLoadingCheckIn(true);
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
            setLoadingCheckIn(false);
          }}
          className="w-full border px-3 py-3 rounded-lg mb-3 text-base focus:outline-blue-600"
        />

        {manualResults.length > 0 ? (
          <ul className="space-y-3">
            {manualResults.map((a) => (
              <li key={a.id} className="bg-white p-3 border rounded-lg shadow-sm text-base flex flex-col gap-1">
                <div className="font-semibold">{a.name}</div>
                <div className="text-gray-500 text-xs">{a.email}</div>
                <div>Status: {a.status}</div>

                {a.status !== 'checked_in' ? (
                  <button
                    className="mt-2 bg-green-600 text-white px-3 py-2 rounded-lg text-base font-semibold disabled:opacity-50"
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
          <p className="text-base text-gray-500">No results yet.</p>
        )}
      </div>
    </div>
  );
}
