import Link from "next/link";
import { AttendanceForm } from "./attendance-form";

export default function AttendancePage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-xl space-y-8">
        <Link className="text-sm font-semibold text-amber-400" href="/">
          ← Player ratings
        </Link>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">Admin</p>
          <h1 className="text-4xl font-black tracking-tight">Friday attendance</h1>
          <p className="text-slate-300">Draft session · 21 August 2026</p>
        </header>
        <AttendanceForm />
      </section>
    </main>
  );
}
