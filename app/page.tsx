import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  BookOpen,
  LogIn,
  Menu,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCheck,
  UsersRound,
  Zap,
} from "lucide-react";

const navItems = [
  { label: "Fitur", href: "#fitur", icon: Sparkles },
  { label: "Cara Kerja", href: "#cara-kerja", icon: BookOpen },
  { label: "Harga", href: "/harga", icon: CreditCard },
  { label: "Panduan", href: "/panduan", icon: BookOpen },
  { label: "Keamanan", href: "#keamanan", icon: ShieldCheck },
];

const features = [
  {
    title: "Suara benar-benar rahasia",
    description:
      "Tabel suara tidak menyimpan identitas pemilih sama sekali. Panitia pun tidak bisa melihat siapa memilih siapa.",
    icon: ShieldCheck,
    wide: true,
  },
  {
    title: "Satu orang, satu suara",
    description:
      "Token sekali pakai dikunci di tingkat basis data. Klik ganda atau dua perangkat tetap terhitung satu.",
    icon: UserCheck,
  },
  {
    title: "Hasil langsung terlihat",
    description:
      "Perolehan dan angka partisipasi bergerak di layar panitia tanpa rekap manual.",
    icon: Zap,
  },
  {
    title: "Siap dalam 10 menit",
    description:
      "Unggah daftar pemilih dari Excel, sistem membuatkan token untuk setiap orang, tinggal dibagikan.",
    icon: Timer,
    wide: true,
  },
];

const steps = [
  ["01", "Buat pemilihan & unggah DPT", "Atur judul, jadwal, mode voting, lalu masukkan daftar pemilih resmi."],
  ["02", "Bagikan token ke pemilih", "Setiap pemilih mendapat token unik yang hanya bisa dipakai satu kali."],
  ["03", "Pantau hasil secara langsung", "Partisipasi dan perolehan suara tampil otomatis di dashboard panitia."],
];

const plans = [
  ["Starter", "Rp 0", "100 pemilih", "1 pemilihan aktif", "ONLINE_ONLY"],
  ["Pro", "Rp 299.000", "2.000 pemilih", "Semua mode voting", "PDF berita acara"],
  ["Enterprise", "Mulai Rp 2.500.000", "Tanpa batas", "Custom domain", "Dukungan prioritas"],
];

