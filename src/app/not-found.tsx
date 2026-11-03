import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0E17] flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-extrabold text-white mb-2">404 - Page Not Found</h1>
      <p className="text-slate-400 mb-6 max-w-md">
        The trading page or resource you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 transition-all"
      >
        Return to Terminal
      </Link>
    </div>
  );
}
