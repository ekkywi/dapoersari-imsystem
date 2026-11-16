import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

/** `on-dark` and `light` are for the navy summary bar only. */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "danger-solid"
  | "on-dark"
  | "light";
export type ButtonSize = "md" | "sm";

type Shared = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

export function buttonClass({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: Pick<Shared, "variant" | "size" | "block" | "className">): string {
  return [
    "ds-btn",
    `ds-btn-${variant}`,
    size === "sm" ? "ds-btn-sm" : "",
    block ? "ds-btn-block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = Shared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Shared>;

/**
 * Real <button>. A disabled primary action must have its reason written next to it
 * by the caller — the button itself only greys out.
 */
export function Button({
  variant,
  size,
  block,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, className })}
      {...rest}
    >
      {children}
    </button>
  );
}

type LinkButtonProps = Shared &
  Omit<ComponentProps<typeof Link>, keyof Shared | "href"> & {
    href: string;
    disabled?: boolean;
  };

/** Same look as Button, rendered as a navigation link. */
export function LinkButton({
  variant,
  size,
  block,
  className,
  children,
  href,
  disabled = false,
  ...rest
}: LinkButtonProps) {
  const cls = buttonClass({ variant, size, block, className });
  if (disabled) {
    return (
      <span className={cls} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}
