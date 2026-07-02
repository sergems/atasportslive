import { Link } from "wouter";
import { Home, AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
      <div className="text-center px-6">
        <p className="text-8xl font-black text-slate-700 select-none">404</p>
        <div className="flex items-center justify-center gap-2 mt-4 mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h1 className="text-xl font-semibold text-white">Page not found</h1>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <button className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-5 py-2.5 rounded-md transition-colors text-sm">
            <Home className="h-4 w-4" />
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  );
}