export default function Home() {
  return (
    <main className="min-h-dvh bg-muted text-foreground">
      <header className="sticky top-0 z-50 h-[72px] border-b border-border bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight"
          >
            <Image
              src="/favicon-32x32.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
              priority
            />
            <span className="tracking-tight">
              <span className="text-primary">Ayo</span>Pilih
            </span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <item.icon
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap font-medium">{item.label}</span>
                <span
                  className={`absolute bottom-0 left-4 right-4 h-0.5 rounded-full transition-colors ${
                    index === 0 ? "bg-primary" : "bg-transparent group-hover:bg-primary"
                  }`}
                />
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/masuk"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Masuk
            </Link>
            <button className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card md:hidden" aria-label="Buka menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      <section className="border-b border-border bg-muted bg-[radial-gradient(hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:24px_24px]">
        <div className="mx-auto grid max-w-6xl gap-16 px-4 py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-32">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
              Pemilihan yang<br />hasilnya tidak<br />bisa diragukan<span className="text-primary">.</span>
            </h1>
            <p className="mt-8 max-w-md text-lg leading-relaxed text-muted-foreground">
              Siapkan pemilihan dalam sepuluh menit. Suara terkunci di tingkat basis data, hasil terlihat saat itu juga.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="/masuk" className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary-hover">
                Masuk Panitia
              </Link>
              <Link href="#cara-kerja" className="inline-flex h-14 items-center gap-2 text-base font-semibold">
                Lihat cara kerjanya <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Hubungi kami untuk mendaftarkan organisasimu.</p>
          </div>

          <div className="relative mx-auto w-full max-w-md pb-8 pl-6">
            <div className="absolute bottom-0 left-0 w-56 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between text-sm font-semibold">
                <span>Live count</span>
                <span className="font-mono text-primary">72%</span>
              </div>
              {["01", "02", "03"].map((number, index) => (
                <div key={number} className="mb-3 last:mb-0">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Paslon {number}</span>
                    <span>{[128, 96, 41][index]}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${[82, 58, 25][index]}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="relative rotate-1 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="candidate-number">01</div>
              <div className="relative pt-12">
                <p className="text-sm text-muted-foreground">Bilik suara</p>
                <h2 className="mt-2 font-display text-2xl font-bold">Pemilihan Ketua OSIS 2026</h2>
                <div className="mt-6 rounded-2xl border-2 border-primary bg-background p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Paslon 01</p>
                      <p className="text-lg font-semibold">Raka & Naya</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <button className="mt-5 h-14 w-full rounded-full bg-primary font-semibold text-primary-foreground">Kirim Suara</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="border-b border-border py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Fitur yang membuat panitia tenang</h2>
            <p className="mt-4 text-muted-foreground">Setiap bagian dirancang untuk mengurangi celah kecurangan dan mempercepat rekap.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className={`rounded-2xl border border-border bg-card p-8 transition-colors hover:border-primary/40 ${feature.wide ? "md:col-span-2" : ""}`}>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{feature.description}</p>
                {feature.wide && <ProductStrip variant={feature.title} />}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted bg-[radial-gradient(hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:24px_24px] py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 rounded-3xl bg-foreground p-12 text-background lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:p-16">
            <Stat value="100" label="Pemilih gratis, tanpa biaya" />
            <div className="hidden w-px bg-background/20 lg:block" />
            <Stat value="3" label="Mode pemilihan: daring, TPS, hybrid" />
            <div className="hidden w-px bg-background/20 lg:block" />
            <Stat value="10 menit" label="Dari daftar sampai pemilihan siap" />
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="border-b border-border py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Cara kerja</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(([number, title, description]) => (
              <article key={number} className="rounded-2xl border border-border bg-card p-8">
                <p className="font-display text-6xl font-extrabold text-secondary">{number}</p>
                <h3 className="mt-8 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="harga" className="border-b border-border py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Harga yang masuk akal untuk panitia</h2>
            <p className="mt-4 text-muted-foreground">Mulai gratis, naik paket hanya saat skala pemilihan membutuhkan.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {plans.map(([name, price, voters, mode, extra]) => (
              <article key={name} className={`relative rounded-2xl border bg-card p-8 ${name === "Pro" ? "border-2 border-primary" : "border-border"}`}>
                {name === "Pro" && <span className="absolute right-6 top-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Paling banyak dipilih</span>}
                <h3 className="text-lg font-semibold">{name}</h3>
                <p className="mt-4 font-display text-3xl font-bold">{price}</p>
                <div className="mt-8 space-y-3 text-sm text-muted-foreground">
                  {[voters, mode, extra].map((item) => <p key={item} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{item}</p>)}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="keamanan" className="border-b border-border py-24">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold md:text-4xl">Keamanan yang bisa dijelaskan setelah hasil diumumkan</h2>
            <p className="mt-4 text-muted-foreground">AyoPilih memisahkan identitas pemilih dari pilihan. Bukti suara hanya membuktikan suara tercatat, bukan membuka pilihan.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SecurityCard icon={ShieldCheck} title="Tanpa voter_id di suara" />
            <SecurityCard icon={Timer} title="Sesi bilik 10 menit" />
            <SecurityCard icon={ClipboardList} title="Audit log panitia" />
            <SecurityCard icon={UsersRound} title="Isolasi multi-tenant" />
          </div>
        </div>
      </section>

      <footer className="bg-foreground px-4 py-12 text-background/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="font-display text-2xl font-extrabold tracking-tight text-background">
              <span className="text-primary">Ayo</span>Pilih
            </Link>
            <p className="mt-3 text-sm text-background/50">© 2026 AyoPilih. Layanan e-voting untuk sekolah, kampus, dan organisasi.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

function ProductStrip({ variant }: { variant: string }) {
  const isSecret = variant.startsWith("Suara");
  return (
    <div className="mt-8 rounded-2xl border border-border bg-background p-4">
      {isSecret ? (
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          {["Paslon", "Total", "Persentase"].map((head) => <span key={head} className="font-semibold text-foreground">{head}</span>)}
          <span>01</span><span>128 suara</span><span>48%</span>
          <span>02</span><span>96 suara</span><span>36%</span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {["Data pemilihan", "Unggah DPT", "Generate token"].map((item, index) => (
            <div key={item} className="rounded-xl border border-border bg-card p-3 text-sm">
              <span className="font-mono text-primary">0{index + 1}</span>
              <p className="mt-2 font-semibold">{item}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-6xl font-extrabold text-primary/70 lg:text-7xl">{value}</p>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-background/60">{label}</p>
    </div>
  );
}

function SecurityCard({ icon: Icon, title }: { icon: typeof ShieldCheck; title: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="font-semibold">{title}</p>
    </div>
  );
}
