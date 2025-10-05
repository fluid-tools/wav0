import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggleGroup } from "@/components/theme-toggle";

export default function Home() {
	return (
		<div suppressHydrationWarning className="min-h-screen">
			{/* Navigation */}
			<nav className="flex items-center justify-between px-6 py-4">
				<div className="flex items-center gap-3">
					<Link
						href="/"
						className="flex items-center gap-3 hover:opacity-90 transition-opacity"
					>
						<Image src="/apple-icon.png" alt="WAV0" width={20} height={20} />
						<h1 className="text-base tracking-tight uppercase font-bold font-mono text-foreground">
							wav<span className="text-muted-foreground">0</span>
						</h1>
					</Link>
					<div className="hidden md:flex items-center text-muted-foreground font-mono tracking-tight uppercase text-xs gap-4">
						<Link
							href="#hero"
							className="hover:text-foreground transition-colors duration-300"
						>
							Home
						</Link>
						<Link
							href="#features"
							className="hover:text-foreground transition-colors duration-300"
						>
							Features
						</Link>
						<Link
							href="#pricing"
							className="hover:text-foreground transition-colors duration-300"
						>
							Pricing
						</Link>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<Button
						asChild
						size="sm"
						className="font-mono text-xs uppercase tracking-tight"
					>
						<Link href="/create">Get Started</Link>
					</Button>
				</div>
			</nav>

			{/* Hero Section */}
			<main className="px-6 py-20">
				<section
					id="hero"
					className="max-w-6xl mx-auto grid items-center gap-12 lg:grid-cols-2"
				>
					<div className="space-y-8">
						<Badge
							variant="outline"
							className="font-mono text-[10px] uppercase tracking-wider"
						>
							AI-Native Music Studio
						</Badge>
						<h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[0.95]">
							Idea to Sound
							<br />
							<span className="text-muted-foreground">in Seconds</span>
						</h1>
						<p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
							The fastest AI producer, songwriter, and sound designer in your
							pocket. Create reference tracks, soundpacks, samples, and beats
							instantly.
						</p>
						<div className="flex flex-col sm:flex-row gap-3">
							<Button
								asChild
								size="lg"
								className="font-mono text-sm uppercase tracking-tight"
							>
								<Link href="/create">Start Creating</Link>
							</Button>
							<Button
								asChild
								size="lg"
								variant="outline"
								className="font-mono text-sm uppercase tracking-tight"
							>
								<Link href="#features">See How It Works</Link>
							</Button>
						</div>
						<div className="pt-8 flex items-center gap-6 text-xs text-muted-foreground font-mono uppercase tracking-widest">
							<span>Trusted by creators</span>
							<div className="h-3 w-px bg-border" />
							<span>Built with AI SDK</span>
							<div className="h-3 w-px bg-border" />
							<span>Powered by ElevenLabs</span>
						</div>
					</div>
					<div className="justify-self-center">
						<div className="w-[320px] h-[320px] rounded-3xl border bg-gradient-to-b from-muted/40 to-background flex items-center justify-center">
							<Image
								src="/apple-icon.png"
								alt="WAV0 Logo"
								width={192}
								height={192}
								className="object-contain"
							/>
						</div>
					</div>
				</section>
			</main>

			{/* Features Section */}
			<section id="features" className="px-6 py-24">
				<div className="max-w-6xl mx-auto">
					<div className="text-center space-y-3 mb-14">
						<h2 className="text-3xl md:text-4xl font-bold tracking-tight">
							Everything you need to create
						</h2>
						<p className="text-muted-foreground max-w-2xl mx-auto">
							Clean tools, predictable results, zero friction.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* WAV0 AI */}
						<div className="group rounded-2xl border p-6 bg-card/50 hover:bg-card transition-colors">
							<div className="flex items-start gap-4">
								<div className="size-10 rounded-lg border flex items-center justify-center">
									{/* Bolt Icon */}
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="text-foreground/80"
										aria-hidden="true"
										focusable="false"
									>
										<path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
									</svg>
								</div>
								<div className="space-y-1.5">
									<h3 className="text-lg font-semibold tracking-tight">
										WAV0 AI
									</h3>
									<p className="text-sm text-muted-foreground">
										Describe your idea. Get a track. Iterate fast.
									</p>
								</div>
							</div>
						</div>

						{/* Studio */}
						<div className="group rounded-2xl border p-6 bg-card/50 hover:bg-card transition-colors">
							<div className="flex items-start gap-4">
								<div className="size-10 rounded-lg border flex items-center justify-center">
									{/* Grid Icon */}
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="text-foreground/80"
										aria-hidden="true"
										focusable="false"
									>
										<rect x="3" y="3" width="7" height="7" />
										<rect x="14" y="3" width="7" height="7" />
										<rect x="3" y="14" width="7" height="7" />
										<rect x="14" y="14" width="7" height="7" />
									</svg>
								</div>
								<div className="space-y-1.5">
									<h3 className="text-lg font-semibold tracking-tight">
										Studio
									</h3>
									<p className="text-sm text-muted-foreground">
										A minimal AI-assisted DAW in your browser.
									</p>
								</div>
							</div>
						</div>

						{/* Vault */}
						<div className="group rounded-2xl border p-6 bg-card/50 hover:bg-card transition-colors">
							<div className="flex items-start gap-4">
								<div className="size-10 rounded-lg border flex items-center justify-center">
									{/* Lock Icon */}
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="text-foreground/80"
										aria-hidden="true"
										focusable="false"
									>
										<rect x="3" y="11" width="18" height="10" rx="2" />
										<path d="M7 11V7a5 5 0 0 1 10 0v4" />
									</svg>
								</div>
								<div className="space-y-1.5">
									<h3 className="text-lg font-semibold tracking-tight">
										Vault
									</h3>
									<p className="text-sm text-muted-foreground">
										Secure storage with fine-grained access control.
									</p>
								</div>
							</div>
						</div>

						{/* Version Control */}
						<div className="group rounded-2xl border p-6 bg-card/50 hover:bg-card transition-colors">
							<div className="flex items-start gap-4">
								<div className="size-10 rounded-lg border flex items-center justify-center">
									{/* Bars Icon */}
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="text-foreground/80"
										aria-hidden="true"
										focusable="false"
									>
										<path d="M6 20V10" />
										<path d="M12 20V4" />
										<path d="M18 20v-7" />
									</svg>
								</div>
								<div className="space-y-1.5">
									<h3 className="text-lg font-semibold tracking-tight">
										Version Control
									</h3>
									<p className="text-sm text-muted-foreground">
										Branch, compare, and revert your generations.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="px-6 py-20">
				<div className="max-w-4xl mx-auto text-center space-y-8">
					<h2 className="text-3xl md:text-4xl font-bold font-mono tracking-tight uppercase">
						Your Ideas.
						<br />
						<span className="text-muted-foreground">Our Speed.</span>
					</h2>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
						Stop waiting for inspiration to strike. Start creating the sounds in
						your head, right now.
					</p>
					<Button
						asChild
						size="lg"
						className="font-mono text-sm uppercase tracking-tight"
					>
						<Link href="/create">Try WAV0 Free</Link>
					</Button>
				</div>
			</section>

			{/* Footer */}
			<footer className="px-6 py-8 border-t">
				<div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
					<div className="flex items-center gap-6">
						<h3 className="font-mono text-sm uppercase tracking-tight font-semibold">
							wav<span className="text-muted-foreground">0</span>
						</h3>
						<span className="text-xs text-muted-foreground">
							© 2025 WAV0 AI. All rights reserved.
						</span>
					</div>
					<div className="flex items-center gap-4 text-xs text-muted-foreground font-mono uppercase tracking-tight">
						<div className="flex items-center gap-4 text-xs text-muted-foreground font-mono uppercase tracking-tight">
							<Link
								href="#"
								className="hover:text-foreground transition-colors"
							>
								Privacy
							</Link>
							<Link
								href="#"
								className="hover:text-foreground transition-colors"
							>
								Terms
							</Link>
							<Link
								href="#"
								className="hover:text-foreground transition-colors"
							>
								Support
							</Link>
						</div>
						<ThemeToggleGroup />
					</div>
				</div>
			</footer>
		</div>
	);
}
