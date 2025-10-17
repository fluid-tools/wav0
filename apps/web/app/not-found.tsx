// WORKAROUND: Next.js 16 beta has a bug where prerendering error/fallback pages
// triggers workUnitAsyncStorage errors. Remove this in stable release.
export const dynamic = "force-dynamic";

export default function NotFound() {
	return (
		<div style={{ padding: "2rem", textAlign: "center" }}>
			<h2>Not Found</h2>
			<p>Could not find requested resource</p>
		</div>
	);
}
