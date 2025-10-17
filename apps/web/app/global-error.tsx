"use client";

// WORKAROUND: Next.js 16 beta has a bug where prerendering error boundaries
// triggers workUnitAsyncStorage errors. Remove this in stable release.
export const dynamic = "force-dynamic";

export default function GlobalError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body>
				<div style={{ padding: "2rem", textAlign: "center" }}>
					<h2>Something went wrong!</h2>
					<button
						type="button"
						onClick={() => reset()}
						style={{
							marginTop: "1rem",
							padding: "0.5rem 1rem",
							cursor: "pointer",
						}}
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
