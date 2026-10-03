import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full shrink-0 border-t border-[#b51f1f] bg-[#cc2727] px-2 py-1.5 text-center text-[11px] leading-snug text-white sm:px-3 sm:py-2 sm:text-[13px] sm:leading-tight z-40 select-none">
      <p className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
        <span>© {new Date().getFullYear()}</span>
        <Link
          href="https://www.seedsofinnocens.com/seeds-of-innocens-surgical-center/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-white hover:text-white/80 transition-colors"
        >
          Seeds of Innocence Surgical Centre
        </Link>
        <span>. All Rights Reserved. Designed &amp; Developed by</span>
        <Link
          href="https://amit1999-portfolio.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-white/80 font-bold text-white hover:text-white/80 transition-colors"
        >
          Amit Kumar
        </Link>
      </p>
    </footer>
  );
}
