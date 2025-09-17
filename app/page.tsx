import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
	return (
		<div suppressHydrationWarning className="min-h-screen">
			{/* Navigation */}
			<nav className="flex items-center justify-between px-6 py-4">
				<div className="flex items-center gap-6">
					<h1 className="text-lg tracking-tight uppercase font-bold font-mono text-foreground">
						wav<span className="text-muted-foreground">0</span>
					</h1>
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
					<ThemeToggle />
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
			<main className="flex flex-col items-center justify-center px-6 py-20">
				<section
					id="hero"
					className="flex flex-col items-center text-center max-w-4xl space-y-8"
				>
					<Badge
						variant="outline"
						className="font-mono text-xs uppercase tracking-tight"
					>
						AI-Native Music Studio
					</Badge>

					<h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-mono tracking-tight uppercase">
						Idea to Sound
						<br />
						<span className="text-muted-foreground">in Seconds</span>
					</h1>

					<p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
						The fastest AI producer, songwriter, and sound designer right in
						your pocket. Create reference tracks, soundpacks, samples, and beats
						instantly.
					</p>

					<div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
						<Button
							asChild
							size="lg"
							className="font-mono text-sm uppercase tracking-tight"
						>
							<Link href="/create">Start Creating</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="font-mono text-sm uppercase tracking-tight"
						>
							<Link href="#features">See How It Works</Link>
						</Button>
					</div>
				</section>
			</main>

			{/* Features Section */}
			<section id="features" className="px-6 py-20 bg-muted/30">
				<div className="max-w-6xl mx-auto">
					<div className="text-center space-y-4 mb-16">
						<h2 className="text-2xl md:text-3xl font-bold font-mono tracking-tight uppercase">
							Built for Speed
						</h2>
						<p className="text-muted-foreground max-w-2xl mx-auto">
							No more waiting. No more complicated workflows. Just pure creative
							flow.
						</p>
					</div>

					<div className="grid md:grid-cols-3 gap-8">
						<div className="space-y-4 text-center">
							<div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
								<span className="font-mono text-xl">⚡</span>
							</div>
							<h3 className="font-mono text-sm uppercase tracking-tight font-semibold">
								Lightning Fast
							</h3>
							<p className="text-sm text-muted-foreground">
								Generate complete tracks in seconds, not hours. AI that actually
								keeps up with your creativity.
							</p>
						</div>

						<div className="space-y-4 text-center">
							<div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
								<span className="font-mono text-xl">🎵</span>
							</div>
							<h3 className="font-mono text-sm uppercase tracking-tight font-semibold">
								Any Genre
							</h3>
							<p className="text-sm text-muted-foreground">
								From trap to ambient, house to jazz. Our AI understands every
								style and nuance.
							</p>
						</div>

						<div className="space-y-4 text-center">
							<div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
								<span className="font-mono text-xl">🔧</span>
							</div>
							<h3 className="font-mono text-sm uppercase tracking-tight font-semibold">
								Producer Grade
							</h3>
							<p className="text-sm text-muted-foreground">
								Professional quality output ready for your DAW. No
								post-processing needed.
							</p>
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
						<Link href="#" className="hover:text-foreground transition-colors">
							Privacy
						</Link>
						<Link href="#" className="hover:text-foreground transition-colors">
							Terms
						</Link>
						<Link href="#" className="hover:text-foreground transition-colors">
							Support
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
