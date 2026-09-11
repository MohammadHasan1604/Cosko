import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground text-center">
      <h1 className="text-4xl font-extrabold mb-2">404 — Page Not Found</h1>
      <p className="text-muted-foreground mb-6">The requested route does not exist in COSKO System.</p>
      <Link href="/dashboard" className="btn-primary text-xs font-bold px-4 py-2">
        Return to Dashboard
      </Link>
    </div>
  );
}