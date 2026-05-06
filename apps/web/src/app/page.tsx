import Link from "next/link";
import Image from "next/image";

const PHOTOS = {
  hero:    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1920&q=90",
  pour:    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900&q=85",
  barista: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&q=85",
  food:    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&q=85",
  interior:"https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=85",
  latte:   "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=85",
  pastry:  "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=85",
  avocado: "https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=600&q=85",
};

export default function HomePage() {
  return (
    <main className="bg-[#0d0805] text-cream-200 overflow-x-hidden">

      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative h-screen min-h-[700px] flex flex-col">
        {/* Full-bleed photo */}
        <Image
          src={PHOTOS.hero}
          alt="Coffee"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-[#0d0805]" />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-7 md:px-16">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/50 bg-black/30 backdrop-blur">
              <span className="font-display text-xl font-black text-gold-400">B</span>
            </div>
            <span className="font-display font-bold text-white tracking-wide">Blessed Ave.</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#story" className="hover:text-white transition">Our Story</a>
            <a href="#info" className="hover:text-white transition">Visit</a>
            <Link href="/order"
              className="rounded-full bg-gold-500 px-5 py-2 text-sm font-semibold text-brown-900 hover:bg-gold-400 transition">
              Order Now
            </Link>
          </div>
        </nav>

        {/* Hero copy */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-8 md:px-16">
          <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.4em] mb-5">
            San Fernando, Pampanga
          </p>
          <h1 className="font-display font-bold text-white leading-[0.95] text-balance"
            style={{ fontSize: "clamp(3rem, 9vw, 8rem)" }}>
            Every Sip<br />
            <span className="text-gold-400">Blessed.</span>
          </h1>
          <p className="mt-6 text-white/60 text-lg max-w-md leading-relaxed">
            Specialty coffee, all-day meals, and a warm corner<br className="hidden md:block" />
            you'll want to come back to.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/order"
              className="rounded-full bg-gold-500 px-8 py-3.5 text-base font-semibold text-brown-900 shadow-lg shadow-gold-500/20 hover:bg-gold-400 transition active:scale-95">
              Order Online
            </Link>
            <a href="#story"
              className="rounded-full border border-white/20 px-8 py-3.5 text-base font-medium text-white/80 hover:border-white/40 hover:text-white transition">
              Our Menu ↓
            </a>
          </div>
        </div>

        {/* Scroll pill */}
        <div className="relative z-10 flex justify-center pb-10">
          <div className="flex flex-col items-center gap-2 text-white/30 text-xs">
            <span className="uppercase tracking-widest">Scroll</span>
            <div className="h-10 w-px bg-gradient-to-b from-white/20 to-transparent" />
          </div>
        </div>
      </section>

      {/* ─── GOLD TICKER ──────────────────────────────────────────────────── */}
      <div className="bg-gold-500 py-3 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap text-brown-900 text-sm font-semibold">
          {["☕ Specialty Coffee", "✦", "🥑 All-Day Breakfast", "✦", "🍰 Fresh Pastries", "✦", "📱 QR Table Ordering", "✦", "💛 Made with Love", "✦", "☕ Specialty Coffee", "✦", "🥑 All-Day Breakfast", "✦", "🍰 Fresh Pastries", "✦", "📱 QR Table Ordering", "✦", "💛 Made with Love", "✦"].map((item, i) => (
            <span key={i} className="flex-shrink-0 mx-5">{item}</span>
          ))}
        </div>
      </div>

      {/* ─── FEATURED PHOTOS GRID ─────────────────────────────────────────── */}
      <section className="py-20 px-6 md:px-16" id="story">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-12 gap-4 h-[600px]">
            {/* Large left */}
            <div className="col-span-7 relative rounded-3xl overflow-hidden">
              <Image src={PHOTOS.pour} alt="Coffee pour" fill className="object-cover" sizes="60vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6">
                <span className="text-xs text-gold-400 font-semibold uppercase tracking-widest">Specialty Coffee</span>
                <p className="font-display text-2xl font-bold text-white mt-1">Brewed to order</p>
              </div>
            </div>

            {/* Right column */}
            <div className="col-span-5 flex flex-col gap-4">
              <div className="flex-1 relative rounded-3xl overflow-hidden">
                <Image src={PHOTOS.food} alt="Food" fill className="object-cover" sizes="40vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="font-display text-lg font-bold text-white">All-Day Meals</p>
                </div>
              </div>
              <div className="flex-1 relative rounded-3xl overflow-hidden">
                <Image src={PHOTOS.pastry} alt="Pastry" fill className="object-cover" sizes="40vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="font-display text-lg font-bold text-white">Fresh Pastries</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STORY / ABOUT ───────────────────────────────────────────────── */}
      <section className="py-24 px-6 md:px-16">
        <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-2 items-center">
          <div>
            <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.4em] mb-5">
              Our Story
            </p>
            <h2 className="font-display text-5xl md:text-6xl font-bold text-cream-100 leading-tight">
              A neighbourhood<br />
              <span className="text-gold-400">favourite.</span>
            </h2>
            <p className="mt-7 text-cream-300/70 text-lg leading-relaxed">
              Blessed Ave. Cafe is where good coffee meets good company. We believe every visit
              should feel a little special — from the first sip to the last bite.
            </p>
            <p className="mt-4 text-cream-300/60 leading-relaxed">
              Whether you're here for a quiet morning alone, catching up with a friend, or just
              need a reliable spot to get work done — we've made this place for you.
            </p>
            <div className="mt-10 flex gap-12">
              {[["100+", "Menu items"], ["5★", "Customer rating"], ["Daily", "Fresh bakes"]].map(([val, label]) => (
                <div key={label}>
                  <p className="font-display text-3xl font-bold text-gold-400">{val}</p>
                  <p className="text-xs text-cream-300/50 mt-1 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stacked images */}
          <div className="relative h-[500px]">
            <div className="absolute top-0 right-0 w-4/5 h-4/5 rounded-3xl overflow-hidden shadow-2xl">
              <Image src={PHOTOS.barista} alt="Barista" fill className="object-cover" sizes="40vw" />
            </div>
            <div className="absolute bottom-0 left-0 w-3/5 h-2/5 rounded-2xl overflow-hidden shadow-2xl border-4 border-[#0d0805]">
              <Image src={PHOTOS.latte} alt="Latte" fill className="object-cover" sizes="30vw" />
            </div>
            {/* Gold accent */}
            <div className="absolute top-6 left-6 h-16 w-16 rounded-2xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
              <span className="font-display text-2xl font-black text-gold-400">B</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ORDER CTA ───────────────────────────────────────────────────── */}
      <section className="relative mx-4 md:mx-16 mb-8 rounded-3xl overflow-hidden">
        <Image src={PHOTOS.interior} alt="Cafe interior" fill className="object-cover object-center" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20" />
        <div className="relative z-10 py-24 px-10 md:px-16 max-w-xl">
          <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.4em] mb-4">
            Order Online
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight">
            Skip the queue.<br />
            We'll have it ready.
          </h2>
          <p className="mt-5 text-white/60 text-lg leading-relaxed">
            Order ahead for pickup, or scan your table's QR code and order right from where you're sitting.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/order"
              className="rounded-full bg-gold-500 px-8 py-3.5 font-semibold text-brown-900 hover:bg-gold-400 transition shadow-lg shadow-black/30 active:scale-95">
              Order for Pickup
            </Link>
          </div>
        </div>
      </section>

      {/* ─── MENU HIGHLIGHTS ─────────────────────────────────────────────── */}
      <section className="py-20 px-6 md:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.4em] mb-3">What We Serve</p>
              <h2 className="font-display text-4xl font-bold text-cream-100">Menu Highlights</h2>
            </div>
            <Link href="/order" className="hidden md:block rounded-full border border-cream-200/20 px-6 py-2.5 text-sm text-cream-300/60 hover:text-cream-100 hover:border-cream-200/40 transition">
              Full Menu →
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { img: PHOTOS.pour,    name: "Café Latte",       desc: "Espresso with steamed milk",         price: "₱150" },
              { img: PHOTOS.avocado, name: "Avocado Toast",    desc: "Sourdough, smashed avo, poached egg", price: "₱220" },
              { img: PHOTOS.latte,   name: "Matcha Latte",     desc: "Ceremonial grade matcha",             price: "₱170" },
            ].map((item) => (
              <Link href="/order" key={item.name}
                className="group relative rounded-2xl overflow-hidden aspect-[4/5] block">
                <Image src={item.img} alt={item.name} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="33vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="font-display text-xl font-bold text-white">{item.name}</p>
                      <p className="text-white/60 text-sm mt-0.5">{item.desc}</p>
                    </div>
                    <span className="rounded-full bg-gold-500 px-3 py-1 text-sm font-bold text-brown-900 flex-shrink-0 ml-2">
                      {item.price}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/order"
              className="inline-flex items-center gap-2 rounded-full border border-cream-200/20 px-8 py-3 text-sm font-medium text-cream-300/60 hover:text-cream-100 hover:border-cream-200/40 transition">
              View Full Menu →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── HOURS & LOCATION ────────────────────────────────────────────── */}
      <section className="py-20 px-6 md:px-16 border-t border-white/5" id="info">
        <div className="mx-auto max-w-6xl grid gap-12 md:grid-cols-2">
          <div>
            <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.4em] mb-5">Hours</p>
            <div className="space-y-4">
              {[
                ["Monday – Friday", "7:00 AM – 9:00 PM"],
                ["Saturday",        "8:00 AM – 10:00 PM"],
                ["Sunday",          "8:00 AM – 8:00 PM"],
              ].map(([day, hours]) => (
                <div key={day} className="flex justify-between border-b border-white/5 pb-4">
                  <span className="text-cream-300/80 font-medium">{day}</span>
                  <span className="text-gold-400 font-semibold">{hours}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.4em] mb-5">Find Us</p>
            <p className="text-cream-300/80 text-lg leading-relaxed">
              San Fernando, Pampanga<br />Philippines
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a href="https://www.facebook.com/blessedavenuecafe" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-full border border-white/10 px-5 py-3 text-sm text-cream-300/60 hover:text-cream-100 hover:border-white/20 transition w-fit">
                <span className="text-base">f</span> Follow on Facebook
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 px-8 md:px-16">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/40 bg-brown-900">
              <span className="font-display text-lg font-black text-gold-400">B</span>
            </div>
            <div>
              <p className="font-display font-bold text-cream-200">Blessed Ave. Cafe</p>
              <p className="text-xs text-cream-300/40">San Fernando, Pampanga</p>
            </div>
          </div>
          <div className="flex gap-8 text-sm text-cream-300/40">
            <Link href="/order" className="hover:text-cream-200 transition">Order Online</Link>
            <a href="#info" className="hover:text-cream-200 transition">Visit Us</a>
            <a href="https://www.facebook.com/blessedavenuecafe" target="_blank" rel="noopener noreferrer" className="hover:text-cream-200 transition">Facebook</a>
          </div>
          <p className="text-xs text-cream-300/30">© {new Date().getFullYear()} Blessed Ave. Cafe</p>
        </div>
      </footer>

    </main>
  );
}
