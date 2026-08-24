import Link from "next/link";
import { Check, X, Mail } from "lucide-react";

interface PlanFeature {
  label: string;
  starter: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

const FEATURES: PlanFeature[] = [
  { label: "Maks pemilih per pemilihan", starter: "100", pro: "2.000", enterprise: "Tanpa batas" },
  { label: "Pemilihan aktif bersamaan", starter: "1", pro: "3", enterprise: "Tanpa batas" },
  { label: "Maks paslon", starter: "5", pro: "20", enterprise: "Tanpa batas" },
  { label: "Anggota panitia", starter: "1", pro: "5", enterprise: "Tanpa batas" },
  { label: "Mode voting", starter: "Online saja", pro: "Semua", enterprise: "Semua" },
  { label: "Halaman profil pemilihan", starter: true, pro: true, enterprise: true },
  { label: "Ganti warna tema", starter: false, pro: true, enterprise: true },
  { label: "Upload logo", starter: true, pro: true, enterprise: true },
  { label: "Live count realtime", starter: true, pro: true, enterprise: true },
  { label: "Export CSV", starter: true, pro: true, enterprise: true },
  { label: "Berita acara PDF berkop", starter: false, pro: true, enterprise: true },
  { label: "Kirim token via Email", starter: false, pro: true, enterprise: true },
  { label: "Kirim token via WhatsApp", starter: false, pro: true, enterprise: true },
  { label: "Custom domain (pemilu.sman1.sch.id)", starter: false, pro: false, enterprise: true },
  { label: "Hapus label \"Didukung AyoPilih\"", starter: false, pro: false, enterprise: true },
  { label: "Audit log & retensi data", starter: "30 hari", pro: "1 tahun", enterprise: "5 tahun" },
  { label: "Dukungan", starter: "Komunitas", pro: "Email (1×24 jam)", enterprise: "Prioritas + SLA 99,9%" },
];

const ADDONS = [
  { label: "+1.000 pemilih tambahan", price: "Rp 100.000" },
  { label: "Pendampingan teknis hari-H", price: "Rp 750.000" },
  { label: "Cetak kartu token", price: "Rp 1.500/lembar" },
];

export default function HargaPage() {
  return (
    <main className="min-h-dvh bg-muted px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-16">
        <header className="text-center space-y-4">
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Harga yang Masuk Akal
          </h1>
          <p className="text-lg text-muted-foreground">
            Mulai gratis. Naik paket hanya saat skala pemilihan membutuhkan.
          </p>
        </header>

        <section aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="sr-only">
            Pilihan paket
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <PlanCard
              name="Starter"
              price="Rp 0"
              tagline="100 pemilih, tanpa kartu kredit"
              features={[
                "Cocok untuk pemilihan kelas atau organisasi kecil",
                "Mode voting Online saja",
                "Dukungan komunitas",
              ]}
              ctaLabel="Mulai Gratis"
              ctaHref="/daftar"
              highlighted={false}
            />
            <PlanCard
              name="Pro"
              price="Rp 299.000"
              tagline="per pemilihan — sekali bayar"
              features={[
                "Cocok untuk OSIS, BEM, atau pemilihan sekolah",
                "Semua mode voting (Online/TPS/Hybrid)",
                "Berita acara PDF, kirim token via Email & WhatsApp",
                "Audit log 1 tahun",
              ]}
              ctaLabel="Pilih Pro"
              ctaHref="/daftar"
              highlighted={true}
            />
            <PlanCard
              name="Enterprise"
              price="Mulai Rp 2.500.000"
              tagline="per tahun — tanpa batas"
              features={[
                "Cocok untuk kampus besar, kota, atau multi-klien",
                "Custom domain & hapus branding AyoPilih",
                "Dukungan prioritas + SLA 99,9%",
                "Pendampingan teknis hari-H",
              ]}
              ctaLabel="Hubungi Kami"
              ctaHref="mailto:sales@ayopilih.id?subject=Paket%20Enterprise%20AyoPilih"
              ctaExternal={true}
              highlighted={false}
            />
          </div>
        </section>

        <section aria-labelledby="compare-heading" className="space-y-4">
          <h2 id="compare-heading" className="font-display text-2xl font-bold text-center">
            Perbandingan Lengkap
          </h2>
          <div className="overflow-x-auto rounded-3xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-4 text-left font-semibold">Fitur</th>
                  <th className="p-4 text-center font-semibold">Starter</th>
                  <th className="p-4 text-center font-semibold bg-primary/5 border-x-2 border-primary">
                    Pro
                  </th>
                  <th className="p-4 text-center font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature, i) => (
                  <tr
                    key={feature.label}
                    className={i % 2 === 0 ? "border-b border-border/40" : "border-b border-border/40 bg-muted/30"}
                  >
                    <td className="p-4 font-medium">{feature.label}</td>
                    <td className="p-4 text-center">
                      <FeatureValue value={feature.starter} />
                    </td>
                    <td className="p-4 text-center border-x-2 border-primary bg-primary/5">
                      <FeatureValue value={feature.pro} />
                    </td>
                    <td className="p-4 text-center">
                      <FeatureValue value={feature.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="addons-heading" className="space-y-4">
          <h2 id="addons-heading" className="font-display text-2xl font-bold text-center">
            Add-on Tersedia
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {ADDONS.map((addon) => (
              <div
                key={addon.label}
                className="rounded-2xl border border-border bg-card p-6 text-center"
              >
                <p className="font-semibold">{addon.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-primary">
                  {addon.price}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-8 text-center space-y-4">
          <h2 className="font-display text-2xl font-bold">Butuh Bantuan Memilih?</h2>
          <p className="text-muted-foreground">
            Tim kami membantu Anda menyesuaikan paket dengan kebutuhan organisasi.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/panduan"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted"
            >
              Baca Panduan
            </Link>
            <a
              href="https://wa.me/6281234567890?text=Halo%20AyoPilih%2C%20saya%20ingin%20konsultasi%20paket"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-green-600 px-5 font-semibold text-white hover:bg-green-700"
            >
              <Mail className="h-4 w-4" />
              Chat WhatsApp
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function PlanCard({
  name,
  price,
  tagline,
  features,
  ctaLabel,
  ctaHref,
  ctaExternal = false,
  highlighted,
}: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaExternal?: boolean;
  highlighted: boolean;
}) {
  const CardWrapper = highlighted ? "div" : "article";
  const cardClass = highlighted
    ? "relative rounded-3xl border-2 border-primary bg-card p-8 shadow-lg"
    : "rounded-3xl border border-border bg-card p-8";

  const ctaClass = highlighted
    ? "inline-flex w-full h-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover"
    : "inline-flex w-full h-12 items-center justify-center rounded-full border border-border bg-background font-semibold hover:bg-muted";

  const CtaTag = ctaExternal ? "a" : Link;

  return (
    <CardWrapper className={cardClass}>
      {highlighted && (
        <span className="absolute right-6 top-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Paling Banyak Dipilih
        </span>
      )}
      <h3 className="font-display text-2xl font-bold">{name}</h3>
      <p className="mt-3 font-display text-4xl font-extrabold">{price}</p>
      <p className="mt-2 text-sm text-muted-foreground">{tagline}</p>
      <ul className="mt-6 space-y-3 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-success" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <CtaTag
          {...(ctaExternal ? { href: ctaHref, target: "_blank", rel: "noopener noreferrer" } : { href: ctaHref })}
          className={ctaClass}
        >
          {ctaLabel}
        </CtaTag>
      </div>
    </CardWrapper>
  );
}

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="mx-auto h-5 w-5 text-success" aria-label="Termasuk" />;
  }
  if (value === false) {
    return <X className="mx-auto h-5 w-5 text-muted-foreground/40" aria-label="Tidak termasuk" />;
  }
  return <span className="font-medium">{value}</span>;
}