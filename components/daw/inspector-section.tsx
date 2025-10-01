import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type InspectorSectionProps = {
	title: string;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
};

export function InspectorSection({
	title,
	action,
	children,
	className,
}: InspectorSectionProps) {
	return (
		<section className={cn("space-y-3", className)}>
			<div className="flex items-center justify-between">
				<h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
					{title}
				</h3>
				{action}
			</div>
			{children}
		</section>
	);
}

type InspectorCardProps = {
	children: ReactNode;
	className?: string;
};

export function InspectorCard({ children, className }: InspectorCardProps) {
	return (
		<div
			className={cn(
				"rounded-2xl border border-border/70 bg-muted/10 p-4 shadow-sm",
				className,
			)}
		>
			{children}
		</div>
	);
}

