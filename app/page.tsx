import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle.client";

export default function Home() {
  return (
    <main
      suppressHydrationWarning
      className="flex flex-col items-center justify-between gap-12 h-screen py-12"
    >
      <nav className="flex items-center text-muted-foreground justify-start font-mono tracking-tight uppercase text-xs gap-4">
        <Link
          href="#hero"
          className="hover:text-foreground transition-colors duration-300"
        >
          Home
        </Link>
        <Link
          href="#about"
          className="hover:text-foreground transition-colors duration-300"
        >
          About
        </Link>
        <Link
          href="#contact"
          className="hover:text-foreground transition-colors duration-300"
        >
          Contact
        </Link>
        <ThemeToggle />
      </nav>

      <div className="flex flex-col items-center justify-start gap-4">
        <section
          id="hero"
          className="flex flex-col items-center justify-center gap-4"
        >
          <h1 className="text-xl tracking-tight uppercase font-bold font-mono text-foreground">
            wav<span className="text-muted-foreground">0</span>
          </h1>
        </section>
        <section
          id="about"
          className="flex flex-col items-center justify-center gap-4"
        >
          <h2 className="text-xl tracking-tight uppercase font-bold font-mono text-foreground">
            About
          </h2>
        </section>
      </div>
      <section
        id="contact"
        className="flex flex-col items-center justify-center gap-4"
      >
        <h2 className="text-xl tracking-tight uppercase font-bold font-mono text-foreground">
          Contact
        </h2>
      </section>
    </main>
  );
}
