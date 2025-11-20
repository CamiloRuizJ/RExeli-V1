import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    variant?: "default" | "white" | "icon";
    size?: "sm" | "md" | "lg" | "xl";
}

export function Logo({ className, variant = "default", size = "md" }: LogoProps) {
    const isWhite = variant === "white";

    const width = {
        sm: 100,
        md: 120,
        lg: 140,
        xl: 160,
    }[size];

    const height = {
        sm: 30,
        md: 36,
        lg: 42,
        xl: 48,
    }[size];

    const logoSrc = isWhite ? "/logo-white.png" : "/logo.png";

    if (variant === "icon") {
        return (
            <Link href="/" className={cn("block transition-opacity hover:opacity-90", className)}>
                <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <span className="text-lg font-bold">R</span>
                </div>
            </Link>
        );
    }

    return (
        <Link href="/" className={cn("block transition-opacity hover:opacity-90", className)}>
            <Image
                src={logoSrc}
                alt="RExeli Logo"
                width={width}
                height={height}
                className="h-auto w-auto object-contain"
                priority
            />
        </Link>
    );
}
