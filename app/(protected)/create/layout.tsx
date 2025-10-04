import { AIDevtools } from "@ai-sdk-tools/devtools";
import { AppProviders } from "@/lib/state/providers";

export default async function ProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AppProviders>
			{children}
			<AIDevtools />
		</AppProviders>
	);
}
