import React, { useEffect, useMemo, useRef, useState } from "react";

// ====== Static Auth (username + password tetap) ======
const VALID_USERNAME = "kitakita";
const VALID_PASSWORD = "Terang"; // case-sensitive
const SESSION_KEY = "financeSession-v1"; // true/false

// ====== Finance storage ======
const STORAGE_KEY = "financeEntries-v1";
const currencyFmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function toISODate(d) { if (!d) return ""; const dt = new Date(d); const off = dt.getTimezoneOffset(); const fixed = new Date(dt.getTime() - off * 60 * 1000); return fixed.toISOString().split("T")[0]; }
function fromISODate(iso) { if (!iso) return new Date(); return new Date(iso); }

const DEFAULT_CATEGORIES = ["Gaji", "Makan & Minum", "Transportasi", "Tagihan", "Belanja", "Kesehatan", "Edukasi", "Hiburan", "Lainnya"];

export default function App() {
  // ===== Auth state (static) =====
  const [loggedIn, setLoggedIn] = useState(() => {
    try { return !!JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return false; }
  });

  // ===== App state (only used when logged in) =====
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("Makan & Minum");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [customCategory, setCustomCategory] = useState("");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState(null);

  // Report state
  const [reportMode, setReportMode] = useState("name"); // 'name' | 'type'
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportPaid, setReportPaid] = useState("all"); // all | paid | unpaid

  const amountRef = useRef(null);

  // Load entries only when logged in
  useEffect(() => {
    if (!loggedIn) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setEntries(raw ? JSON.parse(raw) : []);
    } catch { setEntries([]); }
  }, [loggedIn]);

  // Persist entries when they change
  useEffect(() => {
    if (!loggedIn) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, loggedIn]);

  // ===== Derived =====
  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    entries.forEach((e) => set.add(e.category));
    if (customCategory.trim()) set.add(customCategory.trim());
    return Array.from(set);
  }, [entries, customCategory]);

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => (q ? (e.name || "").toLowerCase().includes(q.toLowerCase()) : true))
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [entries, q]
  );

  const reportSource = useMemo(() => {
    return entries
      .filter((e) => (reportFrom ? toISODate(e.date) >= reportFrom : true))
      .filter((e) => (reportTo ? toISODate(e.date) <= reportTo : true))
      .filter((e) => (reportPaid === "all" ? true : reportPaid === "paid" ? !!e.paid : !e.paid));
  }, [entries, reportFrom, reportTo, reportPaid]);

  function aggregateBy(list, keyFn) {
    const map = new Map();
    for (const it of list) {
      const key = keyFn(it);
      if (!map.has(key)) map.set(key, { key, income: 0, expense: 0, count: 0 });
      const r = map.get(key);
      if (it.type === "income") r.income += it.amount; else r.expense += it.amount;
      r.count += 1;
    }
    const rows = Array.from(map.values()).map((r) => ({ ...r, balance: r.income - r.expense }));
    rows.sort((a, b) => b.balance - a.balance);
    return rows;
  }

  const reportRows = useMemo(() => {
    if (reportMode === "name") return aggregateBy(reportSource, (it) => it.name || "(Tanpa Nama)");
    return aggregateBy(reportSource, (it) => (it.type === "income" ? "Pemasukan" : "Pengeluaran"));
  }, [reportSource, reportMode]);

  const totals = useMemo(() => {
    let income = 0, expense = 0, count = 0;
    for (const it of reportSource) { if (it.type === "income") income += it.amount; else expense += it.amount; count++; }
    return { income, expense, balance: income - expense, count };
  }, [reportSource]);

  // ===== CRUD =====
  function resetForm() {
    setName("");
    setType("expense");
    setAmount(0);
    setNote("");
    setCategory("Makan & Minum");
    setDate(toISODate(new Date()));
    setCustomCategory("");
    setEditingId(null);
    amountRef.current?.focus();
  }

  function addOrUpdateEntry(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!name.trim()) return alert("Nama harus diisi");
    if (!amt || amt <= 0) return alert("Nominal harus lebih dari 0");
    const cat = customCategory.trim() || category;

    if (editingId) {
      setEntries((prev) =>
        prev.map((en) =>
          en.id === editingId
            ? { ...en, name, type, amount: Math.round(amt), category: cat, note, date: fromISODate(date) }
            : en
        )
      );
    } else {
      const newEntry = {
        id: uid(),
        name: name.trim(),
        type,
        amount: Math.round(amt),
        category: cat,
        note: note.trim(),
        date: fromISODate(date),
        paid: false,
      };
      setEntries((prev) => [newEntry, ...prev]);
    }
    resetForm();
  }

  function removeEntry(id) {
    if (!confirm("Yakin ingin menghapus transaksi ini?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function togglePaid(id) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, paid: !e.paid } : e)));
  }

  function editEntry(entry) {
    setEditingId(entry.id);
    setName(entry.name);
    setType(entry.type);
    setAmount(entry.amount);
    setCategory(entry.category);
    setNote(entry.note);
    setDate(toISODate(entry.date));
  }

  // ===== Auth helpers =====
  function handleLogin(username, password) {
    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(true));
      setLoggedIn(true);
    } else {
      alert("Username atau password salah");
    }
  }
  function handleLogout() {
    localStorage.setItem(SESSION_KEY, JSON.stringify(false));
    setLoggedIn(false);
    setEditingId(null);
  }

  // ===== Screens =====
  if (!loggedIn) {
    return (
      <AuthLayout title="Masuk">
        <LoginUPForm onLogin={handleLogin} />
        <div className="text-xs text-slate-500 mt-3">Gunakan username <b>kitakita</b> dan password <b>Terang</b> (case-sensitive). Data tetap disimpan lokal (localStorage).</div>
      </AuthLayout>
    );
  }

  // ===== Main App (after login) =====
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold">📒 Pencatatan Keuangan</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{VALID_USERNAME}</span>
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-white border shadow-sm hover:bg-slate-100">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 grid gap-6">
        {/* Form Tambah/Edit */}
        <section className="bg-white border rounded-2xl p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">{editingId ? "Edit Transaksi" : "Tambah Transaksi"}</h2>
          <form onSubmit={addOrUpdateEntry} className="grid md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="text-sm">Nama</label>
              <input className="w-full mt-1 p-2 border rounded-xl" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama transaksi" />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Jenis</label>
              <select className="w-full mt-1 p-2 border rounded-xl" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Nominal (Rp)</label>
              <input ref={amountRef} className="w-full mt-1 p-2 border rounded-xl" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm">Kategori</label>
              <div className="flex gap-2 mt-1">
                <select className="w-1/2 p-2 border rounded-xl" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
                <input className="w-1/2 p-2 border rounded-xl" type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Atau tulis kategori" />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Tanggal</label>
              <input className="w-full mt-1 p-2 border rounded-xl" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm">Catatan</label>
              <input className="w-full mt-1 p-2 border rounded-xl" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" />
            </div>
            <div className="md:col-span-6 flex gap-2">
              <button className="px-4 py-2 rounded-xl bg-slate-900 text-white shadow hover:opacity-90" type="submit">{editingId ? "Update" : "Simpan"}</button>
              <button className="px-4 py-2 rounded-xl bg-white border shadow-sm" type="button" onClick={resetForm}>Batal</button>
            </div>
          </form>
        </section>

        {/* Daftar Transaksi */}
        <section className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <h2 className="text-xl font-semibold">Daftar Transaksi</h2>
            <input className="p-2 border rounded-xl w-64" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Jenis</th>
                  <th className="px-3 py-2">Kategori</th>
                  <th className="px-3 py-2">Catatan</th>
                  <th className="px-3 py-2 text-right">Nominal</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-2">{toISODate(e.date)}</td>
                    <td className="px-3 py-2">{e.name}</td>
                    <td className="px-3 py-2">{e.type === "income" ? "Pemasukan" : "Pengeluaran"}</td>
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2">{e.note}</td>
                    <td className="px-3 py-2 text-right font-semibold">{currencyFmt.format(e.amount)}</td>
                    <td className="px-3 py-2 flex gap-2">
                      <button onClick={() => togglePaid(e.id)} className={`px-2 py-1 rounded-lg text-sm ${e.paid ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {e.paid ? "Sudah Dibayar" : "Belum Dibayar"}
                      </button>
                      <button onClick={() => editEntry(e)} className="px-2 py-1 text-sm rounded-lg bg-blue-100 text-blue-700">Edit</button>
                      <button onClick={() => removeEntry(e.id)} className="px-2 py-1 text-sm rounded-lg bg-red-100 text-red-700">Hapus</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Tidak ada data cocok dengan pencarian.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Report Section */}
        <section className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Laporan</h2>
              <p className="text-sm text-slate-500">Ringkasan berdasarkan <b>Nama</b> atau <b>Jenis</b>, dengan filter tanggal & status bayar.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="p-2 border rounded-xl" value={reportMode} onChange={(e) => setReportMode(e.target.value)}>
                <option value="name">Berdasarkan Nama</option>
                <option value="type">Berdasarkan Jenis</option>
              </select>
              <input className="p-2 border rounded-xl" type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} placeholder="Dari" />
              <input className="p-2 border rounded-xl" type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} placeholder="Sampai" />
              <select className="p-2 border rounded-xl" value={reportPaid} onChange={(e) => setReportPaid(e.target.value)}>
                <option value="all">Semua Status</option>
                <option value="paid">Sudah Dibayar</option>
                <option value="unpaid">Belum Dibayar</option>
              </select>
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-2xl border p-4"><div className="text-sm text-slate-500">Total Pemasukan</div><div className="text-2xl font-bold">{currencyFmt.format(totals.income)}</div></div>
            <div className="rounded-2xl border p-4"><div className="text-sm text-slate-500">Total Pengeluaran</div><div className="text-2xl font-bold">{currencyFmt.format(totals.expense)}</div></div>
            <div className="rounded-2xl border p-4"><div className="text-sm text-slate-500">Saldo</div><div className="text-2xl font-bold">{currencyFmt.format(totals.balance)}</div></div>
          </div>

          {/* Table report */}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-3 py-2 w-1/3">{reportMode === 'name' ? 'Nama' : 'Jenis'}</th>
                  <th className="px-3 py-2 text-right">Transaksi</th>
                  <th className="px-3 py-2 text-right">Pemasukan</th>
                  <th className="px-3 py-2 text-right">Pengeluaran</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((r) => (
                  <tr key={r.key} className="border-b last:border-b-0">
                    <td className="px-3 py-2">{r.key}</td>
                    <td className="px-3 py-2 text-right">{r.count}</td>
                    <td className="px-3 py-2 text-right">{currencyFmt.format(r.income)}</td>
                    <td className="px-3 py-2 text-right">{currencyFmt.format(r.expense)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{currencyFmt.format(r.balance)}</td>
                  </tr>
                ))}
                {reportRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">Tidak ada data pada rentang dan filter yang dipilih.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

// ===== Auth Components =====
function AuthLayout({ title, children }) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="w-full max-w-sm bg-white border rounded-2xl shadow-sm p-6">
        <h1 className="text-xl font-semibold mb-4 text-center">{title}</h1>
        {children}
        <p className="text-[11px] text-slate-500 mt-4 text-center">Login statis hanya untuk menyembunyikan dari orang lain di perangkat yang sama. Jangan gunakan untuk data sensitif.</p>
      </div>
    </div>
  );
}

function LoginUPForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onLogin(username, password); }}>
      <div>
        <label className="text-sm">Username</label>
        <input className="w-full mt-1 p-2 border rounded-xl" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="kitakita" />
      </div>
      <div>
        <label className="text-sm">Password</label>
        <input className="w-full mt-1 p-2 border rounded-xl" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Terang" />
      </div>
      <button className="px-4 py-2 rounded-xl bg-slate-900 text-white shadow hover:opacity-90" type="submit">Masuk</button>
    </form>
  );
}
