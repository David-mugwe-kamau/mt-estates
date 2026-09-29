export default function SellPropertyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">Sell with trust</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Sell Your Property Through MT Estates</h1>
        <p className="text-slate-600">
          To protect buyers and sellers, MT Estates reviews every property before it is listed for sale.
          Contact our team and we will guide you through the verification and listing process.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Call / WhatsApp</p>
            <p className="mt-1 font-semibold text-slate-900">+254 700 000 000</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
            <p className="mt-1 font-semibold text-slate-900">sales@mtestates.co.ke</p>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Note: Sale listings are published by MT Estates after verification and approval.
        </p>
      </div>
    </div>
  );
}

