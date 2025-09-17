"use client";
import { useTheme } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import { useEffect, useState } from "react";

export default function TopLoader() {
  const { theme } = useTheme();

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(
      theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }, [theme]);

  return (
    <NextTopLoader
      color={isDark ? "white" : "black"}
      height={4}
      showSpinner={true}
    />
  );
}
