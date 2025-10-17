"use client";

import { Heatmap } from "@paper-design/shaders-react";
import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggleGroup } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function Home() {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
	const [lastScrollY, setLastScrollY] = useState(0);

	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ["start start", "end end"],
	});

	const chatBarWidth = useTransform(scrollYProgress, [0, 0.2], [400, 600]);
	const chatBarOpacity = useTransform(scrollYProgress, [0, 0.1], [0.8, 1]);

	useEffect(() => {
		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			if (currentScrollY > lastScrollY && currentScrollY > 100) {
				setScrollDirection("down");
			} else {
				setScrollDirection("up");
			}
			setLastScrollY(currentScrollY);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [lastScrollY]);

	return (
		<div
			ref={containerRef}
			suppressHydrationWarning
			className="min-h-screen bg-background"
		>
			{/* Navigation Pill */}
			<motion.nav
				initial={{ y: 0, opacity: 1 }}
				animate={{
					y: scrollDirection === "down" ? -100 : 0,
					opacity: scrollDirection === "down" ? 0 : 1,
				}}
				transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
				className="fixed top-8 left-1/2 -translate-x-1/2 z-50"
			>
				<div className="backdrop-blur-xl bg-background/80 border border-border/50 rounded-full px-8 py-3.5 shadow-sm">
					<div className="flex items-center gap-12">
						<Link
							href="/"
							className="flex items-center gap-2.5 hover:opacity-60 transition-opacity duration-200"
						>
							<Image src="/apple-icon.png" alt="WAV0" width={18} height={18} />
							<span className="text-sm font-medium tracking-tight font-mono">
								WAV0
							</span>
						</Link>

						<div className="flex items-center gap-8 text-sm text-muted-foreground">
							<Link
								href="https://wav0.app/discord"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-foreground transition-colors duration-200"
							>
								Discord
							</Link>
							<Link
								href="https://github.com/fluid-tools/wav0"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-foreground transition-colors duration-200"
							>
								GitHub
							</Link>
						</div>

						<Button
							asChild
							size="sm"
							className="bg-foreground text-background hover:bg-foreground/90 text-sm font-medium rounded-full px-6 py-2 transition-all duration-200"
						>
							<Link href="/daw">Launch Studio</Link>
						</Button>
					</div>
				</div>
			</motion.nav>

			{/* Hero Section with Heatmap */}
			<section className="relative min-h-screen flex items-center justify-center pt-20">
				{/* Heatmap Background */}
				<div className="absolute inset-0 opacity-40 dark:opacity-100">
					<Heatmap
						width="100%"
						height="100%"
						image="/apple-icon.png"
						colors={["#0a0a0a", "#1a1a1a", "#2a2a2a", "#3a3a3a", "#4a4a4a"]}
						colorBack="hsl(var(--background))"
						contour={0.3}
						angle={45}
						noise={0.05}
						innerGlow={0.2}
						outerGlow={0.15}
						speed={0.4}
						scale={0.9}
						fit="cover"
					/>
				</div>

				{/* Gradient Overlay for better readability */}
				<div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-background/80" />

				{/* Hero Content */}
				<div className="relative z-10 max-w-4xl mx-auto text-center px-6">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
						className="space-y-6"
					>
						<h1 className="text-6xl md:text-7xl lg:text-8xl font-normal tracking-[-0.02em] leading-[1.1]">
							Music production
							<br />
							as accessible as Figma
						</h1>
						<p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
							Go from idea to sound in seconds. AI-native music studio that
							works entirely in your browser.
						</p>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
						className="mt-8 flex items-center justify-center gap-3 text-sm text-muted-foreground font-mono"
					>
						<span>Open Source</span>
						<span>·</span>
						<span>Browser Native</span>
						<span>·</span>
						<span>Zero Downloads</span>
					</motion.div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="relative px-6 py-24">
				<div className="max-w-4xl mx-auto">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
						viewport={{ once: true }}
						className="text-center space-y-4 mb-16"
					>
						<h2 className="text-3xl md:text-4xl font-medium tracking-tight">
							Everything you need
						</h2>
						<p className="text-base text-muted-foreground max-w-lg mx-auto">
							Clean tools, predictable results, zero friction.
						</p>
					</motion.div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{[
							{
								title: "WAV0 AI",
								description: "Describe your idea. Get a track. Iterate fast.",
							},
							{
								title: "Studio",
								description: "Browser-native DAW with zero downloads.",
							},
							{
								title: "Vault",
								description: "Secure storage with version control.",
							},
							{
								title: "Export",
								description: "One-click export to any format or platform.",
							},
						].map((feature, index) => (
							<motion.div
								key={feature.title}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								transition={{
									duration: 0.5,
									delay: index * 0.05,
									ease: [0.16, 1, 0.3, 1],
								}}
								viewport={{ once: true }}
								className="group p-6 border border-border/50 rounded-2xl hover:border-border transition-all duration-200"
							>
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h3 className="text-base font-medium font-mono">
											{feature.title}
										</h3>
										<span className="text-xs text-muted-foreground tabular-nums">
											{String(index + 1).padStart(2, "0")}
										</span>
									</div>
									<p className="text-sm text-muted-foreground leading-relaxed">
										{feature.description}
									</p>
								</div>
							</motion.div>
						))}
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="px-6 py-16 relative">
				<div className="max-w-6xl mx-auto">
					<motion.div
						initial={{ opacity: 0 }}
						whileInView={{ opacity: 1 }}
						transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
						viewport={{ once: true }}
						className="border-t border-border/20 pt-8"
					>
						<div className="flex flex-col md:flex-row justify-between items-center gap-6">
							<div className="flex items-center gap-6">
								<span className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/60">
									WAV0
								</span>
								<span className="text-[10px] text-muted-foreground/40 font-light tracking-wide">
									© 2025
								</span>
							</div>

							<div className="flex items-center gap-6">
								<Link
									href="https://wav0.app/discord"
									target="_blank"
									rel="noopener noreferrer"
									className="text-muted-foreground/40 hover:text-foreground transition-colors duration-300"
									aria-label="Discord"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="currentColor"
										aria-hidden="true"
									>
										<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
									</svg>
								</Link>
								<Link
									href="https://github.com/fluid-tools/wav0"
									target="_blank"
									rel="noopener noreferrer"
									className="text-muted-foreground/40 hover:text-foreground transition-colors duration-300"
									aria-label="GitHub"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="currentColor"
										aria-hidden="true"
									>
										<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
									</svg>
								</Link>
								<Link
									href="https://x.com/wav0ai"
									target="_blank"
									rel="noopener noreferrer"
									className="text-muted-foreground/40 hover:text-foreground transition-colors duration-300"
									aria-label="X"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="currentColor"
										aria-hidden="true"
									>
										<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
									</svg>
								</Link>
							</div>

							<div className="flex items-center gap-6">
								<div className="flex items-center gap-6 text-[10px] text-muted-foreground/40 font-light tracking-wider uppercase">
									<Link
										href="https://github.com/fluid-tools/wav0"
										target="_blank"
										rel="noopener noreferrer"
										className="hover:text-foreground transition-colors duration-300"
									>
										Docs
									</Link>
									<Link
										href="https://fluid.tools"
										target="_blank"
										rel="noopener noreferrer"
										className="hover:text-foreground transition-colors duration-300"
									>
										FLUID.TOOLS
									</Link>
								</div>
								<ThemeToggleGroup />
							</div>
						</div>
					</motion.div>
				</div>
			</footer>

			{/* Docked Chat Bar */}
			<motion.div
				style={{
					width: chatBarWidth,
					opacity: chatBarOpacity,
				}}
				className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[90vw]"
			>
				<motion.div
					initial={{ y: 100, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
					className="backdrop-blur-xl bg-background/80 border border-border/50 rounded-full px-6 py-4 shadow-2xl"
				>
					<div className="flex items-center gap-4">
						<div className="flex-1 flex items-center gap-3">
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								className="text-muted-foreground"
								aria-hidden="true"
							>
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
							</svg>
							<input
								type="text"
								placeholder="Describe your sound..."
								className="flex-1 bg-transparent border-none outline-none text-sm font-light tracking-wide placeholder:text-muted-foreground"
							/>
						</div>
						<Button
							size="sm"
							className="bg-foreground text-background hover:bg-foreground/90 font-light text-xs uppercase tracking-widest rounded-full px-6 transition-all duration-300"
						>
							Generate
						</Button>
					</div>
				</motion.div>
			</motion.div>
		</div>
	);
}
