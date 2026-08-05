import { Link } from 'react-router-dom';
import { Droplet } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Droplet className="h-14 w-14 text-brand-500" fill="currentColor" aria-hidden />
      <h1 className="text-6xl font-black text-gradient">404</h1>
      <p className="text-white/50">This page could not be found.</p>
      <Link to="/" className="btn-primary mt-2">Back to home</Link>
    </div>
  );
}
