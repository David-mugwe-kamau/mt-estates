export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">MT Estates</p>
      <h1 className="mt-2 text-4xl font-extrabold text-slate-900">404</h1>
      <p className="mt-2 text-slate-600">This page could not be found.</p>
      <a href="/" className="mt-6 rounded-full bg-mt-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-mt-blue/90">
        Back home
      </a>
    </div>
  );
}
