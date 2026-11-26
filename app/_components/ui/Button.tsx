import { forwardRef, type ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "text" | "icon";

const variantClass: Record<ButtonVariant, string> = {
  primary: "primary-button",
  secondary: "secondary-button",
  danger: "danger-button",
  text: "text-button",
  icon: "icon-button",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, className = "", ...props },
  ref,
) {
  const classes = [variant ? variantClass[variant] : "", className]
    .filter(Boolean)
    .join(" ");

  return <button {...props} ref={ref} className={classes || undefined} />;
});
