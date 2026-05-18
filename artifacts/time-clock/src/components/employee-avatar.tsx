const PALETTE = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-cyan-500",
];

function hashColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

interface EmployeeAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

export function EmployeeAvatar({ name, imageUrl, size = "md", className = "" }: EmployeeAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const colorClass = hashColor(name);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
