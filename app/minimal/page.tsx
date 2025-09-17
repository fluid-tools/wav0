"use client";

import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect } from "react";

export default function MinimalLanding() {
	const opacity = useMotionValue(0);
	const y = useMotionValue(50);

	useEffect(() => {
		const controls = animate(opacity, 1, {
			duration: 2.5,
			ease: [0.83, 0, 0.17, 1],
		});

		const yControls = animate(y, 0, {
			duration: 1.8,
			delay: 0.4,
			ease: [0.83, 0, 0.17, 1],
		});

		return () => {
			controls.stop();
			yControls.stop();
		};
	}, [opacity, y]);

	const scaleX = useTransform(opacity, [0, 1], [0, 1]);

	return (
		<div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
			{/* Subtle grid texture */}
			<div className="absolute inset-0 z-0 opacity-2">
				<div
					className="absolute inset-0"
					style={{
						backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(255,255,255,0.05) 48px)`,
					}}
				/>
			</div>

			{/* Main content */}
			<div className="z-10 text-center max-w-6xl w-full px-8">
				{/* Brand */}
				<motion.div className="mb-48" style={{ opacity, y }}>
					<h1 className="font-sans text-8xl md:text-[12rem] font-black tracking-tighter leading-none mb-12">
						WAV0
					</h1>

					<div className="flex justify-center">
						<motion.div
							className="w-48 h-px bg-white"
							style={{ scaleX, originX: 0 }}
							transition={{
								duration: 1.5,
								delay: 1.0,
								ease: [0.83, 0, 0.17, 1],
							}}
						/>
					</div>
				</motion.div>

				{/* Statement */}
				<motion.div
					className="mb-56"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 2.0, duration: 1.2, ease: [0.83, 0, 0.17, 1] }}
				>
					<p className="font-mono text-sm tracking-widest opacity-60 uppercase">
						Artificial Intelligence Music Production
					</p>
				</motion.div>

				{/* Navigation */}
				<motion.nav
					className="flex justify-center space-x-24 mb-60"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 2.5, duration: 1.2, ease: [0.83, 0, 0.17, 1] }}
				>
					{["ENTER", "ARCHIVE", "INFORMATION"].map((item, index) => (
						<motion.a
							key={item}
							href={`#${item.toLowerCase()}`}
							className="font-sans text-2xl tracking-wide hover:opacity-100 uppercase relative"
							style={{ opacity: 0.4 }}
							whileHover={{
								opacity: 1,
								transition: { duration: 0.25 },
							}}
							initial={{ opacity: 0, y: 25 }}
							animate={{ opacity: 0.4, y: 0 }}
							transition={{
								delay: 2.8 + index * 0.2,
								duration: 1.0,
								ease: [0.83, 0, 0.17, 1],
							}}
						>
							{item}
							<motion.span
								className="absolute -bottom-2 left-0 w-full h-px bg-white"
								initial={{ scaleX: 0 }}
								whileHover={{ scaleX: 1 }}
								transition={{ duration: 0.5, ease: [0.83, 0, 0.17, 1] }}
							/>
						</motion.a>
					))}
				</motion.nav>

				{/* Footer indicator */}
				<motion.div
					className="absolute bottom-20 left-0 right-0"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 4.0, duration: 1.2 }}
				>
					<div className="flex justify-center">
						<motion.div
							className="w-px h-20 bg-white opacity-30"
							animate={{
								opacity: [0.3, 0.7, 0.3],
							}}
							transition={{
								duration: 3.0,
								repeat: Infinity,
								ease: "easeInOut",
							}}
						/>
					</div>
				</motion.div>
			</div>

			{/* Subtle geometric elements with continuous motion */}
			<motion.div
				className="absolute top-[22%] -left-16 w-32 h-32 border border-white opacity-3"
				initial={{ rotate: 0, opacity: 0 }}
				animate={{
					rotate: 360,
					opacity: 0.03,
				}}
				transition={{
					rotate: {
						duration: 25,
						repeat: Infinity,
						ease: "linear",
					},
					opacity: {
						duration: 2.0,
						delay: 4.2,
						ease: [0.83, 0, 0.17, 1],
					},
				}}
			/>

			<motion.div
				className="absolute bottom-[28%] -right-12 w-20 h-20 border border-white opacity-3"
				initial={{ rotate: 0, opacity: 0 }}
				animate={{
					rotate: -360,
					opacity: 0.03,
				}}
				transition={{
					rotate: {
						duration: 30,
						repeat: Infinity,
						ease: "linear",
					},
					opacity: {
						duration: 2.0,
						delay: 4.5,
						ease: [0.83, 0, 0.17, 1],
					},
				}}
			/>
		</div>
	);
}
