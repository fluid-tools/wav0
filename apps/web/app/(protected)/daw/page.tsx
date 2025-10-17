import { DAWContainer } from "@/components/daw";

// Force dynamic rendering to prevent prerendering issues with AudioContext
export const dynamic = "force-dynamic";

export default function DAWPage() {
	return <DAWContainer />;
}
