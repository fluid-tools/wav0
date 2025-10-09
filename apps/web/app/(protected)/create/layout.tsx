import { AIDevtools } from "@ai-sdk-tools/devtools";

export default async function ProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			{children}
			<AIDevtools />
		</>
	);
}
