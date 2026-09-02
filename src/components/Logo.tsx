import Image from "next/image";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/brand/impulsa-icon-transparent.png"
      alt="Impulsa Studio"
      width={size}
      height={size}
      className="block shrink-0"
      priority
    />
  );
}
