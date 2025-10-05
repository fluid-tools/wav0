"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function ThemeToggle() {
	const { setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="icon" variant="outline">
					<Sun className="h-[1.2rem] w-[1.2rem] dark:hidden" />
					<Moon className="hidden h-[1.2rem] w-[1.2rem] dark:block" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => setTheme("light")}>
					Light
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("dark")}>
					Dark
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("system")}>
					System
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ThemeToggleGroupInner() {
	const { theme, setTheme } = useTheme();

	return (
		<ToggleGroup
			className="w-full"
			onValueChange={(value) => value && setTheme(value)}
			size="sm"
			type="single"
			value={theme}
			variant="default"
		>
			<ToggleGroupItem aria-label="Light theme" value="light">
				<Sun />
			</ToggleGroupItem>
			<ToggleGroupItem aria-label="Dark theme" value="dark">
				<Moon />
			</ToggleGroupItem>
			<ToggleGroupItem aria-label="System theme" value="system">
				<Monitor />
			</ToggleGroupItem>
		</ToggleGroup>
	);
}

export const ThemeToggleGroup = dynamic(
	async () => ({ default: ThemeToggleGroupInner }),
	{ ssr: false },
);
