import Link from "next/link";

interface FooterProps {
  className?: string;
}

export default function Footer({ className = "" }: FooterProps) {
  return (
    <footer
      className={`relative z-40 shrink-0 border-t border-[#b51f1f] bg-[#cc2727] px-2 py-0.5 sm:py-1 text-center text-[10px] sm:text-[11px] leading-tight text-white/95 ${className}`}
    >
      <p className="tracking-tight">
        © {new Date().getFullYear()}{" "}
        <Link
          href="https://www.seedsofinnocens.com/seeds-of-innocens-surgical-center/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-white hover:text-white/80"
        >
          Seeds of Innocence Surgical Centre
        </Link>
        . All Rights Reserved. Designed &amp; Developed by{" "}
        <Link
          href="https://amit1999-portfolio.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-white/70 font-semibold text-white hover:text-white/80"
        >
          Amit Kumar
        </Link>
      </p>
    </footer>
  );
}
