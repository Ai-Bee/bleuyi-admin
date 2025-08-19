import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

export default function Navbar() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const navLinks = [
    { href: '/admin/check-in', label: 'Check-in' },
    { href: '/admin/dashboard', label: 'Dashboard' },
  ];

  return (
    <nav className="w-full bg-white border-b shadow-sm px-4 py-2 flex items-center justify-between">
      <div className="flex gap-4 items-center">
        {navLinks.map(link => {
          const isActive = router.pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                `font-semibold px-2 py-1 rounded transition ` +
                (isActive
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-blue-600 hover:bg-blue-50 hover:underline')
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <button
        onClick={handleLogout}
        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm font-semibold"
      >
        Logout
      </button>
    </nav>
  );
}
